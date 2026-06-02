import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

vi.mock('@number-flow/react', () => {
  return {
    default: ({ value }: any) => value,
    NumberFlow: ({ value }: any) => value,
  }
})