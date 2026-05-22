import { http, HttpResponse } from 'msw'

const TOKEN_RESPONSE = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
}

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
]
