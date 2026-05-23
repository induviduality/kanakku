import { useState } from 'react'
import { useTriggerExport, useGetExportJob } from '../api/portability'

export default function SettingsDataExport() {
  const [jobId, setJobId] = useState<string | null>(null)
  const trigger = useTriggerExport()
  const { data: job } = useGetExportJob(jobId)

  const status = job?.status ?? null

  async function handleExport() {
    const result = await trigger.mutateAsync()
    setJobId(result.id)
  }

  const downloadUrl = jobId ? `/api/v1/export/${jobId}/download` : null

  return (
    <div className="p-4 md:p-6 max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Export Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Download all your data as a portable JSON archive (tar.gz).
          UUIDs are preserved so the archive can be imported into another Kanakku instance.
        </p>
      </div>

      <button
        onClick={handleExport}
        disabled={trigger.isPending || status === 'pending' || status === 'running'}
        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        aria-label="Start export"
      >
        {trigger.isPending || status === 'pending' || status === 'running'
          ? 'Exporting…'
          : 'Export My Data'}
      </button>

      {status === 'done' && downloadUrl && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-medium text-green-800">Export complete!</p>
          <a
            href={downloadUrl}
            download
            className="inline-block px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
            aria-label="Download archive"
          >
            Download Archive
          </a>
        </div>
      )}

      {status === 'failed' && (
        <p className="text-sm text-red-600" role="alert">
          Export failed: {job?.error ?? 'Unknown error'}
        </p>
      )}

      {(status === 'pending' || status === 'running') && (
        <div className="flex items-center gap-2 text-sm text-gray-500" aria-live="polite">
          <span className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          Preparing your archive…
        </div>
      )}
    </div>
  )
}
