"""Chest exercise descriptions, tips, and coaching cues generator."""
import random
random.seed(42)

def _pick(lst):
    return lst[random.randint(0, len(lst)-1)]

# --- DESCRIPTIONS ---

_ANGLE_FIBER = {
    'incline': 'clavicular (upper) pec fibers',
    'decline': 'sternal (lower) pec fibers',
    'flat': 'sternal and clavicular pec fibers',
}
_ANGLE_ADJ = {'incline': 'an incline', 'decline': 'a decline', 'flat': 'a flat'}

def _a_an(word):
    """Return 'an' if word starts with vowel sound, else 'a'."""
    return 'an' if word[0].lower() in 'aeiou' else 'a'

def _bench_desc(ang, el, name):
    n = name.lower()
    fibers = _ANGLE_FIBER[ang]
    if 'floor press' in n:
        return f"A pressing movement performed lying on the floor with {el}, which limits range of motion to roughly the bottom two-thirds of a bench press. This reduces pec stretch but increases triceps demand at lockout, making it useful for overloading the mid-range."
    if 'guillotine' in n or 'neck press' in n:
        return f"A barbell bench press variation where the bar is lowered to the neck rather than the chest. This increases shoulder horizontal abduction, placing greater stretch on the {fibers} and increasing pec activation at the cost of higher shoulder joint stress."
    if 'powerlifting' in n:
        return f"A competition-style bench press with an arched back and leg drive to maximize force output. The arch reduces range of motion and shifts emphasis toward the {fibers}, prioritizing load over muscle stretch."
    if 'chain' in n:
        return f"A barbell bench press with chains that add progressive resistance as you press. The ascending resistance curve overloads lockout while deloading the stretched position, training rate of force development through the {fibers}."
    if 'reverse band' in n:
        return f"A bench press with bands attached overhead that assist at the bottom and reduce help as you press up. This allows supramaximal loading at lockout while protecting the shoulder at the stretched position of the {fibers}."
    if 'band' in n:
        return f"A bench press with resistance bands that increase tension toward lockout, creating an ascending strength curve. This overloads the {fibers} in the shortened position while reducing load at the vulnerable bottom range."
    if 'medium grip' in n:
        return f"{'An' if ang == 'incline' else 'A'} {ang} {el} bench press using a moderate grip width that balances pec and triceps involvement. The medium grip allows good range of motion for the {fibers} while keeping shoulder stress manageable."
    if 'neutral grip' in n or 'palms facing' in n or 'hammer' in n:
        return f"{'An' if ang == 'incline' else 'A'} {ang} {el} press with a neutral (palms-in) grip that shifts emphasis slightly toward the {fibers} and anterior deltoid while reducing shoulder external rotation stress. The neutral grip is often more comfortable for those with shoulder issues."
    if 'one arm' in n or 'single arm' in n:
        return f"A unilateral {ang} {el} press that trains the {fibers} one side at a time. The single-arm loading adds a core stability demand and helps identify and correct strength imbalances between sides."
    if 'kettlebell' in n:
        return f"{'An' if ang == 'incline' else 'A'} {ang} floor press using a kettlebell, where the offset center of mass increases stabilizer demand. The floor limits range of motion, but the kettlebell position challenges the {fibers} and grip differently than dumbbells."
    if 'landmine' in n:
        return f"A standing press using a barbell anchored at one end, creating an arc-shaped pressing path. The landmine angle emphasizes the clavicular pec fibers and anterior deltoid with a joint-friendly movement pattern."
    if 'cable' in n:
        return f"{'An' if ang == 'incline' else 'A'} {ang} chest press using cables that maintain constant tension throughout the range of motion. Unlike free weights, the cable provides resistance in the shortened position, training the {fibers} through a more complete force profile."
    if 'machine' in n or 'leverage' in n or 'smith' in n:
        return f"{'An' if ang == 'incline' else 'A'} {ang} machine chest press that uses a fixed path and cam-designed resistance curve. The guided motion reduces stabilizer demand and allows focused overload of the {fibers} with a more uniform loading profile across the range."
    if el == 'dumbbell':
        return f"{'An' if ang == 'incline' else 'A'} {ang} {el} bench press that allows a deeper range of motion than the barbell variant. The independent arms permit greater shoulder horizontal abduction at the bottom, increasing stretch on the {fibers} and enhancing stretch-mediated hypertrophy potential."
    # Default barbell/other
    return f"{'An' if ang == 'incline' else 'A'} {ang} {el} bench press that is a foundational compound movement for the {fibers}. The barbell allows heavy loading, and the {ang} angle determines the relative contribution of the upper versus lower pec fibers."

def _fly_desc(ang, el, name):
    n = name.lower()
    fibers = _ANGLE_FIBER[ang]
    if 'pec deck' in n or 'butterfly' in n:
        return f"A machine isolation exercise that targets the {fibers} through horizontal adduction. The cam mechanism provides relatively even resistance, though the fixed path limits the deep stretch achievable with free-weight flyes."
    if 'around the world' in n:
        return f"A dumbbell exercise that traces a wide arc from hips to overhead, loading the {fibers} through an extended range of horizontal abduction. The circular path creates a unique stretch stimulus across multiple pec fiber angles."
    if 'cable' in n or 'seated cable' in n:
        return f"{'An' if ang == 'incline' else 'A'} {ang} cable fly that provides constant tension on the {fibers} throughout the range of motion. The cable direction can be adjusted to bias different pec fiber angles, and the stretch position offers excellent hypertrophy stimulus."
    if 'band' in n:
        return f"A resistance band fly that creates an ascending resistance curve, with peak tension at the shortened (squeezed) position. This complements dumbbell flyes which peak at the stretch, training the {fibers} through a different force profile."
    if 'bodyweight' in n:
        return f"A bodyweight fly variation performed on a smooth surface or with sliders, using body mass as resistance. This challenges the {fibers} with a significant stretch component and high stabilization demand."
    if 'one-arm' in n or 'single' in n:
        return f"A unilateral {ang} dumbbell fly that isolates the {fibers} one side at a time. The single-arm approach allows full focus on the mind-muscle connection and helps correct asymmetries in pec development."
    if 'twist' in n:
        return f"{'An' if ang == 'incline' else 'A'} {ang} dumbbell fly with a supination twist at the top that increases pec contraction in the shortened position. The rotation adds internal rotation to horizontal adduction, fully shortening the {fibers}."
    if el == 'dumbbell':
        return f"{'An' if ang == 'incline' else 'A'} {ang} dumbbell fly that isolates the {fibers} through horizontal adduction with arms nearly straight. The dumbbell creates peak loading at the stretched position where the pec has good leverage, making this excellent for stretch-mediated hypertrophy."
    return f"{'An' if ang == 'incline' else 'A'} {ang} fly variation targeting the {fibers} through horizontal adduction. The isolation nature reduces triceps involvement, directing more stimulus to the pectorals."

def _pushup_desc(ang, el, name):
    n = name.lower()
    if 'archer' in n:
        return "An advanced push-up where one arm extends wide while the other performs the press. This creates a unilateral overload on the working pec, increasing both stretch and force demand on that side."
    if 'clap' in n or 'plyo' in n or 'depth jump' in n:
        return "An explosive push-up variation that develops chest power and rate of force development. The plyometric component trains the stretch-shortening cycle of the pec major, useful for athletic performance."
    if 'wide' in n:
        return "A push-up with hands placed wider than shoulder width, increasing horizontal abduction and pec stretch at the bottom. The wider hand position shifts emphasis from triceps to the sternal pec fibers."
    if 'close' in n:
        return "A push-up with hands placed close together, shifting emphasis toward the triceps and inner chest. The narrow hand position reduces pec stretch but increases triceps and anterior deltoid demand."
    if 'decline' in n or 'feet elevated' in n or 'feet on' in n:
        return "A push-up with feet elevated, which increases the load on the clavicular (upper) pec fibers by changing the pressing angle. The elevated position also increases overall difficulty compared to standard push-ups."
    if 'incline' in n:
        return "A push-up with hands elevated on a bench or platform, reducing the load compared to standard push-ups. The incline angle shifts emphasis slightly toward the sternal pec fibers and is a good regression for building pressing strength."
    if 'single-arm' in n or 'single arm' in n or 'one arm' in n:
        return "An advanced unilateral push-up that doubles the load on one pec while demanding significant core stability. This variation is excellent for identifying and correcting strength imbalances."
    if 'suspended' in n:
        return "A push-up performed on suspension straps or rings that adds instability, increasing stabilizer muscle recruitment. The unstable surface forces the pec major and rotator cuff to work harder to control the movement."
    if 'side plank' in n:
        return "A push-up combined with a side plank rotation at the top, adding an anti-rotation core challenge. The pressing portion trains the pec major while the rotation develops oblique and shoulder stability."
    if 'band' in n or 'resistance band' in n:
        return "A push-up with a resistance band across the back that adds ascending resistance, increasing load at lockout. This overloads the shortened position of the pec major where bodyweight alone provides minimal challenge."
    if 'kettlebell' in n:
        return "A plyometric push-up performed on kettlebells that increases range of motion and explosive demand. The elevated hand position allows a deeper stretch on the pec major at the bottom of each rep."
    if 'clock' in n:
        return "A push-up variation where hand positions rotate around a clock face, training the pec major through multiple angles in a single set. This challenges different fiber orientations and builds well-rounded chest strength."
    return "A bodyweight pressing exercise that targets the pec major, anterior deltoid, and triceps. The push-up loads the chest hardest at the bottom position where the pec is stretched, making it effective for hypertrophy when performed through full range of motion."

def _dip_desc(name):
    return "A compound bodyweight exercise performed on parallel bars with a forward lean to emphasize the chest. The deep stretch at the bottom position loads the sternal pec fibers at long muscle lengths, providing strong stimulus for stretch-mediated hypertrophy. Dips also heavily involve the triceps and anterior deltoid."

def _pullover_desc(el, name):
    n = name.lower()
    if 'cable' in n:
        return "A cable pullover that trains the costal pec major and lats through shoulder extension. The cable provides constant tension throughout the arc, unlike dumbbells which lose tension at the top, making this effective for sustained pec loading."
    if 'front raise' in n:
        return "A combination movement that pairs a front raise with a pullover, training the anterior deltoid and costal pec major in sequence. The pullover portion loads the pec at long muscle lengths where it has good leverage."
    if 'straight-arm' in n or 'straight arm' in n:
        return f"A {el} pullover performed with arms extended, which increases the moment arm and loading on the costal pec major at the stretched overhead position. The straight-arm position maximizes the stretch stimulus on the pec and serratus anterior."
    if 'bent-arm' in n or 'bent arm' in n:
        return f"A {el} pullover with bent arms that reduces the moment arm compared to the straight-arm variant, allowing heavier loads. The costal pec major is the primary mover at the stretched overhead position where lats have poor leverage."
    if 'decline' in n:
        return f"A decline {el} pullover that increases the range of motion by starting from a lower position. The decline angle enhances the stretch on the costal pec major at the bottom, increasing stretch-mediated hypertrophy potential."
    if 'wide-grip' in n:
        return f"A wide-grip {el} pullover that increases the stretch on the pec major and lats at the bottom position. The wider grip shifts emphasis toward the costal pec fibers and increases the moment arm at the stretched position."
    return f"A {el} pullover that primarily targets the costal pec major at long muscle lengths where lats have poor leverage. The overhead stretch position provides excellent stimulus for stretch-mediated hypertrophy of the chest."

def _crossover_desc(el, name):
    n = name.lower()
    if 'high' in n:
        return "A cable crossover performed from high pulleys, directing the line of pull downward and emphasizing the sternal (lower) pec fibers. The high angle creates peak tension at the stretched position with arms wide, providing good stretch-mediated stimulus."
    if 'low' in n:
        return "A cable crossover from low pulleys that directs the line of pull upward, emphasizing the clavicular (upper) pec fibers. The low-to-high arc provides constant cable tension with peak loading in the mid-range."
    if 'single' in n:
        return "A unilateral cable crossover that isolates one pec at a time, allowing focused contraction and correction of asymmetries. The single-arm approach also adds a rotational core stability demand."
    if 'iron cross' in n:
        return "A cable exercise performed with arms extended wide in a crucifix position, isometrically loading the pec major at a stretched position. This challenges the pec through horizontal adduction against constant cable tension."
    if 'band' in n:
        return "A crossover movement using resistance bands that creates an ascending resistance curve. Peak tension occurs at the squeezed position, complementing exercises that load the stretch."
    if 'seated' in n:
        return "A seated cable fly that stabilizes the torso and isolates the pec major through horizontal adduction. The seated position eliminates momentum and lower body involvement."
    return "A standing cable crossover that provides constant tension on the pec major throughout the full range of horizontal adduction. The cable direction can be adjusted to target different pec fiber angles, and the movement is excellent for high-rep chest isolation work."

def _squeeze_desc(el, name):
    n = name.lower()
    if 'svend' in n:
        return "An isolation exercise where plates are squeezed together and pressed forward, loading the pec major in the shortened position through isometric adduction. This targets the inner chest with constant tension and minimal joint stress."
    if 'hex' in n:
        return "A dumbbell press performed with hexagonal dumbbells squeezed together throughout the movement. The constant inward pressure creates an isometric adduction component that increases inner pec activation alongside the pressing motion."
    if 'plate' in n:
        return "A pressing movement performed while squeezing a weight plate between the palms, creating constant isometric adduction of the pec major. This targets the shortened position of the chest with minimal equipment."
    return f"A {el} squeeze press that combines pressing with isometric adduction, emphasizing the pec major in its shortened position. The constant inward squeeze increases inner chest activation throughout the range of motion."

def _explosive_desc(name):
    n = name.lower()
    if 'medicine ball' in n or 'chest pass' in n:
        return "An explosive chest pass using a medicine ball that develops horizontal pushing power. The ballistic nature trains rate of force development in the pec major and triceps, useful for athletic performance."
    if 'heavy bag' in n:
        return "An explosive pushing movement against a heavy bag that develops chest and shoulder power. The bag provides variable resistance and absorbs force, allowing maximal effort pushing without deceleration."
    if 'chest throw' in n or 'supine' in n:
        return "A supine explosive throw that trains the pec major and triceps through ballistic horizontal pressing. The release at the top allows full acceleration without deceleration, maximizing power output."
    if 'drop push' in n:
        return "A plyometric exercise where you drop from a height and immediately push explosively, training the stretch-shortening cycle of the pec major. This develops reactive strength and power in the chest and triceps."
    if 'forward drag' in n:
        return "A combination movement that pairs a forward drag with a pressing action, challenging the pec major and anterior deltoid under fatigue. The drag component adds a conditioning element to the pressing pattern."
    if 'chest push' in n:
        if 'multiple' in n:
            return "An explosive chest push drill with multiple responses that develops reactive pushing power. The repeated efforts train the pec major and triceps to produce force rapidly across consecutive reps."
        if 'single' in n:
            return "An explosive single-response chest push that develops maximal pushing power from a set position. This trains the pec major and triceps to produce peak force in a single effort."
        if '3 point' in n:
            return "A chest push initiated from a three-point stance that develops explosive horizontal pushing power. The athletic starting position trains force production through the pec major and anterior chain."
        if 'run' in n:
            return "A chest push combined with a run release that develops transitional power from pushing to sprinting. This trains the pec major explosively while integrating lower body movement."
    return "An explosive chest exercise that develops power and rate of force development in the pec major. The ballistic nature trains fast-twitch muscle fibers for athletic performance."

def _isometric_desc(name):
    n = name.lower()
    if 'squeeze' in n:
        return "An isometric chest exercise where the palms are pressed together in front of the body, maximally contracting the pec major in its shortened position. This builds mind-muscle connection and can be used as an activation drill or finisher."
    if 'wiper' in n:
        return "An isometric exercise combining chest activation with a wiping motion that challenges the pec major through sustained contraction. This builds endurance in the shortened position and improves mind-muscle connection."
    return "An isometric chest exercise that trains the pec major through sustained contraction without joint movement. This is useful for activation, rehabilitation, and building the mind-muscle connection."

def _mobility_desc(name):
    n = name.lower()
    if 'stability ball' in n:
        return "A passive chest stretch over a stability ball that uses gravity to open the pectorals. The ball supports the thoracic spine while allowing the shoulders to drop into horizontal abduction, lengthening both pec heads."
    if 'dynamic' in n:
        return "A dynamic mobility drill that takes the pectorals through their full range with controlled arm movements. This improves tissue extensibility and prepares the chest for loaded training."
    if 'elbows back' in n:
        return "A chest opener where the elbows are drawn behind the torso, stretching the pec major and anterior deltoid. This targets the shortened position that develops from prolonged sitting and pressing."
    if 'front of shoulder' in n:
        return "A combined chest and anterior deltoid stretch that lengthens the pec major at the shoulder joint. Holding the arms behind the body places the pectorals in a fully lengthened position."
    return "A chest stretch that lengthens the pectoral fibers through passive positioning. This targets both the sternal and clavicular heads of the pec major, improving range of motion for pressing movements."

def get_description(cat, ang, el, name):
    if cat == 'mobility': return _mobility_desc(name)
    if cat == 'bench': return _bench_desc(ang, el, name)
    if cat == 'fly': return _fly_desc(ang, el, name)
    if cat == 'pushup': return _pushup_desc(ang, el, name)
    if cat == 'dip': return _dip_desc(name)
    if cat == 'pullover': return _pullover_desc(el, name)
    if cat == 'crossover': return _crossover_desc(el, name)
    if cat == 'squeeze': return _squeeze_desc(el, name)
    if cat == 'explosive': return _explosive_desc(name)
    if cat == 'isometric': return _isometric_desc(name)
    if cat == 'landmine': return _bench_desc(ang, el, name)
    return f"A chest exercise using {el} that targets the pectoralis major. This movement trains the chest through its primary function of horizontal adduction and shoulder flexion."


# --- TIPS ---

_BENCH_TIPS_BASE = [
    'Retract and depress your scapulae before unracking to create a stable pressing platform',
    'Lower the bar under control to maximize time under tension at the stretched position',
    'Drive your feet into the floor to maintain full-body tension',
]
_BENCH_TIPS_BB = ['Grip the bar just outside shoulder width for optimal pec activation', 'Avoid bouncing the bar off your chest — pause briefly at the bottom']
_BENCH_TIPS_DB = ['Allow the dumbbells to travel slightly deeper than a barbell would permit', 'Keep wrists neutral and stacked over elbows throughout the press', 'Control the dumbbells independently — do not let them drift outward']
_BENCH_TIPS_MACHINE = ['Adjust the seat height so handles align with mid-chest', 'Focus on squeezing the chest at the top rather than locking out aggressively', 'Use the machine path to maintain constant tension without stabilizer fatigue']
_BENCH_TIPS_CABLE = ['Set the pulleys to chest height for a flat press angle', 'Step forward to create tension at the start position', 'Squeeze the chest hard at the end of each rep']
_BENCH_TIPS_KB = ['Keep the kettlebell handle diagonal across the palm for wrist comfort', 'Press in a slight arc rather than straight up', 'Control the offset load — do not let the bell pull your wrist back']

_FLY_TIPS_DB = [
    'Keep a slight bend in the elbows throughout — do not turn this into a press',
    'Lower the dumbbells until you feel a deep stretch across the chest',
    'Control the eccentric phase for at least 2 seconds to maximize stretch stimulus',
    'Avoid going so deep that you feel shoulder joint pain',
]
_FLY_TIPS_CABLE = [
    'Keep elbows slightly bent and fixed throughout the movement',
    'Squeeze the chest at the midline — imagine hugging a tree',
    'Control the return to the stretched position rather than letting cables pull you back',
    'Adjust pulley height to target different pec fiber angles',
]
_FLY_TIPS_MACHINE = [
    'Adjust the seat so your upper arms are parallel to the floor at the start',
    'Do not let the weight stack touch down between reps — maintain tension',
    'Focus on the squeeze at the midline rather than the stretch',
    'Keep your back flat against the pad throughout',
]

_PUSHUP_TIPS_BASE = [
    'Keep your body in a straight line from head to heels — no sagging hips',
    'Lower your chest to the floor, not just your chin',
    'Protract your scapulae at the top to fully shorten the pec',
    'Engage your core throughout to prevent lumbar extension',
]

_DIP_TIPS = [
    'Lean forward approximately 30 degrees to shift emphasis from triceps to chest',
    'Lower until your upper arms are at least parallel to the floor for full pec stretch',
    'Keep elbows slightly flared rather than tucked to increase pec involvement',
    'Control the descent — do not drop into the bottom position',
    'If bodyweight is too easy, add load with a belt rather than increasing speed',
]

_PULLOVER_TIPS = [
    'Keep your hips low and ribcage elevated to maximize the stretch overhead',
    'Do not let the weight pull your lower back into excessive extension',
    'Focus on pulling with the chest, not the lats — think about squeezing your pecs',
    'Use a controlled tempo, especially in the stretched position',
]

_CROSSOVER_TIPS = [
    'Keep elbows slightly bent and locked in position throughout',
    'Step forward with one foot for balance and to pre-stretch the chest',
    'Squeeze the cables together at the midline for a full contraction',
    'Control the eccentric — do not let the cables snap your arms back',
]

_SQUEEZE_TIPS = [
    'Squeeze the weight as hard as possible throughout the entire set',
    'Press forward at chest height, not upward',
    'Focus on the isometric adduction — this is what activates the inner chest',
    'Keep shoulders down and back, do not round forward',
]

_EXPLOSIVE_TIPS = [
    'Focus on maximum acceleration through the pressing phase',
    'Absorb the landing or catch with soft elbows',
    'Warm up thoroughly before explosive movements',
    'Quality of each rep matters more than quantity',
]

_MOBILITY_TIPS = ['Hold for 20-30 seconds', 'Breathe deeply throughout', 'Do not bounce']

def get_tips(cat, ang, el, name):
    n = name.lower()
    if cat == 'mobility': return _MOBILITY_TIPS
    if cat == 'bench':
        base = list(_BENCH_TIPS_BASE)
        if 'dumbbell' in el or 'kettlebell' in el:
            base.extend(_BENCH_TIPS_DB[:2] if 'kettlebell' in el else _BENCH_TIPS_DB[:3])
        elif 'machine' in el.lower() or 'smith' in el.lower():
            base.extend(_BENCH_TIPS_MACHINE[:2])
        elif 'cable' in el:
            base.extend(_BENCH_TIPS_CABLE[:2])
        elif 'band' in el:
            base.append('Anchor the band securely and check for wear before each set')
        else:
            base.extend(_BENCH_TIPS_BB[:2])
        if 'floor press' in n:
            base = ['Let your upper arms touch the floor briefly at the bottom — this is your range limiter',
                     'Keep your legs flat or bent depending on your low back comfort',
                     'Press straight up, not back toward your face',
                     'Retract your scapulae even without a bench for support']
        if 'guillotine' in n or 'neck press' in n:
            base.append('Use lighter weight than standard bench — the shoulder is in a vulnerable position')
        if ang == 'incline':
            base.append('Set the bench to 30-45 degrees — steeper angles shift work to the deltoids')
        if ang == 'decline':
            base.append('Secure your legs firmly and have a spotter for barbell variants')
        return base[:5]
    if cat == 'fly':
        if 'machine' in el or 'pec deck' in n or 'butterfly' in n:
            return _FLY_TIPS_MACHINE[:4]
        if 'cable' in el:
            return _FLY_TIPS_CABLE[:4]
        if 'band' in el:
            return ['Keep elbows slightly bent throughout', 'Anchor the band at chest height behind you',
                    'Squeeze at the midline for peak contraction', 'Control the return to avoid band snap-back']
        tips = list(_FLY_TIPS_DB)
        if ang == 'incline':
            tips.append('Set the bench to 30-45 degrees to bias the upper pec fibers')
        if ang == 'decline':
            tips.append('Secure your legs and use moderate weight — decline flyes are harder to control')
        return tips[:5]
    if cat == 'pushup':
        tips = list(_PUSHUP_TIPS_BASE)
        if 'clap' in n or 'plyo' in n:
            tips.append('Land with soft elbows to absorb impact and protect your joints')
        if 'band' in n:
            tips.append('Loop the band across your upper back and anchor under your palms')
        if 'archer' in n:
            tips.append('Keep the extended arm straight as a lever — it should not bend')
        if 'single' in n or 'one arm' in n:
            tips.append('Widen your feet for balance and rotate your torso slightly toward the working arm')
        return tips[:5]
    if cat == 'dip': return _DIP_TIPS[:5]
    if cat == 'pullover': return _PULLOVER_TIPS[:4]
    if cat == 'crossover':
        tips = list(_CROSSOVER_TIPS)
        if 'high' in n: tips.append('Pull downward and inward — think about touching your hip pockets')
        if 'low' in n: tips.append('Drive upward and inward — finish at eye level')
        return tips[:5]
    if cat == 'squeeze': return _SQUEEZE_TIPS[:4]
    if cat == 'isometric': return ['Press palms together as hard as possible', 'Hold each contraction for 5-10 seconds',
                                    'Breathe normally — do not hold your breath', 'Keep shoulders down and relaxed']
    if cat == 'explosive': return _EXPLOSIVE_TIPS[:4]
    if cat == 'landmine': return ['Press in an arc following the barbell path', 'Brace your core throughout',
                                   'Use a staggered stance for balance', 'Do not hyperextend at the top']
    return ['Control the eccentric phase', 'Use full range of motion', 'Maintain stable shoulders']

# --- COACHING CUES ---

_BENCH_CUES = ['Chest up, shoulders back', 'Drive through the floor', 'Press and spread']
_FLY_CUES_DB = ['Big stretch at the bottom', 'Hug a barrel', 'Slow on the way down']
_FLY_CUES_CABLE = ['Squeeze at the midline', 'Elbows locked, chest does the work', 'Control the stretch back']
_FLY_CUES_MACHINE = ['Squeeze and hold', 'Elbows up, chest forward', 'Smooth and controlled']
_PUSHUP_CUES = ['Chest to the floor', 'Body like a plank', 'Push the ground away']
_DIP_CUES = ['Lean forward', 'Deep stretch at the bottom', 'Elbows out slightly', 'Drive up strong']
_PULLOVER_CUES = ['Reach back and stretch', 'Pull with your chest', 'Ribs down, core tight']
_CROSSOVER_CUES = ['Squeeze at the center', 'Arms like a hug', 'Control the return']
_SQUEEZE_CUES = ['Squeeze hard the whole time', 'Press forward, not up', 'Feel the inner chest']
_EXPLOSIVE_CUES = ['Explode off the ground', 'Fast hands', 'Absorb the landing']
_MOBILITY_CUES = ['Relax into the stretch', 'Feel the chest open']
_ISOMETRIC_CUES = ['Press harder', 'Breathe through it', 'Shoulders down']

def get_cues(cat, ang, el, name):
    n = name.lower()
    if cat == 'mobility': return _MOBILITY_CUES
    if cat == 'bench':
        cues = list(_BENCH_CUES)
        if 'dumbbell' in el: cues.append('Dumbbells together at the top')
        if ang == 'incline': cues = ['Drive into the bench', 'Elbows at 45 degrees', 'Press up and together']
        if ang == 'decline': cues = ['Chest up even on the decline', 'Control the bar path', 'Press and squeeze']
        if 'floor' in n: cues = ['Arms touch the floor, then press', 'Elbows at 45', 'Explode up']
        if 'one arm' in n or 'single arm' in n: cues = ['Brace your core', 'Press straight up', 'Control the weight']
        return cues[:4]
    if cat == 'fly':
        if 'machine' in el or 'pec deck' in n or 'butterfly' in n: return _FLY_CUES_MACHINE
        if 'cable' in el: return _FLY_CUES_CABLE
        return _FLY_CUES_DB
    if cat == 'pushup':
        cues = list(_PUSHUP_CUES)
        if 'clap' in n or 'plyo' in n: cues = ['Explode up', 'Soft landing', 'Chest to floor first']
        if 'archer' in n: cues = ['Shift to one side', 'Chest down', 'Push through the working arm']
        return cues[:4]
    if cat == 'dip': return _DIP_CUES
    if cat == 'pullover': return _PULLOVER_CUES
    if cat == 'crossover':
        cues = list(_CROSSOVER_CUES)
        if 'high' in n: cues.insert(0, 'Pull down and in')
        if 'low' in n: cues.insert(0, 'Drive up and in')
        return cues[:4]
    if cat == 'squeeze': return _SQUEEZE_CUES
    if cat == 'isometric': return _ISOMETRIC_CUES
    if cat == 'explosive': return _EXPLOSIVE_CUES
    if cat == 'landmine': return ['Arc the press up', 'Brace and drive', 'Control the path']
    return ['Control the weight', 'Full range of motion', 'Squeeze at the top']
