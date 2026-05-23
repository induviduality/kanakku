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
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">{title}</Dialog.Title>
          {children}
          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
