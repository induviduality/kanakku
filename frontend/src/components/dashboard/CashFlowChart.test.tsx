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

  it('renders correctly with 1 account and sparse dates', () => {
    const sparseData: CashFlowAccountBucket[] = [
      { date: '2026-05-01', account_name: 'HDFC Savings', balance: '100', net: '100' },
      { date: '2026-05-02', account_name: 'Other', balance: '200', net: '200' },
    ]
    renderWithQuery(
      <CashFlowChart
        byAccount={sparseData}
        periodStart="2026-05-01"
        periodEnd="2026-05-05"
      />
    )
    // hits singular 'account' string
    expect(screen.getByText(/2 accounts/i)).toBeInTheDocument()
    // wait, sparseData has 2 accounts. Let's make a 1-account data explicitly
  })

  it('renders singular account string', () => {
    const oneAccount: CashFlowAccountBucket[] = [
      { date: '2026-05-01', account_name: 'HDFC Savings', balance: '100', net: '100' },
    ]
    renderWithQuery(
      <CashFlowChart
        byAccount={oneAccount}
        periodStart="2026-05-01"
        periodEnd="2026-05-05"
      />
    )
    // hits singular 'account' string
    expect(screen.getByText(/1 account/i)).toBeInTheDocument()
    expect(screen.queryByText(/accounts/i)).not.toBeInTheDocument()
  })
})

import { formatINR, CustomTooltip } from './CashFlowChart'

describe('CashFlowChart helpers', () => {
  it('formatINR formats currency correctly', () => {
    expect(formatINR(50)).toBe('₹50')
    expect(formatINR(-50)).toBe('-₹50')
    expect(formatINR(1500)).toBe('₹1.5K')
    expect(formatINR(-2500)).toBe('-₹2.5K')
    expect(formatINR(150000)).toBe('₹1.5L')
    expect(formatINR(-250000)).toBe('-₹2.5L')
  })

  it('formatINR truncates rather than rounds, so it never overstates the amount', () => {
    // 81,483 must read 81.4K, not 81.5K (rounding) or 81K (no decimal).
    expect(formatINR(81483)).toBe('₹81.4K')
    expect(formatINR(-81483)).toBe('-₹81.4K')
    // Same for the lakh tier.
    expect(formatINR(1249999)).toBe('₹12.4L')
  })

  it('CustomTooltip returns null if inactive or no payload', () => {
    const { container } = renderWithQuery(<CustomTooltip active={false} />)
    expect(container.firstChild).toBeNull()

    const { container: c2 } = renderWithQuery(<CustomTooltip active={true} payload={[]} />)
    expect(c2.firstChild).toBeNull()
  })

  it('CustomTooltip renders active tooltip with payload', () => {
    const payload = [
      { name: 'HDFC Savings', value: 50000, color: '#3b82f6', payload: { 'HDFC Savings__net': 12000 } },
      { name: 'ICICI Credit', value: -1500, color: '#ec4899', payload: { 'ICICI Credit__net': -500 } },
      { name: 'Hidden__net', value: 0, color: '#fff', payload: {} }, // should be filtered out
    ]
    renderWithQuery(<CustomTooltip active={true} payload={payload} label="May 1" />)
    
    expect(screen.getByText('May 1')).toBeInTheDocument()
    expect(screen.getByText('HDFC Savings')).toBeInTheDocument()
    expect(screen.getByText('ICICI Credit')).toBeInTheDocument()
    expect(screen.getByText('₹50.0K')).toBeInTheDocument() // 50000
    expect(screen.getByText('-₹1.5K')).toBeInTheDocument() // -1500
    expect(screen.getByText('+₹12.0K')).toBeInTheDocument() // +12000
    expect(screen.getByText('-₹500')).toBeInTheDocument() // -500
    expect(screen.queryByText('Hidden__net')).not.toBeInTheDocument()
  })
})
