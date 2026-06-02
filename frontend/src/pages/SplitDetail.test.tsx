import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SplitDetail from './SplitDetail'
import { renderWithQuery } from '../test/render-utils'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: () => ({ splitId: 'split-dinner' }),
    useNavigate: () => vi.fn(),
  }
})

describe('SplitDetail', () => {
  it('renders split heading and shares table', async () => {
    renderWithQuery(<SplitDetail />)
    expect(await screen.findByText('Dinner at Taj')).toBeInTheDocument()
    // 4 shares × ₹900.00 each
    const amounts = await screen.findAllByText(/900/)
    expect(amounts.length).toBeGreaterThanOrEqual(1)
  })

  it('shows status badges', async () => {
    renderWithQuery(<SplitDetail />)
    // Priya's share is forgiven, others pending/partial
    expect(await screen.findByText('forgiven')).toBeInTheDocument()
    const pending = await screen.findAllByText('pending')
    expect(pending.length).toBeGreaterThanOrEqual(1)
  })

  it('shows net expense calculation', async () => {
    renderWithQuery(<SplitDetail />)
    expect(await screen.findByText(/Net expense/)).toBeInTheDocument()
  })

  it('shows linked payment for Rahul partial share', async () => {
    renderWithQuery(<SplitDetail />)
    expect(await screen.findByText(/Rahul.*partial|partial.*dinner/i)).toBeInTheDocument()
  })
})
