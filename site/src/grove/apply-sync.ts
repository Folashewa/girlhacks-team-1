/**
 * Replace one chat's stored view with a validated payload.
 *
 * Runs against a single chat's room, so it can only ever touch that chat.
 * Rows not in the payload are deleted; unchanged rows are not rewritten
 * (each write is broadcast to open trees, and only new items should animate).
 */

import type { SyncPayload } from './sync-payload'
import { CHAT_RECORD_ID, COLLECTIONS, itemToRow, personToRow, sameRow } from './storage'

/** The subset of the SDK's ActionTools this needs (easy to fake in tests). */
export interface RoomTools {
  query(collection: string): Promise<{ recordId: string; data: Record<string, unknown> }[]>
  upsert(collection: string, recordId: string, data: Record<string, unknown>): Promise<void>
  remove(collection: string, recordId: string): Promise<void>
}

export interface ApplyResult {
  written: number
  removed: number
}

async function replaceSet(
  tools: RoomTools,
  collection: string,
  next: Map<string, Record<string, unknown>>,
  result: ApplyResult,
): Promise<void> {
  const existing = await tools.query(collection)
  const stored = new Map(existing.map((r) => [r.recordId, r.data]))
  for (const [id, row] of next) {
    const old = stored.get(id)
    if (old && sameRow(old, row)) continue
    await tools.upsert(collection, id, row)
    result.written++
  }
  for (const id of stored.keys()) {
    if (next.has(id)) continue
    await tools.remove(collection, id)
    result.removed++
  }
}

export async function applyPayload(tools: RoomTools, payload: SyncPayload, now = Date.now()): Promise<ApplyResult> {
  const result: ApplyResult = { written: 0, removed: 0 }
  // People first, so a new item never renders before its planter's branch.
  await replaceSet(tools, COLLECTIONS.people, new Map(payload.people.map((p, i) => [p.personKey, personToRow(p, i)])), result)
  await replaceSet(tools, COLLECTIONS.items, new Map(payload.items.map((i) => [i.id, itemToRow(i)])), result)
  await tools.upsert(COLLECTIONS.chats, CHAT_RECORD_ID, { title: payload.chat.title, syncedAt: now })
  return result
}
