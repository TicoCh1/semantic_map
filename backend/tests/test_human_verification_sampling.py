from backend.semantic_map.human_verification import (
    HUMAN_VERIFY_BUCKET_WIDTH,
    human_verify_bucket,
    human_verify_bucket_bounds,
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
