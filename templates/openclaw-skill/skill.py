"""OpenClaw skill: summarize_text.

Takes a block of text and returns N bullet-point summary lines.
This is a template — swap the body of `_summarize` for your model call.
"""

from __future__ import annotations

from typing import TypedDict


class Input(TypedDict, total=False):
    text: str
    bullets: int


class Output(TypedDict):
    summary: list[str]


def handle(input: Input) -> Output:
    text = input["text"].strip()
    if not text:
        raise ValueError("text must not be empty")
    n = int(input.get("bullets", 3))
    return {"summary": _summarize(text, n)}


def _summarize(text: str, n: int) -> list[str]:
    sentences = [s.strip() for s in text.replace("\n", " ").split(".") if s.strip()]
    return sentences[:n] if sentences else [text[:120]]
