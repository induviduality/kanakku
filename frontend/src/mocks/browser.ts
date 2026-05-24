import { http, HttpResponse } from 'msw'
import { setupWorker } from 'msw/browser'
import { handlers } from '../test/handlers'

// The dev-login endpoint is only used by bypass-auth mode and isn't in the
// test handlers (tests don't exercise that flow), so we add it here.
const devLoginHandler = http.get('/api/v1/auth/dev-login', () =>
  HttpResponse.json({
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
  }),
)

// Also intercept refresh so the token stays valid after the initial bypass.
const refreshHandler = http.post('/api/v1/auth/refresh', () =>
  HttpResponse.json({
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
  }),
)

export const worker = setupWorker(devLoginHandler, refreshHandler, ...handlers)
