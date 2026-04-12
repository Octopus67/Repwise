"""Beardsley-based biomechanics data for lat exercises."""

# Biomechanics defaults by classification type
TYPE_DEFAULTS = {
    'barbell_row': {
        'strength_curve': 'bell_shaped',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'moderate',
        'fatigue_rating': 'high',
    },
    'dumbbell_row': {
        'strength_curve': 'bell_shaped',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'good',
        'fatigue_rating': 'moderate',
    },
    'cable_row': {
        'strength_curve': 'flat',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'excellent',
        'fatigue_rating': 'low',
    },
    'machine_row': {
        'strength_curve': 'flat',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'good',
        'fatigue_rating': 'low',
    },
    'chest_supported_row': {
        'strength_curve': 'bell_shaped',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'excellent',
        'fatigue_rating': 'low',
    },
    'tbar_row': {
        'strength_curve': 'bell_shaped',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'moderate',
        'fatigue_rating': 'high',
    },
    'pulldown': {
        'strength_curve': 'bell_shaped',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'good',
        'fatigue_rating': 'low',
    },
    'pullup': {
        'strength_curve': 'ascending',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'good',
        'fatigue_rating': 'moderate',
    },
    'straight_arm': {
        'strength_curve': 'bell_shaped',
        'loading_position': 'shortened',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'excellent',
        'fatigue_rating': 'low',
    },
    'inverted_row': {
        'strength_curve': 'bell_shaped',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'good',
        'fatigue_rating': 'low',
    },
    'band_row': {
        'strength_curve': 'ascending',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'good',
        'fatigue_rating': 'low',
    },
    'renegade_row': {
        'strength_curve': 'bell_shaped',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'moderate',
        'fatigue_rating': 'moderate',
    },
    'mobility': {
        'strength_curve': 'none',
        'loading_position': 'none',
        'stretch_hypertrophy_potential': 'none',
        'stimulus_to_fatigue': 'none',
        'fatigue_rating': 'none',
    },
    'other': {
        'strength_curve': 'bell_shaped',
        'loading_position': 'mid_range',
        'stretch_hypertrophy_potential': 'low',
        'stimulus_to_fatigue': 'moderate',
        'fatigue_rating': 'moderate',
    },
}

# Per-exercise content: description, tips, coaching_cues
# Keyed by exercise ID
EXERCISE_CONTENT = {
    # === BARBELL ROWS ===
    'barbell-row': {
        'description': 'A bilateral horizontal pull where the barbell is rowed from a hip-hinged position. The lats have their best leverage at mid-range shoulder extension angles, making this a strong lat builder. Significant erector spinae demand due to the unsupported torso.',
        'tips': ['Hinge at the hips to roughly 45 degrees — this places the lats in their strongest leverage zone', 'Pull to the lower ribcage to maximize lat fiber recruitment over upper back', 'Avoid excessive torso rise — momentum shifts load away from the lats at mid-range', 'Use straps if grip limits lat loading'],
        'coaching_cues': ['Hinge and hold', 'Pull to the hip crease', 'Squeeze at mid-pull'],
    },
    'bent-over-barbell-row': {
        'description': 'A standard bent-over row with an overhand grip. The lats are maximally loaded at mid-range shoulder extension where their moment arm is greatest. The bent-over position creates substantial spinal erector fatigue.',
        'tips': ['Maintain a rigid torso angle throughout — do not rise up as you pull', 'Pull the bar toward the lower chest or upper abdomen', 'Control the eccentric for 2 seconds to keep tension through the lat mid-range', 'Overhand grip biases the lower lat fibers slightly more than underhand'],
        'coaching_cues': ['Chest over the bar', 'Elbows drive back', 'Hold the squeeze'],
    },
    'bent-over-one-arm-long-bar-row': {
        'description': 'A unilateral landmine-style row performed bent over. The arc of the barbell creates peak resistance at mid-range, aligning well with where the lats have their best mechanical advantage.',
        'tips': ['Stagger your stance for balance with the working side foot back', 'Pull toward the hip to bias the lat over the upper back', 'The landmine arc naturally loads mid-range — lean into this by pausing at peak contraction', 'Keep the non-working hand braced on your knee'],
        'coaching_cues': ['Pull to the hip', 'Brace the core', 'Squeeze at the top'],
    },
    'bent-over-two-arm-long-bar-row': {
        'description': 'A bilateral landmine row using a close neutral grip. The converging bar path and close grip emphasize the thoracic (upper) lat region. Peak lat loading occurs at mid-range shoulder extension.',
        'tips': ['Use a V-handle for a neutral grip to bias the upper lat fibers', 'Stand far enough from the pivot to maintain tension at the start', 'Pull to the sternum or upper abdomen', 'Avoid jerking — the landmine rewards controlled reps'],
        'coaching_cues': ['Chest over the bar', 'Drive elbows past the torso', 'Control the lower'],
    },
    'pendlay-row': {
        'description': 'A dead-stop barbell row from the floor with a parallel torso. Each rep starts from a dead stop, eliminating the stretch-shortening cycle. The lats are loaded hardest at mid-pull where their moment arm peaks.',
        'tips': ['Reset fully on the floor each rep — no bouncing', 'Keep your torso parallel to the floor throughout', 'Explode concentrically but the lat stimulus comes from the mid-range portion', 'Grip width at or slightly wider than shoulder width'],
        'coaching_cues': ['Dead stop, explode up', 'Flat back', 'Elbows to ceiling'],
    },
    'reverse-grip-barbell-row': {
        'description': 'A barbell row with a supinated (underhand) grip. The supinated grip increases biceps involvement and allows slightly more shoulder extension range, but the lats are still maximally loaded at mid-range angles.',
        'tips': ['Supinated grip allows a longer effective ROM for the lats', 'Pull to the lower abdomen to maximize lat contribution', 'The biceps will fatigue before the lats — use straps if needed', 'Keep elbows tight to the body'],
        'coaching_cues': ['Palms up, pull low', 'Elbows tight', 'Squeeze the lats'],
    },
    'reverse-grip-bent-over-rows': {
        'description': 'A bent-over row variation with underhand grip emphasizing lat recruitment through a slightly greater shoulder extension range. The lats peak force output remains at mid-range shoulder angles regardless of grip.',
        'tips': ['Underhand grip allows elbows to travel further behind the torso', 'Pull toward the navel for maximum lat bias', 'Maintain the hip hinge — do not stand up during the pull', 'Moderate loads work best as biceps are the weak link'],
        'coaching_cues': ['Underhand grip, elbows back', 'Stay hinged', 'Pull to the belt'],
    },
    'meadows-row': {
        'description': 'A unilateral landmine row performed perpendicular to the bar with an overhand grip. Named after John Meadows. The unique angle creates strong mid-range lat loading with a pronounced stretch at the bottom, though lat leverage remains best at mid-pull.',
        'tips': ['Stand perpendicular to the barbell with a staggered stance', 'Use an overhand grip on the fat end of the bar', 'Pull in an arc toward the hip — not straight up', 'The stretch at the bottom feels deep but lat force production peaks at mid-range'],
        'coaching_cues': ['Arc toward the hip', 'Stagger stance', 'Squeeze and hold'],
    },
    'one-arm-long-bar-row': {
        'description': 'A unilateral landmine row allowing independent lat training. The arc path of the landmine naturally creates peak resistance at mid-range, matching the lats strongest leverage angle.',
        'tips': ['Brace your free hand on your knee for stability', 'Pull the bar toward your hip, not your chest', 'Control the eccentric to maintain mid-range tension', 'Use a neutral or overhand grip based on comfort'],
        'coaching_cues': ['Pull to the hip', 'Stay braced', 'Slow lower'],
    },
    # === DUMBBELL ROWS ===
    'dumbbell-row': {
        'description': 'A unilateral horizontal pull and one of the most effective lat exercises. The free hand braces the torso, removing spinal loading while allowing heavy loads. The lats are loaded hardest at mid-range shoulder extension.',
        'tips': ['Pull toward the hip, not the chest — this maximizes lat over upper back recruitment', 'Allow a full stretch at the bottom but understand lat force is lowest there', 'Drive the elbow past the torso at the top', 'A slight torso rotation at the top is acceptable to increase ROM'],
        'coaching_cues': ['Elbow to ceiling', 'Pull to the hip', 'Stretch and squeeze'],
    },
    'one-arm-dumbbell-row': {
        'description': 'The classic single-arm dumbbell row with knee and hand braced on a bench. Excellent lat builder because the supported position removes erector fatigue, and the free ROM allows full mid-range loading where lats are strongest.',
        'tips': ['Keep the working shoulder slightly lower than the braced shoulder', 'Row to the hip crease, not the armpit', 'Allow scapular protraction at the bottom for full ROM', 'Use straps for heavier sets to ensure the lat is the limiter'],
        'coaching_cues': ['Hip pocket', 'Let it hang, then drive', 'Elbow past the body'],
    },
    'bent-over-two-dumbbell-row': {
        'description': 'A bilateral dumbbell row from a hip-hinged position. Dumbbells allow a freer path than a barbell, enabling each arm to find its optimal pulling arc. The lats peak at mid-range shoulder extension.',
        'tips': ['Hinge to roughly 45-60 degrees for optimal lat leverage', 'Pull both dumbbells toward the hips simultaneously', 'Avoid excessive body English — keep the torso stable', 'Palms can face in or back depending on preference'],
        'coaching_cues': ['Hinge and row', 'Both elbows back', 'Squeeze at the top'],
    },
    'bent-over-two-dumbbell-row-with-palms-in': {
        'description': 'A bilateral dumbbell row with a neutral (palms-in) grip. The neutral grip emphasizes the thoracic (upper) lat region and allows the elbows to travel closer to the body, increasing lat contribution at mid-range.',
        'tips': ['Neutral grip naturally keeps elbows tighter to the torso', 'This grip biases the upper lat fibers — pull to the lower ribs', 'Maintain the hip hinge throughout', 'Slightly lighter loads than pronated grip due to arm path'],
        'coaching_cues': ['Palms face each other', 'Elbows tight', 'Pull to the ribs'],
    },
    'kroc-row': {
        'description': 'A high-rep, heavy single-arm dumbbell row with controlled body English. Named after Matt Kroczaleski. The heavier loading and slight momentum allow the lats to be overloaded through their strongest mid-range zone.',
        'tips': ['Use straps — grip should never limit lat loading on these', 'Controlled body English is acceptable, not wild swinging', 'Aim for 15-25 rep sets for the intended training effect', 'Pull to the hip with a slight torso rotation at the top'],
        'coaching_cues': ['Strap in, go heavy', 'Controlled momentum', 'High reps, full range'],
    },
    'dumbbell-incline-row': {
        'description': 'A chest-supported dumbbell row on an incline bench. The bench support eliminates spinal loading entirely, making this one of the best stimulus-to-fatigue ratio exercises for lats. Peak lat loading occurs at mid-range.',
        'tips': ['Set the bench to 30-45 degrees for optimal lat angle', 'Let the dumbbells hang fully at the bottom before pulling', 'Pull toward the hips, not the chest', 'Press your chest firmly into the pad throughout'],
        'coaching_cues': ['Chest on pad', 'Pull to hips', 'Squeeze the lats'],
    },
    'alternating-kettlebell-row': {
        'description': 'A bent-over row alternating arms with kettlebells. The alternating pattern adds a rotational stability demand. Each lat is loaded independently at mid-range where its moment arm is greatest.',
        'tips': ['Maintain a stable hip hinge — do not rotate the torso', 'Pull each kettlebell toward the hip on that side', 'The offset loading challenges core anti-rotation', 'Keep the non-working arm extended while the other rows'],
        'coaching_cues': ['Alternate smoothly', 'Stay square', 'Pull to the hip'],
    },
    'one-arm-kettlebell-row': {
        'description': 'A single-arm row with a kettlebell, similar to a dumbbell row. The kettlebell offset center of mass slightly changes the resistance profile but the lats are still loaded maximally at mid-range shoulder extension.',
        'tips': ['The kettlebell hangs below the hand — this slightly increases the moment arm at the bottom', 'Pull toward the hip for lat emphasis', 'Brace your free hand on a bench or your knee', 'Control the eccentric for 2 seconds'],
        'coaching_cues': ['Pull to the hip', 'Brace and row', 'Control the lower'],
    },
    'two-arm-kettlebell-row': {
        'description': 'A bilateral bent-over row with kettlebells. Functions similarly to a dumbbell row but the kettlebell shape allows the wrists to stay neutral more easily. Lats are loaded at mid-range.',
        'tips': ['Hinge at the hips to 45-60 degrees', 'Pull both kettlebells toward the hips', 'The hanging weight of kettlebells adds slight extra tension at the bottom', 'Keep your back flat throughout'],
        'coaching_cues': ['Hinge and pull', 'Both to the hips', 'Flat back'],
    },
    'gorilla-row': {
        'description': 'A kettlebell row performed from a wide-stance deadlift position with kettlebells on the floor. Each rep starts from a dead stop. The wide stance and low position create a unique angle that loads the lats well at mid-range.',
        'tips': ['Wide stance with kettlebells between your feet', 'Row one while the other stays on the floor as a counterbalance', 'Dead stop each rep — no stretch reflex', 'Pull toward the hip, keeping the elbow close'],
        'coaching_cues': ['Wide stance, row from the floor', 'Dead stop each rep', 'Elbow to ceiling'],
    },
    'renegade-row': {
        'description': 'A plank-position dumbbell row that combines anti-rotation core work with lat training. The lat stimulus is limited by the core stability demand, making this more of a functional exercise than a pure lat hypertrophy movement.',
        'tips': ['Widen your feet for more stability', 'Row one dumbbell while pressing the other into the floor', 'Minimize hip rotation — this is the core training component', 'Lat loading is moderate due to the stability constraint'],
        'coaching_cues': ['Plank position, row', 'No hip rotation', 'Press and pull'],
    },
    'alternating-renegade-row': {
        'description': 'An alternating version of the renegade row from a plank position. The alternating pattern increases time under tension for the core but the lat stimulus per side is limited by the stability demand.',
        'tips': ['Keep hips square to the floor throughout', 'Wider foot stance increases stability', 'Pull each kettlebell to the hip', 'This is primarily a core exercise with secondary lat work'],
        'coaching_cues': ['Alternate, stay square', 'Wide feet', 'Pull to the hip'],
    },
}

# === CHEST-SUPPORTED ROWS ===
EXERCISE_CONTENT['chest-supported-row'] = {
    'description': 'A dumbbell row performed face-down on an incline bench. By removing all spinal loading, this isolates the lats with an excellent stimulus-to-fatigue ratio. The lats are loaded at mid-range where their leverage is best.',
    'tips': ['Set bench to 30-45 degrees', 'Let arms hang fully before pulling', 'Pull toward the hips for lat bias', 'Press chest firmly into the pad — no lifting off'],
    'coaching_cues': ['Chest on pad, pull to hips', 'Full hang at bottom', 'Squeeze at the top'],
}
EXERCISE_CONTENT['chest-supported-t-bar-row'] = {
    'description': 'A T-bar row performed on a chest-supported machine. Combines the mid-range loading advantage of T-bar rows with the fatigue reduction of chest support. One of the best lat exercises for stimulus-to-fatigue ratio.',
    'tips': ['Chest firmly against the pad throughout', 'Pull the handles toward the lower chest', 'The machine path is fixed — focus on squeezing at mid-range', 'No spinal loading means you can push closer to failure safely'],
    'coaching_cues': ['Chest on pad', 'Pull and squeeze', 'Go to failure safely'],
}
EXERCISE_CONTENT['helms-row'] = {
    'description': 'A chest-supported dumbbell row on a flat or low-incline bench, named after Eric Helms. The prone position eliminates erector fatigue entirely. The lats are loaded at mid-range shoulder extension.',
    'tips': ['Use a flat or slight incline bench', 'Let the dumbbells hang straight down before pulling', 'Pull toward the hips, not the armpits', 'This is one of the lowest-fatigue lat exercises available'],
    'coaching_cues': ['Lie flat, pull to hips', 'Full stretch at bottom', 'Zero momentum'],
}
EXERCISE_CONTENT['seal-row'] = {
    'description': 'A barbell row performed lying face-down on an elevated bench, eliminating all lower back involvement. The seal row is considered one of the purest lat exercises due to zero spinal loading and strong mid-range lat activation.',
    'tips': ['Elevate the bench on blocks or plates so the barbell can hang freely', 'Pull to the lower chest or upper abdomen', 'No body English possible — every rep is strict', 'Use straps to ensure grip does not limit lat loading'],
    'coaching_cues': ['Lie flat, pull strict', 'Elbows drive back', 'Pure lat squeeze'],
}
EXERCISE_CONTENT['incline-bench-pull'] = {
    'description': 'A barbell row performed face-down on an incline bench. Similar to a seal row but with an angled torso. The chest support removes spinal loading while the incline angle loads the lats well at mid-range.',
    'tips': ['Set the incline to 30-45 degrees', 'Pull the barbell toward the lower chest', 'Keep your chest pressed into the bench throughout', 'Lighter loads than standing rows but better lat isolation'],
    'coaching_cues': ['Chest on bench, pull up', 'Elbows past torso', 'Strict reps only'],
}
EXERCISE_CONTENT['lying-cambered-barbell-row'] = {
    'description': 'A chest-supported row using a cambered bar that allows greater ROM. The cambered bar lets you pull further than a straight bar, increasing time under tension through the mid-range where lats are strongest.',
    'tips': ['The cambered bar allows hands to travel past the bench', 'Pull to full contraction — the extra ROM is the advantage', 'Chest stays on the bench throughout', 'Moderate loads with full ROM beats heavy partial reps'],
    'coaching_cues': ['Full ROM pull', 'Chest stays down', 'Squeeze past the bench'],
}
EXERCISE_CONTENT['lying-t-bar-row'] = {
    'description': 'A machine-based chest-supported T-bar row. The fixed path and chest support create a very controlled environment for lat training with minimal systemic fatigue.',
    'tips': ['Chest firmly on the pad', 'Pull the handles to full contraction', 'The machine cam should provide relatively constant tension', 'Focus on the squeeze at mid-range'],
    'coaching_cues': ['Chest on pad', 'Full pull', 'Squeeze and hold'],
}
EXERCISE_CONTENT['straight-bar-bench-mid-rows'] = {
    'description': 'A chest-supported barbell row performed on a bench. The supported position removes erector demand, isolating the lats through their strongest mid-range leverage zone.',
    'tips': ['Keep chest pressed into the bench', 'Pull the bar toward the lower chest', 'Strict form — no momentum', 'Focus on the mid-range squeeze'],
    'coaching_cues': ['Chest down, pull up', 'Strict and controlled', 'Squeeze at mid-range'],
}

# === CABLE ROWS ===
EXERCISE_CONTENT['seated-cable-row'] = {
    'description': 'A seated horizontal pull using a cable stack. The constant cable tension creates a flat resistance curve, loading the lats evenly through the ROM. The seated position with foot braces provides stability with low spinal fatigue.',
    'tips': ['Sit upright — do not lean excessively forward or back', 'Pull the handle to the lower abdomen for lat emphasis', 'The cable provides constant tension — no dead spots', 'Avoid using momentum by swinging the torso'],
    'coaching_cues': ['Sit tall, pull to the belly', 'Constant tension', 'No swinging'],
}
EXERCISE_CONTENT['seated-cable-rows'] = {
    'description': 'A seated cable row providing constant tension throughout the pull. The flat resistance curve means the lats are loaded evenly, including through their strongest mid-range zone. Low systemic fatigue.',
    'tips': ['Maintain an upright torso throughout', 'Pull to the lower abdomen', 'Control both the concentric and eccentric', 'Use a V-handle for upper lat emphasis or wide handle for lower lats'],
    'coaching_cues': ['Upright torso', 'Pull to belly', 'Slow and controlled'],
}
EXERCISE_CONTENT['seated-one-arm-cable-pulley-rows'] = {
    'description': 'A unilateral seated cable row allowing independent lat training. The cable provides constant tension and the single-arm setup allows you to focus on each lat individually through its strongest mid-range.',
    'tips': ['Slight torso rotation toward the working side is acceptable', 'Pull to the hip on the working side', 'The unilateral setup helps identify and correct imbalances', 'Keep the non-working hand on your thigh for stability'],
    'coaching_cues': ['One arm, pull to hip', 'Slight rotation OK', 'Feel each lat work'],
}
EXERCISE_CONTENT['single-arm-cable-row'] = {
    'description': 'A single-arm cable row performed standing or seated. The cable constant tension and unilateral loading make this excellent for lat isolation with minimal fatigue.',
    'tips': ['Stand or sit with a slight stagger for balance', 'Pull toward the hip on the working side', 'The cable angle can be adjusted — horizontal is best for lats', 'Control the eccentric to maintain constant tension'],
    'coaching_cues': ['Pull to the hip', 'Constant tension', 'Control the return'],
}
EXERCISE_CONTENT['elevated-cable-rows'] = {
    'description': 'A cable row performed from an elevated position, changing the pull angle. The elevated angle can increase lat stretch at the start but the lats still contribute most at mid-range shoulder extension.',
    'tips': ['The elevated position changes the line of pull', 'Pull toward the lower chest or upper abdomen', 'Maintain constant tension through the full ROM', 'Adjust the height to find the angle that loads your lats best'],
    'coaching_cues': ['Pull from high to low', 'Constant tension', 'Find your angle'],
}
EXERCISE_CONTENT['shotgun-row'] = {
    'description': 'A unilateral cable row with a split stance and rotational component. The staggered stance and pulling angle create a unique lat loading pattern with constant cable tension.',
    'tips': ['Split stance with the opposite foot forward', 'Pull the handle toward the hip with a slight rotation', 'The cable provides constant tension throughout', 'Focus on the lat squeeze at mid-range'],
    'coaching_cues': ['Split stance, pull and rotate', 'Squeeze at the hip', 'Constant tension'],
}
EXERCISE_CONTENT['kayak-row'] = {
    'description': 'An alternating cable row mimicking a kayak paddling motion. The alternating pattern provides continuous tension on both lats. The cable resistance curve is flat, loading the lats evenly.',
    'tips': ['Alternate smoothly without pausing', 'Pull each handle toward the hip on that side', 'Keep the torso relatively stable — minimal rotation', 'The continuous motion increases metabolic demand'],
    'coaching_cues': ['Paddle motion', 'Pull to each hip', 'Smooth alternation'],
}
EXERCISE_CONTENT['kneeling-high-pulley-row'] = {
    'description': 'A kneeling row using a high cable pulley, creating a pulldown-like angle. The high-to-low pull angle loads the lats through a combination of shoulder extension and adduction. Lats contribute most at mid-range.',
    'tips': ['Kneel far enough from the stack to maintain tension', 'Pull the rope or bar to the upper chest', 'The high angle adds a vertical pulling component', 'Keep your torso upright — do not lean back excessively'],
    'coaching_cues': ['Kneel tall, pull down and back', 'Elbows drive down', 'Squeeze at the chest'],
}
EXERCISE_CONTENT['kneeling-single-arm-high-pulley-row'] = {
    'description': 'A unilateral kneeling high pulley row for independent lat training. The high cable angle and single-arm setup allow focused lat work through the mid-range where leverage is best.',
    'tips': ['Kneel with the working side slightly back', 'Pull the handle toward the working-side hip', 'The unilateral setup allows full focus on each lat', 'Control the eccentric for maximum tension'],
    'coaching_cues': ['Single arm, pull to hip', 'Kneel tall', 'Slow eccentric'],
}

# === PULLDOWNS ===
EXERCISE_CONTENT['lat-pulldown'] = {
    'description': 'A vertical pull using a cable stack. Despite popularity, lats have poor leverage overhead — the moment arm approaches zero at full shoulder flexion. The lat stimulus comes primarily from the mid-range portion of the pull, not the stretched position.',
    'tips': ['The hardest point (arms overhead) is where lats are weakest', 'Focus on the mid-range squeeze, not the stretch', 'Pull to the upper chest, not behind the neck', 'Lean back slightly (10-15 degrees) to improve lat leverage'],
    'coaching_cues': ['Lean back slightly', 'Pull to the chest', 'Squeeze at mid-range'],
}
EXERCISE_CONTENT['close-grip-front-lat-pulldown'] = {
    'description': 'A lat pulldown with a close grip emphasizing the thoracic (upper) lat region. Close grip keeps elbows tighter to the body, improving lat leverage slightly compared to wide grip. Lats still contribute most at mid-range.',
    'tips': ['Close grip biases the upper lat fibers', 'Pull to the upper chest', 'The close grip allows slightly more shoulder extension ROM', 'Lean back 10-15 degrees'],
    'coaching_cues': ['Close grip, elbows tight', 'Pull to chest', 'Upper lat focus'],
}
EXERCISE_CONTENT['close-grip-lat-pulldown'] = {
    'description': 'A close-grip pulldown targeting the thoracic lat region. The narrow hand position keeps elbows closer to the torso, which slightly improves lat moment arm compared to wide grip variations.',
    'tips': ['Narrow grip emphasizes upper lat fibers', 'Pull the bar to the upper chest', 'Slight lean back improves the pulling angle for lats', 'Control the eccentric — do not let the weight yank your arms up'],
    'coaching_cues': ['Narrow grip, chest up', 'Pull and squeeze', 'Control the return'],
}
EXERCISE_CONTENT['full-range-of-motion-lat-pulldown'] = {
    'description': 'A lat pulldown performed through the fullest possible ROM. While the extended ROM increases time under tension, the lats have poor leverage at the top (stretched) position. The hypertrophy stimulus comes from the mid-range portion.',
    'tips': ['Full ROM is fine but understand the lat stimulus peaks at mid-range', 'Do not sacrifice load for extra ROM at the top where lats are weakest', 'Pull to the upper chest', 'Control the full range without momentum'],
    'coaching_cues': ['Full range, focus on mid-pull', 'Chest up', 'Controlled throughout'],
}
EXERCISE_CONTENT['machine-lat-pulldown'] = {
    'description': 'A machine-based pulldown with a cam-designed resistance curve. The machine cam can partially compensate for the lats poor overhead leverage, making this potentially more effective than cable pulldowns for lat loading.',
    'tips': ['The machine cam may provide better resistance matching than cables', 'Pull to the upper chest', 'Focus on the squeeze at mid-range', 'The fixed path removes stabilization demand'],
    'coaching_cues': ['Pull to chest', 'Squeeze at mid-range', 'Let the machine guide you'],
}
EXERCISE_CONTENT['one-arm-lat-pulldown'] = {
    'description': 'A unilateral cable pulldown for independent lat training. Single-arm work allows full focus on each lat through the mid-range where leverage is best.',
    'tips': ['Lean slightly toward the working side', 'Pull the handle to the shoulder on the working side', 'The unilateral setup helps identify imbalances', 'Control the eccentric fully'],
    'coaching_cues': ['One arm, lean slightly', 'Pull to shoulder', 'Slow return'],
}
EXERCISE_CONTENT['single-arm-lat-pulldown'] = {
    'description': 'A single-arm lat pulldown allowing focused unilateral lat work. The cable provides constant tension and the single-arm setup lets you concentrate on the mid-range squeeze where lats are strongest.',
    'tips': ['Slight lean toward the working arm', 'Pull to the working-side shoulder', 'Focus on the mid-range contraction', 'Use moderate loads for best mind-muscle connection'],
    'coaching_cues': ['Single arm focus', 'Pull to shoulder', 'Squeeze at mid-range'],
}
EXERCISE_CONTENT['reverse-grip-lat-pulldown'] = {
    'description': 'A pulldown with a supinated grip that increases biceps involvement and allows slightly more shoulder extension. The underhand grip may bias the upper lat fibers. Lats still peak at mid-range.',
    'tips': ['Supinated grip increases biceps demand — they may fatigue first', 'Pull to the upper chest', 'The underhand grip allows elbows to travel closer to the body', 'Lean back slightly for better lat angle'],
    'coaching_cues': ['Palms up, pull to chest', 'Elbows tight', 'Lean back slightly'],
}
EXERCISE_CONTENT['underhand-cable-pulldowns'] = {
    'description': 'A pulldown with an underhand grip emphasizing the upper lat region and biceps. The supinated grip keeps elbows closer to the torso, slightly improving lat leverage at mid-range.',
    'tips': ['Underhand grip biases upper lat fibers', 'Biceps will be a limiting factor', 'Pull to the upper chest', 'Control the eccentric to maintain tension'],
    'coaching_cues': ['Underhand, pull to chest', 'Elbows in', 'Control the negative'],
}
EXERCISE_CONTENT['v-bar-lat-pulldown'] = {
    'description': 'A pulldown using a V-bar attachment for a close neutral grip. The close grip emphasizes the thoracic (upper) lat region. The neutral grip is joint-friendly and allows good mid-range lat activation.',
    'tips': ['V-bar keeps a close neutral grip — upper lat emphasis', 'Pull the V-bar to the upper chest', 'Lean back 10-15 degrees', 'The neutral grip is easier on the wrists and elbows'],
    'coaching_cues': ['V-bar to chest', 'Lean back slightly', 'Squeeze the upper lats'],
}
EXERCISE_CONTENT['v-bar-pulldown'] = {
    'description': 'A V-bar pulldown targeting the upper lat region with a close neutral grip. The narrow grip and neutral hand position allow the elbows to stay tight, improving lat leverage at mid-range.',
    'tips': ['Close neutral grip for upper lat emphasis', 'Pull to the sternum', 'Slight lean back improves the angle', 'Focus on driving the elbows down and back'],
    'coaching_cues': ['Elbows down and back', 'Pull to sternum', 'Upper lat squeeze'],
}
EXERCISE_CONTENT['wide-grip-lat-pulldown'] = {
    'description': 'A pulldown with a wide overhand grip. Wide grip emphasizes the lower lat fibers but creates worse overall leverage because the elbows are further from the body. The trade-off is more lower lat bias but less total force production.',
    'tips': ['Wide grip biases lower lat fibers but with worse leverage', 'You will likely use less weight than close grip — this is expected', 'Pull to the upper chest', 'Do not pull behind the neck — it adds shoulder risk without lat benefit'],
    'coaching_cues': ['Wide grip, pull to chest', 'Elbows out and down', 'Lower lat focus'],
}
EXERCISE_CONTENT['wide-grip-pulldown-behind-the-neck'] = {
    'description': 'A behind-the-neck pulldown. This variation places the shoulder in a vulnerable position without meaningful additional lat stimulus. The lats have the same mid-range leverage regardless of whether the bar goes in front or behind.',
    'tips': ['Front pulldowns are equally effective with less shoulder risk', 'If you do these, use light weight and full control', 'Requires excellent shoulder mobility', 'Not recommended as a primary lat exercise'],
    'coaching_cues': ['Light weight only', 'Full control', 'Consider front pulldowns instead'],
}
EXERCISE_CONTENT['cable-incline-pushdown'] = {
    'description': 'A straight-arm pushdown performed on an incline bench. This isolation movement loads the lats through shoulder extension without elbow flexion. The lats are loaded primarily at mid-range to shortened positions.',
    'tips': ['Lie face-up on an incline bench facing a high cable', 'Keep arms straight — this isolates shoulder extension', 'The lats are loaded at mid-range and shortened positions', 'Excellent isolation with very low systemic fatigue'],
    'coaching_cues': ['Straight arms, push down', 'Squeeze at the bottom', 'Low fatigue, high isolation'],
}

# === PULL-UPS / CHIN-UPS ===
EXERCISE_CONTENT['pull-ups'] = {
    'description': 'A bodyweight vertical pull. The ascending strength curve means the bottom (stretched) position is hardest, but this is precisely where the lats have their worst leverage. The lat stimulus comes from the mid-range portion of the pull.',
    'tips': ['The bottom is hardest but lats are weakest there — do not hang excessively', 'Focus on driving through the mid-range where lats contribute most', 'Lean back slightly to improve lat leverage', 'Full ROM is fine but the stretch position is not where lats grow'],
    'coaching_cues': ['Drive through the middle', 'Lean back slightly', 'Chin over bar'],
}
EXERCISE_CONTENT['pullups'] = {
    'description': 'A bodyweight vertical pull with an overhand grip. The hardest point is the dead hang where lats have minimal leverage. Lat hypertrophy stimulus comes from the mid-range portion where the moment arm is greatest.',
    'tips': ['Do not over-emphasize the dead hang stretch — lats are weakest there', 'Drive elbows down and back through mid-range', 'Slight lean back improves lat angle', 'Add weight once bodyweight becomes easy for 10+ reps'],
    'coaching_cues': ['Elbows down and back', 'Drive through mid-range', 'Chin over bar'],
}
EXERCISE_CONTENT['chin-up'] = {
    'description': 'A supinated-grip vertical pull. The underhand grip increases biceps contribution and allows slightly more shoulder extension. The lats still have poor overhead leverage — the stimulus comes from mid-range.',
    'tips': ['Supinated grip increases biceps involvement significantly', 'The underhand grip allows elbows to travel closer to the body', 'Lats contribute most from mid-range, not the dead hang', 'Lean back slightly for better lat leverage'],
    'coaching_cues': ['Palms toward you', 'Drive elbows down', 'Lean back slightly'],
}
EXERCISE_CONTENT['chin-ups'] = {
    'description': 'Supinated-grip pull-ups emphasizing biceps alongside lats. The underhand grip keeps elbows tighter to the body, which can slightly improve lat leverage at mid-range compared to wide-grip pull-ups.',
    'tips': ['Biceps will often fatigue before lats on these', 'Pull chin over the bar', 'Focus on the mid-range squeeze', 'Shoulder-width grip is optimal'],
    'coaching_cues': ['Palms in, pull up', 'Mid-range focus', 'Chin over bar'],
}
EXERCISE_CONTENT['band-assisted-pull-up'] = {
    'description': 'A pull-up with band assistance reducing load at the bottom where lats are weakest. The band provides most assistance at the dead hang — coincidentally where lats have their worst leverage — making this a surprisingly well-matched assistance method.',
    'tips': ['The band helps most at the bottom where lats are weakest anyway', 'Focus on driving through the mid-range under your own power', 'Progress by using thinner bands over time', 'Full ROM with control'],
    'coaching_cues': ['Drive through the middle', 'Band helps the bottom', 'Control the lower'],
}
EXERCISE_CONTENT['weighted-pull-ups'] = {
    'description': 'Pull-ups with added external load. Adding weight increases the force demand through the entire ROM, including the mid-range where lats have their best leverage. One of the best ways to progressively overload the lats vertically.',
    'tips': ['Use a dip belt or hold a dumbbell between your feet', 'The added weight makes mid-range even more demanding for lats', 'Start with 5-10 lbs and progress gradually', 'Maintain full ROM — do not cut range to add weight'],
    'coaching_cues': ['Full range with weight', 'Drive through mid-range', 'Control the descent'],
}
EXERCISE_CONTENT['wide-grip-pull-up'] = {
    'description': 'A pull-up with a wide overhand grip. Wide grip biases lower lat fibers but creates worse overall leverage — the elbows are further from the body, reducing the lat moment arm. Most people are weaker on these for good reason.',
    'tips': ['Wide grip targets lower lats but with worse leverage overall', 'You will do fewer reps than shoulder-width — this is normal', 'Pull until chin clears the bar', 'Do not sacrifice ROM for grip width'],
    'coaching_cues': ['Wide grip, full pull', 'Elbows out and down', 'Chin over bar'],
}
EXERCISE_CONTENT['neutral-grip-pull-up'] = {
    'description': 'A pull-up with a neutral (palms facing each other) grip. The neutral grip is the most joint-friendly and allows good lat activation at mid-range. It biases the upper lat region due to the close elbow path.',
    'tips': ['Neutral grip is easiest on the shoulders and elbows', 'The close elbow path biases upper lat fibers', 'Full ROM with control', 'Often the strongest grip variation for most people'],
    'coaching_cues': ['Palms face each other', 'Elbows tight', 'Full range'],
}
EXERCISE_CONTENT['commando-pull-up'] = {
    'description': 'A pull-up performed with hands close together in a neutral grip, pulling to alternating sides of the bar. Adds a lateral component to the pull. Lats are loaded at mid-range on each side.',
    'tips': ['Alternate pulling to each side of the bar', 'The close grip biases upper lat fibers', 'Requires good grip strength', 'More of a skill exercise than a pure lat builder'],
    'coaching_cues': ['Alternate sides', 'Close grip', 'Control each rep'],
}
EXERCISE_CONTENT['mixed-grip-chin'] = {
    'description': 'A chin-up with one hand supinated and one pronated. The mixed grip creates asymmetric loading — the supinated side gets more biceps assistance. Lats are loaded at mid-range on both sides.',
    'tips': ['Alternate which hand is supinated between sets', 'The mixed grip can help with grip on heavy sets', 'Lats work similarly on both sides despite the grip difference', 'Full ROM with control'],
    'coaching_cues': ['Mixed grip, alternate sets', 'Full range', 'Drive elbows down'],
}
EXERCISE_CONTENT['one-arm-chin-up'] = {
    'description': 'An advanced single-arm chin-up requiring extreme lat and biceps strength. The unilateral loading is very high but the ascending curve means the bottom position is extremely difficult where lats are weakest.',
    'tips': ['This is an advanced skill — build up with assisted variations first', 'The bottom position is brutally hard and lats are weakest there', 'Supinated grip gives the best leverage', 'Very high fatigue per rep'],
    'coaching_cues': ['Advanced only', 'Supinated grip', 'Full control'],
}
EXERCISE_CONTENT['side-to-side-chins'] = {
    'description': 'A chin-up variation pulling to alternating sides, increasing unilateral lat demand. Each rep shifts more load to one lat. The mid-range is where each lat contributes most.',
    'tips': ['Pull toward one hand, then the other on alternating reps', 'The shifting load increases unilateral lat demand', 'Requires good baseline pull-up strength', 'Control the lateral shift'],
    'coaching_cues': ['Shift side to side', 'Control the movement', 'Full range each side'],
}
EXERCISE_CONTENT['v-bar-pullup'] = {
    'description': 'A pull-up using a V-bar attachment for a close neutral grip. The close grip emphasizes the thoracic (upper) lat region. The neutral grip is joint-friendly.',
    'tips': ['Close neutral grip biases upper lats', 'Hang the V-bar over the pull-up bar', 'Full ROM with control', 'Often stronger than wide-grip pull-ups'],
    'coaching_cues': ['V-bar, close grip', 'Full range', 'Upper lat focus'],
}
EXERCISE_CONTENT['wide-grip-rear-pull-up'] = {
    'description': 'A wide-grip pull-up pulling behind the head. Similar concerns as behind-the-neck pulldowns — increased shoulder risk without meaningful additional lat stimulus.',
    'tips': ['Front pull-ups are equally effective with less shoulder risk', 'Requires excellent shoulder mobility', 'Use light bodyweight only', 'Not recommended as a primary lat exercise'],
    'coaching_cues': ['Caution with shoulders', 'Full control', 'Consider standard pull-ups'],
}
EXERCISE_CONTENT['towel-pull-up'] = {
    'description': 'A pull-up gripping towels draped over the bar. Dramatically increases grip and forearm demand. The lat stimulus is similar to standard pull-ups but grip will likely fail before lats.',
    'tips': ['Grip will be the limiting factor, not lats', 'Great for grip strength development', 'Use for grip training, not primary lat work', 'The lat stimulus is identical to regular pull-ups'],
    'coaching_cues': ['Grip the towels hard', 'Full range', 'Grip is the challenge'],
}
EXERCISE_CONTENT['gironda-sternum-chins'] = {
    'description': 'A chin-up variation pulling the sternum to the bar with a pronounced lean back. The extreme lean back shifts the movement toward horizontal pulling, which actually improves lat leverage compared to vertical pulling.',
    'tips': ['Lean back significantly as you pull — sternum to bar', 'The lean back makes this more like a row, improving lat leverage', 'Very demanding on the lats and biceps', 'Lower rep ranges work best'],
    'coaching_cues': ['Lean back, sternum to bar', 'Row-like angle', 'Full control'],
}
EXERCISE_CONTENT['muscle-up'] = {
    'description': 'An advanced movement combining a pull-up with a dip. The lat contribution is primarily during the pulling phase at mid-range. The transition and dip phases shift load to chest and triceps.',
    'tips': ['Lats only contribute during the pulling phase', 'The transition requires explosive power', 'Not an efficient lat hypertrophy exercise', 'Better as a skill/strength exercise'],
    'coaching_cues': ['Explosive pull', 'Transition fast', 'Skill exercise'],
}
EXERCISE_CONTENT['kipping-muscle-up'] = {
    'description': 'A muscle-up using a kipping motion to generate momentum. The kip reduces lat demand significantly. This is a skill and conditioning exercise, not a lat hypertrophy movement.',
    'tips': ['The kip reduces muscular demand on the lats', 'This is a CrossFit/skill exercise, not a hypertrophy exercise', 'High injury risk if technique is poor', 'Not recommended for lat development'],
    'coaching_cues': ['Kip for momentum', 'Skill exercise', 'Not for hypertrophy'],
}
EXERCISE_CONTENT['rocky-pull-ups-pulldowns'] = {
    'description': 'An alternating front and behind-the-neck pull-up. The front portion loads lats normally while the behind-the-neck portion adds shoulder risk without additional lat benefit.',
    'tips': ['The front pull-up portion is the effective lat stimulus', 'Behind-the-neck adds shoulder risk', 'Use moderate rep ranges', 'Standard pull-ups are equally effective and safer'],
    'coaching_cues': ['Alternate front and back', 'Control throughout', 'Watch shoulder comfort'],
}
EXERCISE_CONTENT['rope-climb'] = {
    'description': 'Climbing a vertical rope using arms and legs. The pulling pattern loads the lats through repeated mid-range shoulder extension. High grip and biceps demand. More of a functional/conditioning exercise.',
    'tips': ['Use your legs to assist — arms-only is extremely fatiguing', 'The lat stimulus comes from repeated mid-range pulls', 'Grip will often be the limiter', 'Better for conditioning than pure lat hypertrophy'],
    'coaching_cues': ['Use your legs', 'Pull in bursts', 'Grip hard'],
}
EXERCISE_CONTENT['pyramid'] = {
    'description': 'A bodyweight exercise combining pull-up and dip movements in a pyramid rep scheme. The lat stimulus comes from the pull-up portions. More of a conditioning protocol than a hypertrophy exercise.',
    'tips': ['The pull-up portions provide the lat stimulus', 'Pyramid rep schemes are for conditioning', 'Not optimal for lat hypertrophy', 'Good for bodyweight fitness testing'],
    'coaching_cues': ['Pull-up portions for lats', 'Pace yourself', 'Conditioning focus'],
}

# === INVERTED ROWS ===
EXERCISE_CONTENT['inverted-row'] = {
    'description': 'A bodyweight horizontal row performed under a bar or rings. The horizontal pull angle loads the lats at mid-range where their leverage is best. Difficulty is adjusted by changing body angle.',
    'tips': ['More horizontal = harder, more vertical = easier', 'Pull your chest to the bar', 'The horizontal angle is excellent for lat leverage', 'Elevate feet to increase difficulty'],
    'coaching_cues': ['Chest to bar', 'Straight body line', 'Squeeze at the top'],
}
EXERCISE_CONTENT['inverted-row-with-straps'] = {
    'description': 'An inverted row using suspension straps (TRX or rings). The unstable handles add a stabilization demand. The horizontal pulling angle loads lats well at mid-range.',
    'tips': ['Straps add instability — grip and stabilizers work harder', 'Pull handles to the sides of your chest', 'Keep a straight body line from head to heels', 'Adjust difficulty by changing foot position'],
    'coaching_cues': ['Handles to chest', 'Straight body', 'Stabilize the straps'],
}
EXERCISE_CONTENT['bodyweight-mid-row'] = {
    'description': 'A bodyweight row at mid-height, providing a moderate difficulty horizontal pull. The mid-range loading aligns well with where lats have their best leverage.',
    'tips': ['Adjust the bar height to control difficulty', 'Pull your chest to the bar', 'Keep your body in a straight line', 'Great for warm-ups or high-rep lat work'],
    'coaching_cues': ['Chest to bar', 'Straight line', 'Control the lower'],
}
EXERCISE_CONTENT['suspended-row'] = {
    'description': 'A row performed using suspension straps. The unstable handles increase stabilization demand while the horizontal pull loads lats at mid-range. Adjustable difficulty by changing body angle.',
    'tips': ['Walk feet forward to increase difficulty', 'Pull handles to the sides of your ribcage', 'The instability adds a stabilization component', 'Keep core braced throughout'],
    'coaching_cues': ['Walk feet forward for harder', 'Pull to ribs', 'Brace the core'],
}
EXERCISE_CONTENT['london-bridges'] = {
    'description': 'A dynamic bodyweight pulling exercise combining elements of inverted rows with lateral movement. More of a functional exercise than a pure lat builder.',
    'tips': ['The lateral movement adds complexity', 'Lat stimulus is moderate', 'Good for bodyweight conditioning', 'Control the movement throughout'],
    'coaching_cues': ['Control the lateral shift', 'Pull and move', 'Bodyweight conditioning'],
}
EXERCISE_CONTENT['sled-row'] = {
    'description': 'A rowing movement pulling a sled toward you. The sled provides concentric-only resistance with no eccentric, reducing muscle damage and fatigue. Lats are loaded at mid-range during each pull.',
    'tips': ['Concentric only — very low muscle damage', 'Great for recovery days or extra lat volume', 'Pull the sled with a rowing motion', 'The lack of eccentric means less soreness'],
    'coaching_cues': ['Pull the sled', 'Row motion', 'Concentric only'],
}

# === STRAIGHT-ARM PULLDOWNS ===
EXERCISE_CONTENT['straight-arm-pulldown'] = {
    'description': 'An isolation exercise for the lats using shoulder extension with straight arms. This removes biceps involvement entirely. The lats are loaded from mid-range to shortened positions, making this one of the few exercises that loads lats at peak contraction.',
    'tips': ['Keep arms straight — any elbow bend shifts load to biceps', 'The lat stimulus is at mid-range to shortened, not stretched', 'Use a rope or straight bar attachment', 'Excellent as a pre-exhaust or finisher'],
    'coaching_cues': ['Straight arms throughout', 'Push down in an arc', 'Squeeze at the bottom'],
}
EXERCISE_CONTENT['rope-straight-arm-pulldown'] = {
    'description': 'A straight-arm pulldown using a rope attachment. The rope allows the hands to split at the bottom, increasing the range of shoulder extension. Loads lats at mid-range to shortened positions with zero biceps involvement.',
    'tips': ['Split the rope at the bottom for extra ROM', 'Keep arms straight throughout', 'The rope allows a more natural hand path', 'Low fatigue — excellent for extra lat volume'],
    'coaching_cues': ['Split the rope at bottom', 'Straight arms', 'Squeeze and split'],
}

# === MACHINE ROWS ===
EXERCISE_CONTENT['machine-row'] = {
    'description': 'A machine-based horizontal row with a cam-designed resistance curve. The machine provides a flat or matched resistance profile, loading the lats evenly through the ROM including the critical mid-range.',
    'tips': ['Adjust the chest pad so arms are fully extended at the start', 'Pull handles toward the lower ribcage', 'The machine path is fixed — focus on squeezing', 'Low setup time and consistent loading'],
    'coaching_cues': ['Pull to ribs', 'Squeeze at the back', 'Controlled reps'],
}
EXERCISE_CONTENT['machine-seated-row'] = {
    'description': 'A seated machine row providing stable, consistent lat loading. The fixed path and chest pad support make this a low-fatigue option with good lat stimulus at mid-range.',
    'tips': ['Chest against the pad throughout', 'Pull handles to the lower ribs', 'The machine provides consistent resistance', 'Good option for training close to failure safely'],
    'coaching_cues': ['Chest on pad', 'Pull to ribs', 'Safe to push hard'],
}
EXERCISE_CONTENT['leverage-high-row'] = {
    'description': 'A plate-loaded machine row with a high pulling angle. The high angle adds a vertical component to the pull. The lats contribute most at mid-range regardless of the pull angle.',
    'tips': ['The high angle creates a hybrid row/pulldown movement', 'Pull the handles toward the upper chest', 'Plate-loaded allows fine weight adjustments', 'Focus on the mid-range squeeze'],
    'coaching_cues': ['Pull high to chest', 'Squeeze at mid-range', 'Controlled reps'],
}
EXERCISE_CONTENT['leverage-iso-row'] = {
    'description': 'A plate-loaded machine row with independent arms for unilateral training. Each arm moves independently, allowing you to identify and correct lat imbalances. Mid-range loading where lats are strongest.',
    'tips': ['Independent arms reveal side-to-side imbalances', 'Pull each handle toward the hip on that side', 'Can be used unilaterally or bilaterally', 'The fixed path allows safe training to failure'],
    'coaching_cues': ['Independent arms', 'Pull to hips', 'Find imbalances'],
}
EXERCISE_CONTENT['smith-machine-bent-over-row'] = {
    'description': 'A bent-over row on the Smith machine. The fixed bar path removes the need for horizontal stabilization. The lats are loaded at mid-range. Less erector demand than free barbell rows due to the guided path.',
    'tips': ['The fixed path allows you to focus purely on pulling', 'Hinge at the hips and pull to the lower abdomen', 'Less stabilization demand than free barbell rows', 'Good option if lower back fatigue is a concern'],
    'coaching_cues': ['Hinge and pull', 'Fixed path, focus on lats', 'Pull to abdomen'],
}
EXERCISE_CONTENT['smith-machine-row'] = {
    'description': 'A Smith machine row providing a guided bar path for consistent lat loading. The fixed path reduces stabilization demand and can reduce erector fatigue compared to free barbell rows.',
    'tips': ['The guided path lets you focus on the lat squeeze', 'Pull to the lower abdomen', 'Hinge at the hips to the appropriate angle', 'Good for higher rep lat work with less fatigue'],
    'coaching_cues': ['Guided path', 'Pull to belly', 'Focus on the squeeze'],
}

# === T-BAR ROWS ===
EXERCISE_CONTENT['t-bar-row'] = {
    'description': 'A bilateral row using a landmine or T-bar apparatus. The close neutral grip emphasizes the thoracic (upper) lat region. The bell-shaped resistance curve loads the lats hardest at mid-range. Significant erector demand.',
    'tips': ['Close grip biases upper lat fibers', 'Pull to the chest', 'The fixed pivot creates a natural arc', 'Significant lower back demand — brace hard'],
    'coaching_cues': ['Close grip, pull to chest', 'Brace the core', 'Squeeze at the top'],
}
EXERCISE_CONTENT['t-bar-row-with-handle'] = {
    'description': 'A T-bar row using a handle attachment for a neutral grip. The handle allows a comfortable grip while the T-bar apparatus loads the lats through a bell-shaped curve peaking at mid-range.',
    'tips': ['The handle provides a comfortable neutral grip', 'Pull to the chest or upper abdomen', 'Brace your core — significant spinal loading', 'The arc path naturally loads mid-range'],
    'coaching_cues': ['Neutral grip, pull to chest', 'Brace hard', 'Mid-range squeeze'],
}

# === BAND ROWS ===
EXERCISE_CONTENT['resistance-band-row'] = {
    'description': 'A row using resistance bands. The ascending resistance curve means tension increases as you pull, loading the lats more at the shortened position. This complements the lats mid-range strength well.',
    'tips': ['Band tension increases as you pull — peak load at contraction', 'Anchor the band at chest height for horizontal rowing', 'Good for warm-ups, rehab, or travel training', 'The ascending curve means less load at the stretch'],
    'coaching_cues': ['Pull against increasing resistance', 'Squeeze at the back', 'Control the return'],
}

# === MOBILITY ===
EXERCISE_CONTENT['latissimus-dorsi-smr'] = {
    'description': 'Self-myofascial release for the latissimus dorsi using a foam roller or lacrosse ball. This is a recovery and mobility tool, not a hypertrophy exercise.',
    'tips': ['Lie on your side with the roller under your lat', 'Roll slowly from armpit to lower ribs', 'Pause on tender spots for 20-30 seconds', 'Use before training to improve overhead mobility'],
    'coaching_cues': ['Roll slowly', 'Pause on tight spots', 'Breathe and relax'],
}
EXERCISE_CONTENT['one-arm-against-wall'] = {
    'description': 'A lat stretch performed with one arm extended against a wall. This mobility drill targets lat flexibility, particularly for overhead positions.',
    'tips': ['Place your hand on the wall at shoulder height and rotate away', 'Hold for 20-30 seconds per side', 'Breathe deeply into the stretch', 'Useful before overhead pressing'],
    'coaching_cues': ['Hand on wall, rotate away', 'Hold and breathe', '20-30 seconds'],
}
EXERCISE_CONTENT['overhead-lat'] = {
    'description': 'An overhead lat stretch targeting the full length of the latissimus dorsi. This mobility exercise improves overhead shoulder flexion range.',
    'tips': ['Reach overhead and lean to one side', 'Hold for 20-30 seconds per side', 'You should feel a stretch along the side of your torso', 'Useful before any overhead work'],
    'coaching_cues': ['Reach and lean', 'Hold the stretch', 'Breathe deeply'],
}
EXERCISE_CONTENT['side-lying-floor-stretch'] = {
    'description': 'A side-lying stretch targeting the lats and thoracolumbar fascia. This passive stretch improves lat flexibility and can help with overhead mobility.',
    'tips': ['Lie on your side with the bottom arm extended overhead', 'Let gravity pull you into the stretch', 'Hold for 30-60 seconds per side', 'Very gentle — no forcing'],
    'coaching_cues': ['Lie on side, arm overhead', 'Let gravity stretch', 'Hold and breathe'],
}
EXERCISE_CONTENT['upper-back-stretch'] = {
    'description': 'A general upper back and lat stretch. This mobility exercise targets the lats, rhomboids, and thoracic spine.',
    'tips': ['Clasp hands in front and round your upper back', 'Push your hands forward while pulling your shoulder blades apart', 'Hold for 20-30 seconds', 'Good between sets of heavy rows'],
    'coaching_cues': ['Round forward', 'Push hands away', 'Hold and breathe'],
}
EXERCISE_CONTENT['rhomboids-smr'] = {
    'description': 'Self-myofascial release for the rhomboids and surrounding upper back musculature. While classified under lats, this primarily targets the rhomboid region between the shoulder blades.',
    'tips': ['Use a foam roller or lacrosse ball between the shoulder blades', 'Cross your arms to protract the scapulae and expose the rhomboids', 'Roll slowly and pause on tender spots', 'Useful for upper back tightness'],
    'coaching_cues': ['Cross arms, roll upper back', 'Pause on tight spots', 'Slow and controlled'],
}

# === OTHER / MISC ===
EXERCISE_CONTENT['one-handed-hang'] = {
    'description': 'A single-arm dead hang from a bar. Primarily a grip strength and shoulder decompression exercise. The lats are under passive stretch but not actively loaded for hypertrophy.',
    'tips': ['This is a grip and decompression exercise, not a lat builder', 'Hang for time — start with 10-15 seconds', 'Keep the shoulder packed, not fully relaxed', 'Good for grip strength development'],
    'coaching_cues': ['Hang and hold', 'Pack the shoulder', 'Grip challenge'],
}
EXERCISE_CONTENT['catch-and-overhead-throw'] = {
    'description': 'A dynamic throwing exercise involving catching and overhead throwing. The lat involvement is brief and ballistic during the throwing phase. This is a power/conditioning exercise, not a hypertrophy movement.',
    'tips': ['The lat involvement is during the throwing deceleration', 'This is a power exercise, not for hypertrophy', 'Use a medicine ball', 'Focus on explosive power'],
    'coaching_cues': ['Catch and throw', 'Explosive', 'Power exercise'],
}
EXERCISE_CONTENT['overhead-slam'] = {
    'description': 'A medicine ball slam from overhead to the floor. The lats contribute to the slamming motion through rapid shoulder extension. This is a power and conditioning exercise with minimal hypertrophy stimulus.',
    'tips': ['Slam the ball with full force', 'The lats contribute to the downward slam', 'This is conditioning, not hypertrophy', 'Use a dead ball that does not bounce'],
    'coaching_cues': ['Slam hard', 'Full body power', 'Conditioning exercise'],
}
EXERCISE_CONTENT['rowing-stationary'] = {
    'description': 'A rowing machine (ergometer) exercise. While it involves lat activation during each stroke, the load is too low and the movement too fast for meaningful lat hypertrophy. This is a cardiovascular exercise.',
    'tips': ['This is cardio, not lat hypertrophy training', 'The lats assist during the pull phase of each stroke', 'Drive with the legs first, then pull with the arms', 'Good for conditioning and warm-ups'],
    'coaching_cues': ['Legs, back, arms', 'Cardio focus', 'Smooth strokes'],
}


def get_exercise_data(ex, typ):
    """Return biomechanics dict for a lat exercise."""
    eid = ex['id']
    defaults = TYPE_DEFAULTS.get(typ, TYPE_DEFAULTS['other'])
    content = EXERCISE_CONTENT.get(eid, {})
    
    # Build result with defaults, override with specific content
    result = {}
    result['description'] = content.get('description', f"A {typ.replace('_', ' ')} variation targeting the latissimus dorsi. The lats are loaded primarily at mid-range shoulder extension angles where their moment arm is greatest.")
    result['tips'] = content.get('tips', ['Focus on the mid-range squeeze where lats have their best leverage', 'Control the eccentric for 2 seconds', 'Pull toward the hips or lower ribs for lat emphasis', 'Avoid excessive momentum'])
    result['coaching_cues'] = content.get('coaching_cues', ['Pull to the hips', 'Squeeze at mid-range', 'Control the lower'])
    result['strength_curve'] = defaults['strength_curve']
    result['loading_position'] = defaults['loading_position']
    result['stretch_hypertrophy_potential'] = defaults['stretch_hypertrophy_potential']
    result['stimulus_to_fatigue'] = defaults['stimulus_to_fatigue']
    result['fatigue_rating'] = defaults['fatigue_rating']
    
    return result
