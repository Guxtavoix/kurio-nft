import type { QueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import {
  NftUpdatedEvent,
  OrderUpdatedEvent,
  SOCKET_EVENTS,
  SOCKET_PATH,
  type NftDetail,
  type NftListResponse,
  type NftSummary,
  type Order,
  type FeaturedResponse,
} from '@/api/contracts'
import { qk, type Owner } from '@/api/query-keys'
import { announce } from '@/lib/announcer'
import { formatEth } from '@/lib/eth'
import { currentOwner, sessionStore } from '@/session/store'

/**
 * Realtime layer over socket.io-client.
 *
 * Guarantees:
 *  - dedupe by eventId (duplicates are ignored, effects applied once);
 *  - ordering by resource version (older events never regress newer state,
 *    including state that came from REST);
 *  - order events are applied only if they belong to the current user;
 *  - one socket per session: on login/logout/user switch the old socket and
 *    all its listeners are torn down before a new one is created;
 *  - after a reconnect, active resources are reconciled with REST.
 */

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

type StatusListener = (s: ConnectionStatus) => void

const SEEN_LIMIT = 500

export class RealtimeClient {
  private socket: Socket | null = null
  private status: ConnectionStatus = 'idle'
  private statusListeners = new Set<StatusListener>()
  private seen = new Set<string>()
  private versions = new Map<string, number>()
  private hadConnection = false
  private readonly qc: QueryClient
  private readonly url: string

  constructor(qc: QueryClient, url: string) {
    this.qc = qc
    this.url = url
  }

  // ── lifecycle ────────────────────────────────────────────────────────

  /** (Re)connect for the current session. Always tears down the previous socket. */
  connect() {
    this.disconnect()
    const token = sessionStore.token()
    const socket = io(this.url, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
      timeout: 8000,
    })
    this.socket = socket
    this.hadConnection = false
    this.setStatus('connecting')

    socket.on('connect', () => {
      const isReconnect = this.hadConnection
      this.hadConnection = true
      this.setStatus('connected')
      if (isReconnect) {
        announce('Conexão em tempo real restabelecida. Atualizando dados.')
        void this.reconcile()
      }
    })
    socket.on('disconnect', (reason) => {
      // Server-side disconnect doesn't auto-reconnect in socket.io; force it.
      if (reason === 'io server disconnect') socket.connect()
      this.setStatus(this.hadConnection ? 'reconnecting' : 'connecting')
    })
    socket.on('connect_error', () => {
      this.setStatus(this.hadConnection ? 'reconnecting' : 'offline')
    })
    socket.on(SOCKET_EVENTS.nftUpdated, (raw: unknown) => this.onNftUpdated(raw))
    socket.on(SOCKET_EVENTS.orderUpdated, (raw: unknown) => this.onOrderUpdated(raw, socket))
  }

  disconnect() {
    if (!this.socket) return
    this.socket.removeAllListeners()
    this.socket.io.removeAllListeners()
    this.socket.disconnect()
    this.socket = null
    this.setStatus('idle')
  }

  /** Test/diagnostic helper. */
  get connected() {
    return this.socket?.connected ?? false
  }

  getStatus() {
    return this.status
  }

  onStatus(l: StatusListener) {
    this.statusListeners.add(l)
    return () => void this.statusListeners.delete(l)
  }

  private setStatus(s: ConnectionStatus) {
    if (s === this.status) return
    this.status = s
    for (const l of this.statusListeners) l(s)
  }

  // ── dedupe / ordering ────────────────────────────────────────────────

  private firstTime(eventId: string) {
    if (this.seen.has(eventId)) return false
    this.seen.add(eventId)
    if (this.seen.size > SEEN_LIMIT) this.seen.delete(this.seen.values().next().value!)
    return true
  }

  /** True when `version` is newer than everything we know for `key`. */
  private isNewer(key: string, version: number, knownFromCache?: number) {
    const known = Math.max(this.versions.get(key) ?? -1, knownFromCache ?? -1)
    if (version <= known) return false
    this.versions.set(key, version)
    return true
  }

  // ── handlers ─────────────────────────────────────────────────────────

  private onNftUpdated(raw: unknown) {
    const parsed = NftUpdatedEvent.safeParse(raw)
    if (!parsed.success) return
    const e = parsed.data
    if (!this.firstTime(e.eventId)) return
    const id = e.resource.id
    const cached = this.qc.getQueryData<NftDetail>(qk.nfts.detail(id))
    if (!this.isNewer(`nft:${id}`, e.version, cached?.version)) return

    const patchSummary = <T extends NftSummary>(n: T): T =>
      n.id === id && n.version < e.version
        ? { ...n, priceEth: e.data.priceEth, compareAtPriceEth: e.data.compareAtPriceEth, soldOut: e.data.soldOut, version: e.version }
        : n

    this.qc.setQueryData<NftDetail>(qk.nfts.detail(id), (prev) =>
      prev && prev.version < e.version
        ? {
            ...patchSummary(prev),
            editions: prev.editions.map((ed) => {
              const u = e.data.editions.find((x) => x.id === ed.id)
              return u ? { ...ed, priceEth: u.priceEth, available: u.available } : ed
            }),
          }
        : prev,
    )
    this.qc.setQueriesData<NftListResponse>({ queryKey: qk.nfts.lists() }, (prev) =>
      prev ? { ...prev, items: prev.items.map(patchSummary) } : prev,
    )
    this.qc.setQueryData<FeaturedResponse>(qk.nfts.featured(), (prev) =>
      prev ? { hero: prev.hero.map(patchSummary), spotlight: prev.spotlight && patchSummary(prev.spotlight) } : prev,
    )
    this.qc.setQueriesData<NftSummary[]>({ queryKey: ['nfts', 'related'] }, (prev) => prev?.map(patchSummary))

    // Cart & quote are server-computed: refetch so lines/totals reflect it.
    const owner = currentOwner()
    const cart = this.qc.getQueryData<{ lines: { nftId: string; name: string }[] }>(qk.cart(owner))
    const inCart = cart?.lines.find((l) => l.nftId === id)
    void this.qc.invalidateQueries({ queryKey: qk.cart(owner) })
    void this.qc.invalidateQueries({ queryKey: qk.quotes(owner) })
    if (inCart) {
      announce(
        e.data.soldOut
          ? `${inCart.name} esgotou. Revise seu carrinho.`
          : `${inCart.name} foi atualizado: preço atual ${formatEth(e.data.priceEth)}. Revise seu carrinho.`,
        'assertive',
      )
    }
  }

  private onOrderUpdated(raw: unknown, socket: Socket) {
    // Ignore events delivered to a socket that is no longer the active one.
    if (socket !== this.socket) return
    const parsed = OrderUpdatedEvent.safeParse(raw)
    if (!parsed.success) return
    const e = parsed.data
    const userId = sessionStore.userId()
    if (!userId || e.userId !== userId) return
    if (!this.firstTime(e.eventId)) return
    const owner: Owner = `user:${userId}`
    const key = qk.order(owner, e.resource.id)
    const cached = this.qc.getQueryData<Order>(key)
    if (!this.isNewer(`order:${e.resource.id}`, e.version, cached?.version)) return
    // Terminal states never go back to pending.
    if (cached && cached.status !== 'pending' && e.data.status === 'pending') return

    if (cached) {
      this.qc.setQueryData<Order>(key, { ...cached, ...e.data, version: e.version, updatedAt: e.occurredAt })
    } else {
      void this.qc.invalidateQueries({ queryKey: key })
    }
    void this.qc.invalidateQueries({ queryKey: ['private', owner, 'orders'] })
    if (e.data.status === 'confirmed') {
      void this.qc.invalidateQueries({ queryKey: qk.cart(owner) })
      void this.qc.invalidateQueries({ queryKey: qk.quotes(owner) })
    }
  }

  /** After reconnecting, refetch whatever the UI is showing. */
  private async reconcile() {
    await Promise.all([
      this.qc.invalidateQueries({ queryKey: qk.nfts.all, refetchType: 'active' }),
      this.qc.invalidateQueries({ queryKey: ['private'], refetchType: 'active' }),
    ])
  }
}
