"""Property-based tests for the workout-logging-premium spec.

Property 10: RIR field validation and round-trip.

**Validates: Requirements 7.1, 7.5**
"""

from __future__ import annotations

from hypothesis import given, settings as h_settings, strategies as st
from pydantic import ValidationError
import pytest

from src.modules.training.schemas import SetEntry


# ---------------------------------------------------------------------------
# Shared Hypothesis settings — minimum 100 examples per property
# ---------------------------------------------------------------------------

_prop_settings = h_settings(max_examples=100, deadline=None)


# ---------------------------------------------------------------------------
# Property 10: RIR field validation and round-trip
# ---------------------------------------------------------------------------


class TestProperty10RIRFieldValidation:
    """Property 10: RIR field validation and round-trip.

    For any integer value 0-5, creating a SetEntry with that rir value
    SHALL succeed. For any value outside 0-5, creation SHALL fail
    validation. For any valid SetEntry with rir, serializing to JSON and
    deserializing SHALL produce an equivalent SetEntry.

    **Validates: Requirements 7.1, 7.5**
    """

    @_prop_settings
    @given(rir=st.integers(0, 5))
    def test_valid_rir_values_accepted(self, rir: int) -> None:
        """RIR values 0-5 must be accepted by SetEntry.

        **Validates: Requirements 7.1**
        """
        entry = SetEntry(reps=5, weight_kg=50.0, rir=rir)
        assert entry.rir == rir

    @_prop_settings
    @given(rir=st.integers(-100, -1) | st.integers(6, 100))
    def test_invalid_rir_values_rejected(self, rir: int) -> None:
        """RIR values outside 0-5 must raise ValidationError.

        **Validates: Requirements 7.1**
        """
        with pytest.raises(ValidationError):
            SetEntry(reps=5, weight_kg=50.0, rir=rir)

    @_prop_settings
    @given(rir=st.integers(0, 5))
    def test_rir_json_round_trip(self, rir: int) -> None:
        """Serializing a valid SetEntry to JSON and back produces an equivalent entry.

        **Validates: Requirements 7.5**
        """
        entry = SetEntry(reps=5, weight_kg=50.0, rir=rir)
        json_str = entry.model_dump_json()
        restored = SetEntry.model_validate_json(json_str)

        assert restored.reps == entry.reps
        assert restored.weight_kg == pytest.approx(entry.weight_kg)
        assert restored.rir == entry.rir
        assert restored.rpe == entry.rpe
        assert restored.set_type == entry.set_type

    def test_rir_none_is_default(self) -> None:
        """SetEntry without rir should default to None (backward compat).

        **Validates: Requirements 7.1**
        """
        entry = SetEntry(reps=5, weight_kg=50.0)
        assert entry.rir is None
