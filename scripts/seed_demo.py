#!/usr/bin/env python3
"""Seed dev.db with 120 days of realistic demo data for VibeCon recording.

Usage: cd /Users/manavmht/Documents/HOS && .venv/bin/python scripts/seed_demo.py
"""
import asyncio
import math
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, ".")

import bcrypt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite+aiosqlite:///./dev.db"

# --- Demo user config ---
EMAIL = "manavmehta2003@gmail.com"
PASSWORD = "Demo1234!"
NAME = "Manav"
USER_ID = uuid.UUID("00000000-0000-4000-a000-000000000001")  # deterministic — survives re-seeds
# SQLAlchemy stores UUIDs as hex (no dashes) in SQLite
USER_ID_STR = USER_ID.hex
TODAY = date.today()
START = TODAY - timedelta(days=120)

# --- Workout programs (PPL rotation) ---
PUSH_DAY = [
    {"exercise_name": "Bench Press", "muscle_group": "chest", "secondary_muscles": ["triceps", "shoulders"]},
    {"exercise_name": "Overhead Press", "muscle_group": "shoulders", "secondary_muscles": ["triceps"]},
    {"exercise_name": "Incline Dumbbell Press", "muscle_group": "chest", "secondary_muscles": ["shoulders"]},
    {"exercise_name": "Lateral Raise", "muscle_group": "shoulders", "secondary_muscles": []},
    {"exercise_name": "Tricep Pushdown", "muscle_group": "triceps", "secondary_muscles": []},
]
PULL_DAY = [
    {"exercise_name": "Barbell Row", "muscle_group": "back", "secondary_muscles": ["biceps"]},
    {"exercise_name": "Pull Up", "muscle_group": "back", "secondary_muscles": ["biceps"]},
    {"exercise_name": "Face Pull", "muscle_group": "rear_delts", "secondary_muscles": ["back"]},
    {"exercise_name": "Barbell Curl", "muscle_group": "biceps", "secondary_muscles": []},
    {"exercise_name": "Hammer Curl", "muscle_group": "biceps", "secondary_muscles": []},
]
LEG_DAY = [
    {"exercise_name": "Squat", "muscle_group": "quads", "secondary_muscles": ["glutes"]},
    {"exercise_name": "Romanian Deadlift", "muscle_group": "hamstrings", "secondary_muscles": ["glutes", "back"]},
    {"exercise_name": "Leg Press", "muscle_group": "quads", "secondary_muscles": ["glutes"]},
    {"exercise_name": "Leg Curl", "muscle_group": "hamstrings", "secondary_muscles": []},
    {"exercise_name": "Calf Raise", "muscle_group": "calves", "secondary_muscles": []},
]
PPL = [PUSH_DAY, PULL_DAY, LEG_DAY]

# --- Base weights (kg) — will progress over 120 days ---
BASE_WEIGHTS = {
    "Bench Press": 70, "Overhead Press": 45, "Incline Dumbbell Press": 26,
    "Lateral Raise": 10, "Tricep Pushdown": 25,
    "Barbell Row": 65, "Pull Up": 0, "Face Pull": 15,
    "Barbell Curl": 30, "Hammer Curl": 14,
    "Squat": 90, "Romanian Deadlift": 80, "Leg Press": 140,
    "Leg Curl": 35, "Calf Raise": 60,
}

# --- Meal templates ---
MEALS = {
    "Breakfast": [
        ("Oats with Whey Protein", 450, 35, 55, 8),
        ("Eggs and Toast", 420, 28, 40, 16),
        ("Greek Yogurt Parfait", 380, 30, 45, 8),
    ],
    "Lunch": [
        ("Chicken Rice Bowl", 650, 45, 70, 15),
        ("Paneer Tikka with Roti", 580, 32, 50, 22),
        ("Dal Rice with Salad", 520, 22, 75, 10),
        ("Grilled Chicken Wrap", 600, 42, 55, 18),
    ],
    "Dinner": [
        ("Salmon with Sweet Potato", 620, 40, 50, 22),
        ("Chicken Curry with Rice", 680, 38, 80, 18),
        ("Egg Fried Rice", 550, 25, 65, 18),
        ("Tofu Stir Fry with Noodles", 500, 28, 60, 14),
    ],
    "Snacks": [
        ("Protein Shake", 250, 30, 15, 5),
        ("Almonds and Banana", 280, 8, 30, 16),
        ("Protein Bar", 220, 20, 25, 8),
    ],
}


def _make_sets(exercise_name: str, day_offset: int) -> list[dict]:
    """Generate 3-4 sets with progressive overload and realistic RPE."""
    base = BASE_WEIGHTS.get(exercise_name, 20)
    # Progress ~10% over 120 days
    progress = base * (day_offset / 120) * 0.10
    weight = round(base + progress, 1)
    if exercise_name == "Pull Up":
        weight = 0  # bodyweight

    num_sets = random.choice([3, 3, 4])
    sets = []
    for i in range(num_sets):
        rpe = round(random.uniform(7.0, 9.5), 1)
        reps = random.randint(6, 12) if i < num_sets - 1 else random.randint(5, 10)
        # Last set slightly heavier or same
        w = weight + (2.5 if i == num_sets - 1 and random.random() > 0.6 else 0)
        sets.append({"reps": reps, "weight_kg": round(w, 1), "rpe": rpe})
    return sets


def _make_exercises(template: list[dict], day_offset: int) -> list[dict]:
    """Build exercises JSONB array for a training session."""
    exercises = []
    for ex in template:
        exercises.append({
            "exercise_name": ex["exercise_name"],
            "muscle_group": ex["muscle_group"],
            "secondary_muscles": ex["secondary_muscles"],
            "sets": _make_sets(ex["exercise_name"], day_offset),
        })
    return exercises


def _micro_nutrients() -> dict:
    """Random but realistic micronutrient values for a meal."""
    return {
        "vitamin_a_mcg": round(random.uniform(50, 300), 1),
        "vitamin_c_mg": round(random.uniform(5, 60), 1),
        "vitamin_d_mcg": round(random.uniform(1, 8), 1),
        "calcium_mg": round(random.uniform(50, 350), 1),
        "iron_mg": round(random.uniform(1, 8), 1),
        "potassium_mg": round(random.uniform(100, 600), 1),
        "fibre_g": round(random.uniform(2, 12), 1),
    }


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Check if user already exists
        result = await db.execute(text("SELECT id FROM users WHERE email = :e"), {"e": EMAIL})
        existing = result.scalar_one_or_none()
        if existing:
            print(f"User {EMAIL} already exists (id={existing}). Deleting old data...")
            uid = str(existing)
            for tbl in ["training_sessions", "nutrition_entries", "bodyweight_logs",
                        "user_profiles", "user_goals", "adaptive_snapshots", "user_metrics"]:
                try:
                    await db.execute(text(f"DELETE FROM {tbl} WHERE user_id = :u"), {"u": uid})
                except Exception:
                    pass
            await db.execute(text("DELETE FROM users WHERE id = :u"), {"u": uid})
            await db.commit()
            print("Old data cleared.")

        # --- Create user ---
        hashed = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
        user_id = USER_ID_STR
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(text(
            "INSERT INTO users (id, email, hashed_password, auth_provider, role, email_verified, created_at, updated_at) "
            "VALUES (:id, :email, :pw, 'email', 'user', 1, :now, :now)"
        ), {"id": user_id, "email": EMAIL, "pw": hashed, "now": now})

        # --- Profile ---
        await db.execute(text(
            "INSERT INTO user_profiles (id, user_id, display_name, coaching_mode, preferences, created_at, updated_at) "
            "VALUES (:id, :uid, :name, 'collaborative', :prefs, :now, :now)"
        ), {
            "id": str(uuid.uuid4()), "uid": user_id, "name": NAME, "now": now,
            "prefs": '{"unit_system": "metric", "theme": "dark"}',
        })

        # --- Goals ---
        await db.execute(text(
            "INSERT INTO user_goals (id, user_id, goal_type, target_weight_kg, goal_rate_per_week, created_at, updated_at) "
            "VALUES (:id, :uid, 'bulk', 78.0, 0.25, :now, :now)"
        ), {"id": str(uuid.uuid4()), "uid": user_id, "now": now})

        # --- User Metrics ---
        await db.execute(text(
            "INSERT INTO user_metrics (id, user_id, height_cm, weight_kg, body_fat_pct, "
            "activity_level, additional_metrics, created_at, updated_at) "
            "VALUES (:id, :uid, 178, 74.0, 16.0, 'moderate', :am, :now, :now)"
        ), {"id": str(uuid.uuid4()), "uid": user_id, "now": now,
            "am": '{"sex": "male", "birth_year": 2003}'})

        print(f"Created user: {EMAIL} / {PASSWORD}")

        # --- 120 days of data ---
        training_count = 0
        nutrition_count = 0
        bw_count = 0
        ppl_idx = 0

        for day_offset in range(121):
            d = START + timedelta(days=day_offset)
            d_str = d.isoformat()
            day_ts = datetime(d.year, d.month, d.day, tzinfo=timezone.utc).isoformat()

            # --- Training: 5-6 days/week (rest on ~every 3rd day, random) ---
            is_rest = (day_offset % 7 in [6]) or (day_offset % 7 == 3 and random.random() > 0.5)
            if not is_rest:
                template = PPL[ppl_idx % 3]
                ppl_idx += 1
                exercises = _make_exercises(template, day_offset)
                import json
                start_h = random.choice([6, 7, 17, 18])
                start_time = datetime(d.year, d.month, d.day, start_h, 0, tzinfo=timezone.utc)
                end_time = start_time + timedelta(minutes=random.randint(55, 80))

                await db.execute(text(
                    "INSERT INTO training_sessions (id, user_id, session_date, exercises, start_time, end_time, created_at, updated_at) "
                    "VALUES (:id, :uid, :d, :ex, :st, :et, :now, :now)"
                ), {
                    "id": str(uuid.uuid4()), "uid": user_id, "d": d_str,
                    "ex": json.dumps(exercises), "st": start_time.isoformat(),
                    "et": end_time.isoformat(), "now": now,
                })
                training_count += 1

            # --- Nutrition: 3 meals + snack every day ---
            for meal_name, options in MEALS.items():
                food_name, cals, protein, carbs, fat = random.choice(options)
                # Add ±10% variance
                v = random.uniform(0.9, 1.1)
                await db.execute(text(
                    "INSERT INTO nutrition_entries (id, user_id, meal_name, food_name, calories, "
                    "protein_g, carbs_g, fat_g, micro_nutrients, entry_date, created_at, updated_at) "
                    "VALUES (:id, :uid, :mn, :fn, :cal, :p, :c, :f, :mi, :d, :now, :now)"
                ), {
                    "id": str(uuid.uuid4()), "uid": user_id, "mn": meal_name,
                    "fn": food_name, "cal": round(cals * v), "p": round(protein * v, 1),
                    "c": round(carbs * v, 1), "f": round(fat * v, 1),
                    "mi": json.dumps(_micro_nutrients()), "d": d_str, "now": now,
                })
                nutrition_count += 1

            # --- Bodyweight: daily, slow bulk from 74 → ~77 kg ---
            trend = 74.0 + (day_offset / 120) * 3.0
            noise = random.gauss(0, 0.3)
            bw = round(trend + noise, 1)
            await db.execute(text(
                "INSERT INTO bodyweight_logs (id, user_id, weight_kg, recorded_date, created_at, updated_at) "
                "VALUES (:id, :uid, :w, :d, :now, :now)"
            ), {"id": str(uuid.uuid4()), "uid": user_id, "w": bw, "d": d_str, "now": now})
            bw_count += 1

        # --- Adaptive snapshots: one per week (17 weeks) ---
        snap_count = 0
        for week in range(17):
            week_date = START + timedelta(weeks=week)
            week_bw = 74.0 + (week * 7 / 120) * 3.0
            target_cals = round(2600 + week * 15)  # slowly increasing surplus
            await db.execute(text(
                "INSERT INTO adaptive_snapshots (id, user_id, target_calories, target_protein_g, "
                "target_carbs_g, target_fat_g, ema_current, adjustment_factor, version, "
                "input_parameters, created_at, updated_at) "
                "VALUES (:id, :uid, :cal, :p, :c, :f, :ema, :adj, 1, :params, :ts, :ts)"
            ), {
                "id": str(uuid.uuid4()), "uid": user_id,
                "cal": target_cals, "p": round(week_bw * 2.2),
                "c": round(target_cals * 0.45 / 4), "f": round(target_cals * 0.25 / 9),
                "ema": round(week_bw, 1), "adj": round(1.0 + week * 0.005, 3),
                "params": json.dumps({"goal": "bulk", "activity": "moderate", "week": week}),
                "ts": datetime(week_date.year, week_date.month, week_date.day, tzinfo=timezone.utc).isoformat(),
            })
            snap_count += 1

        # --- Achievements (unlocked over time) ---
        import json
        achievements = [
            ("pr_bench_1plate", 30, '{"weight_kg": 60, "exercise": "Bench Press"}'),
            ("streak_7", 10, '{"streak_days": 7}'),
            ("streak_30", 35, '{"streak_days": 30}'),
            ("streak_90", 95, '{"streak_days": 90}'),
            ("volume_10k", 14, '{"total_kg": 10000}'),
            ("volume_50k", 45, '{"total_kg": 50000}'),
            ("volume_100k", 90, '{"total_kg": 100000}'),
            ("nutrition_7", 12, '{"compliant_days": 7}'),
            ("nutrition_14", 20, '{"compliant_days": 14}'),
            ("nutrition_30", 40, '{"compliant_days": 30}'),
            ("pr_squat_2plate", 80, '{"weight_kg": 100, "exercise": "Squat"}'),
        ]
        ach_count = 0
        for ach_id, day_off, trigger in achievements:
            unlock_date = START + timedelta(days=day_off)
            unlock_ts = datetime(unlock_date.year, unlock_date.month, unlock_date.day, 18, 0, tzinfo=timezone.utc)
            await db.execute(text(
                "INSERT INTO user_achievements (id, user_id, achievement_id, unlocked_at, trigger_data, created_at, updated_at) "
                "VALUES (:id, :uid, :aid, :ts, :td, :ts, :ts)"
            ), {"id": str(uuid.uuid4()), "uid": user_id, "aid": ach_id, "ts": unlock_ts.isoformat(), "td": trigger})
            ach_count += 1

        # --- Achievement progress (for partially-complete ones) ---
        progress_entries = [
            ("volume", 120000),
            ("streak", 99),
            ("nutrition_compliance", 35),
        ]
        for ptype, val in progress_entries:
            await db.execute(text(
                "INSERT INTO achievement_progress (id, user_id, progress_type, current_value, metadata, created_at, updated_at) "
                "VALUES (:id, :uid, :pt, :cv, :md, :now, :now)"
            ), {"id": str(uuid.uuid4()), "uid": user_id, "pt": ptype, "cv": val, "md": "{}", "now": now})

        # --- Water logs (as nutrition entries with meal_name='Water') ---
        water_count = 0
        for day_offset in range(121):
            d = START + timedelta(days=day_offset)
            glasses = random.randint(6, 12)
            ml = glasses * 250
            await db.execute(text(
                "INSERT INTO nutrition_entries (id, user_id, meal_name, food_name, calories, "
                "protein_g, carbs_g, fat_g, entry_date, created_at, updated_at) "
                "VALUES (:id, :uid, 'Water', :fn, 0, 0, 0, 0, :d, :now, :now)"
            ), {"id": str(uuid.uuid4()), "uid": user_id, "fn": f"{glasses} glasses ({ml}ml)", "d": d.isoformat(), "now": now})
            water_count += 1

        await db.commit()

    await engine.dispose()
    print(f"\n✅ Demo data seeded successfully!")
    print(f"   Achievements:      {ach_count}")
    print(f"   Water logs:        {water_count}")
    print(f"   Training sessions: {training_count}")
    print(f"   Nutrition entries: {nutrition_count}")
    print(f"   Bodyweight logs:   {bw_count}")
    print(f"   Adaptive snapshots: {snap_count}")
    print(f"\n   Login: {EMAIL} / {PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
