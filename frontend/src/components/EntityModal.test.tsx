import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithQuery } from '../test/render-utils'
import EntityModal from './EntityModal'

describe('EntityModal component', () => {
  it('renders children when open is true', () => {
    renderWithQuery(
      <EntityModal open={true} onClose={vi.fn()} title="Test Modal">
        <div>Modal Content</div>
      </EntityModal>
    )
    
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal Content')).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    renderWithQuery(
      <EntityModal open={false} onClose={vi.fn()} title="Test Modal">
        <div>Modal Content</div>
      </EntityModal>
    )
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderWithQuery(
      <EntityModal open={true} onClose={onClose} title="Test Modal">
        <div>Modal Content</div>
      </EntityModal>
    )
    
    const closeBtn = screen.getByRole('button', { name: /close/i })
    await user.click(closeBtn)
    
    expect(onClose).toHaveBeenCalledOnce()
  })
})
