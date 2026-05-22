import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSetup } from '../api/auth'

export default function Setup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const setup = useSetup()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await setup.mutateAsync({ email, password })
      await navigate({ to: '/' })
    } catch {
      // error displayed via setup.isError
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-bold text-gray-900">Set up Kanakku</h1>
        <p className="text-sm text-gray-500">Create your admin account to get started.</p>

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

          {setup.isError && (
            <p role="alert" className="text-sm text-red-600">
              Setup failed. Please try again.
            </p>
          )}

          <button
            type="submit"
            disabled={setup.isPending}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {setup.isPending ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  )
}
