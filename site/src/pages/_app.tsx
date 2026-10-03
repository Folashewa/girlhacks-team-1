/**
 * Root shell for every route. Mounts no DeepSpace providers, so top-level pages
 * (the landing, /g/demo) stay static: no auth fetch, no WebSocket. The live
 * data layer lives in (app)/_layout.tsx.
 */

import { Suspense } from 'react'
import { Outlet, useRouteError } from 'react-router-dom'
import { ErrorScreen } from '../components/ErrorScreen'
import { ToastProvider } from '../components/Toast'

export default function App() {
  return (
    <ToastProvider>
      {/* data-testid="app-root" marks "app shell mounted" on every page. */}
      <div data-testid="app-root" className="min-h-screen bg-background text-foreground">
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Outlet />
        </Suspense>
      </div>
    </ToastProvider>
  )
}

/** Root error boundary: render-time crashes land here instead of a blank page. */
export function Catch() {
  const error = useRouteError()
  return <ErrorScreen error={error} />
}

/** Shown while the first lazy route module loads. */
export function HydrateFallback() {
  return <div className="min-h-screen bg-background" />
}
