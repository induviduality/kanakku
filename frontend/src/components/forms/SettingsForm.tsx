import { useState, useEffect } from 'react'
import type { UserSettings, SettingsPatch } from '../../api/settings'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD']
const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Singapore',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Australia/Sydney',
  'UTC',
]
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']
const NUMBER_FORMATS = ['en-IN', 'en-US', 'en-GB', 'de-DE']

interface Props {
  settings: UserSettings
  onSave: (patch: SettingsPatch) => Promise<void>
  isSaving: boolean
}

export default function SettingsForm({ settings, onSave, isSaving }: Props) {
  const [currency, setCurrency] = useState(settings.primary_currency)
  const [timezone, setTimezone] = useState(settings.timezone)
  const [dateFormat, setDateFormat] = useState(settings.date_format)
  const [numberFormat, setNumberFormat] = useState(settings.number_format)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setCurrency(settings.primary_currency)
    setTimezone(settings.timezone)
    setDateFormat(settings.date_format)
    setNumberFormat(settings.number_format)
  }, [settings])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSave({
      primary_currency: currency,
      timezone,
      date_format: dateFormat,
      number_format: numberFormat,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
          Primary currency
        </label>
        <select
          id="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
          Timezone
        </label>
        <select
          id="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="date-format" className="block text-sm font-medium text-gray-700">
          Date format
        </label>
        <select
          id="date-format"
          value={dateFormat}
          onChange={(e) => setDateFormat(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {DATE_FORMATS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="number-format" className="block text-sm font-medium text-gray-700">
          Number format
        </label>
        <select
          id="number-format"
          value={numberFormat}
          onChange={(e) => setNumberFormat(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {NUMBER_FORMATS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </form>
  )
}
