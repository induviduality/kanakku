# Kanakku — Personal Finance Tracker Technical Design Document

**Status:** v3
**Author:** Induja
**Last updated:** 2026-05-22

---

> ## v1 Implementation Deviations
>
> The following sections describe features as *designed*. The current implementation diverges in two areas that are intentional and logged:
>
> **Ollama decoupled from Docker Compose (milestone 13 / ad-hoc sprint)**
> Ollama is no longer a service in `docker-compose.yml`. The LLM code (`app/llm/*`) and the **Settings → LLM Activity** page still ship, but `LLM_BACKEND` defaults to `none` so no model runs unless explicitly configured. Any section in this TDD that references an `ollama` compose service or `docker compose exec ollama` commands reflects the original design, not the current deployment. See [decisions/log.md](decisions/log.md) and [reviews/project-review-2026-06-02.md](reviews/project-review-2026-06-02.md).
>
> **GPay Takeout Enrichment removed (ad-hoc sprint)**
> FR-12 (§2.1.12, §3.3.12) and the related endpoints, models, and frontend pages were removed in the ad-hoc sprint. Migration `0016_gpay_matches` remains in history; the feature description in this TDD is preserved as a record of the original design intent. See [decisions/log.md](decisions/log.md).
>
> **`opening_balance` as a 4th transaction type**
> The implementation added `opening_balance` as a transaction type despite the spec and `CLAUDE.md` stating "three types only". This is pending a formal decision to either legitimize it in the spec or move it off the transaction enum.

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

Bank statements in India are almost universally distributed as password-protected PDFs, not CSVs or API feeds. Fortunately, those PDFs have selectable text and follow predictable per-bank layouts, which makes deterministic parsing viable.

Real-world transactions are often split among friends (especially via UPI), with no system-of-record linking the split context to the underlying bank debit. Payment apps like Google Pay provide richer merchant context than the bank statement does, but offer no clean reconciliation path to the bank.

The result: most people either give up tracking, or settle for a tool that captures a fraction of their financial reality. **Kanakku** is built to close that gap.

## 1.2 Goals

- **Own your data.** A relational data model with full read/write access, queryable via SQL.
- **Two equally-supported entry paths.** Manual entry and PDF statement import are both first-class. Realistic usage: weekly check-in mixing both.
- **Support retroactive backfilling.** Historical bank statements can be imported to build up past data; manual entry allows filling specific known gaps.
- **Model real life accurately.** Splits with friends (including retroactive bundling), partial settlement, forgiven shares, recurring and ad-hoc budgets, goal-based savings, and subscriptions are first-class concepts.
- **Be platform-agnostic.** The same codebase runs on a personal home server and on a cloud VPS without code changes — configuration only. The v1 deployment target is a Raspberry Pi 5 on the user's home network.
- **Be device-agnostic.** The interface works as well on mobile browsers as on desktop, and is installable as a PWA.
- **Be privacy-first.** All data lives on the user's hardware. The LLM runs locally on the same device. No data leaves the host in v1.

## 1.3 Non-Goals

- **Not a multi-tenant SaaS.** Single-user (or small-household) personal use.
- **Not double-entry accounting.** Liability accounts are modeled, but we are not building a general ledger.
- **Not investment portfolio management.** Stocks, mutual funds, and crypto holdings are out of scope.
- **Not currency conversion.** Multi-currency entries are stored faithfully, but no FX-aware reporting.
- **Not a budgeting envelope system.** Budgets are spending limits and analytical groupings.
- **Not a bill-pay tool.** The system only records transactions.
- **No notifications in v1.** Deferred.
- **No transaction attachments in v1.**
- **No LLM-assisted manual entry.** Manual entry is structured form input only.
- **No vision-model PDF extraction in v1.** All target bank statements have selectable text — deterministic parsing is sufficient.
- **No cloud-LLM deployment in v1.** The LLMClient abstraction supports cloud backends (Anthropic, OpenAI) but only Ollama is exercised in v1.

## 1.4 Glossary

- **Account** — a place money lives (bank account, cash, credit card, loan).
- **Payment Method** — a specific way money moves out of an account (debit card, credit card, netbanking, UPI app).
- **Payee** — an entity money is paid to or received from. Includes merchants, businesses, and people.
- **Category** — what kind of spending or income a transaction represents. Many-to-many with transactions.
- **Tag** — a free-form label on a transaction. Many-to-many.
- **Transaction** — a single financial event. Types: expense, income, transfer.
- **Split** — a distinct entity wrapping one expense transaction and partitioning its cost into shares.
- **Split Share** — one share within a split. May belong to the user or to another payee. Status: pending, settled, or forgiven.
- **Budget** — a spending limit, scoped to a time period and/or categories.
- **Subscription** — a recurring known expense with a billing cycle.
- **Piggy Bank** — a savings goal with a target amount, target date, and tracked contributions.
- **Import Batch** — a single ingestion event (e.g. one uploaded PDF) producing raw records that may become transactions.

---

# 2. Requirements

## 2.1 Functional Requirements

### 2.1.1 Authentication & Setup
- **FR-1.1** Users authenticate via email + password.
- **FR-1.2** Sessions persist via secure tokens.
- **FR-1.3** First-run setup screen creates the initial user when no users exist.
- **FR-1.4** Public signup disabled after first user; additional users via signed invite tokens.
- **FR-1.5** Schema supports multi-user from day one.

### 2.1.2 User Settings
- **FR-2.1** Each user has a settings profile.
- **FR-2.2** Settings: primary currency, timezone, date format, number format.
- **FR-2.3** Primary currency can be changed; existing records unaffected.

### 2.1.3 Accounts & Payment Methods
- **FR-3.1** Accounts of types: bank, cash, credit card, loan.
- **FR-3.2** Each account has currency and current balance.
- **FR-3.3** Payment methods attached to accounts: debit card, credit card, netbanking, UPI.
- **FR-3.4** UPI methods may optionally specify the app (GPay, PhonePe, Paytm, etc.).
- **FR-3.5** Accounts and payment methods can be marked inactive.

### 2.1.4 Payees
- **FR-4.1** Payees with name, type (merchant/person/business/other), optional default categories.
- **FR-4.2** Default categories pre-populate on new transactions (overrideable).
- **FR-4.3** Payees of any type can participate in splits.

### 2.1.5 Categories & Tags
- **FR-5.1** Categories with name, icon, color. Applicability (expense/income/both) optional.
- **FR-5.2** Transactions can belong to multiple categories.
- **FR-5.3** Tags with name and color, free-form, many-to-many with transactions.

### 2.1.6 Transactions
- **FR-6.1** Three types: expense, income, transfer.
- **FR-6.2** Fields: transacted-at timestamp, amount, currency, account, optional payment method, payee, description, notes.
- **FR-6.3** Transacted-at independent of created-at/updated-at.
- **FR-6.4** Currency defaults to user primary; overrideable per transaction.
- **FR-6.5** Transfers specify source and destination accounts.
- **FR-6.6** Transactions can link to budgets, subscriptions, piggy banks.

### 2.1.7 Splits
- **FR-7.1** A split wraps exactly one expense transaction.
- **FR-7.2** Each split has one or more shares with status (pending/settled/forgiven), amount, optional payee (null = user's own share).
- **FR-7.3** Invariant: sum of shares = parent expense amount.
- **FR-7.4** Upfront split creation when entering an expense.
- **FR-7.5** Retroactive bundling of existing transactions into a split.
- **FR-7.6** Bundling validation: `sum(income legs) + sum(forgiven) ≤ expense amount`.
- **FR-7.7** Settling a share links it to an income transaction.
- **FR-7.8** Forgiving a share absorbs it into user's net expense.
- **FR-7.9** Net expense = `user own share + sum(forgiven shares)`.
- **FR-7.10** Settlement income transactions are not counted as "income" in reports.

### 2.1.8 Budgets
- **FR-8.1** Amount, currency, optional time period (week/month/quarter/year/custom).
- **FR-8.2** Open-ended budgets use explicit active/inactive toggle.
- **FR-8.3** Time-bounded budgets derive active status from current date.
- **FR-8.4** Type: recurring or ad-hoc.
- **FR-8.5** Recurring budgets repeat via recurrence rule; instances generated on the fly.
- **FR-8.6** Editing a recurring budget affects future periods by default; checkbox to include current period.
- **FR-8.7** Deleting a recurring budget prompts: this instance / this and future / future only.
- **FR-8.8** Single-instance overrides without affecting the recurring template.
- **FR-8.9** Ad-hoc budgets: optional start/end dates; without dates use is_active.
- **FR-8.10** Budgets optionally scoped to specific categories.
- **FR-8.11** Transactions linkable to one or more budgets.

### 2.1.9 Subscriptions
- **FR-9.1** Subscription has name, amount, currency, billing cycle, billing day.
- **FR-9.2** Next billing date computed on the fly from cycle + billing day.
- **FR-9.3** Default account, payment method, category.
- **FR-9.4** Past transactions can be linked to a subscription.
- **FR-9.5** Active/inactive toggle.
- **FR-9.6** Active subscriptions surface on the home dashboard with status.

### 2.1.10 Piggy Banks
- **FR-10.1** Name, target amount, target date, current amount.
- **FR-10.2** Contributions: transfer (between user accounts) or expense (counts toward goal).
- **FR-10.3** Current amount = sum of contributions.

### 2.1.11 Statement Import
- **FR-11.1** Accepts PDF bank statement uploads, including password-protected.
- **FR-11.2** Extraction is fully deterministic: pikepdf unlock + pdfplumber text extraction + bank-specific parser.
- **FR-11.3** Extracted transactions presented for user review before commit.
- **FR-11.4** Duplicates detected against existing transactions.
- **FR-11.5** Each batch auditable: filename, parsed/confirmed/rejected counts.
- **FR-11.6** Balance verification (opening + credits − debits = closing) flags suspect extractions.

### 2.1.12 GPay Takeout Enrichment
- **FR-12.1** Accepts Google Takeout exports of GPay transaction history.
- **FR-12.2** Matches GPay records to existing bank transactions by amount + date proximity.
- **FR-12.3** Enriches bank transactions with clean merchant names.
- **FR-12.4** Ambiguous matches presented for manual resolution.

### 2.1.13 Manual Entry
- **FR-13.1** Structured web form.
- **FR-13.2** Form captures every field on the transaction model.
- **FR-13.3** No compact-syntax parser, no LLM assistance for entry.
- **FR-13.4** Defaults from settings + autocomplete on payees + recent-account-first conveniences.

### 2.1.14 Home Dashboard
- **FR-14.1** Default dashboard shows current month spending vs budgets, category breakdown, recent transactions, pending splits, piggy bank progress, account balances, active subscriptions.
- **FR-14.2** Dashboard is not configurable.

### 2.1.15 Reports & Custom Dashboards
- **FR-15.1** Reports section allows custom dashboards.
- **FR-15.2** Each dashboard is a named collection of widgets in a configurable grid.
- **FR-15.3** Widgets backed by user-written SQL.
- **FR-15.4** Visualizations: bar, line, pie, KPI card, table.
- **FR-15.5** Schema reference panel + starter library of common queries.

### 2.1.16 Data Migration & Portability
- **FR-16.1** All user data exportable to a self-contained archive preserving every relationship.
- **FR-16.2** Archive can be re-imported into a fresh instance.
- **FR-16.3** Both portable JSON archive and native database dump formats supported.

## 2.2 Non-Functional Requirements

### 2.2.1 Portability
- **NFR-1.1** Identical code on self-hosted (Raspberry Pi 5 default) and cloud VPS.
- **NFR-1.2** All deployment config via environment variables.
- **NFR-1.3** Packaged as containers, orchestrated via a single declarative config.

### 2.2.2 Privacy
- **NFR-2.1** v1 is fully local. No data leaves the host.
- **NFR-2.2** LLM runs on the same device (Ollama with qwen2.5:1.5b).
- **NFR-2.3** The LLMClient interface supports cloud backends, but no cloud client is wired up in v1.
- **NFR-2.4** No telemetry, analytics, or external calls.

### 2.2.3 Responsiveness
- **NFR-3.1** UI fully usable down to 360px viewport.
- **NFR-3.2** UI installable as a PWA.
- **NFR-3.3** Common interactions complete in under 1 second.

### 2.2.4 Reliability
- **NFR-4.1** No transaction silently dropped during import.
- **NFR-4.2** Destructive actions confirmed and recoverable for 30 days (soft delete).
- **NFR-4.3** Schema enforces referential integrity.

### 2.2.5 Maintainability & Extensibility
- **NFR-5.1** Clean API/frontend separation.
- **NFR-5.2** New bank parsers addable without core changes.
- **NFR-5.3** Schema migrations versioned and reversible.

### 2.2.6 Security
- **NFR-6.1** Passwords hashed with argon2id.
- **NFR-6.2** Sessions use signed, time-limited tokens.
- **NFR-6.3** All API endpoints require auth except login, setup, invite-accept, health.
- **NFR-6.4** HTTPS via reverse proxy when deployed.

### 2.2.7 Performance
- **NFR-7.1** Dashboard queries under 500ms on 100K transactions.
- **NFR-7.2** PDF import of a 50-transaction monthly statement completes in under 30 seconds (no vision step in v1).

### 2.2.8 Backup & Data Portability
- **NFR-8.1** All data exportable to portable, human-readable format.
- **NFR-8.2** DB backups triggerable via CLI or scheduled job.

### 2.2.9 Resource Footprint
- **NFR-9.1** The entire stack (Postgres, Redis, API, worker, frontend, Ollama with model loaded) must run on a Raspberry Pi 5 with 8GB RAM with at least 2GB headroom for OS and other processes.

---

# 3. Functional Specification

## 3.1 System Overview

Three primary surfaces:

1. **Daily View** — opinionated home dashboard.
2. **Entry Surfaces** — manual form entry, PDF statement import, GPay enrichment.
3. **Analysis Surface** — custom report dashboards backed by user-written SQL.

## 3.2 Entity Model (Conceptual)

The transaction is central. Around it:
- **Accounts** hold money; **payment methods** are interfaces to accounts.
- **Payees** are entities money flows to/from.
- **Categories** and **tags** classify transactions.
- **Budgets**, **subscriptions**, and **piggy banks** group transactions across time.
- A **split** wraps one expense transaction and partitions its cost into **shares**.
- **Import batches** trace where transactions came from.

Transactions are type-pure: expense, income, transfer. "Being a split" is a property of being referenced by a split entity, not a transaction type.

## 3.3 Feature Specifications

### 3.3.1 Authentication & First-Run Setup

On fresh install, the system detects no users and shows a setup screen. After the first user, only the login screen is shown.

Additional users (e.g. a partner) added via invite tokens: an existing user generates a signed token (URL), the invitee opens it and sets their password. No public signup.

### 3.3.2 User Settings

Settings include primary currency, timezone, date/number format. Defaults apply to new accounts and transactions; existing records unchanged.

### 3.3.3 Accounts & Payment Methods

Standard CRUD with type, currency, opening balance. Inactive accounts hidden from new-transaction flows.

### 3.3.4 Payees

Unified entity for any transacting party. Default categories auto-fill (overrideable) when a transaction selects the payee.

### 3.3.5 Categories & Tags

Categories: name, icon, color, optional applicability. Tags: name, color. Both many-to-many with transactions.

### 3.3.6 Transactions

Form-based entry. Defaults from settings (currency, timezone) and recent usage (account). Transacted-at defaults to now, fully editable. Soft delete with 30-day recovery.

Transfers specify source and destination. If currencies differ, both source and destination amounts can be entered separately (no automatic FX).

### 3.3.7 Splits

A split is a separate entity wrapping one expense transaction.

**Upfront:** when entering an expense, toggle "this is a split", add co-payers with amounts. User's share is the remainder.

**Retroactive bundling:** select one expense + zero or more income transactions from the list. System computes user share as remainder. Forgiven shares can be added.

**Share states:** pending, settled, forgiven.

**Net expense in reports:** `user own share + sum(forgiven shares)`. Settled and pending shares to others are excluded from net expense. Settlement income transactions don't count as "income".

### 3.3.8 Budgets

**Active status:** time-bounded budgets derive from current date; open-ended use explicit toggle.

**Edit recurring budget:** changes apply to future by default; checkbox "also apply to current period?" (checked by default). Past periods never touched.

**Delete recurring budget:** three options — instance only / current and future / future only.

**Single-instance override:** edit one instance without changing the template.

**Ad-hoc budgets:** explicit dates or use is_active flag.

### 3.3.9 Subscriptions

User enters billing day + cycle. Next billing date computed on the fly. Dashboard surfaces active subscriptions with status (upcoming / due soon / overdue). Past transactions can be linked.

### 3.3.10 Piggy Banks

Goal-tracking entity. Contributions of type transfer (between user accounts) or expense (purchase counts toward goal). Current amount = sum of contributions.

### 3.3.11 Statement Import Pipeline

1. **Upload.** User selects PDF, supplies password if needed.
2. **Unlock.** pikepdf decrypts.
3. **Extract.** pdfplumber pulls text and tables.
4. **Parse.** Bank-specific parser converts to structured candidates.
5. **Verify.** Balance equation checked against statement headers.
6. **Deduplicate.** Candidates compared to existing transactions.
7. **Review.** Candidates presented grouped by status (new / suspected duplicate / low confidence).
8. **Confirm.** User reviews, edits, links to payees/categories, confirms. Confirmed become transactions.

Every batch fully auditable.

### 3.3.12 GPay Takeout Enrichment

User uploads Takeout JSON. System matches by amount + date proximity. Exact matches auto-link. Ambiguous matches resolved manually. Bank statement remains source of truth; GPay only enriches merchant names.

### 3.3.13 Manual Entry

Structured form on a dedicated page. Captures every transaction field. No compact text syntax, no LLM assistance. Conveniences: defaults from settings, type-ahead on payees and categories, inline creation.

### 3.3.14 Home Dashboard

Fixed layout summarizing current month: total spent vs budgets, spending by category, recent transactions, pending splits, piggy bank progress, account balances, active subscriptions with status.

### 3.3.15 Reports & Custom Dashboards

Create named dashboards with widgets backed by SQL queries. Visualizations: bar, line, pie, KPI, table. Drag-and-drop grid layout.

Schema reference panel (tables, columns, FKs) plus starter query library. Queries run against a read-only DB projection.

## 3.4 Cross-Cutting Behaviors

### 3.4.1 Soft Delete

All user-owned entities soft-deleted with 30-day recovery via "Recently Deleted" view.

### 3.4.2 Audit Trail

Transactions track created_at, updated_at, transacted_at, and (when applicable) the import batch and raw record they originated from.

### 3.4.3 Multi-Currency

Each account has a currency. Transactions inherit account currency, overrideable per-transaction. No automatic FX. Reports aggregate per-currency.

---

# 4. Technical Specification

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
│  - LLM client (Ollama)                      │
└───┬───────────────────────────┬─────────────┘
    │                           │
┌───▼─────────────┐   ┌─────────▼──────────────┐
│ PostgreSQL DB   │   │ Ollama (local)         │
│                 │   │ qwen2.5:1.5b           │
└─────────────────┘   └────────────────────────┘
```

All components run in containers on a Raspberry Pi 5, orchestrated via a single `docker-compose.yml`. The same compose file works on a cloud VPS; only env vars change.

## 4.2 Technology Stack

### Backend
- **Python 3.12+** — strongest ecosystem for PDF parsing and LLM SDKs.
- **FastAPI** — async, pydantic-native.
- **SQLAlchemy 2.0 (async)** + **Alembic**.
- **PyJWT** + **argon2-cffi**.
- **ARQ** for background tasks (Redis-backed).

### Frontend
- **Bun** runtime/package manager.
- **React 19** (pure SPA — no SSR, no Next.js).
- **Vite** bundler.
- **Tailwind CSS** + **Radix UI** headless primitives.
- **Recharts** for visualization.
- **TanStack Query** + **TanStack Router**.
- **vite-plugin-pwa** for PWA support.

### On Next.js — explicit rejection

Next.js does not add value here. SEO/SSR irrelevant for an authed personal app, self-hosting complexity higher, App Router slower to iterate than Vite. Stay with Vite + React 19.

### Database
- **PostgreSQL 16+**.

### Cache / Queue
- **Redis 7**.

### PDF Processing
- **pikepdf** for password-protected PDF unlocking.
- **pdfplumber** for text and table extraction (all target statements have selectable text — no vision needed).
- **Bank-specific parsers** as Python modules implementing a common interface.

### LLM Integration

A single `LLMClient` interface with multiple implementations:

```python
class LLMClient:
    async def suggest_category(self, payee_name: str, description: str, available_categories: list[str]) -> str | None
    async def match_gpay_to_bank(self, gpay_records: list, bank_candidates: list) -> list[Match]
```

The interface is intentionally text-only — no vision method in v1.

Implementations:
- `OllamaClient` (v1 default, runs against local Ollama)
- `NullClient` (for testing / when LLM disabled)

Future implementations (not built in v1): `AnthropicClient`, `OpenAIClient`. The interface is small enough that adding these later is straightforward.

## 4.3 Deployment Target & Resource Budget

**Primary v1 target: Raspberry Pi 5 (8GB RAM).**

### Model choice

**`qwen2.5:1.5b`** — ~1.5GB RAM, ~10-15 tokens/sec on Pi 5. Sufficient for short structured prompts (category suggestion, GPay matching). Chosen over the 3B variant to preserve RAM headroom.

### Resource budget on Pi 5

```
OS + system processes   ~500MB
Docker daemon           ~200MB
Postgres                ~200MB
Redis                   ~50MB
FastAPI app             ~150MB
ARQ worker              ~100MB
Ollama + qwen2.5:1.5b  ~1.5GB
──────────────────────────────
Total                   ~2.7GB
Headroom                ~5.3GB  (plenty)
```

### Cloud VPS as future option

Same container stack works on any Docker host. To switch:
- Change `OLLAMA_HOST` to a remote URL, or
- Add a cloud LLM backend (when implemented post-v1) by setting `LLM_BACKEND=anthropic` etc.

No code changes required — only env vars.

## 4.4 Database Schema

UUIDs as primary keys. `created_at`, `updated_at`, `deleted_at` (nullable) on all user-owned tables.

```sql
users (
  id, email UNIQUE, password_hash, created_at
)

user_settings (
  user_id PK FK→users, primary_currency, timezone,
  date_format, number_format, updated_at
)

sessions (
  id, user_id FK→users, token_hash, expires_at, created_at
)

invite_tokens (
  id, created_by_user_id FK→users, token_hash,
  email NULL, expires_at, used_at, created_at
)

accounts (
  id, user_id FK→users, name, type enum,
  currency, opening_balance, current_balance,
  is_active, timestamps, deleted_at
)

payment_methods (
  id, account_id FK→accounts,
  type enum(debit_card/credit_card/netbanking/upi),
  label, upi_app NULL, is_active,
  timestamps, deleted_at
)

payees (
  id, user_id FK→users, name,
  type enum(merchant/person/business/other),
  notes, is_active, timestamps, deleted_at
)

payee_default_categories (
  payee_id FK→payees, category_id FK→categories,
  PRIMARY KEY (payee_id, category_id)
)

categories (
  id, user_id FK→users, name, icon, color,
  applicability enum NULL,
  timestamps, deleted_at
)

tags (
  id, user_id FK→users, name, color,
  timestamps, deleted_at,
  UNIQUE (user_id, name) WHERE deleted_at IS NULL
)

transactions (
  id, user_id FK→users,
  type enum(expense/income/transfer),
  transacted_at TIMESTAMPTZ NOT NULL,
  amount Numeric(15, 2), currency,
  description, notes,
  account_id FK→accounts,
  payment_method_id FK→payment_methods NULL,
  payee_id FK→payees NULL,
  to_account_id FK→accounts NULL,
  to_amount NULL, to_currency NULL,
  subscription_id FK→subscriptions NULL,
  import_record_id FK→raw_import_records NULL,
  timestamps, deleted_at
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
  notes, timestamps, deleted_at
)

split_shares (
  id, split_id FK→splits,
  payee_id FK→payees NULL,
  amount,
  status enum(pending/settled/forgiven),
  settled_at NULL,
  settlement_transaction_id FK→transactions NULL,
  forgiven_at NULL, notes, timestamps
)

-- INVARIANT (enforced by trigger + application):
-- SUM(split_shares.amount WHERE split_id = X) == 
--   (SELECT amount FROM transactions WHERE id = splits.expense_transaction_id)

budgets (
  id, user_id FK→users, name, amount, currency,
  period enum NULL, start_date NULL, end_date NULL,
  type enum(recurring/adhoc),
  recurrence_rule TEXT NULL,
  parent_budget_id FK→budgets NULL,
  is_modified_instance BOOL DEFAULT false,
  is_active BOOL DEFAULT true,
  notes, timestamps, deleted_at
)

budget_categories (
  budget_id FK→budgets, category_id FK→categories,
  PRIMARY KEY (budget_id, category_id)
)

subscriptions (
  id, user_id FK→users, name, amount, currency,
  billing_cycle enum, billing_day INT,
  last_billed_at TIMESTAMPTZ NULL,
  account_id FK→accounts,
  payment_method_id FK→payment_methods NULL,
  category_id FK→categories NULL,
  is_active, url, notes, timestamps, deleted_at
)

piggy_banks (
  id, user_id FK→users, name,
  target_amount, currency, current_amount,
  target_date, notes, is_completed,
  timestamps, deleted_at
)

piggy_bank_contributions (
  id, piggy_bank_id FK→piggy_banks,
  transaction_id FK→transactions,
  contribution_type enum(transfer/expense),
  amount, date, notes, created_at
)

import_batches (
  id, user_id FK→users,
  source enum(pdf/gpay_takeout/manual),
  filename, account_id FK→accounts NULL,
  status enum, total_parsed, total_confirmed, total_rejected,
  imported_at, completed_at NULL
)

raw_import_records (
  id, batch_id FK→import_batches,
  raw_text, parsed_json JSONB,
  status enum, transaction_id FK→transactions NULL,
  confidence enum(high/medium/low),
  match_type enum, created_at
)

report_dashboards (
  id, user_id FK→users, name, description,
  timestamps, deleted_at
)

report_widgets (
  id, dashboard_id FK→report_dashboards, title,
  query TEXT, viz_type enum,
  viz_config JSONB, position JSONB,
  timestamps
)

llm_activity_log (
  id, user_id FK→users, operation,
  payload_summary JSONB,
  backend, model, duration_ms, succeeded,
  created_at
)
```

**Indexes:** composite on `(user_id, transacted_at DESC)`, `(user_id, account_id, transacted_at DESC)`, `(user_id, deleted_at)`.

## 4.5 API Design

REST over JSON. All endpoints require auth except `/auth/login`, `/auth/setup` (first-run), `/auth/accept-invite`, `/health`.

Standard CRUD endpoints for: accounts, payment-methods, payees, categories, tags, budgets, subscriptions, piggy-banks.

Key non-CRUD endpoints:
```
POST   /api/v1/auth/setup            # first-run only
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/invites
POST   /api/v1/auth/accept-invite

GET    /api/v1/settings
PATCH  /api/v1/settings

GET    /api/v1/transactions          # rich filtering + cursor pagination
POST   /api/v1/transactions
PATCH  /api/v1/transactions/{id}

POST   /api/v1/splits                # upfront
POST   /api/v1/splits/bundle         # retroactive
PATCH  /api/v1/split-shares/{id}/settle
PATCH  /api/v1/split-shares/{id}/forgive

POST   /api/v1/imports/pdf
GET    /api/v1/imports/{batch_id}/records
POST   /api/v1/imports/{batch_id}/confirm

POST   /api/v1/imports/gpay-takeout

GET    /api/v1/dashboard/home

POST   /api/v1/reports/query         # read-only SQL
GET    /api/v1/reports/schema

POST   /api/v1/export
POST   /api/v1/import-archive
```

Response envelope: `{ "data": ..., "meta": {...}, "error": null }`. Pagination cursor: `?cursor=&limit=`.

## 4.6 Frontend Architecture

```
/frontend/src
  /api          — TanStack Query hooks
  /components   — Radix + Tailwind components
  /pages        — route-level views
  /lib          — utilities
  /styles       — Tailwind config + globals
  /pwa          — service worker, manifest
```

**Mobile-first:** every page designed at 360px first; tables become cards, navigation collapses to bottom tab bar.

**Design system:** custom on Radix primitives + Tailwind. Small set of foundational components (Button, Input, Select, Dialog, Sheet, Card, Tabs, Toast, DataTable).

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
        ▼
[Balance verification]
        │
        ▼
[Dedup vs existing]
        │
        ▼
[Create raw_import_records]
        │
        ▼
[Notify user — ready for review]
```

Parsers in `parsers/banks/` plug into a common interface, selected by matching identifying text on the first page. New banks added by writing a new parser.

If extraction quality is poor (low row count, balance mismatch), the batch is flagged as needing manual review — the user can correct rows in the UI. There is no LLM vision fallback in v1 since target statements have selectable text.

## 4.8 LLM Integration

Single abstraction:

```python
class LLMClient(ABC):
    async def suggest_category(payee_name, description, available_categories) -> str | None
    async def match_gpay_to_bank(gpay, bank_candidates) -> list[Match]
```

Implementations: `OllamaClient`, `NullClient`. Selected via `LLM_BACKEND` env var.

**Prompt design for `suggest_category`:** short structured prompt with available categories listed; expects single category name as output. Robust JSON parsing with one retry on malformed response.

**LLM activity transparency:** every call logged to `llm_activity_log` with operation, payload summary, backend, model, duration, success. Visible to user via Settings → LLM Activity.

## 4.9 Data Migration & Portability

Two complementary mechanisms:

### Native Postgres dump
- `pg_dump` for complete fidelity backup; `pg_restore` to recover.
- Routine backups via cron.

### Portable JSON archive
- tar.gz containing `manifest.json` + one JSON file per table.
- UUIDs preserved, so all relationships survive export/import.
- Human-readable; cross-system portable.

Both formats preserve every FK relationship — no ID remapping needed.

## 4.10 Deployment

**Single `docker-compose.yml` on `/infra`:**

```yaml
services:
  api:
    image: kanakku/api:latest
    environment:
      DATABASE_URL: postgresql+asyncpg://...
      JWT_SECRET: ${JWT_SECRET}
      LLM_BACKEND: ollama
      OLLAMA_HOST: ${OLLAMA_HOST}
      LLM_MODEL: qwen2.5:1.5b
    depends_on: [postgres, redis]
  worker:
    image: kanakku/api:latest
    command: arq worker.WorkerSettings
  frontend:
    image: kanakku/frontend:latest
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
    volumes: [ollama:/root/.ollama]
    environment:
      OLLAMA_MAX_LOADED_MODELS: 1
volumes: { pgdata: {}, ollama: {} }
```

**Env vars (v1):**
```
DATABASE_URL              required
JWT_SECRET                required
LLM_BACKEND               required (ollama|none)
OLLAMA_HOST               required if LLM_BACKEND=ollama
LLM_MODEL                 default: qwen2.5:1.5b
REDIS_URL                 optional
PUBLIC_BASE_URL           required
```

### Pi 5 vs Cloud VPS

Same compose file, same images. Only env values differ. On a cloud VPS, `OLLAMA_HOST` can point to the same docker-compose Ollama service or a remote Ollama instance.

## 4.11 Security

- argon2id passwords with tunable cost.
- JWT (HS256), 24h access tokens, 30d refresh tokens with rotation.
- First-run setup endpoint returns 404 once a user exists.
- Invite tokens: signed, time-limited, single-use, stored hashed.
- Query endpoint: dedicated read-only Postgres role, statement timeout 10s, user-id filter enforced via sqlglot AST check, row limit 10K.
- Rate limiting on auth and imports.
- Secrets only from env vars; never logged.

## 4.12 Observability

- Structured JSON logs with request correlation IDs.
- `/health` (liveness), `/ready` (DB + Redis reachable).
- Prometheus metrics at `/metrics`.
- LLM Activity Log table for transparency.

## 4.13 Testing

- **Unit** — parsers, matchers, validators.
- **Integration** — API + DB via fixtures.
- **End-to-end** — Playwright against the running stack.
- **PDF parser corpus** — anonymized real statements per bank in `tests/fixtures/parsers/`.
- **LLM** — mocked at `LLMClient` interface; opt-in real-Ollama tests gated by env var.

## 4.14 Performance

- Composite indexes on hot paths.
- Cursor pagination by `(transacted_at DESC, id DESC)`.
- `current_balance` denormalized on accounts, updated transactionally.
- Dashboard queries parallelized server-side.
- Heavy operations (PDF parse, GPay match) run in ARQ worker.

---

# 5. Open Questions / Future Work

- **Notifications.** Subscription renewals, budget overruns. Data model already supports this.
- **Attachments.** Receipts, invoice photos. Add `transaction_attachments` table + object storage abstraction.
- **Native mobile app.** PWA is sufficient for v1.
- **Investments.** Separate `holdings` + `prices` model.
- **Multi-user households.** Add `households` table + group filtering.
- **Row-Level Security for query endpoint.** Postgres RLS policies as a hardening upgrade.
- **Cloud LLM backends.** AnthropicClient / OpenAIClient implementations — interface already supports this.
- **Vision-model PDF fallback.** Add if a future bank emits scanned/image-only PDFs.
- **Additional bank parsers.** ICICI, SBI, Axis, Kotak, etc.
- **Auto-categorization from history.** Once user has enough labeled transactions, train a local classifier instead of (or in addition to) LLM-based category suggestion.

---

# 6. Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| App name | Kanakku (கணக்கு) | Tamil for accounts/reckoning — fits exactly, culturally rooted. |
| Storage model | Relational (Postgres) | Inherently relational; SQL access aligns with user's reporting needs. |
| Backend language | Python | Best ecosystem for PDF parsing and LLM SDKs. |
| Frontend stack | React 19 + Vite + Tailwind + Radix + Bun | Full design control, PWA-ready, pure SPA fits use case. |
| Next.js | Explicitly rejected | SEO/SSR irrelevant; adds complexity without benefit. |
| Primary deployment | Raspberry Pi 5 (8GB) | Sufficient resources, fully private, low cost. |
| LLM model | qwen2.5:1.5b via Ollama | Fits Pi 5 RAM comfortably (~1.5GB), fast enough (~10-15 tok/s), strong quality on short structured prompts. |
| Vision model | None in v1 | All target bank PDFs have selectable text — deterministic parsing is sufficient. |
| Cloud LLM | Deferred | Architecture supports it via LLMClient interface; not built in v1. |
| Deployment | docker-compose, env-driven | Same artifact on home or cloud. |
| Auth | JWT + argon2; first-run setup wizard; invite-only for additional users | Simplest viable; no exposed public signup. |
| Query interface | Raw SQL on read-only DB role | Maximum flexibility; user is sole consumer. |
| Splits model | Separate `splits` entity wrapping an expense; transactions stay type-pure | Cleaner mental model. |
| Manual entry | Structured form only; no compact syntax; no LLM | Simpler, easier to use, no parsing ambiguity. |
| Budget edit semantics | Future-default with current-period checkbox; delete prompts for scope | Matches user mental model. |
| Subscription next-date | Computed on the fly from billing day + cycle | Avoids stale stored dates. |
| Transaction timing | `transacted_at` timestamp distinct from created/updated | Allows backfilling without losing audit. |
| Multi-currency | Per-transaction override of primary; no FX conversion | Keeps simple; bank handles real conversion. |
| Data migration | JSON archive + pg_dump, both supported | JSON for portability, dump for fidelity. UUIDs preserve relationships. |

---

*End of document.*