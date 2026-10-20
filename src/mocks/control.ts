import { SOCKET_EVENTS, type NftUpdatedEvent, type OrderUpdatedEvent } from '@/api/contracts'
import { db, persist, resetDb } from './db/store'
import { findNft, touchNft } from './domain/catalog'
import { settleOrder } from './domain/orders'
import {
  broadcastRaw,
  buildNftUpdatedEvent,
  connectedClients,
  dropAllSockets,
  sendNftUpdated,
  sendOrderUpdated,
  sentEvents,
} from './realtime'
import { DEFAULT_SCENARIO, PRESETS, scenario, setScenario, type ScenarioConfig } from './scenarios'

/**
 * Control surface of the simulated backend (`window.__kurioMock`). Used by
 * Playwright and by the demo panel. Every action changes the mock "server"
 * state and, when relevant, emits through the mocked Socket.IO server — the
 * app only ever observes these changes via REST and socket.io-client.
 */
export const mockControl = {
  presets: Object.keys(PRESETS),
  getScenario: (): ScenarioConfig => ({ ...scenario }),
  setScenario: (s: string | Partial<ScenarioConfig>) => setScenario(s),

  /** Restore the seed database and default scenario. */
  reset() {
    resetDb()
    setScenario({ ...DEFAULT_SCENARIO })
    sentEvents.length = 0
    dropAllSockets(0)
  },

  /** Change price and/or availability of an edition, emitting nft.updated. */
  updateNft(nftId: string, patch: { editionId?: string; priceEth?: string; available?: number }) {
    const nft = findNft(nftId)
    if (!nft) throw new Error(`NFT ${nftId} não existe`)
    const edition = nft.editions.find((e) => e.id === (patch.editionId ?? nft.defaultEditionId))
    if (!edition) throw new Error('Edição não existe')
    if (patch.priceEth !== undefined) edition.priceEth = patch.priceEth
    if (patch.available !== undefined) edition.available = patch.available
    touchNft(nft)
    persist()
    const event = buildNftUpdatedEvent(nft)
    sendNftUpdated(event)
    return event
  },

  /** Re-send the last event of a type (duplicate delivery). */
  replayLast(type: 'nft.updated' | 'order.updated') {
    const last = [...sentEvents].reverse().find((e) => e.type === type)
    if (!last) return null
    if (last.type === 'nft.updated') sendNftUpdated(last)
    else sendOrderUpdated(last)
    return last
  },

  /** Send an nft.updated older than the current version (out-of-order delivery). */
  sendStaleNftEvent(nftId: string, priceEth = '0.01') {
    const nft = findNft(nftId)
    if (!nft) throw new Error(`NFT ${nftId} não existe`)
    const current = buildNftUpdatedEvent(nft)
    const stale: NftUpdatedEvent = {
      ...current,
      version: Math.max(0, nft.version - 1),
      data: {
        ...current.data,
        priceEth,
        editions: current.data.editions.map((e) => (e.id === nft.defaultEditionId ? { ...e, priceEth } : e)),
      },
    }
    sendNftUpdated(stale)
    return stale
  },

  /** Deliver an order event of `ownerId` to every socket (cross-user leak test). */
  leakOrderEventTo(orderId: string) {
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) throw new Error('Pedido não existe')
    const event: OrderUpdatedEvent = {
      eventId: `evt_leak_${Date.now()}`,
      type: 'order.updated',
      occurredAt: new Date().toISOString(),
      version: order.version + 100,
      resource: { type: 'order', id: order.id },
      userId: order.userId,
      data: { status: 'declined', txHash: null, explorerUrl: null, declineReason: 'leak' },
    }
    broadcastRaw(SOCKET_EVENTS.orderUpdated, event)
    return event
  },

  /** Disconnect all sockets; refuse reconnections for `blockMs`. */
  dropSockets: (blockMs = 0) => dropAllSockets(blockMs),

  /** Expire every active session (server side). */
  expireSessions() {
    const past = new Date(Date.now() - 1000).toISOString()
    for (const s of db.sessions) s.expiresAt = past
    persist()
  },

  settleOrder(orderId: string, outcome: 'confirmed' | 'declined') {
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) throw new Error('Pedido não existe')
    settleOrder(order, outcome)
  },

  orders: () => db.orders.map((o) => ({ id: o.id, userId: o.userId, status: o.status, version: o.version })),
  clients: connectedClients,
}

export type MockControl = typeof mockControl

declare global {
  interface Window {
    __kurioMock?: MockControl
  }
}
