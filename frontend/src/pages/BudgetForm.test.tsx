import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import BudgetFormPage from './BudgetForm'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

let mockBudgetId: string | undefined = undefined
const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useParams: () => ({ budgetId: mockBudgetId }),
    useNavigate: () => mockNavigate,
  }
})

describe('BudgetFormPage', () => {
  beforeEach(() => {
    mockBudgetId = undefined
    mockNavigate.mockClear()
  })

  it('renders a form for new budget creation', async () => {
    renderWithQuery(<BudgetFormPage />)

    expect(screen.getByRole('heading', { name: /new budget/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create budget/i })).toBeInTheDocument()
  })

  it('allows creating a new ad-hoc budget', async () => {
    const user = userEvent.setup()
    renderWithQuery(<BudgetFormPage />)

    await user.type(screen.getByLabelText(/name/i), 'Holiday Fund')
    await user.type(screen.getByLabelText(/amount/i), '15000')
    
    // Choose Category
    // We expect the MSW handler to return categories, wait for it to load
    await waitFor(() => {
      expect(screen.getByText('Food & Dining')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Food & Dining'))

    await user.click(screen.getByRole('button', { name: /create budget/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/budgets' })
    })
  })

  it('allows creating a new recurring budget', async () => {
    const user = userEvent.setup()
    renderWithQuery(<BudgetFormPage />)

    await user.type(screen.getByLabelText(/name/i), 'Electricity Bill')
    await user.type(screen.getByLabelText(/amount/i), '3500')
    
    // Select recurring radio button
    const recurringRadio = screen.getByLabelText('Recurring')
    await user.click(recurringRadio)

    // Recurrence select dropdown should now be visible
    expect(screen.getByLabelText(/recurrence/i)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/recurrence/i), 'FREQ=MONTHLY')

    await user.click(screen.getByRole('button', { name: /create budget/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/budgets' })
    })
  })

  it('populates fields for editing and submits changes', async () => {
    mockBudgetId = 'budget-1' // Mocking budget ID to simulate edit route
    const user = userEvent.setup()
    renderWithQuery(<BudgetFormPage />)

    // Wait for the edit title and existing name to render
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /edit budget/i })).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement
    await waitFor(() => expect(nameInput.value).toBe('Monthly Groceries'))

    // Update name
    await user.clear(nameInput)
    await user.type(nameInput, 'Monthly Supermarkets')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // Editing a recurring budget should open ScopeDialog
    expect(screen.getByRole('heading', { name: /edit recurring budget/i })).toBeInTheDocument()
    
    // Confirm in scope dialog
    const saveScopeButton = screen.getByRole('button', { name: 'Save' })
    await user.click(saveScopeButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/budgets' })
    })
  })

  it('shows error message if API fails', async () => {
    server.use(
      http.post('/api/v1/budgets', () => {
        return new HttpResponse(null, { status: 500 })
      })
    )

    const user = userEvent.setup()
    renderWithQuery(<BudgetFormPage />)

    await user.type(screen.getByLabelText(/name/i), 'Failing Budget')
    await user.type(screen.getByLabelText(/amount/i), '100')
    await user.click(screen.getByRole('button', { name: /create budget/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to create budget/i)
    })
  })
})
