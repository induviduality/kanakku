import * as Toast from '@radix-ui/react-toast'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastVariant = 'default' | 'error'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, variant: ToastVariant = 'default') => {
    const id = ++counter.current
    setItems(prev => [...prev, { id, message, variant }])
  }, [])

  function dismiss(id: number) {
    setItems(prev => prev.filter(t => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      <Toast.Provider swipeDirection="right">
        {children}
        {items.map(item => (
          <Toast.Root
            key={item.id}
            open
            onOpenChange={open => { if (!open) dismiss(item.id) }}
            duration={4000}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm
              data-[state=open]:animate-in data-[state=closed]:animate-out
              data-[state=closed]:fade-out data-[state=open]:fade-in
              data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]
              ${item.variant === 'error'
                ? 'bg-surface border-negative/30 text-negative-dim'
                : 'bg-surface border-border/50 text-fg'
              }`}
          >
            <Toast.Description className="flex-1">{item.message}</Toast.Description>
            <Toast.Close
              aria-label="close"
              className="shrink-0 text-fg-faint hover:text-fg transition-colors"
            >
              ✕
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)]" />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}
