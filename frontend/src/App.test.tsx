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
  // Router will redirect to login since not authenticated
  expect((await screen.findAllByText(/sign in/i)).length).toBeGreaterThan(0)
})
