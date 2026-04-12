#!/usr/bin/env python3
"""Populate biomechanics data for all lat exercises using Beardsley principles."""
import json, re

JSON_PATH = '/Users/manavmht/Documents/HOS/src/modules/training/exercises_data.json'

# --- CLASSIFICATION ---
def classify(ex):
    eid = ex['id']
    name = ex['name'].lower()
    equip = ex.get('equipment','')
    mob = ex.get('is_mobility', False)
    
    if mob:
        return 'mobility'
    
    # Straight-arm pulldowns
    if 'straight-arm' in eid or 'cable-incline-pushdown' in eid:
        return 'straight_arm'
    
    # Pulldowns
    if 'pulldown' in eid and 'straight' not in eid:
        return 'pulldown'
    
    # Pull-ups / chin-ups / muscle-ups
    if any(k in eid for k in ['pull-up','pullup','chin-up','chin-ups','chins','muscle-up','rope-climb']):
        return 'pullup'
    
    # Inverted rows / suspended rows / bodyweight mid row
    if any(k in eid for k in ['inverted-row','suspended-row','bodyweight-mid-row','london-bridges','sled-row']):
        return 'inverted_row'
    
    # Chest-supported / seal / incline bench rows
    if any(k in eid for k in ['chest-supported','seal-row','helms-row','incline-bench-pull','lying-cambered','dumbbell-incline-row','lying-t-bar','straight-bar-bench-mid']):
        return 'chest_supported_row'
    
    # Machine rows
    if equip == 'machine' and 'row' in name:
        return 'machine_row'
    if 'smith-machine' in eid and 'row' in eid:
        return 'machine_row'
    
    # Cable rows
    if equip == 'cable' and ('row' in name or 'pulley-row' in eid or 'shotgun' in eid or 'kayak' in eid):
        return 'cable_row'
    
    # Band rows
    if 'band' in eid and 'row' in eid and 'pull-up' not in eid:
        return 'band_row'
    
    # T-bar rows (standing, not lying/chest-supported)
    if 't-bar-row' in eid and 'lying' not in eid and 'chest' not in eid:
        return 'tbar_row'
    
    # Renegade rows
    if 'renegade' in eid:
        return 'renegade_row'
    
    # Barbell rows
    if equip == 'barbell' and 'row' in name:
        return 'barbell_row'
    
    # Dumbbell rows (including kettlebell rows)
    if (equip in ('dumbbell','kettlebell')) and 'row' in name:
        return 'dumbbell_row'
    
    # Hangs
    if 'hang' in eid:
        return 'other'
    
    # Rowing machine / overhead slam / catch-and-throw / pyramid
    if any(k in eid for k in ['rowing-stationary','overhead-slam','catch-and-overhead','pyramid']):
        return 'other'
    
    # Kneeling high pulley (pulldown variant)
    if 'kneeling' in eid and 'pulley' in eid:
        return 'pulldown'
    
    # Rocky pull-ups
    if 'rocky' in eid:
        return 'pullup'
    
    return 'other'

# --- BEARDSLEY DATA BY TYPE ---
from populate_lats_data import get_exercise_data

def main():
    with open(JSON_PATH) as f:
        data = json.load(f)
    
    counts = {}
    updated = 0
    for ex in data:
        if ex.get('muscle_group') != 'lats':
            continue
        typ = classify(ex)
        counts[typ] = counts.get(typ, 0) + 1
        bio = get_exercise_data(ex, typ)
        ex.update(bio)
        # CRITICAL: no lat exercise gets high stretch
        assert ex.get('stretch_hypertrophy_potential') != 'high', f"VIOLATION: {ex['id']}"
        updated += 1
    
    with open(JSON_PATH, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Updated {updated} lat exercises")
    print("\nBy type:")
    for t, c in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")
    
    # Verify no high stretch
    with open(JSON_PATH) as f:
        verify = json.load(f)
    highs = [e['id'] for e in verify if e.get('muscle_group')=='lats' and e.get('stretch_hypertrophy_potential')=='high']
    if highs:
        print(f"\n❌ VIOLATION: {highs}")
    else:
        print("\n✅ No lat exercise has stretch_hypertrophy_potential='high'")

if __name__ == '__main__':
    main()
