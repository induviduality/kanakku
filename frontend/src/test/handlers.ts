import { http, HttpResponse } from 'msw'

const TOKEN_RESPONSE = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
}

export const SETTINGS_RESPONSE = {
  primary_currency: 'INR',
  timezone: 'Asia/Kolkata',
  date_format: 'DD/MM/YYYY',
  number_format: 'en-IN',
  updated_at: '2026-01-01T00:00:00Z',
}

export const ACCOUNTS_RESPONSE = [
  {
    id: 'acc-1',
    user_id: 'user-1',
    name: 'HDFC Savings',
    type: 'bank',
    opening_balance: '10000.00',
    current_balance: '12000.00',
    currency: 'INR',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
]

export const PAYMENT_METHODS_RESPONSE = [
  {
    id: 'pm-1',
    account_id: 'acc-1',
    name: 'HDFC Visa',
    type: 'debit_card',
    upi_app: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
]

export const PAYEES_RESPONSE = [
  {
    id: 'payee-1',
    user_id: 'user-1',
    name: 'Swiggy',
    type: 'merchant',
    notes: null,
    is_active: true,
    default_category_ids: ['cat-1'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
]

export const CATEGORIES_RESPONSE = [
  {
    id: 'cat-1',
    user_id: 'user-1',
    name: 'Food & Dining',
    icon: '🍽️',
    color: '#FF6B6B',
    applicability: 'expense',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
]

export const TRANSACTIONS_RESPONSE = {
  items: [
    {
      id: 'txn-1',
      user_id: 'user-1',
      type: 'expense',
      transacted_at: '2026-01-15T10:00:00Z',
      amount: '500.00',
      currency: 'INR',
      description: 'Coffee',
      notes: null,
      account_id: 'acc-1',
      payment_method_id: null,
      payee_id: 'payee-1',
      to_account_id: null,
      to_amount: null,
      to_currency: null,
      subscription_id: null,
      import_record_id: null,
      category_ids: ['cat-1'],
      tag_ids: ['tag-1'],
      budget_ids: [],
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
      deleted_at: null,
    },
  ],
  next_cursor: null,
}

export const SPLIT_RESPONSE = {
  id: 'split-1',
  user_id: 'user-1',
  expense_transaction_id: 'txn-1',
  notes: 'dinner split',
  shares: [
    {
      id: 'share-1',
      split_id: 'split-1',
      payee_id: null,
      amount: '300.00',
      status: 'pending',
      settled_at: null,
      settlement_transaction_id: null,
      forgiven_at: null,
      notes: null,
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
    },
    {
      id: 'share-2',
      split_id: 'split-1',
      payee_id: 'payee-1',
      amount: '200.00',
      status: 'pending',
      settled_at: null,
      settlement_transaction_id: null,
      forgiven_at: null,
      notes: null,
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
    },
  ],
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  deleted_at: null,
}

export const BUDGETS_RESPONSE: object[] = [
  {
    id: 'budget-1',
    user_id: 'user-1',
    name: 'Monthly Groceries',
    amount: '5000.00',
    currency: 'INR',
    period: 'monthly',
    start_date: '2026-01-01',
    end_date: null,
    type: 'recurring',
    recurrence_rule: 'FREQ=MONTHLY;BYMONTHDAY=1',
    parent_budget_id: null,
    is_modified_instance: false,
    is_active: true,
    notes: null,
    category_ids: ['cat-1'],
    current_spent: '500.00',
    activated_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
  {
    id: 'budget-2',
    user_id: 'user-1',
    name: 'Transport',
    amount: '3000.00',
    currency: 'INR',
    period: null,
    start_date: '2026-01-01',
    end_date: null,
    type: 'recurring',
    recurrence_rule: 'FREQ=DAILY;INTERVAL=14',
    parent_budget_id: null,
    is_modified_instance: false,
    is_active: true,
    notes: null,
    category_ids: [],
    current_spent: '1200.00',
    activated_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
]

export const SUBSCRIPTIONS_RESPONSE = [
  {
    id: 'sub-1',
    user_id: 'user-1',
    name: 'Netflix',
    amount: '649.00',
    currency: 'INR',
    billing_cycle: 'monthly',
    billing_day: 15,
    last_billed_at: '2026-04-15T00:00:00Z',
    account_id: 'acc-1',
    payment_method_id: null,
    category_id: null,
    is_active: true,
    url: null,
    notes: null,
    next_billing_date: '2026-05-15',
    status: 'upcoming',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
  {
    id: 'sub-2',
    user_id: 'user-1',
    name: 'Spotify',
    amount: '199.00',
    currency: 'INR',
    billing_cycle: 'monthly',
    billing_day: 1,
    last_billed_at: '2026-03-01T00:00:00Z',
    account_id: 'acc-1',
    payment_method_id: null,
    category_id: null,
    is_active: true,
    url: null,
    notes: null,
    next_billing_date: '2026-04-01',
    status: 'overdue',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
]

export const PIGGY_BANKS_RESPONSE = [
  {
    id: 'pig-1',
    user_id: 'user-1',
    name: 'Europe Trip',
    target_amount: '200000.00',
    currency: 'INR',
    current_amount: '60000.00',
    target_date: '2027-06-01',
    notes: null,
    is_completed: false,
    progress_pct: 30,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
]

export const CONTRIBUTIONS_RESPONSE = [
  {
    id: 'contrib-1',
    piggy_bank_id: 'pig-1',
    transaction_id: 'txn-1',
    contribution_type: 'expense',
    amount: '60000.00',
    date: '2026-04-01',
    notes: null,
    created_at: '2026-04-01T00:00:00Z',
  },
]

export const BUDGET_TRANSACTIONS_RESPONSE = {
  items: [
    {
      id: 'txn-1',
      type: 'expense',
      transacted_at: '2026-01-15T10:00:00Z',
      amount: '500.00',
      currency: 'INR',
      description: 'Groceries run',
      account_id: 'acc-1',
      payee_id: null,
      category_ids: ['cat-1'],
      link_type: 'explicit',
    },
  ],
  total_spent: '500.00',
}

export const TAGS_RESPONSE = [
  {
    id: 'tag-1',
    user_id: 'user-1',
    name: 'weekend',
    color: '#FF0000',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
]

export const IMPORT_BATCHES_RESPONSE = [
  {
    id: 'batch-1',
    user_id: 'user-1',
    source: 'pdf',
    filename: 'hdfc_jan_2026.pdf',
    account_id: 'acc-1',
    status: 'completed',
    verification_status: 'verified',
    total_parsed: 10,
    total_confirmed: 8,
    total_rejected: 2,
    imported_at: '2026-01-15T10:00:00Z',
    completed_at: '2026-01-15T10:05:00Z',
  },
]

export const IMPORT_RECORDS_RESPONSE = [
  {
    id: 'rec-1',
    batch_id: 'batch-1',
    raw_text: '15/01/26 SWIGGY 350.00',
    parsed_json: {
      date: '2026-01-15',
      description: 'SWIGGY',
      amount: '350.00',
      type: 'expense',
    },
    status: 'pending',
    transaction_id: null,
    confidence: 'high',
    match_type: 'new',
    created_at: '2026-01-15T10:00:00Z',
  },
]

export const GPAY_MATCHES_RESPONSE: Array<{
  id: string
  user_id: string
  gpay_data: Record<string, unknown>
  candidate_transaction_ids: string[]
  chosen_transaction_id: string | null
  llm_suggestion_id: string | null
  status: string
  created_at: string
}> = [
  {
    id: 'gm-1',
    user_id: 'user-1',
    gpay_data: { Date: '2024-01-15', Amount: '420.00', Description: 'Zomato' },
    candidate_transaction_ids: ['txn-1', 'txn-2'],
    chosen_transaction_id: null,
    llm_suggestion_id: null,
    status: 'pending',
    created_at: '2026-01-15T10:00:00Z',
  },
]

export const GPAY_ORPHANS_RESPONSE = [
  {
    id: 'gm-2',
    user_id: 'user-1',
    gpay_data: { Date: '2024-02-01', Amount: '999.00', Description: 'Mystery shop' },
    candidate_transaction_ids: [],
    chosen_transaction_id: null,
    llm_suggestion_id: null,
    status: 'orphan',
    created_at: '2026-02-01T09:00:00Z',
  },
]

export const GPAY_UPLOAD_RESPONSE = {
  parsed: 2,
  auto_linked: 1,
  pending: 1,
  orphans: 0,
  matches: GPAY_MATCHES_RESPONSE,
}

export const LLM_ACTIVITY_RESPONSE: Array<{
  id: string
  user_id: string
  operation: string
  payload_summary: Record<string, unknown>
  backend: string
  model: string
  duration_ms: number
  succeeded: boolean
  created_at: string
}> = [
  {
    id: 'llm-1',
    user_id: 'user-1',
    operation: 'suggest_category',
    payload_summary: { payee: 'Zomato', description_length: 10, category_count: 5 },
    backend: 'ollama',
    model: 'qwen2.5:1.5b',
    duration_ms: 420,
    succeeded: true,
    created_at: '2026-05-01T10:00:00Z',
  },
  {
    id: 'llm-2',
    user_id: 'user-1',
    operation: 'match_gpay_to_bank',
    payload_summary: { gpay_count: 3, candidate_count: 5 },
    backend: 'ollama',
    model: 'qwen2.5:1.5b',
    duration_ms: 800,
    succeeded: false,
    created_at: '2026-05-02T11:00:00Z',
  },
]

// Monthly closing balances Jan–May 2026, 4 accounts.
// date = bucket start (first of month, matching date_trunc('month',...)).
const CASHFLOW_MONTHLY = [
  // Jan 2026
  { date: '2026-01-01', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '100000.00', net: '50000.00'   },
  { date: '2026-01-01', account_id: 'acc-2', account_name: 'ICICI Savings',    balance: '21000.00',  net: '-4000.00'   },
  { date: '2026-01-01', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4650.00',   net: '-350.00'    },
  { date: '2026-01-01', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-1298.00',  net: '-1298.00'   },
  // Feb 2026
  { date: '2026-02-01', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '175000.00', net: '75000.00'   },
  { date: '2026-02-01', account_id: 'acc-2', account_name: 'ICICI Savings',    balance: '19200.00',  net: '-1800.00'   },
  { date: '2026-02-01', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4370.00',   net: '-280.00'    },
  { date: '2026-02-01', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-1947.00',  net: '-649.00'    },
  // Mar 2026 — phone purchase dips HDFC
  { date: '2026-03-01', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '130000.00', net: '-45000.00'  },
  { date: '2026-03-01', account_id: 'acc-2', account_name: 'ICICI Savings',    balance: '17100.00',  net: '-2100.00'   },
  { date: '2026-03-01', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4370.00',   net: '0.00'       },
  { date: '2026-03-01', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-2596.00',  net: '-649.00'    },
  // Apr 2026
  { date: '2026-04-01', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '205000.00', net: '75000.00'   },
  { date: '2026-04-01', account_id: 'acc-2', account_name: 'ICICI Savings',    balance: '21500.00',  net: '4400.00'    },
  { date: '2026-04-01', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4370.00',   net: '0.00'       },
  { date: '2026-04-01', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-4563.00',  net: '-1967.00'   },
  // May 2026 — credit card bill settled, HDFC balance drops
  { date: '2026-05-01', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '87430.00',  net: '-117570.00' },
  { date: '2026-05-01', account_id: 'acc-2', account_name: 'ICICI Savings',    balance: '23500.00',  net: '2000.00'    },
  { date: '2026-05-01', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '850.00',    net: '-3520.00'   },
  { date: '2026-05-01', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-12400.00', net: '-7837.00'   },
]

// Daily data for May 2026 (3 accounts active; ICICI had no May transactions).
// Every active account gets a row for every date that appears so lines stay continuous.
const CASHFLOW_MAY_DAILY = [
  // HDFC Savings
  { date: '2026-05-01', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '290000.00', net: '85000.00'  },
  { date: '2026-05-02', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '289240.00', net: '-760.00'   },
  { date: '2026-05-03', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '289240.00', net: '0.00'      },
  { date: '2026-05-05', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '286740.00', net: '-2500.00'  },
  { date: '2026-05-08', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '286490.00', net: '-250.00'   },
  { date: '2026-05-10', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '285950.00', net: '-540.00'   },
  { date: '2026-05-12', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '285270.00', net: '-680.00'   },
  { date: '2026-05-15', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '282870.00', net: '-2400.00'  },
  { date: '2026-05-18', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '282560.00', net: '-310.00'   },
  { date: '2026-05-20', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '282380.00', net: '-180.00'   },
  { date: '2026-05-22', account_id: 'acc-1', account_name: 'HDFC Savings',     balance: '267380.00', net: '-15000.00' },
  // HDFC Credit Card (salary payment on 22nd restores it to positive)
  { date: '2026-05-01', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-4563.00',  net: '0.00'      },
  { date: '2026-05-02', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-4563.00',  net: '0.00'      },
  { date: '2026-05-03', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-6462.00',  net: '-1899.00'  },
  { date: '2026-05-05', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-6462.00',  net: '0.00'      },
  { date: '2026-05-08', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-6462.00',  net: '0.00'      },
  { date: '2026-05-10', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-7111.00',  net: '-649.00'   },
  { date: '2026-05-12', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-7111.00',  net: '0.00'      },
  { date: '2026-05-15', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-9511.00',  net: '-2400.00'  },
  { date: '2026-05-18', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-9511.00',  net: '0.00'      },
  { date: '2026-05-20', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '-9511.00',  net: '0.00'      },
  { date: '2026-05-22', account_id: 'acc-4', account_name: 'HDFC Credit Card', balance: '5489.00',   net: '15000.00'  },
  // Wallet (Cash) — one transaction on 18th, carried forward
  { date: '2026-05-01', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4370.00',   net: '0.00'      },
  { date: '2026-05-02', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4370.00',   net: '0.00'      },
  { date: '2026-05-03', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4370.00',   net: '0.00'      },
  { date: '2026-05-05', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4370.00',   net: '0.00'      },
  { date: '2026-05-08', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4370.00',   net: '0.00'      },
  { date: '2026-05-10', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4370.00',   net: '0.00'      },
  { date: '2026-05-12', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4370.00',   net: '0.00'      },
  { date: '2026-05-15', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4370.00',   net: '0.00'      },
  { date: '2026-05-18', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4060.00',   net: '-310.00'   },
  { date: '2026-05-20', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4060.00',   net: '0.00'      },
  { date: '2026-05-22', account_id: 'acc-3', account_name: 'Wallet (Cash)',     balance: '4060.00',   net: '0.00'      },
]

function buildCashflowByAccount(startDate: string, endDate: string) {
  const days = (new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) / 86_400_000
  if (days > 31) {
    // Monthly buckets — filter to requested range
    return CASHFLOW_MONTHLY.filter(b => b.date >= startDate && b.date <= endDate)
  }
  // Daily view for May 2026
  if (startDate.startsWith('2026-05')) return CASHFLOW_MAY_DAILY
  // Generic stub for any other month: 3 data points spread across the month
  const monthPrefix = startDate.slice(0, 7)
  const base = CASHFLOW_MONTHLY.filter(b => b.date.startsWith(monthPrefix))
  if (base.length === 0) return []
  return [
    ...base,
    ...base.map(b => ({ ...b, date: monthPrefix + '-15', net: '0.00' })),
    ...base.map(b => ({ ...b, date: endDate,             net: '0.00' })),
  ]
}

export const DASHBOARD_RESPONSE = {
  month: '2026-05',
  total_spent_net: '1410.00',
  total_income: '85000.00',
  period: 'month',
  period_start: '2026-05-01',
  period_end: '2026-05-31',
  total_balance: '87430.00',
  inflow: '85000.00',
  outflow: '1410.00',
  savings_rate: 98.3,
  prev_inflow: '80000.00',
  prev_outflow: '2100.00',
  prev_savings_rate: 97.4,
  budgets_summary: [
    {
      id: 'budget-1',
      name: 'Food Budget',
      amount: '5000.00',
      currency: 'INR',
      spent: '1410.00',
      percentage: 28.2,
      status: 'on_track',
    },
  ],
  category_breakdown: [
    { category_id: 'cat-1', name: 'Food & Dining', amount: '1410.00', percentage: 100.0 },
  ],
  recent_transactions: [
    // Jan
    { id: 'txn-1',  type: 'expense',  transacted_at: '2026-01-08T09:15:00Z', amount: '320.00',   currency: 'INR', description: 'Grocery run',        account_id: 'acc-1', payee_id: 'payee-1', category_ids: ['cat-1'] },
    { id: 'txn-2',  type: 'income',   transacted_at: '2026-01-31T18:00:00Z', amount: '85000.00', currency: 'INR', description: 'January salary',     account_id: 'acc-1', payee_id: null,      category_ids: [] },
    // Feb
    { id: 'txn-3',  type: 'expense',  transacted_at: '2026-02-14T20:30:00Z', amount: '2200.00',  currency: 'INR', description: "Valentine's dinner",  account_id: 'acc-1', payee_id: 'payee-2', category_ids: ['cat-1'] },
    { id: 'txn-4',  type: 'income',   transacted_at: '2026-02-28T18:00:00Z', amount: '85000.00', currency: 'INR', description: 'February salary',    account_id: 'acc-1', payee_id: null,      category_ids: [] },
    // Mar
    { id: 'txn-5',  type: 'expense',  transacted_at: '2026-03-05T11:00:00Z', amount: '1450.00',  currency: 'INR', description: 'Electricity bill',   account_id: 'acc-1', payee_id: 'payee-3', category_ids: ['cat-2'] },
    { id: 'txn-6',  type: 'transfer', transacted_at: '2026-03-15T10:00:00Z', amount: '10000.00', currency: 'INR', description: 'Savings transfer',   account_id: 'acc-1', payee_id: null,      category_ids: [] },
    { id: 'txn-7',  type: 'income',   transacted_at: '2026-03-31T18:00:00Z', amount: '85000.00', currency: 'INR', description: 'March salary',       account_id: 'acc-1', payee_id: null,      category_ids: [] },
    // Apr
    { id: 'txn-8',  type: 'expense',  transacted_at: '2026-04-03T14:00:00Z', amount: '580.00',   currency: 'INR', description: 'Swiggy order',       account_id: 'acc-1', payee_id: 'payee-1', category_ids: ['cat-1'] },
    { id: 'txn-9',  type: 'expense',  transacted_at: '2026-04-20T16:45:00Z', amount: '3200.00',  currency: 'INR', description: 'Phone repair',       account_id: 'acc-1', payee_id: 'payee-4', category_ids: ['cat-3'] },
    { id: 'txn-10', type: 'income',   transacted_at: '2026-04-30T18:00:00Z', amount: '85000.00', currency: 'INR', description: 'April salary',       account_id: 'acc-1', payee_id: null,      category_ids: [] },
    // May
    { id: 'txn-11', type: 'expense',  transacted_at: '2026-05-02T08:30:00Z', amount: '760.00',   currency: 'INR', description: 'Zomato weekend',     account_id: 'acc-1', payee_id: 'payee-1', category_ids: ['cat-1'] },
    { id: 'txn-12', type: 'expense',  transacted_at: '2026-05-10T12:00:00Z', amount: '649.00',   currency: 'INR', description: 'Netflix',            account_id: 'acc-1', payee_id: 'payee-5', category_ids: ['cat-4'] },
    { id: 'txn-13', type: 'expense',  transacted_at: '2026-05-18T10:00:00Z', amount: '420.00',   currency: 'INR', description: 'Dinner order',       account_id: 'acc-1', payee_id: 'payee-1', category_ids: ['cat-1'] },
    { id: 'txn-14', type: 'income',   transacted_at: '2026-05-31T18:00:00Z', amount: '85000.00', currency: 'INR', description: 'May salary',         account_id: 'acc-1', payee_id: null,      category_ids: [] },
  ],
  pending_splits_summary: {
    count: 1,
    total_owed: '500.00',
    by_payee: [{ payee_id: 'payee-1', payee_name: 'Swiggy', total: '500.00' }],
  },
  piggy_banks_summary: [
    {
      id: 'pig-1',
      name: 'Europe Trip',
      target_amount: '200000.00',
      current_amount: '60000.00',
      currency: 'INR',
      progress_pct: 30,
      is_completed: false,
    },
  ],
  account_balances: [
    { id: 'acc-1', name: 'HDFC Savings',     type: 'bank',        currency: 'INR', current_balance: '87430.00'  },
    { id: 'acc-2', name: 'ICICI Savings',    type: 'bank',        currency: 'INR', current_balance: '23500.00'  },
    { id: 'acc-3', name: 'Wallet (Cash)',     type: 'cash',        currency: 'INR', current_balance: '850.00'    },
    { id: 'acc-4', name: 'HDFC Credit Card', type: 'credit_card', currency: 'INR', current_balance: '-12400.00' },
  ],
  active_subscriptions: [
    {
      id: 'sub-1',
      name: 'Netflix',
      amount: '649.00',
      currency: 'INR',
      status: 'upcoming',
      next_billing_date: '2026-06-15',
    },
  ],
  cashflow_buckets: [
    { date: '2026-05-01', income: '15000.00', expense: '8500.00' },
    { date: '2026-05-08', income: '0.00',     expense: '3200.00' },
    { date: '2026-05-15', income: '42000.00', expense: '12000.00' },
    { date: '2026-05-22', income: '0.00',     expense: '5400.00' },
  ],
  // Placeholder — handler always overrides this with buildCashflowByAccount()
  cashflow_by_account: [] as typeof CASHFLOW_MONTHLY,
}

export const handlers = [
  // Dashboard — reflect selected period in the response so the UI reacts to picker changes
  http.get('/api/v1/dashboard/home', ({ request }) => {
    const url = new URL(request.url)
    const startDate = url.searchParams.get('start_date') ?? DASHBOARD_RESPONSE.period_start
    const endDate   = url.searchParams.get('end_date')   ?? DASHBOARD_RESPONSE.period_end

    // Filter mock transactions to those within the requested window
    const filteredTxns = DASHBOARD_RESPONSE.recent_transactions
      .filter((t) => { const d = t.transacted_at.slice(0, 10); return d >= startDate && d <= endDate })
      .slice(-5)  // most recent 5 within the window

    return HttpResponse.json({
      ...DASHBOARD_RESPONSE,
      period_start: startDate,
      period_end: endDate,
      recent_transactions: filteredTxns,
      cashflow_by_account: buildCashflowByAccount(startDate, endDate),
    })
  }),

  http.post('/api/v1/auth/setup', () => HttpResponse.json(TOKEN_RESPONSE, { status: 201 })),
  http.post('/api/v1/auth/login', () => HttpResponse.json(TOKEN_RESPONSE)),
  http.post('/api/v1/auth/accept-invite', () => HttpResponse.json(TOKEN_RESPONSE, { status: 201 })),
  http.get('/api/v1/auth/invites/:token/info', ({ params }) => {
    if (params.token === 'expired-token') {
      return HttpResponse.json({ detail: 'Invite expired or already used' }, { status: 410 })
    }
    if (params.token === 'with-email-token') {
      return HttpResponse.json({ expires_at: '2030-01-01T00:00:00Z', email: 'preset@example.com' })
    }
    return HttpResponse.json({ expires_at: '2030-01-01T00:00:00Z', email: null })
  }),

  // Settings
  http.get('/api/v1/settings', () => HttpResponse.json(SETTINGS_RESPONSE)),
  http.patch('/api/v1/settings', async ({ request }) => {
    const body = await request.json() as Record<string, string>
    return HttpResponse.json({ ...SETTINGS_RESPONSE, ...body })
  }),

  // Accounts
  http.get('/api/v1/accounts', () => HttpResponse.json(ACCOUNTS_RESPONSE)),
  http.post('/api/v1/accounts', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...ACCOUNTS_RESPONSE[0], id: 'acc-new', name: body.name, type: body.type },
      { status: 201 },
    )
  }),
  http.delete('/api/v1/accounts/:id', () => new HttpResponse(null, { status: 204 })),
  http.patch('/api/v1/accounts/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...ACCOUNTS_RESPONSE[0], ...body })
  }),

  // Payment methods
  http.get('/api/v1/accounts/:accountId/payment-methods', () =>
    HttpResponse.json(PAYMENT_METHODS_RESPONSE),
  ),
  http.post('/api/v1/accounts/:accountId/payment-methods', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...PAYMENT_METHODS_RESPONSE[0], id: 'pm-new', name: body.name },
      { status: 201 },
    )
  }),
  http.delete('/api/v1/accounts/:accountId/payment-methods/:id', () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // Payees
  http.get('/api/v1/payees', () => HttpResponse.json(PAYEES_RESPONSE)),
  http.post('/api/v1/payees', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...PAYEES_RESPONSE[0], id: 'payee-new', name: body.name, type: body.type },
      { status: 201 },
    )
  }),
  http.delete('/api/v1/payees/:id', () => new HttpResponse(null, { status: 204 })),
  http.patch('/api/v1/payees/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...PAYEES_RESPONSE[0], ...body })
  }),

  // Categories
  http.get('/api/v1/categories', () => HttpResponse.json(CATEGORIES_RESPONSE)),
  http.post('/api/v1/categories', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...CATEGORIES_RESPONSE[0], id: 'cat-new', name: body.name },
      { status: 201 },
    )
  }),
  http.post('/api/v1/categories/seed-defaults', () =>
    HttpResponse.json(CATEGORIES_RESPONSE, { status: 201 }),
  ),
  http.delete('/api/v1/categories/:id', () => new HttpResponse(null, { status: 204 })),
  http.patch('/api/v1/categories/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...CATEGORIES_RESPONSE[0], ...body })
  }),

  // Transactions
  http.get('/api/v1/transactions', () => HttpResponse.json(TRANSACTIONS_RESPONSE)),
  http.post('/api/v1/transactions', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...TRANSACTIONS_RESPONSE.items[0], id: 'txn-new', type: body.type, amount: body.amount },
      { status: 201 },
    )
  }),
  http.patch('/api/v1/transactions/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...TRANSACTIONS_RESPONSE.items[0], ...body })
  }),
  http.delete('/api/v1/transactions/:id', () => new HttpResponse(null, { status: 204 })),

  // Splits
  http.get('/api/v1/splits', () =>
    HttpResponse.json([
      {
        ...SPLIT_RESPONSE,
        id: 'split-1',
        notes: 'Dinner split',
        created_at: '2026-05-10T10:00:00Z',
        updated_at: '2026-05-10T10:00:00Z',
        shares: [
          { ...SPLIT_RESPONSE.shares[0], id: 'share-1', split_id: 'split-1', created_at: '2026-05-10T10:00:00Z', updated_at: '2026-05-10T10:00:00Z' },
          { ...SPLIT_RESPONSE.shares[1], id: 'share-2', split_id: 'split-1', created_at: '2026-05-10T10:00:00Z', updated_at: '2026-05-10T10:00:00Z' },
        ],
      },
      {
        ...SPLIT_RESPONSE,
        id: 'split-2',
        notes: 'Lunch bill',
        created_at: '2026-05-15T12:00:00Z',
        updated_at: '2026-05-15T12:00:00Z',
        shares: [
          { ...SPLIT_RESPONSE.shares[0], id: 'share-3', split_id: 'split-2', status: 'settled', settled_at: '2026-05-20T10:00:00Z', created_at: '2026-05-15T12:00:00Z', updated_at: '2026-05-20T10:00:00Z' },
          { ...SPLIT_RESPONSE.shares[1], id: 'share-4', split_id: 'split-2', status: 'forgiven', forgiven_at: '2026-05-20T10:00:00Z', created_at: '2026-05-15T12:00:00Z', updated_at: '2026-05-20T10:00:00Z' },
        ],
      },
      {
        ...SPLIT_RESPONSE,
        id: 'split-3',
        notes: 'Old dinner',
        created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
      },
    ]),
  ),
  http.post('/api/v1/splits', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...SPLIT_RESPONSE, expense_transaction_id: body.expense_transaction_id },
      { status: 201 },
    )
  }),
  http.post('/api/v1/splits/bundle', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...SPLIT_RESPONSE, expense_transaction_id: body.expense_transaction_id },
      { status: 201 },
    )
  }),
  http.get('/api/v1/splits/:splitId', ({ params }) => {
    if (params.splitId === 'not-found') {
      return HttpResponse.json({ detail: 'Split not found' }, { status: 404 })
    }
    return HttpResponse.json({ ...SPLIT_RESPONSE, id: params.splitId })
  }),
  http.post('/api/v1/splits/:splitId/shares/:shareId/settle', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      ...SPLIT_RESPONSE.shares[0],
      id: params.shareId,
      split_id: params.splitId,
      status: 'settled',
      settled_at: '2026-01-16T10:00:00Z',
      settlement_transaction_id: body.settlement_transaction_id,
    })
  }),
  http.post('/api/v1/splits/:splitId/shares/:shareId/forgive', ({ params }) =>
    HttpResponse.json({
      ...SPLIT_RESPONSE.shares[0],
      id: params.shareId,
      split_id: params.splitId,
      status: 'forgiven',
      forgiven_at: '2026-01-16T10:00:00Z',
    }),
  ),
  http.post('/api/v1/splits/:splitId/shares/:shareId/unsettle', ({ params }) =>
    HttpResponse.json({
      ...SPLIT_RESPONSE.shares[0],
      id: params.shareId,
      split_id: params.splitId,
      status: 'pending',
      settled_at: null,
      settlement_transaction_id: null,
    }),
  ),

  // Budgets
  http.get('/api/v1/budgets', ({ request }) => {
    const url = new URL(request.url)
    const fromDate = url.searchParams.get('from_date')
    const toDate   = url.searchParams.get('to_date')
    // Filter by activated_at <= to_date when a period filter is applied
    let result = BUDGETS_RESPONSE as Array<Record<string, unknown>>
    if (toDate) result = result.filter(b => !b.activated_at || (b.activated_at as string) <= toDate + 'T23:59:59Z')
    if (fromDate) result = result.filter(b => !b.end_date || (b.end_date as string) >= fromDate)
    return HttpResponse.json(result)
  }),
  http.post('/api/v1/budgets', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...BUDGETS_RESPONSE[0], id: 'budget-new', name: body.name, type: body.type, activated_at: new Date().toISOString() },
      { status: 201 },
    )
  }),
  http.get('/api/v1/budgets/:budgetId', ({ params }) => {
    if (params.budgetId === 'not-found') {
      return HttpResponse.json({ detail: 'Budget not found' }, { status: 404 })
    }
    const found = (BUDGETS_RESPONSE as Array<Record<string, unknown>>).find(b => b.id === params.budgetId)
    return HttpResponse.json({ ...(found ?? BUDGETS_RESPONSE[0]), id: params.budgetId })
  }),
  http.patch('/api/v1/budgets/:budgetId', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...BUDGETS_RESPONSE[0], id: params.budgetId, ...body })
  }),
  http.delete('/api/v1/budgets/:budgetId', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/v1/budgets/:budgetId/transactions', () =>
    HttpResponse.json(BUDGET_TRANSACTIONS_RESPONSE),
  ),

  // Subscriptions
  http.get('/api/v1/subscriptions', () => HttpResponse.json(SUBSCRIPTIONS_RESPONSE)),
  http.post('/api/v1/subscriptions', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...SUBSCRIPTIONS_RESPONSE[0], id: 'sub-new', name: body.name },
      { status: 201 },
    )
  }),
  http.get('/api/v1/subscriptions/:subId', ({ params }) => {
    const sub = SUBSCRIPTIONS_RESPONSE.find((s) => s.id === params.subId)
    if (!sub) return HttpResponse.json({ detail: 'Subscription not found' }, { status: 404 })
    return HttpResponse.json(sub)
  }),
  http.patch('/api/v1/subscriptions/:subId', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...SUBSCRIPTIONS_RESPONSE[0], id: params.subId, ...body })
  }),
  http.delete('/api/v1/subscriptions/:subId', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/v1/subscriptions/:subId/link-transaction', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      ...TRANSACTIONS_RESPONSE.items[0],
      subscription_id: params.subId,
      id: body.transaction_id,
    })
  }),
  http.get('/api/v1/subscriptions/:subId/history', () =>
    HttpResponse.json(TRANSACTIONS_RESPONSE.items),
  ),

  // Piggy banks
  http.get('/api/v1/piggy-banks', () => HttpResponse.json(PIGGY_BANKS_RESPONSE)),
  http.post('/api/v1/piggy-banks', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      {
        ...PIGGY_BANKS_RESPONSE[0],
        id: 'pig-new',
        name: body.name,
        target_amount: body.target_amount,
      },
      { status: 201 },
    )
  }),
  http.get('/api/v1/piggy-banks/:piggyId', ({ params }) => {
    const pig = PIGGY_BANKS_RESPONSE.find((p) => p.id === params.piggyId)
    if (!pig) return HttpResponse.json({ detail: 'Piggy bank not found' }, { status: 404 })
    return HttpResponse.json(pig)
  }),
  http.patch('/api/v1/piggy-banks/:piggyId', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...PIGGY_BANKS_RESPONSE[0], id: params.piggyId, ...body })
  }),
  http.delete('/api/v1/piggy-banks/:piggyId', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/v1/piggy-banks/:piggyId/contributions', () =>
    HttpResponse.json(CONTRIBUTIONS_RESPONSE),
  ),
  http.post('/api/v1/piggy-banks/:piggyId/contributions', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      {
        ...CONTRIBUTIONS_RESPONSE[0],
        id: 'contrib-new',
        piggy_bank_id: params.piggyId,
        amount: body.amount,
      },
      { status: 201 },
    )
  }),
  http.delete('/api/v1/piggy-banks/:piggyId/contributions/:contribId', () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // Imports
  http.get('/api/v1/imports', () => HttpResponse.json(IMPORT_BATCHES_RESPONSE)),
  http.get('/api/v1/imports/:batchId', ({ params }) => {
    if (params.batchId === 'not-found') {
      return HttpResponse.json({ detail: 'Import batch not found' }, { status: 404 })
    }
    return HttpResponse.json({ ...IMPORT_BATCHES_RESPONSE[0], id: params.batchId })
  }),
  http.get('/api/v1/imports/:batchId/records', () => HttpResponse.json(IMPORT_RECORDS_RESPONSE)),
  http.patch('/api/v1/imports/:batchId/records/:recordId', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      ...IMPORT_RECORDS_RESPONSE[0],
      id: params.recordId,
      batch_id: params.batchId,
      ...body,
    })
  }),
  http.post('/api/v1/imports/:batchId/confirm', () =>
    HttpResponse.json({ ...IMPORT_BATCHES_RESPONSE[0], total_confirmed: 9 }),
  ),
  http.post('/api/v1/imports/:batchId/reject', () =>
    HttpResponse.json({ ...IMPORT_BATCHES_RESPONSE[0], total_rejected: 3 }),
  ),

  // GPay
  http.post('/api/v1/imports/gpay-takeout', () => HttpResponse.json(GPAY_UPLOAD_RESPONSE)),
  http.get('/api/v1/imports/gpay-matches', () => HttpResponse.json(GPAY_MATCHES_RESPONSE)),
  http.get('/api/v1/imports/gpay-matches/pending', () => HttpResponse.json(GPAY_MATCHES_RESPONSE)),
  http.get('/api/v1/imports/gpay-matches/orphans', () => HttpResponse.json(GPAY_ORPHANS_RESPONSE)),
  http.post('/api/v1/imports/gpay-matches/:matchId/resolve', async ({ request, params }) => {
    const body = await request.json() as Record<string, string>
    return HttpResponse.json({
      ...GPAY_MATCHES_RESPONSE[0],
      id: params.matchId,
      status: 'resolved',
      chosen_transaction_id: body.chosen_transaction_id,
    })
  }),

  // Reports
  http.get('/api/v1/reports/schema', () =>
    HttpResponse.json({
      tables: [
        {
          name: 'transactions',
          description: 'All financial transactions',
          columns: [
            { name: 'id', type: 'uuid', description: 'Primary key', foreign_key: null },
            { name: 'user_id', type: 'uuid', description: 'Owner user', foreign_key: 'users.id' },
            { name: 'amount', type: 'numeric', description: 'Transaction amount', foreign_key: null },
          ],
        },
        {
          name: 'accounts',
          description: 'Bank and wallet accounts',
          columns: [
            { name: 'id', type: 'uuid', description: 'Primary key', foreign_key: null },
            { name: 'user_id', type: 'uuid', description: 'Owner user', foreign_key: 'users.id' },
            { name: 'name', type: 'text', description: 'Account name', foreign_key: null },
          ],
        },
      ],
    }),
  ),
  http.post('/api/v1/reports/query', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const sql = body.sql as string
    if (!sql?.includes('user_id')) {
      return HttpResponse.json({ detail: 'Query must include a user_id filter' }, { status: 400 })
    }
    return HttpResponse.json({
      columns: ['id', 'amount'],
      rows: [{ id: 'txn-1', amount: '500.00' }],
      row_count: 1,
      truncated: false,
    })
  }),
  http.get('/api/v1/reports/dashboards', () =>
    HttpResponse.json([
      {
        id: 'dash-1',
        user_id: 'user-1',
        name: 'Spending Overview',
        description: 'Monthly spending',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      },
    ]),
  ),
  http.post('/api/v1/reports/dashboards', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      {
        id: 'dash-new',
        user_id: 'user-1',
        name: body.name,
        description: body.description ?? null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      },
      { status: 201 },
    )
  }),
  http.get('/api/v1/reports/dashboards/:dashboardId', ({ params }) =>
    HttpResponse.json({
      id: params.dashboardId,
      user_id: 'user-1',
      name: 'Spending Overview',
      description: 'Monthly spending',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      deleted_at: null,
    }),
  ),
  http.patch('/api/v1/reports/dashboards/:dashboardId', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: params.dashboardId,
      user_id: 'user-1',
      name: body.name ?? 'Spending Overview',
      description: body.description ?? null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      deleted_at: null,
    })
  }),
  http.delete('/api/v1/reports/dashboards/:dashboardId', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/v1/reports/dashboards/:dashboardId/widgets', () =>
    HttpResponse.json([
      {
        id: 'widget-1',
        dashboard_id: 'dash-1',
        title: 'Top Expenses',
        query: 'SELECT amount FROM transactions WHERE user_id = :user_id',
        viz_type: 'bar',
        viz_config: { x_key: 'month', y_key: 'amount' },
        position: { x: 0, y: 0, w: 6, h: 4 },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]),
  ),
  http.post('/api/v1/reports/dashboards/:dashboardId/widgets', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      {
        id: 'widget-new',
        dashboard_id: params.dashboardId,
        title: body.title,
        query: body.query,
        viz_type: body.viz_type,
        viz_config: body.viz_config ?? null,
        position: body.position ?? null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      { status: 201 },
    )
  }),
  http.patch('/api/v1/reports/dashboards/:dashboardId/widgets/:widgetId', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: params.widgetId,
      dashboard_id: params.dashboardId,
      title: body.title ?? 'Top Expenses',
      query: 'SELECT amount FROM transactions WHERE user_id = :user_id',
      viz_type: body.viz_type ?? 'bar',
      viz_config: body.viz_config ?? null,
      position: body.position ?? null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })
  }),
  http.delete('/api/v1/reports/dashboards/:dashboardId/widgets/:widgetId', () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // LLM Activity
  http.get('/api/v1/settings/llm-activity', ({ request }) => {
    const url = new URL(request.url)
    const op = url.searchParams.get('operation')
    const be = url.searchParams.get('backend')
    let data = LLM_ACTIVITY_RESPONSE
    if (op) data = data.filter((l) => l.operation === op)
    if (be) data = data.filter((l) => l.backend === be)
    return HttpResponse.json(data)
  }),

  // Portability — Export
  http.post('/api/v1/export', () =>
    HttpResponse.json(
      {
        id: 'job-1',
        status: 'done',
        created_at: '2026-01-01T00:00:00Z',
        completed_at: '2026-01-01T00:00:05Z',
        error: null,
      },
      { status: 202 },
    ),
  ),
  http.get('/api/v1/export/:jobId', ({ params }) =>
    HttpResponse.json({
      id: params.jobId,
      status: 'done',
      created_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:00:05Z',
      error: null,
    }),
  ),
  http.get('/api/v1/export/:jobId/download', () =>
    new HttpResponse(new Blob(['fake-archive']), {
      headers: { 'Content-Type': 'application/gzip' },
    }),
  ),
  http.post('/api/v1/import-archive', () =>
    HttpResponse.json({ imported_tables: { accounts: 2, transactions: 10 }, total_records: 12 }),
  ),

  // Tags
  http.get('/api/v1/tags', () => HttpResponse.json(TAGS_RESPONSE)),
  http.post('/api/v1/tags', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...TAGS_RESPONSE[0], id: 'tag-new', name: body.name },
      { status: 201 },
    )
  }),
  http.delete('/api/v1/tags/:id', () => new HttpResponse(null, { status: 204 })),
  http.patch('/api/v1/tags/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...TAGS_RESPONSE[0], ...body })
  }),

  // Recently deleted
  http.get('/api/v1/recently-deleted', () =>
    HttpResponse.json({
      items: [
        { id: 'acc-deleted-1', entity_type: 'accounts', label: 'Old Bank', deleted_at: '2026-05-20T10:00:00Z' },
        { id: 'payee-deleted-1', entity_type: 'payees', label: 'Old Payee', deleted_at: '2026-05-19T10:00:00Z' },
        { id: 'txn-deleted-1', entity_type: 'transactions', label: 'expense 500.00', deleted_at: '2026-05-18T10:00:00Z' },
      ],
    }),
  ),
  http.post('/api/v1/accounts/:id/restore', () => HttpResponse.json({ id: 'acc-deleted-1', deleted_at: null })),
  http.post('/api/v1/payees/:id/restore', () => HttpResponse.json({ id: 'payee-deleted-1', deleted_at: null })),
  http.post('/api/v1/transactions/:id/restore', () => HttpResponse.json({ id: 'txn-deleted-1', deleted_at: null })),
]
