import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import Tags from './Tags'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

describe('Tags page', () => {
  it('renders tag list', async () => {
    renderWithQuery(<Tags />)
    // DataTable renders desktop + mobile views; use getAllByText
    await waitFor(() => expect(screen.getAllByText('weekend').length).toBeGreaterThan(0))
  })

  it('shows loading state initially', () => {
    renderWithQuery(<Tags />)
    expect(screen.getByText(/loading tags/i)).toBeInTheDocument()
  })

  it('opens create modal', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Tags />)
    await waitFor(() => screen.getByRole('button', { name: /add tag/i }))
    await user.click(screen.getByRole('button', { name: /add tag/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
  })

  it('creates a tag', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Tags />)
    await waitFor(() => screen.getByRole('button', { name: /add tag/i }))
    await user.click(screen.getByRole('button', { name: /add tag/i }))
    await waitFor(() => screen.getByLabelText(/^name$/i))

    await user.type(screen.getByLabelText(/^name$/i), 'work')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows error alert on duplicate tag name', async () => {
    server.use(
      http.post('/api/v1/tags', () =>
        HttpResponse.json({ detail: 'Tag name already exists' }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderWithQuery(<Tags />)
    await waitFor(() => screen.getByRole('button', { name: /add tag/i }))
    await user.click(screen.getByRole('button', { name: /add tag/i }))
    await waitFor(() => screen.getByLabelText(/^name$/i))

    await user.type(screen.getByLabelText(/^name$/i), 'weekend')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i))
  })

  it('shows empty state when no tags', async () => {
    server.use(http.get('/api/v1/tags', () => HttpResponse.json([])))
    renderWithQuery(<Tags />)
    await waitFor(() => expect(screen.getByText(/no tags yet/i)).toBeInTheDocument())
  })

  it('deletes a tag after confirm', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Tags />)
    await waitFor(() => screen.getAllByText('weekend').length > 0)

    // Multiple Delete buttons (desktop + mobile) — click the first
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])
    await waitFor(() => screen.getByRole('dialog'))

    const confirmBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i })
    await user.click(confirmBtn)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
