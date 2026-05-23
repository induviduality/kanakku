import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QueryEditor from './QueryEditor'

describe('QueryEditor', () => {
  it('renders the code editor container', () => {
    const { container } = render(<QueryEditor value="" onChange={() => {}} />)
    expect(container.querySelector('[aria-label="SQL editor"]')).toBeTruthy()
  })

  it('does not render run button when onRun not provided', () => {
    render(<QueryEditor value="SELECT 1" onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /run query/i })).not.toBeInTheDocument()
  })

  it('renders run button when onRun is provided', () => {
    render(<QueryEditor value="SELECT 1" onChange={() => {}} onRun={() => {}} />)
    expect(screen.getByRole('button', { name: /run query/i })).toBeInTheDocument()
  })

  it('run button is disabled when value is empty', () => {
    render(<QueryEditor value="" onChange={() => {}} onRun={() => {}} />)
    expect(screen.getByRole('button', { name: /run query/i })).toBeDisabled()
  })

  it('run button is enabled when value is non-empty', () => {
    render(<QueryEditor value="SELECT 1" onChange={() => {}} onRun={() => {}} />)
    expect(screen.getByRole('button', { name: /run query/i })).not.toBeDisabled()
  })

  it('calls onRun when run button is clicked', () => {
    const onRun = vi.fn()
    render(<QueryEditor value="SELECT 1" onChange={() => {}} onRun={onRun} />)
    fireEvent.click(screen.getByRole('button', { name: /run query/i }))
    expect(onRun).toHaveBeenCalledTimes(1)
  })
})
