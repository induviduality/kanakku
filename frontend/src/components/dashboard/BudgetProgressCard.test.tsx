import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import BudgetProgressCard from './BudgetProgressCard'
import { renderWithQuery } from '../../test/render-utils'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

const base = {
  id: 'b-1',
  name: 'Food Budget',
  amount: '5000.00',
  currency: 'INR',
  spent: '1500.00',
  percentage: 30,
  status: 'on_track' as const,
}

describe('BudgetProgressCard', () => {
  it('renders name', () => {
    renderWithQuery(<BudgetProgressCard budget={base} />)
    expect(screen.getByText('Food Budget')).toBeInTheDocument()
  })

  it('shows on_track badge', () => {
    renderWithQuery(<BudgetProgressCard budget={base} />)
    expect(screen.getByLabelText('budget status: on_track')).toHaveTextContent('On track')
  })

  it('shows warning badge', () => {
    renderWithQuery(<BudgetProgressCard budget={{ ...base, status: 'warning', percentage: 85 }} />)
    expect(screen.getByLabelText('budget status: warning')).toHaveTextContent('Warning')
  })

  it('shows over_budget badge', () => {
    renderWithQuery(<BudgetProgressCard budget={{ ...base, status: 'over_budget', percentage: 110 }} />)
    expect(screen.getByLabelText('budget status: over_budget')).toHaveTextContent('Over')
  })

  it('renders progress bar', () => {
    renderWithQuery(<BudgetProgressCard budget={base} />)
    expect(screen.getByLabelText('budget progress bar')).toBeInTheDocument()
  })
})
