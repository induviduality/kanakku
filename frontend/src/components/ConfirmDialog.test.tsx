import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog component', () => {
  it('does not render when open is false', () => {
    const handleConfirm = vi.fn()
    const handleCancel = vi.fn()
    render(
      <ConfirmDialog
        open={false}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    )
    expect(screen.queryByText('Delete Item')).not.toBeInTheDocument()
  })

  it('renders elements and triggers callbacks correctly', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    const handleCancel = vi.fn()

    render(
      <ConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    )

    expect(screen.getByText('Delete Item')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    const confirmButton = screen.getByRole('button', { name: /confirm/i })

    expect(cancelButton).toBeInTheDocument()
    expect(confirmButton).toBeInTheDocument()

    await user.click(confirmButton)
    expect(handleConfirm).toHaveBeenCalledTimes(1)

    await user.click(cancelButton)
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('uses custom confirmLabel and isDestructive styles', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Clear Cache"
        description="This will clear everything."
        confirmLabel="Wipe Clean"
        isDestructive={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const confirmButton = screen.getByRole('button', { name: /wipe clean/i })
    expect(confirmButton).toBeInTheDocument()
    expect(confirmButton.className).toContain('bg-red-600')
  })

  it('triggers onCancel when pressing escape key', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        title="Esc Test"
        description="Press escape to close"
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />
    )

    await user.keyboard('{Escape}')
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })
})
