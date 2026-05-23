import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WidgetRenderer from './WidgetRenderer'

const SAMPLE_DATA = [
  { category: 'Food', total: '1200' },
  { category: 'Transport', total: '500' },
]

describe('WidgetRenderer', () => {
  it('renders table widget', () => {
    render(
      <WidgetRenderer
        vizType="table"
        vizConfig={null}
        data={SAMPLE_DATA}
        columns={['category', 'total']}
      />,
    )
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('Transport')).toBeInTheDocument()
  })

  it('renders table column headers', () => {
    render(
      <WidgetRenderer
        vizType="table"
        vizConfig={null}
        data={SAMPLE_DATA}
        columns={['category', 'total']}
      />,
    )
    expect(screen.getByText('category')).toBeInTheDocument()
    expect(screen.getByText('total')).toBeInTheDocument()
  })

  it('renders KPI widget', () => {
    render(
      <WidgetRenderer
        vizType="kpi"
        vizConfig={{ value_key: 'total', label: 'Total Spent' }}
        data={[{ total: '15000' }]}
        columns={['total']}
      />,
    )
    expect(screen.getByText('15000')).toBeInTheDocument()
    expect(screen.getByText('Total Spent')).toBeInTheDocument()
  })

  it('renders bar chart without crashing', () => {
    const { container } = render(
      <WidgetRenderer
        vizType="bar"
        vizConfig={{ x_key: 'category', y_key: 'total' }}
        data={SAMPLE_DATA}
        columns={['category', 'total']}
      />,
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('renders line chart without crashing', () => {
    const { container } = render(
      <WidgetRenderer
        vizType="line"
        vizConfig={{ x_key: 'category', y_key: 'total' }}
        data={SAMPLE_DATA}
        columns={['category', 'total']}
      />,
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('renders pie chart without crashing', () => {
    const { container } = render(
      <WidgetRenderer
        vizType="pie"
        vizConfig={{ name_key: 'category', value_key: 'total' }}
        data={SAMPLE_DATA}
        columns={['category', 'total']}
      />,
    )
    expect(container.firstChild).toBeTruthy()
  })
})
