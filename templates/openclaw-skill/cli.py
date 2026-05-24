"""Tiny stdin/stdout adapter so non-Python callers (like the Telegram bot) can invoke the skill.

Usage:
    echo '{"text": "...", "bullets": 3}' | python -m cli
"""

from __future__ import annotations

import json
import sys

from skill import handle


def main() -> int:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
        result = handle(payload)
        sys.stdout.write(json.dumps(result))
        return 0
    except Exception as exc:
        sys.stderr.write(json.dumps({"error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
