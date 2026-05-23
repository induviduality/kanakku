# Kanakku

Kanakku is a self-hosted personal finance tracker for users in India, built around frictionless PDF bank statement import and natural-language transaction entry. Your data lives in your own Postgres database — queryable however you like, never leaving your host unless you choose.

---

## Getting started

**→ [docs/SETUP.md](docs/SETUP.md) — start here**

Covers what to install for three scenarios before you run anything:

- [Local PC (Windows / macOS)](docs/SETUP.md#scenario-a-local-pc-windowsmacos) — for development or trying it out
- [Raspberry Pi 5](docs/SETUP.md#scenario-b-raspberry-pi-5) — self-hosted, always-on, home network
- [Cloud VPS (Ubuntu)](docs/SETUP.md#scenario-c-cloud-vps-ubuntu-2204--2404) — accessible from anywhere, real domain + HTTPS

Once prerequisites are installed: **[docs/running.md](docs/running.md)** — how to start the stack.

---

## Docs

| File | What's in it |
|------|-------------|
| [docs/SETUP.md](docs/SETUP.md) | **Start here** — prerequisites + install commands per platform |
| [docs/running.md](docs/running.md) | How to run the stack (native dev, Docker, Pi, VPS) |
| [docs/TDD.md](docs/TDD.md) | Full technical design document |
| [docs/decisions/log.md](docs/decisions/log.md) | Architecture and implementation decisions |
