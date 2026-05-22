# Current Task: Task 1.6 — Frontend Auth Pages

## What I'm implementing
Six frontend pieces: Setup page, Login page, AcceptInvite page, auth API hooks, auth storage, AuthGuard component, and routes.

## Files I'm working in
frontend/src/pages/Setup.tsx
frontend/src/pages/Login.tsx
frontend/src/pages/AcceptInvite.tsx
frontend/src/api/auth.ts
frontend/src/lib/auth-storage.ts
frontend/src/components/AuthGuard.tsx
frontend/src/App.tsx (routes)
frontend/src/test/  (MSW tests)

## Key constraints to remember
- TanStack Router for routing
- TanStack Query for data fetching
- Radix UI primitives for form components
- Tailwind for styling
- MSW for mocking in tests
- Access token stored in memory (not localStorage) — refresh token in localStorage

## Tests to write first (TDD)
- Setup.test.tsx: renders form, submits, redirects on success, shows error on failure
- Login.test.tsx: same pattern
- AcceptInvite.test.tsx: pre-fills email if in invite info, handles expired/used
- AuthGuard.test.tsx: redirects unauthenticated, renders children when authed

## Definition of done
bun run test passes, bun run build clean
