/**
 * The worker's HTTP routes besides /api/keeper/sync: the auth proxy the
 * DeepSpace client needs, and serving the built pages.
 *
 * Deliberately absent: integration, file, payment, debug and native-app
 * proxies. Grovekeeper uses none of them, and the starter's integration proxy
 * let anonymous callers spend the owner's credits.
 */

import type { Hono } from 'hono'
import { authWorkerFetch, isPlatformReservedPath } from 'deepspace/worker'
import type { AppContext } from '../../worker.js'

/** Auth proxy → DeepSpace auth worker (same-origin cookies). The client's auth
 *  provider checks the session here; nobody signs in, so it reports anonymous. */
export function registerAuthRoutes(app: Hono<AppContext>): void {
  app.all('/api/auth/*', async (c) => {
    const url = new URL(c.req.url)
    const res = await authWorkerFetch(c.env, url.pathname + url.search, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
    })
    const headers = new Headers(res.headers)
    const setCookie = headers.get('set-cookie')
    if (setCookie) headers.set('set-cookie', setCookie.replace(/;\s*Domain=[^;]*/gi, ''))
    return new Response(res.body, { status: res.status, headers })
  })
}

/** The plain SPA shell prerender.ts writes beside the prerendered pages. */
const SPA_SHELL_PATH = '/_spa'

/** A file (last segment has an extension), not a client route. */
function namesAFile(pathname: string): boolean {
  const last = pathname.slice(pathname.lastIndexOf('/') + 1)
  return last.includes('.')
}

/**
 * Registered last so it can't shadow worker routes. Unknown API calls get a
 * JSON 404 (any method); everything else is a built file or a client route.
 */
export function registerStaticRoutes(app: Hono<AppContext>): void {
  app.all('*', async (c, next) => {
    const { pathname } = new URL(c.req.url)
    if (pathname === '/api' || pathname.startsWith('/api/')) return c.json({ error: 'not_found' }, 404)
    await next()
  })

  app.get('*', async (c) => {
    const url = new URL(c.req.url)
    const response = await c.env.ASSETS.fetch(c.req.raw)
    if (response.status !== 404) return response

    if (namesAFile(url.pathname) || isPlatformReservedPath(url.pathname)) {
      return c.json({ error: 'not_found' }, 404)
    }
    // Client routes (/g/<key>, …) get the empty shell, not the prerendered
    // landing; dev builds without the shell fall back to `/`.
    url.pathname = SPA_SHELL_PATH
    const shell = await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
    if (shell.status !== 404) return shell
    url.pathname = '/'
    return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
  })
}
