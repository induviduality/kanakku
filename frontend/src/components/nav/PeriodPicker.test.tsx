import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithQuery } from '../../test/render-utils'
import PeriodPicker from './PeriodPicker'
import { type PeriodSelection } from '../../lib/period'

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

describe('PeriodPicker component', () => {
  const onChangeMock = vi.fn()

  beforeEach(() => {
    onChangeMock.mockClear()
  })

  it('renders trigger button with shortLabel', () => {
    const selection: PeriodSelection = { mode: 'month', year: 2026, month: 5 }
    renderWithQuery(<PeriodPicker selection={selection} shortLabel="May 2026" onChange={onChangeMock} />)
    
    expect(screen.getByRole('button', { name: /may 2026/i })).toBeInTheDocument()
  })

  it('opens popover and allows selecting a month', async () => {
    const user = userEvent.setup()
    const selection: PeriodSelection = { mode: 'month', year: 2026, month: 5 }
    renderWithQuery(<PeriodPicker selection={selection} shortLabel="May 2026" onChange={onChangeMock} />)
    
    await user.click(screen.getByRole('button', { name: /may 2026/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    // Switch month
    const augBtn = screen.getByRole('button', { name: 'Aug' })
    await user.click(augBtn)
    
    expect(onChangeMock).toHaveBeenCalledWith({ mode: 'month', year: 2026, month: 8 })
  })

  it('switches to quarter mode and selects Q3', async () => {
    const user = userEvent.setup()
    const selection: PeriodSelection = { mode: 'month', year: 2026, month: 5 }
    renderWithQuery(<PeriodPicker selection={selection} shortLabel="May 2026" onChange={onChangeMock} />)
    
    await user.click(screen.getByRole('button', { name: /may 2026/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'quarter')
    
    const q3Btn = screen.getByRole('button', { name: /Q3/i })
    await user.click(q3Btn)
    
    expect(onChangeMock).toHaveBeenCalledWith({ mode: 'quarter', year: 2026, quarter: 3 })
  })

  it('switches to year mode and selects year', async () => {
    const user = userEvent.setup()
    const selection: PeriodSelection = { mode: 'month', year: 2026, month: 5 }
    renderWithQuery(<PeriodPicker selection={selection} shortLabel="May 2026" onChange={onChangeMock} />)
    
    await user.click(screen.getByRole('button', { name: /may 2026/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'year')
    
    const yrBtn = screen.getByRole('button', { name: '2025' })
    await user.click(yrBtn)
    
    expect(onChangeMock).toHaveBeenCalledWith({ mode: 'year', year: 2025 })
  })

  it('switches to week mode and selects a week', async () => {
    const user = userEvent.setup()
    const selection: PeriodSelection = { mode: 'week', weekOf: new Date('2026-05-11T00:00:00Z') }
    renderWithQuery(<PeriodPicker selection={selection} shortLabel="This week" onChange={onChangeMock} />)
    
    await user.click(screen.getByRole('button', { name: /this week/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    // Week picker renders days, we click on 15 (which is in May 2026)
    // There are multiple 15s maybe, but we can just click the first one we find
    const days = screen.getAllByText('15')
    await user.click(days[0])
    
    expect(onChangeMock).toHaveBeenCalled()
    const call = onChangeMock.mock.calls[0][0]
    expect(call.mode).toBe('week')
    expect(call.weekOf).toBeInstanceOf(Date)
  })
})
