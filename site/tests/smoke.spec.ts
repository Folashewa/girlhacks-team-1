import { test, expect, type Page } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Smoke tests for the pages people actually open:
 *   /            static landing
 *   /g/demo      static demo grove (bundled fixture, must work offline)
 *   /g/:treeKey  a chat's live grove (records WebSocket)
 */

async function waitForApp(page: Page) {
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
}

/** Records the app's own room sockets (vite's HMR socket doesn't count). */
function watchRoomSockets(page: Page): string[] {
  const sockets: string[] = []
  page.on('websocket', (ws) => {
    if (new URL(ws.url()).pathname.startsWith('/ws/')) sockets.push(new URL(ws.url()).pathname)
  })
  return sockets
}

test.describe('Smoke tests', () => {
  test('landing loads without errors and links to the demo', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await expect(page.locator('a[href="/g/demo"]')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('landing carries one title, one description, one canonical', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Grovekeeper/)
    expect(await page.locator('head meta[name="description"]').count()).toBe(1)
    expect(await page.locator('head link[rel="canonical"]').count()).toBe(1)
  })

  test('demo grove grows from the fixture with no network connection to a room', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    const sockets = watchRoomSockets(page)
    await page.goto('/g/demo')
    await expect(page.getByRole('heading', { name: 'GirlHacks team' })).toBeVisible()
    await expect(page.locator('[aria-label="Idea from Priya: Make it live in the group chat instead of an app"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'See as list' })).toBeVisible()
    await page.waitForTimeout(1500)
    expect(sockets).toEqual([])
    expect(errors).toEqual([])
  })

  test('demo list view shows the same items', async ({ page }) => {
    await page.goto('/g/demo')
    await page.getByRole('button', { name: 'See as list' }).click()
    await expect(page.getByText('Idea from Priya: Make it live in the group chat instead of an app')).toBeVisible()
  })

  test('a live grove opens only its own chat room and starts empty', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    const sockets = watchRoomSockets(page)
    const key = '0123456789abcdef0123456789abcdef'
    await page.goto(`/g/${key}`)
    await expect(page.getByText('Your grove is waiting for its first seed')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)
    expect(sockets).toEqual([`/ws/tree:${key}`])
    expect(errors).toEqual([])
  })

  test('a malformed grove link opens no room', async ({ page }) => {
    const sockets = watchRoomSockets(page)
    await page.goto('/g/not-a-real-key')
    await expect(page.getByText('This path leads nowhere')).toBeVisible({ timeout: 15000 })
    expect(sockets.filter((path) => path.startsWith('/ws/tree:'))).toEqual([])
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.locator('text=404')).toBeVisible()
  })
})
