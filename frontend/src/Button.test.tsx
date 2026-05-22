import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

test('clicking Open dialog button opens the dialog', async () => {
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText('Hello from Kanakku')).toBeInTheDocument()
})
