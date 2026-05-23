import { useState, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useUploadPdf } from '../api/imports'
import { useAccounts } from '../api/accounts'

export default function ImportUpload() {
  const navigate = useNavigate()
  const { data: accounts = [] } = useAccounts()
  const uploadMutation = useUploadPdf()

  const [accountId, setAccountId] = useState('')
  const [password, setPassword] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    uploadMutation.mutate(
      { file, password: password || undefined, accountId: accountId || undefined },
      {
        onSuccess: (batch) => {
          navigate({ to: `/imports/${batch.id}` })
        },
      },
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload PDF Statement</h1>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div>
          <label htmlFor="pdf-file" className="block text-sm font-medium text-gray-700">
            PDF file <span className="text-red-500">*</span>
          </label>
          <input
            id="pdf-file"
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        <div>
          <label htmlFor="account" className="block text-sm font-medium text-gray-700">
            Account
          </label>
          <select
            id="account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select account (optional)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pdf-password" className="block text-sm font-medium text-gray-700">
            PDF password (if protected)
          </label>
          <input
            id="pdf-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank if not password-protected"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {uploadMutation.isError && (
          <p className="text-sm text-red-600" role="alert">
            Upload failed. Please check the file and try again.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <a
            href="/imports"
            className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={!file || uploadMutation.isPending}
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>
    </div>
  )
}
