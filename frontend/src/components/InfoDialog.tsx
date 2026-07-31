import * as Dialog from '@radix-ui/react-dialog'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description: string
}

export default function InfoDialog({ open, onClose, title, description }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg focus:outline-none"
          aria-describedby="info-desc"
        >
          <Dialog.Title className="text-lg font-semibold text-gray-900">{title}</Dialog.Title>
          <p id="info-desc" className="mt-2 text-sm text-gray-600">{description}</p>
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
            >
              OK
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
