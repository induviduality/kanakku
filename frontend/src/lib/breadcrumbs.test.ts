import { describe, it, expect } from 'vitest'
import { buildBreadcrumbs } from './breadcrumbs'

describe('breadcrumbs lib', () => {
  it('returns empty array for root /', () => {
    expect(buildBreadcrumbs('/')).toEqual([])
  })

  it('handles static leaf paths', () => {
    const crumbs = buildBreadcrumbs('/transactions/new')
    expect(crumbs).toEqual([
      { label: 'Transactions', href: '/transactions' },
      { label: 'New Transaction' }
    ])
  })

  it('handles single segment paths with known root label', () => {
    const crumbs = buildBreadcrumbs('/piggy-banks')
    expect(crumbs).toEqual([{ label: 'Savings Goals' }])
  })

  it('handles single segment paths with unknown root label', () => {
    const crumbs = buildBreadcrumbs('/unknown-path')
    expect(crumbs).toEqual([{ label: 'unknown-path' }])
  })

  it('handles ID segments', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000'
    const crumbs = buildBreadcrumbs(`/budgets/${uuid}`)
    expect(crumbs).toEqual([
      { label: 'Budgets', href: '/budgets' },
      { label: 'Details' }
    ])
  })

  it('handles non-ID dynamic segments (fallback)', () => {
    const crumbs = buildBreadcrumbs(`/settings/some-subpage`)
    expect(crumbs).toEqual([
      { label: 'Settings', href: '/settings' },
      { label: 'Some subpage' }
    ])
  })

  it('handles 3-segment paths with ID and edit action', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000'
    const crumbs = buildBreadcrumbs(`/budgets/${uuid}/edit`)
    expect(crumbs).toEqual([
      { label: 'Budgets', href: '/budgets' },
      { label: 'Details', href: `/budgets/${uuid}` },
      { label: 'Edit' }
    ])
  })

  it('handles 3-segment paths with ID and custom action', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000'
    const crumbs = buildBreadcrumbs(`/budgets/${uuid}/delete`)
    expect(crumbs).toEqual([
      { label: 'Budgets', href: '/budgets' },
      { label: 'Details', href: `/budgets/${uuid}` },
      { label: 'Delete' }
    ])
  })

  it('handles 3-segment paths without ID', () => {
    const crumbs = buildBreadcrumbs(`/settings/advanced/features`)
    expect(crumbs).toEqual([
      { label: 'Settings', href: '/settings' },
      { label: 'Advanced' },
      { label: 'Features' }
    ])
  })

  it('handles deeper paths (fallback to root)', () => {
    const crumbs = buildBreadcrumbs(`/settings/advanced/features/extra`)
    expect(crumbs).toEqual([
      { label: 'Settings', href: '/settings' }
    ])
  })
})
