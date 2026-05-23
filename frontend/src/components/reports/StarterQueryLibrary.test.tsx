import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StarterQueryLibrary from './StarterQueryLibrary'

describe('StarterQueryLibrary', () => {
  it('renders 6 starter queries', () => {
    render(<StarterQueryLibrary onSelect={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(6)
  })

  it('renders spending by category query', () => {
    render(<StarterQueryLibrary onSelect={() => {}} />)
    expect(screen.getByText(/spending by category/i)).toBeInTheDocument()
  })

  it('renders income vs expenses query', () => {
    render(<StarterQueryLibrary onSelect={() => {}} />)
    expect(screen.getByText(/income vs expenses/i)).toBeInTheDocument()
  })

  it('calls onSelect with SQL when query is clicked', () => {
    const spy = vi.fn()
    render(<StarterQueryLibrary onSelect={spy} />)
    fireEvent.click(screen.getByText(/spending by category/i))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toContain('user_id')
  })

  it('renders account balance history query', () => {
    render(<StarterQueryLibrary onSelect={() => {}} />)
    expect(screen.getByText(/account balance history/i)).toBeInTheDocument()
  })
})
