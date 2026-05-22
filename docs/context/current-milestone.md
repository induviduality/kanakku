# Current Task: Task 0.3 — Frontend Bootstrap

## What I'm implementing
Bun + Vite + React 19 + TypeScript SPA. Add Tailwind, Radix UI, TanStack Query/Router, Recharts, vite-plugin-pwa, Vitest + RTL. Minimal App with "Kanakku" heading + Radix Dialog button. ARM64 Dockerfile.

## Files I'm working in
frontend/

## Key constraints to remember
- No Next.js — pure SPA
- Bun as package manager and test runner
- ARM64-compatible Docker image

## Already decided (see decisions/log.md for full context)
- Stack: Bun + Vite + React 19 + Tailwind + Radix UI + TanStack Query/Router

## Tests to write first (TDD)
- App.test.tsx: renders "Kanakku" heading
- Button.test.tsx: clicking button opens Radix dialog

## Definition of done
bun test passes, bun run build clean