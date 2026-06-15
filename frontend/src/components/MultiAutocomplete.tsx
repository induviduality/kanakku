import { useEffect, useRef, useState } from 'react'
import type { AutocompleteOption } from './Autocomplete'

interface MultiAutocompleteProps {
  id?: string
  options: AutocompleteOption[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  onInlineCreate?: (name: string) => Promise<AutocompleteOption>
  disabled?: boolean
}

export default function MultiAutocomplete({
  id,
  options,
  value,
  onChange,
  placeholder = 'Search…',
  onInlineCreate,
  disabled,
}: MultiAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedOptions = value.map((id) => options.find((o) => o.id === id)).filter(Boolean) as AutocompleteOption[]

  const filtered = options.filter(
    (o) =>
      !value.includes(o.id) &&
      o.label.toLowerCase().includes(query.toLowerCase()),
  )

  const showCreate =
    !!onInlineCreate &&
    query.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase())

  function remove(id: string) {
    onChange(value.filter((v) => v !== id))
  }

  function select(opt: AutocompleteOption) {
    onChange([...value, opt.id])
    setQuery('')
    inputRef.current?.focus()
  }

  async function handleCreate() {
    if (!onInlineCreate || !query.trim()) return
    setCreating(true)
    try {
      const created = await onInlineCreate(query.trim())
      onChange([...value, created.id])
      setQuery('')
      inputRef.current?.focus()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="kk-input min-h-[38px] flex flex-wrap gap-1 items-center cursor-text"
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
      >
        {selectedOptions.map((opt) => (
          <span
            key={opt.id}
            className="inline-flex items-center gap-1 rounded-full bg-accent-dim px-2 py-0.5 text-xs font-medium text-white"
          >
            {opt.label}
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => { e.stopPropagation(); remove(opt.id) }}
              className="hover:opacity-70 leading-none"
              aria-label={`Remove ${opt.label}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : ''}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !query && value.length > 0) {
              remove(value[value.length - 1])
            }
          }}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-fg placeholder:text-fg-faint"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
      </div>

      {open && (filtered.length > 0 || showCreate) && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border border-border-strong bg-surface-3 shadow max-h-48 overflow-auto"
        >
          {filtered.map((opt) => (
            <li
              key={opt.id}
              role="option"
              aria-selected={false}
              onClick={() => select(opt)}
              className="cursor-pointer px-3 py-2 text-sm text-fg hover:bg-accent-subtle"
            >
              {opt.label}
            </li>
          ))}
          {showCreate && (
            <li
              role="option"
              aria-selected={false}
              onClick={handleCreate}
              className="cursor-pointer px-3 py-2 text-sm text-accent hover:bg-accent-subtle border-t border-border"
            >
              {creating ? 'Creating…' : `Create "${query.trim()}"`}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
