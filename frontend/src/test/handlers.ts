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

const PAYEE_BASE = { user_id: 'user-1', notes: null, is_active: true, default_category_ids: [], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }
export const PAYEES_RESPONSE = [
  { ...PAYEE_BASE, id: 'payee-1', name: 'Swiggy',   type: 'merchant',  default_category_ids: ['cat-1'] },
  { ...PAYEE_BASE, id: 'payee-2', name: 'Uber',      type: 'merchant' },
  { ...PAYEE_BASE, id: 'payee-3', name: 'Netflix',   type: 'merchant' },
  { ...PAYEE_BASE, id: 'payee-rahul', name: 'Rahul', type: 'individual' },
  { ...PAYEE_BASE, id: 'payee-priya', name: 'Priya', type: 'individual' },
  { ...PAYEE_BASE, id: 'payee-neel',  name: 'Neel',  type: 'individual' },
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

const TXN_BASE = { user_id: 'user-1', currency: 'INR', notes: null, external_ref: null, payment_method_id: null, payment_method_name: null, to_account_id: null, to_amount: null, to_currency: null, subscription_id: null, import_record_id: null, split_id: null, is_split: false, category_ids: [], tag_ids: [], budget_ids: [], deleted_at: null }
const txn = (id: string, type: string, date: string, amount: string, desc: string, extra: Record<string, unknown> = {}) => ({
  ...TXN_BASE, id, type, transacted_at: `${date}T10:00:00Z`, amount, description: desc,
  account_id: 'acc-1', payee_id: null,
  created_at: `${date}T10:00:00Z`, updated_at: `${date}T10:00:00Z`,
  ...extra,
})

export const TRANSACTIONS_RESPONSE = {
  items: [
    // May 2026 — sorted newest first
    txn('txn-may-salary',  'income',   '2026-05-01', '85000.00', 'May salary',        { payee_id: 'payee-employer' }),
    txn('txn-may-transfer','transfer', '2026-05-02', '10000.00', 'Top-up ICICI',      { to_account_id: 'acc-2', to_amount: '10000.00', to_currency: 'INR' }),
    txn('txn-may-amazon',  'expense',  '2026-05-03', '1899.00',  'USB hub',           { account_id: 'acc-4' }),
    txn('txn-may-gym',     'expense',  '2026-05-05', '2500.00',  'Gym membership'),
    // Scenario: 4-way split — Dinner at Taj (ring 25%, my share pending)
    txn('txn-split-dinner','expense',  '2026-05-07', '3600.00',  'Dinner at Taj',     { account_id: 'acc-4', payee_id: 'payee-1', is_split: true, split_id: 'split-dinner' }),
    txn('txn-may-uber',    'expense',  '2026-05-08', '250.00',   'Ride to airport',   { payee_id: 'payee-2', payment_method_id: 'pm-1', payment_method_name: 'HDFC Visa', external_ref: 'UPI/261537891204/UBER', tag_ids: ['tag-1'] }),
    txn('txn-may-grocery', 'expense',  '2026-05-09', '1250.00',  'Weekly groceries',  { budget_ids: ['budget-1'], category_ids: ['cat-1'] }),
    txn('txn-may-meds',    'expense',  '2026-05-10', '540.00',   'Monthly meds'),
    txn('txn-may-food1',   'expense',  '2026-05-12', '680.00',   'Weekend lunch',     { payee_id: 'payee-1', category_ids: ['cat-1'], tag_ids: ['tag-1'] }),
    // Scenario: 3-way split — Weekend trip fuel (ring 100%, both payees settled)
    txn('txn-split-fuel',  'expense',  '2026-05-14', '2400.00',  'Weekend trip fuel', { is_split: true, split_id: 'split-fuel' }),
    txn('txn-may-netflix', 'expense',  '2026-05-15', '649.00',   'Netflix May',       { account_id: 'acc-4', payee_id: 'payee-3' }),
    txn('txn-may-lunch',   'expense',  '2026-05-15', '2400.00',  'Team lunch',        { account_id: 'acc-4', payee_id: 'payee-1' }),
    txn('txn-may-petrol',  'expense',  '2026-05-16', '2000.00',  'Petrol'),
    // Scenario: split share settlements — income from friends who paid back
    txn('txn-settle-dinner-rahul', 'income', '2026-05-12', '450.00', "Rahul's partial – dinner", { payee_id: 'payee-rahul' }),
    txn('txn-settle-fuel-rahul', 'income', '2026-05-16', '800.00', "Rahul's share – fuel split", { payee_id: 'payee-rahul' }),
    txn('txn-settle-fuel-priya', 'income', '2026-05-17', '800.00', "Priya's share – fuel split", { payee_id: 'payee-priya' }),
    txn('txn-may-food2',   'expense',  '2026-05-18', '310.00',   'Street food',       { account_id: 'acc-3' }),
    txn('txn-may-uber2',   'expense',  '2026-05-20', '180.00',   'Ride to office',    { payee_id: 'payee-2' }),
    // Scenario: 2-way split — Movie + dinner (ring 50%, Neel pending)
    txn('txn-split-movie', 'expense',  '2026-05-21', '1800.00',  'Movie + dinner',    { account_id: 'acc-4', is_split: true, split_id: 'split-movie' }),
    txn('txn-may-cc',      'transfer', '2026-05-22', '15000.00', 'CC bill payment',   { to_account_id: 'acc-4', to_amount: '15000.00', to_currency: 'INR' }),
    txn('txn-settle-movie-neel', 'income', '2026-05-22', '900.00', "Neel's share – movie + dinner", { payee_id: 'payee-neel' }),
    txn('txn-may-coffee',  'expense',  '2026-05-23', '380.00',   'Coffee & snacks',   { account_id: 'acc-3', payee_id: 'payee-1' }),
  ],
  next_cursor: null,
}

const shareBase = (
  id: string, splitId: string, payeeId: string | null, amount: string, status: string,
  extra: { paid_amount?: string; forgiven_amount?: string; settlements?: object[]; notes?: string; updated_at?: string } = {},
) => ({
  id, split_id: splitId, payee_id: payeeId, amount, status,
  paid_amount: extra.paid_amount ?? '0.00',
  forgiven_amount: extra.forgiven_amount ?? '0.00',
  settlements: extra.settlements ?? [],
  notes: extra.notes ?? null,
  created_at: '2026-05-07T10:00:00Z',
  updated_at: extra.updated_at ?? '2026-05-07T10:00:00Z',
})

const settlement = (id: string, shareId: string, txnId: string, amount: string, date: string) => ({
  id, share_id: shareId, transaction_id: txnId, amount, created_at: date,
})

// Scenario: Dinner at Taj — 4-way split
//   - own share: ₹900 pending
//   - Rahul: ₹900 pending but ₹450 paid (partial payment received)
//   - Priya: ₹900 forgiven (absorbed by user)
//   - Neel: ₹900 pending (untouched)
const SPLIT_DINNER = {
  id: 'split-dinner', user_id: 'user-1', expense_transaction_ids: ['txn-split-dinner'],
  notes: 'Dinner at Taj', deleted_at: null,
  created_at: '2026-05-07T10:00:00Z', updated_at: '2026-05-12T10:00:00Z',
  shares: [
    shareBase('sh-d-own', 'split-dinner', null,          '900.00', 'pending'),
    shareBase('sh-d1',    'split-dinner', 'payee-rahul', '900.00', 'pending', {
      paid_amount: '450.00',
      settlements: [settlement('sset-d1', 'sh-d1', 'txn-settle-dinner-rahul', '450.00', '2026-05-12T10:00:00Z')],
    }),
    shareBase('sh-d2',    'split-dinner', 'payee-priya', '900.00', 'forgiven', {
      forgiven_amount: '900.00',
      updated_at: '2026-05-09T10:00:00Z',
    }),
    shareBase('sh-d3',    'split-dinner', 'payee-neel',  '900.00', 'pending'),
  ],
}

// Scenario: Weekend trip fuel — 3-way, both payees fully settled via linked transactions
const SPLIT_FUEL = {
  id: 'split-fuel', user_id: 'user-1', expense_transaction_ids: ['txn-split-fuel'],
  notes: 'Weekend trip fuel', deleted_at: null,
  created_at: '2026-05-14T10:00:00Z', updated_at: '2026-05-17T10:00:00Z',
  shares: [
    shareBase('sh-f-own', 'split-fuel', null,          '800.00', 'pending'),
    shareBase('sh-f1',    'split-fuel', 'payee-rahul', '800.00', 'settled', {
      paid_amount: '800.00', updated_at: '2026-05-16T10:00:00Z',
      settlements: [settlement('sset-f1', 'sh-f1', 'txn-settle-fuel-rahul', '800.00', '2026-05-16T10:00:00Z')],
    }),
    shareBase('sh-f2',    'split-fuel', 'payee-priya', '800.00', 'settled', {
      paid_amount: '800.00', updated_at: '2026-05-17T10:00:00Z',
      settlements: [settlement('sset-f2', 'sh-f2', 'txn-settle-fuel-priya', '800.00', '2026-05-17T10:00:00Z')],
    }),
  ],
}

// Scenario: Movie + dinner — 2-way, Neel fully settled; my ₹900 pending
const SPLIT_MOVIE = {
  id: 'split-movie', user_id: 'user-1', expense_transaction_ids: ['txn-split-movie'],
  notes: 'Movie + dinner', deleted_at: null,
  created_at: '2026-05-21T10:00:00Z', updated_at: '2026-05-22T10:00:00Z',
  shares: [
    shareBase('sh-m-own', 'split-movie', null,         '900.00', 'pending'),
    shareBase('sh-m1',    'split-movie', 'payee-neel', '900.00', 'settled', {
      paid_amount: '900.00', updated_at: '2026-05-22T10:00:00Z',
      settlements: [settlement('sset-m1', 'sh-m1', 'txn-settle-movie-neel', '900.00', '2026-05-22T10:00:00Z')],
    }),
  ],
}

export const SPLIT_RESPONSE = SPLIT_DINNER

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
    { id: 'acc-1', name: 'HDFC Savings',     type: 'bank',        currency: 'INR', balance: '87430.00'  },
    { id: 'acc-2', name: 'ICICI Savings',    type: 'bank',        currency: 'INR', balance: '23500.00'  },
    { id: 'acc-3', name: 'Wallet (Cash)',     type: 'cash',        currency: 'INR', balance: '850.00'    },
    { id: 'acc-4', name: 'HDFC Credit Card', type: 'credit_card', currency: 'INR', balance: '-12400.00' },
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
    const rawStart = url.searchParams.get('start_date')
    const rawEnd = url.searchParams.get('end_date')

    // start_date/end_date are now full UTC instants with an EXCLUSIVE end
    // (matching the real backend's contract — see docs/decisions/log.md
    // 2026-07-11 (11)), not bare inclusive dates. Mirror the real backend's
    // period_end = end_date - 1 day when a real request was made; the bare
    // DASHBOARD_RESPONSE fallback (used when no period override is given)
    // is already an inclusive date and needs no adjustment.
    const startDate = rawStart ? rawStart.slice(0, 10) : DASHBOARD_RESPONSE.period_start
    const endDate = rawEnd
      ? new Date(new Date(rawEnd).getTime() - 86400000).toISOString().slice(0, 10)
      : DASHBOARD_RESPONSE.period_end

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
  http.get('/api/v1/transactions', ({ request }) => {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const from = url.searchParams.get('from')
    const q = url.searchParams.get('q')?.toLowerCase()
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

    let items = TRANSACTIONS_RESPONSE.items
    if (type) items = items.filter((t) => t.type === type)
    if (from) items = items.filter((t) => t.transacted_at >= from)
    if (q) items = items.filter((t) => (t.description ?? '').toLowerCase().includes(q))
    items = items.slice(0, limit)

    return HttpResponse.json({
      ...TRANSACTIONS_RESPONSE,
      items,
      total: items.length,
    })
  }),
  http.post('/api/v1/transactions', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...TRANSACTIONS_RESPONSE.items[0], id: 'txn-new', type: body.type, amount: body.amount },
      { status: 201 },
    )
  }),
  http.get('/api/v1/transactions/:id', ({ params }) => {
    const found = TRANSACTIONS_RESPONSE.items.find((t) => t.id === params.id)
    if (!found) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json(found)
  }),
  http.patch('/api/v1/transactions/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...TRANSACTIONS_RESPONSE.items[0], ...body })
  }),
  http.delete('/api/v1/transactions/:id', () => new HttpResponse(null, { status: 204 })),

  // Splits
  http.get('/api/v1/splits', () => HttpResponse.json([SPLIT_DINNER, SPLIT_FUEL, SPLIT_MOVIE])),
  http.post('/api/v1/splits', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...SPLIT_RESPONSE, expense_transaction_ids: body.expense_transaction_ids },
      { status: 201 },
    )
  }),
  http.post('/api/v1/splits/bundle', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...SPLIT_RESPONSE, expense_transaction_ids: body.expense_transaction_ids },
      { status: 201 },
    )
  }),
  http.get('/api/v1/splits/:splitId', ({ params }) => {
    if (params.splitId === 'not-found') {
      return HttpResponse.json({ detail: 'Split not found' }, { status: 404 })
    }
    const all = [SPLIT_DINNER, SPLIT_FUEL, SPLIT_MOVIE]
    const found = all.find(s => s.id === params.splitId)
    return HttpResponse.json(found ?? { ...SPLIT_RESPONSE, id: params.splitId })
  }),
  http.post('/api/v1/splits/:splitId/shares/:shareId/settle', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    const txnId = body.transaction_id as string
    const creditAmount = (body.amount as string | undefined) ?? '800.00'
    const newSettlement = settlement(`sset-new-${Date.now()}`, params.shareId as string, txnId, creditAmount, new Date().toISOString())
    return HttpResponse.json({
      ...shareBase(params.shareId as string, params.splitId as string, 'payee-rahul', '800.00', 'settled', {
        paid_amount: creditAmount,
        settlements: [newSettlement],
      }),
    })
  }),
  http.post('/api/v1/splits/:splitId/shares/:shareId/forgive', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    const amount = body.amount as string
    const paid = '0.00'
    const shareAmt = '900.00'
    const isFullyForgiven = parseFloat(paid) + parseFloat(amount) >= parseFloat(shareAmt)
    return HttpResponse.json({
      ...shareBase(params.shareId as string, params.splitId as string, null, shareAmt, isFullyForgiven ? 'forgiven' : 'pending', {
        forgiven_amount: amount,
        paid_amount: paid,
      }),
    })
  }),
  http.post('/api/v1/splits/:splitId/shares/:shareId/unsettle', ({ params }) =>
    HttpResponse.json(
      shareBase(params.shareId as string, params.splitId as string, null, '900.00', 'pending'),
    ),
  ),
  http.delete('/api/v1/splits/:splitId/shares/:shareId/settlements/:settlementId', ({ params }) =>
    HttpResponse.json(
      shareBase(params.shareId as string, params.splitId as string, null, '900.00', 'pending'),
    ),
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
  http.get('/api/v1/budgets/:budgetId/transactions', ({ request }) => {
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    let items = BUDGET_TRANSACTIONS_RESPONSE.items
    if (from || to) {
      const fromMs = from ? new Date(from).getTime() : -Infinity
      const toMs = to ? new Date(to + 'T23:59:59Z').getTime() : Infinity
      items = items.filter(t => {
        const ms = new Date(t.transacted_at).getTime()
        return ms >= fromMs && ms <= toMs
      })
    }
    const total_spent = items
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0)
      .toFixed(2)
    return HttpResponse.json({ items, total_spent })
  }),

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
