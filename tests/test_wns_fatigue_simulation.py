"""Simulation test suite — month-long workout simulations for multiple athlete profiles.

Tests the WNS engine (stimulus/atrophy/HU) and fatigue engine (regression/deload)
against realistic training scenarios to verify correctness of calculations.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from src.modules.training.wns_engine import (
    atrophy_between_sessions,
    diminishing_returns,
    rir_from_rpe,
    stimulating_reps_per_set,
)
from src.modules.training.fatigue_engine import (
    RegressionSignal,
    SessionExerciseData,
    SetData,
    compute_best_e1rm_per_session,
    compute_fatigue_score,
    compute_nutrition_compliance,
    detect_regressions,
    generate_suggestions,
)


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _week_stimulus(
    sessions: list[tuple[date, list[tuple[float, float]]]],
    coefficient: float = 1.0,
) -> tuple[float, float, float]:
    """Compute gross stimulus, total atrophy, and net stimulus for a week.

    sessions: [(date, [(stim_reps, coefficient)])]
    Returns (gross, atrophy, net).
    """
    sessions = sorted(sessions, key=lambda x: x[0])
    gross = 0.0
    for _, sets in sessions:
        weighted = [sr * coefficient for sr, _ in sets]
        gross += diminishing_returns(weighted)

    total_atrophy = 0.0
    for i in range(1, len(sessions)):
        gap = (sessions[i][0] - sessions[i - 1][0]).days
        total_atrophy += atrophy_between_sessions(float(gap))

    if sessions:
        week_end = sessions[0][0] + timedelta(days=6)
        days_since_last = (week_end - sessions[-1][0]).days
        total_atrophy += atrophy_between_sessions(float(days_since_last))

    net = max(0.0, gross - total_atrophy)
    return gross, total_atrophy, net


def _simulate_month(
    weekly_sessions_per_muscle: int,
    sets_per_session: int,
    rpe: float,
    weeks: int = 4,
) -> list[tuple[float, float, float]]:
    """Simulate N weeks of training, return (gross, atrophy, net) per week."""
    rir = rir_from_rpe(rpe)
    stim_reps = stimulating_reps_per_set(10, rir, 0.75)
    results = []
    for week in range(weeks):
        monday = date(2026, 2, 2) + timedelta(weeks=week)
        sessions = []
        if weekly_sessions_per_muscle == 1:
            day = monday
            sets = [(stim_reps, 1.0)] * sets_per_session
            sessions.append((day, sets))
        elif weekly_sessions_per_muscle == 2:
            sessions.append((monday, [(stim_reps, 1.0)] * sets_per_session))
            sessions.append((monday + timedelta(days=3), [(stim_reps, 1.0)] * sets_per_session))
        elif weekly_sessions_per_muscle == 3:
            sessions.append((monday, [(stim_reps, 1.0)] * sets_per_session))
            sessions.append((monday + timedelta(days=2), [(stim_reps, 1.0)] * sets_per_session))
            sessions.append((monday + timedelta(days=4), [(stim_reps, 1.0)] * sets_per_session))
        results.append(_week_stimulus(sessions))
    return results


# ─── Athlete Profiles ─────────────────────────────────────────────────────────


class TestBeginnerProfile:
    """Beginner: 2x/week, 3 sets/session, RPE 7 (RIR 3), moderate loads."""

    def test_monthly_stimulus_is_modest(self):
        results = _simulate_month(weekly_sessions_per_muscle=2, sets_per_session=3, rpe=7.0)
        for gross, atrophy, net in results:
            assert net > 0, "Beginner should have positive net stimulus"
            assert net < 15, "Beginner net stimulus should be modest"

    def test_low_rpe_produces_fewer_stim_reps(self):
        rir = rir_from_rpe(7.0)
        assert rir == 3.0
        stim = stimulating_reps_per_set(10, rir, 0.75)
        assert stim == 2.0, "RPE 7 (RIR 3) should yield only 2 stimulating reps"

    def test_two_sessions_less_atrophy_than_one(self):
        rir = rir_from_rpe(7.0)
        stim = stimulating_reps_per_set(10, rir, 0.75)
        monday = date(2026, 2, 2)

        # 1x/week: 6 sets in one session
        one_session = [(monday, [(stim, 1.0)] * 6)]
        _, atrophy_1x, net_1x = _week_stimulus(one_session)

        # 2x/week: 3 sets each
        two_sessions = [
            (monday, [(stim, 1.0)] * 3),
            (monday + timedelta(days=3), [(stim, 1.0)] * 3),
        ]
        _, atrophy_2x, net_2x = _week_stimulus(two_sessions)

        assert atrophy_2x < atrophy_1x, "2x/week should have less atrophy"
        assert net_2x > net_1x, "2x/week should have higher net stimulus"


class TestIntermediateProfile:
    """Intermediate: 3x/week, 4 sets/session, RPE 8.5 (RIR 1.5), compounds."""

    def test_monthly_stimulus_in_optimal_range(self):
        results = _simulate_month(weekly_sessions_per_muscle=3, sets_per_session=4, rpe=8.5)
        for gross, atrophy, net in results:
            assert net > 5, "Intermediate should exceed MEV"
            assert net < 35, "Intermediate should stay under MRV"

    def test_higher_rpe_more_stim_reps(self):
        rir = rir_from_rpe(8.5)
        assert rir == 1.5
        stim = stimulating_reps_per_set(10, rir, 0.75)
        assert stim == 4.0, "RPE 8.5 (RIR 1.5) → 4 stimulating reps"

    def test_compound_fractional_volume_tracked(self):
        """Bench press should give chest 1.0x and triceps 0.5x."""
        rir = rir_from_rpe(8.5)
        stim = stimulating_reps_per_set(10, rir, 0.75)
        monday = date(2026, 2, 2)

        chest_sets = [(stim, 1.0)] * 4
        _, _, chest_net = _week_stimulus([(monday, chest_sets)])

        # Fractional: each set weighted at 0.5
        triceps_sets = [(stim * 0.5, 1.0)] * 4
        _, _, triceps_net = _week_stimulus([(monday, triceps_sets)])

        assert triceps_net < chest_net, "Fractional volume should be less"
        assert triceps_net > 0, "Triceps should still get some stimulus"

    def test_three_sessions_minimal_atrophy(self):
        results = _simulate_month(weekly_sessions_per_muscle=3, sets_per_session=4, rpe=8.5)
        for gross, atrophy, net in results:
            assert atrophy < gross * 0.15, "3x/week should lose <15% to atrophy"


class TestAdvancedProfile:
    """Advanced: 2x/week, 6 sets/session, RPE 9.5 (RIR 0.5), heavy loads."""

    def test_high_volume_diminishing_returns(self):
        rir = rir_from_rpe(9.5)
        stim = stimulating_reps_per_set(5, rir, 0.88)  # heavy: all reps stimulating
        assert stim == 5.0

        # 6 sets should produce much less than 6x one set
        one_set = diminishing_returns([stim])
        six_sets = diminishing_returns([stim] * 6)
        assert six_sets < one_set * 4, "Diminishing returns should cap growth"

    def test_monthly_stimulus_high_but_bounded(self):
        results = _simulate_month(weekly_sessions_per_muscle=2, sets_per_session=6, rpe=9.5)
        for gross, atrophy, net in results:
            assert net > 10, "Advanced should have high net stimulus"
            assert net < 40, "Even advanced should be bounded"

    def test_heavy_loads_all_reps_stimulating(self):
        stim = stimulating_reps_per_set(5, 0.5, 0.90)
        assert stim == 5.0, "Heavy loads (≥85%) → all reps stimulating"


class TestOvertrainingProfile:
    """Overtrainer: 6x/week, 8 sets/session, RPE 10 (failure every set)."""

    def test_extreme_volume_severe_diminishing_returns(self):
        stim = stimulating_reps_per_set(10, 0.0, 0.75)
        assert stim == 5.0

        # 8 sets in one session
        eight_sets = diminishing_returns([stim] * 8)
        one_set = diminishing_returns([stim])
        ratio = eight_sets / one_set
        assert ratio < 4.0, "8 sets should produce <4x stimulus of 1 set"

    def test_daily_training_minimal_atrophy(self):
        """Training every day means gaps of 1 day — within stimulus duration."""
        atrophy = atrophy_between_sessions(1.0, stimulus_duration_days=2.0)
        assert atrophy == 0.0, "1-day gap within 2-day stimulus → zero atrophy"

    def test_fatigue_score_high_for_overtrainer(self):
        score = compute_fatigue_score(
            muscle_group="chest",
            regressions=[
                RegressionSignal("bench press", "chest", 3, 100.0, 85.0, 15.0),
            ],
            weekly_sets=48,
            mrv_sets=22,
            weekly_frequency=6,
            nutrition_compliance=0.6,
        )
        assert score.score > 65, "Overtrainer should have high fatigue"
        assert score.regression_component > 0, "Should detect regression"
        assert score.volume_component == 1.0, "Volume way over MRV"
        assert score.nutrition_component > 0, "Under-eating adds fatigue"


class TestJunkVolumeProfile:
    """Lifter doing lots of easy sets (RPE 5, RIR 5+)."""

    def test_junk_volume_produces_zero_stimulus(self):
        rir = rir_from_rpe(5.0)
        assert rir == 5.0
        stim = stimulating_reps_per_set(10, rir, 0.75)
        assert stim == 0.0, "RPE 5 (RIR 5) = junk volume = 0 stimulating reps"

    def test_month_of_junk_volume_zero_net(self):
        results = _simulate_month(weekly_sessions_per_muscle=3, sets_per_session=5, rpe=5.0)
        for gross, atrophy, net in results:
            assert gross == 0.0, "All junk volume → zero gross stimulus"
            assert net == 0.0, "Zero stimulus → zero net"


# ─── Fatigue Engine Simulations ───────────────────────────────────────────────


class TestFatigueRegressionDetection:
    """Simulate progressive overload followed by regression."""

    def _build_sessions(
        self, exercise: str, weights: list[float], reps: int = 8
    ) -> list[SessionExerciseData]:
        base = date(2026, 2, 1)
        return [
            SessionExerciseData(
                session_date=base + timedelta(days=i * 3),
                exercise_name=exercise,
                sets=[SetData(reps=reps, weight_kg=w) for _ in range(3)],
            )
            for i, w in enumerate(weights)
        ]

    def test_steady_progress_no_regression(self):
        sessions = self._build_sessions("bench press", [60, 62.5, 65, 67.5, 70])
        e1rm = compute_best_e1rm_per_session(sessions)
        regressions = detect_regressions(e1rm)
        assert len(regressions) == 0, "Steady progress should not trigger regression"

    def test_plateau_no_regression(self):
        sessions = self._build_sessions("bench press", [70, 70, 70, 70, 70])
        e1rm = compute_best_e1rm_per_session(sessions)
        regressions = detect_regressions(e1rm)
        assert len(regressions) == 0, "Plateau is not regression"

    def test_two_session_decline_triggers_regression(self):
        sessions = self._build_sessions("bench press", [70, 72.5, 75, 72.5, 70])
        e1rm = compute_best_e1rm_per_session(sessions)
        regressions = detect_regressions(e1rm, min_consecutive=2)
        assert len(regressions) == 1
        assert regressions[0].consecutive_declines == 2
        assert regressions[0].decline_pct > 0

    def test_three_session_decline_severe_regression(self):
        sessions = self._build_sessions("squat", [100, 105, 100, 95, 90])
        e1rm = compute_best_e1rm_per_session(sessions)
        regressions = detect_regressions(e1rm, min_consecutive=2)
        assert len(regressions) == 1
        assert regressions[0].consecutive_declines == 3
        assert regressions[0].decline_pct > 10

    def test_multiple_exercises_independent_regression(self):
        bench = self._build_sessions("bench press", [80, 82.5, 80, 77.5])
        squat = self._build_sessions("squat", [100, 105, 110, 115])
        e1rm = compute_best_e1rm_per_session(bench + squat)
        regressions = detect_regressions(e1rm, min_consecutive=2)
        regressed = {r.exercise_name for r in regressions}
        assert "bench press" in regressed
        assert "squat" not in regressed


class TestFatigueScoreComposite:
    """Test the composite fatigue score across different scenarios."""

    def test_fresh_lifter_low_fatigue(self):
        score = compute_fatigue_score(
            muscle_group="chest",
            regressions=[],
            weekly_sets=10,
            mrv_sets=22,
            weekly_frequency=2,
            nutrition_compliance=1.0,
        )
        assert score.score < 30, "Fresh lifter should have low fatigue"
        assert score.regression_component == 0.0
        assert score.nutrition_component == 0.0

    def test_undereating_increases_fatigue(self):
        well_fed = compute_fatigue_score(
            "chest",
            [],
            10,
            22,
            2,
            nutrition_compliance=1.0,
        )
        underfed = compute_fatigue_score(
            "chest",
            [],
            10,
            22,
            2,
            nutrition_compliance=0.5,
        )
        assert underfed.score > well_fed.score
        assert underfed.nutrition_component > 0

    def test_over_mrv_high_volume_component(self):
        score = compute_fatigue_score(
            "quads",
            [],
            weekly_sets=25,
            mrv_sets=20,
            weekly_frequency=3,
            nutrition_compliance=1.0,
        )
        assert score.volume_component == 1.0, "Over MRV → volume component maxed"

    def test_deload_suggestion_generated(self):
        regression = RegressionSignal("bench press", "chest", 3, 100.0, 85.0, 15.0)
        score = compute_fatigue_score(
            "chest",
            [regression],
            weekly_sets=22,
            mrv_sets=22,
            weekly_frequency=4,
            nutrition_compliance=0.6,
        )
        suggestions = generate_suggestions([score], [regression])
        if score.score > 70:
            assert len(suggestions) == 1
            assert "deload" in suggestions[0].message.lower()


class TestNutritionCompliance:
    """Test nutrition compliance edge cases."""

    def test_perfect_compliance(self):
        assert compute_nutrition_compliance(2000, 2000) == 1.0

    def test_zero_intake(self):
        assert compute_nutrition_compliance(0, 2000) == 0.0

    def test_overeating_capped(self):
        assert compute_nutrition_compliance(5000, 2000) == 2.0

    def test_zero_target_returns_1(self):
        assert compute_nutrition_compliance(2000, 0) == 1.0

    def test_moderate_deficit(self):
        ratio = compute_nutrition_compliance(1600, 2000)
        assert ratio == pytest.approx(0.8, abs=0.01)


# ─── Cross-System Integration ────────────────────────────────────────────────


class TestWNSFatigueInteraction:
    """Verify WNS stimulus and fatigue engine produce coherent results."""

    def test_high_stimulus_with_regression_flags_fatigue(self):
        """High volume + declining strength = fatigue signal."""
        rir = rir_from_rpe(9.0)
        stim = stimulating_reps_per_set(10, rir, 0.75)
        weekly_stim = diminishing_returns([stim] * 6)
        assert weekly_stim > 5, "Should have meaningful stimulus"

        # But strength is declining
        regression = RegressionSignal("bench press", "chest", 3, 100.0, 88.0, 12.0)
        score = compute_fatigue_score(
            "chest",
            [regression],
            weekly_sets=18,
            mrv_sets=22,
            weekly_frequency=3,
            nutrition_compliance=0.9,
        )
        assert score.score > 30, "Regression + high volume should elevate fatigue"

    def test_low_stimulus_no_regression_low_fatigue(self):
        """Low volume + no regression = low fatigue."""
        rir = rir_from_rpe(8.0)
        stim = stimulating_reps_per_set(10, rir, 0.75)
        weekly_stim = diminishing_returns([stim] * 3)
        assert weekly_stim < 10

        score = compute_fatigue_score(
            "chest",
            [],
            weekly_sets=6,
            mrv_sets=22,
            weekly_frequency=2,
            nutrition_compliance=1.0,
        )
        assert score.score < 25, "Low volume + no regression = low fatigue"

    def test_atrophy_model_consistent_with_frequency(self):
        """Higher frequency → less atrophy → more net stimulus."""
        stim = stimulating_reps_per_set(10, 1.0, 0.75)

        # 1x/week
        monday = date(2026, 2, 2)
        _, atrophy_1x, net_1x = _week_stimulus([(monday, [(stim, 1.0)] * 6)])

        # 3x/week (same total sets)
        _, atrophy_3x, net_3x = _week_stimulus(
            [
                (monday, [(stim, 1.0)] * 2),
                (monday + timedelta(days=2), [(stim, 1.0)] * 2),
                (monday + timedelta(days=4), [(stim, 1.0)] * 2),
            ]
        )

        assert atrophy_3x < atrophy_1x
        assert net_3x > net_1x
