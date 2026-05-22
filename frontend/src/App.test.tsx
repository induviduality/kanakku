import { render, screen } from '@testing-library/react'
import App from './App'

test('renders Kanakku heading', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Kanakku' })).toBeInTheDocument()
})
