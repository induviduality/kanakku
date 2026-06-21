import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  headerAction?: React.ReactNode
}

export function Drawer({ open, onClose, title, children, headerAction }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={o => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-border bg-surface-1 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right duration-300"
          aria-describedby={undefined}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-sm font-semibold text-fg">{title}</Dialog.Title>
            <div className="flex items-center gap-1">
              {headerAction}
              <Dialog.Close asChild>
                <button
                  className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="kk-section-label">{label}</p>
      {children}
    </div>
  )
}

export function DrawerRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-fg-muted shrink-0">{label}</span>
      <span className="text-xs text-fg text-right">{value}</span>
    </div>
  )
}
