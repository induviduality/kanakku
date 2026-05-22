# Personal Finance Tracker — Technical Design Document

**Author:** Induja
**Last updated:** 2026-05-22

---

## Table of Contents

1. [Overview](#1-overview)
2. [Requirements](#2-requirements)
3. [Functional Specification](#3-functional-specification)
4. [Technical Specification](#4-technical-specification)
5. [Open Questions / Future Work](#5-open-questions--future-work)
6. [Decision Log](#6-decision-log)

---

# 1. Overview

## 1.1 Problem Statement

Existing personal finance tools (Firefly III, YNAB, Splitwise, GnuCash, plain-text accounting systems like hledger/beancount) all force a tradeoff between three things:

1. **Data ownership and flexibility** — you want to query your data however you want, not be limited by canned reports.
2. **Low-friction entry** — typing every transaction into a form is unsustainable; the dropoff in tracking discipline kills the value of the tool.
3. **Comfortable interaction surface** — text-based ledgers are powerful but unfriendly to read and use day-to-day; web-based tools often have rigid input flows.

Bank statements in India are almost universally distributed as password-protected PDFs, not CSVs or API feeds. Real-world transactions are often split among friends (especially via UPI), with no system-of-record linking the split context to the underlying bank debit. Payment apps like Google Pay provide richer merchant context than the bank statement does, but offer no clean reconciliation path to the bank.

The result: most people either give up tracking, or settle for a tool that captures a fraction of their financial reality.

## 1.2 Goals

- **Own your data.** A relational data model with full read/write access, queryable via SQL.
- **Two equally-supported entry paths.** Manual entry (for transactions as they happen) and PDF statement import (for catching what was missed) are both first-class. Realistic usage: weekly check-in mixing both.
- **Support retroactive backfilling.** Historical bank statements can be imported to build up past data; manual entry allows filling specific known gaps.
- **Model real life accurately.** Splits with friends (including retroactive bundling of existing transactions), partial settlement, forgiven shares, recurring and ad-hoc budgets, goal-based savings, and subscriptions are first-class concepts, not workarounds.
- **Be platform-agnostic.** The same codebase runs on a personal home server and on a cloud VPS without code changes — configuration only.
- **Be device-agnostic.** The interface works as well on mobile browsers as on desktop, and is installable as a PWA.
- **Be privacy-first.** A fully local mode exists where no data leaves the host. Any cloud integration is opt-in and explicit, with transparency about what data is sent.

## 1.3 Non-Goals

- **Not a multi-tenant SaaS.** Single-user (or small-household) personal use. No marketing site, no public signup funnel, no billing.
- **Not double-entry accounting.** Liability accounts are modeled, but we are not building a general-ledger system suitable for business accounting.
- **Not investment portfolio management.** Stocks, mutual funds, and crypto holdings are out of scope. Transactions involving them can be recorded, but cost-basis tracking, capital gains, and price history are not built in.
- **Not currency conversion.** Multi-currency entries are stored faithfully, but no FX-rate-aware reporting is implemented in v1. The user's bank handles conversion; we record what the bank records.
- **Not a budgeting envelope system.** Budgets in this system are spending limits and analytical groupings, not pre-allocated cash envelopes.
- **Not a bill-pay or payment-initiation tool.** The system only records transactions; it never moves money.
- **No notifications in v1.** Subscription renewal reminders, budget overrun alerts, etc. are deferred.
- **No transaction attachments in v1.** No receipt scanning, no invoice file storage.
- **No LLM-assisted manual entry.** Manual entry is structured form input. LLMs are used only for PDF extraction and (optionally) merchant categorization suggestions.

## 1.4 Glossary

- **Account** — a place money lives (bank account, cash, credit card, loan).
- **Payment Method** — a specific way money moves out of an account (debit card, credit card, netbanking, UPI app).
- **Payee** — an entity money is paid to or received from. Includes merchants, businesses, and people.
- **Category** — what kind of spending or income a transaction represents (food, rent, salary, etc.). Many-to-many with transactions.
- **Tag** — a free-form label on a transaction for cross-cutting concerns (e.g. `work-reimbursable`). Many-to-many.
- **Transaction** — a single financial event. Types: expense, income, transfer.
- **Split** — a single entity representing a shared expense. It wraps one expense transaction and has one or more **shares** distributed among the user and others.
- **Split Share** — one share within a split. May belong to the user or to another payee. Has a status: pending, settled, or forgiven.
- **Budget** — a spending limit, scoped to a time period and/or categories, used for tracking and analysis.
- **Subscription** — a recurring known expense (Netflix, gym, etc.) with a billing cycle.
- **Piggy Bank** — a savings goal with a target amount, target date, and tracked contributions.
- **Import Batch** — a single ingestion event (e.g. one uploaded PDF) producing raw records that may become transactions.

---

# 2. Requirements

## 2.1 Functional Requirements

### 2.1.1 Authentication & Setup
- **FR-1.1** The system supports user accounts with email + password authentication.
- **FR-1.2** Sessions persist across browser restarts via secure tokens.
- **FR-1.3** On first run (no users in the database), the system displays a one-time setup screen to create the initial user.
- **FR-1.4** After the initial user exists, public signup is disabled. Additional users (e.g. household members) may be created only via signed invite tokens generated by an existing user.
- **FR-1.5** The data model supports multi-user from day one; v1 surface is single-user, but the schema does not preclude future multi-user.

### 2.1.2 User Settings
- **FR-2.1** Each user has a settings profile.
- **FR-2.2** Settings include: primary currency (used as default for new accounts and transactions), display preferences (date format, number format), and timezone.
- **FR-2.3** Primary currency can be changed; existing records are not converted.

### 2.1.3 Accounts & Payment Methods
- **FR-3.1** Users can create accounts of types: bank, cash, credit card, loan.
- **FR-3.2** Each account holds a current balance and a currency code (defaulting to the user's primary currency).
- **FR-3.3** Each account may have zero or more associated payment methods: debit card, credit card, netbanking, UPI.
- **FR-3.4** UPI payment methods may optionally specify which app (GPay, PhonePe, Paytm, etc.).
- **FR-3.5** Accounts and payment methods can be marked inactive without being deleted.

### 2.1.4 Payees
- **FR-4.1** Users can create payees with a name, type (merchant, person, business, other), and optional default categories.
- **FR-4.2** When a transaction is created against a payee with default categories, the transaction's categories are pre-populated (overrideable by the user).
- **FR-4.3** Payees of any type can participate in splits.

### 2.1.5 Categories & Tags
- **FR-5.1** Users can create categories with name, icon, and color. Applicability (expense/income/both) is optional metadata.
- **FR-5.2** A transaction can belong to multiple categories simultaneously.
- **FR-5.3** Users can create tags with a name and color. Tags are free-form labels, many-to-many with transactions.

### 2.1.6 Transactions
- **FR-6.1** Three transaction types: expense, income, transfer.
- **FR-6.2** Every transaction has a transacted-at timestamp (date and time), amount, currency, account, optional payment method, optional payee, optional description and notes.
- **FR-6.3** Transacted-at time is independent of created-at and updated-at; the user can backfill or edit it.
- **FR-6.4** Transaction currency defaults to the user's primary currency. The user can override it when entering the transaction.
- **FR-6.5** Transfer transactions specify a source and destination account.
- **FR-6.6** Transactions can be linked to one or more budgets.
- **FR-6.7** Transactions can be linked to a subscription (when applicable).
- **FR-6.8** Transactions can be linked to a piggy bank contribution.

### 2.1.7 Splits
- **FR-7.1** A split is a distinct entity that references exactly one expense transaction.
- **FR-7.2** A split contains one or more shares. Each share has an amount, a status (pending/settled/forgiven), and optionally a payee (null payee = user's own share).
- **FR-7.3** The sum of all shares within a split must equal the parent expense's amount (system-enforced invariant).
- **FR-7.4** A split can be created upfront when entering a new expense (user adds co-payers and amounts in the same form).
- **FR-7.5** A split can be created retroactively by selecting one existing expense plus zero or more existing income transactions and bundling them. Each selected income transaction becomes the settlement of one share.
- **FR-7.6** Retroactive bundling validation: `sum(income legs) + sum(forgiven amounts) ≤ expense amount`. The user's own share is computed as the remainder.
- **FR-7.7** Settling a pending share links a real income transaction (existing or newly created) to that share.
- **FR-7.8** Forgiving a pending share absorbs that amount into the user's net expense; no income transaction is needed.
- **FR-7.9** Reports compute net expense as: `user's own share + sum(forgiven shares)`. Settled and pending shares (to other payees) are excluded from net expense.
- **FR-7.10** Income transactions that serve as split settlements do not count as "income" in income reports — they are reimbursements.

### 2.1.8 Budgets
- **FR-8.1** Budgets have an amount, currency, and optionally a time period (week, month, quarter, year, or custom date range).
- **FR-8.2** Budgets without a time period are open-ended and use an explicit active/inactive toggle.
- **FR-8.3** Budgets with a time period derive their active status from whether the current date falls within the period.
- **FR-8.4** Budget type: recurring or ad-hoc.
- **FR-8.5** Recurring budgets repeat according to a recurrence rule (weekly, monthly, etc.). Instances are generated on the fly.
- **FR-8.6** Editing a recurring budget affects future periods by default. The user is prompted with a checkbox: "also affect the current period?"
- **FR-8.7** Deleting a recurring budget prompts the user to choose: delete only this instance, delete this and all future periods, or delete only future periods.
- **FR-8.8** A single instance of a recurring budget can be edited to override its amount or scope without affecting the recurring template.
- **FR-8.9** Ad-hoc budgets have optional start and end dates. Without dates, they remain active until manually deactivated.
- **FR-8.10** Budgets can optionally be scoped to specific categories.
- **FR-8.11** A transaction may be linked to one or more budgets.

### 2.1.9 Subscriptions
- **FR-9.1** Subscriptions have a name, amount, currency, billing cycle (weekly/monthly/quarterly/yearly), and a billing-date input (the day the subscription is charged).
- **FR-9.2** The next billing date is computed on the fly from the billing-date input and the cycle.
- **FR-9.3** Subscriptions have default account, payment method, and category for the resulting transactions.
- **FR-9.4** Past transactions can be linked to a subscription to build history.
- **FR-9.5** Subscriptions can be marked active/inactive (e.g. cancelled).
- **FR-9.6** Active subscriptions appear on the home dashboard with their next billing date and status.

### 2.1.10 Piggy Banks
- **FR-10.1** Piggy banks have a name, target amount, target date, and tracked current amount.
- **FR-10.2** Contributions to a piggy bank may be of type transfer (between user accounts) or expense (counts toward goal directly).
- **FR-10.3** A piggy bank's current amount is the sum of all linked contributions.

### 2.1.11 Statement Import
- **FR-11.1** The system accepts PDF bank statement uploads, including password-protected PDFs.
- **FR-11.2** The system extracts transactions using a hybrid pipeline: deterministic text/table extraction first, then LLM/vision fallback if needed.
- **FR-11.3** Extracted transactions are presented for user review before being committed.
- **FR-11.4** The system detects duplicates against existing transactions on the same account.
- **FR-11.5** Each import batch is auditable: filename, source, parsed/confirmed/rejected counts, per-row confidence.
- **FR-11.6** Balance verification (opening + credits − debits = closing) flags suspicious extractions for manual review.

### 2.1.12 GPay Takeout Enrichment
- **FR-12.1** The system accepts Google Takeout exports of GPay transaction history.
- **FR-12.2** The system matches GPay records to existing bank transactions by amount and date proximity (±1 day).
- **FR-12.3** Matched GPay records enrich the bank transaction with a clean merchant name.
- **FR-12.4** Ambiguous matches (multiple bank candidates for one GPay record) are presented for manual resolution.

### 2.1.13 Manual Entry
- **FR-13.1** Users enter transactions via a structured web form.
- **FR-13.2** The form captures every field of the transaction model: type, account(s), amount, currency, transacted-at date/time, payee, payment method, categories, tags, description, notes, optional links (budget, subscription, piggy bank).
- **FR-13.3** No compact-syntax parser. No LLM assistance for entry.
- **FR-13.4** The form provides standard usability conveniences: defaults from settings, autocomplete on payees, recent-account first, etc.

### 2.1.14 Home Dashboard
- **FR-14.1** A default home dashboard shows: current-month spending vs. relevant budgets, category breakdown, recent transactions, pending splits, piggy bank progress, account balances, and active subscriptions with status and next billing date.
- **FR-14.2** The dashboard is not configurable; it is opinionated for the daily-check use case.

### 2.1.15 Reports & Custom Dashboards
- **FR-15.1** A separate Reports section allows users to create custom dashboards.
- **FR-15.2** Each report dashboard is a named collection of widgets in a configurable grid layout.
- **FR-15.3** Widgets are backed by raw SQL queries written by the user.
- **FR-15.4** Widget visualization types: bar, line, pie, KPI card, table.
- **FR-15.5** The Reports section provides a schema reference panel (tables, columns, relationships) and a starter library of common query patterns.

### 2.1.16 Data Migration & Portability
- **FR-16.1** All user data is exportable to a self-contained archive that preserves every relationship.
- **FR-16.2** The archive can be re-imported into a fresh instance of the system, restoring all relationships intact.
- **FR-16.3** Both a portable JSON archive format and a native database dump format are supported.

## 2.2 Non-Functional Requirements

### 2.2.1 Portability
- **NFR-1.1** The system runs identically on a self-hosted home server and on a public cloud VPS with no code changes.
- **NFR-1.2** All deployment-specific configuration is supplied via environment variables.
- **NFR-1.3** The system is packaged as containers and orchestrated via a single declarative config file.

### 2.2.2 Privacy
- **NFR-2.1** A fully local mode exists where no data leaves the host. Statement parsing and LLM assistance run against a local model.
- **NFR-2.2** Any cloud-LLM mode is opt-in via configuration, with documentation that explicitly lists what data is sent and to which provider.
- **NFR-2.3** No telemetry, analytics, or external calls occur without explicit user configuration.
- **NFR-2.4** When a cloud LLM is used, the system uses zero-retention APIs and headers where the provider supports them (e.g. Anthropic's zero-retention API endpoints).

### 2.2.3 Responsiveness
- **NFR-3.1** The UI is fully usable on mobile browsers down to 360px viewport width.
- **NFR-3.2** The UI is installable as a Progressive Web App.
- **NFR-3.3** Common interactions (recording a transaction, viewing the dashboard) complete in under 1 second on typical broadband.

### 2.2.4 Reliability
- **NFR-4.1** No transaction is silently dropped during import.
- **NFR-4.2** All destructive actions are confirmed and recoverable for at least 30 days (soft delete).
- **NFR-4.3** The schema enforces referential integrity for all foreign keys.

### 2.2.5 Maintainability & Extensibility
- **NFR-5.1** Clean separation between API and frontend.
- **NFR-5.2** New transaction sources (other importers, banks) can be added without altering the core transaction model.
- **NFR-5.3** Schema migrations are versioned and reversible.

### 2.2.6 Security
- **NFR-6.1** Passwords are stored using argon2id.
- **NFR-6.2** Sessions use cryptographically signed, time-limited tokens.
- **NFR-6.3** All API endpoints require authentication except login, health, and first-run-setup endpoints.
- **NFR-6.4** HTTPS termination via reverse proxy is supported when deployed.

### 2.2.7 Performance
- **NFR-7.1** Common dashboard queries return in under 500ms on a dataset of 100,000 transactions.
- **NFR-7.2** PDF import of a typical 50-transaction monthly statement completes in under 60 seconds end-to-end (excluding LLM cold-start).

### 2.2.8 Backup & Data Portability
- **NFR-8.1** All data is exportable to a portable, human-readable format.
- **NFR-8.2** Database backups can be triggered via CLI or scheduled job.

---

# 3. Functional Specification

This section describes the system's externally visible behavior. No technology choices.

## 3.1 System Overview

Three primary surfaces:

1. **Daily View** — the home dashboard, opinionated and fixed.
2. **Entry Surfaces** — manual form entry, statement import, GPay enrichment. All equal-weight; usage mixes them.
3. **Analysis Surface** — custom report dashboards backed by user-written SQL.

## 3.2 Entity Model (Conceptual)

The transaction is central. Around it:

- **Accounts** hold money. **Payment methods** are interfaces to accounts.
- **Payees** are entities money flows to/from.
- **Categories** and **tags** classify transactions.
- **Budgets**, **subscriptions**, and **piggy banks** group transactions across time per user intent.
- A **split** is a distinct entity that wraps one expense transaction and partitions its cost into **shares**. Each share is either the user's own, a payee's pending share, a settled share (linked to an income transaction), or a forgiven share.
- **Import batches** trace where transactions came from.

The transaction itself is type-pure: expense, income, or transfer. "Being a split" is a property of being referenced by a split entity, not a transaction type.

## 3.3 Feature Specifications

### 3.3.1 Authentication & First-Run Setup

On the very first visit to a fresh deployment:
- The system detects there are no users.
- A **setup screen** appears, asking for an email and password to create the first user.
- After creation, the user is logged in.

On subsequent visits, only the login screen is shown. Public signup is unavailable.

**Adding additional users (e.g. a partner):**
- An existing user goes to Settings → Users → "Invite user".
- The system generates a signed invite token (a URL) valid for 7 days.
- The invitee opens the URL, sets their password, and is added.

This avoids exposing a public signup form while supporting household use.

### 3.3.2 User Settings

The user profile includes:
- **Primary currency** — used as default for new accounts and transactions.
- **Timezone** — used for date displays and the "now" used for transacted-at defaults.
- **Date format** and **number format** preferences.
- **LLM backend preference** (for advanced users; default chosen by deployment env).

Changes apply going forward; existing records are not modified.

### 3.3.3 Accounts and Payment Methods

Standard CRUD with type, currency, opening balance. Inactive accounts are hidden from new-transaction flows but remain queryable historically.

### 3.3.4 Payees

A unified entity for any party the user transacts with. Type is metadata, not behavioral. Default categories on a payee auto-fill (and are overrideable) when a transaction selects that payee.

### 3.3.5 Categories and Tags

Categories: name, icon, color, optional applicability. Many per transaction.

Tags: name, color. Many per transaction. Lighter than categories — for cross-cutting concerns.

### 3.3.6 Transactions — Behavior

**Creating:** the form captures the full transaction model. Defaults come from settings (currency) and recent usage (account, payment method). Currency is overrideable per transaction. Transacted-at defaults to "now" but is editable to any past or future timestamp.

**Editing:** any field is editable post-creation. The system tracks created-at, updated-at, and transacted-at independently.

**Deleting:** soft delete with 30-day recovery window.

**Transfer transactions:** specify both source and destination accounts. The amount represents what leaves the source. If currencies differ, both source amount and destination amount can be specified separately (no automatic FX conversion).

### 3.3.7 Splits — Behavior

A split is a separate entity (not a transaction type) that wraps one expense transaction.

**Upfront creation flow:**
1. User enters a new expense.
2. User toggles "this is a split."
3. User adds co-payers with amounts. The user's own share is computed as the remainder.
4. The system creates the expense transaction and, alongside it, a split entity with the appropriate shares.

**Retroactive bundling flow:**
1. User selects from the transaction list: exactly one expense and zero or more income transactions.
2. User initiates "bundle as split."
3. The system validates `sum(income legs) + sum(forgiven amounts) ≤ expense amount`.
4. The user can add forgiven shares (e.g. "Arun was supposed to pay ₹500 but I forgave it").
5. The user's own share is computed as the remainder.
6. The system creates a split entity referencing the expense, with shares mapping to each income transaction (settled), each forgiven amount (forgiven), and the user's remainder (own share).

**Share states:**
- **Pending** — owed but not paid.
- **Settled** — paid back; linked to an income transaction.
- **Forgiven** — absorbed by the user; counts toward net expense.

**Net expense in reports:**

```
net_expense_for_split = user_own_share + sum(forgiven_shares)
```

The gross expense is still visible in transaction listings (it's the actual amount that left the user's account), but all aggregate spending calculations use net.

**Reimbursement income exclusion:**

Income transactions linked as split settlements do not appear in "total income" calculations — they are reimbursements, not real income.

### 3.3.8 Budgets — Behavior

**Active status:**
- Budgets with a time period: active when current date is within `[start_date, end_date]`.
- Budgets without a time period: explicit `is_active` toggle.
- Only active budgets appear on the home dashboard.

**Editing a recurring budget:**
- Default: changes apply to future periods.
- A checkbox asks: "Also apply to the current period?" Default checked.
- Edits never affect past periods (those are historical).

**Editing a single instance of a recurring budget:**
- A separate flow available from an instance view.
- Creates a modified instance, leaving the recurring template untouched.

**Deleting a recurring budget:**
- The user is prompted with three options:
  - Delete only this instance.
  - Delete this and all future instances.
  - Delete only future instances (keep current).
- Past instances are never deleted; they are part of history.

**Ad-hoc budgets:**
- Have a name, amount, optional start/end date, optional category scope.
- If no dates: explicit active toggle.
- Used for one-off events (a Goa trip budget, a wedding budget).

### 3.3.9 Subscriptions — Behavior

The user records:
- Name, amount, currency, billing cycle.
- The **billing day** or last known billing date.
- Default account, payment method, category.

The system **computes** the next billing date on the fly from the billing day + cycle. If a billing date is missed (no transaction was recorded), the dashboard still shows the next expected date.

**On the dashboard:**
- Active subscriptions are listed with their next billing date and a status indicator (e.g. "due in 3 days," "overdue — was due 2 days ago").
- A historical transaction can be linked to a subscription from the transaction's detail view, building a history.

### 3.3.10 Piggy Banks — Behavior

Goal-tracking entity. Contributions of type transfer or expense are linked transactions whose amounts roll into the piggy bank's current total.

### 3.3.11 Statement Import Pipeline

1. **Upload.** User selects a PDF and supplies the password if needed.
2. **Unlock.** System unlocks the PDF.
3. **Extract.** Deterministic text/table extraction first; LLM/vision fallback if quality is poor.
4. **Parse.** Each row becomes a structured candidate (date, description, amount, type).
5. **Verify.** Balance equation checked against statement headers.
6. **Deduplicate.** Candidates compared to existing transactions on the same account.
7. **Review.** Candidates presented to user, grouped by status (new / suspected duplicate / low confidence).
8. **Confirm.** User reviews, edits, links to payees/categories, confirms. Confirmed candidates become transactions. Rejected ones stay in the audit log.

Each batch is fully auditable.

### 3.3.12 GPay Takeout Enrichment

The user uploads a Takeout JSON. The system matches GPay records to bank transactions by amount + date proximity. Exact matches auto-link. Ambiguous matches are manually resolved. Unmatched GPay records are flagged but not converted to transactions (the bank statement remains the source of truth for the actual debit).

### 3.3.13 Manual Entry

A structured form on a dedicated page. Captures every field on the transaction model. Form-only — no compact text syntax, no LLM assistance.

Conveniences:
- Defaults pulled from settings (currency) and recent usage (account, payment method).
- Type-ahead autocomplete on payees and categories.
- Quick toggles for type (expense / income / transfer).
- Inline creation of new payees/categories without leaving the form.

### 3.3.14 Home Dashboard

Fixed layout summarizing current month:
- Total spent vs. relevant budgets.
- Spending by category.
- Recent transactions.
- Pending splits (who owes the user).
- Piggy bank progress.
- Account balances.
- Active subscriptions with status and next billing date.

### 3.3.15 Reports & Custom Dashboards

The Reports section is where custom analysis happens:
- Create a report dashboard (named).
- Add widgets backed by SQL queries.
- Choose visualization per widget.
- Arrange widgets on a grid.
- Save and revisit.

A **schema reference panel** lists all tables, columns, and foreign keys. Clickable to insert. A **starter library** provides common query templates.

Queries run against a read-only DB projection — no INSERT/UPDATE/DELETE.

## 3.4 Cross-Cutting Behaviors

### 3.4.1 Soft Delete

All user-owned entities are soft-deleted with 30-day recovery via "Recently Deleted" view.

### 3.4.2 Audit Trail

Transactions record:
- `created_at` — when first entered into the system.
- `updated_at` — last modified time.
- `transacted_at` — when the transaction actually happened (user-supplied; defaults to now).
- Import batch and raw record reference (when applicable).

### 3.4.3 Multi-Currency

Each account has a currency. Transactions inherit the account's currency by default, with per-transaction override. No automatic FX conversion. Reports aggregate per-currency.

The user's primary currency in settings is the system default but does not affect data — only the UI defaults.

---

# 4. Technical Specification

Implementation choices follow. Substitutions are possible without violating the functional spec.

## 4.1 Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Client (Browser / PWA on mobile or desktop)│
└───────────────┬─────────────────────────────┘
                │  HTTPS / JSON over REST
┌───────────────▼─────────────────────────────┐
│  API Server (stateless)                     │
│  - Auth, business logic, query execution    │
│  - Import pipeline orchestration            │
│  - LLM client (local Ollama or cloud API)   │
└───┬───────────────────────────┬─────────────┘
    │                           │
┌───▼─────────────┐   ┌─────────▼──────────────┐
│ PostgreSQL DB   │   │ LLM Service             │
│                 │   │ (Ollama local OR cloud) │
└─────────────────┘   └──────────────────────────┘
```

All components run in containers, orchestrated via a single `docker-compose.yml`. The LLM backend is selected by env var — code is identical between local and cloud deployments.

## 4.2 Technology Stack

### Backend
- **Python 3.12+** — strongest ecosystem for PDF parsing and LLM SDKs.
- **FastAPI** — async, native pydantic, automatic OpenAPI schema.
- **SQLAlchemy 2.0 (async)** + **Alembic** for migrations.
- **PyJWT** + **argon2-cffi** for auth.
- **ARQ** for background tasks (Redis-backed; simpler than Celery for our scale).

### Frontend
- **Bun** — fast installs, native TypeScript.
- **React 19** — current stable. Use of new features (server components, useOptimistic) is optional and selective; this is a pure SPA, so most server-component machinery is irrelevant.
- **Vite** — bundler.
- **Tailwind CSS** — utility-first styling.
- **Radix UI** — headless accessible primitives, styled with Tailwind for full design control.
- **Recharts** — charting.
- **TanStack Query** — server state.
- **TanStack Router** — type-safe routing.
- **vite-plugin-pwa** — PWA support.

### On Next.js — explicit rejection

Next.js does not add value for this project. The reasons it exists — SEO via SSR, marketing-page SSG, edge deployment, file-based routing for large teams — do not apply to an authenticated single-user finance app.

Drawbacks if adopted:
- **Self-hosting complexity.** Next requires a Node server (or static export with feature loss). docker-composing it alongside the rest is workable but more brittle than a static SPA served by Caddy.
- **Server/client component split.** Adds cognitive overhead for features that have no SSR benefit.
- **Tighter coupling to the Vercel deployment shape.** The "happy path" assumes Vercel; running elsewhere is doable but consistently second-class.
- **Slower iteration.** App Router builds and reloads slower than Vite.

Stay with Vite + React 19 + TanStack Router. If you ever need an SSR'd marketing page, that's a separate static site.

### Database
- **PostgreSQL 16+** — relational, JSONB for flexible fields, mature constraints.

### Cache / Queue
- **Redis 7** — session cache (optional; JWT is stateless), background queue.

### PDF Processing
- **pikepdf** — password-protected PDF unlocking.
- **pdfplumber** — text and table extraction from digital PDFs.
- **Bank-specific parsers** — Python modules implementing a common interface, one per supported bank.
- **Vision LLM fallback** — only when deterministic parsing fails.

### LLM Integration

A single `LLMClient` interface with multiple implementations:

```python
class LLMClient:
    def extract_transactions_from_pdf_page(image_bytes) -> list[Transaction]
    def suggest_category(payee: str, description: str) -> str | None
    def match_gpay_to_bank(...) -> list[Match]
```

Implementations: `OllamaClient`, `AnthropicClient`, `OpenAIClient`. Selected via `LLM_BACKEND` env var.

## 4.3 Privacy & LLM Hosting Options

This section is critical to the user's stated goal of complete privacy. Options, ranked from most-private to least:

### Option A — Fully local on Raspberry Pi 5

**Feasibility:**
- Pi 5 with 8GB RAM can run small text models (Phi-3 mini 3.8B, Llama 3.2 3B, Qwen 2.5 3B) at 5–10 tokens/sec via Ollama.
- Text-only tasks (category suggestion, GPay matching heuristics) work fine.
- **Vision models for PDF extraction:** moondream2 (1.6B) works on Pi 5 but slowly (~30s per page). Larger vision models (minicpm-v 8B, llava 7B) will run but cause memory pressure and may OOM under concurrent load.

**Verdict:** Viable as a *fallback* environment with deterministic-only parsing as the primary path. If a PDF fails deterministic extraction, the user has the option to (a) wait for slow vision processing on the Pi or (b) defer to a more powerful machine.

### Option B — Fully local on a beefier home server

A small home server (Intel N100 mini PC with 16GB RAM, or a used desktop with a GPU) handles everything:
- Llama 3.1 8B Instruct for text tasks (excellent quality).
- minicpm-v 2.6 or llava-next for vision (PDF extraction).
- Runs Postgres, Redis, API, frontend, and Ollama all on one box.

**Verdict:** Best balance of privacy and capability. Cost: ~$150–300 one-time.

### Option C — Self-hosted on a private VPS (Ollama there)

Cloud VPS with Ollama installed (e.g., Hetzner CCX with enough RAM, or a GPU droplet on RunPod/Lambda):
- Your data only ever touches your VPS.
- No third-party LLM provider involved.
- Cost: $30–100/month for adequate specs.

**Verdict:** Privacy is between Options A/B and D. You trust the VPS provider (Hetzner, DigitalOcean) but no LLM-specific third party.

### Option D — Cloud LLM API with privacy controls

Use Anthropic Claude API or OpenAI API with:
- **Zero-retention headers** where supported (Anthropic supports this).
- **No-training-on-data** policies (both Anthropic and OpenAI default to this for API).
- Explicit logging of what's sent.

**Verdict:** Best price-performance, requires trusting the provider's privacy claims. Data is processed by the provider's infrastructure but not retained or used for training.

### Recommended configuration matrix

| Scenario | Recommendation |
|---|---|
| Home server with 16GB+ RAM | Option B (local everything) |
| Raspberry Pi 5 only | Option A + Option D as opt-in fallback for vision-heavy PDFs |
| VPS deployment with privacy priority | Option C |
| VPS deployment with cost priority | Option D with zero-retention Anthropic |

The system supports all four via env-var configuration; no code change required to switch.

### What the system sends to the LLM (transparency)

For each LLM-mediated operation, the system logs **exactly** what is sent:
- **PDF extraction:** an image of each PDF page (no account holder info redaction in v1; future improvement).
- **Category suggestion:** payee name and transaction description only — no amounts, no account info.
- **GPay matching:** merchant names and amounts only — no full transaction context.

This transparency is visible in a "LLM Activity Log" page in settings.

## 4.4 Database Schema

UUIDs as primary keys. `created_at`, `updated_at`, `deleted_at` (nullable) on all user-owned tables.

```sql
users (
  id, email UNIQUE, password_hash, created_at
)

user_settings (
  user_id PK FK→users, primary_currency, timezone,
  date_format, number_format, llm_backend_preference,
  updated_at
)

sessions (
  id, user_id FK→users, token_hash, expires_at, created_at
)

invite_tokens (
  id, created_by_user_id FK→users, token_hash,
  email (optional), expires_at, used_at, created_at
)

accounts (
  id, user_id FK→users, name, type (enum),
  currency, opening_balance, current_balance,
  is_active, created_at, updated_at, deleted_at
)

payment_methods (
  id, account_id FK→accounts,
  type (enum: debit_card/credit_card/netbanking/upi),
  label, upi_app (nullable), is_active,
  created_at, updated_at, deleted_at
)

payees (
  id, user_id FK→users, name,
  type (enum: merchant/person/business/other),
  notes, is_active,
  created_at, updated_at, deleted_at
)

payee_default_categories (
  payee_id FK→payees, category_id FK→categories,
  PRIMARY KEY (payee_id, category_id)
)

categories (
  id, user_id FK→users, name, icon, color,
  applicability (enum: expense/income/both, NULLABLE),
  created_at, updated_at, deleted_at
)

tags (
  id, user_id FK→users, name, color,
  created_at, updated_at, deleted_at
)

transactions (
  id, user_id FK→users,
  type (enum: expense/income/transfer),
  transacted_at TIMESTAMPTZ NOT NULL,
  amount, currency,
  description, notes,
  account_id FK→accounts,
  payment_method_id FK→payment_methods (nullable),
  payee_id FK→payees (nullable),
  to_account_id FK→accounts (nullable, transfers only),
  to_amount (nullable, transfers with currency mismatch),
  to_currency (nullable),
  subscription_id FK→subscriptions (nullable),
  import_record_id FK→raw_import_records (nullable),
  created_at, updated_at, deleted_at
)

transaction_categories (
  transaction_id FK→transactions, category_id FK→categories,
  PRIMARY KEY (transaction_id, category_id)
)

transaction_tags (
  transaction_id FK→transactions, tag_id FK→tags,
  PRIMARY KEY (transaction_id, tag_id)
)

transaction_budgets (
  transaction_id FK→transactions, budget_id FK→budgets,
  PRIMARY KEY (transaction_id, budget_id)
)

splits (
  id, user_id FK→users,
  expense_transaction_id FK→transactions UNIQUE,
  notes,
  created_at, updated_at, deleted_at
)

split_shares (
  id, split_id FK→splits,
  payee_id FK→payees (nullable — null = user's own share),
  amount,
  status (enum: pending/settled/forgiven),
  settled_at (nullable),
  settlement_transaction_id FK→transactions (nullable),
  forgiven_at (nullable),
  notes,
  created_at, updated_at
)

-- INVARIANT (enforced by application + CHECK):
-- SUM(split_shares.amount WHERE split_id = X) == transactions.amount
--   WHERE transactions.id = splits.expense_transaction_id

budgets (
  id, user_id FK→users, name, amount, currency,
  period (enum: week/month/quarter/year/custom, NULLABLE),
  start_date (nullable), end_date (nullable),
  type (enum: recurring/adhoc),
  recurrence_rule (text, nullable — RRULE string),
  parent_budget_id FK→budgets (nullable),
  is_modified_instance (bool),
  is_active (used when no time period set),
  notes,
  created_at, updated_at, deleted_at
)

budget_categories (
  budget_id FK→budgets, category_id FK→categories,
  PRIMARY KEY (budget_id, category_id)
)

subscriptions (
  id, user_id FK→users, name, amount, currency,
  billing_cycle (enum: weekly/monthly/quarterly/yearly),
  billing_day (int — day of month/week, depending on cycle),
  last_billed_at (nullable — for next-date computation),
  account_id FK→accounts,
  payment_method_id FK→payment_methods (nullable),
  category_id FK→categories (nullable),
  is_active, url, notes,
  created_at, updated_at, deleted_at
)

piggy_banks (
  id, user_id FK→users, name,
  target_amount, currency, current_amount,
  target_date, notes, is_completed,
  created_at, updated_at, deleted_at
)

piggy_bank_contributions (
  id, piggy_bank_id FK→piggy_banks,
  transaction_id FK→transactions,
  contribution_type (enum: transfer/expense),
  amount, date, notes,
  created_at
)

import_batches (
  id, user_id FK→users,
  source (enum: pdf/gpay_takeout/manual),
  filename, account_id FK→accounts (nullable),
  status (enum: pending/processed/cancelled),
  total_parsed, total_confirmed, total_rejected,
  imported_at, completed_at
)

raw_import_records (
  id, batch_id FK→import_batches,
  raw_text, parsed_json (JSONB),
  status (enum: pending/confirmed/rejected/duplicate),
  transaction_id FK→transactions (nullable),
  confidence (enum: high/medium/low),
  match_type (enum: exact/fuzzy/manual/none),
  created_at
)

report_dashboards (
  id, user_id FK→users, name, description,
  created_at, updated_at, deleted_at
)

report_widgets (
  id, dashboard_id FK→report_dashboards, title,
  query (text), viz_type (enum: bar/line/pie/kpi/table),
  viz_config (JSONB), position (JSONB),
  created_at, updated_at
)

llm_activity_log (
  id, user_id FK→users, operation,
  payload_summary (JSONB — what was sent),
  backend, model, duration_ms, succeeded,
  created_at
)
```

**Notes:**
- The `splits` and `split_shares` model means a transaction is "split" iff it appears in `splits.expense_transaction_id`. No type field needed on transactions.
- `next_billing_at` for subscriptions is computed from `billing_cycle` + `billing_day` + `last_billed_at` (or fallback rule). Not stored.
- `applicability` on categories is nullable — when null, the category is allowed on any transaction type.
- The split invariant is enforced both in application logic and via a deferred CHECK constraint (or trigger) in Postgres.

## 4.5 API Design

REST over JSON. All endpoints require auth except `/auth/login`, `/auth/setup` (first-run only), `/auth/accept-invite`, and `/health`.

```
POST   /api/v1/auth/setup            # first-run only; 404 if user exists
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
POST   /api/v1/auth/invites          # create invite
POST   /api/v1/auth/accept-invite    # invitee accepts

GET    /api/v1/settings
PATCH  /api/v1/settings

(CRUD for: accounts, payment-methods, payees, categories, tags,
 budgets, subscriptions, piggy-banks)

GET    /api/v1/transactions?from=&to=&account=&category=&...
POST   /api/v1/transactions
GET    /api/v1/transactions/{id}
PATCH  /api/v1/transactions/{id}
DELETE /api/v1/transactions/{id}

GET    /api/v1/splits
POST   /api/v1/splits                # upfront creation
POST   /api/v1/splits/bundle         # retroactive bundling
GET    /api/v1/splits/{id}
PATCH  /api/v1/splits/{id}
DELETE /api/v1/splits/{id}
PATCH  /api/v1/split-shares/{id}/settle
PATCH  /api/v1/split-shares/{id}/forgive

POST   /api/v1/imports/pdf
GET    /api/v1/imports/{batch_id}/records
PATCH  /api/v1/imports/{batch_id}/records/{id}
POST   /api/v1/imports/{batch_id}/confirm

POST   /api/v1/imports/gpay-takeout

GET    /api/v1/dashboard/home

GET    /api/v1/reports/dashboards
POST   /api/v1/reports/dashboards
(... CRUD for dashboards and widgets)

POST   /api/v1/reports/query         # ad-hoc SQL (read-only)
GET    /api/v1/reports/schema        # schema metadata

POST   /api/v1/export                # full data export
POST   /api/v1/import-archive        # full data import
```

Response envelope:
```json
{ "data": ..., "meta": { ... }, "error": null }
```

Pagination via cursor: `?cursor=&limit=`.

## 4.6 Frontend Architecture

```
/frontend
  /src
    /api          — TanStack Query hooks per endpoint
    /components   — Radix + Tailwind components
    /pages        — route-level views
      /Setup            (first-run wizard)
      /Login
      /Dashboard
      /Transactions
      /TransactionForm
      /Accounts
      /Payees
      /Categories
      /Budgets
      /Subscriptions
      /PiggyBanks
      /Imports
      /Reports
      /Settings
    /lib          — date math, currency formatting, etc.
    /styles       — Tailwind config + globals
    /pwa          — service worker, manifest
  vite.config.ts
  tailwind.config.ts
```

**Responsiveness:** Mobile-first. Every page designed at 360px first. Navigation collapses to bottom tab bar on mobile. Tables become cards. Modals become full-screen sheets.

**Design system:** Custom built on Radix primitives + Tailwind. A small set of foundational components (Button, Input, Select, Dialog, Sheet, Card, Tabs, Toast, DataTable) styled once and reused.

**PWA:** Manifest, service worker, install prompt. Offline shell shows "you're offline" state; no offline writes in v1.

## 4.7 PDF Processing Pipeline

```
[Upload PDF + password]
        │
        ▼
[API: validate, store temp file]
        │
        ▼
[Worker: pikepdf unlock]
        │
        ▼
[Worker: pdfplumber extract]
        │
        ▼
[Worker: dispatch to bank-specific parser]
        │
        ├── high confidence ──▶ [Balance verify]
        │                              │
        └── low confidence ──▶ [Vision LLM fallback] ──┐
                                                       ▼
                                              [Balance verify]
                                                       │
                                                       ▼
                                            [Dedup vs existing]
                                                       │
                                                       ▼
                                       [Create raw_import_records]
                                                       │
                                                       ▼
                                                [Notify user]
```

Bank-specific parsers live in `parsers/` as plug-in modules implementing a common interface, selected by matching identifying text in the first page. New banks added by writing a new parser.

## 4.8 Data Migration & Portability

Two complementary mechanisms:

### Native Postgres dump
- `pg_dump` produces a complete, perfectly-faithful backup.
- Restore via `pg_restore` into a fresh Postgres of compatible version.
- **Pros:** preserves everything including constraints, indexes, sequences. Fast.
- **Cons:** version-specific; not human-readable; tied to Postgres.

### Portable JSON archive
- A tar.gz file containing:
  - `manifest.json` — schema version, exported_at, table list, user info.
  - One JSON file per table — array of records, UUIDs as-is.
  - Optional binary blobs directory (none in v1).
- **Pros:** human-readable, version-portable, cross-system. UUIDs preserve all relationships natively without ID remapping.
- **Cons:** larger than dumps; slower to restore.

Both formats preserve **every** relationship because the UUIDs are stable across export/import. A transaction that references budget X via `transaction_budgets` will, on restore, still reference budget X — no FK remapping needed.

### Migration workflow

To move between deployments (e.g. home server → VPS, or between machines):

1. On the source: `POST /api/v1/export` → download archive.
2. On the destination (fresh install, first-run setup completed): `POST /api/v1/import-archive` → upload archive.
3. The system loads each table in dependency order. Transactionally. On conflict (e.g. existing user with same email), fails clearly.

### Why this approach over alternatives

- **Vs. CSV per table:** CSVs lose nested structures (JSONB columns) and require explicit FK relinking. JSON keeps everything.
- **Vs. raw SQL INSERT scripts:** SQL is brittle across Postgres versions and bloated for human review.
- **Vs. proprietary binary format:** opaque, harder to debug, harder to recover from.

**Recommendation:** ship both `pg_dump` (for routine backups) and JSON archive (for migrations and human-readable archive). They complement each other.

## 4.9 Deployment

**Single `docker-compose.yml`:**

```yaml
services:
  api:
    image: financetracker/api:latest
    environment:
      DATABASE_URL: postgresql+asyncpg://...
      JWT_SECRET: ${JWT_SECRET}
      LLM_BACKEND: ${LLM_BACKEND}
      OLLAMA_HOST: ${OLLAMA_HOST}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      ANTHROPIC_ZERO_RETENTION: "true"
    depends_on: [postgres, redis]
  worker:
    image: financetracker/api:latest
    command: arq worker.WorkerSettings
  frontend:
    image: financetracker/frontend:latest
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
  postgres:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7
  ollama:
    image: ollama/ollama:latest
    profiles: [local-llm]
    volumes: [ollama:/root/.ollama]
```

**Two environments, identical config:**
- **Home / Pi 5 / mini PC:** `docker compose --profile local-llm up`. Caddy stays on the local network.
- **Cloud VPS:** `docker compose up` (no Ollama profile; cloud LLM via env vars). Caddy obtains Let's Encrypt cert.

**Env vars:**
```
DATABASE_URL              required
JWT_SECRET                required
LLM_BACKEND               required (ollama|anthropic|openai|none)
OLLAMA_HOST               required if LLM_BACKEND=ollama
ANTHROPIC_API_KEY         required if LLM_BACKEND=anthropic
ANTHROPIC_ZERO_RETENTION  recommended (true) if using anthropic
OPENAI_API_KEY            required if LLM_BACKEND=openai
LLM_MODEL                 required
LLM_VISION_MODEL          required if vision fallback enabled
REDIS_URL                 optional
PUBLIC_BASE_URL           required
```

## 4.10 Security

- **Passwords:** argon2id, tunable cost.
- **Sessions:** JWT (HS256), 24h access tokens, 30d refresh tokens with rotation.
- **First-run:** the setup endpoint is open until the first user exists, then returns 404. The auth dependency for other endpoints checks user existence on every request.
- **Invites:** signed tokens, time-limited, single-use.
- **Query endpoint security:** runs against a dedicated read-only Postgres role. Statement timeout 10 seconds. User_id filtering enforced via parameter binding and (in v1.1) row-level security policies.
- **Rate limiting:** per-IP on auth; per-user on imports.
- **Secrets:** never logged. Always from env.

## 4.11 Observability

- **Structured JSON logs** with request correlation IDs.
- **`/health`** (liveness), **`/ready`** (DB + Redis reachable).
- **Prometheus metrics** at `/metrics`.
- **LLM Activity Log** (`llm_activity_log` table) — every LLM call records what was sent (summary) and which backend.

## 4.12 Testing

- **Unit:** parsers, matchers, validators (pure functions).
- **Integration:** API + DB via fixtures.
- **End-to-end:** Playwright against the running stack.
- **PDF parser corpus:** anonymized real statements per bank checked into the repo; CI verifies parsers remain correct.
- **LLM:** mocked at the `LLMClient` interface; real-API tests behind an env-var flag.

## 4.13 Performance

- Composite indexes on `(user_id, transacted_at)`, `(user_id, account_id, transacted_at)`, `(user_id, deleted_at)` everywhere relevant.
- Cursor pagination by `(transacted_at DESC, id DESC)`.
- `current_balance` denormalized on accounts; updated transactionally; nightly reconciliation job.
- Home dashboard queries parallelized server-side.
- Heavy operations (PDF parse, GPay match) run in the worker.

---

# 5. Open Questions / Future Work

- **Notifications.** Out of v1. Schema already supports the data needed.
- **Attachments.** Deferred. Easy to add later via `transaction_attachments` table + object storage abstraction.
- **Native mobile app.** PWA is sufficient. API + schema are mobile-ready.
- **Investments.** A separate `holdings` + `prices` model alongside, when needed.
- **Multi-user households.** Schema already scopes by `user_id`; add a `households` table and update filters when needed.
- **Row-Level Security for query endpoint.** v1.1 upgrade: enforce data scoping via Postgres RLS policies rather than via query parameters.
- **LLM prompt evaluation.** Build a test harness that scores LLM extractions against gold-standard PDF corpus; pick the best model per task.
- **Automatic GPay-bank reconciliation.** Currently semi-manual; could be fully automatic with better matching heuristics and UPI ref ID regex extraction.

---

# 6. Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Storage model | Relational (Postgres) | Financial data is inherently relational; SQL access aligns with user's reporting needs. |
| Backend language | Python | Best-in-class PDF parsing and LLM SDK ecosystem. |
| Frontend stack | React 19 + Vite + Tailwind + Radix + Bun | Full design control with accessibility; PWA-ready; pure SPA fits use case. |
| Next.js | Explicitly rejected | None of Next's value props (SEO, SSR, edge) apply to an authed personal app. Adds complexity without benefit. |
| LLM integration | Pluggable interface, default Ollama | Privacy-first; cloud opt-in. |
| Preferred LLM hosting | Local on dedicated home server (Option B) | Best privacy + capability. Pi 5 works (Option A) but vision is slow. |
| Deployment | docker-compose, env-driven | Identical artifact, identical orchestration, on home or cloud. |
| Auth | JWT + argon2; first-run setup wizard; invite-only for additional users | Simplest viable; avoids exposed public signup. |
| Query interface | Raw SQL on read-only DB role | Maximum flexibility; user is sole consumer. |
| Splits model | Separate `splits` entity with `split_shares`; transactions stay type-pure | Cleaner mental model; transactions don't carry split metadata. |
| Manual entry | Structured form only; no compact syntax; no LLM assist | Simpler to build, easier to use, no parsing ambiguity. |
| Budget edit semantics | Future-default with current-period checkbox; delete prompts for scope | Matches user mental model of recurring schedules. |
| Subscription next-date | Computed on the fly from billing day + cycle | Avoids stale stored dates. |
| Transaction timing | `transacted_at` timestamp distinct from `created_at`/`updated_at` | Allows backfilling and editing without losing audit info. |
| Multi-currency | Per-transaction override of primary currency; no FX conversion | Keeps system simple; bank handles real conversion. |
| Data migration | JSON archive + pg_dump, both supported | JSON for portability, dump for fidelity. UUIDs preserve relationships. |

---

*End of document.*
