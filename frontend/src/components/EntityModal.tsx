import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function EntityModal({ open, onClose, title, children }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-lg focus:outline-none flex flex-col max-h-[90vh]"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
            <Dialog.Title className="text-lg font-semibold text-gray-900">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-6 pb-6 flex-1">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
