import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'
import { useLogout } from '../../api/auth'

export default function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const logout = useLogout()

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          aria-label="Profile menu"
          className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[10rem] rounded-xl border border-border bg-surface-1 shadow-lg p-1.5 outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <button
            type="button"
            onClick={() => { setOpen(false); logout.mutate() }}
            disabled={logout.isPending}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-negative-dim hover:bg-negative/10 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {logout.isPending ? 'Signing out…' : 'Log out'}
          </button>
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
