import { screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CategoryBreakdownChart from './CategoryBreakdownChart'
import { renderWithQuery } from '../../test/render-utils'

const items = [
  { category_id: 'c-1', name: 'Food & Dining', amount: '1000.00', percentage: 66.7 },
  { category_id: 'c-2', name: 'Transport', amount: '500.00', percentage: 33.3 },
]

describe('CategoryBreakdownChart', () => {
  it('shows empty state when no items', () => {
    renderWithQuery(<CategoryBreakdownChart items={[]} />)
    expect(screen.getByText(/no expenses this month/i)).toBeInTheDocument()
  })

  it('renders chart with aria-label when items present', () => {
    renderWithQuery(<CategoryBreakdownChart items={items} />)
    expect(screen.getByLabelText('category breakdown chart')).toBeInTheDocument()
  })
})
