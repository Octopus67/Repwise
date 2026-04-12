"""Biomechanics attribute templates per exercise type (Beardsley methodology)."""

# strength_curve, loading_position, stretch_hypertrophy_potential, stimulus_to_fatigue, fatigue_rating
ATTRS = {
    "squat":        ("ascending", "stretched", "high", "moderate", "high"),
    "lunge":        ("ascending", "stretched", "high", "good", "moderate"),
    "leg_press":    ("ascending", "stretched", "high", "good", "moderate"),
    "leg_extension":("bell_shaped", "mid_range", "moderate", "excellent", "low"),
    "hack_squat":   ("ascending", "stretched", "high", "excellent", "moderate"),
    "step_up":      ("bell_shaped", "mid_range", "moderate", "good", "moderate"),
    "sissy":        ("descending", "stretched", "high", "good", "moderate"),
    "wall_sit":     ("flat", "mid_range", "low", "moderate", "moderate"),
    "plyometric":   ("bell_shaped", "mid_range", "low", "poor", "high"),
    "olympic":      ("ascending", "stretched", "low", "poor", "high"),
    "cardio":       ("flat", "mid_range", "none", "poor", "moderate"),
    "sled":         ("flat", "mid_range", "low", "moderate", "high"),
    "mobility":     ("flat", "stretched", "none", "excellent", "low"),
    "other":        ("bell_shaped", "mid_range", "low", "moderate", "moderate"),
}

# Per-type overrides for specific exercises
OVERRIDES = {
    # Band squats have ascending curve amplified by band
    "squat-with-bands": {"strength_curve": "ascending"},
    "squats-with-bands": {"strength_curve": "ascending"},
    "box-squat-with-bands": {"strength_curve": "ascending"},
    # Box squats limit ROM
    "box-squat": {"stretch_hypertrophy_potential": "moderate"},
    "box-squat-with-bands": {"stretch_hypertrophy_potential": "moderate"},
    "box-squat-with-chains": {"stretch_hypertrophy_potential": "moderate"},
    "reverse-band-box-squat": {"stretch_hypertrophy_potential": "moderate"},
    "speed-box-squat": {"stretch_hypertrophy_potential": "moderate"},
    # Partial/speed squats
    "speed-squats": {"stretch_hypertrophy_potential": "moderate", "stimulus_to_fatigue": "moderate"},
    "barbell-squat-to-a-bench": {"stretch_hypertrophy_potential": "moderate"},
    "dumbbell-squat-to-a-bench": {"stretch_hypertrophy_potential": "moderate"},
    "front-barbell-squat-to-a-bench": {"stretch_hypertrophy_potential": "moderate"},
    "sit-squats": {"stretch_hypertrophy_potential": "moderate", "strength_curve": "ascending"},
    "chair-squat": {"stretch_hypertrophy_potential": "moderate"},
    # Front squats - slightly better quad focus
    "barbell-front-squat": {"stimulus_to_fatigue": "good"},
    "front-barbell-squat": {"stimulus_to_fatigue": "good"},
    "front-squat-clean-grip": {"stimulus_to_fatigue": "good"},
    "front-squats-with-two-kettlebells": {"stimulus_to_fatigue": "good"},
    "frankenstein-squat": {"stimulus_to_fatigue": "good"},
    # Cyclist squat - elevated heels, quad dominant
    "cyclist-squat": {"stimulus_to_fatigue": "good", "stretch_hypertrophy_potential": "high"},
    # Pendulum squat - machine supported
    "pendulum-squat": {"stimulus_to_fatigue": "excellent", "stretch_hypertrophy_potential": "high", "fatigue_rating": "moderate"},
    # Belt squat - no spinal loading
    "belt-squat": {"stimulus_to_fatigue": "good", "fatigue_rating": "moderate"},
    # Spanish squat - band-assisted, rehab friendly
    "spanish-squat": {"stimulus_to_fatigue": "good", "fatigue_rating": "low", "strength_curve": "ascending"},
    # Pistol squats
    "pistol-squat": {"stimulus_to_fatigue": "moderate", "fatigue_rating": "moderate"},
    "kettlebell-pistol-squat": {"stimulus_to_fatigue": "moderate", "fatigue_rating": "moderate"},
    "smith-machine-pistol-squat": {"stimulus_to_fatigue": "good", "fatigue_rating": "moderate"},
    # Smith machine
    "smith-machine-squat": {"stimulus_to_fatigue": "good", "fatigue_rating": "moderate"},
    "smith-machine-leg-press": {"stimulus_to_fatigue": "good"},
    # Lying machine squat
    "lying-machine-squat": {"stimulus_to_fatigue": "good", "fatigue_rating": "moderate"},
    # Landmine squat
    "landmine-squat": {"stimulus_to_fatigue": "good", "fatigue_rating": "moderate"},
    # Weighted sissy squat
    "weighted-sissy-squat": {"fatigue_rating": "moderate"},
    # Single leg press
    "single-leg-press": {"stimulus_to_fatigue": "good"},
    # Narrow stance variants - more quad emphasis
    "narrow-stance-hack-squats": {"stimulus_to_fatigue": "excellent"},
    "narrow-stance-leg-press": {"stimulus_to_fatigue": "good"},
    "narrow-stance-squats": {"stimulus_to_fatigue": "moderate"},
    "hack-squat-narrow-stance": {"stimulus_to_fatigue": "excellent"},
    # Leg press wide - more adductor
    "leg-press-wide-stance": {"stretch_hypertrophy_potential": "moderate"},
    # Single leg extension
    "single-leg-extension": {"stimulus_to_fatigue": "excellent"},
    "single-leg-leg-extension": {"stimulus_to_fatigue": "excellent"},
    # Dumbbell squats - lighter load
    "dumbbell-squat": {"fatigue_rating": "moderate", "stimulus_to_fatigue": "good"},
    "goblet-squat": {"fatigue_rating": "moderate", "stimulus_to_fatigue": "good"},
    "kettlebell-goblet-squat": {"fatigue_rating": "moderate", "stimulus_to_fatigue": "good"},
    "plie-dumbbell-squat": {"fatigue_rating": "moderate", "stimulus_to_fatigue": "good"},
    # Bodyweight squat
    "bodyweight-squat": {"fatigue_rating": "low", "stimulus_to_fatigue": "good"},
    "weighted-squat": {"fatigue_rating": "moderate"},
    # Freehand jump squat
    "freehand-jump-squat": {"stretch_hypertrophy_potential": "low"},
    "weighted-jump-squat": {"stretch_hypertrophy_potential": "low"},
    "jump-squat": {"stretch_hypertrophy_potential": "low"},
    # Burpee
    "burpee": {"stretch_hypertrophy_potential": "none"},
    # Mountain climbers
    "mountain-climbers": {"stretch_hypertrophy_potential": "none"},
    # Hip flexion with band
    "hip-flexion-with-band": {"strength_curve": "ascending", "loading_position": "shortened", "stretch_hypertrophy_potential": "none", "stimulus_to_fatigue": "moderate", "fatigue_rating": "low"},
}
