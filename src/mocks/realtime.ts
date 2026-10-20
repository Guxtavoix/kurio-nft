import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws, type WebSocketHandlerConnection } from 'msw'
import type { NftDetail, NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts'
import { SOCKET_EVENTS, SOCKET_PATH } from '@/api/contracts'
import { db, nextEventId } from './db/store'
import type { DbOrder } from './db/types'
import { scenario } from './scenarios'

/**
 * Socket.IO server simulated at the network layer. The app talks to it with
 * the real `socket.io-client` over a WebSocket that MSW intercepts;
 * `@mswjs/socket.io-binding` encodes/decodes the Engine.IO/Socket.IO frames.
 *
 * Limitations of the binding (documented in ARCHITECTURE.md): default
 * namespace only, no rooms/acks, and the handshake is faked by the binding.
 * We add what the app needs on top: per-connection auth (read from the raw
 * CONNECT packet), user-scoped delivery for order events, heartbeats and
 * forced disconnects for failure scenarios.
 */

type Client = {
  conn: WebSocketHandlerConnection
  io: ReturnType<typeof toSocketIo>
  userId: string | null
  heartbeat: ReturnType<typeof setInterval>
}

const clients = new Map<string, Client>()
let blockedUntil = 0

/**
 * Socket.IO endpoint: same origin as the app, Socket.IO `path` = /realtime/.
 * (A dedicated path keeps it apart from Vite's HMR socket; MSW also rewrites
 * the default /socket.io/ path, which would collide with it.)
 */
const SOCKET_URL = `${(import.meta.env.VITE_SOCKET_URL ?? globalThis.location?.origin ?? 'http://localhost').replace(/^http/, 'ws')}${SOCKET_PATH}`

export const realtime = ws.link(SOCKET_URL)

function userIdFromToken(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const s = db.sessions.find((x) => x.token === token)
  if (!s || Date.parse(s.expiresAt) <= Date.now()) return null
  return s.userId
}

export const realtimeHandler = realtime.addEventListener('connection', (conn) => {
  if (scenario.offline || Date.now() < blockedUntil) {
    // Refuse: the client will keep retrying with backoff.
    queueMicrotask(() => conn.client.close())
    return
  }

  const io = toSocketIo(conn)
  const client: Client = {
    conn,
    io,
    userId: null,
    // Engine.IO v4 heartbeat: server pings, client answers "3". Without it
    // socket.io-client drops the connection after pingInterval + pingTimeout.
    heartbeat: setInterval(() => conn.client.send('2'), 20_000),
  }
  clients.set(conn.client.id, client)

  // Read `auth` from the client's CONNECT packet: `40{"token":"..."}`.
  conn.client.addEventListener('message', (event) => {
    const data = event.data
    if (typeof data === 'string' && data.startsWith('40')) {
      try {
        const payload = data.length > 2 ? (JSON.parse(data.slice(2)) as { token?: unknown }) : {}
        client.userId = userIdFromToken(payload.token)
      } catch {
        client.userId = null
      }
    }
  })

  conn.client.addEventListener('close', () => {
    clearInterval(client.heartbeat)
    clients.delete(conn.client.id)
  })
})

// ── Emitters (used by REST handlers and the control API) ─────────────────

export function buildNftUpdatedEvent(nft: NftDetail): NftUpdatedEvent {
  return {
    eventId: nextEventId(),
    type: 'nft.updated',
    occurredAt: new Date().toISOString(),
    version: nft.version,
    resource: { type: 'nft', id: nft.id },
    data: {
      priceEth: nft.priceEth,
      compareAtPriceEth: nft.compareAtPriceEth,
      soldOut: nft.soldOut,
      editions: nft.editions.map((e) => ({ id: e.id, priceEth: e.priceEth, available: e.available })),
    },
  }
}

export function buildOrderUpdatedEvent(order: DbOrder): OrderUpdatedEvent {
  return {
    eventId: nextEventId(),
    type: 'order.updated',
    occurredAt: new Date().toISOString(),
    version: order.version,
    resource: { type: 'order', id: order.id },
    userId: order.userId,
    data: {
      status: order.status,
      txHash: order.txHash,
      explorerUrl: order.explorerUrl,
      declineReason: order.declineReason,
    },
  }
}

/** Recently sent events, so scenarios can replay duplicates / stale ones. */
export const sentEvents: (NftUpdatedEvent | OrderUpdatedEvent)[] = []
const remember = (e: NftUpdatedEvent | OrderUpdatedEvent) => {
  sentEvents.push(e)
  if (sentEvents.length > 50) sentEvents.shift()
}

/** Public catalog event → every connected client. */
export function sendNftUpdated(event: NftUpdatedEvent) {
  remember(event)
  for (const c of clients.values()) c.io.client.emit(SOCKET_EVENTS.nftUpdated, event)
}

/**
 * Private event → only sockets authenticated as the order owner.
 * `toUserId` lets the failure scenarios deliberately mis-deliver an event to
 * prove the client drops events that don't belong to its session.
 */
export function sendOrderUpdated(event: OrderUpdatedEvent, opts: { toUserId?: string } = {}) {
  remember(event)
  const target = opts.toUserId ?? event.userId
  for (const c of clients.values()) {
    if (c.userId === target) c.io.client.emit(SOCKET_EVENTS.orderUpdated, event)
  }
}

/** Broadcast to every socket regardless of user (only for misdelivery tests). */
export function broadcastRaw(name: string, event: unknown) {
  for (const c of clients.values()) c.io.client.emit(name, event)
}

/** Close every socket; new connections are refused for `blockMs`. */
export function dropAllSockets(blockMs = 0) {
  blockedUntil = Date.now() + blockMs
  for (const c of clients.values()) c.conn.client.close()
}

/** Disconnect sockets of a user (logout / session revoked). */
export function dropUserSockets(userId: string) {
  for (const c of clients.values()) if (c.userId === userId) c.conn.client.close()
}

export function connectedClients() {
  return [...clients.values()].map((c) => ({ id: c.conn.client.id, userId: c.userId }))
}
