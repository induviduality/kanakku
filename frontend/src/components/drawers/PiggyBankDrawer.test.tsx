import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithQuery } from '../../test/render-utils'
import { PiggyBankDrawer } from './PiggyBankDrawer'
import { useGetPiggyBank, useGetContributions, useRemoveContribution } from '../../api/piggy_banks'

vi.mock('../../api/piggy_banks', () => ({
  useGetPiggyBank: vi.fn(),
  useGetContributions: vi.fn(),
  useRemoveContribution: vi.fn(),
}))

const mockRemove = vi.fn()

describe('PiggyBankDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRemoveContribution).mockReturnValue({
      mutate: mockRemove,
    } as any)
  })

  it('renders loading state initially', () => {
    vi.mocked(useGetPiggyBank).mockReturnValue({ isLoading: true, data: undefined } as any)
    vi.mocked(useGetContributions).mockReturnValue({ isLoading: true, data: undefined } as any)

    renderWithQuery(<PiggyBankDrawer piggyId="p1" onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // It should just not blow up
  })

  it('renders not found when data is null', () => {
    vi.mocked(useGetPiggyBank).mockReturnValue({ isLoading: false, data: null } as any)
    vi.mocked(useGetContributions).mockReturnValue({ isLoading: false, data: [] } as any)

    renderWithQuery(<PiggyBankDrawer piggyId="p1" onClose={vi.fn()} />)
    expect(screen.getByText('Savings goal not found.')).toBeInTheDocument()
  })

  it('renders piggy bank details and contributions', () => {
    vi.mocked(useGetPiggyBank).mockReturnValue({
      isLoading: false,
      data: {
        id: 'p1',
        name: 'New Car',
        target_amount: '10000',
        current_amount: '2000',
        currency: 'INR',
        progress_pct: 20,
        is_completed: false,
        target_date: '2026-12-31',
        notes: 'Saving for a car',
      }
    } as any)

    vi.mocked(useGetContributions).mockReturnValue({
      isLoading: false,
      data: [
        { id: 'c1', amount: '500', contribution_type: 'deposit', date: '2026-05-01' },
        { id: 'c2', amount: '1500', contribution_type: 'deposit', date: '2026-05-15' },
      ]
    } as any)

    renderWithQuery(<PiggyBankDrawer piggyId="p1" onClose={vi.fn()} />)
    
    expect(screen.getAllByText('New Car')[0]).toBeInTheDocument()
    expect(screen.getByText(/20%/)).toBeInTheDocument()
    expect(screen.getByText('Target date')).toBeInTheDocument()
    expect(screen.getByText('2026-12-31')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Saving for a car')).toBeInTheDocument()
    
    // Check contributions
    expect(screen.getByText('Contributions (2)')).toBeInTheDocument()
    // 500 deposit
    expect(screen.getByText('₹500')).toBeInTheDocument()
  })

  it('handles removing a contribution', async () => {
    const user = userEvent.setup()
    
    vi.mocked(useGetPiggyBank).mockReturnValue({
      isLoading: false,
      data: {
        id: 'p1',
        name: 'New Car',
        target_amount: '10000',
        current_amount: '2000',
        currency: 'INR',
        progress_pct: 20,
        is_completed: false,
      }
    } as any)

    vi.mocked(useGetContributions).mockReturnValue({
      isLoading: false,
      data: [
        { id: 'c1', amount: '500', contribution_type: 'deposit', date: '2026-05-01' },
      ]
    } as any)

    renderWithQuery(<PiggyBankDrawer piggyId="p1" onClose={vi.fn()} />)
    
    const removeBtn = screen.getByRole('button', { name: 'Remove' })
    await user.click(removeBtn)
    
    // Confirm dialog should appear
    const confirmBtn = await screen.findByRole('button', { name: 'Remove' })
    // Ensure we are clicking the one in the dialog
    // Actually the drawer has a close button, so getByRole 'button', { name: 'Remove' } might match both? 
    // Drawer doesn't have a button named Remove.
    
    // We can use screen.getByRole('dialog', { name: /Remove contribution/i })
    const dialog = screen.getByRole('dialog', { name: /Remove contribution/i })
    const confirmInDialog = within(dialog).getByRole('button', { name: 'Remove' })
    await user.click(confirmInDialog)
    
    expect(mockRemove).toHaveBeenCalledWith(
      { piggyId: 'p1', contribId: 'c1' },
      expect.any(Object)
    )
  })

  it('cancels removing a contribution', async () => {
    const user = userEvent.setup()
    
    vi.mocked(useGetPiggyBank).mockReturnValue({
      isLoading: false,
      data: {
        id: 'p1',
        name: 'New Car',
        target_amount: '10000',
        current_amount: '2000',
        currency: 'INR',
        progress_pct: 20,
      }
    } as any)

    vi.mocked(useGetContributions).mockReturnValue({
      isLoading: false,
      data: [
        { id: 'c1', amount: '500', contribution_type: 'deposit', date: '2026-05-01' },
      ]
    } as any)

    renderWithQuery(<PiggyBankDrawer piggyId="p1" onClose={vi.fn()} />)
    
    const removeBtn = screen.getByRole('button', { name: 'Remove' })
    await user.click(removeBtn)
    
    const dialog = screen.getByRole('dialog', { name: /Remove contribution/i })
    const cancelBtn = within(dialog).getByRole('button', { name: 'Cancel' })
    await user.click(cancelBtn)
    
    expect(mockRemove).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: /Remove contribution/i })).not.toBeInTheDocument()
  })
})
