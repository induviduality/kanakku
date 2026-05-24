import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import RecentlyDeleted from './RecentlyDeleted'
import { renderWithQuery } from '../test/render-utils'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a> }
})

describe('RecentlyDeleted page', () => {
  it('shows the page heading', async () => {
    renderWithQuery(<RecentlyDeleted />)
    await waitFor(() => expect(screen.getByText('Recently Deleted')).toBeInTheDocument())
  })

  it('renders all entity type tabs', async () => {
    renderWithQuery(<RecentlyDeleted />)
    await waitFor(() => expect(screen.getByRole('tab', { name: /accounts/i })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: /payees/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /transactions/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /budgets/i })).toBeInTheDocument()
  })

  it('shows deleted items in Accounts tab', async () => {
    renderWithQuery(<RecentlyDeleted />)
    await waitFor(() => expect(screen.getByText('Old Bank')).toBeInTheDocument())
  })

  it('shows a Restore button per item', async () => {
    renderWithQuery(<RecentlyDeleted />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: /restore/i }).length).toBeGreaterThan(0))
  })

  it('renders Payees tab with correct label', async () => {
    renderWithQuery(<RecentlyDeleted />)
    await waitFor(() => {
      const tab = screen.getByRole('tab', { name: /payees/i })
      expect(tab).toBeInTheDocument()
    })
  })

  it('shows item deletion date in the list', async () => {
    renderWithQuery(<RecentlyDeleted />)
    await waitFor(() => expect(screen.getAllByText(/deleted/i).length).toBeGreaterThan(1))
  })

  it('shows count badge on tabs that have items', async () => {
    renderWithQuery(<RecentlyDeleted />)
    await waitFor(() => {
      // Accounts tab should show a count badge "1"
      const accountsTab = screen.getByRole('tab', { name: /accounts/i })
      expect(accountsTab.textContent).toContain('1')
    })
  })
})
