/**
 * Mapping between the sync payload and stored rows. Shared by the worker
 * (payload → rows) and the tree page (rows → Grove), so both sides agree.
 */

import type { Grove, Item, ItemKind, Person } from './payload'

export const COLLECTIONS = { chats: 'grove_chats', people: 'grove_people', items: 'grove_items' } as const
export const CHAT_RECORD_ID = 'chat'

export interface ChatRow extends Record<string, unknown> {
  title: string | null
  syncedAt: number
}

export interface PersonRow extends Record<string, unknown> {
  name: string
  colorIndex: number
  /** Position in the payload (first appearance); storage doesn't keep order. */
  rank: number
}

export interface ItemRow extends Record<string, unknown> {
  kind: ItemKind
  text: string
  status: 'open' | 'done'
  fromKey: string
  ownerKey: string | null
  due: string | null
  dueAt: number | null
  discussed: boolean
  credited: boolean
  bornAt: number
  changedAt: number
}

export function personToRow(p: Person, rank: number): PersonRow {
  return { name: p.name, colorIndex: p.colorIndex, rank }
}

export function itemToRow(i: Item): ItemRow {
  return {
    kind: i.kind,
    text: i.text,
    status: i.status,
    fromKey: i.from,
    ownerKey: i.owner,
    due: i.due,
    dueAt: i.dueAt,
    discussed: i.discussed,
    credited: i.credited,
    bornAt: i.createdAt,
    changedAt: i.updatedAt,
  }
}

interface Envelope<T> {
  recordId: string
  data: Partial<T>
}

/** Rows → Grove. Tolerates storage quirks (booleans as 0/1, missing nulls). */
export function rowsToGrove(
  chat: Envelope<ChatRow> | undefined,
  people: Envelope<PersonRow>[],
  items: Envelope<ItemRow>[],
): Grove {
  return {
    title: chat?.data.title || null,
    people: [...people]
      .sort((a, b) => Number(a.data.rank ?? 0) - Number(b.data.rank ?? 0) || a.recordId.localeCompare(b.recordId))
      .map((r) => ({
      personKey: r.recordId,
      name: String(r.data.name ?? 'Member'),
      colorIndex: Number(r.data.colorIndex ?? 0) % 8,
    })),
    items: items.map((r) => ({
      id: r.recordId,
      kind: (r.data.kind ?? 'idea') as ItemKind,
      text: String(r.data.text ?? ''),
      status: r.data.status === 'done' ? 'done' : 'open',
      from: String(r.data.fromKey ?? ''),
      owner: r.data.ownerKey ? String(r.data.ownerKey) : null,
      due: r.data.due ? String(r.data.due) : null,
      dueAt: r.data.dueAt == null ? null : Number(r.data.dueAt),
      discussed: Boolean(r.data.discussed),
      credited: Boolean(r.data.credited),
      createdAt: Number(r.data.bornAt ?? 0),
      updatedAt: Number(r.data.changedAt ?? 0),
    })),
  }
}

/** True when a stored row already holds exactly these values. */
export function sameRow(stored: Record<string, unknown>, next: Record<string, unknown>): boolean {
  return Object.entries(next).every(([k, v]) => {
    const s = stored[k]
    if (typeof v === 'boolean') return Boolean(s) === v
    if (v === null) return s === null || s === undefined || s === ''
    return s === v
  })
}
