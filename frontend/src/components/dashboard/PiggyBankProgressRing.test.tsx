import { screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PiggyBankProgressRing from './PiggyBankProgressRing'
import { renderWithQuery } from '../../test/render-utils'

const base = {
  id: 'p-1',
  name: 'Europe Trip',
  target_amount: '200000.00',
  current_amount: '60000.00',
  currency: 'INR',
  progress_pct: 30,
  is_completed: false,
}

describe('PiggyBankProgressRing', () => {
  it('renders name', () => {
    renderWithQuery(<PiggyBankProgressRing piggyBank={base} />)
    expect(screen.getByText('Europe Trip')).toBeInTheDocument()
  })

  it('shows correct progress aria-label', () => {
    renderWithQuery(<PiggyBankProgressRing piggyBank={base} />)
    expect(screen.getByLabelText('30% progress')).toBeInTheDocument()
  })

  it('shows completed label when is_completed', () => {
    renderWithQuery(
      <PiggyBankProgressRing piggyBank={{ ...base, progress_pct: 100, is_completed: true }} />,
    )
    expect(screen.getByText(/Completed/)).toBeInTheDocument()
  })

  it('caps progress at 100% for aria-label', () => {
    renderWithQuery(
      <PiggyBankProgressRing piggyBank={{ ...base, progress_pct: 150 }} />,
    )
    expect(screen.getByLabelText('100% progress')).toBeInTheDocument()
  })
})
