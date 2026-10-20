import { setupWorker } from 'msw/browser'
import { mockControl } from './control'
import { resumePendingOrders } from './domain/orders'
import { handlers } from './handlers'

export async function startMockServer() {
  const worker = setupWorker(...handlers)
  await worker.start({
    // Assets, fonts and Vite modules pass through untouched.
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  resumePendingOrders()
  window.__kurioMock = mockControl
  return worker
}
