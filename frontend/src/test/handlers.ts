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
