import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

  it('can unlink a settlement', async () => {
    renderWithQuery(<SplitDetail />)
    await screen.findByText('Dinner at Taj')
    const unlinkBtns = await screen.findAllByText('×')
    expect(unlinkBtns.length).toBeGreaterThan(0)
    fireEvent.click(unlinkBtns[0])
    expect(unlinkBtns[0]).toBeInTheDocument()
  })

  it('can open + Payment modal and submit', async () => {
    renderWithQuery(<SplitDetail />)
    await screen.findByText('Dinner at Taj')
    
    // Rahul has a pending share. We find the + Payment buttons
    const paymentBtns = await screen.findAllByText('+ Payment')
    fireEvent.click(paymentBtns[0])
    
    // Modal opens
    const heading = await screen.findByRole('heading', { name: /Link payment/i })
    expect(heading).toBeInTheDocument()
    
    // Select transaction (it should show income transactions)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'txn-settle-dinner-rahul' } })
    
    // Confirm button should become enabled
    const confirmBtn = screen.getByRole('button', { name: /Confirm/i })
    expect(confirmBtn).toBeEnabled()
    
    // Submit
    fireEvent.click(confirmBtn)
  })

  it('can open Forgive modal and submit', async () => {
    renderWithQuery(<SplitDetail />)
    await screen.findByText('Dinner at Taj')
    
    const forgiveBtns = await screen.findAllByRole('button', { name: /Forgive/i })
    fireEvent.click(forgiveBtns[1]) // Click Neel's forgive button
    
    const heading = await screen.findByRole('heading', { name: /Forgive share/i })
    expect(heading).toBeInTheDocument()
    
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '900' } })
    
    const submitBtn = screen.getByRole('button', { name: /Set forgiven/i })
    fireEvent.click(submitBtn)
  })

  it('can open Reset dialog and submit', async () => {
    renderWithQuery(<SplitDetail />)
    await screen.findByText('Dinner at Taj')
    
    const resetBtns = await screen.findAllByText('Reset')
    fireEvent.click(resetBtns[0])
    
    // confirm dialog opens
    const confirmBtn = await screen.findByRole('button', { name: /Confirm/i })
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(screen.queryByRole('button', { name: /Confirm/i })).not.toBeInTheDocument())
  })
})
