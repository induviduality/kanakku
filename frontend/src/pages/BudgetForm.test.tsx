import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import BudgetFormPage from './BudgetForm'
import { renderWithQuery } from '../test/render-utils'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}), // no budgetId → create mode
    useSearch: () => ({}),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

describe('BudgetForm page — create mode', () => {
  it('renders form fields', () => {
    renderWithQuery(<BudgetFormPage />)
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument()
  })

  it('shows rrule field when recurring is selected', async () => {
    const user = userEvent.setup()
    renderWithQuery(<BudgetFormPage />)

    await user.click(screen.getByRole('radio', { name: /recurring/i }))
    await waitFor(() =>
      expect(screen.getByLabelText(/recurrence rule/i)).toBeInTheDocument(),
    )
  })

  it('hides rrule field for adhoc type', () => {
    renderWithQuery(<BudgetFormPage />)
    expect(screen.queryByLabelText(/recurrence rule/i)).not.toBeInTheDocument()
  })

  it('submits create form and navigates to /budgets', async () => {
    const user = userEvent.setup()
    renderWithQuery(<BudgetFormPage />)

    await user.type(screen.getByLabelText(/^name$/i), 'Holiday fund')
    await user.clear(screen.getByLabelText(/amount/i))
    await user.type(screen.getByLabelText(/amount/i), '20000')
    await user.click(screen.getByRole('button', { name: /create budget/i }))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/budgets' }),
    )
  })
})
