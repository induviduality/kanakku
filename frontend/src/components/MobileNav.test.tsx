import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MobileNav from './MobileNav'

const mockPathname = vi.fn(() => '/')

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
      <a href={to} {...props}>{children}</a>
    ),
    useRouterState: () => ({ location: { pathname: mockPathname() } }),
  }
})

describe('MobileNav', () => {
  it('renders primary nav tabs', () => {
    mockPathname.mockReturnValue('/')
    render(<MobileNav />)
    expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeDefined()
    expect(screen.getByLabelText('Dashboard')).toBeDefined()
    expect(screen.getByLabelText('Transactions')).toBeDefined()
    expect(screen.getByLabelText('Budgets')).toBeDefined()
    expect(screen.getByLabelText('Add transaction')).toBeDefined()
    expect(screen.getByLabelText('More navigation options')).toBeDefined()
  })

  it('highlights active Dashboard tab at /', () => {
    mockPathname.mockReturnValue('/')
    render(<MobileNav />)
    const link = screen.getByLabelText('Dashboard')
    expect((link as HTMLElement).className).toContain('violet')
  })

  it('highlights active Transactions tab', () => {
    mockPathname.mockReturnValue('/transactions')
    render(<MobileNav />)
    const link = screen.getByLabelText('Transactions')
    expect((link as HTMLElement).className).toContain('violet')
  })

  it('opens More sheet when More button is clicked', () => {
    mockPathname.mockReturnValue('/')
    render(<MobileNav />)
    fireEvent.click(screen.getByLabelText('More navigation options'))
    expect(screen.getByLabelText('More links')).toBeDefined()
    expect(screen.getByText('Settings')).toBeDefined()
    expect(screen.getByText('Accounts')).toBeDefined()
  })

  it('closes More sheet after a link click', () => {
    mockPathname.mockReturnValue('/')
    render(<MobileNav />)
    fireEvent.click(screen.getByLabelText('More navigation options'))
    fireEvent.click(screen.getByText('Settings'))
    expect(screen.queryByLabelText('More links')).toBeNull()
  })
})
