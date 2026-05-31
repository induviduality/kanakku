import { useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useUploadPdf } from '../api/imports'
import { useAccounts } from '../api/accounts'
import { PasswordInput } from '../components/PasswordInput'

export default function ImportUpload() {
  const navigate = useNavigate()
  const { data: accounts = [] } = useAccounts()
  const uploadMutation = useUploadPdf()

  const [accountId, setAccountId] = useState('')
  const [password, setPassword] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    uploadMutation.mutate(
      { file, password: password || undefined, accountId: accountId || undefined },
      { onSuccess: (batch) => navigate({ to: `/imports/${batch.id}` }) },
    )
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.toLowerCase().endsWith('.pdf')) setFile(dropped)
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <Link to="/imports" className="text-xs text-fg-faint hover:text-accent transition-colors">
          ← Back to imports
        </Link>
        <h1 className="text-xl font-bold text-fg mt-2">Upload PDF Statement</h1>
        <p className="text-xs text-fg-faint mt-0.5">Transactions will be parsed and queued for your review</p>
      </div>

      <form onSubmit={handleSubmit} className="kk-card space-y-5">
        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center gap-2 h-36 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            dragging
              ? 'border-accent bg-accent/10'
              : file
              ? 'border-positive/50 bg-positive/5'
              : 'border-border hover:border-border-strong hover:bg-surface-2'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              <svg className="w-8 h-8 text-positive-dim" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-fg">{file.name}</p>
              <p className="text-xs text-fg-faint">{(file.size / 1024).toFixed(0)} KB</p>
            </>
          ) : (
            <>
              <svg className="w-8 h-8 text-fg-faint" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-fg-muted">Drop PDF here or <span className="text-accent underline">browse</span></p>
              <p className="text-xs text-fg-faint">Supports password-protected PDFs</p>
            </>
          )}
        </div>

        {/* Account */}
        <div>
          <label className="kk-label" htmlFor="account">Account</label>
          <select
            id="account"
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="kk-input"
          >
            <option value="">Select account (optional)</option>
            {accounts.filter(a => !a.deleted_at).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Password */}
        <div>
          <label className="kk-label" htmlFor="pdf-password">PDF Password</label>
          <PasswordInput
            id="pdf-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Leave blank if not protected"
            className="kk-input"
          />
        </div>

        {uploadMutation.isError && (
          <p className="text-sm text-negative-dim bg-negative/10 border border-negative/20 rounded-lg px-3 py-2" role="alert">
            Upload failed. Please check the file and try again.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Link to="/imports" className="kk-btn-ghost">Cancel</Link>
          <button
            type="submit"
            disabled={!file || uploadMutation.isPending}
            className="kk-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadMutation.isPending ? 'Uploading…' : 'Upload & Parse'}
          </button>
        </div>
      </form>
    </div>
  )
}
