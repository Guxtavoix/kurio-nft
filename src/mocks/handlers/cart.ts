import { http } from 'msw'
import {
  AddCartItemRequest,
  ApplyCouponRequest,
  Network,
  UpdateCartItemRequest,
  type Cart,
  type FavoritesResponse,
  type Quote,
} from '@/api/contracts'
import { db } from '../db/store'
import type { DbCart } from '../db/types'
import { bumpCart, cartView, computeQuote, publicQuote, resolveCart, validateCoupon } from '../domain/cart'
import { findNft, toSummary } from '../domain/catalog'
import { API, fail, json, parseBody, readJson, route, sessionUser } from '../lib/http'
import { randomId } from '../lib/random'
import { consume } from '../scenarios'

function assertQuantity(nftId: string, editionId: string, quantity: number) {
  const nft = findNft(nftId)
  if (!nft) return fail('NOT_FOUND', 'NFT não encontrado')
  const edition = nft.editions.find((e) => e.id === editionId)
  if (!edition) return fail('NOT_FOUND', 'Edição não encontrada')
  if (edition.available === 0) {
    return fail('AVAILABILITY_CONFLICT', `A edição ${edition.label} está esgotada`, {
      details: { available: 0, maxPerOrder: edition.maxPerOrder },
    })
  }
  const limit = Math.min(edition.available, edition.maxPerOrder)
  if (quantity > limit) {
    return fail('AVAILABILITY_CONFLICT', `Quantidade máxima para a edição ${edition.label}: ${limit}`, {
      details: { available: edition.available, maxPerOrder: edition.maxPerOrder },
      fieldErrors: { quantity: `Máximo de ${limit}` },
    })
  }
  return { nft, edition }
}

const cartJson = (cart: DbCart) => json<Cart>(cartView(cart))

export const cartHandlers = [
  // ── Favorites ──────────────────────────────────────────────────────────
  http.get(
    `${API}/me/favorites`,
    route(({ request }) => {
      const user = sessionUser(request, { required: true })
      const ids = db.favorites[user.id] ?? []
      return json<FavoritesResponse>({
        nftIds: ids,
        items: ids.map((id) => findNft(id)).filter(Boolean).map((n) => toSummary(n!)),
      })
    }),
  ),
  http.put(
    `${API}/me/favorites/:nftId`,
    route(({ request, params }) => {
      const user = sessionUser(request, { required: true })
      if (consume('favoriteFailures')) fail('INTERNAL', 'Não foi possível salvar o favorito')
      const nft = findNft(String(params.nftId))
      if (!nft) return fail('NOT_FOUND', 'NFT não encontrado')
      const set = new Set(db.favorites[user.id] ?? [])
      set.add(nft.id)
      db.favorites[user.id] = [...set]
      return new Response(null, { status: 204 })
    }),
  ),
  http.delete(
    `${API}/me/favorites/:nftId`,
    route(({ request, params }) => {
      const user = sessionUser(request, { required: true })
      if (consume('favoriteFailures')) fail('INTERNAL', 'Não foi possível remover o favorito')
      db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((id) => id !== params.nftId)
      return new Response(null, { status: 204 })
    }),
  ),

  // ── Cart ───────────────────────────────────────────────────────────────
  http.get(
    `${API}/cart`,
    route(({ request }) => cartJson(resolveCart(request, sessionUser(request)))),
  ),
  http.post(
    `${API}/cart/items`,
    route(async ({ request }) => {
      const cart = resolveCart(request, sessionUser(request))
      const body = parseBody(AddCartItemRequest, await readJson(request))
      const existing = cart.lines.find((l) => l.editionId === body.editionId)
      const { edition } = assertQuantity(body.nftId, body.editionId, (existing?.quantity ?? 0) + body.quantity)
      if (existing) {
        existing.quantity += body.quantity
        existing.acknowledgedPriceEth = edition.priceEth
      } else {
        cart.lines.push({
          id: randomId('line'),
          nftId: findNft(body.nftId)!.id,
          editionId: edition.id,
          quantity: body.quantity,
          acknowledgedPriceEth: edition.priceEth,
        })
      }
      bumpCart(cart)
      return cartJson(cart)
    }),
  ),
  http.patch(
    `${API}/cart/items/:lineId`,
    route(async ({ request, params }) => {
      const cart = resolveCart(request, sessionUser(request))
      const line = cart.lines.find((l) => l.id === params.lineId)
      if (!line) return fail('NOT_FOUND', 'Item não está no carrinho')
      const body = parseBody(UpdateCartItemRequest, await readJson(request))
      // Decreasing is always allowed (helps resolve "insufficient" lines).
      if (body.quantity > line.quantity) assertQuantity(line.nftId, line.editionId, body.quantity)
      line.quantity = body.quantity
      bumpCart(cart)
      return cartJson(cart)
    }),
  ),
  http.delete(
    `${API}/cart/items/:lineId`,
    route(({ request, params }) => {
      const cart = resolveCart(request, sessionUser(request))
      if (!cart.lines.some((l) => l.id === params.lineId)) return fail('NOT_FOUND', 'Item não está no carrinho')
      cart.lines = cart.lines.filter((l) => l.id !== params.lineId)
      bumpCart(cart)
      return cartJson(cart)
    }),
  ),
  /** Collector acknowledges price changes shown in the cart. */
  http.post(
    `${API}/cart/acknowledge`,
    route(({ request }) => {
      const cart = resolveCart(request, sessionUser(request))
      for (const l of cart.lines) {
        const edition = findNft(l.nftId)?.editions.find((e) => e.id === l.editionId)
        if (edition) l.acknowledgedPriceEth = edition.priceEth
      }
      bumpCart(cart)
      return cartJson(cart)
    }),
  ),
  http.put(
    `${API}/cart/coupon`,
    route(async ({ request }) => {
      const cart = resolveCart(request, sessionUser(request))
      const body = parseBody(ApplyCouponRequest, await readJson(request))
      const coupon = validateCoupon(body.code)
      cart.couponCode = coupon.code
      bumpCart(cart)
      return cartJson(cart)
    }),
  ),
  http.delete(
    `${API}/cart/coupon`,
    route(({ request }) => {
      const cart = resolveCart(request, sessionUser(request))
      cart.couponCode = null
      bumpCart(cart)
      return cartJson(cart)
    }),
  ),
  http.get(
    `${API}/cart/quote`,
    route(({ request }) => {
      const user = sessionUser(request)
      const cart = resolveCart(request, user)
      const net = new URL(request.url).searchParams.get('network') ?? 'ethereum'
      const network = parseBody(Network, net)
      return json<Quote>(publicQuote(computeQuote(cart, network, user?.id ?? null)))
    }),
  ),
]
