export interface Crumb {
  label: string
  href?: string  // undefined = current page (not a link)
}

// Segment labels for the first path level
const ROOT_LABELS: Record<string, string> = {
  transactions:     'Transactions',
  accounts:         'Accounts',
  budgets:          'Budgets',
  subscriptions:    'Subscriptions',
  'piggy-banks':    'Savings Goals',
  imports:          'Import',
  settings:         'Settings',
  reports:          'Reports',
  gpay:             'GPay',
  splits:           'Splits',
  payees:           'Payees',
  categories:       'Categories',
  tags:             'Tags',
  'recently-deleted': 'Recently Deleted',
}

// Known static sub-paths → label for the leaf crumb
// Key = full pathname, value = leaf label
const STATIC_LEAF: Record<string, string> = {
  '/transactions/new':         'New Transaction',
  '/budgets/new':              'New Budget',
  '/subscriptions/new':        'New Subscription',
  '/piggy-banks/new':          'New Goal',
  '/imports/upload':           'Upload',
  '/settings/llm-activity':    'LLM Activity',
  '/settings/export':          'Export Data',
  '/settings/import':          'Import Data',
  '/gpay/import':              'Import',
  '/gpay/resolve':             'Resolve',
  '/gpay/orphans':             'Orphans',
}

// UUID-ish pattern — any segment that looks like an ID
const UUID_RE = /^[0-9a-f-]{8,}$/i

function isId(seg: string) {
  return UUID_RE.test(seg)
}

export function buildBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === '/') return []

  // Static full-path match first
  if (STATIC_LEAF[pathname]) {
    const segments = pathname.split('/').filter(Boolean)
    const root = segments[0]
    const rootLabel = ROOT_LABELS[root]
    if (rootLabel) {
      return [
        { label: rootLabel, href: `/${root}` },
        { label: STATIC_LEAF[pathname] },
      ]
    }
  }

  const segments = pathname.split('/').filter(Boolean)

  // Single-segment paths — just the label, no parent
  if (segments.length === 1) {
    return [{ label: ROOT_LABELS[segments[0]] ?? segments[0] }]
  }

  const [root, ...rest] = segments
  const rootLabel = ROOT_LABELS[root] ?? root
  const rootHref  = `/${root}`

  // Two segments: /root/:id  or  /root/new  (already handled above)
  if (rest.length === 1) {
    const seg = rest[0]
    if (isId(seg)) {
      return [
        { label: rootLabel, href: rootHref },
        { label: 'Details' },
      ]
    }
    // static sub-page not in STATIC_LEAF (fallback)
    return [
      { label: rootLabel, href: rootHref },
      { label: capitalise(seg) },
    ]
  }

  // Three segments: /root/:id/edit  or  /root/:id/sub-page
  if (rest.length === 2) {
    const [id, action] = rest
    if (isId(id)) {
      const actionLabel = action === 'edit' ? 'Edit' : capitalise(action)
      return [
        { label: rootLabel, href: rootHref },
        { label: 'Details', href: `/${root}/${id}` },
        { label: actionLabel },
      ]
    }
    // e.g. /settings/llm-activity (caught by STATIC_LEAF above, fallback here)
    return [
      { label: rootLabel, href: rootHref },
      { label: capitalise(id) },
      { label: capitalise(action) },
    ]
  }

  // Fallback: just show root
  return [{ label: rootLabel, href: rootHref }]
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}
