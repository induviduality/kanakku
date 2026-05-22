import { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchInviteInfo, useAcceptInvite } from '../api/auth'

export default function AcceptInvite() {
  const navigate = useNavigate()
  // strict: false lets us read search params without a typed route registration
  const search = useSearch({ strict: false }) as Record<string, string>
  const token = search.token ?? ''

  const inviteQuery = useQuery({
    queryKey: ['invite-info', token],
    queryFn: () => fetchInviteInfo(token),
    enabled: !!token,
    retry: false,
  })

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const accept = useAcceptInvite()

  // Pre-fill email once invite info loads
  useEffect(() => {
    if (inviteQuery.data?.email) {
      setEmail(inviteQuery.data.email)
    }
  }, [inviteQuery.data?.email])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await accept.mutateAsync({ token, email, password })
      await navigate({ to: '/' })
    } catch {
      // error displayed via accept.isError
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Missing invite token.</p>
      </main>
    )
  }

  if (inviteQuery.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading invite…</p>
      </main>
    )
  }

  if (inviteQuery.isError) {
    const status = (inviteQuery.error as unknown as { status?: number }).status
    const message =
      status === 410 ? 'This invite has expired or already been used.' : 'Invite not found.'
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p role="alert" className="text-red-600">
          {message}
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-bold text-gray-900">Accept invite</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={!!inviteQuery.data?.email}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 read-only:bg-gray-50"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {accept.isError && (
            <p role="alert" className="text-sm text-red-600">
              Could not accept invite. Please try again.
            </p>
          )}

          <button
            type="submit"
            disabled={accept.isPending}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {accept.isPending ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  )
}
