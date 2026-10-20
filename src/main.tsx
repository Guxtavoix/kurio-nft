import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { markNetworkReady } from '@/api/network-ready'
import { createQueryClient } from '@/api/query-client'
import { getRealtime, registerRealtime } from '@/realtime/hooks'
import { createAppRouter } from '@/router'
import { startSessionLifecycle } from '@/session/lifecycle'
import '@/styles/index.css'

const queryClient = createQueryClient()

async function startNetwork() {
  // Mocks are a network-layer concern enabled by configuration (also in the
  // demo build). They must be active before any request or socket is made.
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMockServer } = await import('@/mocks/browser')
    await startMockServer()
  }
  markNetworkReady()

  // Loaded after the mocks: engine.io-client captures `globalThis.WebSocket`
  // at import time, so it must see the intercepted constructor.
  const { RealtimeClient } = await import('@/realtime/client')
  const realtime = new RealtimeClient(queryClient, import.meta.env.VITE_SOCKET_URL ?? window.location.origin)
  registerRealtime(realtime)
  realtime.connect()
  // Read-only diagnostics for E2E tests (connection state only).
  Object.defineProperty(window, '__kurioRealtime', {
    value: { status: () => realtime.getStatus() },
    configurable: true,
  })
}

// Start fetching the network layer (mock worker) before the first render so
// both happen in parallel.
void startNetwork()

const router = createAppRouter(queryClient)
startSessionLifecycle({ queryClient, getRealtime, router })

// Render right away: data-dependent parts show skeletons, and every request
// waits for `networkReady` (see api/http.ts) instead of blocking first paint.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
