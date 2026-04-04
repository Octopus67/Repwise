#!/usr/bin/env python3
"""Seed production Neon with system/reference data (not user data)."""
import asyncio, json, os, sys, uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: Set DATABASE_URL"); sys.exit(1)

# --- System workout templates ---
TEMPLATES = [
    {"name": "Push Pull Legs (6-day)", "description": "Classic PPL split for intermediate lifters. Train each muscle 2x/week.", "exercises": [
        {"exercise_name": "Bench Press", "muscle_group": "chest", "sets": [{"reps": 8}, {"reps": 8}, {"reps": 8}, {"reps": 8}]},
        {"exercise_name": "Overhead Press", "muscle_group": "shoulders", "sets": [{"reps": 10}, {"reps": 10}, {"reps": 10}]},
        {"exercise_name": "Incline Dumbbell Press", "muscle_group": "chest", "sets": [{"reps": 10}, {"reps": 10}, {"reps": 10}]},
        {"exercise_name": "Lateral Raise", "muscle_group": "shoulders", "sets": [{"reps": 15}, {"reps": 15}, {"reps": 15}]},
        {"exercise_name": "Tricep Pushdown", "muscle_group": "triceps", "sets": [{"reps": 12}, {"reps": 12}, {"reps": 12}]},
    ], "tags": ["push", "intermediate", "6-day"]},
    {"name": "Upper Lower (4-day)", "description": "Balanced upper/lower split. Great for intermediates with limited time.", "exercises": [
        {"exercise_name": "Bench Press", "muscle_group": "chest", "sets": [{"reps": 8}, {"reps": 8}, {"reps": 8}]},
        {"exercise_name": "Barbell Row", "muscle_group": "back", "sets": [{"reps": 8}, {"reps": 8}, {"reps": 8}]},
        {"exercise_name": "Overhead Press", "muscle_group": "shoulders", "sets": [{"reps": 10}, {"reps": 10}, {"reps": 10}]},
        {"exercise_name": "Barbell Curl", "muscle_group": "biceps", "sets": [{"reps": 12}, {"reps": 12}]},
        {"exercise_name": "Tricep Pushdown", "muscle_group": "triceps", "sets": [{"reps": 12}, {"reps": 12}]},
    ], "tags": ["upper", "intermediate", "4-day"]},
    {"name": "Full Body (3-day)", "description": "Hit every muscle group each session. Ideal for beginners or time-constrained lifters.", "exercises": [
        {"exercise_name": "Squat", "muscle_group": "quads", "sets": [{"reps": 8}, {"reps": 8}, {"reps": 8}]},
        {"exercise_name": "Bench Press", "muscle_group": "chest", "sets": [{"reps": 8}, {"reps": 8}, {"reps": 8}]},
        {"exercise_name": "Barbell Row", "muscle_group": "back", "sets": [{"reps": 8}, {"reps": 8}, {"reps": 8}]},
        {"exercise_name": "Overhead Press", "muscle_group": "shoulders", "sets": [{"reps": 10}, {"reps": 10}]},
        {"exercise_name": "Romanian Deadlift", "muscle_group": "hamstrings", "sets": [{"reps": 10}, {"reps": 10}]},
    ], "tags": ["full-body", "beginner", "3-day"]},
    {"name": "Hypertrophy Chest & Back", "description": "High-volume chest and back session for advanced lifters.", "exercises": [
        {"exercise_name": "Bench Press", "muscle_group": "chest", "sets": [{"reps": 8}, {"reps": 8}, {"reps": 8}, {"reps": 8}]},
        {"exercise_name": "Incline Dumbbell Press", "muscle_group": "chest", "sets": [{"reps": 10}, {"reps": 10}, {"reps": 10}]},
        {"exercise_name": "Cable Fly", "muscle_group": "chest", "sets": [{"reps": 12}, {"reps": 12}, {"reps": 12}]},
        {"exercise_name": "Pull Up", "muscle_group": "back", "sets": [{"reps": 8}, {"reps": 8}, {"reps": 8}]},
        {"exercise_name": "Barbell Row", "muscle_group": "back", "sets": [{"reps": 8}, {"reps": 8}, {"reps": 8}]},
        {"exercise_name": "Seated Cable Row", "muscle_group": "back", "sets": [{"reps": 12}, {"reps": 12}, {"reps": 12}]},
    ], "tags": ["chest", "back", "hypertrophy", "advanced"]},
    {"name": "Leg Day (Quad Focus)", "description": "Quad-dominant leg session with hamstring and calf work.", "exercises": [
        {"exercise_name": "Squat", "muscle_group": "quads", "sets": [{"reps": 6}, {"reps": 6}, {"reps": 6}, {"reps": 6}]},
        {"exercise_name": "Leg Press", "muscle_group": "quads", "sets": [{"reps": 10}, {"reps": 10}, {"reps": 10}]},
        {"exercise_name": "Leg Extension", "muscle_group": "quads", "sets": [{"reps": 12}, {"reps": 12}, {"reps": 12}]},
        {"exercise_name": "Romanian Deadlift", "muscle_group": "hamstrings", "sets": [{"reps": 10}, {"reps": 10}, {"reps": 10}]},
        {"exercise_name": "Calf Raise", "muscle_group": "calves", "sets": [{"reps": 15}, {"reps": 15}, {"reps": 15}]},
    ], "tags": ["legs", "quads", "intermediate"]},
]

# System user ID for system templates
SYSTEM_USER_ID = uuid.UUID("00000000-0000-4000-a000-000000000000")

# --- Health marker reference ranges ---
MARKERS = [
    ("Hemoglobin", "g/dL", 12.0, 17.5, "Blood"),
    ("Hematocrit", "%", 36.0, 50.0, "Blood"),
    ("RBC Count", "million/µL", 4.0, 5.5, "Blood"),
    ("WBC Count", "thousand/µL", 4.0, 11.0, "Blood"),
    ("Platelets", "thousand/µL", 150.0, 400.0, "Blood"),
    ("Total Cholesterol", "mg/dL", 0.0, 200.0, "Lipids"),
    ("LDL Cholesterol", "mg/dL", 0.0, 100.0, "Lipids"),
    ("HDL Cholesterol", "mg/dL", 40.0, 999.0, "Lipids"),
    ("Triglycerides", "mg/dL", 0.0, 150.0, "Lipids"),
    ("Fasting Glucose", "mg/dL", 70.0, 100.0, "Metabolic"),
    ("HbA1c", "%", 4.0, 5.7, "Metabolic"),
    ("TSH", "mIU/L", 0.4, 4.0, "Thyroid"),
    ("Free T4", "ng/dL", 0.8, 1.8, "Thyroid"),
    ("Free T3", "pg/mL", 2.3, 4.2, "Thyroid"),
    ("Testosterone (Total)", "ng/dL", 300.0, 1000.0, "Hormones"),
    ("Testosterone (Free)", "pg/mL", 5.0, 21.0, "Hormones"),
    ("Estradiol", "pg/mL", 10.0, 40.0, "Hormones"),
    ("Cortisol (AM)", "µg/dL", 6.0, 18.0, "Hormones"),
    ("Vitamin D (25-OH)", "ng/mL", 30.0, 100.0, "Vitamins"),
    ("Vitamin B12", "pg/mL", 200.0, 900.0, "Vitamins"),
    ("Folate", "ng/mL", 3.0, 20.0, "Vitamins"),
    ("Iron (Serum)", "µg/dL", 60.0, 170.0, "Minerals"),
    ("Ferritin", "ng/mL", 20.0, 300.0, "Minerals"),
    ("TIBC", "µg/dL", 250.0, 370.0, "Minerals"),
    ("Creatinine", "mg/dL", 0.7, 1.3, "Kidney"),
    ("BUN", "mg/dL", 7.0, 20.0, "Kidney"),
    ("eGFR", "mL/min", 90.0, 999.0, "Kidney"),
    ("ALT", "U/L", 7.0, 56.0, "Liver"),
    ("AST", "U/L", 10.0, 40.0, "Liver"),
    ("CRP (hs)", "mg/L", 0.0, 3.0, "Inflammation"),
]

# --- Founder content ---
FOUNDER = {
    "section_key": "story",
    "locale": "en",
    "content": {
        "title": "Why I Built Repwise",
        "subtitle": "From frustrated lifter to building the app I wished existed",
        "paragraphs": [
            "I started lifting in 2019. Like most people, I tracked my workouts in a notes app and my food in MyFitnessPal. It worked — until it didn't.",
            "I wanted to know if I was actually making progress. Was my volume enough? Was I eating the right amount? Was I recovering properly? No single app could answer all of these questions with real data.",
            "So I built Repwise — a platform that connects your training, nutrition, and recovery into one intelligent system. Every feature is backed by peer-reviewed research, not bro-science.",
            "The Weekly Net Stimulus engine tracks your actual hypertrophy stimulus per muscle group. The adaptive nutrition engine adjusts your targets based on your real weight trend. The micronutrient dashboard flags deficiencies before they become problems.",
            "This isn't just another fitness app. It's the tool I wished I had when I started — and the one I use every day now."
        ],
        "metrics": {"users": "1K+", "workouts_logged": "50K+", "articles": "16"},
    }
}

async def seed():
    engine = create_async_engine(DB_URL, echo=False)
    async with engine.begin() as conn:
        # 1. System user for templates
        r = await conn.execute(text("SELECT count(*) FROM users WHERE id = :id"), {"id": SYSTEM_USER_ID})
        if r.scalar() == 0:
            import bcrypt
            hashed = bcrypt.hashpw(b"SYSTEM_NO_LOGIN", bcrypt.gensalt()).decode()
            await conn.execute(text("""
                INSERT INTO users (id, email, hashed_password, role, auth_provider, created_at, updated_at)
                VALUES (:id, 'system@repwise.app', :pw, 'system', 'email', :now, :now)
            """), {"id": SYSTEM_USER_ID, "pw": hashed, "now": datetime.utcnow()})
            print("✅ Created system user")

        # 2. Workout templates
        r = await conn.execute(text("SELECT count(*) FROM workout_templates"))
        if r.scalar() == 0:
            for idx, t in enumerate(TEMPLATES):
                await conn.execute(text("""
                    INSERT INTO workout_templates (id, user_id, name, description, exercises, sort_order, created_at, updated_at)
                    VALUES (:id, :uid, :name, :desc, CAST(:ex AS jsonb), :sort, :now, :now)
                """), {"id": uuid.uuid4(), "uid": SYSTEM_USER_ID, "name": t["name"], "desc": t["description"],
                       "ex": json.dumps(t["exercises"]), "sort": idx, "now": datetime.utcnow()})
            print(f"✅ Seeded {len(TEMPLATES)} workout templates")
        else:
            print("⏭️  Workout templates already exist")

        # 3. Marker reference ranges
        r = await conn.execute(text("SELECT count(*) FROM marker_reference_ranges"))
        if r.scalar() == 0:
            for name, unit, mn, mx, cat in MARKERS:
                await conn.execute(text("""
                    INSERT INTO marker_reference_ranges (id, marker_name, unit, min_normal, max_normal, category, created_at, updated_at)
                    VALUES (:id, :name, :unit, :mn, :mx, :cat, :now, :now)
                """), {"id": uuid.uuid4(), "name": name, "unit": unit, "mn": mn, "mx": mx, "cat": cat, "now": datetime.utcnow()})
            print(f"✅ Seeded {len(MARKERS)} health marker reference ranges")
        else:
            print("⏭️  Marker reference ranges already exist")

        # 4. Founder content
        r = await conn.execute(text("SELECT count(*) FROM founder_content"))
        if r.scalar() == 0:
            await conn.execute(text("""
                INSERT INTO founder_content (id, section_key, locale, content, version, created_at, updated_at)
                VALUES (:id, :key, :locale, CAST(:content AS jsonb), 1, :now, :now)
            """), {"id": uuid.uuid4(), "key": FOUNDER["section_key"], "locale": FOUNDER["locale"],
                   "content": json.dumps(FOUNDER["content"]), "now": datetime.utcnow()})
            print("✅ Seeded founder content")
        else:
            print("⏭️  Founder content already exist")

    await engine.dispose()
    print("\n✓ Production seed complete")

if __name__ == "__main__":
    asyncio.run(seed())
