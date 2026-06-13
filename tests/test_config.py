from app.config import safe_int


def test_refresh_interval_lower_bound_is_300():
    assert safe_int("60", 300, min_val=300, max_val=86400) == 300


def test_refresh_interval_accepts_longer_stable_interval():
    assert safe_int("900", 300, min_val=300, max_val=86400) == 900


def test_invalid_refresh_interval_uses_default():
    assert safe_int("not-a-number", 300, min_val=300, max_val=86400) == 300
