"""Screen drawing functions for Repwise App Store screenshots — v3 full-height."""

from PIL import ImageFont

BG = (11, 15, 20)
GREEN = (74, 222, 128)
WHITE = (255, 255, 255)
GRAY = (156, 163, 175)
DARK3 = (30, 38, 48)
DARK4 = (38, 48, 60)

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial Narrow.ttf"


def font(size, bold=False):
    try:
        return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)
    except Exception:
        return ImageFont.load_default()


def card(draw, x0, y0, x1, y1, s):
    draw.rounded_rectangle([x0, y0, x1, y1], radius=int(s * 14), fill=DARK3)


def status_bar(draw, x, y, w, s):
    draw.text((x, y), "9:41", fill=WHITE, font=font(int(s * 16)))
    draw.text((x + w - int(s * 80), y), "100% ■", fill=WHITE, font=font(int(s * 14)))
    return y + int(s * 28)


def nav_bar(draw, x, y, w, s, items, active=0):
    """Bottom tab bar."""
    iw = w // len(items)
    bar_y = y
    draw.line([(x, bar_y), (x + w, bar_y)], fill=DARK4, width=1)
    bar_y += int(s * 12)
    for i, label in enumerate(items):
        cx = x + i * iw + iw // 2
        color = GREEN if i == active else GRAY
        draw.text(
            (cx - int(s * len(label) * 4), bar_y),
            label,
            fill=color,
            font=font(int(s * 14), i == active),
        )


def draw_screen_track(draw, x, y, w, h, s):
    iy = status_bar(draw, x, y, w, s)
    draw.text((x, iy), "Today's Workout", fill=WHITE, font=font(int(s * 38), True))
    iy += int(s * 52)
    draw.text((x, iy), "Push Day — Chest & Triceps", fill=GREEN, font=font(int(s * 24)))
    iy += int(s * 48)

    # Timer card — big
    th = int(s * 100)
    card(draw, x, iy, x + w, iy + th, s)
    draw.text((x + int(s * 20), iy + int(s * 14)), "Elapsed", fill=GRAY, font=font(int(s * 18)))
    draw.text(
        (x + int(s * 20), iy + int(s * 42)), "32:15", fill=WHITE, font=font(int(s * 40), True)
    )
    draw.text(
        (x + w - int(s * 120), iy + int(s * 38)),
        "▶ Active",
        fill=GREEN,
        font=font(int(s * 24), True),
    )
    iy += th + int(s * 18)

    exercises = [
        ("Bench Press", "4 × 8 reps", "185 lb", 3, 4),
        ("Incline DB Press", "3 × 10 reps", "65 lb", 2, 3),
        ("Cable Fly", "3 × 12 reps", "30 lb", 1, 3),
        ("Tricep Pushdown", "3 × 15 reps", "45 lb", 0, 3),
        ("Overhead Extension", "3 × 12 reps", "35 lb", 0, 3),
        ("Lateral Raise", "4 × 15 reps", "20 lb", 0, 4),
    ]
    # Calculate card height to fill remaining space
    remaining = h - (iy - y) - int(s * 100)  # leave room for progress bar + nav
    card_h = max(int(s * 90), remaining // len(exercises) - int(s * 10))

    for name, sets, wt, done, total in exercises:
        card(draw, x, iy, x + w, iy + card_h, s)
        draw.text(
            (x + int(s * 20), iy + int(s * 14)), name, fill=WHITE, font=font(int(s * 22), True)
        )
        draw.text((x + int(s * 20), iy + int(s * 42)), sets, fill=GRAY, font=font(int(s * 18)))
        draw.text(
            (x + w - int(s * 90), iy + int(s * 18)), wt, fill=GREEN, font=font(int(s * 24), True)
        )
        # Set dots
        for d in range(total):
            dx = x + int(s * 20) + d * int(s * 26)
            dy = iy + card_h - int(s * 24)
            draw.ellipse(
                [dx, dy, dx + int(s * 16), dy + int(s * 16)], fill=GREEN if d < done else DARK4
            )
        iy += card_h + int(s * 10)

    # Progress bar
    iy += int(s * 6)
    draw.text((x, iy), "Workout Progress", fill=GRAY, font=font(int(s * 18)))
    iy += int(s * 28)
    draw.rounded_rectangle([x, iy, x + w, iy + int(s * 20)], radius=int(s * 10), fill=DARK4)
    draw.rounded_rectangle(
        [x, iy, x + int(w * 0.65), iy + int(s * 20)], radius=int(s * 10), fill=GREEN
    )
    draw.text(
        (x + int(w * 0.65) + int(s * 14), iy - int(s * 2)),
        "65%",
        fill=WHITE,
        font=font(int(s * 18), True),
    )
    iy += int(s * 40)

    nav_bar(draw, x, y + h - int(s * 50), w, s, ["Home", "Workout", "Nutrition", "Profile"], 1)


def draw_screen_nutrition(draw, x, y, w, h, s):
    iy = status_bar(draw, x, y, w, s)
    draw.text((x, iy), "Nutrition", fill=WHITE, font=font(int(s * 38), True))
    iy += int(s * 54)

    # Calorie card
    card(draw, x, iy, x + w, iy + int(s * 90), s)
    draw.text(
        (x + int(s * 20), iy + int(s * 14)),
        "1,847 / 2,400 kcal",
        fill=GREEN,
        font=font(int(s * 30), True),
    )
    draw.text(
        (x + int(s * 20), iy + int(s * 52)),
        "553 remaining • 77% of goal",
        fill=GRAY,
        font=font(int(s * 20)),
    )
    iy += int(s * 108)

    # Macro rings — larger
    ring_cx = x + w // 2
    ring_cy = iy + int(s * 130)
    macros = [
        (int(s * 120), GREEN, 0.72, "Protein"),
        (int(s * 90), (96, 165, 250), 0.55, "Carbs"),
        (int(s * 60), (251, 146, 60), 0.65, "Fat"),
    ]
    for radius, color, pct, label in macros:
        bbox = [ring_cx - radius, ring_cy - radius, ring_cx + radius, ring_cy + radius]
        draw.arc(bbox, -90, -90 + int(360 * pct), fill=color, width=int(s * 16))
        draw.arc(bbox, -90 + int(360 * pct), 270, fill=DARK4, width=int(s * 16))
    draw.text(
        (ring_cx - int(s * 28), ring_cy - int(s * 16)),
        "77%",
        fill=WHITE,
        font=font(int(s * 32), True),
    )
    iy = ring_cy + int(s * 150)

    # Macro detail cards — taller
    macro_data = [
        ("Protein", "145g / 200g", "72%", GREEN, 0.72),
        ("Carbs", "180g / 320g", "56%", (96, 165, 250), 0.56),
        ("Fat", "52g / 80g", "65%", (251, 146, 60), 0.65),
    ]
    for label, val, pct_str, color, pct in macro_data:
        ch = int(s * 80)
        card(draw, x, iy, x + w, iy + ch, s)
        draw.rectangle(
            [x + int(s * 14), iy + int(s * 16), x + int(s * 22), iy + ch - int(s * 16)], fill=color
        )
        draw.text(
            (x + int(s * 34), iy + int(s * 14)), label, fill=WHITE, font=font(int(s * 22), True)
        )
        draw.text((x + int(s * 34), iy + int(s * 44)), val, fill=GRAY, font=font(int(s * 18)))
        # Progress bar
        bar_x = x + w - int(s * 160)
        bar_y = iy + int(s * 30)
        draw.rounded_rectangle(
            [bar_x, bar_y, bar_x + int(s * 130), bar_y + int(s * 16)], radius=int(s * 8), fill=DARK4
        )
        draw.rounded_rectangle(
            [bar_x, bar_y, bar_x + int(s * 130 * pct), bar_y + int(s * 16)],
            radius=int(s * 8),
            fill=color,
        )
        draw.text(
            (bar_x + int(s * 135), bar_y - int(s * 2)), pct_str, fill=color, font=font(int(s * 15))
        )
        iy += ch + int(s * 12)

    # Meal log
    iy += int(s * 10)
    draw.text((x, iy), "Today's Meals", fill=WHITE, font=font(int(s * 24), True))
    iy += int(s * 36)
    meals = [
        ("Breakfast", "Oats + Protein Shake", "520 kcal", "8:30 AM"),
        ("Lunch", "Chicken Rice Bowl", "680 kcal", "12:45 PM"),
        ("Snack", "Greek Yogurt + Berries", "280 kcal", "3:15 PM"),
        ("Pre-Workout", "Banana + Whey", "367 kcal", "5:00 PM"),
    ]
    for meal, desc, cal, time in meals:
        ch = int(s * 76)
        card(draw, x, iy, x + w, iy + ch, s)
        draw.text(
            (x + int(s * 20), iy + int(s * 10)), meal, fill=WHITE, font=font(int(s * 20), True)
        )
        draw.text((x + int(s * 20), iy + int(s * 36)), desc, fill=GRAY, font=font(int(s * 16)))
        draw.text((x + w - int(s * 90), iy + int(s * 12)), cal, fill=GREEN, font=font(int(s * 18)))
        draw.text((x + w - int(s * 90), iy + int(s * 38)), time, fill=GRAY, font=font(int(s * 14)))
        iy += ch + int(s * 10)

    nav_bar(draw, x, y + h - int(s * 50), w, s, ["Home", "Workout", "Nutrition", "Profile"], 2)


def draw_screen_recovery(draw, x, y, w, h, s):
    iy = status_bar(draw, x, y, w, s)
    draw.text((x, iy), "Recovery", fill=WHITE, font=font(int(s * 38), True))
    iy += int(s * 58)

    # Big score circle — larger
    cx = x + w // 2
    cy = iy + int(s * 130)
    r = int(s * 115)
    draw.arc([cx - r, cy - r, cx + r, cy + r], 0, 360, fill=DARK4, width=int(s * 14))
    draw.arc(
        [cx - r, cy - r, cx + r, cy + r], -90, -90 + int(360 * 0.87), fill=GREEN, width=int(s * 14)
    )
    draw.text((cx - int(s * 42), cy - int(s * 34)), "87", fill=GREEN, font=font(int(s * 64), True))
    draw.text((cx - int(s * 32), cy + int(s * 34)), "Ready", fill=GRAY, font=font(int(s * 24)))
    iy = cy + r + int(s * 44)

    # Metric cards — fill remaining space
    metrics = [
        ("Heart Rate Variability", "62 ms", "↑ 8% vs last week", GREEN),
        ("Sleep Duration", "7h 42m", "Quality: 91%", (96, 165, 250)),
        ("Resting Heart Rate", "54 bpm", "↓ 2 bpm this week", GREEN),
        ("Daily Strain", "12.4 / 21", "Moderate load", (251, 191, 60)),
        ("Muscle Soreness", "Low", "Upper body recovered", GREEN),
    ]
    remaining = h - (iy - y) - int(s * 120)  # room for recommendation + nav
    card_h = max(int(s * 88), remaining // len(metrics) - int(s * 12))

    for label, val, sub, accent in metrics:
        card(draw, x, iy, x + w, iy + card_h, s)
        draw.text((x + int(s * 20), iy + int(s * 12)), label, fill=GRAY, font=font(int(s * 18)))
        draw.text(
            (x + int(s * 20), iy + int(s * 38)), val, fill=WHITE, font=font(int(s * 28), True)
        )
        draw.text(
            (x + int(s * 20), iy + card_h - int(s * 26)), sub, fill=accent, font=font(int(s * 16))
        )
        iy += card_h + int(s * 10)

    # Recommendation card
    iy += int(s * 4)
    card(draw, x, iy, x + w, iy + int(s * 70), s)
    draw.text(
        (x + int(s * 20), iy + int(s * 12)),
        "💡 Recommendation",
        fill=GREEN,
        font=font(int(s * 20), True),
    )
    draw.text(
        (x + int(s * 20), iy + int(s * 42)),
        "Great recovery — push hard today!",
        fill=GRAY,
        font=font(int(s * 18)),
    )

    nav_bar(draw, x, y + h - int(s * 50), w, s, ["Home", "Recovery", "Nutrition", "Profile"], 1)


def draw_screen_analytics(draw, x, y, w, h, s):
    iy = status_bar(draw, x, y, w, s)
    draw.text((x, iy), "Progress", fill=WHITE, font=font(int(s * 38), True))
    iy += int(s * 52)

    # Period selector
    periods = ["1W", "1M", "3M", "6M", "1Y"]
    pw_btn = int(s * 64)
    for pi, p in enumerate(periods):
        bx = x + pi * (pw_btn + int(s * 10))
        fill = GREEN if pi == 2 else DARK4
        draw.rounded_rectangle(
            [bx, iy, bx + pw_btn, iy + int(s * 36)], radius=int(s * 10), fill=fill
        )
        tf = font(int(s * 17), True)
        tb = draw.textbbox((0, 0), p, font=tf)
        tw = tb[2] - tb[0]
        draw.text(
            (bx + (pw_btn - tw) // 2, iy + int(s * 9)), p, fill=BG if pi == 2 else GRAY, font=tf
        )
    iy += int(s * 56)

    # Bar chart — much taller
    draw.text((x, iy), "Volume (sets × reps × weight)", fill=GRAY, font=font(int(s * 18)))
    iy += int(s * 32)
    chart_h = int(s * 280)
    bar_count = 12
    gap = w // bar_count
    bar_w = int(gap * 0.65)
    values = [0.40, 0.45, 0.43, 0.50, 0.55, 0.52, 0.60, 0.65, 0.63, 0.72, 0.78, 0.85]
    months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]
    # Y-axis labels
    for yi in range(5):
        ly = iy + int(chart_h * (1 - yi / 4))
        draw.line([(x, ly), (x + w, ly)], fill=(35, 42, 52), width=1)
    for i, v in enumerate(values):
        bx = x + i * gap
        bh = int(chart_h * v)
        color = GREEN if i >= 9 else (40, 120, 70)
        draw.rounded_rectangle(
            [bx, iy + chart_h - bh, bx + bar_w, iy + chart_h], radius=int(s * 6), fill=color
        )
        draw.text(
            (bx + bar_w // 4, iy + chart_h + int(s * 8)),
            months[i],
            fill=GRAY,
            font=font(int(s * 14)),
        )
    iy += chart_h + int(s * 38)

    # PR cards — fill remaining
    draw.text((x, iy), "Personal Records", fill=WHITE, font=font(int(s * 26), True))
    iy += int(s * 40)
    prs = [
        ("Bench Press", "207 lb", "+22 lb", "185 → 207 lb"),
        ("Squat", "310 lb", "+35 lb", "275 → 310 lb"),
        ("Deadlift", "355 lb", "+40 lb", "315 → 355 lb"),
        ("OHP", "145 lb", "+15 lb", "130 → 145 lb"),
    ]
    remaining = h - (iy - y) - int(s * 60)
    card_h = max(int(s * 80), remaining // len(prs) - int(s * 10))

    for lift, current, gain, detail in prs:
        card(draw, x, iy, x + w, iy + card_h, s)
        draw.text(
            (x + int(s * 20), iy + int(s * 12)), lift, fill=WHITE, font=font(int(s * 22), True)
        )
        draw.text(
            (x + w - int(s * 90), iy + int(s * 12)), gain, fill=GREEN, font=font(int(s * 22), True)
        )
        draw.text(
            (x + int(s * 20), iy + card_h - int(s * 28)), detail, fill=GRAY, font=font(int(s * 17))
        )
        draw.text(
            (x + w - int(s * 90), iy + card_h - int(s * 28)),
            current,
            fill=GRAY,
            font=font(int(s * 15)),
        )
        iy += card_h + int(s * 10)

    nav_bar(draw, x, y + h - int(s * 50), w, s, ["Home", "Progress", "Nutrition", "Profile"], 1)


def draw_screen_social(draw, x, y, w, h, s):
    iy = status_bar(draw, x, y, w, s)
    draw.text((x, iy), "Community", fill=WHITE, font=font(int(s * 38), True))
    iy += int(s * 56)

    # Leaderboard
    draw.text((x, iy), "Weekly Leaderboard", fill=GREEN, font=font(int(s * 24), True))
    iy += int(s * 40)

    leaders = [
        ("🥇", "Alex M.", "14,250 pts", "Level 42"),
        ("🥈", "Sarah K.", "12,800 pts", "Level 38"),
        ("🥉", "You", "11,430 pts", "Level 35"),
        ("4", "Mike R.", "10,900 pts", "Level 33"),
        ("5", "Jordan L.", "9,750 pts", "Level 31"),
    ]
    for rank, name, pts, level in leaders:
        is_you = name == "You"
        ch = int(s * 72)
        card(draw, x, iy, x + w, iy + ch, s)
        if is_you:
            draw.rounded_rectangle(
                [x, iy, x + w, iy + ch], radius=int(s * 14), outline=GREEN, width=2
            )
        draw.text((x + int(s * 20), iy + int(s * 14)), rank, fill=WHITE, font=font(int(s * 24)))
        draw.text(
            (x + int(s * 56), iy + int(s * 12)),
            name,
            fill=GREEN if is_you else WHITE,
            font=font(int(s * 22), True),
        )
        draw.text((x + int(s * 56), iy + int(s * 42)), level, fill=GRAY, font=font(int(s * 16)))
        draw.text((x + w - int(s * 120), iy + int(s * 22)), pts, fill=GRAY, font=font(int(s * 18)))
        iy += ch + int(s * 10)

    # Activity feed
    iy += int(s * 16)
    draw.text((x, iy), "Recent Activity", fill=WHITE, font=font(int(s * 24), True))
    iy += int(s * 38)

    activities = [
        ("Alex M. hit a PR! 🎉", "Bench Press — 225 lb", "2m ago"),
        ("Sarah K. completed", "Full Body Workout — 58 min", "15m ago"),
        ("You earned a badge! 🏆", "10-Day Streak", "1h ago"),
        ("Mike R. joined challenge", "30-Day Squat Challenge", "2h ago"),
    ]
    remaining = h - (iy - y) - int(s * 60)
    ch = max(int(s * 86), remaining // len(activities) - int(s * 10))

    for title, desc, time in activities:
        card(draw, x, iy, x + w, iy + ch, s)
        draw.text(
            (x + int(s * 20), iy + int(s * 12)), title, fill=WHITE, font=font(int(s * 20), True)
        )
        draw.text((x + int(s * 20), iy + int(s * 40)), desc, fill=GRAY, font=font(int(s * 17)))
        draw.text((x + w - int(s * 70), iy + int(s * 12)), time, fill=GRAY, font=font(int(s * 14)))
        draw.text(
            (x + int(s * 20), iy + ch - int(s * 26)), "♡ Like", fill=GRAY, font=font(int(s * 15))
        )
        draw.text(
            (x + int(s * 90), iy + ch - int(s * 26)),
            "💬 Comment",
            fill=GRAY,
            font=font(int(s * 15)),
        )
        iy += ch + int(s * 10)

    nav_bar(draw, x, y + h - int(s * 50), w, s, ["Home", "Social", "Nutrition", "Profile"], 1)


DRAW_FNS = [
    draw_screen_track,
    draw_screen_nutrition,
    draw_screen_recovery,
    draw_screen_analytics,
    draw_screen_social,
]
