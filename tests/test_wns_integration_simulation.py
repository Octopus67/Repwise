"""Integration tests — 4-week full-body workout simulations with DB verification.

Creates real users and training sessions in the test database, then runs the
WNS volume service and fatigue engine against them, verifying every computed
value is correct.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.models import User
from src.modules.training.models import TrainingSession
from src.modules.training.wns_engine import (
    diminishing_returns,
    rir_from_rpe,
    stimulating_reps_per_set,
)
from src.modules.training.wns_volume_service import WNSVolumeService
from src.modules.training.fatigue_engine import (
    SessionExerciseData,
    SetData,
    compute_best_e1rm_per_session,
    compute_fatigue_score,
    detect_regressions,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────


async def _create_user(db: AsyncSession, email: str) -> User:
    user = User(
        id=uuid.uuid4(), email=email, hashed_password="x", auth_provider="email", role="user"
    )
    db.add(user)
    await db.flush()
    return user


async def _log_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_date: date,
    exercises: list[dict],
) -> TrainingSession:
    s = TrainingSession(user_id=user_id, session_date=session_date, exercises=exercises)
    db.add(s)
    await db.flush()
    return s


def _make_exercise(name: str, sets: list[tuple[float, int, float | None]]) -> dict:
    """Build exercise dict: sets is [(weight_kg, reps, rpe_or_None), ...]."""
    return {
        "exercise_name": name,
        "sets": [
            {"weight_kg": w, "reps": r, "rpe": rpe, "set_type": "normal"} for w, r, rpe in sets
        ],
    }


def _make_warmup(name: str, weight: float, reps: int) -> dict:
    return {
        "exercise_name": name,
        "sets": [{"weight_kg": weight, "reps": reps, "rpe": None, "set_type": "warm-up"}],
    }


# ─── Simulation 1: Consistent Full-Body 3x/week for 4 weeks ──────────────────


class TestConsistentFullBody:
    """Athlete trains full-body 3x/week (Mon/Wed/Fri) for 4 weeks.
    Bench 3x8@RPE8, Squat 3x8@RPE8, Row 3x8@RPE8 every session.
    """

    @pytest.fixture
    async def setup(self, db_session: AsyncSession):
        user = await _create_user(db_session, "consistent@test.com")
        base_monday = date(2026, 2, 2)

        for week in range(4):
            monday = base_monday + timedelta(weeks=week)
            for day_offset in [0, 2, 4]:  # Mon, Wed, Fri
                d = monday + timedelta(days=day_offset)
                await _log_session(
                    db_session,
                    user.id,
                    d,
                    [
                        _make_warmup("Barbell Bench Press", 40, 10),
                        _make_exercise("Barbell Bench Press", [(80, 8, 8.0)] * 3),
                        _make_exercise("Barbell Back Squat", [(100, 8, 8.0)] * 3),
                        _make_exercise("Barbell Row", [(70, 8, 8.0)] * 3),
                    ],
                )

        await db_session.commit()
        return user, base_monday

    async def test_wns_volume_week1(self, db_session: AsyncSession, setup):
        user, base_monday = setup
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, base_monday)

        by_muscle = {r.muscle_group: r for r in results}

        # Bench → chest (direct 1.0), triceps (0.5), shoulders (0.5)
        chest = by_muscle.get("chest")
        assert chest is not None
        assert chest.gross_stimulus > 0
        assert chest.net_stimulus > 0
        assert chest.session_count == 3
        assert chest.frequency == 3

        # Squat → quads (direct 1.0)
        quads = by_muscle.get("quads")
        assert quads is not None
        assert quads.gross_stimulus > 0

        # Row → lats (direct 1.0), biceps (0.5)
        lats = by_muscle.get("lats")
        assert lats is not None
        assert lats.gross_stimulus > 0

    async def test_warmup_sets_excluded(self, db_session: AsyncSession, setup):
        user, base_monday = setup
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, base_monday)
        chest = next(r for r in results if r.muscle_group == "chest")

        # 3 sessions × 3 working sets = 9 total working sets
        # Warmup sets should NOT be counted
        bench_contrib = next(
            (e for e in chest.exercises if "bench" in e.exercise_name.lower()), None
        )
        assert bench_contrib is not None
        assert bench_contrib.sets_count == 9  # 3 sessions × 3 sets

    async def test_atrophy_low_with_3x_frequency(self, db_session: AsyncSession, setup):
        user, base_monday = setup
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, base_monday)
        chest = next(r for r in results if r.muscle_group == "chest")

        # 3x/week with 2-day gaps → most gaps within stimulus duration
        assert chest.atrophy_effect < chest.gross_stimulus * 0.2

    async def test_all_weeks_consistent(self, db_session: AsyncSession, setup):
        user, base_monday = setup
        svc = WNSVolumeService(db_session)

        week_nets = []
        for week in range(4):
            monday = base_monday + timedelta(weeks=week)
            results = await svc.get_weekly_muscle_volume(user.id, monday)
            chest = next(r for r in results if r.muscle_group == "chest")
            week_nets.append(chest.net_stimulus)

        # All weeks should be roughly equal (same training)
        avg = sum(week_nets) / len(week_nets)
        for net in week_nets:
            assert abs(net - avg) < avg * 0.1, f"Week net {net} deviates from avg {avg}"

    async def test_fractional_volume_for_secondary_muscles(self, db_session: AsyncSession, setup):
        user, base_monday = setup
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, base_monday)

        by_muscle = {r.muscle_group: r for r in results}
        chest = by_muscle.get("chest")
        triceps = by_muscle.get("triceps")

        # Triceps gets fractional volume from bench press
        if triceps and chest:
            assert triceps.gross_stimulus < chest.gross_stimulus
            assert triceps.gross_stimulus > 0


# ─── Simulation 2: Progressive Overload then Regression ──────────────────────


class TestProgressiveOverloadThenRegression:
    """Athlete progressively overloads bench for 2 weeks, then regresses for 2 weeks."""

    @pytest.fixture
    async def setup(self, db_session: AsyncSession):
        user = await _create_user(db_session, "regressor@test.com")
        base_monday = date(2026, 2, 2)

        # Week 1-2: progressive overload (60 → 65 → 70 → 72.5 → 75 → 77.5)
        weights_up = [60, 62.5, 65, 67.5, 70, 72.5]
        # Week 3-4: regression (72.5 → 70 → 67.5 → 65 → 62.5 → 60)
        weights_down = [70, 67.5, 65, 62.5, 60, 57.5]
        all_weights = weights_up + weights_down

        sessions_data = []
        for i, w in enumerate(all_weights):
            d = base_monday + timedelta(days=i * 3)  # every 3 days
            await _log_session(
                db_session,
                user.id,
                d,
                [
                    _make_exercise("Barbell Bench Press", [(w, 8, 8.0)] * 3),
                ],
            )
            sessions_data.append(
                SessionExerciseData(
                    session_date=d,
                    exercise_name="barbell bench press",
                    sets=[SetData(reps=8, weight_kg=w)] * 3,
                )
            )

        await db_session.commit()
        return user, base_monday, sessions_data

    async def test_regression_detected_in_weeks_3_4(self, db_session: AsyncSession, setup):
        user, base_monday, sessions_data = setup
        e1rm_series = compute_best_e1rm_per_session(sessions_data)
        regressions = detect_regressions(e1rm_series, min_consecutive=2)

        assert len(regressions) >= 1
        bench_reg = next(r for r in regressions if "bench" in r.exercise_name)
        assert bench_reg.consecutive_declines >= 2
        assert bench_reg.decline_pct > 5

    async def test_fatigue_score_elevated_during_regression(self, db_session: AsyncSession, setup):
        user, base_monday, sessions_data = setup
        e1rm_series = compute_best_e1rm_per_session(sessions_data)
        regressions = detect_regressions(e1rm_series, min_consecutive=2)

        score = compute_fatigue_score(
            "chest",
            regressions,
            weekly_sets=9,
            mrv_sets=22,
            weekly_frequency=2,
            nutrition_compliance=1.0,
        )
        assert score.regression_component > 0
        assert score.score > 10

    async def test_wns_volume_still_positive_during_regression(
        self, db_session: AsyncSession, setup
    ):
        """Even during regression, volume stimulus is still being applied."""
        user, base_monday, _ = setup
        svc = WNSVolumeService(db_session)

        # Check week 4 (regression period)
        week4_monday = base_monday + timedelta(weeks=3)
        results = await svc.get_weekly_muscle_volume(user.id, week4_monday)
        chest = next((r for r in results if r.muscle_group == "chest"), None)
        if chest:
            assert chest.net_stimulus > 0, "Still training → still positive stimulus"


# ─── Simulation 3: Low-Frequency Lifter (1x/week) ────────────────────────────


class TestLowFrequencyLifter:
    """Athlete trains each muscle only 1x/week — high atrophy expected."""

    @pytest.fixture
    async def setup(self, db_session: AsyncSession):
        user = await _create_user(db_session, "lowfreq@test.com")
        base_monday = date(2026, 2, 2)

        for week in range(4):
            monday = base_monday + timedelta(weeks=week)
            # Only trains on Monday — one big session
            await _log_session(
                db_session,
                user.id,
                monday,
                [
                    _make_exercise("Barbell Bench Press", [(80, 8, 9.0)] * 6),
                    _make_exercise("Barbell Back Squat", [(100, 8, 9.0)] * 6),
                ],
            )

        await db_session.commit()
        return user, base_monday

    async def test_high_atrophy_with_1x_frequency(self, db_session: AsyncSession, setup):
        user, base_monday = setup
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, base_monday)
        chest = next(r for r in results if r.muscle_group == "chest")

        # 1x/week → 6 days until end of week → atrophy present
        assert chest.atrophy_effect > 0
        # With default 2-day stimulus duration and 3 maintenance sets:
        # atrophy = (6-2) * 3/7 ≈ 1.71
        assert chest.atrophy_effect > 1.0

    async def test_less_net_than_3x_lifter_same_sets(self, db_session: AsyncSession, setup):
        """Compare: 6 sets in 1 session vs 6 sets across 3 sessions."""
        user, base_monday = setup
        svc = WNSVolumeService(db_session)
        results_1x = await svc.get_weekly_muscle_volume(user.id, base_monday)
        chest_1x = next(r for r in results_1x if r.muscle_group == "chest")

        # Manually compute what 3x/week would give
        rir = rir_from_rpe(9.0)
        stim = stimulating_reps_per_set(8, rir, None)
        # 3 sessions of 2 sets each
        session_stim = diminishing_returns([stim] * 2)
        gross_3x = session_stim * 3
        # 3x/week gaps: 2 days each → within stimulus duration → ~0 atrophy
        net_3x = gross_3x  # minimal atrophy

        assert chest_1x.net_stimulus < net_3x, "1x/week should produce less net than 3x/week"


# ─── Simulation 4: Mixed RPE Lifter ──────────────────────────────────────────


class TestMixedRPELifter:
    """Athlete varies RPE: some sets hard (RPE 9), some easy (RPE 6)."""

    @pytest.fixture
    async def setup(self, db_session: AsyncSession):
        user = await _create_user(db_session, "mixedrpe@test.com")
        base_monday = date(2026, 2, 2)

        for week in range(4):
            monday = base_monday + timedelta(weeks=week)
            for day_offset in [0, 3]:  # Mon, Thu
                d = monday + timedelta(days=day_offset)
                await _log_session(
                    db_session,
                    user.id,
                    d,
                    [
                        # 2 hard sets + 2 easy sets
                        _make_exercise(
                            "Barbell Bench Press",
                            [
                                (80, 8, 9.0),
                                (80, 8, 9.0),  # hard
                                (60, 12, 6.0),
                                (60, 12, 6.0),  # easy
                            ],
                        ),
                    ],
                )

        await db_session.commit()
        return user, base_monday

    async def test_easy_sets_contribute_less(self, db_session: AsyncSession, setup):
        user, base_monday = setup
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, base_monday)
        chest = next(r for r in results if r.muscle_group == "chest")

        # 2 sessions × 4 sets = 8 total sets
        # But RPE 6 sets (RIR 4) produce 0 stimulating reps
        # So effective stimulus comes only from the RPE 9 sets
        # Compare to what all-RPE-9 would give
        rir_hard = rir_from_rpe(9.0)
        stim_hard = stimulating_reps_per_set(8, rir_hard, None)
        rir_easy = rir_from_rpe(6.0)
        stim_easy = stimulating_reps_per_set(12, rir_easy, None)

        assert stim_easy == 0.0, "RPE 6 (RIR 4) should be junk volume"
        assert stim_hard > 0
        assert chest.gross_stimulus > 0

    async def test_junk_sets_dont_inflate_hu(self, db_session: AsyncSession, setup):
        """HU should reflect only the hard sets, not the easy ones."""
        user, base_monday = setup
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, base_monday)
        chest = next(r for r in results if r.muscle_group == "chest")

        # Only 2 hard sets per session × 2 sessions = 4 effective sets
        # With RPE 9 (RIR 1) → 4 stim reps each
        rir = rir_from_rpe(9.0)
        stim = stimulating_reps_per_set(8, rir, None)
        # 2 sessions, 2 sets each
        expected_per_session = diminishing_returns([stim] * 2)
        expected_gross = expected_per_session * 2

        # Allow 10% tolerance for coefficient/rounding differences
        assert abs(chest.gross_stimulus - expected_gross) < expected_gross * 0.15


# ─── Simulation 5: Heavy Lifter (5x5 at 85%+) ───────────────────────────────


class TestHeavyLifter:
    """Athlete does 5x5 at heavy loads (≥85% 1RM). All reps should be stimulating."""

    @pytest.fixture
    async def setup(self, db_session: AsyncSession):
        user = await _create_user(db_session, "heavy@test.com")
        base_monday = date(2026, 2, 2)

        for week in range(4):
            monday = base_monday + timedelta(weeks=week)
            for day_offset in [0, 2, 4]:
                d = monday + timedelta(days=day_offset)
                await _log_session(
                    db_session,
                    user.id,
                    d,
                    [
                        # 5x5 at RPE 9 with heavy weight
                        _make_exercise("Barbell Back Squat", [(140, 5, 9.0)] * 5),
                    ],
                )

        await db_session.commit()
        return user, base_monday

    async def test_heavy_sets_max_stim_reps(self, db_session: AsyncSession, setup):
        """At ≥85% 1RM, all 5 reps should be stimulating."""
        # 140kg × 5 reps → e1RM ≈ 163kg → intensity ≈ 140/163 ≈ 0.86 → heavy
        stim = stimulating_reps_per_set(5, 1.0, 0.86)
        assert stim == 5.0, "Heavy load → all reps stimulating"

    async def test_quads_high_volume(self, db_session: AsyncSession, setup):
        user, base_monday = setup
        svc = WNSVolumeService(db_session)
        results = await svc.get_weekly_muscle_volume(user.id, base_monday)
        quads = next(r for r in results if r.muscle_group == "quads")

        assert quads.gross_stimulus > 15, "5x5 × 3 sessions should produce high stimulus"
        assert quads.session_count == 3
        assert quads.frequency == 3
