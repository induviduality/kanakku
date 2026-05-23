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
    recurrence_rule: 'FREQ=MONTHLY',
    parent_budget_id: null,
    is_modified_instance: false,
    is_active: true,
    notes: null,
    category_ids: ['cat-1'],
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

export const handlers = [
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
  http.get('/api/v1/budgets', () => HttpResponse.json(BUDGETS_RESPONSE)),
  http.post('/api/v1/budgets', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...BUDGETS_RESPONSE[0], id: 'budget-new', name: body.name, type: body.type },
      { status: 201 },
    )
  }),
  http.get('/api/v1/budgets/:budgetId', ({ params }) => {
    if (params.budgetId === 'not-found') {
      return HttpResponse.json({ detail: 'Budget not found' }, { status: 404 })
    }
    return HttpResponse.json({ ...BUDGETS_RESPONSE[0], id: params.budgetId })
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
]
