import { screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SubscriptionStatusBadge from './SubscriptionStatusBadge'
import { renderWithQuery } from '../../test/render-utils'

const base = {
  id: 's-1',
  name: 'Netflix',
  amount: '649.00',
  currency: 'INR',
  status: 'upcoming' as const,
  next_billing_date: '2026-06-15',
}

describe('SubscriptionStatusBadge', () => {
  it('upcoming renders green', () => {
    renderWithQuery(<SubscriptionStatusBadge subscription={base} />)
    const badge = screen.getByLabelText('status: upcoming')
    expect(badge).toHaveClass('bg-green-100')
    expect(badge).toHaveClass('text-green-800')
  })

  it('due_soon renders amber', () => {
    renderWithQuery(<SubscriptionStatusBadge subscription={{ ...base, status: 'due_soon' }} />)
    const badge = screen.getByLabelText('status: due_soon')
    expect(badge).toHaveClass('bg-amber-100')
    expect(badge).toHaveClass('text-amber-800')
  })

  it('overdue renders red', () => {
    renderWithQuery(<SubscriptionStatusBadge subscription={{ ...base, status: 'overdue' }} />)
    const badge = screen.getByLabelText('status: overdue')
    expect(badge).toHaveClass('bg-red-100')
    expect(badge).toHaveClass('text-red-800')
  })
})
