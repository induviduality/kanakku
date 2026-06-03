import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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

  it('can navigate prev/next in month picker', async () => {
    const user = userEvent.setup()
    const selection: PeriodSelection = { mode: 'month', year: 2026, month: 5 }
    renderWithQuery(<PeriodPicker selection={selection} shortLabel="May 2026" onChange={onChangeMock} />)
    
    await user.click(screen.getByRole('button', { name: /may 2026/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    // Find the SVG buttons in YearNav. They don't have explicit names, but they are the only buttons before the months.
    // Actually, we can click by getting buttons, there are 12 months + 2 arrows = 14 buttons.
    const dialog = screen.getByRole('dialog')
    const buttons = within(dialog).getAllByRole('button')
    // First two buttons are the prev/next arrows in YearNav
    await user.click(buttons[0]) // prev
    expect(screen.getByText('2025')).toBeInTheDocument()

    await user.click(buttons[1]) // next
    await user.click(buttons[1]) // next again
    expect(screen.getByText('2027')).toBeInTheDocument()
  })

  it('can navigate prev/next in week picker', async () => {
    const user = userEvent.setup()
    const selection: PeriodSelection = { mode: 'week', weekOf: new Date('2026-05-11T00:00:00Z') }
    renderWithQuery(<PeriodPicker selection={selection} shortLabel="This week" onChange={onChangeMock} />)
    
    await user.click(screen.getByRole('button', { name: /this week/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    const dialog = screen.getByRole('dialog')
    const buttons = within(dialog).getAllByRole('button')
    // First two buttons in WeekPicker are prev/next month
    await user.click(buttons[0]) // prev month
    expect(screen.getByText('Apr 2026')).toBeInTheDocument()

    await user.click(buttons[1]) // next month
    await user.click(buttons[1]) // next month
    expect(screen.getByText('Jun 2026')).toBeInTheDocument()
  })

  it('can navigate prev/next in quarter picker', async () => {
    const user = userEvent.setup()
    const selection: PeriodSelection = { mode: 'quarter', year: 2026, quarter: 3 }
    renderWithQuery(<PeriodPicker selection={selection} shortLabel="Q3 2026" onChange={onChangeMock} />)
    
    await user.click(screen.getByRole('button', { name: /q3 2026/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    const dialog = screen.getByRole('dialog')
    const buttons = within(dialog).getAllByRole('button')
    await user.click(buttons[0]) // prev
    expect(screen.getByText('2025')).toBeInTheDocument()
    await user.click(buttons[1]) // next
    expect(screen.getByText('2026')).toBeInTheDocument()
  })

  it('can navigate prev/next in year picker', async () => {
    const user = userEvent.setup()
    const selection: PeriodSelection = { mode: 'year', year: 2026 }
    renderWithQuery(<PeriodPicker selection={selection} shortLabel="2026" onChange={onChangeMock} />)
    
    await user.click(screen.getByRole('button', { name: /2026/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    const dialog = screen.getByRole('dialog')
    const buttons = within(dialog).getAllByRole('button')
    await user.click(buttons[0]) // prev
    await user.click(buttons[1]) // next
  })

  it('can select a custom range', async () => {
    const user = userEvent.setup()
    const selection: PeriodSelection = { mode: 'month', year: 2026, month: 5 }
    renderWithQuery(<PeriodPicker selection={selection} shortLabel="May 2026" onChange={onChangeMock} />)
    
    await user.click(screen.getByRole('button', { name: /may 2026/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'custom')
    
    const dialog = screen.getByRole('dialog')
    const gridcells = within(dialog).getAllByRole('gridcell')
    
    // Find gridcells that have a button inside (actual days)
    const dayCells = gridcells.filter(cell => within(cell).queryByRole('button'))
    
    await user.click(within(dayCells[10]).getByRole('button'))
    await user.click(within(dayCells[15]).getByRole('button'))
  })

  it('handles Popover close and re-open', async () => {
    const user = userEvent.setup()
    const selection: PeriodSelection = { mode: 'month', year: 2026, month: 5 }
    renderWithQuery(<PeriodPicker selection={selection} shortLabel="May 2026" onChange={onChangeMock} />)
    
    await user.click(screen.getByRole('button', { name: /may 2026/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    // Close it with escape
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Open again
    await user.click(screen.getByRole('button', { name: /may 2026/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })
})
