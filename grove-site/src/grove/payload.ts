/**
 * The agent → site contract (docs/IMPLEMENTATION.md §4.3).
 *
 * The agent PUTs one chat's full public view; the site replaces what it had.
 * Validation is strict: unknown keys are rejected, so a payload can never
 * smuggle extra data (log text, phone numbers, restater ids) into storage.
 */

import { z } from 'zod'

/** 128-bit hex key the agent mints per group chat (`randomBytes(16)`). */
export const TREE_KEY_RE = /^[0-9a-f]{32}$/

/** Salted HMAC prefix from the agent (24 hex chars). The demo fixture uses p1…p3. */
const personKey = z.string().regex(/^[0-9a-z]{1,64}$/)

const shortText = (max: number) => z.string().max(max)

export const ITEM_KINDS = ['request', 'commitment', 'decision', 'idea', 'question'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

const timestamp = z.number().int().nonnegative()

export const personSchema = z.strictObject({
  personKey,
  name: shortText(80).min(1),
  colorIndex: z.number().int().min(0).max(7),
})

export const itemSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
  kind: z.enum(ITEM_KINDS),
  text: shortText(1000).min(1),
  status: z.enum(['open', 'done']),
  from: personKey,
  owner: personKey.nullable(),
  due: shortText(120).nullable(),
  dueAt: timestamp.nullable(),
  discussed: z.boolean(),
  credited: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const syncPayloadSchema = z
  .strictObject({
    version: z.literal(1),
    chat: z.strictObject({
      treeKey: z.string().regex(TREE_KEY_RE),
      alias: shortText(16).min(1),
      title: shortText(120).nullable(),
      updatedAt: timestamp,
    }),
    people: z.array(personSchema).max(64),
    items: z.array(itemSchema).max(500),
  })
  .superRefine((p, ctx) => {
    const keys = new Set(p.people.map((x) => x.personKey))
    if (keys.size !== p.people.length) ctx.addIssue({ code: 'custom', message: 'duplicate personKey' })
    const ids = new Set<string>()
    p.items.forEach((item, i) => {
      if (ids.has(item.id)) ctx.addIssue({ code: 'custom', path: ['items', i, 'id'], message: 'duplicate item id' })
      ids.add(item.id)
      if (!keys.has(item.from)) ctx.addIssue({ code: 'custom', path: ['items', i, 'from'], message: 'unknown person' })
      if (item.owner !== null && !keys.has(item.owner))
        ctx.addIssue({ code: 'custom', path: ['items', i, 'owner'], message: 'unknown person' })
    })
  })

export type SyncPayload = z.infer<typeof syncPayloadSchema>
export type Person = SyncPayload['people'][number]
export type Item = SyncPayload['items'][number]

/** What the tree renders: a chat plus its people and items. */
export interface Grove {
  title: string | null
  people: Person[]
  items: Item[]
}
