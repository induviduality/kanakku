import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithQuery } from '../../test/render-utils'
import { PayeeDrawer } from './PayeeDrawer'
import { type Payee } from '../../api/payees'

describe('PayeeDrawer', () => {
  const basePayee: Payee = {
    id: 'p1',
    user_id: 'u1',
    name: 'Amazon',
    type: 'merchant',
    is_active: true,
    notes: 'Online shopping',
    default_category_ids: ['c1', 'c2'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  it('renders nothing when payee is null', () => {
    renderWithQuery(<PayeeDrawer payee={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders payee details correctly', () => {
    renderWithQuery(<PayeeDrawer payee={basePayee} onClose={vi.fn()} />)
    
    // Title and hero
    expect(screen.getAllByText('Amazon').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Merchant').length).toBeGreaterThan(0)
    
    // Initial avatar char
    expect(screen.getByText('A')).toBeInTheDocument()
    
    // Details
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Online shopping')).toBeInTheDocument()
    expect(screen.getByText('01 Jan 2026')).toBeInTheDocument()
    
    // Default categories section
    expect(screen.getByText('Default categories')).toBeInTheDocument()
    expect(screen.getByText('2 configured')).toBeInTheDocument()
  })

  it('handles inactive and no notes/categories', () => {
    const payee: Payee = {
      ...basePayee,
      is_active: false,
      notes: null,
      default_category_ids: []
    }
    renderWithQuery(<PayeeDrawer payee={payee} onClose={vi.fn()} />)
    
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.queryByText('Notes')).not.toBeInTheDocument()
    expect(screen.queryByText('Default categories')).not.toBeInTheDocument()
  })
})
