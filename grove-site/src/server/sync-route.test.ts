import { describe, expect, it } from 'vitest'
import type { RoomTools } from '../grove/apply'
import type { SyncPayload } from '../grove/payload'
import { rowsToGrove } from '../grove/rows'
import { handleSync, SYNC_BODY_LIMIT } from './sync-route'

const SECRET = 'a'.repeat(64)
const KEY_A = '0123456789abcdef0123456789abcdef'
const KEY_B = 'fedcba9876543210fedcba9876543210'

/** In-memory rooms keyed by treeKey, counting writes. */
function fakeRooms() {
  const rooms = new Map<string, Map<string, Map<string, Record<string, unknown>>>>()
  let writes = 0
  const open = (treeKey: string): RoomTools => {
    if (!rooms.has(treeKey)) rooms.set(treeKey, new Map())
    const room = rooms.get(treeKey)!
    const coll = (c: string) => {
      if (!room.has(c)) room.set(c, new Map())
      return room.get(c)!
    }
    return {
      async query(c) {
        return [...coll(c)].map(([recordId, data]) => ({ recordId, data }))
      },
      async upsert(c, id, data) {
        writes++
        coll(c).set(id, { ...data })
      },
      async remove(c, id) {
        writes++
        coll(c).delete(id)
      },
    }
  }
  return { rooms, open, writes: () => writes }
}

function payload(over: Partial<SyncPayload> = {}): SyncPayload {
  return {
    version: 1,
    chat: { treeKey: KEY_A, alias: 'g1', title: 'Team', updatedAt: 1 },
    people: [
      { personKey: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Priya', colorIndex: 0 },
      { personKey: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Member 2', colorIndex: 1 },
    ],
    items: [
      {
        id: 'I1', kind: 'commitment', text: 'Do the slides', status: 'open',
        from: 'aaaaaaaaaaaaaaaaaaaaaaaa', owner: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        due: 'by 6', dueAt: null, discussed: false, credited: false, createdAt: 1, updatedAt: 1,
      },
      {
        id: 'I2', kind: 'request', text: 'Book the Airbnb', status: 'open',
        from: 'bbbbbbbbbbbbbbbbbbbbbbbb', owner: null,
        due: null, dueAt: null, discussed: false, credited: false, createdAt: 2, updatedAt: 2,
      },
    ],
    ...over,
  }
}

function req(body: unknown, auth: string | null = `Bearer ${SECRET}`): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth !== null) headers.Authorization = auth
  return new Request('https://x/api/keeper/sync', {
    method: 'PUT',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('PUT /api/keeper/sync', () => {
  it('rejects a missing bearer secret with 401 and writes nothing', async () => {
    const f = fakeRooms()
    const res = await handleSync(req(payload(), null), SECRET, f.open)
    expect(res.status).toBe(401)
    expect(f.writes()).toBe(0)
  })

  it('rejects a wrong bearer secret with 401', async () => {
    const f = fakeRooms()
    expect((await handleSync(req(payload(), `Bearer ${'b'.repeat(64)}`), SECRET, f.open)).status).toBe(401)
    expect((await handleSync(req(payload(), SECRET), SECRET, f.open)).status).toBe(401) // no "Bearer "
    expect(f.writes()).toBe(0)
  })

  it('refuses everything when the server secret is unset or short', async () => {
    const f = fakeRooms()
    expect((await handleSync(req(payload(), 'Bearer '), undefined, f.open)).status).toBe(503)
    expect((await handleSync(req(payload(), 'Bearer short'), 'short', f.open)).status).toBe(503)
  })

  it('caps the body at 256 KB', async () => {
    const f = fakeRooms()
    const res = await handleSync(req('x'.repeat(SYNC_BODY_LIMIT + 1)), SECRET, f.open)
    expect(res.status).toBe(413)
    expect(f.writes()).toBe(0)
  })

  it('rejects non-JSON and malformed payloads with 400', async () => {
    const f = fakeRooms()
    expect((await handleSync(req('{nope'), SECRET, f.open)).status).toBe(400)
    expect((await handleSync(req({ ...payload(), version: 2 }), SECRET, f.open)).status).toBe(400)
    const badKey = payload({ chat: { treeKey: 'demo', alias: 'g1', title: null, updatedAt: 1 } })
    expect((await handleSync(req(badKey), SECRET, f.open)).status).toBe(400)
    expect(f.writes()).toBe(0)
  })

  it('rejects unexpected fields, so private data cannot be smuggled in', async () => {
    const f = fakeRooms()
    const p = payload() as unknown as { items: Record<string, unknown>[]; chat: Record<string, unknown> }
    const withSender = structuredClone(p)
    withSender.items[0].senderId = '+15551234567'
    expect((await handleSync(req(withSender), SECRET, f.open)).status).toBe(400)
    const withLog = structuredClone(p) as Record<string, unknown>
    withLog.log = [{ text: 'hi' }]
    expect((await handleSync(req(withLog), SECRET, f.open)).status).toBe(400)
    expect(f.writes()).toBe(0)
  })

  it('rejects items pointing at people not in the payload', async () => {
    const f = fakeRooms()
    const p = payload()
    p.items[0].owner = 'cccccccccccccccccccccccc'
    expect((await handleSync(req(p), SECRET, f.open)).status).toBe(400)
  })

  it('stores a valid payload in that chat’s room and answers 204', async () => {
    const f = fakeRooms()
    const res = await handleSync(req(payload()), SECRET, f.open)
    expect(res.status).toBe(204)
    const room = f.rooms.get(KEY_A)!
    expect([...room.get('grove_items')!.keys()]).toEqual(['I1', 'I2'])
    expect(room.get('grove_items')!.get('I1')).toMatchObject({ ownerKey: 'aaaaaaaaaaaaaaaaaaaaaaaa', status: 'open' })
    expect(room.get('grove_people')!.get('bbbbbbbbbbbbbbbbbbbbbbbb')).toEqual({ name: 'Member 2', colorIndex: 1, rank: 1 })
    expect(room.get('grove_chats')!.get('chat')).toMatchObject({ title: 'Team' })
  })

  it('replaces the set: items missing from the next payload are deleted', async () => {
    const f = fakeRooms()
    await handleSync(req(payload()), SECRET, f.open)
    const next = payload()
    next.items = next.items.slice(0, 1)
    await handleSync(req(next), SECRET, f.open)
    expect([...f.rooms.get(KEY_A)!.get('grove_items')!.keys()]).toEqual(['I1'])
  })

  it('does not rewrite unchanged rows', async () => {
    const f = fakeRooms()
    await handleSync(req(payload()), SECRET, f.open)
    const before = f.writes()
    await handleSync(req(payload()), SECRET, f.open)
    expect(f.writes() - before).toBe(1) // only the chat row's syncedAt
  })

  it('keeps chats apart: one chat’s sync never touches another’s room', async () => {
    const f = fakeRooms()
    await handleSync(req(payload()), SECRET, f.open)
    const other = payload({ chat: { treeKey: KEY_B, alias: 'g2', title: 'Trip', updatedAt: 1 } })
    other.items = []
    await handleSync(req(other), SECRET, f.open)
    expect(f.rooms.get(KEY_A)!.get('grove_items')!.size).toBe(2)
    expect(f.rooms.get(KEY_B)!.get('grove_items')!.size).toBe(0)
  })

  it('keeps people in first-appearance order even though storage does not', async () => {
    const f = fakeRooms()
    const p = payload()
    p.people = [
      { personKey: 'zzzzzzzzzzzzzzzzzzzzzzzz', name: 'First', colorIndex: 0 },
      { personKey: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Second', colorIndex: 1 },
      { personKey: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Third', colorIndex: 2 },
    ]
    await handleSync(req(p), SECRET, f.open)
    const stored = [...f.rooms.get(KEY_A)!.get('grove_people')!].map(([recordId, data]) => ({ recordId, data }))
    stored.sort((a, b) => a.recordId.localeCompare(b.recordId)) // what a store might hand back
    expect(rowsToGrove(undefined, stored, []).people.map((x) => x.name)).toEqual(['First', 'Second', 'Third'])
  })
})
