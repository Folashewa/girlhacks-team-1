/**
 * Grove collections. Each chat lives in its own RecordRoom, `tree:<treeKey>`
 * (see src/grove/room.ts), so these collections never hold more than one
 * chat — there is no room or query that lists every chat.
 *
 * Read: anyone who knows the treeKey (the key is the capability).
 * Write: nobody over the WebSocket. Only PUT /api/keeper/sync writes, via a
 * server-side call that bypasses RBAC after checking the bearer secret.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { ITEM_KINDS } from '../grove/payload'

const readOnly: RolePermissions = { read: true, create: false, update: false, delete: false }

const permissions: Record<string, RolePermissions> = {
  '*': readOnly,
  viewer: readOnly,
  member: readOnly,
  admin: readOnly,
}

const text = (name: string) => ({ name, storage: 'text' as const, interpretation: 'plain' as const })
const num = (name: string) => ({ name, storage: 'number' as const, interpretation: 'plain' as const })
const bool = (name: string) => ({ name, storage: 'number' as const, interpretation: { kind: 'boolean' as const } })

/** One row per room, recordId `chat`. */
export const groveChatsSchema: CollectionSchema = {
  name: 'grove_chats',
  columns: [text('title'), num('syncedAt')],
  permissions,
}

/** recordId = personKey. */
export const grovePeopleSchema: CollectionSchema = {
  name: 'grove_people',
  columns: [text('name'), num('colorIndex'), num('rank')],
  permissions,
}

/** recordId = item id ("I3"). */
export const groveItemsSchema: CollectionSchema = {
  name: 'grove_items',
  columns: [
    { name: 'kind', storage: 'text', interpretation: { kind: 'select', options: [...ITEM_KINDS] } },
    text('text'),
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: ['open', 'done'] } },
    text('fromKey'),
    text('ownerKey'),
    text('due'),
    num('dueAt'),
    bool('discussed'),
    bool('credited'),
    num('bornAt'),
    num('changedAt'),
  ],
  permissions,
}

export const groveSchemas = [groveChatsSchema, grovePeopleSchema, groveItemsSchema]
