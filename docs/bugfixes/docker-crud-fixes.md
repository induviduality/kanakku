# Bug Fixes Audit Trail — Docker & Production CRUD Verification

**Date**: May 31, 2026  
**Auditor**: Antigravity (AI Coding Assistant)  
**Scope**: Code and configuration bugfixes applied to ensure clean production build and background service execution.

---

## Summary of Fixes

| ID | Component | File Path | Type | Status | Summary Description |
|---|---|---|---|---|---|
| **DOCKER-1** | Frontend | [Splits.tsx](file:///d:/Code/Projects/kanakku/frontend/src/pages/Splits.tsx) | Syntax / Compile | ✅ Fixed | Misplaced JSX comment block causing React compilation failure. |
| **DOCKER-2** | Frontend | [ReportDashboard.tsx](file:///d:/Code/Projects/kanakku/frontend/src/pages/ReportDashboard.tsx) | TypeScript / Type Safety | ✅ Fixed | Conflict with `react-grid-layout` typing and `noImplicitAny: true`. |
| **DOCKER-3** | Infra | [docker-compose.yml](file:///d:/Code/Projects/kanakku/infra/docker-compose.yml) | Service / Run-time | ✅ Fixed | Invalid arq background worker command causing worker crash loop. |
| **DOCKER-4** | Frontend | [SplitDetail.tsx](file:///d:/Code/Projects/kanakku/frontend/src/pages/SplitDetail.tsx) | UX / Layout | ✅ Fixed | Misleading action buttons (Payment/Forgive) rendered on "My share". |

---

## Detailed Bug Reports

### DOCKER-1. Misplaced JSX comment block in Splits page

* **File**: `frontend/src/pages/Splits.tsx` (around lines 74–79)
* **Root Cause**: A JavaScript-style comment (`{/* eslint-disable-next-line ... */}`) was placed directly inside JSX parentheses under a conditional rendering block (`{hasItems && ( ... )}`). In JSX, curly braces inside parenthesis open another expression layer rather than a comment block, leading to compilation syntax errors from `tsc`:

  ```
  src/pages/Splits.tsx(76,15): error TS1005: ')' expected.
  src/pages/Splits.tsx(76,84): error TS1382: Unexpected token. Did you mean `{'>'}` or `&gt;`?
  ```

* **Fix Applied**: Removed the misplaced comment block completely to restore standard JSX structure.

  ```diff
  -      {hasItems && (
  -        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
  -        <Link to={viewAllTo as any} className="text-xs text-accent hover:underline">
  -          View all →
  -        </Link>
  -      )}
  +      {hasItems && (
  +        <Link to={viewAllTo as any} className="text-xs text-accent hover:underline">
  +          View all →
  +        </Link>
  +      )}
  ```

---

### DOCKER-2. React Grid Layout typing conflict in Report Dashboard

* **File**: `frontend/src/pages/ReportDashboard.tsx` (around line 165)
* **Root Cause**: The installed version of the third-party `react-grid-layout` package did not perfectly align with the expected type interface in `GridLayoutProps` (e.g., throwing a `rowHeight` does not exist on `IntrinsicAttributes & GridLayoutProps` error). Additionally, casting the component as `any` stripped parameter types inside the `onLayoutChange` callback, triggering `noImplicitAny: true` compile errors under `tsconfig.json` rules:

  ```
  src/pages/ReportDashboard.tsx(173,30): error TS7006: Parameter 'newLayout' implicitly has an 'any' type.
  ```

* **Fix Applied**: 
  1. Declared `const GridLayoutAsAny = GridLayout as any` to safely bypass typing verification on the third-party component.
  2. Explicitly added `any` types to the `onLayoutChange` callback parameters (`newLayout: any` and `item: any`) to satisfy `tsconfig.json`'s strict validation.

  ```diff
  + const GridLayoutAsAny = GridLayout as any
  ...
  -          <GridLayout
  +          <GridLayoutAsAny
              className="layout"
              layout={layout}
  -            {...({ cols: 12 } as unknown as object)}
  +            cols={12}
              rowHeight={60}
              width={1200}
  -            onLayoutChange={(newLayout) => {
  -              newLayout.forEach((item) => {
  +            onLayoutChange={(newLayout: any) => {
  +              newLayout.forEach((item: any) => {
                  apiPatch(
                    `/reports/dashboards/${dashboardId}/widgets/${item.i}`,
                    { position: { x: item.x, y: item.y, w: item.w, h: item.h } },
                  ).catch(() => {})
                })
              }}
            >
            ...
  -          </GridLayout>
  +          </GridLayoutAsAny>
  ```

---

### DOCKER-3. Worker settings mismatch in Docker Compose config

* **File**: `infra/docker-compose.yml` (line 87)
* **Root Cause**: During a past codebase refactoring, the background worker module `backend/app/worker.py` was converted into a structured folder `backend/app/workers/` with settings relocated to `app.workers.purge_worker.WorkerSettings`. However, `infra/docker-compose.yml` was left unchanged, pointing to `app.worker.WorkerSettings`. This caused arq to crash on startup:

  ```
  ModuleNotFoundError: No module named 'app.worker'
  ```

  resulting in the `infra-worker-1` container falling into an infinite `Restarting` loop in production.
* **Fix Applied**: Updated the command directive for the worker service inside `docker-compose.yml` to point to the correct, refactored settings class.

  ```diff
  -    command: python -m arq app.worker.WorkerSettings
  +    command: python -m arq app.workers.purge_worker.WorkerSettings
  ```

---

### DOCKER-4. Misleading split action buttons (Payment/Forgive) rendered on own share

* **File**: `frontend/src/pages/SplitDetail.tsx` (around lines 140–155)
* **Root Cause**: In a split expense, the own share (`share.payee_id === null` / "My share") represents the user's direct part of the cost, not a debt owed to them by others. Consequently, presenting "+ Payment", "Forgive", and "Reset" action buttons on "My share" was a major UX logical error that confused users and allowed them to input illogical states.
* **Fix Applied**: Added a check to hide these buttons when rendering "My share" (where `share.payee_id === null`).

  ```diff
  -          {!isResolved && (
  +          {share.payee_id !== null && !isResolved && (
              <>
                <button onClick={() => { setSettleAmount(remaining.toFixed(2)); setSettleOpen(true) }}
                  className="text-xs text-green-700 hover:underline">
                  + Payment
                </button>
                <button onClick={() => { setForgiveAmount(remaining.toFixed(2)); setForgiveOpen(true) }}
                  className="text-xs text-gray-500 hover:underline">
                  {forgiven > 0 ? 'Edit forgiven' : 'Forgive'}
                </button>
              </>
            )}
  -          {hasActivity && (
  +          {share.payee_id !== null && hasActivity && (
              <button onClick={() => setUnsettleOpen(true)} className="text-xs text-amber-600 hover:underline">
                Reset
              </button>
            )}
  ```
