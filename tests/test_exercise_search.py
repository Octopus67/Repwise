from src.modules.training.exercises import search_exercises


def test_exact_match():
    results = search_exercises("Bench Press")
    names = [r["name"] for r in results]
    assert any("Bench Press" in n for n in names)


def test_word_order_independent():
    # 'tricep overhead' should find 'Overhead Tricep Extension'
    results = search_exercises("tricep overhead")
    names = [r["name"] for r in results]
    assert any("Overhead Tricep" in n for n in names), f"Expected Overhead Tricep in {names[:5]}"


def test_word_order_reversed():
    # 'pull lat' should find 'Lat Pulldown' variants
    results = search_exercises("pull lat")
    names = [r["name"] for r in results]
    assert any("Lat Pull" in n for n in names), f"Expected Lat Pull in {names[:5]}"


def test_word_order_curl_barbell():
    results = search_exercises("curl barbell")
    names = [r["name"] for r in results]
    assert any("Barbell Curl" in n for n in names)


def test_single_word_still_works():
    results = search_exercises("squat")
    assert len(results) > 0
    assert all("squat" in r["name"].lower() for r in results)


def test_all_words_must_match():
    # 'tricep squat' should return nothing (no exercise has both words)
    results = search_exercises("tricep squat")
    assert len(results) == 0


def test_case_insensitive():
    r1 = search_exercises("BENCH PRESS")
    r2 = search_exercises("bench press")
    assert len(r1) == len(r2)


def test_empty_query():
    results = search_exercises("")
    # Empty query with no filters returns empty list
    assert len(results) == 0


def test_muscle_group_filter_with_word_order():
    results = search_exercises("press", muscle_group="chest")
    assert all(r["muscle_group"] == "chest" for r in results)
    assert len(results) > 0
