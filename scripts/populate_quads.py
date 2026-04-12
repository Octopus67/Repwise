#!/usr/bin/env python3
"""Populate biomechanics data for all quad exercises in exercises_data.json."""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))

from quad_classifier import classify
from quad_attrs import ATTRS, OVERRIDES
from quad_descriptions import DESCRIPTIONS
from quad_tips import TIPS, CUES

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "modules", "training", "exercises_data.json")

def main():
    with open(DATA_PATH) as f:
        data = json.load(f)

    # Track description rotation per type
    desc_idx = {}
    tips_idx = {}
    cues_idx = {}
    type_counts = {}

    updated = 0
    for ex in data:
        if ex.get("muscle_group") != "quads":
            continue

        eid = ex["id"]
        name = ex["name"]
        is_mob = ex.get("is_mobility", False)
        equip = ex.get("equipment", "")

        etype = classify(eid, name, is_mob, equip)
        type_counts[etype] = type_counts.get(etype, 0) + 1

        # Get base attributes
        sc, lp, shp, stf, fr = ATTRS.get(etype, ATTRS["other"])

        # Apply overrides
        ovr = OVERRIDES.get(eid, {})
        sc = ovr.get("strength_curve", sc)
        lp = ovr.get("loading_position", lp)
        shp = ovr.get("stretch_hypertrophy_potential", shp)
        stf = ovr.get("stimulus_to_fatigue", stf)
        fr = ovr.get("fatigue_rating", fr)

        # Rotate descriptions
        descs = DESCRIPTIONS.get(etype, DESCRIPTIONS["other"])
        di = desc_idx.get(etype, 0)
        ex["description"] = descs[di % len(descs)]
        desc_idx[etype] = di + 1

        # Rotate tips
        tips_pool = TIPS.get(etype, TIPS["other"])
        ti = tips_idx.get(etype, 0)
        ex["tips"] = tips_pool[ti % len(tips_pool)]
        tips_idx[etype] = ti + 1

        # Rotate cues
        cues_pool = CUES.get(etype, CUES["other"])
        ci = cues_idx.get(etype, 0)
        ex["coaching_cues"] = cues_pool[ci % len(cues_pool)]
        cues_idx[etype] = ci + 1

        # Set attributes
        ex["strength_curve"] = sc
        ex["loading_position"] = lp
        ex["stretch_hypertrophy_potential"] = shp
        ex["stimulus_to_fatigue"] = stf
        ex["fatigue_rating"] = fr

        updated += 1

    with open(DATA_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Updated {updated} quad exercises")
    print(f"\nType breakdown:")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        attrs = ATTRS.get(t, ATTRS["other"])
        print(f"  {t:20s}: {c:3d} exercises  (curve={attrs[0]}, load={attrs[1]}, stretch={attrs[2]}, sfr={attrs[3]}, fatigue={attrs[4]})")

    # Verify all fields populated
    missing = []
    fields = ["description", "tips", "coaching_cues", "strength_curve", "loading_position",
              "stretch_hypertrophy_potential", "stimulus_to_fatigue", "fatigue_rating"]
    for ex in data:
        if ex.get("muscle_group") != "quads":
            continue
        for f in fields:
            if not ex.get(f):
                missing.append(f"{ex['id']}.{f}")
    if missing:
        print(f"\n⚠️  Missing fields: {missing}")
    else:
        print(f"\n✅ All {updated} exercises have all required fields populated")

if __name__ == "__main__":
    main()
