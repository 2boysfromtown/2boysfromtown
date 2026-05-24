# OpenClaw Skill Template

Minimal scaffold for an OpenClaw agent skill — the same shape we use internally at 2BFT for the 147 skills running in production.

A "skill" is one small, testable capability the agent can compose at runtime. Keep it focused. One verb per skill.

## Layout

```
.
├── manifest.json     # skill metadata + I/O schema
├── skill.py          # the handler
├── tests/
│   └── test_skill.py # unit tests
├── requirements.txt
└── .gitignore
```

## Quickstart

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m pytest tests/
```

## Wire it into OpenClaw

Drop the directory into your OpenClaw `skills/` path. The runtime discovers it via `manifest.json` and exposes `handle()` as a callable tool.

## Anatomy

- **`manifest.json`** — name, version, input/output schema. The runtime uses this for tool routing and validation.
- **`skill.py`** — exports `handle(input: dict) -> dict`. Pure function. No side effects beyond what the manifest declares.
- **`tests/`** — `pytest` tests. CI runs these on every push.

## Naming

Skills are named `<verb>_<noun>` — `summarize_thread`, `extract_invoice`, `send_followup`. Action first.
