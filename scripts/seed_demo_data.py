"""Seed 120 days of realistic fitness data into local dev.db."""
import asyncio, json, random, uuid
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy import text
import bcrypt

DB_URL = "sqlite+aiosqlite:///./dev.db"
EMAIL = "0000006mm@gmail.com"
PASSWORD = "Repwise2026!"
NAME = "Manav"
START = date(2025, 12, 7)
END = date(2026, 4, 6)
DAYS = (END - START).days + 1  # 121 days

random.seed(42)

def uid():
    return uuid.uuid4().hex

def now():
    return datetime.utcnow()

# --- Exercise definitions ---
PUSH = [
    {"name": "Bench Press", "mg": "chest", "sec": ["triceps", "shoulders"], "sets": 4, "reps": 8, "start_kg": 65, "compound": True},
    {"name": "Overhead Press", "mg": "shoulders", "sec": ["triceps"], "sets": 3, "reps": 10, "start_kg": 35, "compound": True},
    {"name": "Incline DB Press", "mg": "chest", "sec": ["triceps", "shoulders"], "sets": 3, "reps": 10, "start_kg": 20, "compound": False},
    {"name": "Lateral Raise", "mg": "shoulders", "sec": [], "sets": 3, "reps": 15, "start_kg": 8, "compound": False},
    {"name": "Tricep Pushdown", "mg": "triceps", "sec": [], "sets": 3, "reps": 12, "start_kg": 22.5, "compound": False},
]
PULL = [
    {"name": "Barbell Row", "mg": "back", "sec": ["biceps"], "sets": 4, "reps": 8, "start_kg": 55, "compound": True},
    {"name": "Pull Up", "mg": "lats", "sec": ["biceps", "back"], "sets": 3, "reps": 8, "start_kg": 0, "compound": True},
    {"name": "Face Pull", "mg": "shoulders", "sec": [], "sets": 3, "reps": 15, "start_kg": 12.5, "compound": False},
    {"name": "Barbell Curl", "mg": "biceps", "sec": [], "sets": 3, "reps": 12, "start_kg": 17.5, "compound": False},
    {"name": "Hammer Curl", "mg": "biceps", "sec": [], "sets": 3, "reps": 12, "start_kg": 10, "compound": False},
]
LEGS = [
    {"name": "Squat", "mg": "quads", "sec": ["glutes", "hamstrings"], "sets": 4, "reps": 8, "start_kg": 75, "compound": True},
    {"name": "Romanian Deadlift", "mg": "hamstrings", "sec": ["glutes", "back"], "sets": 3, "reps": 10, "start_kg": 65, "compound": True},
    {"name": "Leg Press", "mg": "quads", "sec": ["glutes"], "sets": 3, "reps": 10, "start_kg": 110, "compound": True},
    {"name": "Leg Extension", "mg": "quads", "sec": [], "sets": 3, "reps": 12, "start_kg": 35, "compound": False},
    {"name": "Calf Raise", "mg": "calves", "sec": [], "sets": 3, "reps": 15, "start_kg": 55, "compound": False},
]
PPL_ROTATION = [PUSH, PULL, LEGS, PUSH, PULL, None, None]  # 5 on, 2 off

BREAKFAST = [
    ("Oats with Banana & Whey", 520, 35, 65, 12),
    ("Eggs & Toast", 480, 30, 40, 20),
    ("Greek Yogurt Parfait", 450, 32, 55, 10),
]
LUNCH = [
    ("Chicken Breast & Rice", 720, 48, 80, 14),
    ("Beef Stir Fry", 680, 42, 60, 22),
    ("Tuna Pasta", 650, 40, 75, 12),
]
DINNER = [
    ("Salmon & Sweet Potato", 680, 42, 55, 28),
    ("Chicken Thighs & Quinoa", 640, 38, 65, 18),
    ("Steak & Vegetables", 600, 45, 20, 30),
]
SNACKS = [
    ("Protein Shake", 350, 30, 25, 12),
    ("Trail Mix", 400, 12, 35, 25),
    ("Cottage Cheese & Berries", 280, 24, 20, 8),
]

def vary(val, pct=0.1):
    return round(val * random.uniform(1 - pct, 1 + pct), 1)

def weight_at_week(start_kg, week, compound):
    if not compound or start_kg == 0:
        return start_kg
    return round(start_kg * (1.025 ** (week // 2)), 1)

def build_exercises(template, week):
    ex_id_map = {}
    exercises = []
    for ex in template:
        eid = ex_id_map.setdefault(ex["name"], uid())
        w = weight_at_week(ex["start_kg"], week, ex["compound"])
        sets = []
        for _ in range(ex["sets"]):
            rpe = random.choice([7.0, 7.5, 8.0, 8.5, 9.0])
            sets.append({"weight_kg": w, "reps": ex["reps"], "rpe": rpe})
        exercises.append({
            "exercise_name": ex["name"],
            "exercise_id": eid,
            "muscle_group": ex["mg"],
            "secondary_muscles": ex["sec"],
            "sets": sets,
        })
    return exercises

async def main():
    engine = create_async_engine(DB_URL)
    Session = async_sessionmaker(engine, class_=AsyncSession)

    async with Session() as s:
        # Check/create user
        row = (await s.execute(text("SELECT id FROM users WHERE email = :e"), {"e": EMAIL})).first()
        if row:
            user_id = row[0]
            print(f"Found existing user: {user_id}")
        else:
            user_id = uid()
            hashed = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
            await s.execute(text(
                "INSERT INTO users (id, email, hashed_password, auth_provider, role, email_verified, has_used_trial, created_at, updated_at) "
                "VALUES (:id, :email, :pw, 'email', 'user', 1, 0, :now, :now)"
            ), {"id": user_id, "email": EMAIL, "pw": hashed, "now": now()})
            print(f"Created user: {user_id}")

        # Profile
        prof = (await s.execute(text("SELECT id FROM user_profiles WHERE user_id = :u"), {"u": user_id})).first()
        if not prof:
            await s.execute(text(
                "INSERT INTO user_profiles (id, user_id, display_name, timezone, coaching_mode, preferences, created_at, updated_at) "
                "VALUES (:id, :u, :dn, :tz, :cm, :p, :now, :now)"
            ), {"id": uid(), "u": user_id, "dn": NAME, "tz": "Asia/Kolkata", "cm": "collaborative",
                "p": json.dumps({"unit_system": "metric"}), "now": now()})
            print("Created user_profiles")

        # Goals
        goal = (await s.execute(text("SELECT id FROM user_goals WHERE user_id = :u"), {"u": user_id})).first()
        if not goal:
            await s.execute(text(
                "INSERT INTO user_goals (id, user_id, goal_type, target_weight_kg, created_at, updated_at) "
                "VALUES (:id, :u, 'bulk', 78.0, :now, :now)"
            ), {"id": uid(), "u": user_id, "now": now()})
            print("Created user_goals")

        # Check existing data counts
        bw_count = (await s.execute(text("SELECT count(*) FROM bodyweight_logs WHERE user_id = :u"), {"u": user_id})).scalar()
        ts_count = (await s.execute(text("SELECT count(*) FROM training_sessions WHERE user_id = :u"), {"u": user_id})).scalar()
        ne_count = (await s.execute(text("SELECT count(*) FROM nutrition_entries WHERE user_id = :u"), {"u": user_id})).scalar()

        if bw_count or ts_count or ne_count:
            print(f"Data already exists (bw={bw_count}, sessions={ts_count}, nutrition={ne_count}). Skipping seed.")
            await s.commit()
            return

        # Bodyweight logs
        bw_inserted = 0
        for i in range(DAYS):
            if random.random() > 0.80:
                continue
            d = START + timedelta(days=i)
            trend = 72.0 + (3.5 * i / DAYS)
            w = round(trend + random.uniform(-0.3, 0.3), 1)
            await s.execute(text(
                "INSERT INTO bodyweight_logs (id, user_id, weight_kg, recorded_date, created_at, updated_at) "
                "VALUES (:id, :u, :w, :d, :now, :now)"
            ), {"id": uid(), "u": user_id, "w": w, "d": d, "now": now()})
            bw_inserted += 1
        print(f"Bodyweight logs: {bw_inserted}")

        # Training sessions
        sess_inserted = 0
        for i in range(DAYS):
            d = START + timedelta(days=i)
            template = PPL_ROTATION[i % 7]
            if template is None:
                continue
            week = i // 7
            exercises = build_exercises(template, week)
            st = datetime(d.year, d.month, d.day, random.randint(6, 9), random.randint(0, 59))
            et = st + timedelta(minutes=random.randint(55, 80))
            await s.execute(text(
                "INSERT INTO training_sessions (id, user_id, session_date, exercises, start_time, end_time, version, created_at, updated_at) "
                "VALUES (:id, :u, :d, :ex, :st, :et, 1, :now, :now)"
            ), {"id": uid(), "u": user_id, "d": d, "ex": json.dumps(exercises), "st": st, "et": et, "now": now()})
            sess_inserted += 1
        print(f"Training sessions: {sess_inserted}")

        # Nutrition entries
        nut_inserted = 0
        for i in range(DAYS):
            if random.random() < 0.15:
                continue
            d = START + timedelta(days=i)
            for meal_name, options in [("breakfast", BREAKFAST), ("lunch", LUNCH), ("dinner", DINNER)]:
                fn, cal, p, c, f = random.choice(options)
                await s.execute(text(
                    "INSERT INTO nutrition_entries (id, user_id, meal_name, food_name, calories, protein_g, carbs_g, fat_g, entry_date, created_at, updated_at) "
                    "VALUES (:id, :u, :mn, :fn, :cal, :p, :c, :f, :d, :now, :now)"
                ), {"id": uid(), "u": user_id, "mn": meal_name, "fn": fn,
                    "cal": vary(cal), "p": vary(p), "c": vary(c), "f": vary(f), "d": d, "now": now()})
                nut_inserted += 1
            if random.random() < 0.70:
                fn, cal, p, c, f = random.choice(SNACKS)
                await s.execute(text(
                    "INSERT INTO nutrition_entries (id, user_id, meal_name, food_name, calories, protein_g, carbs_g, fat_g, entry_date, created_at, updated_at) "
                    "VALUES (:id, :u, :mn, :fn, :cal, :p, :c, :f, :d, :now, :now)"
                ), {"id": uid(), "u": user_id, "mn": "snacks", "fn": fn,
                    "cal": vary(cal), "p": vary(p), "c": vary(c), "f": vary(f), "d": d, "now": now()})
                nut_inserted += 1
        print(f"Nutrition entries: {nut_inserted}")

        await s.commit()
        print(f"\n✅ Seed complete! BW={bw_inserted}, Sessions={sess_inserted}, Nutrition={nut_inserted}")

if __name__ == "__main__":
    asyncio.run(main())
