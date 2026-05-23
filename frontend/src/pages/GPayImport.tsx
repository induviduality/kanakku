import { useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useUploadGPayTakeout } from '../api/gpay'

export default function GPayImport() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadGPayTakeout()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setError(null)
    try {
      const result = await upload.mutateAsync(file)
      void navigate({ to: '/gpay/resolve', search: { uploaded: 'true' } })
      // Show summary briefly before navigating
      console.info('GPay upload result:', result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <main className="p-8 max-w-xl">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import GPay Takeout</h1>
        <Link to="/gpay/orphans" className="ml-auto text-sm text-indigo-600 hover:underline">
          View orphans
        </Link>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Upload your Google Takeout GPay transaction JSON file. Transactions within ±1 day
        and matching amount will be automatically matched to your bank records.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="takeout-file">
            Takeout JSON file
          </label>
          <input
            id="takeout-file"
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">{error}</p>
        )}

        {upload.isSuccess && upload.data && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
            <p className="font-semibold mb-1">Upload complete</p>
            <p>Parsed: {upload.data.parsed}</p>
            <p>Auto-linked: {upload.data.auto_linked}</p>
            <p>Pending review: {upload.data.pending}</p>
            <p>Orphans (no match): {upload.data.orphans}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!file || upload.isPending}
            className="rounded bg-indigo-600 px-5 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </button>
          <Link
            to="/gpay/resolve"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Review pending
          </Link>
        </div>
      </form>
    </main>
  )
}
