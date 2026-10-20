import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useRef, useSyncExternalStore } from 'react'
import {
  isTerminalStatus,
  Quote,
  type CreateOrderRequest,
  type Network,
  type Order,
  type WalletConnection,
  type WalletType,
} from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError, toApiError } from '@/api/errors'
import { qk } from '@/api/query-keys'
import { useOwner } from '@/session/hooks'
import { sessionStore } from '@/session/store'
import { realtimeStatus } from '@/realtime/hooks'

// ── Wallet connection (simulated extension handshake) ─────────────────────

const CONN_KEY = 'kurio:wallet-connection'
type StoredConnection = WalletConnection & { userId: string }
const connListeners = new Set<() => void>()

function readConnection(): StoredConnection | null {
  try {
    const raw = sessionStorage.getItem(CONN_KEY)
    const c = raw ? (JSON.parse(raw) as StoredConnection) : null
    return c && c.userId === sessionStore.userId() ? c : null
  } catch {
    return null
  }
}
let connSnapshot = readConnection()
function writeConnection(c: StoredConnection | null) {
  try {
    if (c) sessionStorage.setItem(CONN_KEY, JSON.stringify(c))
    else sessionStorage.removeItem(CONN_KEY)
  } catch {
    // ignore
  }
  connSnapshot = c
  connListeners.forEach((l) => l())
}
sessionStore.subscribe(() => {
  // Connections belong to a session; drop them on any identity change.
  if (connSnapshot && connSnapshot.userId !== sessionStore.userId()) writeConnection(null)
})

export function useWalletConnection() {
  const connection = useSyncExternalStore(
    (l) => {
      connListeners.add(l)
      return () => connListeners.delete(l)
    },
    () => connSnapshot,
  )
  const connect = useMutation({
    mutationFn: ({ walletId, network, provider }: { walletId: string; network: Network; provider: WalletType }) =>
      api.wallets.connect(walletId, network, provider),
    onSuccess: (c) => writeConnection({ ...c, userId: sessionStore.userId()! }),
  })
  const disconnect = useMutation({
    mutationFn: async () => {
      const c = connSnapshot
      writeConnection(null)
      if (c) await api.wallets.disconnect(c.connectionId).catch(() => undefined)
    },
  })
  return { connection, connect, disconnect }
}

// ── Idempotent order placement ────────────────────────────────────────────

const ATTEMPT_KEY = 'kurio:checkout-attempt'
type Attempt = { key: string; fingerprint: string; userId: string; orderId?: string }

const readAttempt = (): Attempt | null => {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY)
    const a = raw ? (JSON.parse(raw) as Attempt) : null
    return a && a.userId === sessionStore.userId() ? a : null
  } catch {
    return null
  }
}
const writeAttempt = (a: Attempt | null) => {
  try {
    if (a) sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(a))
    else sessionStorage.removeItem(ATTEMPT_KEY)
  } catch {
    // ignore
  }
}

export const ORDER_REQUEST_TIMEOUT_MS = 8000
const AUTO_RETRIES = 2

/**
 * Places the order with an Idempotency-Key that is reused for every retry of
 * the *same* payload (timeouts, network drops, double clicks, refresh). The
 * server answers the same order for the same key, so no duplicate purchase
 * can be created. A different payload (e.g. after a re-quote) gets a new key.
 */
export const PLACE_ORDER_KEY = ['place-order'] as const

export function usePlaceOrder() {
  const qc = useQueryClient()
  const owner = useOwner()
  const router = useRouter()
  const inFlight = useRef<Promise<Order> | null>(null)

  const mutation = useMutation({
    mutationKey: PLACE_ORDER_KEY,
    mutationFn: async (body: CreateOrderRequest): Promise<Order> => {
      if (inFlight.current) return inFlight.current
      const run = async () => {
        const fingerprint = JSON.stringify(body)
        let attempt = readAttempt()
        if (!attempt || attempt.fingerprint !== fingerprint) {
          attempt = { key: crypto.randomUUID(), fingerprint, userId: sessionStore.userId()! }
          writeAttempt(attempt)
        }
        let lastError: ApiError | null = null
        for (let i = 0; i <= AUTO_RETRIES; i++) {
          // Timer-based timeout (instead of XHR's native one) so it follows the
          // page clock — deterministic in tests.
          const controller = new AbortController()
          let timedOut = false
          const timer = setTimeout(() => {
            timedOut = true
            controller.abort()
          }, ORDER_REQUEST_TIMEOUT_MS)
          try {
            const order = await api.orders.create(body, attempt.key, { signal: controller.signal })
            writeAttempt({ ...attempt, orderId: order.id })
            return order
          } catch (e) {
            lastError = timedOut
              ? new ApiError({ kind: 'timeout', message: 'O servidor demorou para responder', cause: e })
              : toApiError(e)
            if (!lastError.isTransient) break
            await new Promise((r) => setTimeout(r, 600 * 2 ** i))
          } finally {
            clearTimeout(timer)
          }
        }
        throw lastError!
      }
      inFlight.current = run().finally(() => {
        inFlight.current = null
      })
      return inFlight.current
    },
    // Mutation-level callbacks run even if the checkout unmounted meanwhile
    // (e.g. the cart emptied because the order already settled).
    onSuccess: (order) => {
      qc.setQueryData(qk.order(owner, order.id), order)
      void qc.invalidateQueries({ queryKey: ['private', owner, 'orders'] })
      void router.navigate({ to: '/pedido/$orderId', params: { orderId: order.id } })
    },
    onError: (err) => {
      const e = toApiError(err)
      if (e.code === 'QUOTE_STALE') {
        // The payload will change after re-confirmation → next try gets a new key.
        writeAttempt(null)
        const parsed = Quote.safeParse((e.details as { quote?: unknown } | undefined)?.quote)
        if (parsed.success) qc.setQueryData(qk.quote(owner, parsed.data.network), parsed.data)
        void qc.invalidateQueries({ queryKey: qk.cart(owner) })
      }
    },
  })
  return mutation
}

export const clearCheckoutAttempt = () => writeAttempt(null)
export const pendingAttemptOrderId = () => readAttempt()?.orderId ?? null

// ── Order status ──────────────────────────────────────────────────────────

export function useOrder(id: string) {
  const owner = useOwner()
  const status = useSyncExternalStore(realtimeStatus.subscribe, realtimeStatus.get)
  return useQuery({
    queryKey: qk.order(owner, id),
    queryFn: ({ signal }) => api.orders.get(id, { signal }),
    // Realtime is the primary channel; poll only while pending and the
    // socket is not connected (fallback, also covers missed events).
    refetchInterval: (q) => {
      const o = q.state.data
      if (!o || isTerminalStatus(o.status)) return false
      return status === 'connected' ? 15_000 : 3_000
    },
  })
}

export function usePendingOrders(enabled = true) {
  const owner = useOwner()
  return useQuery({
    queryKey: qk.orders(owner, 'pending'),
    queryFn: ({ signal }) => api.orders.list('pending', { signal }),
    enabled,
  })
}
