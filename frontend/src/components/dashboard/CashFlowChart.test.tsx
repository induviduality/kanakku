import { screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CashFlowChart from './CashFlowChart'
import { renderWithQuery } from '../../test/render-utils'
import type { CashFlowAccountBucket } from '../../api/dashboard'

const mockData: CashFlowAccountBucket[] = [
  {
    date: '2026-05-01',
    account_name: 'HDFC Savings',
    balance: '50000.00',
    net: '12000.00',
  },
  {
    date: '2026-05-01',
    account_name: 'ICICI Credit',
    balance: '-1500.00',
    net: '-500.00',
  },
  {
    date: '2026-05-15',
    account_name: 'HDFC Savings',
    balance: '52000.00',
    net: '2000.00',
  },
  {
    date: '2026-05-15',
    account_name: 'ICICI Credit',
    balance: '-2000.00',
    net: '-500.00',
  },
]

describe('CashFlowChart', () => {
  it('shows empty state when no account buckets', () => {
    renderWithQuery(<CashFlowChart byAccount={[]} periodStart="2026-05-01" periodEnd="2026-05-31" />)
    expect(screen.getByText(/no transactions in this period/i)).toBeInTheDocument()
  })

  it('renders daily buckets correctly', () => {
    renderWithQuery(
      <CashFlowChart
        byAccount={mockData}
        periodStart="2026-05-01"
        periodEnd="2026-05-15"
      />
    )
    // 15 days is <= 31 days, so unit is 'day'
    expect(screen.getByText(/daily buckets/i)).toBeInTheDocument()
    expect(screen.getByText(/2 accounts/i)).toBeInTheDocument()
  })

  it('renders weekly buckets correctly', () => {
    renderWithQuery(
      <CashFlowChart
        byAccount={mockData}
        periodStart="2026-05-01"
        periodEnd="2026-06-15"
      />
    )
    // 45 days is > 31 and <= 91 days, so unit is 'week'
    expect(screen.getByText(/weekly buckets/i)).toBeInTheDocument()
  })

  it('renders monthly buckets correctly', () => {
    renderWithQuery(
      <CashFlowChart
        byAccount={mockData}
        periodStart="2026-01-01"
        periodEnd="2026-05-31"
      />
    )
    // 150 days is > 91 days, so unit is 'month'
    expect(screen.getByText(/monthly buckets/i)).toBeInTheDocument()
  })
})
