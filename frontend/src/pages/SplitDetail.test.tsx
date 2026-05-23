import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SplitDetail from './SplitDetail'
import { renderWithQuery } from '../test/render-utils'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: () => ({ splitId: 'split-1' }),
    useNavigate: () => vi.fn(),
  }
})

describe('SplitDetail', () => {
  it('renders split shares table', async () => {
    renderWithQuery(<SplitDetail />)
    expect(await screen.findByText('Split Detail')).toBeInTheDocument()
    expect((await screen.findAllByText(/300\.00/)).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText(/200\.00/)).length).toBeGreaterThanOrEqual(1)
  })

  it('shows pending status badges', async () => {
    renderWithQuery(<SplitDetail />)
    const badges = await screen.findAllByText('pending')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows net expense calculation', async () => {
    renderWithQuery(<SplitDetail />)
    expect(await screen.findByText(/Net expense/)).toBeInTheDocument()
  })
})
