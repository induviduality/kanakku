import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import SubscriptionForm from './SubscriptionForm'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useParams: () => ({ subId: undefined }),
    useNavigate: () => mockNavigate,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

describe('SubscriptionForm page (create mode)', () => {
  it('renders form fields', () => {
    renderWithQuery(<SubscriptionForm />)
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/billing cycle/i)).toBeInTheDocument()
  })

  it('submits and navigates away', async () => {
    const user = userEvent.setup()
    let posted = false
    server.use(
      http.post('/api/v1/subscriptions', async () => {
        posted = true
        return HttpResponse.json(
          {
            id: 'sub-new',
            user_id: 'user-1',
            name: 'Disney+',
            amount: '199.00',
            currency: 'INR',
            billing_cycle: 'monthly',
            billing_day: 1,
            last_billed_at: null,
            account_id: 'acc-1',
            payment_method_id: null,
            category_id: null,
            is_active: true,
            url: null,
            notes: null,
            next_billing_date: '2026-06-01',
            status: 'upcoming',
            created_at: '2026-05-23T00:00:00Z',
            updated_at: '2026-05-23T00:00:00Z',
            deleted_at: null,
          },
          { status: 201 },
        )
      }),
    )
    renderWithQuery(<SubscriptionForm />)
    await user.type(screen.getByLabelText(/^name$/i), 'Disney+')
    await user.type(screen.getByLabelText(/amount/i), '199')
    await user.selectOptions(screen.getByLabelText(/account/i), 'acc-1')
    await user.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => expect(posted).toBe(true))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
  })
})

describe('SubscriptionForm page (edit mode)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('pre-fills fields from existing subscription', async () => {
    vi.doMock('@tanstack/react-router', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@tanstack/react-router')>()
      return {
        ...actual,
        useParams: () => ({ subId: 'sub-1' }),
        useNavigate: () => mockNavigate,
        Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
          <a href={to}>{children}</a>
        ),
      }
    })
    const { default: SubscriptionFormEdit } = await import('./SubscriptionForm')
    renderWithQuery(<SubscriptionFormEdit />)
    await waitFor(() =>
      expect((screen.getByLabelText(/^name$/i) as HTMLInputElement).value).toBe('Netflix'),
    )
  })
})
