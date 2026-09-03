from backend.semantic_map.human_verification import (
    CompletedPrompt,
    HUMAN_VERIFY_BUCKET_WIDTH,
    human_verify_bucket,
    human_verify_bucket_bounds,
    select_completed_prompt,
)


def test_human_verify_uses_five_equal_buckets_from_minus_one_to_three() -> None:
    assert HUMAN_VERIFY_BUCKET_WIDTH == 0.8
    assert [human_verify_bucket_bounds(bucket) for bucket in range(1, 6)] == [
        (None, -0.2),
        (-0.2, 0.6),
        (0.6, 1.4),
        (1.4, 2.2),
        (2.2, None),
    ]


def test_human_verify_bucket_boundaries_and_open_tails_are_stable() -> None:
    assert human_verify_bucket(-100.0) == 1
    assert human_verify_bucket(-1.0001) == 1
    assert human_verify_bucket(-1.0) == 1
    assert human_verify_bucket(-0.2) == 2
    assert human_verify_bucket(0.6) == 3
    assert human_verify_bucket(1.4) == 4
    assert human_verify_bucket(2.2) == 5
    assert human_verify_bucket(3.0) == 5
    assert human_verify_bucket(3.0001) == 5
    assert human_verify_bucket(100.0) == 5


def test_prompt_selection_excludes_the_previous_prompt() -> None:
    prompts = (
        CompletedPrompt(prompt="first prompt", results=()),
        CompletedPrompt(prompt="second prompt", results=()),
    )
    selected = select_completed_prompt(prompts, 42, [" First   Prompt "])
    assert selected.prompt == "second prompt"


def test_prompt_selection_fails_when_no_alternative_is_available() -> None:
    prompts = (CompletedPrompt(prompt="only prompt", results=()),)
    try:
        select_completed_prompt(prompts, 42, ["only prompt"])
    except LookupError as exc:
        assert "No alternative" in str(exc)
    else:
        raise AssertionError("Expected prompt selection to require an alternative prompt")


def test_prompt_selection_prioritizes_rated_prompts_below_one_hundred() -> None:
    prompts = (
        CompletedPrompt(prompt="in progress", results=()),
        CompletedPrompt(prompt="unrated", results=()),
        CompletedPrompt(prompt="over target", results=()),
    )

    selected = select_completed_prompt(
        prompts,
        42,
        [],
        {"in progress": 99, "over target": 100},
    )

    assert selected.prompt == "in progress"


def test_prompt_selection_uses_unrated_prompts_when_none_are_in_progress() -> None:
    prompts = (
        CompletedPrompt(prompt="unrated", results=()),
        CompletedPrompt(prompt="rated", results=()),
    )

    selected = select_completed_prompt(prompts, 42, [], {"rated": 100})

    assert selected.prompt == "unrated"


def test_prompt_selection_uses_the_lowest_hundred_rating_tier_at_or_over_one_hundred() -> None:
    prompts = (
        CompletedPrompt(prompt="one hundred one", results=()),
        CompletedPrompt(prompt="one hundred twenty one", results=()),
        CompletedPrompt(prompt="two hundred one", results=()),
    )

    selected = select_completed_prompt(
        prompts,
        42,
        [],
        {
            "one hundred one": 101,
            "one hundred twenty one": 121,
            "two hundred one": 201,
        },
    )

    assert selected.prompt in {"one hundred one", "one hundred twenty one"}


def test_prompt_selection_applies_exclusions_before_completion_priority() -> None:
    prompts = (
        CompletedPrompt(prompt="in progress", results=()),
        CompletedPrompt(prompt="unrated", results=()),
        CompletedPrompt(prompt="over target", results=()),
    )

    selected = select_completed_prompt(
        prompts,
        42,
        [" IN   PROGRESS "],
        {"in progress": 50, "over target": 100},
    )

    assert selected.prompt == "unrated"
