import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithQuery } from '../../test/render-utils'
import SideNav from './SideNav'

let mockPathname = '/'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useRouterState: () => ({
      location: { pathname: mockPathname }
    }),
    Link: ({ children, to, className }: any) => (
      <a href={to} className={className}>{children}</a>
    )
  }
})

describe('SideNav component', () => {
  it('renders all navigation links', () => {
    mockPathname = '/'
    renderWithQuery(<SideNav />)
    
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /transactions/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /accounts/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /payees/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /budgets/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /savings goals/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /splits/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /import/i })).toBeInTheDocument()
  })

  it('marks Dashboard as active when on /', () => {
    mockPathname = '/'
    renderWithQuery(<SideNav />)
    
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
    expect(dashboardLink).toHaveClass('bg-accent/15')
    
    const transactionsLink = screen.getByRole('link', { name: /transactions/i })
    expect(transactionsLink).not.toHaveClass('bg-accent/15')
  })

  it('marks Transactions as active when on /transactions or a subroute', () => {
    mockPathname = '/transactions/new'
    renderWithQuery(<SideNav />)
    
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
    expect(dashboardLink).not.toHaveClass('bg-accent/15')
    
    const transactionsLink = screen.getByRole('link', { name: /transactions/i })
    expect(transactionsLink).toHaveClass('bg-accent/15')
  })
})
