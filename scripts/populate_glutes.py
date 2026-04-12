#!/usr/bin/env python3
"""Populate biomechanics data for glute exercises using Beardsley principles."""
import json, re, random

JSON_PATH = "/Users/manavmht/Documents/HOS/src/modules/training/exercises_data.json"

# --- CLASSIFICATION ---
def classify(ex):
    name = ex["name"].lower()
    eid = ex["id"].lower()
    is_mob = ex.get("is_mobility", False)
    if is_mob:
        return "mobility"
    # Order matters — more specific first
    if any(k in name for k in ["hip thrust", "hip-thrust"]):
        return "hip_thrust"
    if "glute bridge" in name or "hip bridge" in name or "butt lift" in name or "frog pump" in name or "pelvic tilt" in name or "hip lift" in name:
        return "bridge"
    if any(k in name for k in ["pull-through", "pull through"]):
        return "pull_through"
    if any(k in name for k in ["kickback", "kick back", "donkey kick", "rear leg raise", "leg lift", "fire hydrant", "glute kick"]):
        return "kickback"
    if any(k in name for k in ["hyperextension", "reverse hyperextension", "back extension"]):
        return "extension"
    if "sled" in name:
        return "sled"
    if any(k in name for k in ["step up", "step-up"]):
        return "step_up"
    if any(k in name for k in ["kettlebell swing", "vertical swing"]):
        return "swing"
    if "snatch" in name:
        return "snatch"
    if "clean" in name:
        return "clean"
    if "deadlift" in name:
        return "deadlift"
    if any(k in name for k in ["abduction", "abductor", "clamshell", "lateral walk", "squat walk", "monster walk", "side leg", "lateral bound", "lateral box", "lateral cone", "carioca"]):
        return "abduction"
    if any(k in name for k in ["lunge", "curtsy"]):
        return "lunge"
    if any(k in name for k in ["squat", "kneeling jump", "kneeling squat"]):
        return "squat"
    if any(k in name for k in ["atlas", "keg", "sandbag", "tire flip", "rickshaw"]):
        return "strongman"
    if "downward facing" in name:
        return "kickback"
    return "other"

# --- BEARDSLEY BIOMECHANICS RULES ---
RULES = {
    "hip_thrust":   {"sc": "descending", "lp": "shortened", "sh": "low",      "sfr": "excellent", "fr": "moderate"},
    "bridge":       {"sc": "descending", "lp": "shortened", "sh": "low",      "sfr": "good",      "fr": "low"},
    "pull_through": {"sc": "bell_shaped","lp": "shortened", "sh": "low",      "sfr": "good",      "fr": "low"},
    "kickback":     {"sc": "flat",       "lp": "mid_range", "sh": "low",      "sfr": "excellent", "fr": "low"},
    "extension":    {"sc": "bell_shaped","lp": "mid_range", "sh": "moderate", "sfr": "good",      "fr": "low"},
    "deadlift":     {"sc": "ascending",  "lp": "mid_range", "sh": "moderate", "sfr": "moderate",  "fr": "high"},
    "clean":        {"sc": "ascending",  "lp": "mid_range", "sh": "low",      "sfr": "poor",      "fr": "high"},
    "snatch":       {"sc": "ascending",  "lp": "mid_range", "sh": "low",      "sfr": "poor",      "fr": "high"},
    "swing":        {"sc": "bell_shaped","lp": "shortened", "sh": "low",      "sfr": "moderate",  "fr": "moderate"},
    "sled":         {"sc": "flat",       "lp": "mid_range", "sh": "low",      "sfr": "moderate",  "fr": "moderate"},
    "step_up":      {"sc": "bell_shaped","lp": "mid_range", "sh": "low",      "sfr": "good",      "fr": "moderate"},
    "abduction":    {"sc": "bell_shaped","lp": "mid_range", "sh": "low",      "sfr": "good",      "fr": "low"},
    "lunge":        {"sc": "bell_shaped","lp": "mid_range", "sh": "moderate", "sfr": "moderate",  "fr": "moderate"},
    "squat":        {"sc": "bell_shaped","lp": "mid_range", "sh": "moderate", "sfr": "moderate",  "fr": "moderate"},
    "strongman":    {"sc": "ascending",  "lp": "mid_range", "sh": "low",      "sfr": "poor",      "fr": "high"},
    "mobility":     {"sc": "flat",       "lp": "mid_range", "sh": "none",     "sfr": "good",      "fr": "low"},
    "other":        {"sc": "bell_shaped","lp": "mid_range", "sh": "low",      "sfr": "moderate",  "fr": "moderate"},
}

# Band override: ascending curve
def apply_band_override(ex, rule):
    name = ex["name"].lower()
    if "band" in name and rule["sc"] != "ascending":
        rule = dict(rule)
        rule["sc"] = "ascending"
    return rule

# --- DESCRIPTIONS BY TYPE ---
DESCS = {
    "hip_thrust": [
        "A hip extension movement that loads the glutes at their strongest leverage point — near full extension. Because the resistance curve is descending, peak force coincides with peak glute moment arm, making this one of the most effective glute hypertrophy exercises.",
        "Loads the glutes through hip extension with maximal force at lockout, where the glute max has its greatest mechanical advantage. The shortened-position loading makes this superior to squat-based movements for glute-specific growth.",
        "A glute-dominant hip extension exercise where the hardest point is at the top, matching the glute's best leverage angle. Unlike deep squats where adductor magnus dominates, this keeps tension on the glutes throughout.",
    ],
    "bridge": [
        "A floor-based hip extension that loads the glutes at the shortened position. The descending strength curve means peak resistance occurs at lockout where glutes have their best moment arm. Lower systemic fatigue than hip thrusts makes this ideal for higher frequency training.",
        "A supine hip extension targeting the glutes at their strongest position — near full hip extension. The floor limits range of motion, keeping the movement in the zone where glutes have superior leverage over adductor magnus.",
    ],
    "pull_through": [
        "A cable hip extension that loads the glutes through a hip hinge pattern. The cable angle creates a bell-shaped resistance profile with peak tension near the shortened position, where glutes have their best mechanical advantage.",
        "A standing hip hinge using cable resistance that emphasizes the glute contraction at lockout. The horizontal force vector keeps tension on the glutes at the top of the movement, unlike barbell hinges where gravity reduces lockout tension.",
    ],
    "kickback": [
        "An isolation hip extension that targets the glute max with minimal systemic fatigue. The cable or bodyweight resistance provides relatively constant tension through the range, with excellent stimulus-to-fatigue ratio for accumulating glute volume.",
        "A single-leg hip extension isolation movement. The low systemic fatigue and direct glute targeting make this excellent for adding volume without impacting recovery from compound movements.",
    ],
    "extension": [
        "A hip extension performed from a hinged position that loads the glutes through the mid-range where they have good leverage. The bell-shaped resistance curve provides moderate stretch loading, though adductor magnus contributes significantly at the deepest hip flexion angles.",
        "A posterior chain exercise that loads hip extension through a large range of motion. Glutes contribute most through the mid-range, while adductor magnus dominates at deep flexion. Good stimulus-to-fatigue ratio with low systemic cost.",
    ],
    "deadlift": [
        "A compound hip hinge that loads the entire posterior chain. The ascending strength curve means the bottom position is hardest, where adductor magnus has the longest moment arm — not the glutes. Glutes contribute most through the mid-range. High systemic fatigue limits its efficiency as a pure glute exercise.",
        "A heavy hip extension compound where glutes contribute primarily through mid-range hip angles. At deep hip flexion, adductor magnus dominates hip extension torque. The high systemic fatigue cost means the stimulus-to-fatigue ratio for glutes specifically is only moderate.",
    ],
    "clean": [
        "An explosive hip extension movement where power is generated through rapid triple extension. The ballistic nature means time under tension is low, and the glutes contribute primarily through mid-range hip angles. High systemic fatigue relative to glute hypertrophy stimulus.",
        "A power movement driven by explosive hip extension. While glutes fire hard during the pull, the brief time under tension and high fatigue cost make this a poor choice for glute hypertrophy compared to hip thrusts or bridges.",
    ],
    "snatch": [
        "An explosive full-body lift where the glutes contribute to the hip extension phase. The ballistic nature and high technical demand mean low time under tension for the glutes. Fatigue cost is high relative to the hypertrophy stimulus delivered to the glutes.",
        "A power-focused Olympic lift variant. Glutes fire during the hip snap but the explosive tempo limits mechanical tension accumulation. Better suited for power development than glute hypertrophy.",
    ],
    "swing": [
        "A ballistic hip hinge where the glutes generate force through rapid hip extension — the 'hip snap.' Peak glute activation occurs at the shortened position during lockout. Moderate stimulus-to-fatigue ratio due to the cardiovascular demand.",
        "An explosive hip extension movement where the glutes drive the bell forward through a powerful hip snap at the top. The shortened-position loading aligns with the glute's best leverage angle.",
    ],
    "sled": [
        "A horizontal pushing or pulling movement that loads hip extension against constant resistance. The flat strength curve and continuous tension provide steady glute loading through the mid-range of hip extension.",
    ],
    "step_up": [
        "A unilateral hip and knee extension that loads the glutes through mid-range hip angles. The bell-shaped resistance curve and single-leg demand create good glute activation with moderate systemic fatigue.",
        "A single-leg compound movement where the glutes work through hip extension from a moderate flexion angle. The unilateral nature increases glute recruitment compared to bilateral squatting.",
    ],
    "abduction": [
        "A hip abduction movement targeting the gluteus medius and upper glute max fibers. The abduction vector is distinct from hip extension — this trains the lateral stabilization function of the glutes rather than the hip extension function.",
        "An isolation movement for the hip abductors, primarily gluteus medius. Low systemic fatigue makes this efficient for targeting the upper glute fibers that contribute to hip stability.",
    ],
    "lunge": [
        "A unilateral hip and knee extension compound. The split stance increases glute demand compared to bilateral squats, and the single-leg loading improves glute recruitment through mid-range hip angles. Adductor magnus still contributes at the deepest positions.",
        "A single-leg compound where the glutes work through hip extension from a split stance. Moderate stretch loading occurs at the bottom, though adductor magnus shares the load at deep hip flexion.",
    ],
    "squat": [
        "A compound knee and hip extension movement. While often prescribed for glutes, the deepest positions are dominated by adductor magnus due to its superior moment arm at deep hip flexion. Glutes contribute more through the mid-range toward lockout.",
        "A bilateral compound that loads hip and knee extension. Glute contribution increases as hip angle approaches extension — at deep flexion, adductor magnus has the mechanical advantage. Adding bands or chains can shift peak force toward lockout to improve glute stimulus.",
    ],
    "strongman": [
        "A full-body compound lift requiring explosive hip extension from a deep position. The glutes contribute through mid-range hip angles, but the high systemic fatigue and technical demand make this inefficient for targeted glute hypertrophy.",
    ],
    "mobility": [
        "A flexibility or soft tissue exercise targeting the glute and hip region. No hypertrophy stimulus — the goal is to improve range of motion, reduce tissue stiffness, or address movement restrictions around the hip.",
        "A mobility drill for the hip and glute complex. Useful for warm-up or recovery, but provides no meaningful mechanical tension for muscle growth.",
    ],
    "other": [
        "A movement involving hip extension where the glutes contribute as a synergist. The glutes work through their available range but may not be the primary driver depending on the specific mechanics.",
    ],
}

# --- TIPS BY TYPE ---
TIPS = {
    "hip_thrust": [
        ["Squeeze hard at the top for a full second — this is where glutes have their best leverage",
         "Keep your chin tucked and ribs down to prevent lumbar hyperextension",
         "Drive through your heels, not your toes",
         "Position the bar in your hip crease, not on your stomach",
         "Feet placement: shins roughly vertical at the top position"],
        ["Focus on the lockout — don't just lift the weight, actively contract the glutes at the top",
         "Posterior pelvic tilt at the top maximizes glute activation",
         "Avoid pushing your hips too high — hyperextension shifts load to the lower back",
         "Use a pad or towel on the bar for comfort"],
    ],
    "bridge": [
        ["Drive your hips up by squeezing your glutes, not by pushing through your lower back",
         "Hold the top position for 1-2 seconds to maximize shortened-position tension",
         "Keep your core braced to prevent lumbar hyperextension",
         "Feet flat, knees at roughly 90 degrees at the top"],
        ["Focus on the squeeze at the top — this is where the glutes are strongest",
         "Don't let your ribs flare — maintain a neutral spine",
         "For single-leg variants, keep your hips level throughout"],
    ],
    "pull_through": [
        ["Hinge at the hips, not the lower back — maintain a neutral spine",
         "Squeeze the glutes hard at the top to lock out",
         "Keep the cable between your legs and stand far enough from the stack",
         "Soft knee bend — this is a hip hinge, not a squat"],
    ],
    "kickback": [
        ["Focus on hip extension, not knee extension — drive the heel back",
         "Keep your core tight to prevent rotation or lumbar extension",
         "Control the eccentric — don't let the weight snap back",
         "Squeeze at the top of each rep for peak glute contraction"],
        ["Use a controlled tempo — momentum defeats the purpose of isolation",
         "Keep the working leg's knee at a fixed angle throughout",
         "Avoid arching your lower back to get more range of motion"],
    ],
    "extension": [
        ["Hinge at the hips, not the lower back",
         "Squeeze the glutes to drive the movement — don't hyperextend the spine",
         "Control the descent to maintain tension on the posterior chain",
         "Round your upper back slightly to reduce erector contribution and increase glute demand"],
    ],
    "deadlift": [
        ["Brace your core hard before each rep — this protects the spine and improves force transfer",
         "Think of pushing the floor away rather than pulling the bar up",
         "Keep the bar close to your body throughout the lift",
         "Lock out with the glutes, not by leaning back",
         "Glutes contribute most from mid-shin to lockout — focus on squeezing through that range"],
    ],
    "clean": [
        ["Explosive hip extension drives the bar — don't arm-pull",
         "Keep the bar close to your body during the pull",
         "Full hip extension before pulling under the bar",
         "Start with lighter loads to master the timing"],
    ],
    "snatch": [
        ["Speed and timing matter more than raw strength",
         "Full hip extension before pulling under",
         "Keep the bar path close and vertical",
         "Warm up thoroughly — this is a high-velocity movement"],
    ],
    "swing": [
        ["Power comes from the hip snap, not the arms — arms are just along for the ride",
         "Hike the bell back between your legs like a football snap",
         "Stand tall and squeeze the glutes hard at the top",
         "Don't squat the swing — it's a hinge pattern"],
    ],
    "sled": [
        ["Drive through the full foot with each step",
         "Keep your torso at a consistent angle",
         "Focus on full hip extension with each stride"],
    ],
    "step_up": [
        ["Drive through the heel of the top foot — don't push off the bottom foot",
         "Control the descent to maintain tension on the working glute",
         "Keep your torso upright to maximize hip extension demand",
         "Use a box height that puts your thigh at or just below parallel"],
    ],
    "abduction": [
        ["Focus on pushing the knee out, not rotating the foot",
         "Keep your pelvis stable — don't let it shift or rotate",
         "Control the return — don't let the weight slam back",
         "Maintain an upright torso for seated variations"],
    ],
    "lunge": [
        ["Take a long enough step to feel a stretch in the trailing hip flexor",
         "Drive up through the front heel to maximize glute engagement",
         "Keep your torso upright or slightly forward-leaning",
         "Control the descent — don't drop into the bottom position"],
    ],
    "squat": [
        ["Adding bands or chains shifts peak force toward lockout where glutes have better leverage",
         "Drive your knees out to increase glute recruitment",
         "Focus on the drive out of the hole — glutes contribute most from mid-range to lockout",
         "Note: at deep hip flexion, adductor magnus has the longest moment arm for hip extension, not glutes"],
    ],
    "strongman": [
        ["Brace hard and drive through the hips",
         "Keep the implement close to your body",
         "Explosive hip extension is key — lock out hard at the top"],
    ],
    "mobility": [
        ["Hold each position for 30-60 seconds for static stretches",
         "Breathe deeply and relax into the stretch",
         "Don't force range of motion — ease into it progressively",
         "Use this for warm-up or recovery, not as a hypertrophy stimulus"],
    ],
    "other": [
        ["Focus on controlled hip extension through the available range",
         "Squeeze the glutes at the point of peak contraction",
         "Maintain a neutral spine throughout"],
    ],
}

# --- COACHING CUES BY TYPE ---
CUES = {
    "hip_thrust": [
        ["Squeeze at the top", "Drive through heels", "Chin tucked, ribs down"],
        ["Lock out with glutes", "Posterior tilt at top", "Heels down, hips up"],
    ],
    "bridge": [
        ["Squeeze and hold", "Hips up, ribs down", "Drive through heels"],
        ["Glutes tight at top", "Core braced", "Flat back on floor"],
    ],
    "pull_through": [
        ["Hinge back, snap forward", "Squeeze at lockout", "Soft knees, hip hinge"],
    ],
    "kickback": [
        ["Heel drives back", "Squeeze at the top", "No lower back arch"],
        ["Controlled tempo", "Hip extends, knee stays", "Core tight"],
    ],
    "extension": [
        ["Hinge at hips", "Squeeze glutes to rise", "Don't hyperextend"],
    ],
    "deadlift": [
        ["Push the floor away", "Bar stays close", "Lock out with glutes"],
        ["Brace and pull", "Hips and shoulders rise together", "Squeeze at the top"],
    ],
    "clean": [
        ["Explode through the hips", "Bar stays close", "Full extension then pull under"],
    ],
    "snatch": [
        ["Fast hips", "Bar close, pull under", "Lock out overhead"],
    ],
    "swing": [
        ["Hip snap", "Arms are ropes", "Stand tall at the top"],
    ],
    "sled": [
        ["Full hip extension each step", "Stay low", "Drive through the ground"],
    ],
    "step_up": [
        ["Drive through top heel", "Control the descent", "Stand tall at top"],
    ],
    "abduction": [
        ["Push knees apart", "Pelvis stays stable", "Control the return"],
    ],
    "lunge": [
        ["Front heel drives up", "Long step", "Torso upright"],
    ],
    "squat": [
        ["Knees out", "Drive through mid-foot", "Squeeze glutes at lockout"],
    ],
    "strongman": [
        ["Brace hard", "Explosive hips", "Lock out at top"],
    ],
    "mobility": [
        ["Breathe and relax", "Ease into it", "Hold position"],
    ],
    "other": [
        ["Control the movement", "Squeeze glutes", "Neutral spine"],
    ],
}

# --- MAIN EXECUTION ---
with open(JSON_PATH) as f:
    data = json.load(f)

counts = {}
modified = 0

for ex in data:
    if ex.get("muscle_group") != "glutes":
        continue

    etype = classify(ex)
    counts[etype] = counts.get(etype, 0) + 1
    rule = apply_band_override(ex, RULES[etype])

    # Apply biomechanics fields
    ex["strength_curve"] = rule["sc"]
    ex["loading_position"] = rule["lp"]
    ex["stretch_hypertrophy_potential"] = rule["sh"]
    ex["stimulus_to_fatigue"] = rule["sfr"]
    ex["fatigue_rating"] = rule["fr"]

    # Pick varied content
    ex["description"] = random.choice(DESCS[etype])
    ex["tips"] = random.choice(TIPS[etype])
    ex["coaching_cues"] = random.choice(CUES[etype])

    # SAFETY CHECK: no glute exercise should have high stretch hypertrophy
    assert ex["stretch_hypertrophy_potential"] != "high", f"VIOLATION: {ex['name']} has high stretch_hypertrophy_potential"

    modified += 1

with open(JSON_PATH, "w") as f:
    json.dump(data, f, indent=2)

print(f"\n✅ Modified {modified} glute exercises")
print(f"\nClassification breakdown:")
for k, v in sorted(counts.items(), key=lambda x: -x[1]):
    r = RULES[k]
    print(f"  {k:15s}: {v:3d} exercises | curve={r['sc']:12s} load={r['lp']:10s} stretch={r['sh']:10s} SFR={r['sfr']:10s} fatigue={r['fr']}")

# Verify no high stretch
with open(JSON_PATH) as f:
    verify = json.load(f)
violations = [e["name"] for e in verify if e.get("muscle_group") == "glutes" and e.get("stretch_hypertrophy_potential") == "high"]
if violations:
    print(f"\n❌ VIOLATIONS FOUND: {violations}")
else:
    print(f"\n✅ VERIFIED: No glute exercise has stretch_hypertrophy_potential='high'")
