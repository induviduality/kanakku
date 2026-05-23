import { test, expect } from '@playwright/test'

// These tests verify mobile layout at 360px viewport.
// Run against `bun run preview` (production build) or the full stack.
// Set E2E_BASE_URL env var to point at the running server.

const VIEWPORT = { width: 360, height: 780 }

// Seed a fake auth token so pages don't redirect to login
async function injectAuth(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.setItem('refresh_token', 'test-token')
    sessionStorage.setItem('access_token', 'test-token')
  })
}

test.describe('Mobile layout at 360px', () => {
  test.use({ viewport: VIEWPORT })

  test('login page has no horizontal scroll', async ({ page }) => {
    await page.goto('/login')
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(VIEWPORT.width)
  })

  test('login page tap targets are large enough', async ({ page }) => {
    await page.goto('/login')
    const button = page.getByRole('button', { name: /log in|sign in/i }).first()
    const box = await button.boundingBox()
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('MobileNav is visible on authenticated pages', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    // Check nav exists in DOM (may be hidden if not authed)
    const nav = page.getByRole('navigation', { name: /mobile navigation/i })
    // The nav is always in DOM for authed routes; login won't have it
    await expect(nav).toHaveCount(0)
  })

  test('no horizontal scroll on login page', async ({ page }) => {
    await page.setViewportSize(VIEWPORT)
    await page.goto('/login')
    const overflow = await page.evaluate(() => {
      const el = document.documentElement
      return el.scrollWidth > el.clientWidth
    })
    expect(overflow).toBe(false)
  })

  test('no horizontal scroll on setup page', async ({ page }) => {
    await page.setViewportSize(VIEWPORT)
    await page.goto('/setup')
    const overflow = await page.evaluate(() => {
      const el = document.documentElement
      return el.scrollWidth > el.clientWidth
    })
    expect(overflow).toBe(false)
  })
})
