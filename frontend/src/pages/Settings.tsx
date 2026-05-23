import { useSettings, usePatchSettings } from '../api/settings'
import SettingsForm from '../components/forms/SettingsForm'

export default function Settings() {
  const { data, isLoading, isError } = useSettings()
  const patch = usePatchSettings()

  if (isLoading) {
    return (
      <main className="p-8">
        <p className="text-gray-500">Loading settings…</p>
      </main>
    )
  }

  if (isError || !data) {
    return (
      <main className="p-8">
        <p role="alert" className="text-red-600">Failed to load settings.</p>
      </main>
    )
  }

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <SettingsForm
        settings={data}
        onSave={(p) => patch.mutateAsync(p)}
        isSaving={patch.isPending}
      />
    </main>
  )
}
