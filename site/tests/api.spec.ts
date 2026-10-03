import { test, expect } from '@playwright/test'

/** The sync route is the only write path; it must refuse anyone without the secret. */
test.describe('Sync API', () => {
  test('refuses a sync with no secret', async ({ request }) => {
    const res = await request.put('/api/keeper/sync', { data: { version: 1 } })
    expect(res.status()).toBe(401)
  })

  test('refuses a sync with a wrong secret', async ({ request }) => {
    const res = await request.put('/api/keeper/sync', {
      headers: { Authorization: `Bearer ${'x'.repeat(64)}` },
      data: { version: 1 },
    })
    expect(res.status()).toBe(401)
  })

  test('has no way to read or list chats', async ({ request }) => {
    expect((await request.get('/api/keeper/sync')).status()).toBe(404)
    expect((await request.get('/api/keeper/chats')).status()).toBe(404)
  })

  test('starter proxies that could spend the owner\'s credits are gone', async ({ request }) => {
    for (const path of ['/api/integrations', '/api/integrations/openai/chat-completion', '/api/files/x', '/api/debug/x']) {
      expect((await request.post(path, { data: {} })).status(), path).toBe(404)
    }
  })

  test('only grove rooms can be opened', async ({ request }) => {
    for (const path of ['/ws/app:anything', '/ws/yjs/doc1', '/ws/canvas/doc1', '/ws/presence/x', '/ws/tree:not-hex']) {
      expect((await request.get(path)).status(), path).toBe(404)
    }
  })
})
