"""Static exercise database for HypertrophyOS.

~150+ exercises organized by muscle group with search helpers.
"""

from __future__ import annotations
from typing import Optional

_IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"

EXERCISES: list[dict] = [
    # ─── Chest (17) ───────────────────────────────────────────────────────────
    {"id": "barbell-bench-press", "name": "Barbell Bench Press", "muscle_group": "chest", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Barbell_Bench_Press/0.jpg"},
    {"id": "dumbbell-bench-press", "name": "Dumbbell Bench Press", "muscle_group": "chest", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Dumbbell_Bench_Press/0.jpg"},
    {"id": "incline-barbell-bench-press", "name": "Incline Barbell Bench Press", "muscle_group": "chest", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Incline_Barbell_Bench_Press/0.jpg"},
    {"id": "incline-dumbbell-bench-press", "name": "Incline Dumbbell Bench Press", "muscle_group": "chest", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Incline_Dumbbell_Bench_Press/0.jpg"},
    {"id": "decline-barbell-bench-press", "name": "Decline Barbell Bench Press", "muscle_group": "chest", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Decline_Barbell_Bench_Press/0.jpg"},
    {"id": "decline-dumbbell-bench-press", "name": "Decline Dumbbell Bench Press", "muscle_group": "chest", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Decline_Dumbbell_Bench_Press/0.jpg"},
    {"id": "dumbbell-flyes", "name": "Dumbbell Flyes", "muscle_group": "chest", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Dumbbell_Flyes/0.jpg"},
    {"id": "incline-dumbbell-flyes", "name": "Incline Dumbbell Flyes", "muscle_group": "chest", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Incline_Dumbbell_Flyes/0.jpg"},
    {"id": "cable-crossover", "name": "Cable Crossover", "muscle_group": "chest", "equipment": "cable", "category": "isolation", "image_url": f"{_IMG}/Cable_Crossover/0.jpg"},
    {"id": "low-cable-crossover", "name": "Low Cable Crossover", "muscle_group": "chest", "equipment": "cable", "category": "isolation", "image_url": f"{_IMG}/Low_Cable_Crossover/0.jpg"},
    {"id": "chest-dips", "name": "Chest Dips", "muscle_group": "chest", "equipment": "bodyweight", "category": "compound", "image_url": f"{_IMG}/Chest_Dip/0.jpg"},
    {"id": "push-ups", "name": "Push-Ups", "muscle_group": "chest", "equipment": "bodyweight", "category": "compound", "image_url": f"{_IMG}/Pushups/0.jpg"},
    {"id": "incline-push-ups", "name": "Incline Push-Ups", "muscle_group": "chest", "equipment": "bodyweight", "category": "compound", "image_url": f"{_IMG}/Incline_Pushups/0.jpg"},
    {"id": "machine-chest-press", "name": "Machine Chest Press", "muscle_group": "chest", "equipment": "machine", "category": "compound", "image_url": f"{_IMG}/Machine_Chest_Press/0.jpg"},
    {"id": "smith-machine-bench-press", "name": "Smith Machine Bench Press", "muscle_group": "chest", "equipment": "smith_machine", "category": "compound", "image_url": f"{_IMG}/Smith_Machine_Bench_Press/0.jpg"},
    {"id": "pec-deck-fly", "name": "Pec Deck Fly", "muscle_group": "chest", "equipment": "machine", "category": "isolation", "image_url": f"{_IMG}/Pec_Deck_Fly/0.jpg"},
    {"id": "svend-press", "name": "Svend Press", "muscle_group": "chest", "equipment": "dumbbell", "category": "isolation", "image_url": None},

    # ─── Back (17) ────────────────────────────────────────────────────────────
    {"id": "barbell-row", "name": "Barbell Row", "muscle_group": "back", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Barbell_Row/0.jpg"},
    {"id": "dumbbell-row", "name": "Dumbbell Row", "muscle_group": "back", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Dumbbell_Row/0.jpg"},
    {"id": "pendlay-row", "name": "Pendlay Row", "muscle_group": "back", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Pendlay_Row/0.jpg"},
    {"id": "t-bar-row", "name": "T-Bar Row", "muscle_group": "back", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/T-Bar_Row/0.jpg"},
    {"id": "pull-ups", "name": "Pull-Ups", "muscle_group": "back", "equipment": "bodyweight", "category": "compound", "image_url": f"{_IMG}/Pullups/0.jpg"},
    {"id": "chin-ups", "name": "Chin-Ups", "muscle_group": "back", "equipment": "bodyweight", "category": "compound", "image_url": f"{_IMG}/Chin-Up/0.jpg"},
    {"id": "lat-pulldown", "name": "Lat Pulldown", "muscle_group": "back", "equipment": "cable", "category": "compound", "image_url": f"{_IMG}/Wide-Grip_Lat_Pulldown/0.jpg"},
    {"id": "close-grip-lat-pulldown", "name": "Close-Grip Lat Pulldown", "muscle_group": "back", "equipment": "cable", "category": "compound", "image_url": f"{_IMG}/Close-Grip_Lat_Pulldown/0.jpg"},
    {"id": "seated-cable-row", "name": "Seated Cable Row", "muscle_group": "back", "equipment": "cable", "category": "compound", "image_url": f"{_IMG}/Seated_Cable_Row/0.jpg"},
    {"id": "single-arm-cable-row", "name": "Single-Arm Cable Row", "muscle_group": "back", "equipment": "cable", "category": "compound", "image_url": None},
    {"id": "face-pull", "name": "Face Pull", "muscle_group": "back", "equipment": "cable", "category": "isolation", "image_url": f"{_IMG}/Face_Pull/0.jpg"},
    {"id": "conventional-deadlift", "name": "Conventional Deadlift", "muscle_group": "back", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Barbell_Deadlift/0.jpg"},
    {"id": "sumo-deadlift", "name": "Sumo Deadlift", "muscle_group": "back", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Sumo_Deadlift/0.jpg"},
    {"id": "rack-pull", "name": "Rack Pull", "muscle_group": "back", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Rack_Pull/0.jpg"},
    {"id": "machine-row", "name": "Machine Row", "muscle_group": "back", "equipment": "machine", "category": "compound", "image_url": None},
    {"id": "straight-arm-pulldown", "name": "Straight-Arm Pulldown", "muscle_group": "back", "equipment": "cable", "category": "isolation", "image_url": f"{_IMG}/Straight-Arm_Pulldown/0.jpg"},
    {"id": "inverted-row", "name": "Inverted Row", "muscle_group": "back", "equipment": "bodyweight", "category": "compound", "image_url": f"{_IMG}/Inverted_Row/0.jpg"},

    # ─── Shoulders (14) ───────────────────────────────────────────────────────
    {"id": "overhead-press", "name": "Overhead Press", "muscle_group": "shoulders", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Standing_Military_Press/0.jpg"},
    {"id": "dumbbell-shoulder-press", "name": "Dumbbell Shoulder Press", "muscle_group": "shoulders", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Dumbbell_Shoulder_Press/0.jpg"},
    {"id": "arnold-press", "name": "Arnold Press", "muscle_group": "shoulders", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Arnold_Press/0.jpg"},
    {"id": "smith-machine-overhead-press", "name": "Smith Machine Overhead Press", "muscle_group": "shoulders", "equipment": "smith_machine", "category": "compound", "image_url": None},
    {"id": "machine-shoulder-press", "name": "Machine Shoulder Press", "muscle_group": "shoulders", "equipment": "machine", "category": "compound", "image_url": f"{_IMG}/Machine_Shoulder_Press/0.jpg"},
    {"id": "dumbbell-lateral-raise", "name": "Dumbbell Lateral Raise", "muscle_group": "shoulders", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Dumbbell_Lateral_Raise/0.jpg"},
    {"id": "cable-lateral-raise", "name": "Cable Lateral Raise", "muscle_group": "shoulders", "equipment": "cable", "category": "isolation", "image_url": f"{_IMG}/Cable_Lateral_Raise/0.jpg"},
    {"id": "dumbbell-front-raise", "name": "Dumbbell Front Raise", "muscle_group": "shoulders", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Dumbbell_Front_Raise/0.jpg"},
    {"id": "cable-front-raise", "name": "Cable Front Raise", "muscle_group": "shoulders", "equipment": "cable", "category": "isolation", "image_url": None},
    {"id": "reverse-pec-deck-fly", "name": "Reverse Pec Deck Fly", "muscle_group": "shoulders", "equipment": "machine", "category": "isolation", "image_url": None},
    {"id": "dumbbell-reverse-fly", "name": "Dumbbell Reverse Fly", "muscle_group": "shoulders", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Dumbbell_Reverse_Fly/0.jpg"},
    {"id": "cable-reverse-fly", "name": "Cable Reverse Fly", "muscle_group": "shoulders", "equipment": "cable", "category": "isolation", "image_url": None},
    {"id": "landmine-press", "name": "Landmine Press", "muscle_group": "shoulders", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Landmine_Press/0.jpg"},
    {"id": "push-press", "name": "Push Press", "muscle_group": "shoulders", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Push_Press/0.jpg"},

    # ─── Biceps (12) ──────────────────────────────────────────────────────────
    {"id": "barbell-curl", "name": "Barbell Curl", "muscle_group": "biceps", "equipment": "barbell", "category": "isolation", "image_url": f"{_IMG}/Barbell_Curl/0.jpg"},
    {"id": "dumbbell-curl", "name": "Dumbbell Curl", "muscle_group": "biceps", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Dumbbell_Bicep_Curl/0.jpg"},
    {"id": "hammer-curl", "name": "Hammer Curl", "muscle_group": "biceps", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Hammer_Curls/0.jpg"},
    {"id": "incline-dumbbell-curl", "name": "Incline Dumbbell Curl", "muscle_group": "biceps", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Incline_Dumbbell_Curl/0.jpg"},
    {"id": "preacher-curl", "name": "Preacher Curl", "muscle_group": "biceps", "equipment": "barbell", "category": "isolation", "image_url": f"{_IMG}/Preacher_Curl/0.jpg"},
    {"id": "cable-curl", "name": "Cable Curl", "muscle_group": "biceps", "equipment": "cable", "category": "isolation", "image_url": f"{_IMG}/Cable_Curl/0.jpg"},
    {"id": "concentration-curl", "name": "Concentration Curl", "muscle_group": "biceps", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Concentration_Curl/0.jpg"},
    {"id": "ez-bar-curl", "name": "EZ-Bar Curl", "muscle_group": "biceps", "equipment": "barbell", "category": "isolation", "image_url": f"{_IMG}/EZ-Bar_Curl/0.jpg"},
    {"id": "spider-curl", "name": "Spider Curl", "muscle_group": "biceps", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Spider_Curl/0.jpg"},
    {"id": "cable-hammer-curl", "name": "Cable Hammer Curl", "muscle_group": "biceps", "equipment": "cable", "category": "isolation", "image_url": None},
    {"id": "machine-curl", "name": "Machine Curl", "muscle_group": "biceps", "equipment": "machine", "category": "isolation", "image_url": f"{_IMG}/Machine_Bicep_Curl/0.jpg"},
    {"id": "band-curl", "name": "Band Curl", "muscle_group": "biceps", "equipment": "band", "category": "isolation", "image_url": None},

    # ─── Triceps (12) ─────────────────────────────────────────────────────────
    {"id": "cable-pushdown", "name": "Cable Pushdown", "muscle_group": "triceps", "equipment": "cable", "category": "isolation", "image_url": f"{_IMG}/Triceps_Pushdown/0.jpg"},
    {"id": "rope-pushdown", "name": "Rope Pushdown", "muscle_group": "triceps", "equipment": "cable", "category": "isolation", "image_url": f"{_IMG}/Rope_Pushdown/0.jpg"},
    {"id": "skull-crusher", "name": "Skull Crusher", "muscle_group": "triceps", "equipment": "barbell", "category": "isolation", "image_url": f"{_IMG}/Skull_Crusher/0.jpg"},
    {"id": "dumbbell-skull-crusher", "name": "Dumbbell Skull Crusher", "muscle_group": "triceps", "equipment": "dumbbell", "category": "isolation", "image_url": None},
    {"id": "tricep-dips", "name": "Tricep Dips", "muscle_group": "triceps", "equipment": "bodyweight", "category": "compound", "image_url": f"{_IMG}/Tricep_Dips/0.jpg"},
    {"id": "overhead-tricep-extension", "name": "Overhead Tricep Extension", "muscle_group": "triceps", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Overhead_Tricep_Extension/0.jpg"},
    {"id": "cable-overhead-extension", "name": "Cable Overhead Extension", "muscle_group": "triceps", "equipment": "cable", "category": "isolation", "image_url": None},
    {"id": "dumbbell-kickback", "name": "Dumbbell Kickback", "muscle_group": "triceps", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Dumbbell_Kickback/0.jpg"},
    {"id": "close-grip-bench-press", "name": "Close-Grip Bench Press", "muscle_group": "triceps", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Close-Grip_Bench_Press/0.jpg"},
    {"id": "diamond-push-ups", "name": "Diamond Push-Ups", "muscle_group": "triceps", "equipment": "bodyweight", "category": "compound", "image_url": f"{_IMG}/Diamond_Pushups/0.jpg"},
    {"id": "machine-tricep-extension", "name": "Machine Tricep Extension", "muscle_group": "triceps", "equipment": "machine", "category": "isolation", "image_url": None},
    {"id": "bench-dips", "name": "Bench Dips", "muscle_group": "triceps", "equipment": "bodyweight", "category": "compound", "image_url": f"{_IMG}/Bench_Dips/0.jpg"},

    # ─── Quads (12) ───────────────────────────────────────────────────────────
    {"id": "barbell-back-squat", "name": "Barbell Back Squat", "muscle_group": "quads", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Barbell_Squat/0.jpg"},
    {"id": "barbell-front-squat", "name": "Barbell Front Squat", "muscle_group": "quads", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Front_Barbell_Squat/0.jpg"},
    {"id": "goblet-squat", "name": "Goblet Squat", "muscle_group": "quads", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Goblet_Squat/0.jpg"},
    {"id": "leg-press", "name": "Leg Press", "muscle_group": "quads", "equipment": "machine", "category": "compound", "image_url": f"{_IMG}/Leg_Press/0.jpg"},
    {"id": "hack-squat", "name": "Hack Squat", "muscle_group": "quads", "equipment": "machine", "category": "compound", "image_url": f"{_IMG}/Hack_Squat/0.jpg"},
    {"id": "smith-machine-squat", "name": "Smith Machine Squat", "muscle_group": "quads", "equipment": "smith_machine", "category": "compound", "image_url": f"{_IMG}/Smith_Machine_Squat/0.jpg"},
    {"id": "walking-lunge", "name": "Walking Lunge", "muscle_group": "quads", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Walking_Lunge/0.jpg"},
    {"id": "barbell-lunge", "name": "Barbell Lunge", "muscle_group": "quads", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Barbell_Lunge/0.jpg"},
    {"id": "leg-extension", "name": "Leg Extension", "muscle_group": "quads", "equipment": "machine", "category": "isolation", "image_url": f"{_IMG}/Leg_Extensions/0.jpg"},
    {"id": "sissy-squat", "name": "Sissy Squat", "muscle_group": "quads", "equipment": "bodyweight", "category": "isolation", "image_url": None},
    {"id": "step-up", "name": "Step-Up", "muscle_group": "quads", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Step-Up/0.jpg"},
    {"id": "wall-sit", "name": "Wall Sit", "muscle_group": "quads", "equipment": "bodyweight", "category": "isolation", "image_url": None},

    # ─── Hamstrings (10) ──────────────────────────────────────────────────────
    {"id": "romanian-deadlift", "name": "Romanian Deadlift", "muscle_group": "hamstrings", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Romanian_Deadlift/0.jpg"},
    {"id": "dumbbell-romanian-deadlift", "name": "Dumbbell Romanian Deadlift", "muscle_group": "hamstrings", "equipment": "dumbbell", "category": "compound", "image_url": None},
    {"id": "lying-leg-curl", "name": "Lying Leg Curl", "muscle_group": "hamstrings", "equipment": "machine", "category": "isolation", "image_url": f"{_IMG}/Lying_Leg_Curls/0.jpg"},
    {"id": "seated-leg-curl", "name": "Seated Leg Curl", "muscle_group": "hamstrings", "equipment": "machine", "category": "isolation", "image_url": f"{_IMG}/Seated_Leg_Curl/0.jpg"},
    {"id": "good-morning", "name": "Good Morning", "muscle_group": "hamstrings", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Good_Morning/0.jpg"},
    {"id": "nordic-curl", "name": "Nordic Curl", "muscle_group": "hamstrings", "equipment": "bodyweight", "category": "isolation", "image_url": None},
    {"id": "stiff-leg-deadlift", "name": "Stiff-Leg Deadlift", "muscle_group": "hamstrings", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Stiff-Leg_Deadlift/0.jpg"},
    {"id": "single-leg-deadlift", "name": "Single-Leg Deadlift", "muscle_group": "hamstrings", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Single_Leg_Deadlift/0.jpg"},
    {"id": "cable-pull-through", "name": "Cable Pull-Through", "muscle_group": "hamstrings", "equipment": "cable", "category": "compound", "image_url": f"{_IMG}/Cable_Pull_Through/0.jpg"},
    {"id": "kettlebell-swing", "name": "Kettlebell Swing", "muscle_group": "hamstrings", "equipment": "kettlebell", "category": "compound", "image_url": f"{_IMG}/Kettlebell_Swing/0.jpg"},

    # ─── Glutes (10) ──────────────────────────────────────────────────────────
    {"id": "barbell-hip-thrust", "name": "Barbell Hip Thrust", "muscle_group": "glutes", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Barbell_Hip_Thrust/0.jpg"},
    {"id": "dumbbell-hip-thrust", "name": "Dumbbell Hip Thrust", "muscle_group": "glutes", "equipment": "dumbbell", "category": "compound", "image_url": None},
    {"id": "glute-bridge", "name": "Glute Bridge", "muscle_group": "glutes", "equipment": "bodyweight", "category": "isolation", "image_url": f"{_IMG}/Glute_Bridge/0.jpg"},
    {"id": "single-leg-glute-bridge", "name": "Single-Leg Glute Bridge", "muscle_group": "glutes", "equipment": "bodyweight", "category": "isolation", "image_url": None},
    {"id": "cable-kickback", "name": "Cable Kickback", "muscle_group": "glutes", "equipment": "cable", "category": "isolation", "image_url": None},
    {"id": "bulgarian-split-squat", "name": "Bulgarian Split Squat", "muscle_group": "glutes", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Bulgarian_Split_Squat/0.jpg"},
    {"id": "sumo-squat", "name": "Sumo Squat", "muscle_group": "glutes", "equipment": "dumbbell", "category": "compound", "image_url": None},
    {"id": "band-hip-abduction", "name": "Band Hip Abduction", "muscle_group": "glutes", "equipment": "band", "category": "isolation", "image_url": None},
    {"id": "machine-hip-abduction", "name": "Machine Hip Abduction", "muscle_group": "glutes", "equipment": "machine", "category": "isolation", "image_url": f"{_IMG}/Hip_Abduction_Machine/0.jpg"},
    {"id": "reverse-lunge", "name": "Reverse Lunge", "muscle_group": "glutes", "equipment": "dumbbell", "category": "compound", "image_url": None},

    # ─── Calves (6) ───────────────────────────────────────────────────────────
    {"id": "standing-calf-raise", "name": "Standing Calf Raise", "muscle_group": "calves", "equipment": "machine", "category": "isolation", "image_url": f"{_IMG}/Standing_Calf_Raises/0.jpg"},
    {"id": "seated-calf-raise", "name": "Seated Calf Raise", "muscle_group": "calves", "equipment": "machine", "category": "isolation", "image_url": f"{_IMG}/Seated_Calf_Raise/0.jpg"},
    {"id": "donkey-calf-raise", "name": "Donkey Calf Raise", "muscle_group": "calves", "equipment": "machine", "category": "isolation", "image_url": f"{_IMG}/Donkey_Calf_Raises/0.jpg"},
    {"id": "smith-machine-calf-raise", "name": "Smith Machine Calf Raise", "muscle_group": "calves", "equipment": "smith_machine", "category": "isolation", "image_url": f"{_IMG}/Smith_Machine_Calf_Raise/0.jpg"},
    {"id": "leg-press-calf-raise", "name": "Leg Press Calf Raise", "muscle_group": "calves", "equipment": "machine", "category": "isolation", "image_url": f"{_IMG}/Leg_Press_Calf_Raise/0.jpg"},
    {"id": "single-leg-calf-raise", "name": "Single-Leg Calf Raise", "muscle_group": "calves", "equipment": "bodyweight", "category": "isolation", "image_url": None},

    # ─── Abs (10) ─────────────────────────────────────────────────────────────
    {"id": "crunch", "name": "Crunch", "muscle_group": "abs", "equipment": "bodyweight", "category": "isolation", "image_url": f"{_IMG}/Crunches/0.jpg"},
    {"id": "cable-crunch", "name": "Cable Crunch", "muscle_group": "abs", "equipment": "cable", "category": "isolation", "image_url": f"{_IMG}/Cable_Crunch/0.jpg"},
    {"id": "plank", "name": "Plank", "muscle_group": "abs", "equipment": "bodyweight", "category": "isolation", "image_url": f"{_IMG}/Plank/0.jpg"},
    {"id": "side-plank", "name": "Side Plank", "muscle_group": "abs", "equipment": "bodyweight", "category": "isolation", "image_url": f"{_IMG}/Side_Plank/0.jpg"},
    {"id": "hanging-leg-raise", "name": "Hanging Leg Raise", "muscle_group": "abs", "equipment": "bodyweight", "category": "isolation", "image_url": f"{_IMG}/Hanging_Leg_Raise/0.jpg"},
    {"id": "lying-leg-raise", "name": "Lying Leg Raise", "muscle_group": "abs", "equipment": "bodyweight", "category": "isolation", "image_url": f"{_IMG}/Lying_Leg_Raise/0.jpg"},
    {"id": "ab-wheel-rollout", "name": "Ab Wheel Rollout", "muscle_group": "abs", "equipment": "bodyweight", "category": "isolation", "image_url": f"{_IMG}/Ab_Wheel_Rollout/0.jpg"},
    {"id": "russian-twist", "name": "Russian Twist", "muscle_group": "abs", "equipment": "bodyweight", "category": "isolation", "image_url": f"{_IMG}/Russian_Twist/0.jpg"},
    {"id": "bicycle-crunch", "name": "Bicycle Crunch", "muscle_group": "abs", "equipment": "bodyweight", "category": "isolation", "image_url": f"{_IMG}/Bicycle_Crunch/0.jpg"},
    {"id": "decline-sit-up", "name": "Decline Sit-Up", "muscle_group": "abs", "equipment": "bodyweight", "category": "isolation", "image_url": f"{_IMG}/Decline_Sit-Up/0.jpg"},

    # ─── Traps (6) ────────────────────────────────────────────────────────────
    {"id": "barbell-shrug", "name": "Barbell Shrug", "muscle_group": "traps", "equipment": "barbell", "category": "isolation", "image_url": f"{_IMG}/Barbell_Shrug/0.jpg"},
    {"id": "dumbbell-shrug", "name": "Dumbbell Shrug", "muscle_group": "traps", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Dumbbell_Shrug/0.jpg"},
    {"id": "upright-row", "name": "Upright Row", "muscle_group": "traps", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Upright_Row/0.jpg"},
    {"id": "cable-shrug", "name": "Cable Shrug", "muscle_group": "traps", "equipment": "cable", "category": "isolation", "image_url": None},
    {"id": "farmer-walk", "name": "Farmer's Walk", "muscle_group": "traps", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Farmers_Walk/0.jpg"},
    {"id": "trap-bar-shrug", "name": "Trap Bar Shrug", "muscle_group": "traps", "equipment": "barbell", "category": "isolation", "image_url": None},

    # ─── Forearms (5) ─────────────────────────────────────────────────────────
    {"id": "barbell-wrist-curl", "name": "Barbell Wrist Curl", "muscle_group": "forearms", "equipment": "barbell", "category": "isolation", "image_url": f"{_IMG}/Barbell_Wrist_Curl/0.jpg"},
    {"id": "reverse-barbell-curl", "name": "Reverse Barbell Curl", "muscle_group": "forearms", "equipment": "barbell", "category": "isolation", "image_url": f"{_IMG}/Reverse_Barbell_Curl/0.jpg"},
    {"id": "dumbbell-wrist-curl", "name": "Dumbbell Wrist Curl", "muscle_group": "forearms", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Dumbbell_Wrist_Curl/0.jpg"},
    {"id": "reverse-wrist-curl", "name": "Reverse Wrist Curl", "muscle_group": "forearms", "equipment": "dumbbell", "category": "isolation", "image_url": None},
    {"id": "farmer-walk-forearms", "name": "Farmer's Walk (Forearms)", "muscle_group": "forearms", "equipment": "dumbbell", "category": "compound", "image_url": f"{_IMG}/Farmers_Walk/0.jpg"},

    # ─── Full Body (6) ────────────────────────────────────────────────────────
    {"id": "clean-and-press", "name": "Clean and Press", "muscle_group": "full_body", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Clean_and_Press/0.jpg"},
    {"id": "thruster", "name": "Thruster", "muscle_group": "full_body", "equipment": "barbell", "category": "compound", "image_url": None},
    {"id": "dumbbell-thruster", "name": "Dumbbell Thruster", "muscle_group": "full_body", "equipment": "dumbbell", "category": "compound", "image_url": None},
    {"id": "burpee", "name": "Burpee", "muscle_group": "full_body", "equipment": "bodyweight", "category": "compound", "image_url": f"{_IMG}/Burpee/0.jpg"},
    {"id": "turkish-get-up", "name": "Turkish Get-Up", "muscle_group": "full_body", "equipment": "kettlebell", "category": "compound", "image_url": None},
    {"id": "man-maker", "name": "Man Maker", "muscle_group": "full_body", "equipment": "dumbbell", "category": "compound", "image_url": None},
    {"id": "kettlebell-clean-and-press", "name": "Kettlebell Clean and Press", "muscle_group": "full_body", "equipment": "kettlebell", "category": "compound", "image_url": None},
    {"id": "battle-rope-slam", "name": "Battle Rope Slam", "muscle_group": "full_body", "equipment": "bodyweight", "category": "compound", "image_url": None},

    # ─── Additional Chest ─────────────────────────────────────────────────────
    {"id": "floor-press", "name": "Floor Press", "muscle_group": "chest", "equipment": "barbell", "category": "compound", "image_url": f"{_IMG}/Floor_Press/0.jpg"},
    {"id": "dumbbell-pullover", "name": "Dumbbell Pullover", "muscle_group": "chest", "equipment": "dumbbell", "category": "isolation", "image_url": f"{_IMG}/Dumbbell_Pullover/0.jpg"},

    # ─── Additional Back ──────────────────────────────────────────────────────
    {"id": "meadows-row", "name": "Meadows Row", "muscle_group": "back", "equipment": "barbell", "category": "compound", "image_url": None},
    {"id": "chest-supported-row", "name": "Chest-Supported Row", "muscle_group": "back", "equipment": "dumbbell", "category": "compound", "image_url": None},
    {"id": "wide-grip-lat-pulldown", "name": "Wide-Grip Lat Pulldown", "muscle_group": "back", "equipment": "cable", "category": "compound", "image_url": f"{_IMG}/Wide-Grip_Lat_Pulldown/0.jpg"},

    # ─── Additional Shoulders ─────────────────────────────────────────────────
    {"id": "behind-the-neck-press", "name": "Behind-the-Neck Press", "muscle_group": "shoulders", "equipment": "barbell", "category": "compound", "image_url": None},
    {"id": "band-pull-apart", "name": "Band Pull-Apart", "muscle_group": "shoulders", "equipment": "band", "category": "isolation", "image_url": None},

    # ─── Additional Quads ─────────────────────────────────────────────────────
    {"id": "belt-squat", "name": "Belt Squat", "muscle_group": "quads", "equipment": "machine", "category": "compound", "image_url": None},
    {"id": "pendulum-squat", "name": "Pendulum Squat", "muscle_group": "quads", "equipment": "machine", "category": "compound", "image_url": None},

    # ─── Additional Abs ───────────────────────────────────────────────────────
    {"id": "pallof-press", "name": "Pallof Press", "muscle_group": "abs", "equipment": "cable", "category": "isolation", "image_url": None},
    {"id": "dragon-flag", "name": "Dragon Flag", "muscle_group": "abs", "equipment": "bodyweight", "category": "isolation", "image_url": None},
    {"id": "woodchopper", "name": "Woodchopper", "muscle_group": "abs", "equipment": "cable", "category": "isolation", "image_url": None},
]

# Pre-compute lookup structures
_MUSCLE_GROUPS: list[str] = sorted({ex["muscle_group"] for ex in EXERCISES})


def get_all_exercises() -> list[dict]:
    """Return every exercise in the database."""
    return EXERCISES


def search_exercises(query: str, muscle_group: Optional[str] = None) -> list[dict]:
    """Case-insensitive name search with optional muscle group filter."""
    q = query.lower()
    results = [ex for ex in EXERCISES if q in ex["name"].lower()]
    if muscle_group:
        mg = muscle_group.lower()
        results = [ex for ex in results if ex["muscle_group"] == mg]
    return results


def get_muscle_groups() -> list[str]:
    """Return sorted list of all muscle group names."""
    return _MUSCLE_GROUPS
