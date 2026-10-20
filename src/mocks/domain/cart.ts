import type { Cart, CartLine, CartLineStatus, Network, Quote, QuoteIssue } from '@/api/contracts'
import { eth } from '@/lib/eth'
import { db } from '../db/store'
import type { DbCart, DbQuote, DbUser } from '../db/types'
import { COUPONS, NETWORK_FEES } from '../fixtures/coupons'
import { fail, nowIso } from '../lib/http'
import { randomId } from '../lib/random'
import { findNft } from './catalog'

export const GUEST_CART_HEADER = 'x-cart-id'
const QUOTE_TTL_MS = 10 * 60 * 1000

function newCart(id: string, userId: string | null): DbCart {
  const cart: DbCart = { id, userId, lines: [], couponCode: null, version: 1, updatedAt: nowIso() }
  db.carts.push(cart)
  return cart
}

/**
 * Authenticated requests always use the user's cart (never a guest one, so a
 * guest id can't be used to read someone else's cart). Guests are identified
 * by an opaque client-generated id in the X-Cart-Id header.
 */
export function resolveCart(request: Request, user: DbUser | null): DbCart {
  if (user) {
    return db.carts.find((c) => c.userId === user.id) ?? newCart(randomId('cart'), user.id)
  }
  const guestId = request.headers.get(GUEST_CART_HEADER)
  if (!guestId || !/^guest_[a-z0-9_-]{8,64}$/i.test(guestId)) {
    return fail('VALIDATION_ERROR', 'Identificador de carrinho ausente')
  }
  const existing = db.carts.find((c) => c.id === guestId)
  if (existing && existing.userId) return fail('FORBIDDEN', 'Carrinho pertence a outro usuário')
  return existing ?? newCart(guestId, null)
}

export function bumpCart(cart: DbCart) {
  cart.version += 1
  cart.updatedAt = nowIso()
}

/** Moves guest lines into the user cart, respecting per-order limits. */
export function mergeGuestCart(guestCartId: string | undefined, userId: string) {
  if (!guestCartId) return
  const guest = db.carts.find((c) => c.id === guestCartId && c.userId === null)
  if (!guest || guest.lines.length === 0) return
  const userCart = db.carts.find((c) => c.userId === userId) ?? newCart(randomId('cart'), userId)
  for (const line of guest.lines) {
    const nft = findNft(line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) continue
    const existing = userCart.lines.find((l) => l.editionId === line.editionId)
    const limit = Math.min(edition.maxPerOrder, Math.max(edition.available, 1))
    if (existing) existing.quantity = Math.min(limit, existing.quantity + line.quantity)
    else userCart.lines.push({ ...line, id: randomId('line'), quantity: Math.min(limit, line.quantity) })
  }
  userCart.couponCode ??= guest.couponCode
  bumpCart(userCart)
  db.carts = db.carts.filter((c) => c.id !== guest.id)
}

function lineStatus(unit: string, ack: string, qty: number, available: number): CartLineStatus {
  if (available === 0) return 'sold_out'
  if (qty > available) return 'insufficient'
  if (!eth.eq(unit, ack)) return 'price_changed'
  return 'ok'
}

export function cartView(cart: DbCart): Cart {
  const lines: CartLine[] = []
  for (const l of cart.lines) {
    const nft = findNft(l.nftId)
    const edition = nft?.editions.find((e) => e.id === l.editionId)
    if (!nft || !edition) continue
    lines.push({
      id: l.id,
      nftId: nft.id,
      editionId: edition.id,
      slug: nft.slug,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      imageAlt: nft.imageAlt,
      editionLabel: edition.label,
      network: nft.network,
      quantity: l.quantity,
      unitPriceEth: edition.priceEth,
      acknowledgedPriceEth: l.acknowledgedPriceEth,
      lineTotalEth: eth.mul(edition.priceEth, l.quantity),
      available: edition.available,
      maxPerOrder: edition.maxPerOrder,
      status: lineStatus(edition.priceEth, l.acknowledgedPriceEth, l.quantity, edition.available),
      nftVersion: nft.version,
    })
  }
  return {
    id: cart.id,
    owner: cart.userId ? 'user' : 'guest',
    lines,
    itemCount: lines.reduce((acc, l) => acc + l.quantity, 0),
    couponCode: cart.couponCode,
    version: cart.version,
    updatedAt: cart.updatedAt,
  }
}

export function findCoupon(code: string) {
  return COUPONS.find((c) => c.code.toLowerCase() === code.trim().toLowerCase())
}

export function validateCoupon(code: string) {
  const coupon = findCoupon(code)
  if (!coupon) return fail('COUPON_INVALID', 'Código promocional inválido', { fieldErrors: { code: 'Código inválido' } })
  if (Date.parse(coupon.expiresAt) <= Date.now()) {
    return fail('COUPON_EXPIRED', 'Este código promocional expirou', { fieldErrors: { code: 'Código expirado' } })
  }
  return coupon
}

/** Server-side pricing. Stored so orders can reference it by id. */
export function computeQuote(cart: DbCart, network: Network, userId: string | null): DbQuote {
  const view = cartView(cart)
  const issues: QuoteIssue[] = []
  for (const l of view.lines) {
    if (l.status === 'sold_out') {
      issues.push({ type: 'sold_out', lineId: l.id, message: `${l.name} (${l.editionLabel}) esgotou.` })
    } else if (l.status === 'insufficient') {
      issues.push({
        type: 'insufficient',
        lineId: l.id,
        message: `${l.name} (${l.editionLabel}): restam apenas ${l.available} unidade(s).`,
      })
    } else if (l.status === 'price_changed') {
      issues.push({
        type: 'price_changed',
        lineId: l.id,
        message: `O preço de ${l.name} mudou de ${l.acknowledgedPriceEth} para ${l.unitPriceEth} ETH.`,
      })
    }
  }

  const purchasableLines = view.lines.filter((l) => l.status !== 'sold_out')
  const subtotal = purchasableLines.length ? eth.add(...purchasableLines.map((l) => l.lineTotalEth)) : '0'

  let coupon: Quote['coupon'] = null
  let discount = '0'
  if (cart.couponCode) {
    const def = findCoupon(cart.couponCode)
    if (def && Date.parse(def.expiresAt) > Date.now()) {
      coupon = { code: def.code, description: def.description }
      discount = eth.round(eth.percent(subtotal, def.percentOff), 6)
    } else {
      issues.push({ type: 'coupon_expired', lineId: null, message: 'O cupom aplicado expirou e foi removido do cálculo.' })
    }
  }

  const fee = purchasableLines.length ? NETWORK_FEES[network] : '0'
  const total = eth.add(eth.sub(subtotal, discount), fee)
  const createdAt = new Date()
  const quote: DbQuote = {
    id: randomId('quote'),
    cartVersion: cart.version,
    network,
    lines: purchasableLines.map((l) => ({
      lineId: l.id,
      nftId: l.nftId,
      editionId: l.editionId,
      name: l.name,
      tokenId: l.tokenId,
      image: l.image,
      imageAlt: l.imageAlt,
      editionLabel: l.editionLabel,
      quantity: l.quantity,
      unitPriceEth: l.unitPriceEth,
      lineTotalEth: l.lineTotalEth,
    })),
    subtotalEth: subtotal,
    discountEth: discount,
    coupon,
    networkFeeEth: fee,
    totalEth: total,
    issues,
    purchasable: view.lines.length > 0 && issues.every((i) => i.type === 'coupon_expired'),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + QUOTE_TTL_MS).toISOString(),
    userId,
    cartId: cart.id,
    fingerprint: '',
  }
  quote.fingerprint = fingerprintOf(quote)
  // Keep the quote table small.
  db.quotes = [...db.quotes.filter((q) => q.cartId !== cart.id).slice(-50), quote]
  return quote
}

export function fingerprintOf(q: Quote) {
  return JSON.stringify([
    q.network,
    q.lines.map((l) => [l.editionId, l.quantity, l.unitPriceEth]),
    q.subtotalEth,
    q.discountEth,
    q.networkFeeEth,
    q.totalEth,
    q.issues.map((i) => i.type),
  ])
}

export function publicQuote(q: DbQuote): Quote {
  const { userId: _u, cartId: _c, fingerprint: _f, ...rest } = q
  return rest
}
