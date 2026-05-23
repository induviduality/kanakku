import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SplitSharesEditor from './SplitSharesEditor'

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {ui}
    </QueryClientProvider>,
  )
}

describe('SplitSharesEditor', () => {
  it('renders balanced status when shares sum to total', () => {
    wrap(
      <SplitSharesEditor
        totalAmount={300}
        shares={[{ amount: '200.00' }, { amount: '100.00' }]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText(/Balanced/i)).toBeInTheDocument()
  })

  it('shows remaining when shares do not sum to total', () => {
    wrap(
      <SplitSharesEditor
        totalAmount={300}
        shares={[{ amount: '200.00' }]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText(/Remaining: 100\.00/)).toBeInTheDocument()
  })

  it('calls onChange when Add share is clicked', () => {
    const onChange = vi.fn()
    wrap(
      <SplitSharesEditor totalAmount={300} shares={[]} onChange={onChange} />,
    )
    fireEvent.click(screen.getByText('+ Add share'))
    expect(onChange).toHaveBeenCalledWith([{ payee_id: undefined, amount: '' }])
  })

  it('calls onChange when Remove is clicked', () => {
    const onChange = vi.fn()
    wrap(
      <SplitSharesEditor
        totalAmount={300}
        shares={[{ amount: '200.00' }]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByLabelText('Remove share 1'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('shows imbalance warning when shares present but not equal total', () => {
    wrap(
      <SplitSharesEditor
        totalAmount={300}
        shares={[{ amount: '100.00' }]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('Fill button sets amount to remaining', () => {
    const onChange = vi.fn()
    wrap(
      <SplitSharesEditor
        totalAmount={300}
        shares={[{ amount: '' }]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByLabelText('Fill remaining for share 1'))
    expect(onChange).toHaveBeenCalledWith([{ amount: '300.00' }])
  })
})
