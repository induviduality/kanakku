import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client'
import { getAccessToken, setAccessToken, setRefreshToken, getRefreshToken } from './auth-storage'

// We will use standard mock of global fetch
const originalFetch = global.fetch

describe('api-client', () => {
  beforeEach(() => {
    global.fetch = originalFetch
    localStorage.clear()
  })

  it('performs authed fetch with Authorization headers', async () => {
    setAccessToken('access-123')
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '15' }),
      text: () => Promise.resolve('{"data":"hello"}'),
    })
    global.fetch = mockFetch

    const result = await apiGet<{ data: string }>('/test')
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/test', expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': 'Bearer access-123',
        'Content-Type': 'application/json',
      })
    }))
    expect(result).toEqual({ data: 'hello' })
  })

  it('handles post/patch/delete request formats', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
    })
    global.fetch = mockFetch

    await apiPost('/test-post', { foo: 'bar' })
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/test-post', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
    }))

    await apiPatch('/test-patch', { val: 42 })
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/test-patch', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ val: 42 }),
    }))

    await apiDelete('/test-delete')
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/test-delete', expect.objectContaining({
      method: 'DELETE',
    }))
  })

  it('attempts to refresh token on 401 and retries original request', async () => {
    setAccessToken('expired-access')
    setRefreshToken('valid-refresh')

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '50' }),
        json: () => Promise.resolve({ access_token: 'new-access', refresh_token: 'new-refresh' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '15' }),
        text: () => Promise.resolve('{"status":"ok"}'),
      })

    global.fetch = mockFetch

    const res = await apiGet('/test-refresh')
    expect(res).toEqual({ status: 'ok' })
    expect(getAccessToken()).toBe('new-access')
    expect(getRefreshToken()).toBe('new-refresh')
  })

  it('clears auth on refresh token failure', async () => {
    setAccessToken('expired-access')
    setRefreshToken('invalid-refresh')

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
      })

    global.fetch = mockFetch

    await expect(apiGet('/test-refresh-fail')).rejects.toThrow()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })
})
