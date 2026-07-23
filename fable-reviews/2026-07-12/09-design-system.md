# Kanakku Design System — "Ink & Marigold" — 2026-07-12

**This document is a build spec.** It is written to be handed directly to an implementing
LLM (or human) with no other context. It defines the design language, every token, the
type system, hierarchy rules, component specs, chart rules, motion, and a migration map
from the current `--kk-*` theme. Follow it exactly; where it marks OPEN, ask the owner.

---

## 0. Diagnosis of the current UI (what this replaces, and why)

The current theme (`frontend/src/styles/theme.css`) is a violet-on-near-black system:
bg ladder `#0a0b0f → #0f1117 → #111217 → #16181f`, 6 %-alpha borders, Inter everywhere,
purple accent `#a78bfa`, ambient glow blobs + film grain. Three measurable problems, which
map exactly to the owner's complaints:

1. **No contrast between layers.** Adjacent surface steps differ by ~2–3 luminance points
   and borders are near-invisible; page, card, and input melt into one dark field. → the
   "not contrast-y enough" complaint.
2. **No typographic hierarchy.** One family (Inter), body sizes `text-xs/sm` almost
   everywhere, headings only one step up. Nothing on a page is visually *first*. → the
   "everything on the same hierarchy level" complaint.
3. **A borrowed identity.** Purple-accent-on-black with glow and grain is the single most
   common AI-generated dashboard look of 2024–26. It has no relationship to this product.
   Nothing about it is *Kanakku's*. → the "generic, boring too easily" complaint.

## 1. Design thesis

**Kanakku means "the account" — so design the ledger, not another SaaS dashboard.**

The product's own world is the Indian account book: the bahi-khata with its red cloth
binding and hand-ruled red margin line, banker's-green ink, aged paper, columns of figures
that align to the paisa, the ₹ sign, and a Tamil name already sitting in the top-left
corner. Every distinctive choice below is drawn from that world:

- **Ink**: green-black surfaces (banker's ink, not blue-violet techno-black).
- **Paper**: warm off-white foregrounds (aged ledger paper, not clinical `#fff`).
- **The red rule**: the ledger's red margin line becomes the system's structural signature
  — a short vertical rule that marks section headers, drawer titles, and table headers.
  It is *structure*, muted and calm; it is not the error color.
- **Marigold**: the single interactive accent (buttons, focus, active nav, links). Warm,
  Indian, and — deliberately — **not purple**. Purple is removed entirely; that is the
  one irreversible aesthetic risk this system takes, and it is the point.
- **Money is always mono.** Every amount, date, and tabular figure in the app is set in
  the numeric face with tabular figures and an explicit sign. At hero sizes this becomes
  the app's typographic signature.

Delete list (do these first — they are the "AI-slop tells"): the `kk-ambient` glow
divs and `kk-grain` overlay (`AppLayout.tsx:19-24`), the `--kk-shadow-accent` purple
glow, and every purple value.

---

## 2. Tokens — drop-in replacement for `theme.css`

Keep the `--kk-` prefix and the existing token *architecture* (theme.css → index.css
`@theme inline` maps) so the migration is a value swap plus a handful of new tokens.

```css
:root {
  /* ── Surfaces (ink ladder — steps are DELIBERATELY far apart) ─────────
   * well  = inset areas: inputs, table bodies inside cards, code
   * 0     = page base
   * 1     = card / panel
   * 2     = raised: hover, popover, nav-active fill
   * 3     = highest: tooltip, toast, active input  */
  --kk-bg-well: #070908;
  --kk-bg-0:    #0C0F0D;
  --kk-bg-1:    #131715;
  --kk-bg-2:    #1B211D;
  --kk-bg-3:    #242C27;

  /* ── Rules & borders ──────────────────────────────────────────────────
   * hairline: card outlines, row dividers (VISIBLE — 2× the old alpha)
   * strong:   input outlines, emphasized dividers
   * red-rule: the ledger margin line. STRUCTURAL ONLY (see §5). */
  --kk-border:        rgba(239, 237, 227, 0.10);
  --kk-border-strong: rgba(239, 237, 227, 0.18);
  --kk-red-rule:      #8F3D36;

  /* ── Paper (text ladder) ──────────────────────────────────────────── */
  --kk-fg:       #EFEDE3;   /* primary — headings, amounts, table values */
  --kk-fg-dim:   #C8C6BA;   /* body copy */
  --kk-fg-muted: #98968A;   /* labels, metadata, placeholders (4.5:1 on bg-1) */
  --kk-fg-faint: #676659;   /* disabled ONLY — below AA, never for content */

  /* ── Marigold (the ONLY interactive accent) ──────────────────────── */
  --kk-accent:        #E8A33D;
  --kk-accent-bright: #F5B950;              /* hover */
  --kk-accent-ink:    #1C1305;              /* text ON marigold fills */
  --kk-accent-subtle: rgba(232, 163, 61, 0.13);

  /* ── Money semantics ─────────────────────────────────────────────── */
  --kk-credit:      #3BAF7E;   /* income/credit fills, bars, rings */
  --kk-credit-dim:  #56C795;   /* income/credit TEXT on dark */
  --kk-debit:       #C24E44;   /* expense/debit + destructive fills */
  --kk-debit-dim:   #E4685E;   /* expense/debit + error TEXT on dark */
  --kk-warning:     #D97E34;   /* caution fills (distinct from marigold by depth) */
  --kk-warning-dim: #E9975B;   /* caution text */
  --kk-transfer:    #5BB5C9;   /* transfer amounts & chart series */

  /* ── Typography (see §3; all self-hosted) ────────────────────────── */
  --kk-font-display: 'Cabinet Grotesk', var(--kk-font-sans);
  --kk-font-sans:    'Switzer', ui-sans-serif, system-ui, sans-serif;
  --kk-font-mono:    'IBM Plex Mono', ui-monospace, Menlo, monospace;
  --kk-font-tamil:   'Anek Tamil', var(--kk-font-sans);

  /* ── Radius (tightened — crisp, not soft) ────────────────────────── */
  --kk-radius-xs: 3px;    /* chips, inline badges */
  --kk-radius-sm: 5px;    /* buttons, inputs */
  --kk-radius-md: 8px;    /* cards, panels, popovers */
  --kk-radius-lg: 12px;   /* drawers, modals — the ceiling; nothing rounder */

  /* ── Elevation (borders + surface steps carry depth; shadows only
   *    for true overlays) ────────────────────────────────────────── */
  --kk-shadow-overlay: 0 16px 48px -12px rgba(0, 0, 0, 0.65);
  --kk-edge-highlight: inset 0 1px 0 rgba(239, 237, 227, 0.04);

  /* ── Layout ──────────────────────────────────────────────────────── */
  --kk-rail-bg:       #0A0C0B;   /* darker than page: nav recedes */
  --kk-topbar-bg:     #0A0C0B;
  --kk-content-pad-x: clamp(16px, 4vw, 32px);
  --kk-content-pad-y: 28px;
}
```

Contrast verification (must hold after any tweak): `fg` on `bg-1` ≈ 15:1; `fg-muted` on
`bg-1` ≥ 4.5:1; `accent` on `bg-1` ≥ 7:1; `accent-ink` on `accent` ≥ 8:1; `debit-dim` /
`credit-dim` on `bg-1` ≥ 5:1. `fg-faint` is exempt (disabled only).

---

## 3. Type system

Four faces, four jobs. All self-hosted via `@fontsource/*` npm packages (or Fontshare
downloads committed to `frontend/public/fonts`) — **no Google Fonts CDN request**; this is
a privacy-first self-hosted app and the current CDN `@import` leaks every page view.

| Role | Face | Weights | Used for |
|---|---|---|---|
| Display | **Cabinet Grotesk** (Fontshare) | 500 / 700 / 800 | Page titles, hero labels, empty-state headings, nav wordmarks |
| UI / body | **Switzer** (Fontshare) | 400 / 500 / 600 | Everything interactive: controls, table text, paragraphs, labels |
| Numeric | **IBM Plex Mono** | 400 / 500 / 600 | **Every amount, every date, every figure** — at all sizes, `font-variant-numeric: tabular-nums` always |
| Brand | **Anek Tamil** | 700 | The கணக்கு. logotype only (currently falls back to Inter's Tamil — replace) |

### Scale (the hierarchy fix — real jumps, few steps)

| Token | Size / line | Face + weight | Use |
|---|---|---|---|
| `display` | 44 / 48 | Plex Mono 500 | THE hero figure — one per page, max |
| `title` | 24 / 30 | Cabinet 700 | Page title |
| `heading` | 17 / 24 | Cabinet 700 | Card/section titles |
| `body` | 14.5 / 22 | Switzer 400–500 | Default text, table cells |
| `small` | 13 / 18 | Switzer 400 | Secondary metadata |
| `eyebrow` | 11 / 14 | Switzer 600, `letter-spacing: 0.08em`, uppercase | Section labels, table headers, stat labels |
| `amount` | 14.5 / 22 | Plex Mono 500 | Money in tables/rows |
| `amount-lg` | 20 / 26 | Plex Mono 600 | Money in stat tiles, drawer heroes |

Rules: never introduce sizes between these steps; hierarchy comes from *skipping* steps
(a stat tile is `eyebrow` + `amount-lg`, nothing in between). Money strings always carry
an explicit sign and currency: `−₹1,240.00`, `+₹500.00` (real minus U+2212, not hyphen).

---

## 4. Color usage law

1. **Marigold = "you can touch this."** Primary buttons, focus rings, active nav, links,
   selected states. Never used for data, charts (except as the first categorical), or
   decoration. If a screen has marigold on something non-interactive, it's wrong.
2. **Red rule = "this is structure."** Only as the §5 section marker, table-header
   double-rule, and drawer title rule. Never as text, never as a fill, never as feedback.
3. **Debit/credit color ONLY on money.** Amounts, deltas, progress fills. Body text never
   turns green/red. Type chips (`expense`/`income`) use the dim variants at 12 % alpha
   fills — the amount column already tells the story; don't shout twice.
4. **Warning is orange, errors are the debit family.** Destructive buttons = `--kk-debit`
   fill; error text = `--kk-debit-dim`. (In a ledger, red already means "you owe" —
   reusing the family for danger is coherent; the *structural* red-rule stays calm
   because it's darker, thinner, and never appears with feedback semantics.)
5. **Everything else is ink and paper.** If in doubt, use no color.

## 5. Hierarchy system (the "everything looks the same" fix)

**5.1 The surface ladder is semantic.** Page `bg-0` → cards `bg-1` → hover/popover `bg-2`
→ tooltip/toast `bg-3`; **inputs and table bodies inside cards sit in `bg-well`** (darker
than their parent — inset, tactile, instantly distinguishable from read-only surfaces).
Never put `bg-1` on `bg-1`.

**5.2 One hero per page.** Every page declares exactly one `display`-scale figure — the
answer to that page's question — with an `eyebrow` label above it:

- Dashboard → *Spent this period* (see 08-dashboard §A hero strip)
- Transactions → the period's net (`+₹X` / `−₹X`)
- Splits → *Owed to you*
- Budgets → *Left to spend this cycle* · Goals → total saved · Account detail → balance

Everything else on the page renders ≥ 2 scale steps below. This single rule kills the
flat-hierarchy feel.

**5.3 The section marker (the signature).** Every section header is:

```
▌ EYEBROW LABEL                                    View all →
```

— a 3px × 14px `--kk-red-rule` vertical bar, 8px gap, `eyebrow`-style label. Section
*content* gets no border unless it's a card. Drawer titles get the same bar horizontal:
a 24px-wide 2px red rule *under* the title. This is the mark that makes a screen
recognizably Kanakku; use it consistently and nowhere else.

**5.4 Density modes.** Tables and lists are compact (40px rows); narrative surfaces
(settings, forms, empty states) are airy (1.5× spacing). Don't mix within one card.

---

## 6. Component specs

**Buttons** — height 34px (28px compact), radius `sm`, Switzer 600 @ 13px:
- *Primary*: marigold fill, `--kk-accent-ink` text; hover `--kk-accent-bright`; pressed
  translate-y 0.5px. No glow shadows.
- *Secondary*: transparent, `--kk-border-strong` border, `fg` text; hover `bg-2`.
- *Ghost*: text-only `fg-muted` → `fg` on hover; for row-level actions.
- *Destructive*: `--kk-debit` fill, paper text. Confirm-dialogs' confirm button while
  pending: 60 % opacity + spinner (this is June H7's fix, specced).
- *Focus (all)*: 2px marigold ring, 2px offset. Visible on every interactive element —
  keyboard parity is part of the system, not an afterthought.

**Inputs** — `bg-well` fill, `--kk-border-strong` 1px, radius `sm`, height 36px, Switzer
400 @ 14.5px, placeholder `fg-muted`; focus = marigold ring (no border-color change
needed); error = `--kk-debit` border + 13px `debit-dim` message below. Labels are
`eyebrow` style above the field. Amount inputs: Plex Mono, right-aligned, `₹` prefix
inside the field as `fg-muted`.

**Cards / panels** — `bg-1`, hairline border, radius `md`, `--kk-edge-highlight`, no
shadow at rest, padding 20px. Interactive cards (split rows, account tiles): hover →
`bg-2` + `border-strong`; the *whole card* is the target. Stat tile = `eyebrow` label,
`amount-lg` (or `display` for the hero) value, one `small` context line — never more.

**Tables (the ledger — spend the craft here)** — header row: `eyebrow` style, closed by
the **double rule**: 1px `--kk-border-strong` with a 1px `--kk-red-rule` line 2px below
(the classic ledger head-rule). Body on `bg-well`, 40px rows, hairline separators, no
zebra. Amount column right-aligned Plex Mono with sign+color. Row hover `bg-2`; row is
keyboard-focusable (`tabIndex=0`, Enter opens the drawer — fixes the current
mouse-only rows). Footer totals row: `border-strong` top rule, Plex Mono 600.

**Navigation** — rail on `--kk-rail-bg` (darker than page: chrome recedes, content
advances). Item: 13px Switzer 500, `fg-muted`; hover `fg` + `bg-2`. **Active: 3px
marigold left notch + `fg` text + `bg-2` fill** (marigold notch = interactive-where-you-are;
distinct from the red structural rule). Group the items with `eyebrow` group labels
(Money / Planning / Data — per 02-ux §1) and pin Settings + logout to the bottom.
Logotype: Anek Tamil 700, paper color, the final `.` in marigold — the wordmark is the
only place besides buttons where marigold may appear as pure branding.

**Drawers** — `bg-1`, `shadow-overlay`, radius `lg` on the leading edge only, title =
`heading` + red under-rule (§5.3), 60 % black scrim. Hero amount at top where applicable
(`amount-lg`/`display`).

**Chips / badges** — radius `xs`, 11px Switzer 600 uppercase, 12 %-alpha semantic fill +
dim-variant text (e.g. `settled` = credit-subtle/credit-dim). One shape everywhere.

**Toasts** — `bg-3`, hairline border, 3px left rule in the variant color, `shadow-overlay`,
bottom-right. Error toasts show the backend `detail` (pairs with 06-production-grade §2).

**Empty states** — Cabinet 700 heading, one `body` line, one primary action. Behind the
text, an oversized (120px) glyph of the section's icon at 5 % paper opacity — quiet
texture, not decoration; no illustrations, no emoji.

**Charts** (extends the `dataviz` conventions already in the repo's orbit):
- Income = `--kk-credit`, expense = **paper at 55 % opacity** (not red — a wall of red
  reads as failure; red is reserved for over-budget/negative *states*), transfer =
  `--kk-transfer`, over-budget/negative = `--kk-debit`.
- Categorical series order: marigold → credit-green → transfer-teal → brick →
  `#B8A97A` ochre → `#C98A9B` rose → `#7FA3C4` slate-blue → `#8F8F7C` moss. Never more
  than 8; aggregate the tail into "Other" (paper 35 %).
- Grid: hairline `--kk-border` horizontal only; axis text 11px Plex Mono `fg-muted`;
  tooltips on `bg-3`. No gradients, no glow, no rounded bar caps above 2px.

## 7. Motion

Purposeful, sparse, fast: 120ms ease-out for hover/press, 200ms cubic-bezier(.32,.72,.35,1)
for drawer slide + scrim fade, NumberFlow ticks kept for hero/stat amounts (300ms), toast
slide-in 160ms. **No** ambient/looping animation of any kind. All motion inside
`@media (prefers-reduced-motion: no-preference)`; reduced-motion gets instant states.
One orchestrated moment is allowed and encouraged: on dashboard load, the hero figure
ticks up while the three sub-stats fade in staggered 40ms apart — that's the whole show.

## 8. Anti-slop guardrails (enforceable don'ts)

1. No purple anywhere. No gradients on text or fills. No glassmorphism/backdrop-blur.
2. No glow shadows; shadows only on true overlays (drawer, popover, toast, modal).
3. No ambient background blobs, grain, noise, or animated meshes (delete existing).
4. No radius above 12px except pill chips; no `rounded-full` buttons.
5. No emoji as icons (replace `⚙`, `✓`, `⏳` in Transactions/Imports with lucide icons).
6. No color on non-money text except marigold-on-interactive.
7. No new font sizes outside §3's scale; no `font-bold` on body text (600 max).
8. Every interactive element has a visible focus state; every icon-button an `aria-label`.
9. Numbers never render in Switzer/Cabinet — mono or it's a bug.
10. If a screen has two `display`-scale elements, one of them is wrong (§5.2).

## 9. Migration map (mechanical, for the implementing LLM)

1. **Swap `theme.css`** for §2's block (same file path; keep the header comment style).
2. **Fonts**: add `@fontsource-variable/...` or committed WOFF2 for Cabinet Grotesk,
   Switzer, IBM Plex Mono, Anek Tamil; delete the Google Fonts CDN import in
   `styles/base.css`; update `--kk-font-*` and add `--kk-font-display` / `--kk-font-tamil`
   to the `@theme inline` map in `index.css` (`font-display`, `font-tamil` utilities).
3. **Delete** the `kk-ambient`/`kk-grain` markup in `AppLayout.tsx` and their CSS; delete
   `--kk-shadow-accent` and all uses (`shadow-accent` in `MobileNav.tsx` FAB etc.).
4. **Update the legacy-palette remap block** in `index.css` (gray/indigo/red/green →
   token aliases): point `indigo-*`/`violet-*`/`purple-*` at marigold tokens, `red-600` at
   `--kk-debit`, `green-600` at `--kk-credit`, grays at the new ink/paper ladder. This
   keeps all 31 unmigrated files coherent on day one; then migrate them file-by-file to
   real tokens and delete the remap block last (06-production-grade §5).
5. **Component classes** (`index.css` component layer): restyle `.kk-card`, `.kk-panel`,
   `.kk-input` (→ `bg-well` inset), `.kk-btn-*`, `.kk-chip*`, `.kk-bar*`, `.kk-seg*`,
   `.kk-label` (→ eyebrow spec) per §6. Add new: `.kk-section-rule` (§5.3 marker),
   `.kk-table` (ledger table incl. double head-rule), `.kk-hero` (eyebrow+display pair).
6. **Charts**: update `CashFlowChart` and `WidgetRenderer` palettes to §6-charts.
7. **Verify**: axe/contrast pass on Dashboard, Transactions, a drawer, and a form;
   keyboard walk of one full journey; `prefers-reduced-motion` spot-check; screenshot
   before/after of Dashboard + Transactions for the owner's sign-off.

Order of pages for the visual migration (highest daily exposure first): Dashboard →
Transactions → Splits/drawers → forms → Imports → Budgets/Goals → Settings/Reports.

## 10. Appendix — "Day Ledger" light theme (optional, later)

The token architecture makes light mode a second values file. Anchor values, pre-checked
for contrast: page `#F3F1E8` (ledger paper), card `#FBFAF4`, well `#EBE8DC`, ink text
`#1D1F1C`, muted `#5B5D55`, border `rgba(29,31,28,0.12)`, marigold → `#A66A14`
(darkened for 4.5:1 on paper), credit `#1E7A54`, debit `#A93B31`, red-rule `#B0483F`.
Same type, same rules; the red margin rule looks *most* at home here. Ship dark first;
add this only when asked.

## 11. OPEN items for the owner

1. Marigold as the accent replaces the purple brand entirely — confirm you're ready to
   let the purple go (the PWA `theme_color #863bff`, icons, and manifest need the same
   swap: suggested `#E8A33D` on `#0C0F0D`).
2. Cabinet Grotesk + Switzer are Fontshare (ITF) faces, free license, self-hostable —
   approve, or name substitutes (nearest Google-only fallbacks: Bricolage Grotesque +
   Instrument Sans).
3. §6-charts makes expense bars paper-neutral instead of red — confirm you prefer calm
   ledgers over red-alert charts (my recommendation, but it's a taste call).
