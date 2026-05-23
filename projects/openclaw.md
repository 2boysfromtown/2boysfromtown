# OpenClaw

OpenClaw is 2BFT's in-house agent infrastructure — the runtime that powers everything we ship.

## What it is

A skill-based agent framework. Each "skill" is a small, focused capability the agent can compose at runtime. As of today: **147 production skills**.

## What it powers

- Email automation across our marketing pipelines
- Inventory + ops for Stashed
- Content generation for the 2BFT Academy curriculum
- The 2BFTclaw consumer product (personal agents as a service)
- Internal dashboards and metric reporting

## Design principles

- **Skills over monoliths.** Small, testable units beat one giant prompt.
- **Build for the lab, ship from the lab.** Same runtime in dev and prod.
- **Documented failures.** Every failed skill stays in the repo with a postmortem.

## Status

Closed-source today, planned partial open-source as the API stabilises. Follow [@2boysfromtown](https://github.com/2boysfromtown) for updates.
