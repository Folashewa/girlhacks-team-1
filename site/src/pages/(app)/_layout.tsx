/**
 * Live data layer for pages under (app)/ — today that's /g/:treeKey.
 *
 * `(app)` is a route group: it adds these providers without appearing in the
 * URL. Pages outside it (the landing, /g/demo) stay static.
 */

import { Suspense, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { DeepSpaceAuthProvider, RecordProvider, useAuthStatus } from 'deepspace'
import { useToast } from '../../components/Toast'
import { APP_NAME } from '../../constants'

export default function AppLayout() {
  return (
    <DeepSpaceAuthProvider>
      {/* Pages without <Seo> set their own title; this is the fallback. */}
      <title>{APP_NAME}</title>
      <AuthBoot>
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Outlet />
        </Suspense>
      </AuthBoot>
    </DeepSpaceAuthProvider>
  )
}

/**
 * Waits for the auth check, then mounts the records layer. Anonymous visitors
 * are allowed (anyone with a tree link can view it). Rejected writes surface
 * as toasts rather than failing silently.
 */
function AuthBoot({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuthStatus()
  const { error, warning } = useToast()

  if (!isLoaded) return <div aria-busy="true" className="fixed inset-0 bg-background" />

  return (
    <RecordProvider
      allowAnonymous
      onWriteError={(e) => (e.kind === 'permission' ? warning(e.title, e.detail) : error(e.title, e.detail))}
    >
      {/* No app-wide room: each grove page opens only its own chat's room. */}
      {children}
    </RecordProvider>
  )
}
