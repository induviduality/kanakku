import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import Categories from './Categories'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

describe('Categories page', () => {
  it('renders category list', async () => {
    renderWithQuery(<Categories />)
    // DataTable renders desktop + mobile views
    await waitFor(() => expect(screen.getAllByText('Food & Dining').length).toBeGreaterThan(0))
  })

  it('shows loading state initially', () => {
    renderWithQuery(<Categories />)
    expect(screen.getByText(/loading categories/i)).toBeInTheDocument()
  })

  it('opens create modal', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Categories />)
    await waitFor(() => screen.getByRole('button', { name: /add category/i }))
    await user.click(screen.getByRole('button', { name: /add category/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
  })

  it('creates a category', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Categories />)
    await waitFor(() => screen.getByRole('button', { name: /add category/i }))
    await user.click(screen.getByRole('button', { name: /add category/i }))
    await waitFor(() => screen.getByLabelText(/^name$/i))

    await user.type(screen.getByLabelText(/^name$/i), 'Healthcare')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows seed defaults button when no categories exist', async () => {
    server.use(http.get('/api/v1/categories', () => HttpResponse.json([])))
    renderWithQuery(<Categories />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /seed defaults/i })).toBeInTheDocument(),
    )
  })

  it('hides seed defaults button when categories exist', async () => {
    renderWithQuery(<Categories />)
    await waitFor(() => screen.getAllByText('Food & Dining').length > 0)
    expect(screen.queryByRole('button', { name: /seed defaults/i })).not.toBeInTheDocument()
  })

  it('deletes a category after confirm', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Categories />)
    await waitFor(() => screen.getAllByText('Food & Dining').length > 0)

    // Multiple Delete buttons — click first
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])
    await waitFor(() => screen.getByRole('dialog'))

    const confirmBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i })
    await user.click(confirmBtn)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('allows editing an existing category', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Categories />)
    await waitFor(() => screen.getAllByText('Food & Dining').length > 0)

    // Find and click the pencil edit button
    const editButtons = screen.getAllByTitle('Edit')
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /edit category/i })).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/^name$/i) as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'Gourmet Dining')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('triggers seed default categories', async () => {
    const user = userEvent.setup()
    server.use(http.get('/api/v1/categories', () => HttpResponse.json([])))
    renderWithQuery(<Categories />)

    const seedBtn = await screen.findByRole('button', { name: /seed defaults/i })
    await user.click(seedBtn)

    expect(seedBtn).toBeInTheDocument()
  })
})
