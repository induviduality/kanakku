# Bug Fixes — Kanakku

This folder contains one file per severity tier, each documenting the exact issue found, the fix applied, and its status.

| File | Scope |
|------|-------|
| [backend-high.md](backend-high.md) | HIGH-1 through HIGH-11 — data loss, silent corruption, security |
| [backend-medium.md](backend-medium.md) | MED-1 through MED-6 — wrong behavior in narrower scenarios |
| [frontend.md](frontend.md) | Frontend HIGH/MED/LOW — UX regressions, type safety |
| [test-fixes.md](test-fixes.md) | Pre-existing test failures uncovered during the review |

Severity legend:
- **HIGH** — silently corrupts data, breaks a documented flow, or has a real chance of triggering in normal use.
- **MED** — wrong/unsafe behavior in a real-but-narrower scenario, or UX regression.
- **LOW** — code smell, dead code, fragile but currently working.

Status legend: ✅ Fixed · 🚫 Skipped/Intentional · ❌ False positive · 🔄 Deferred
