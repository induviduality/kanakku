import * as Dialog from '@radix-ui/react-dialog'

export default function App() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-white">
      <h1 className="text-4xl font-bold tracking-tight text-gray-900">Kanakku</h1>

      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            Open dialog
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 shadow-xl w-80">
            <Dialog.Title className="text-lg font-semibold">Hello from Kanakku</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-gray-500">
              Radix UI dialog with Tailwind styling.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button className="mt-4 px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
                Close
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  )
}
