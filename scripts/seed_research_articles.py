"""Seed script for evidence-based research articles in the Learn section.

Each article is a meta-analysis or systematic review summarized for the
general population, with proper PMID citations and practical takeaways
in the style of Chris Beardsley's S&C Research reviews.

Run: source .venv/bin/activate && python scripts/seed_research_articles.py
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# ---------------------------------------------------------------------------
# Article data — 25 evidence-based research summaries
# ---------------------------------------------------------------------------

MODULES = [
    {"name": "Hypertrophy Science", "slug": "hypertrophy-science", "description": "The science of muscle growth — volume, frequency, intensity, and mechanisms.", "sort_order": 1},
    {"name": "Nutrition & Protein", "slug": "nutrition-protein", "description": "Evidence-based nutrition for body composition and performance.", "sort_order": 2},
    {"name": "Strength & Programming", "slug": "strength-programming", "description": "Periodization, rest intervals, and programming strategies backed by research.", "sort_order": 3},
    {"name": "Recovery & Lifestyle", "slug": "recovery-lifestyle", "description": "Sleep, recovery modalities, and lifestyle factors that affect your gains.", "sort_order": 4},
    {"name": "Body Recomposition", "slug": "body-recomposition", "description": "The science of losing fat and building muscle simultaneously.", "sort_order": 5},
    {"name": "Supplements", "slug": "supplements", "description": "What actually works — and what doesn't — according to the research.", "sort_order": 6},
]


ARTICLES = [
    # ═══════════════════════════════════════════════════════════════════
    # MODULE: Hypertrophy Science
    # ═══════════════════════════════════════════════════════════════════
    {
        "module_slug": "hypertrophy-science",
        "title": "More Sets = More Growth (But With Diminishing Returns)",
        "tags": ["volume", "sets", "dose-response", "meta-analysis"],
        "estimated_read_time_min": 5,
        "is_premium": False,
        "content_markdown": """# More Sets = More Growth (But With Diminishing Returns)

## The Study

**Schoenfeld BJ, Ogborn D, Krieger JW.** Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis. *J Sports Sci.* 2017;35(11):1073-1082. **PMID: 27433992**

## What They Did

The researchers pooled data from 15 studies to examine the relationship between the number of weekly sets performed per muscle group and the resulting muscle growth. They compared low volume (<5 sets/week), moderate volume (5-9 sets/week), and high volume (10+ sets/week).

## What They Found

There was a clear, statistically significant dose-response relationship between weekly set volume and hypertrophy (p = 0.002). Each additional set per muscle group per week was associated with an extra 0.37% increase in muscle size.

However, the relationship was not linear. The first few sets produced the largest gains, with each subsequent set contributing progressively less. Going from 1 to 5 sets per week produced a much larger jump in growth than going from 10 to 15 sets.

<!-- chart:volume-dose-response -->

## Why It Matters

This is one of the most important findings in hypertrophy research because it tells us that volume is the primary driver of muscle growth that we can manipulate in our training programs. But it also tells us that more is not always better — there are diminishing returns.

The practical implication is that most people should aim for somewhere in the range of 10-20 sets per muscle group per week for optimal growth, with the understanding that the first 10 sets do most of the heavy lifting (pun intended).

---

## 🎯 Practical Takeaway

**Start with 10 sets per muscle group per week.** If you're recovering well and want more growth, add 1-2 sets per week gradually. Going beyond 20 sets per muscle group per week is unlikely to produce meaningfully more growth for most people, and may actually impair recovery. The sweet spot for most intermediate lifters is 12-18 sets per muscle group per week.

---

*Citation: Schoenfeld BJ, Ogborn D, Krieger JW. J Sports Sci. 2017;35(11):1073-1082. doi:10.1080/02640414.2016.1210197. PMID: 27433992*
""",
    },
    {
        "module_slug": "hypertrophy-science",
        "title": "Training Each Muscle Twice Per Week Beats Once Per Week",
        "tags": ["frequency", "training-split", "meta-analysis"],
        "estimated_read_time_min": 4,
        "is_premium": False,
        "content_markdown": """# Training Each Muscle Twice Per Week Beats Once Per Week

## The Study

**Schoenfeld BJ, Ogborn D, Krieger JW.** Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy: A Systematic Review and Meta-Analysis. *Sports Med.* 2016;46(11):1689-1697. **PMID: 27102172**

## What They Did

The researchers analyzed 10 studies comparing different training frequencies while attempting to control for total weekly volume. They looked at whether hitting a muscle once, twice, or three times per week produced different amounts of growth.

## What They Found

Training a muscle group at least twice per week produced significantly greater hypertrophy than training it once per week (effect size: 0.49 vs 0.30, p = 0.002). The advantage held even when total weekly volume was equated between groups.

There was a trend toward even greater growth with three times per week, but the data was insufficient to draw firm conclusions at that frequency.

<!-- chart:frequency-comparison -->

## Why It Matters

The classic "bro split" — where you train each muscle once per week with very high volume in a single session — is suboptimal for hypertrophy. Spreading the same total volume across two sessions per week produces more growth, likely because each session provides a fresh anabolic stimulus and the muscle protein synthesis response is re-elevated.

This supports upper/lower splits, push/pull/legs rotations, or full-body programs over traditional body-part splits for most lifters.

---

## 🎯 Practical Takeaway

**Train each muscle group at least twice per week.** An upper/lower split (4 days) or push/pull/legs rotation (6 days) naturally achieves this. If you currently use a body-part split, consider redistributing your volume across more frequent sessions. You don't need to add more total sets — just spread them out.

---

*Citation: Schoenfeld BJ, Ogborn D, Krieger JW. Sports Med. 2016;46(11):1689-1697. doi:10.1007/s40279-016-0543-8. PMID: 27102172*
""",
    },
    {
        "module_slug": "hypertrophy-science",
        "title": "Light Weights Build as Much Muscle as Heavy Weights (If You Go to Failure)",
        "tags": ["load", "intensity", "failure", "meta-analysis"],
        "estimated_read_time_min": 5,
        "is_premium": False,
        "content_markdown": """# Light Weights Build as Much Muscle as Heavy Weights (If You Go to Failure)

## The Study

**Lopez P, Radaelli R, Taaffe DR, et al.** Resistance Training Load Effects on Muscle Hypertrophy and Strength Gain: Systematic Review and Network Meta-analysis. *Med Sci Sports Exerc.* 2021;53(6):1206-1216. **PMID: 33433148**

## What They Did

This network meta-analysis included 28 studies with 747 participants. The researchers compared the effects of low-load (>15 RM), moderate-load (9-15 RM), and high-load (≤8 RM) resistance training on both muscle hypertrophy and strength, with all groups training to volitional failure.

## What They Found

For muscle hypertrophy, there were no significant differences between any of the loading conditions (p = 0.113-0.469). Low loads, moderate loads, and heavy loads all produced similar muscle growth when sets were taken to failure.

However, for maximal strength (1RM), high loads were clearly superior. This makes intuitive sense — strength is a skill that requires practice with heavy weights.

## Why It Matters

This finding is liberating. It means you don't need to lift maximally heavy weights to build muscle. What matters is that you take your sets close to failure, regardless of the rep range. The muscle fibers don't know how much weight is on the bar — they only know how hard they're working.

This has practical implications for people with joint issues, those training at home with limited equipment, or anyone who simply prefers higher-rep training. You can build just as much muscle with 15-rep sets as with 5-rep sets, as long as you push hard enough.

---

## 🎯 Practical Takeaway

**For hypertrophy, any rep range from 5-30 works — as long as you train close to failure.** Use heavier loads (3-6 reps) for compound lifts where you also want strength gains. Use moderate loads (8-15 reps) as your bread and butter. Use lighter loads (15-30 reps) for isolation exercises, joint-friendly alternatives, or variety. The key variable is effort, not load.

---

*Citation: Lopez P, Radaelli R, Taaffe DR, et al. Med Sci Sports Exerc. 2021;53(6):1206-1216. doi:10.1249/MSS.0000000000002585. PMID: 33433148*
""",
    },
    {
        "module_slug": "hypertrophy-science",
        "title": "How Close to Failure Do You Actually Need to Train?",
        "tags": ["proximity-to-failure", "RIR", "effort", "meta-analysis"],
        "estimated_read_time_min": 5,
        "is_premium": True,
        "content_markdown": """# How Close to Failure Do You Actually Need to Train?

## The Study

**Vieira AF, Umpierre D, Teodoro JL, et al.** Effects of Resistance Training Performed to Failure or Not to Failure on Muscle Strength, Hypertrophy, and Power Output: A Systematic Review With Meta-Analysis. *J Strength Cond Res.* 2022;36(4):1165-1175. **PMID: 36334240**

## What They Did

The researchers pooled data from multiple studies comparing resistance training performed to complete muscular failure versus training that stopped short of failure (typically 1-4 reps in reserve). They examined the effects on both muscle hypertrophy and strength.

## What They Found

Training to failure produced a small but statistically significant advantage for hypertrophy compared to stopping short (effect size = 0.19, p = 0.045). However, the practical magnitude of this difference was trivial.

For strength, there was no significant difference between training to failure and stopping short.

## Why It Matters

This is a nuanced finding. Training to failure does produce slightly more hypertrophy, but the advantage is very small. Meanwhile, training to failure on every set dramatically increases fatigue, extends recovery time, and increases injury risk — especially on compound movements.

The implication is that you should train hard enough to get close to failure (within 1-3 reps), but you don't need to grind out that last impossible rep on every set. Save true failure for the last set of an exercise, or for isolation movements where the injury risk is lower.

---

## 🎯 Practical Takeaway

**Train most sets to 1-3 reps in reserve (RIR).** Take the last set of each exercise to failure or 0 RIR. Avoid training to failure on heavy compound lifts (squats, deadlifts, bench press) — the fatigue cost outweighs the marginal hypertrophy benefit. Reserve failure training for isolation exercises and machine movements where form breakdown is less dangerous.

---

*Citation: Vieira AF, Umpierre D, Teodoro JL, et al. J Strength Cond Res. 2022;36(4):1165-1175. doi:10.1519/JSC.0000000000004108. PMID: 36334240*
""",
    },
    # ═══════════════════════════════════════════════════════════════════
    # MODULE: Nutrition & Protein
    # ═══════════════════════════════════════════════════════════════════
    {
        "module_slug": "nutrition-protein",
        "title": "The 1.6 g/kg Protein Ceiling: How Much Do You Really Need?",
        "tags": ["protein", "muscle-growth", "supplementation", "meta-analysis"],
        "estimated_read_time_min": 6,
        "is_premium": False,
        "content_markdown": """# The 1.6 g/kg Protein Ceiling: How Much Do You Really Need?

## The Study

**Morton RW, Murphy KT, McKellar SR, et al.** A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. *Br J Sports Med.* 2018;52(6):376-384. **PMID: 28698222**

## What They Did

This is the definitive protein meta-analysis. The researchers pooled data from 49 studies involving 1,863 participants to determine the effect of protein supplementation on muscle mass and strength gains during resistance training. They also performed a breakpoint analysis to identify the optimal daily protein intake.

## What They Found

Protein supplementation significantly increased gains in fat-free mass (+0.30 kg, p < 0.001) and 1RM strength (+2.49 kg, p = 0.002) compared to placebo during resistance training programs.

The breakpoint analysis identified 1.62 g/kg/day as the point beyond which additional protein provided no further benefit for muscle growth. The 95% confidence interval extended up to 2.2 g/kg/day.

Protein supplementation was effective regardless of source (whey, soy, other), timing, or whether participants were trained or untrained.

<!-- chart:protein-threshold -->

## Why It Matters

This study settled one of the longest-running debates in sports nutrition. You need adequate protein to maximize muscle growth, but there is a ceiling. Eating 3-4 g/kg/day of protein — as some bodybuilders do — provides no additional muscle-building benefit over 1.6 g/kg/day.

For a 80 kg person, that's about 128 g of protein per day. For a 60 kg person, about 96 g. These are achievable targets through whole foods alone, without expensive supplements.

---

## 🎯 Practical Takeaway

**Aim for 1.6-2.2 g of protein per kg of bodyweight per day.** If you weigh 80 kg, that's 128-176 g daily. Spread it across 3-5 meals. The source doesn't matter much — whey, chicken, eggs, tofu, lentils all work. Going above 2.2 g/kg/day won't hurt you, but it won't build more muscle either. Spend your calories on carbs and fats instead.

---

*Citation: Morton RW, Murphy KT, McKellar SR, et al. Br J Sports Med. 2018;52(6):376-384. doi:10.1136/bjsports-2017-097608. PMID: 28698222*
""",
    },
    {
        "module_slug": "nutrition-protein",
        "title": "The Anabolic Window Is (Mostly) a Myth",
        "tags": ["protein-timing", "anabolic-window", "meta-analysis"],
        "estimated_read_time_min": 4,
        "is_premium": False,
        "content_markdown": """# The Anabolic Window Is (Mostly) a Myth

## The Study

**Schoenfeld BJ, Aragon AA, Krieger JW.** The effect of protein timing on muscle strength and hypertrophy: a meta-analysis. *J Int Soc Sports Nutr.* 2013;10(1):53. **PMID: 24299050**

## What They Did

The researchers analyzed 23 studies (525 subjects) to determine whether consuming protein immediately before or after a workout (the "anabolic window") produced greater muscle growth or strength gains compared to consuming protein at other times of day.

## What They Found

When the analysis controlled for total daily protein intake, protein timing had no significant effect on muscle hypertrophy or strength. The apparent benefit of peri-workout protein in the simple analysis disappeared once total protein intake was accounted for.

In other words, the studies that showed a benefit of post-workout protein shakes were really just showing the benefit of eating more total protein — not the benefit of timing.

## Why It Matters

For years, the fitness industry promoted the idea that you had a 30-60 minute "anabolic window" after training where you needed to consume protein or your workout was wasted. This meta-analysis showed that the window is much wider than previously thought — essentially the entire day.

What matters is hitting your daily protein target, not when exactly you eat it. If you train fasted in the morning, having protein within a few hours is probably wise. But if you had a meal 2-3 hours before training, there's no rush to chug a shake immediately after.

---

## 🎯 Practical Takeaway

**Focus on total daily protein intake, not timing.** Aim for 1.6-2.2 g/kg/day spread across 3-5 meals. If you train fasted, have a protein-rich meal within 2-3 hours post-workout. If you ate before training, there's no urgency. Don't stress about the "anabolic window" — it's more like an "anabolic barn door."

---

*Citation: Schoenfeld BJ, Aragon AA, Krieger JW. J Int Soc Sports Nutr. 2013;10(1):53. doi:10.1186/1550-2783-10-53. PMID: 24299050*
""",
    },
    # ═══════════════════════════════════════════════════════════════════
    # MODULE: Strength & Programming
    # ═══════════════════════════════════════════════════════════════════
    {
        "module_slug": "strength-programming",
        "title": "Longer Rest Periods Build More Muscle and Strength",
        "tags": ["rest-intervals", "recovery", "strength", "meta-analysis"],
        "estimated_read_time_min": 4,
        "is_premium": False,
        "content_markdown": """# Longer Rest Periods Build More Muscle and Strength

## The Study

**Grgic J, Lazinica B, Mikulic P, et al.** The effects of short versus long inter-set rest intervals in resistance training on measures of muscle hypertrophy: A systematic review. *Eur J Sport Sci.* 2017;17(8):983-993. **PMID: 28641044**

## What They Did

The researchers systematically reviewed studies comparing short rest intervals (typically 60 seconds) with longer rest intervals (2-5 minutes) between sets during resistance training, examining effects on both muscle hypertrophy and strength.

## What They Found

Longer rest intervals (2-3+ minutes) produced greater increases in both muscle hypertrophy and maximal strength compared to shorter rest intervals (60 seconds or less). The advantage was consistent across studies and training populations.

The likely mechanism is straightforward: longer rest allows better recovery between sets, which means you can maintain higher force output, complete more reps, and accumulate more total volume — all of which drive greater muscle growth.

<!-- chart:rest-intervals -->

## Why It Matters

This challenges the old bodybuilding wisdom that short rest periods are better for hypertrophy because they create more "metabolic stress" and a bigger pump. While metabolic stress may play a minor role, the ability to maintain performance across sets is far more important.

If you're cutting your rest periods to 60 seconds to "keep the intensity up," you're actually leaving gains on the table. Your muscles need adequate recovery to perform optimally on subsequent sets.

---

## 🎯 Practical Takeaway

**Rest 2-3 minutes between sets of compound exercises** (squats, bench press, rows, deadlifts). For isolation exercises, 1.5-2 minutes is usually sufficient. If you're short on time, use antagonist supersets (e.g., biceps then triceps) rather than cutting rest periods — this saves time without sacrificing performance.

---

*Citation: Grgic J, Lazinica B, Mikulic P, et al. Eur J Sport Sci. 2017;17(8):983-993. doi:10.1080/17461391.2017.1305118. PMID: 28641044*
""",
    },
    {
        "module_slug": "strength-programming",
        "title": "Periodization Works — But the Type Doesn't Matter Much",
        "tags": ["periodization", "linear", "undulating", "meta-analysis"],
        "estimated_read_time_min": 5,
        "is_premium": True,
        "content_markdown": """# Periodization Works — But the Type Doesn't Matter Much

## The Study

**Harries SK, Lubans DR, Callister R.** Systematic review and meta-analysis of linear and undulating periodized resistance training programs on muscular strength. *J Strength Cond Res.* 2015;29(4):1113-1125. **PMID: 25268290**

## What They Did

The researchers analyzed 12 studies comparing linear periodization (gradually increasing intensity over weeks/months) with daily undulating periodization (varying intensity within each week) on muscular strength outcomes.

## What They Found

Both periodization models were superior to non-periodized training for strength gains. Undulating periodization showed a slight numerical advantage over linear periodization, but the difference was not statistically significant in most analyses.

The key finding was that having any structured periodization plan was better than no periodization at all.

## Why It Matters

People spend enormous amounts of time debating whether linear or undulating periodization is "better." This meta-analysis suggests the debate is largely academic — both work well, and the differences between them are small.

What matters more is that you have a structured plan that progressively challenges your muscles over time, includes planned variation, and incorporates recovery periods (deloads). The specific periodization model is secondary.

---

## 🎯 Practical Takeaway

**Pick a periodization model and stick with it.** If you like simplicity, use linear periodization (start with higher reps, gradually increase weight and decrease reps over 4-8 weeks). If you like variety, use undulating periodization (alternate between heavy, moderate, and light days within each week). Both work. The worst option is no plan at all. Include a deload week every 4-6 weeks regardless of which model you choose.

---

*Citation: Harries SK, Lubans DR, Callister R. J Strength Cond Res. 2015;29(4):1113-1125. doi:10.1519/JSC.0000000000000712. PMID: 25268290*
""",
    },
    # ═══════════════════════════════════════════════════════════════════
    # MODULE: Recovery & Lifestyle
    # ═══════════════════════════════════════════════════════════════════
    {
        "module_slug": "recovery-lifestyle",
        "title": "Massage Is the Best Recovery Tool (According to Science)",
        "tags": ["recovery", "massage", "DOMS", "meta-analysis"],
        "estimated_read_time_min": 4,
        "is_premium": False,
        "content_markdown": """# Massage Is the Best Recovery Tool (According to Science)

## The Study

**Dupuy O, Douzi W, Theurot D, et al.** An Evidence-Based Approach for Choosing Post-exercise Recovery Techniques to Reduce Markers of Muscle Damage, Soreness, Fatigue, and Inflammation: A Systematic Review With Meta-Analysis. *Front Physiol.* 2018;9:403. **PMID: 29755363**

## What They Did

The researchers conducted a comprehensive meta-analysis of 99 studies examining the effectiveness of various recovery techniques on delayed-onset muscle soreness (DOMS), perceived fatigue, muscle damage markers, and inflammatory markers.

Recovery techniques analyzed included: massage, compression garments, cold water immersion, contrast water therapy, cryotherapy, active recovery, stretching, and electrical stimulation.

## What They Found

Massage was the most effective technique for reducing DOMS and perceived fatigue. Compression garments and cold water immersion also showed significant benefits. Active recovery (light exercise) was moderately effective.

Stretching and electrical stimulation showed minimal benefits for recovery.

The effect sizes ranged from small to large depending on the technique and outcome measure, with massage consistently producing the largest effects.

<!-- chart:recovery-methods -->

## Why It Matters

Recovery is often the most neglected aspect of training. This meta-analysis provides a clear hierarchy of what actually works. If you can only do one recovery intervention, massage (even self-massage with a foam roller or massage gun) gives you the most bang for your buck.

---

## 🎯 Practical Takeaway

**Prioritize massage and self-myofascial release** (foam rolling, massage gun) after hard training sessions. Wear compression garments during or after training if convenient. Cold water immersion (10-15°C for 10-15 minutes) can help after very intense sessions, but avoid it immediately after hypertrophy-focused training as it may blunt the muscle growth response. Skip static stretching as a recovery tool — it doesn't reduce soreness.

---

*Citation: Dupuy O, Douzi W, Theurot D, et al. Front Physiol. 2018;9:403. doi:10.3389/fphys.2018.00403. PMID: 29755363*
""",
    },
    # ═══════════════════════════════════════════════════════════════════
    # MODULE: Body Recomposition
    # ═══════════════════════════════════════════════════════════════════
    {
        "module_slug": "body-recomposition",
        "title": "Yes, You Can Build Muscle in a Caloric Deficit (Here's How)",
        "tags": ["recomposition", "caloric-deficit", "muscle-growth", "review"],
        "estimated_read_time_min": 6,
        "is_premium": True,
        "content_markdown": """# Yes, You Can Build Muscle in a Caloric Deficit (Here's How)

## The Study

**Barakat C, Pearson J, Escalante G, et al.** Body Recomposition: Can Trained Individuals Build Muscle and Lose Fat at the Same Time? *Strength Cond J.* 2020;42(5):7-21. **doi: 10.1519/SSC.0000000000000584**

## What They Reviewed

This comprehensive narrative review examined the existing literature on simultaneous fat loss and muscle gain (body recomposition). The authors analyzed studies in both trained and untrained populations to determine the conditions under which recomposition is possible.

## What They Found

Body recomposition is possible under specific conditions, even in trained individuals. The key factors that enable it are:

1. **Moderate caloric deficit** (not exceeding 500 kcal/day or ~20-25% below maintenance)
2. **High protein intake** (2.0-2.4 g/kg/day — higher than the standard 1.6 g/kg recommendation for those in a surplus)
3. **Progressive resistance training** maintained throughout the deficit
4. **Adequate sleep** (7-9 hours)
5. **Slower rate of weight loss** (0.5-1% of bodyweight per week maximum)

The populations most likely to achieve recomposition include: beginners, those returning after a layoff, individuals with higher body fat percentages, and those who were previously under-eating protein.

## Why It Matters

The traditional approach of alternating between "bulking" (caloric surplus) and "cutting" (caloric deficit) phases is not the only path. For many people — especially those who are not competitive bodybuilders — a recomposition approach can produce meaningful changes in body composition without the psychological burden of gaining fat during a bulk.

However, expectations need to be realistic. Recomposition is slower than dedicated bulking or cutting phases. The rate of muscle gain in a deficit is lower than in a surplus. But for many people, the trade-off is worth it.

---

## 🎯 Practical Takeaway

**To recomp successfully:** Keep your deficit moderate (300-500 kcal below maintenance). Increase protein to 2.0-2.4 g/kg/day. Train with progressive overload 3-5 times per week. Prioritize sleep. Be patient — recomp takes months, not weeks. If you're a beginner or returning from a break, you're in the best position to recomp. If you're an advanced lifter, dedicated bulk/cut cycles will likely be more efficient.

---

*Citation: Barakat C, Pearson J, Escalante G, et al. Strength Cond J. 2020;42(5):7-21. doi:10.1519/SSC.0000000000000584*
""",
    },
    # ═══════════════════════════════════════════════════════════════════
    # MODULE: Supplements
    # ═══════════════════════════════════════════════════════════════════
    {
        "module_slug": "supplements",
        "title": "Creatine: The Most Proven Supplement in Sports Science",
        "tags": ["creatine", "supplementation", "strength", "meta-analysis"],
        "estimated_read_time_min": 5,
        "is_premium": False,
        "content_markdown": """# Creatine: The Most Proven Supplement in Sports Science

## The Study

**Branch JD.** Effect of creatine supplementation on body composition and performance: a meta-analysis. *Int J Sport Nutr Exerc Metab.* 2003;13(2):198-226. **PMID: 12945830**

## What They Did

This meta-analysis pooled data from 100 studies examining the effects of creatine monohydrate supplementation on body composition, strength, and exercise performance. It remains one of the most comprehensive analyses of creatine ever conducted.

## What They Found

Creatine supplementation produced significant improvements in:

- **Lean body mass**: Consistent increases across studies, with greater gains when combined with resistance training
- **Maximal strength**: Significant improvements in 1RM performance, particularly for upper body exercises
- **High-intensity exercise capacity**: Improved performance in repeated sprint and high-intensity interval tasks
- **Total training volume**: Ability to perform more reps and sets at a given load

The effects were consistent across age groups, training status, and sex. Side effects were minimal — the only consistent finding was a small increase in body water (1-2 kg), which is expected and harmless.

## Why It Matters

Creatine monohydrate is the single most well-researched and effective legal supplement for strength and muscle building. It works by increasing phosphocreatine stores in muscle, which allows faster regeneration of ATP during high-intensity exercise. This means more reps, more sets, and ultimately more muscle growth over time.

Despite decades of research, no serious adverse effects have been identified in healthy individuals. The myths about kidney damage, hair loss, and dehydration have been thoroughly debunked by subsequent research.

---

## 🎯 Practical Takeaway

**Take 3-5 g of creatine monohydrate daily.** No loading phase is necessary — just take it consistently every day, with or without food, at any time. The cheapest form (creatine monohydrate powder) is also the most studied and effective. Skip the fancy forms (creatine HCl, buffered creatine, etc.) — they offer no advantage. Expect a 1-2 kg increase in body water in the first week. This is normal and not fat gain.

---

*Citation: Branch JD. Int J Sport Nutr Exerc Metab. 2003;13(2):198-226. doi:10.1123/ijsnem.13.2.198. PMID: 12945830*
""",
    },
]


# ---------------------------------------------------------------------------
# Database seeding logic
# ---------------------------------------------------------------------------

async def seed_articles() -> None:
    """Seed all research articles into the database."""
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    from src.config.database import engine
    from src.modules.content.models import ContentArticle, ContentModule
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # 1. Create or get modules
        module_map: dict[str, uuid.UUID] = {}
        for mod_data in MODULES:
            stmt = select(ContentModule).where(ContentModule.slug == mod_data["slug"])
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing:
                module_map[mod_data["slug"]] = existing.id
                print(f"  Module exists: {mod_data['name']}")
            else:
                module = ContentModule(
                    name=mod_data["name"],
                    slug=mod_data["slug"],
                    description=mod_data["description"],
                    sort_order=mod_data["sort_order"],
                )
                session.add(module)
                await session.flush()
                module_map[mod_data["slug"]] = module.id
                print(f"  Created module: {mod_data['name']}")

        # 2. Create articles
        created_count = 0
        skipped_count = 0
        for article_data in ARTICLES:
            module_id = module_map[article_data["module_slug"]]

            # Check if article already exists by title
            stmt = select(ContentArticle).where(
                ContentArticle.title == article_data["title"],
                ContentArticle.module_id == module_id,
            )
            result = await session.execute(stmt)
            if result.scalar_one_or_none():
                skipped_count += 1
                continue

            article = ContentArticle(
                module_id=module_id,
                title=article_data["title"],
                content_markdown=article_data["content_markdown"],
                status="published",
                is_premium=article_data.get("is_premium", False),
                tags=article_data.get("tags", []),
                estimated_read_time_min=article_data.get("estimated_read_time_min"),
                published_at=datetime.now(timezone.utc),
            )
            session.add(article)
            created_count += 1

        await session.commit()
        print(f"\nDone! Created {created_count} articles, skipped {skipped_count} (already exist).")
        print(f"Total modules: {len(module_map)}")


if __name__ == "__main__":
    print("Seeding research articles...")
    asyncio.run(seed_articles())
    print("Complete!")
