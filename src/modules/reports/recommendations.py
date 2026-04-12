"""Rule-based recommendation engine — pure function, no DB access."""

from __future__ import annotations

from src.modules.reports.mev_reference import MEV_SETS
from src.modules.reports.schemas import ReportContext

FALLBACK = "Keep logging consistently — more data means better insights."


def generate_recommendations(ctx: ReportContext) -> list[str]:
    """Return 3–5 actionable, specific recommendations based on weekly metrics."""
    matched: list[str] = []

    # Rule 1: No data at all
    if ctx.days_logged_training == 0 and ctx.days_logged_nutrition == 0:
        matched.append(
            "Start logging your meals and workouts — even one entry helps build your baseline."
        )
        matched.append(
            "Consistency is key. Try logging at least one meal and one workout this week."
        )
        return matched[:5]

    # Rule 2: Progressive overload — week-over-week volume comparison
    if ctx.prev_sets_by_muscle_group and ctx.sets_by_muscle_group:
        total_curr = sum(ctx.sets_by_muscle_group.values())
        total_prev = sum(ctx.prev_sets_by_muscle_group.values())
        if total_prev > 0:
            pct_change = ((total_curr - total_prev) / total_prev) * 100
            if pct_change > 10:
                matched.append(
                    f"Total volume up {pct_change:.0f}% vs last week ({total_curr} vs {total_prev} sets) "
                    f"— great progressive overload. Monitor recovery."
                )
            elif pct_change < -20:
                matched.append(
                    f"Total volume dropped {abs(pct_change):.0f}% vs last week ({total_curr} vs {total_prev} sets). "
                    f"If intentional (deload), great. Otherwise, aim to match last week's volume."
                )

    # Rule 3: Session frequency comparison
    if ctx.prev_session_count > 0 and ctx.session_count < ctx.prev_session_count:
        diff = ctx.prev_session_count - ctx.session_count
        matched.append(
            f"You trained {ctx.session_count}x this week vs {ctx.prev_session_count}x last week "
            f"({diff} fewer session{'s' if diff > 1 else ''}). Try to stay consistent."
        )

    # Rule 4: WNS-based volume insight with specific numbers
    if ctx.wns_hypertrophy_units:
        best_mg = max(ctx.wns_hypertrophy_units, key=ctx.wns_hypertrophy_units.get)  # type: ignore[arg-type]
        best_hu = ctx.wns_hypertrophy_units[best_mg]
        neglected = [
            mg for mg in MEV_SETS if ctx.wns_hypertrophy_units.get(mg, 0) == 0 and MEV_SETS[mg] >= 6
        ]
        if neglected:
            mg = neglected[0]
            matched.append(
                f"{mg.title()} had 0 stimulus this week (MEV is {MEV_SETS[mg]} sets). "
                f"Add {MEV_SETS[mg]} sets next week to prevent regression."
            )
        if best_hu > 0:
            matched.append(
                f"Strongest stimulus: {best_mg.title()} at {best_hu:.1f} HU — keep this volume to maintain gains."
            )
    else:
        # Fallback to set-based MEV check with specific deficit numbers
        deficits: list[tuple[str, int, int, int]] = []
        for group, mev in MEV_SETS.items():
            current = ctx.sets_by_muscle_group.get(group, 0)
            deficit = mev - current
            if deficit > 0:
                deficits.append((group, current, mev, deficit))
        deficits.sort(key=lambda x: x[3], reverse=True)
        if deficits:
            g, curr, mev, deficit = deficits[0]
            matched.append(
                f"Increase {g} volume — only {curr} sets this week, "
                f"{deficit} below MEV ({mev}). Add {deficit} more sets next week."
            )

    # Rule 5: Calorie target adherence with specific numbers
    if ctx.days_logged_nutrition > 0 and ctx.target_calories > 0:
        diff = ctx.avg_calories - ctx.target_calories
        if abs(diff) > 200:
            direction = "over" if diff > 0 else "under"
            matched.append(
                f"Averaging {ctx.avg_calories:.0f} kcal/day — {abs(diff):.0f} kcal {direction} "
                f"your {ctx.target_calories:.0f} target. "
                f"{'Reduce portions slightly.' if diff > 0 else 'Add a snack or increase portions.'}"
            )
        elif ctx.compliance_pct > 80:
            matched.append(
                f"Nutrition on point: {ctx.avg_calories:.0f} kcal/day avg, "
                f"{ctx.compliance_pct:.0f}% compliance."
            )

    # Rule 5b: Low compliance warning
    if ctx.days_logged_nutrition > 0 and ctx.compliance_pct < 50:
        matched.append(
            f"Nutrition compliance was {ctx.compliance_pct:.0f}% this week — "
            f"try prep meals on Sunday for better consistency."
        )

    # Rule 6: Micronutrient score with actionable advice
    if ctx.nutrient_score is not None:
        if ctx.nutrient_score >= 80:
            matched.append(
                f"Micronutrient score: {ctx.nutrient_score:.0f}/100 — excellent coverage."
            )
        elif ctx.nutrient_score >= 50:
            matched.append(
                f"Micronutrient score: {ctx.nutrient_score:.0f}/100 — "
                f"check your Micronutrient Dashboard for specific gaps to address."
            )
        elif ctx.nutrient_score > 0:
            matched.append(
                f"Micronutrient score: {ctx.nutrient_score:.0f}/100 — "
                f"consider adding more vegetables and varied protein sources."
            )

    # Rule 7: Weight-goal alignment with rate context
    if ctx.weight_trend is not None:
        target_rate = ctx.goal_rate_per_week or 0
        if ctx.goal_type == "cutting":
            if ctx.weight_trend > 0.1:
                matched.append(
                    f"Weight up {ctx.weight_trend:.1f}kg this week during a cut "
                    f"(target: {target_rate:.1f}kg/wk). Consider reducing intake by ~200 kcal."
                )
            elif ctx.weight_trend <= 0:
                matched.append(
                    f"Down {abs(ctx.weight_trend):.1f}kg this week — on track for your cut."
                )
        elif ctx.goal_type == "bulking":
            if ctx.weight_trend < -0.1:
                matched.append(
                    f"Weight down {abs(ctx.weight_trend):.1f}kg during a bulk. "
                    f"Increase intake by ~200 kcal to support muscle growth."
                )
            elif ctx.weight_trend > 0.5:
                matched.append(
                    f"Up {ctx.weight_trend:.1f}kg this week — gaining faster than "
                    f"{target_rate:.1f}kg/wk target. Slight surplus reduction may limit fat gain."
                )
            elif ctx.weight_trend >= 0:
                matched.append(
                    f"Up {ctx.weight_trend:.1f}kg this week — on track for your lean bulk."
                )
        elif ctx.goal_type == "maintaining" and abs(ctx.weight_trend) < 0.3:
            matched.append("Weight stable this week — right on target for maintenance.")

    # Rule 8: PR celebration
    if ctx.prs:
        pr = ctx.prs[0]
        matched.append(
            f"New PR: {pr.exercise_name} — {pr.new_weight_kg}kg × {pr.reps}! "
            f"Progressive overload is working."
        )

    # Rule 9: Logging consistency
    if ctx.days_logged_nutrition > 0 and ctx.days_logged_nutrition < 4:
        matched.append(
            f"Only {ctx.days_logged_nutrition} day{'s' if ctx.days_logged_nutrition > 1 else ''} "
            f"of nutrition logged. Aim for 5+ days for accurate weekly insights."
        )

    # Ensure at least 2 recommendations
    if len(matched) < 2:
        matched.append(FALLBACK)

    return matched[:5]
