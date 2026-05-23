import { useRef, useState } from 'react'
import { useImportArchive } from '../api/portability'

export default function SettingsDataImport() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ total_records: number; imported_tables: Record<string, number> } | null>(null)
  const importMutation = useImportArchive()

  async function handleImport() {
    if (!selectedFile) return
    const data = await importMutation.mutateAsync(selectedFile)
    setResult(data)
    setSelectedFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="p-4 md:p-6 max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Import Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Restore data from a Kanakku JSON archive (tar.gz).
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4" role="alert">
        <p className="text-sm font-semibold text-amber-800">Warning — destructive operation</p>
        <ul className="mt-1 text-sm text-amber-700 list-disc list-inside space-y-1">
          <li>Import is only allowed for accounts with <strong>no existing transactions</strong>.</li>
          <li>All data in the archive will be loaded atomically — the operation cannot be undone.</li>
          <li>UUID conflicts will be rejected.</li>
        </ul>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Select archive file (.tar.gz)
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".tar.gz,.gz"
          aria-label="Select archive file"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />

        {selectedFile && (
          <p className="text-xs text-gray-500">Selected: {selectedFile.name}</p>
        )}

        <button
          onClick={handleImport}
          disabled={!selectedFile || importMutation.isPending}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          aria-label="Start import"
        >
          {importMutation.isPending ? 'Importing…' : 'Import Archive'}
        </button>
      </div>

      {importMutation.error && (
        <p className="text-sm text-red-600" role="alert">
          {importMutation.error.message}
        </p>
      )}

      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-medium text-green-800">
            Import complete — {result.total_records} records loaded.
          </p>
          <details className="text-xs text-green-700">
            <summary className="cursor-pointer">View by table</summary>
            <ul className="mt-1 space-y-0.5 pl-2">
              {Object.entries(result.imported_tables)
                .filter(([, n]) => n > 0)
                .map(([table, n]) => (
                  <li key={table}>{table}: {n}</li>
                ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  )
}
