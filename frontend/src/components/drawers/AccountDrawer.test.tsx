import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithQuery } from '../../test/render-utils'
import { AccountDrawer } from './AccountDrawer'
import { usePaymentMethods, usePatchAccount, type Account } from '../../api/accounts'

vi.mock('../../api/accounts', () => ({
  usePaymentMethods: vi.fn(),
  usePatchAccount: vi.fn(),
}))

const mockPatch = vi.fn()

describe('AccountDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePatchAccount).mockReturnValue({
      mutate: mockPatch,
      isPending: false,
    } as any)
  })

  const baseAccount: Account = {
    id: 'a1',
    user_id: 'u1',
    name: 'Chase Checking',
    type: 'bank',
    currency: 'USD',
    opening_balance: '1000.00',
    current_balance: '1500.50',
    is_active: true,
    is_system: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  it('renders nothing when account is null', () => {
    renderWithQuery(<AccountDrawer account={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders account details correctly', () => {
    vi.mocked(usePaymentMethods).mockReturnValue({
      isLoading: false,
      data: []
    } as any)

    renderWithQuery(<AccountDrawer account={baseAccount} onClose={vi.fn()} />)
    
    // Title is rendered twice (Dialog title and hero)
    expect(screen.getAllByText('Chase Checking').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bank').length).toBeGreaterThan(0)
    expect(screen.getByText('USD 1,500.50')).toBeInTheDocument()
    expect(screen.getByText('USD 1,000.00')).toBeInTheDocument() // opening balance
    expect(screen.getByText('No payment methods configured.')).toBeInTheDocument()
  })

  it('handles inactive account with negative balance', () => {
    vi.mocked(usePaymentMethods).mockReturnValue({
      isLoading: false,
      data: []
    } as any)

    const acc = { ...baseAccount, is_active: false, current_balance: '-500.00' }
    renderWithQuery(<AccountDrawer account={acc} onClose={vi.fn()} />)
    
    // Renders "Inactive" badge in hero
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0)
    // Absolute balance rendered
    expect(screen.getByText('USD 500.00')).toBeInTheDocument()
  })

  it('renders payment methods', () => {
    vi.mocked(usePaymentMethods).mockReturnValue({
      isLoading: false,
      data: [
        { id: 'pm1', account_id: 'a1', name: 'Debit', type: 'debit_card', is_active: true, created_at: '', updated_at: '' },
        { id: 'pm2', account_id: 'a1', name: 'UPI', type: 'upi', is_active: false, created_at: '', updated_at: '' },
      ]
    } as any)

    renderWithQuery(<AccountDrawer account={baseAccount} onClose={vi.fn()} />)
    
    expect(screen.getByText('Debit')).toBeInTheDocument()
    expect(screen.getByText('Debit card')).toBeInTheDocument()
    expect(screen.getAllByText('UPI').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0)
  })

  it('handles toggling active status', async () => {
    const user = userEvent.setup()
    vi.mocked(usePaymentMethods).mockReturnValue({
      isLoading: false,
      data: []
    } as any)

    renderWithQuery(<AccountDrawer account={baseAccount} onClose={vi.fn()} />)
    
    // It's rendered as "Active" button in the DrawerRow
    const activeBtn = screen.getByRole('button', { name: 'Active' })
    await user.click(activeBtn)
    
    expect(mockPatch).toHaveBeenCalledWith({
      id: 'a1',
      patch: { is_active: false }
    })
  })
})
