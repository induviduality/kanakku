import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { PasswordInput } from './PasswordInput'

describe('PasswordInput component', () => {
  it('renders input with type password and toggles visibility on button click', async () => {
    const user = userEvent.setup()
    render(<PasswordInput placeholder="Enter password" />)

    const input = screen.getByPlaceholderText('Enter password')
    expect(input).toHaveAttribute('type', 'password')

    const toggleButton = screen.getByRole('button', { name: /show password/i })
    expect(toggleButton).toBeInTheDocument()

    await user.click(toggleButton)
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(input).toHaveAttribute('type', 'password')
  })
})
