import type { Order } from '@/api/contracts'
import { db, persist } from '../db/store'
import type { DbOrder } from '../db/types'
import { nowIso } from '../lib/http'
import { randomHex } from '../lib/random'
import { buildNftUpdatedEvent, buildOrderUpdatedEvent, sendNftUpdated, sendOrderUpdated } from '../realtime'
import { bumpCart } from './cart'
import { findNft, touchNft } from './catalog'

const EXPLORERS = {
  ethereum: 'https://sepolia.etherscan.io/tx/',
  polygon: 'https://amoy.polygonscan.com/tx/',
  solana: 'https://explorer.solana.com/tx/',
} as const

export function orderView(o: DbOrder): Order {
  return {
    id: o.id,
    status: o.status,
    version: o.version,
    txHash: o.txHash,
    explorerUrl: o.explorerUrl,
    declineReason: o.declineReason,
    snapshot: o.snapshot,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }
}

/** Stock is reserved when the order is created and released if declined. */
export function reserveStock(order: DbOrder, sign: 1 | -1) {
  const touched = new Set<string>()
  for (const line of order.snapshot.lines) {
    const nft = findNft(line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition || edition.supply === null) continue
    edition.available = Math.max(0, edition.available - sign * line.quantity)
    touched.add(nft.id)
  }
  for (const id of touched) {
    const nft = findNft(id)!
    touchNft(nft)
    sendNftUpdated(buildNftUpdatedEvent(nft))
  }
}

/** Settle a pending order (simulated chain confirmation). Idempotent. */
export function settleOrder(order: DbOrder, outcome: DbOrder['outcome'] = order.outcome) {
  if (order.status !== 'pending') return
  order.status = outcome
  order.version += 1
  order.updatedAt = nowIso()
  if (outcome === 'confirmed') {
    order.txHash = `0x${randomHex(64)}`
    order.explorerUrl = `${EXPLORERS[order.snapshot.network]}${order.txHash}`
    removePurchasedFromCart(order)
  } else {
    order.declineReason = 'Pagamento recusado pela carteira: saldo insuficiente para cobrir o total e a taxa de rede.'
    reserveStock(order, -1)
  }
  persist()
  sendOrderUpdated(buildOrderUpdatedEvent(order))
}

/** Remove only the purchased quantities; anything added later stays. */
function removePurchasedFromCart(order: DbOrder) {
  const cart = db.carts.find((c) => c.id === order.cartId)
  if (!cart) return
  for (const bought of order.snapshot.lines) {
    const line = cart.lines.find((l) => l.editionId === bought.editionId)
    if (!line) continue
    line.quantity -= bought.quantity
  }
  cart.lines = cart.lines.filter((l) => l.quantity > 0)
  if (cart.lines.length === 0) cart.couponCode = null
  bumpCart(cart)
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function scheduleSettlement(order: DbOrder) {
  if (order.status !== 'pending' || timers.has(order.id)) return
  const wait = Math.max(0, order.settleAt - Date.now())
  timers.set(
    order.id,
    setTimeout(() => {
      timers.delete(order.id)
      settleOrder(order)
    }, wait),
  )
}

/** After a page reload the timers are gone: re-arm or settle overdue orders. */
export function resumePendingOrders() {
  for (const o of db.orders) if (o.status === 'pending') scheduleSettlement(o)
}

/** Lazy settlement on read, in case timers were throttled in the background. */
export function settleIfDue(order: DbOrder) {
  if (order.status === 'pending' && Date.now() >= order.settleAt) {
    timers.delete(order.id)
    settleOrder(order)
  }
}
