# Calorie Goals: Dashboard vs Profile - Why They Differ

## The Difference

**Dashboard:** Shows **today's adjusted targets**  
**Profile:** Shows **baseline TDEE targets**

## Why They're Different

### Dashboard (useDailyTargets)
- **Date-specific** - adjusts for training day vs rest day
- **Dynamic** - changes based on your workout schedule
- **Example:**
  - Rest day: 2,000 cal (baseline)
  - Training day: 2,300 cal (+15% for workout)

### Profile (adaptiveTargets)
- **Baseline** - your average daily target
- **Static** - doesn't change day-to-day
- **Example:**
  - Always shows: 2,000 cal (your baseline TDEE)

## This Is Correct Behavior!

**The sync engine adjusts your targets based on:**
1. **Training vs Rest Day** - More calories on training days
2. **Volume Multiplier** - Adjusts based on workout intensity
3. **Muscle Group Demand** - Higher demand = more calories

**Example User (Cutting, 2000 cal baseline):**
- **Monday (Leg Day):** Dashboard shows 2,200 cal
- **Tuesday (Rest):** Dashboard shows 1,900 cal
- **Wednesday (Upper):** Dashboard shows 2,100 cal
- **Profile (Always):** Shows 2,000 cal (baseline)

## Should We Change This?

**Option A: Keep as-is** (Recommended)
- Dashboard shows dynamic daily targets (what to eat TODAY)
- Profile shows baseline (your average TDEE)
- Clear separation of concerns

**Option B: Make Profile show "Today's Target"**
- Profile would need to be date-aware
- Would duplicate Dashboard functionality
- Less clear what "baseline" is

**Option C: Add explanation text**
- Dashboard: "Today's Target: 2,200 cal (training day)"
- Profile: "Baseline TDEE: 2,000 cal/day"
- Makes the difference explicit

## Recommendation

**Keep the current behavior** but add clarifying labels:

**Dashboard:**
```
Today's Target
2,200 cal
↑ Training day (+200)
```

**Profile:**
```
Baseline TDEE
2,000 cal/day
(Adjusts daily based on training)
```

This makes it clear they're showing different (but related) values.

---

**The difference is intentional and correct - it's just not explained to the user!**

