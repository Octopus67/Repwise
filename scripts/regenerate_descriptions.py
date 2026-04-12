#!/usr/bin/env python3
"""
Regenerate exercise descriptions and instructions for all 1,200 exercises.

Uses 3 format variants:
- Standard (compound/isolation with equipment) → 5 layers
- Bodyweight/isometric → 3 layers
- Stretch/mobility → 2 layers

Processes in batches of 10 exercises.
"""

import json
import os
import sys
import time
import re

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'src', 'modules', 'training', 'exercises_data.json')

SYSTEM_PROMPT = """You are an expert exercise science writer for a premium fitness app. Write exercise descriptions that are:
- Engaging and accessible to regular gym-goers (NOT textbook language)
- Scientifically accurate (reference biomechanics correctly)
- Formatted with markdown bold (**text**) for key terms
- Concise — respect the word limits strictly

RULES:
- Use second person ("you") for user-facing text
- Never use jargon without explaining it
- The hook must make someone WANT to read more
- Pro tips must be specific to THIS exercise, never generic
- Instructions must match the EXACT equipment specified
- Each instruction step must be one clear action"""

def get_format_variant(exercise: dict) -> str:
    """Determine which format variant to use."""
    cat = exercise.get('category', '').lower()
    equip = exercise.get('equipment', '').lower()
    name = exercise.get('name', '').lower()

    if any(w in name for w in ['stretch', 'mobility', 'cat-cow', 'hip circle']):
        return 'stretch'
    if equip == 'bodyweight' and cat != 'compound':
        if any(w in name for w in ['plank', 'hold', 'wall sit', 'dead hang', 'l-sit']):
            return 'isometric'
    return 'standard'

def build_prompt(exercises: list[dict]) -> str:
    """Build the LLM prompt for a batch of exercises."""
    items = []
    for e in exercises:
        variant = get_format_variant(e)
        ctx = (
            f"Name: {e['name']}\n"
            f"Equipment: {e['equipment']}\n"
            f"Category: {e['category']}\n"
            f"Primary muscle: {e['muscle_group']}\n"
            f"Secondary muscles: {', '.join(e.get('secondary_muscles', []))}\n"
            f"Strength curve: {e.get('strength_curve', 'unknown')}\n"
            f"Loading position: {e.get('loading_position', 'unknown')}\n"
            f"SFR: {e.get('stimulus_to_fatigue', 'unknown')}\n"
            f"Stretch potential: {e.get('stretch_hypertrophy_potential', 'unknown')}\n"
            f"Format: {variant}"
        )
        items.append(ctx)

    exercises_block = "\n---\n".join(items)

    return f"""Generate descriptions and instructions for these exercises.

For STANDARD format, output:
```
EXERCISE: [name]
DESCRIPTION:
**[Hook - 1 sentence, max 30 words]**

**Muscles worked:** Primary: [muscle]. Secondary: [list].

[Why it works - 2-3 sentences, max 60 words. Accessible language.]

**Pro tip:** [One specific insight, max 40 words.]

**Biomechanics:** [Strength curve, loading position, stretch potential. Max 80 words.]
INSTRUCTIONS:
1. [Step]
2. [Step]
3. [Step]
```

For ISOMETRIC format, output:
```
EXERCISE: [name]
DESCRIPTION:
**[Hook - 1 sentence]**

**Muscles worked:** Primary: [muscle]. Secondary: [list].

[Why it works - 2-3 sentences, max 80 words.]

**Pro tip:** [Expanded tip with form cues, max 60 words.]
INSTRUCTIONS:
1. [Step]
2. [Step]
3. [Step]
```

For STRETCH format, output:
```
EXERCISE: [name]
DESCRIPTION:
**[What this stretch does - 1 sentence]**

**Target areas:** [muscles/joints]

[How to get the most from it - 2-3 sentences, max 60 words. Focus on breathing, hold duration.]
INSTRUCTIONS:
1. [Step]
2. [Step]
3. [Step]
```

CRITICAL: Instructions MUST match the exact equipment. A barbell exercise must reference a barbell, not dumbbells.

Exercises:
{exercises_block}"""


def parse_response(text: str, exercises: list[dict]) -> list[dict]:
    """Parse LLM response into structured data."""
    results = []
    blocks = re.split(r'EXERCISE:\s*', text)
    blocks = [b.strip() for b in blocks if b.strip()]

    for i, block in enumerate(blocks):
        if i >= len(exercises):
            break

        desc_match = re.search(r'DESCRIPTION:\s*(.*?)(?=INSTRUCTIONS:|$)', block, re.DOTALL)
        instr_match = re.search(r'INSTRUCTIONS:\s*(.*?)$', block, re.DOTALL)

        description = desc_match.group(1).strip() if desc_match else exercises[i].get('description', '')
        instr_text = instr_match.group(1).strip() if instr_match else ''

        # Parse numbered instructions
        instructions = []
        for line in instr_text.split('\n'):
            line = re.sub(r'^\d+\.\s*', '', line.strip())
            if line:
                instructions.append(line)

        results.append({
            'name': exercises[i]['name'],
            'description': description,
            'instructions': instructions if instructions else exercises[i].get('instructions', []),
        })

    return results


def generate_batch_local(exercises: list[dict]) -> list[dict]:
    """Generate descriptions using the exercise data directly (no LLM call).

    This creates well-formatted descriptions from the existing data,
    restructured into the 5-layer format with markdown.
    """
    results = []
    for e in exercises:
        variant = get_format_variant(e)
        name = e['name']
        muscle = e['muscle_group']
        secondary = ', '.join(e.get('secondary_muscles', [])) or 'none'
        equip = e['equipment'].replace('_', ' ')
        curve = (e.get('strength_curve') or 'unknown').replace('_', '-')
        loading = (e.get('loading_position') or 'unknown').replace('_', ' ')
        sfr = e.get('stimulus_to_fatigue') or 'unknown'
        stretch = e.get('stretch_hypertrophy_potential') or 'unknown'
        cat = e.get('category', 'compound')
        old_desc = e.get('description', '')

        if variant == 'stretch':
            desc = (
                f"**A targeted stretch for your {muscle}.**\n\n"
                f"**Target areas:** {muscle}"
                + (f", {secondary}" if secondary != 'none' else '') + "\n\n"
                f"Hold for 30-60 seconds per side, breathing deeply into the stretch. "
                f"Best used after training or on rest days to improve flexibility and recovery."
            )
        elif variant == 'isometric':
            desc = (
                f"**A {equip} isometric hold that builds {muscle} endurance and stability.**\n\n"
                f"**Muscles worked:** Primary: {muscle}. Secondary: {secondary}.\n\n"
                f"{old_desc}\n\n"
                f"**Pro tip:** Focus on maintaining perfect form throughout the hold. "
                f"Breathe steadily — holding your breath reduces time under tension."
            )
        else:
            # Standard format
            hook = _generate_hook(name, muscle, equip, cat)
            why = _generate_why(name, muscle, equip, curve, loading, sfr, old_desc)
            pro_tip = _generate_pro_tip(name, curve, loading, stretch, e.get('tips', []))
            bio = _generate_biomechanics(curve, loading, sfr, stretch)

            desc = (
                f"**{hook}**\n\n"
                f"**Muscles worked:** Primary: {muscle}. Secondary: {secondary}.\n\n"
                f"{why}\n\n"
                f"**Pro tip:** {pro_tip}\n\n"
                f"**Biomechanics:** {bio}"
            )

        # Generate proper instructions
        instructions = _generate_instructions(name, equip, muscle, cat, e.get('instructions', []))

        results.append({
            'name': name,
            'description': desc,
            'instructions': instructions,
        })

    return results


def _generate_hook(name: str, muscle: str, equip: str, cat: str) -> str:
    """Generate a compelling one-liner hook."""
    muscle_display = muscle.replace('_', ' ')
    if cat == 'compound':
        return f"A powerful {equip} compound movement that builds serious {muscle_display} strength."
    return f"An effective {equip} isolation exercise that targets your {muscle_display} directly."


def _generate_why(name: str, muscle: str, equip: str, curve: str, loading: str, sfr: str, old_desc: str) -> str:
    """Generate the 'why it works' section from existing description."""
    # Clean up the old description — remove overly technical language
    cleaned = old_desc
    for jargon, plain in [
        ('sternal and clavicular pec fibers', 'upper and lower chest'),
        ('stretch-mediated hypertrophy', 'muscle growth from the stretched position'),
        ('stimulus-to-fatigue ratio', 'muscle stimulus relative to fatigue'),
        ('mechanical tension', 'muscle tension'),
        ('ascending strength curve', 'increasing resistance as you extend'),
        ('descending strength curve', 'decreasing resistance as you extend'),
        ('bell-shaped resistance', 'resistance that peaks in the middle'),
        ('flat resistance profile', 'constant resistance throughout the movement'),
    ]:
        cleaned = cleaned.replace(jargon, plain)

    # Truncate to ~60 words
    words = cleaned.split()
    if len(words) > 65:
        cleaned = ' '.join(words[:60]) + '.'
    return cleaned


def _generate_pro_tip(name: str, curve: str, loading: str, stretch: str, tips: list) -> str:
    """Generate a pro tip from existing tips or biomechanics data."""
    if tips and len(tips) > 0:
        # Use the first tip, cleaned up
        tip = tips[0]
        words = tip.split()
        if len(words) > 45:
            tip = ' '.join(words[:40]) + '.'
        return tip

    if loading == 'stretched':
        return "Control the eccentric (lowering) phase — the stretched position is where most growth happens."
    if stretch == 'high':
        return "Use a full range of motion to maximize the stretch at the bottom of each rep."
    return "Focus on the mind-muscle connection and control each rep through the full range of motion."


def _generate_biomechanics(curve: str, loading: str, sfr: str, stretch: str) -> str:
    """Generate the biomechanics section."""
    parts = []
    curve_map = {
        'ascending': 'Ascending resistance curve — gets harder as you extend, easiest at the bottom.',
        'descending': 'Descending resistance curve — hardest at the start, gets easier as you extend.',
        'bell-shaped': 'Bell-shaped resistance curve — peaks in the mid-range of the movement.',
        'bell_shaped': 'Bell-shaped resistance curve — peaks in the mid-range of the movement.',
        'flat': 'Flat resistance profile — constant tension throughout the entire range of motion.',
    }
    parts.append(curve_map.get(curve, f'{curve.replace("_", "-").title()} resistance curve.'))

    loading_map = {
        'stretched': 'Peak loading at the stretched position — high growth stimulus at long muscle lengths.',
        'mid_range': 'Peak loading at mid-range — moderate stretch stimulus.',
        'mid-range': 'Peak loading at mid-range — moderate stretch stimulus.',
        'shortened': 'Peak loading at the shortened position — strong contraction emphasis.',
    }
    parts.append(loading_map.get(loading, ''))

    sfr_map = {
        'excellent': 'Excellent stimulus-to-fatigue ratio — high muscle stimulus with minimal systemic fatigue.',
        'good': 'Good stimulus-to-fatigue ratio — solid muscle stimulus with manageable fatigue.',
        'moderate': 'Moderate stimulus-to-fatigue ratio — effective but generates notable systemic fatigue.',
        'poor': 'Lower stimulus-to-fatigue ratio — consider alternatives if recovery is limited.',
    }
    parts.append(sfr_map.get(sfr, ''))

    return ' '.join(p for p in parts if p)


def _generate_instructions(name: str, equip: str, muscle: str, cat: str, existing: list) -> list:
    """Generate or validate instructions."""
    name_lower = name.lower()
    equip_lower = equip.lower()

    # Check if existing instructions match the equipment
    if existing and len(existing) >= 3:
        instr_text = ' '.join(existing[:2]).lower()
        mismatched = False
        if 'barbell' in name_lower and 'dumbbell' in instr_text:
            mismatched = True
        elif 'dumbbell' in name_lower and 'barbell' in instr_text:
            mismatched = True
        elif 'cable' in name_lower and ('dumbbell' in instr_text or 'barbell' in instr_text):
            mismatched = True

        if not mismatched:
            return existing  # Keep valid existing instructions

    # Generate generic but correct instructions
    return _build_generic_instructions(name, equip_lower, muscle, cat)


def _build_generic_instructions(name: str, equip: str, muscle: str, cat: str) -> list:
    """Build generic instructions that match the equipment."""
    muscle_display = muscle.replace('_', ' ')

    if 'barbell' in equip:
        return [
            f"Set up a barbell with appropriate weight on a rack or the floor.",
            f"Grip the bar at the appropriate width for {name.lower()}.",
            f"Perform the movement with controlled form, focusing on your {muscle_display}.",
            f"Return to the starting position under control.",
            f"Complete all prescribed reps before re-racking."
        ]
    elif 'dumbbell' in equip:
        return [
            f"Select a pair of dumbbells with appropriate weight.",
            f"Get into the starting position for {name.lower()}.",
            f"Perform the movement with controlled form, focusing on your {muscle_display}.",
            f"Return to the starting position under control.",
            f"Complete all prescribed reps."
        ]
    elif 'cable' in equip:
        return [
            f"Set the cable pulley to the appropriate height and attach the correct handle.",
            f"Grip the handle and position yourself for {name.lower()}.",
            f"Perform the movement with smooth, controlled form.",
            f"Return to the starting position, maintaining tension throughout.",
            f"Complete all prescribed reps."
        ]
    elif 'machine' in equip:
        return [
            f"Adjust the machine seat and settings to fit your body.",
            f"Position yourself and grip the handles for {name.lower()}.",
            f"Perform the movement through a full range of motion.",
            f"Return to the starting position under control.",
            f"Complete all prescribed reps."
        ]
    elif 'bodyweight' in equip:
        return [
            f"Get into the starting position for {name.lower()}.",
            f"Engage your {muscle_display} and perform the movement with control.",
            f"Return to the starting position.",
            f"Complete all prescribed reps."
        ]
    else:
        return [
            f"Set up the equipment for {name.lower()}.",
            f"Get into the starting position with proper form.",
            f"Perform the movement, focusing on your {muscle_display}.",
            f"Return to the starting position under control.",
            f"Complete all prescribed reps."
        ]


def main():
    """Main entry point."""
    print("Loading exercise data...")
    with open(DATA_PATH, 'r') as f:
        exercises = json.load(f)

    print(f"Processing {len(exercises)} exercises...")

    batch_size = 10
    updated = 0

    for i in range(0, len(exercises), batch_size):
        batch = exercises[i:i + batch_size]
        results = generate_batch_local(batch)

        for j, result in enumerate(results):
            idx = i + j
            exercises[idx]['description'] = result['description']
            exercises[idx]['instructions'] = result['instructions']
            updated += 1

        pct = min(100, round((i + batch_size) / len(exercises) * 100))
        print(f"  [{pct:3d}%] Processed {min(i + batch_size, len(exercises))}/{len(exercises)}")

    print(f"\nWriting {updated} updated exercises...")
    with open(DATA_PATH, 'w') as f:
        json.dump(exercises, f, indent=2, ensure_ascii=False)

    print(f"Done! {updated} exercises updated.")


if __name__ == '__main__':
    main()
