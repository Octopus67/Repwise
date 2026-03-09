"""Generate 90 days of realistic fitness data for testing.

Usage:
    python scripts/generate_test_data.py --email 0000006mm@gmail.com --days 90
"""

import asyncio
import random
import uuid
from datetime import date, timedelta
from typing import Optional
import argparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import async_session_factory
from src.modules.auth.models import User
from src.modules.nutrition.models import NutritionEntry
from src.modules.training.models import TrainingSession
from src.modules.user.models import BodyweightLog


# Sample foods with realistic macros
FOODS = [
    {"name": "Chicken Breast", "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 3.6},
    {"name": "Brown Rice", "calories": 112, "protein_g": 2.6, "carbs_g": 24, "fat_g": 0.9},
    {"name": "Broccoli", "calories": 55, "protein_g": 3.7, "carbs_g": 11, "fat_g": 0.6},
    {"name": "Eggs", "calories": 155, "protein_g": 13, "carbs_g": 1.1, "fat_g": 11},
    {"name": "Oatmeal", "calories": 150, "protein_g": 5, "carbs_g": 27, "fat_g": 3},
    {"name": "Banana", "calories": 105, "protein_g": 1.3, "carbs_g": 27, "fat_g": 0.4},
    {"name": "Greek Yogurt", "calories": 100, "protein_g": 17, "carbs_g": 6, "fat_g": 0.7},
    {"name": "Almonds", "calories": 164, "protein_g": 6, "carbs_g": 6, "fat_g": 14},
    {"name": "Sweet Potato", "calories": 112, "protein_g": 2, "carbs_g": 26, "fat_g": 0.1},
    {"name": "Salmon", "calories": 206, "protein_g": 22, "carbs_g": 0, "fat_g": 13},
]

# Sample exercises
EXERCISES = [
    {"name": "Barbell Bench Press", "muscle": "chest", "compound": True},
    {"name": "Barbell Back Squat", "muscle": "quads", "compound": True},
    {"name": "Conventional Deadlift", "muscle": "back", "compound": True},
    {"name": "Overhead Press", "muscle": "shoulders", "compound": True},
    {"name": "Barbell Row", "muscle": "back", "compound": True},
    {"name": "Pull-ups", "muscle": "lats", "compound": True},
    {"name": "Dumbbell Curl", "muscle": "biceps", "compound": False},
    {"name": "Tricep Pushdown", "muscle": "triceps", "compound": False},
    {"name": "Leg Press", "muscle": "quads", "compound": False},
    {"name": "Lat Pulldown", "muscle": "lats", "compound": False},
]


async def generate_nutrition_data(
    session: AsyncSession,
    user_id: uuid.UUID,
    start_date: date,
    days: int,
    target_calories: int = 2000,
    target_protein: int = 150,
) -> int:
    """Generate realistic nutrition entries."""
    entries_created = 0
    
    for day_offset in range(days):
        current_date = start_date - timedelta(days=day_offset)
        
        # 85% chance of logging (realistic adherence)
        if random.random() > 0.85:
            continue
        
        # Generate 3-5 meals per day
        num_meals = random.randint(3, 5)
        daily_calories = 0
        daily_protein = 0
        
        for meal_num in range(num_meals):
            # Select 2-4 foods per meal
            num_foods = random.randint(2, 4)
            meal_calories = 0
            meal_protein = 0
            meal_carbs = 0
            meal_fat = 0
            
            for _ in range(num_foods):
                food = random.choice(FOODS)
                serving_multiplier = random.uniform(0.5, 2.0)
                
                meal_calories += food["calories"] * serving_multiplier
                meal_protein += food["protein_g"] * serving_multiplier
                meal_carbs += food["carbs_g"] * serving_multiplier
                meal_fat += food["fat_g"] * serving_multiplier
            
            # Add some variance to hit target
            if meal_num == num_meals - 1:
                # Last meal - adjust to hit target
                remaining_calories = target_calories - daily_calories
                if remaining_calories > 0:
                    meal_calories = remaining_calories
                    meal_protein = target_protein - daily_protein
            
            daily_calories += meal_calories
            daily_protein += meal_protein
            
            entry = NutritionEntry(
                user_id=user_id,
                entry_date=current_date,
                meal_name=f"Meal {meal_num + 1}",
                calories=round(meal_calories),
                protein_g=round(meal_protein, 1),
                carbs_g=round(meal_carbs, 1),
                fat_g=round(meal_fat, 1),
            )
            session.add(entry)
            entries_created += 1
    
    await session.commit()
    return entries_created


async def generate_training_data(
    session: AsyncSession,
    user_id: uuid.UUID,
    start_date: date,
    days: int,
    sessions_per_week: int = 4,
) -> int:
    """Generate realistic training sessions."""
    sessions_created = 0
    
    # Training days (e.g., Mon, Wed, Fri, Sat for 4x/week)
    training_days = [0, 2, 4, 5] if sessions_per_week == 4 else [0, 2, 4] if sessions_per_week == 3 else [0, 2, 4, 5, 6]
    
    for day_offset in range(days):
        current_date = start_date - timedelta(days=day_offset)
        weekday = current_date.weekday()
        
        # Check if training day
        if weekday not in training_days:
            continue
        
        # 90% adherence (sometimes skip)
        if random.random() > 0.90:
            continue
        
        # Select 4-6 exercises
        num_exercises = random.randint(4, 6)
        selected_exercises = random.sample(EXERCISES, num_exercises)
        
        exercises_data = []
        for exercise in selected_exercises:
            # 3-4 working sets
            num_sets = random.randint(3, 4)
            sets_data = []
            
            # Base weight (progressive overload over time)
            weeks_ago = day_offset // 7
            base_weight = 100 - (weeks_ago * 0.5)  # Slight regression going back in time
            
            for set_num in range(num_sets):
                # Weight varies slightly per set
                weight = base_weight + random.uniform(-5, 5)
                reps = random.randint(6, 12)
                rpe = random.choice([7, 8, 9, 10])
                
                sets_data.append({
                    "reps": reps,
                    "weight_kg": round(weight, 1),
                    "rpe": rpe,
                    "set_type": "normal",
                })
            
            exercises_data.append({
                "exercise_name": exercise["name"],
                "sets": sets_data,
            })
        
        training_session = TrainingSession(
            user_id=user_id,
            session_date=current_date,
            exercises=exercises_data,
        )
        session.add(training_session)
        sessions_created += 1
    
    await session.commit()
    return sessions_created


async def generate_bodyweight_data(
    session: AsyncSession,
    user_id: uuid.UUID,
    start_date: date,
    days: int,
    start_weight: float = 80.0,
    goal_rate: float = -0.5,  # kg per week
) -> int:
    """Generate realistic bodyweight progression."""
    logs_created = 0
    
    for day_offset in range(days):
        current_date = start_date - timedelta(days=day_offset)
        
        # Log every 2-3 days (realistic frequency)
        if day_offset % random.randint(2, 3) != 0:
            continue
        
        # Calculate expected weight with some noise
        weeks_ago = day_offset / 7
        expected_weight = start_weight + (goal_rate * weeks_ago)
        
        # Add realistic daily variance (±0.3 kg)
        actual_weight = expected_weight + random.uniform(-0.3, 0.3)
        
        log = BodyweightLog(
            user_id=user_id,
            recorded_date=current_date,
            weight_kg=round(actual_weight, 1),
        )
        session.add(log)
        logs_created += 1
    
    await session.commit()
    return logs_created


async def main(email: str, days: int = 90):
    """Generate test data for a user."""
    async with async_session_factory() as session:
        # Find user
        stmt = select(User).where(User.email == email, User.deleted_at.is_(None))
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"❌ User not found: {email}")
            return
        
        print(f"✅ Found user: {email} (ID: {user.id})")
        print(f"📅 Generating {days} days of data...")
        
        start_date = date.today()
        
        # Generate data
        nutrition_count = await generate_nutrition_data(
            session, user.id, start_date, days,
            target_calories=2000, target_protein=150
        )
        
        training_count = await generate_training_data(
            session, user.id, start_date, days,
            sessions_per_week=4
        )
        
        bodyweight_count = await generate_bodyweight_data(
            session, user.id, start_date, days,
            start_weight=80.0, goal_rate=-0.5
        )
        
        print(f"\n✅ Data generated successfully!")
        print(f"   Nutrition entries: {nutrition_count}")
        print(f"   Training sessions: {training_count}")
        print(f"   Bodyweight logs: {bodyweight_count}")
        print(f"\n🎉 Refresh your dashboard to see analytics!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate test fitness data")
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument("--days", type=int, default=90, help="Number of days to generate")
    args = parser.parse_args()
    
    asyncio.run(main(args.email, args.days))
