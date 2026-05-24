import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useLogin } from '../api/auth'
import { DEV_MODE, DEV_EMAIL, DEV_PASSWORD } from '../lib/dev-mode'

export default function Login() {
  const [email, setEmail] = useState(DEV_MODE === 'seeded' ? DEV_EMAIL : '')
  const [password, setPassword] = useState(DEV_MODE === 'seeded' ? DEV_PASSWORD : '')
  const navigate = useNavigate()
  const login = useLogin()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await login.mutateAsync({ email, password })
      await navigate({ to: '/' })
    } catch {
      // error displayed via login.isError
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>

        {DEV_MODE === 'seeded' && (
          <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            Dev mode — credentials pre-filled
          </p>
        )}

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
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

          {login.isError && (
            <p role="alert" className="text-sm text-red-600">
              Invalid email or password.
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
