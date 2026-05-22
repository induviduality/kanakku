import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

test('renders without crashing', async () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
  // Router eventually renders the index route placeholder
  expect(await screen.findByText(/dashboard/i)).toBeInTheDocument()
})
