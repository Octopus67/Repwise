#!/usr/bin/env python3
"""Chest exercise biomechanics data generator based on Chris Beardsley's principles."""
import json, os, random

JSON_PATH = os.path.join(os.path.dirname(__file__), '..', 'src', 'modules', 'training', 'exercises_data.json')
random.seed(42)  # reproducible

def classify(name, equip, is_mob):
    n = name.lower()
    if is_mob: return 'mobility'
    if 'pullover' in n: return 'pullover'
    if 'svend' in n or 'squeeze press' in n or 'hex press' in n or 'plate press' in n: return 'squeeze'
    if 'isometric' in n: return 'isometric'
    if 'dip' in n: return 'dip'
    if 'cross over' in n or 'crossover' in n or 'iron cross' in n: return 'crossover'
    if any(w in n for w in ['fly', 'flye', 'butterfly', 'pec deck', 'around the world']): return 'fly'
    if any(w in n for w in ['push-up', 'pushup', 'push up', 'chain press', 'plyo push']): return 'pushup'
    if any(w in n for w in ['bench press', 'floor press', 'chest press', 'neck press', 'guillotine', 'smith press', 'smith machine']): return 'bench'
    if any(w in n for w in ['dumbbell press', 'incline press', 'decline press', 'machine press']): return 'bench'
    if 'palms facing in' in n and 'dumbbell' in n: return 'bench'
    if 'landmine' in n: return 'landmine'
    if any(w in n for w in ['chest push', 'chest throw', 'supine chest', 'medicine ball', 'heavy bag', 'drop push', 'forward drag']): return 'explosive'
    return 'other'

def angle(name):
    n = name.lower()
    if 'incline' in n: return 'incline'
    if 'decline' in n: return 'decline'
    return 'flat'

def equip_label(equip, name):
    n = name.lower()
    if 'smith' in n: return 'Smith machine'
    return {'barbell':'barbell','dumbbell':'dumbbell','kettlebell':'kettlebell',
            'cable':'cable','machine':'machine','smith_machine':'Smith machine',
            'band':'resistance band','bodyweight':'bodyweight'}.get(equip, equip)

# --- Biomechanics rules ---
def get_curve(cat, equip, name):
    n = name.lower()
    if cat == 'mobility': return 'flat'
    if cat == 'bench':
        if 'band' in equip or 'band' in n: return 'ascending'
        if 'chain' in n: return 'ascending'
        if 'machine' in equip or 'smith' in n: return 'flat'
        if 'cable' in equip: return 'flat'
        return 'bell_shaped'
    if cat == 'fly':
        if 'machine' in equip or 'pec deck' in n or 'butterfly' in n: return 'flat'
        if 'cable' in equip: return 'bell_shaped'
        if 'band' in equip: return 'ascending'
        return 'bell_shaped'
    if cat == 'crossover':
        if 'high' in n: return 'descending'
        if 'low' in n: return 'flat'
        if 'band' in equip: return 'ascending'
        return 'flat'
    if cat == 'pushup':
        if 'band' in equip or 'band' in n: return 'ascending'
        return 'bell_shaped'
    if cat == 'dip': return 'ascending'
    if cat == 'pullover': return 'ascending'
    if cat == 'squeeze': return 'bell_shaped'
    if cat == 'isometric': return 'flat'
    if cat == 'landmine': return 'ascending'
    if cat == 'explosive': return 'bell_shaped'
    return 'bell_shaped'

def get_loading(cat, equip, name):
    n = name.lower()
    if cat == 'mobility': return 'stretched'
    if cat == 'bench':
        if 'machine' in equip or 'smith' in n: return 'mid_range'
        if 'cable' in equip: return 'mid_range'
        return 'stretched'
    if cat == 'fly':
        if 'machine' in equip or 'pec deck' in n or 'butterfly' in n: return 'mid_range'
        if 'cable' in equip: return 'stretched'
        return 'stretched'
    if cat == 'crossover':
        if 'high' in n: return 'stretched'
        if 'low' in n: return 'mid_range'
        if 'single' in n: return 'mid_range'
        return 'mid_range'
    if cat == 'pushup': return 'stretched'
    if cat == 'dip': return 'stretched'
    if cat == 'pullover': return 'stretched'
    if cat in ('squeeze', 'isometric'): return 'shortened'
    if cat == 'landmine': return 'mid_range'
    if cat == 'explosive': return 'stretched'
    return 'mid_range'

def get_stretch_potential(cat, equip, name):
    n = name.lower()
    if cat == 'mobility': return 'none'
    if cat == 'fly':
        if 'machine' in equip or 'pec deck' in n or 'butterfly' in n: return 'moderate'
        if 'dumbbell' in equip: return 'high'
        if 'cable' in equip: return 'high'
        if 'band' in equip: return 'moderate'
        return 'high'
    if cat == 'bench':
        if 'dumbbell' in equip or 'kettlebell' in equip: return 'high'
        if 'barbell' in equip: return 'moderate'
        if 'machine' in equip or 'smith' in n: return 'moderate'
        if 'cable' in equip: return 'moderate'
        if 'band' in equip: return 'moderate'
        return 'moderate'
    if cat == 'crossover':
        if 'high' in n: return 'high'
        return 'moderate'
    if cat == 'pushup': return 'moderate'
    if cat == 'dip': return 'high'
    if cat == 'pullover': return 'high'
    if cat in ('squeeze', 'isometric'): return 'low'
    if cat == 'landmine': return 'moderate'
    if cat == 'explosive': return 'low'
    return 'moderate'

def get_stf(cat, equip, name):
    n = name.lower()
    if cat == 'mobility': return 'excellent'
    if cat == 'fly':
        if 'cable' in equip: return 'excellent'
        if 'machine' in equip or 'pec deck' in n: return 'excellent'
        if 'dumbbell' in equip: return 'good'
        return 'good'
    if cat == 'crossover': return 'excellent'
    if cat == 'bench':
        if 'machine' in equip or 'smith' in n: return 'good'
        if 'cable' in equip: return 'good'
        if 'dumbbell' in equip: return 'good'
        if 'barbell' in equip: return 'moderate'
        return 'moderate'
    if cat == 'pushup': return 'good'
    if cat == 'dip': return 'moderate'
    if cat == 'pullover': return 'good'
    if cat in ('squeeze', 'isometric'): return 'good'
    if cat == 'landmine': return 'good'
    if cat == 'explosive': return 'moderate'
    return 'moderate'

def get_fatigue(cat, equip, name):
    if cat == 'mobility': return 'low'
    if cat in ('fly', 'crossover', 'squeeze', 'isometric'): return 'low'
    if cat == 'pushup': return 'moderate'
    if cat == 'pullover': return 'moderate'
    if cat == 'landmine': return 'moderate'
    if cat == 'bench':
        if 'barbell' in equip: return 'high'
        if 'machine' in equip or 'smith' in name.lower(): return 'moderate'
        return 'moderate'
    if cat == 'dip': return 'high'
    if cat == 'explosive': return 'moderate'
    return 'moderate'

# Load description/tips/cues generators from part 2
from chest_descriptions import get_description, get_tips, get_cues

def generate(ex):
    name, equip, is_mob = ex['name'], ex.get('equipment',''), ex.get('is_mobility', False)
    cat = classify(name, equip, is_mob)
    ang = angle(name)
    el = equip_label(equip, name)
    return {
        'description': get_description(cat, ang, el, name),
        'tips': get_tips(cat, ang, el, name),
        'coaching_cues': get_cues(cat, ang, el, name),
        'strength_curve': get_curve(cat, equip, name),
        'loading_position': get_loading(cat, equip, name),
        'stretch_hypertrophy_potential': get_stretch_potential(cat, equip, name),
        'stimulus_to_fatigue': get_stf(cat, equip, name),
        'fatigue_rating': get_fatigue(cat, equip, name),
    }

def main():
    with open(JSON_PATH) as f:
        data = json.load(f)
    updated, cats = 0, {}
    for ex in data:
        if ex.get('muscle_group','').lower() != 'chest': continue
        fields = generate(ex)
        for k, v in fields.items():
            ex[k] = v
        cat = classify(ex['name'], ex.get('equipment',''), ex.get('is_mobility',False))
        cats[cat] = cats.get(cat, 0) + 1
        updated += 1
    with open(JSON_PATH, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n✅ Updated {updated} chest exercises")
    print(f"\nBreakdown by category:")
    for c, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {c}: {n}")

if __name__ == '__main__':
    main()
