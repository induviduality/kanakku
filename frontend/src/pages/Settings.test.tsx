import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import Settings from './Settings'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'
import { SETTINGS_RESPONSE } from '../test/handlers'

describe('Settings page', () => {
  it('renders settings form after loading', async () => {
    renderWithQuery(<Settings />)
    await waitFor(() => expect(screen.getByLabelText(/primary currency/i)).toBeInTheDocument())
    expect(screen.getByDisplayValue('INR')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Asia/Kolkata')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    renderWithQuery(<Settings />)
    expect(screen.getByText(/loading settings/i)).toBeInTheDocument()
  })

  it('shows error when fetch fails', async () => {
    server.use(
      http.get('/api/v1/settings', () =>
        HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 }),
      ),
    )
    renderWithQuery(<Settings />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('saves settings when form is submitted', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Settings />)

    await waitFor(() => expect(screen.getByLabelText(/primary currency/i)).toBeInTheDocument())

    const currencySelect = screen.getByLabelText(/primary currency/i)
    await user.selectOptions(currencySelect, 'USD')

    await user.click(screen.getByRole('button', { name: /save settings/i }))

    await waitFor(() =>
      expect(screen.getByText(/saved!/i)).toBeInTheDocument(),
    )
  })

  it('renders all four setting fields', async () => {
    renderWithQuery(<Settings />)
    await waitFor(() => expect(screen.getByLabelText(/primary currency/i)).toBeInTheDocument())
    expect(screen.getByLabelText(/timezone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/date format/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/number format/i)).toBeInTheDocument()
  })
})

// keep unused import satisfied
void SETTINGS_RESPONSE
