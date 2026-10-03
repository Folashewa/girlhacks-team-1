/**
 * PUT /api/keeper/sync — the only write path into grove data
 * (docs/IMPLEMENTATION.md §5.1).
 *
 * The agent sends one chat's full public view with `Authorization: Bearer
 * <GROVE_SYNC_SECRET>`. The secret is checked (constant time) before the body
 * is read; the body is capped, strictly validated, then applied to that
 * chat's own room only. There is deliberately no GET/list route.
 */

import type { Hono } from 'hono'
import { BodyTooLargeError, readBoundedBodyText, timingSafeEqualStrings } from 'deepspace/worker'
import { applyPayload, type RoomTools } from '../grove/apply-sync'
import { syncPayloadSchema } from '../grove/sync-payload'
import { treeRoomId } from '../grove/storage'
import type { AppContext, Env } from '../../worker.js'

export const SYNC_PATH = '/api/keeper/sync'
export const SYNC_BODY_LIMIT = 256 * 1024
/** Shortest secret we accept; the plan asks for 32+ random chars. */
const MIN_SECRET_LENGTH = 32

export async function handleSync(
  req: Request,
  secret: string | undefined,
  openRoom: (treeKey: string) => RoomTools,
): Promise<Response> {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    console.error('[sync] GROVE_SYNC_SECRET is not set (or shorter than 32 chars); refusing all syncs')
    return new Response('Sync not configured', { status: 503 })
  }

  const header = req.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!(await timingSafeEqualStrings(token, secret))) {
    console.warn('[sync] rejected: bad or missing bearer secret')
    return new Response('Unauthorized', { status: 401 })
  }

  let raw: string
  try {
    raw = await readBoundedBodyText(req, SYNC_BODY_LIMIT)
  } catch (err) {
    if (err instanceof BodyTooLargeError) return new Response('Payload too large', { status: 413 })
    throw err
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return badRequest('body is not JSON')
  }

  const parsed = syncPayloadSchema.safeParse(json)
  if (!parsed.success) {
    // Paths and messages only — never echo payload values into logs.
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    return badRequest(issues.join('; '))
  }

  const payload = parsed.data
  const { written, removed } = await applyPayload(openRoom(payload.chat.treeKey), payload)
  console.info(`[sync] ${payload.chat.alias}: ${payload.items.length} items, ${written} written, ${removed} removed`)
  return new Response(null, { status: 204 })
}

function badRequest(reason: string): Response {
  console.warn(`[sync] rejected 400: ${reason}`)
  return new Response(`Bad request: ${reason}`, { status: 400 })
}

/** Server-side record tools for one chat's room. RBAC is bypassed here, so
 *  this must only be reached after the bearer check in handleSync. */
function roomTools(env: Env, treeKey: string): RoomTools {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(treeRoomId(treeKey)))

  async function exec<T>(tool: string, params: Record<string, unknown>): Promise<T> {
    const res = await stub.fetch(
      new Request('https://internal/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': env.OWNER_USER_ID, 'X-App-Action': 'true' },
        body: JSON.stringify({ tool, params }),
      }),
    )
    const json = (await res.json()) as { success: boolean; data?: T; error?: string }
    if (!json.success) throw new Error(`${tool} failed: ${json.error ?? res.status}`)
    return json.data as T
  }

  return {
    async query(collection) {
      const data = await exec<{ records: { recordId: string; data: Record<string, unknown> }[] }>('records.query', {
        collection,
        limit: 1000,
      })
      return data.records
    },
    async upsert(collection, recordId, data) {
      await exec('records.create', { collection, recordId, data })
    },
    async remove(collection, recordId) {
      await exec('records.delete', { collection, recordId })
    },
  }
}

export function registerSyncRoute(app: Hono<AppContext>): void {
  app.put(SYNC_PATH, (c) => handleSync(c.req.raw, c.env.GROVE_SYNC_SECRET, (key) => roomTools(c.env, key)))
}
