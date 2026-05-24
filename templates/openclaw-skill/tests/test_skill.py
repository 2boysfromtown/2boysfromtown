import pytest

from skill import handle


def test_returns_n_bullets():
    out = handle({"text": "First sentence. Second one. Third here. Fourth.", "bullets": 2})
    assert len(out["summary"]) == 2


def test_default_three_bullets():
    out = handle({"text": "a. b. c. d. e."})
    assert len(out["summary"]) == 3


def test_empty_input_rejected():
    with pytest.raises(ValueError):
        handle({"text": "   "})


def test_single_chunk_fallback():
    out = handle({"text": "no terminators here", "bullets": 3})
    assert out["summary"] == ["no terminators here"]
