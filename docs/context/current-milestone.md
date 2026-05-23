# Current Task: Task 2.7 — Frontend Settings Page

## What I'll implement
- pages/Settings.tsx — settings page UI
- components/forms/SettingsForm.tsx — form for currency, timezone, date format, number format
- api/settings.ts — useSettings query + usePatchSettings mutation (TanStack Query)
- Tests with MSW

## Files I'll work in
frontend/src/pages/Settings.tsx
frontend/src/components/forms/SettingsForm.tsx
frontend/src/api/settings.ts
frontend/src/test/handlers.ts (add settings handlers)
frontend/src/pages/Settings.test.tsx

## Key constraints
- All fields optional in PATCH; empty PATCH is a no-op
- Currency, timezone, date format, number format are the four user settings fields
- All endpoints at /api/v1/settings

## Definition of done
bun run test passes for settings tests
