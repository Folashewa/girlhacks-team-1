/**
 * WebSocket routing. The only room a browser may open is one chat's grove,
 * `tree:<treeKey>`; every other room name is refused. (The starter also opened
 * doc, canvas, presence, cron and job rooms; Grovekeeper uses none of them.)
 *
 * Caller identity in query parameters and headers is never trusted: a token,
 * if present, is verified and forwarded in internal-only headers.
 */

import type { Hono } from 'hono'
import { authenticatedRoomRequest, verifyJwt } from 'deepspace/worker'
import type { VerifyResult } from 'deepspace/worker'
import { TREE_KEY_RE } from '../grove/sync-payload'
import type { AppContext } from '../../worker.js'

const TREE_ROOM_RE = new RegExp(`^tree:${TREE_KEY_RE.source.slice(1, -1)}$`)

export function registerRealtimeRoutes(app: Hono<AppContext>): void {
  app.get('/ws/:roomId', async (c) => {
    const roomId = c.req.param('roomId')
    if (!TREE_ROOM_RE.test(roomId)) return new Response('Not found', { status: 404 })

    const token = new URL(c.req.url).searchParams.get('token')
    let auth: VerifyResult | null = null
    if (token) {
      auth = (await verifyJwt({ publicKey: c.env.AUTH_JWT_PUBLIC_KEY, issuer: c.env.AUTH_JWT_ISSUER }, token)).result
      if (!auth) return new Response('Unauthorized', { status: 401 })
    }

    const stub = c.env.RECORD_ROOMS.get(c.env.RECORD_ROOMS.idFromName(roomId))
    return stub.fetch(authenticatedRoomRequest(c.req.raw, auth))
  })
}
