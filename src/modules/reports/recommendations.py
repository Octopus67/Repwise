"""Rule-based recommendation engine — pure function, no DB access."""

from __future__ import annotations

from src.modules.reports.mev_reference import MEV_SETS
from src.modules.reports.schemas import ReportContext

FALLBACK = "Keep logging consistently — more data means better insights."


def generate_recommendations(ctx: ReportContext) -> list[str]:
    """Return 2–3 actionable recommendations based on weekly metrics."""
    matched: list[str] = []

    # Rule 1: No data at all
    if ctx.days_logged_training == 0 and ctx.days_logged_nutrition == 0:
        matched.append("Start logging your meals and workouts — even one entry helps build your baseline.")
        matched.append("Consistency is key. Try logging at least one meal and one workout this week.")
        return matched[:3]

    # Rule 2: Under-MEV muscle group (pick the most under-volume)
    worst_deficit = 0
    worst_group = ""
    worst_sets = 0
    worst_mev = 0
    for group, mev in MEV_SETS.items():
        current_sets = ctx.sets_by_muscle_group.get(group, 0)
        deficit = mev - current_sets
        if deficit > worst_deficit:
            worst_deficit = deficit
            worst_group = group
            worst_sets = current_sets
            worst_mev = mev
    if worst_group and worst_deficit > 0:
        matched.append(
            f"Increase {worst_group} volume — only {worst_sets} sets this week (MEV is {worst_mev})."
        )

    # Rule 3: High compliance
    if ctx.compliance_pct > 85 and ctx.days_logged_nutrition > 0:
        matched.append(
            f"Great nutrition compliance at {ctx.compliance_pct:.0f}% — keep it up!"
        )

    # Rule 4: Low compliance
    if ctx.compliance_pct < 60 and ctx.days_logged_nutrition > 0:
        matched.append(
            f"Nutrition consistency was {ctx.compliance_pct:.0f}% this week — try prepping meals ahead."
        )

    # Rule 5 & 6: Weight-goal alignment
    if ctx.weight_trend is not None:
        if ctx.goal_type == "cutting":
            if ctx.weight_trend <= 0:
                matched.append(
                    f"Weight trending down {abs(ctx.weight_trend):.1f}kg this week — on track for your cut."
                )
            else:
                matched.append(
                    "Weight trending up during a cut — consider reducing calories by ~200kcal."
                )
        elif ctx.goal_type == "bulking":
            if ctx.weight_trend >= 0:
                matched.append(
                    f"Weight trending up {ctx.weight_trend:.1f}kg this week — on track for your bulk."
                )
            else:
                matched.append(
                    "Weight trending down during a bulk — consider increasing calories by ~200kcal."
                )
        elif ctx.goal_type == "maintaining" and abs(ctx.weight_trend) < 0.3:
            matched.append("Weight stable this week — right on target for maintenance.")

    # Rule 7: PR celebration
    if ctx.prs:
        pr = ctx.prs[0]
        matched.append(f"New PR on {pr.exercise_name} — {pr.new_weight_kg}kg × {pr.reps}!")

    # Ensure 2–3 recommendations
    if len(matched) < 2:
        matched.append(FALLBACK)
    if len(matched) < 2:
        matched.append(FALLBACK)

    return matched[:3]
