import { useEffect, useRef, useState } from 'react'

export interface AutocompleteOption {
  id: string
  label: string
}

interface AutocompleteProps {
  id?: string
  options: AutocompleteOption[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  onInlineCreate?: (name: string) => Promise<AutocompleteOption>
  disabled?: boolean
}

export default function Autocomplete({
  id,
  options,
  value,
  onChange,
  placeholder = 'Search…',
  onInlineCreate,
  disabled,
}: AutocompleteProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.id === value) ?? null

  // Sync query when selected changes externally
  useEffect(() => {
    if (!open) setQuery(selected?.label ?? '')
  }, [selected, open])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(selected?.label ?? '')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selected])

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  )

  const showCreate =
    onInlineCreate &&
    query.trim().length > 0 &&
    !filtered.some((o) => o.label.toLowerCase() === query.toLowerCase())

  async function handleCreate() {
    if (!onInlineCreate || !query.trim()) return
    setCreating(true)
    try {
      const created = await onInlineCreate(query.trim())
      onChange(created.id)
      setQuery(created.label)
      setOpen(false)
    } finally {
      setCreating(false)
    }
  }

  function select(opt: AutocompleteOption) {
    onChange(opt.id)
    setQuery(opt.label)
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex">
        <input
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (!e.target.value) onChange(null)
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            className="ml-1 text-gray-400 hover:text-gray-600 text-sm px-1"
            aria-label="Clear"
          >
            ×
          </button>
        )}
      </div>

      {open && (filtered.length > 0 || showCreate) && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-48 overflow-auto"
        >
          {filtered.map((opt) => (
            <li
              key={opt.id}
              role="option"
              aria-selected={opt.id === value}
              onClick={() => select(opt)}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-indigo-50 aria-selected:bg-indigo-100"
            >
              {opt.label}
            </li>
          ))}
          {showCreate && (
            <li
              role="option"
              aria-selected={false}
              onClick={handleCreate}
              className="cursor-pointer px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 border-t border-gray-100"
            >
              {creating ? 'Creating…' : `Create "${query.trim()}"`}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
