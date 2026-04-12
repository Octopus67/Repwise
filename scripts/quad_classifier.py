"""Classify quad exercises into types for biomechanics data generation."""

def classify(exercise_id, name, is_mobility, equipment):
    """Return exercise type: mobility, squat, lunge, leg_press, leg_extension, step_up, plyometric, olympic, cardio, sled, sissy, wall_sit, other."""
    eid = exercise_id.lower()
    n = name.lower()

    if is_mobility:
        return "mobility"

    # Specific types first
    if "leg-extension" in eid or "leg-extensions" in eid:
        return "leg_extension"
    if "leg-press" in eid:
        return "leg_press"
    if "sissy" in eid:
        return "sissy"
    if "wall-sit" in eid:
        return "wall_sit"
    if "step-up" in eid or "step-mill" in eid or "stairmaster" in eid or "power-stairs" in eid:
        return "step_up"

    # Sled/drag
    if any(k in eid for k in ["sled", "drag", "prowler", "yoke"]):
        return "sled"

    # Cardio machines
    if any(k in eid for k in ["treadmill", "jogging", "running", "walking-treadmill", "bicycling", "recumbent", "elliptical", "assault-bike", "rowing-machine", "skating", "trail-running"]):
        return "cardio"

    # Olympic lifts
    if any(k in eid for k in ["snatch", "jerk", "heaving"]):
        return "olympic"

    # Plyometrics
    plyo_keys = ["jump", "hop", "bound", "leap", "sprint", "skip", "hurdle", "cone", "star-jump",
                  "rocket", "scissors", "split-jump", "burpee", "mountain-climber", "butt-kick",
                  "frog-hop", "broad-jump", "box-jump", "box-skip", "knee-tuck", "linear-3-part",
                  "linear-acceleration", "linear-depth", "moving-claw", "stride-jump", "side-hop",
                  "side-to-side-box", "side-standing", "standing-long", "single-cone", "single-leg-hop",
                  "single-leg-lateral-hop", "single-leg-stride", "single-leg-push-off"]
    if any(k in eid for k in plyo_keys):
        return "plyometric"

    # Lunges
    if any(k in eid for k in ["lunge", "curtsy", "split-squat", "bulgarian"]):
        return "lunge"

    # Hack squat
    if "hack" in eid and "squat" in eid:
        return "hack_squat"

    # Squats (catch-all for remaining squat variants)
    if "squat" in eid or "squat" in n.lower():
        return "squat"

    # Hip flexion band
    if "hip-flexion" in eid:
        return "other"

    # Conan's wheel
    if "conan" in eid:
        return "other"

    # Bench sprint
    if "bench-sprint" in eid:
        return "plyometric"

    return "other"
