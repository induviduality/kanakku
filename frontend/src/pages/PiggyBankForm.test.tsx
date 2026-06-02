import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PiggyBankFormPage from './PiggyBankForm'
import { renderWithQuery } from '../test/render-utils'

const mockNavigate = vi.fn()
let mockPiggyId: string | undefined = undefined

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ piggyId: mockPiggyId }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

describe('PiggyBankFormPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockPiggyId = undefined
  })

  it('renders new form when no piggyId', () => {
    renderWithQuery(<PiggyBankFormPage />)
    expect(screen.getByRole('heading', { name: /new savings goal/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })

  it('creates a new piggy bank', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PiggyBankFormPage />)

    await user.type(screen.getByLabelText(/^name$/i), 'Macbook Fund')
    await user.type(screen.getByLabelText(/target amount/i), '150000')
    await user.clear(screen.getByLabelText(/currency/i))
    await user.type(screen.getByLabelText(/currency/i), 'INR')

    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/piggy-banks/pig-new' })
    })
  })

  it('renders edit form and populates data for existing piggy bank', async () => {
    mockPiggyId = 'pig-1'
    renderWithQuery(<PiggyBankFormPage />)

    expect(screen.getByRole('heading', { name: /edit savings goal/i })).toBeInTheDocument()
    
    // wait for data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/^name$/i)).toHaveValue('Europe Trip')
    })
    expect(screen.getByLabelText(/target amount/i)).toHaveValue(200000)
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('updates an existing piggy bank', async () => {
    mockPiggyId = 'pig-1'
    const user = userEvent.setup()
    renderWithQuery(<PiggyBankFormPage />)

    await waitFor(() => {
      expect(screen.getByLabelText(/^name$/i)).toHaveValue('Europe Trip')
    })

    const nameInput = screen.getByLabelText(/^name$/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Europe Trip 2027')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/piggy-banks/pig-1' })
    })
  })
})
