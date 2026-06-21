import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/server'
import { renderWithQuery } from '../test/render-utils'
import { TransactionPicker } from './TransactionPicker'
import { TRANSACTIONS_RESPONSE } from '../test/handlers'

// Helper: only income items from the fixture
const incomeItems = TRANSACTIONS_RESPONSE.items.filter((t) => t.type === 'income')

function makeResponse(items: typeof TRANSACTIONS_RESPONSE.items) {
  return { ...TRANSACTIONS_RESPONSE, items, total: items.length }
}

describe('TransactionPicker', () => {
  it('renders the search input', () => {
    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    expect(screen.getByPlaceholderText('Search transactions…')).toBeInTheDocument()
  })

  it('shows "Showing last 3 months" label with no search', async () => {
    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('Showing last 3 months')).toBeInTheDocument()
    })
  })

  it('renders income transactions from the tier-1 pool', async () => {
    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('May salary')).toBeInTheDocument()
    })
  })

  it('filters client-side when user types a matching term', async () => {
    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    await waitFor(() => screen.getByText('May salary'))

    await userEvent.type(screen.getByPlaceholderText('Search transactions…'), 'salary')

    await waitFor(() => {
      expect(screen.getByText('May salary')).toBeInTheDocument()
      // settlement transactions should be hidden by the client filter
      expect(screen.queryByText("Rahul's partial – dinner")).not.toBeInTheDocument()
    })
  })

  it('hides excluded ids', async () => {
    renderWithQuery(
      <TransactionPicker
        type="income"
        value=""
        onChange={vi.fn()}
        excludeIds={['txn-may-salary']}
      />,
    )
    await waitFor(() => screen.getByText("Rahul's partial – dinner"))
    expect(screen.queryByText('May salary')).not.toBeInTheDocument()
  })

  it('auto-triggers tier-2 when no client match found', async () => {
    // Override: tier-1 (3-month pool) returns no income; tier-2 (1-year) returns one
    server.use(
      http.get('/api/v1/transactions', ({ request }) => {
        const url = new URL(request.url)
        const from = url.searchParams.get('from')
        const q = url.searchParams.get('q')
        // Tier-1 call: has from, no q — return empty
        if (from && !q) return HttpResponse.json(makeResponse([]))
        // Tier-2 call: has both from and q — return one result
        if (from && q)
          return HttpResponse.json(
            makeResponse([{ ...incomeItems[0], description: 'Old salary from last year', id: 'txn-old' }]),
          )
        return HttpResponse.json(makeResponse([]))
      }),
    )

    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    await waitFor(() => screen.getByText('Showing last 3 months'))

    await userEvent.type(screen.getByPlaceholderText('Search transactions…'), 'old salary')

    await waitFor(() => {
      expect(screen.getByText('Results from the last year')).toBeInTheDocument()
      expect(screen.getByText('Old salary from last year')).toBeInTheDocument()
    })
  })

  it('shows "Search all transactions" button when tier-2 also empty', async () => {
    server.use(
      http.get('/api/v1/transactions', ({ request }) => {
        const url = new URL(request.url)
        const from = url.searchParams.get('from')
        const q = url.searchParams.get('q')
        if (!q) return HttpResponse.json(makeResponse([]))
        // Both tier-1 and tier-2 return nothing
        return HttpResponse.json(makeResponse([]))
      }),
    )

    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )

    await userEvent.type(screen.getByPlaceholderText('Search transactions…'), 'nothing')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /search all transactions/i })).toBeInTheDocument()
    })
  })

  it('shows tier-3 all-time results after clicking "Search all transactions"', async () => {
    server.use(
      http.get('/api/v1/transactions', ({ request }) => {
        const url = new URL(request.url)
        const from = url.searchParams.get('from')
        const q = url.searchParams.get('q')
        // No date filter + q present = tier-3 call
        if (!from && q)
          return HttpResponse.json(
            makeResponse([{ ...incomeItems[0], description: 'Very old payment', id: 'txn-ancient' }]),
          )
        return HttpResponse.json(makeResponse([]))
      }),
    )

    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    await userEvent.type(screen.getByPlaceholderText('Search transactions…'), 'old')
    await waitFor(() =>
      screen.getByRole('button', { name: /search all transactions/i }),
    )
    await userEvent.click(screen.getByRole('button', { name: /search all transactions/i }))

    await waitFor(() => {
      expect(screen.getByText(/all-time results/i)).toBeInTheDocument()
      expect(screen.getByText('Very old payment')).toBeInTheDocument()
    })
  })

  it('calls onChange with the id when a row is clicked (single-select)', async () => {
    const onChange = vi.fn()
    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={onChange} />,
    )
    await waitFor(() => screen.getByText('May salary'))
    await userEvent.click(screen.getByText('May salary'))
    expect(onChange).toHaveBeenCalledWith('txn-may-salary')
  })

  it('toggles ids in the array when rows clicked (multi-select)', async () => {
    const onChange = vi.fn()
    renderWithQuery(
      <TransactionPicker type="income" multiple value={[]} onChange={onChange} />,
    )
    await waitFor(() => screen.getByText('May salary'))
    await userEvent.click(screen.getByText('May salary'))
    expect(onChange).toHaveBeenCalledWith(['txn-may-salary'])
  })

  it('un-selects an id when clicked again (multi-select)', async () => {
    const onChange = vi.fn()
    renderWithQuery(
      <TransactionPicker
        type="income"
        multiple
        value={['txn-may-salary']}
        onChange={onChange}
      />,
    )
    await waitFor(() => screen.getByText('May salary'))
    await userEvent.click(screen.getByText('May salary'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('resets to tier-1 when query is cleared', async () => {
    server.use(
      http.get('/api/v1/transactions', ({ request }) => {
        const url = new URL(request.url)
        const from = url.searchParams.get('from')
        const q = url.searchParams.get('q')
        if (!q && from) return HttpResponse.json(makeResponse([{ ...incomeItems[0], description: 'May salary' }]))
        return HttpResponse.json(makeResponse([]))
      }),
    )
    renderWithQuery(<TransactionPicker type="income" value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search transactions…')

    await userEvent.type(input, 'xyz')
    await waitFor(() => screen.getByRole('button', { name: /search all transactions/i }))

    await userEvent.clear(input)
    await waitFor(() => {
      expect(screen.getByText('Showing last 3 months')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /search all transactions/i })).not.toBeInTheDocument()
    })
  })
})
