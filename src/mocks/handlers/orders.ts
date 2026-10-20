import { delay, http } from 'msw'
import { CreateOrderRequest, type ActiveOrdersResponse, type Order } from '@/api/contracts'
import { eth } from '@/lib/eth'
import { db, persist } from '../db/store'
import type { DbOrder } from '../db/types'
import { computeQuote, publicQuote, resolveCart } from '../domain/cart'
import { touchNft } from '../domain/catalog'
import { orderView, reserveStock, scheduleSettlement, settleIfDue } from '../domain/orders'
import { API, fail, json, nowIso, parseBody, readJson, route, sessionUser } from '../lib/http'
import { randomId, sha256Hex } from '../lib/random'
import { buildNftUpdatedEvent, dropAllSockets, sendNftUpdated } from '../realtime'
import { consumeBool, scenario } from '../scenarios'

/** Scenario helpers: mutate the catalog "while the collector is checking out". */
function simulateCatalogChange(editionId: string, kind: 'price' | 'soldout') {
  const nft = db.nfts.find((n) => n.editions.some((e) => e.id === editionId))
  const edition = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !edition) return
  if (kind === 'price') edition.priceEth = eth.round(eth.mul(edition.priceEth, '1.08'), 3)
  else edition.available = 0
  touchNft(nft)
  sendNftUpdated(buildNftUpdatedEvent(nft))
}

export const orderHandlers = [
  http.post(
    `${API}/orders`,
    route(async ({ request }) => {
      const user = sessionUser(request, { required: true })
      const key = request.headers.get('idempotency-key')
      if (!key || key.length < 8) return fail('VALIDATION_ERROR', 'Cabeçalho Idempotency-Key é obrigatório')

      const raw = await readJson(request)
      const requestHash = await sha256Hex(JSON.stringify(raw))

      // ── Idempotency: same key + same payload → same order ────────────
      const previous = db.idempotency.find((i) => i.key === key && i.userId === user.id)
      if (previous) {
        if (previous.requestHash !== requestHash) {
          return fail('IDEMPOTENCY_CONFLICT', 'Esta tentativa de compra já foi usada com outros dados')
        }
        const order = db.orders.find((o) => o.id === previous.orderId)!
        settleIfDue(order)
        return json<Order>(orderView(order), { status: 200 })
      }

      const body = parseBody(CreateOrderRequest, raw)
      const stored = db.quotes.find((q) => q.id === body.quoteId && q.userId === user.id)
      const cart = resolveCart(request, user)

      // Scenarios: the catalog changes between review and confirmation.
      const firstEdition = stored?.lines[0]?.editionId
      if (firstEdition && consumeBool('priceChangeOnCheckout')) simulateCatalogChange(firstEdition, 'price')
      if (firstEdition && consumeBool('soldOutOnCheckout')) simulateCatalogChange(firstEdition, 'soldout')

      // ── Revalidate price, availability, coupon and fees ──────────────
      const fresh = computeQuote(cart, stored?.network ?? 'ethereum', user.id)
      const expired = !stored || Date.parse(stored.expiresAt) <= Date.now()
      if (expired || stored.fingerprint !== fresh.fingerprint || !fresh.purchasable) {
        return fail('QUOTE_STALE', 'Preço, disponibilidade ou taxas mudaram. Revise o pedido antes de confirmar.', {
          details: { quote: publicQuote(fresh) },
        })
      }

      const connection = db.walletConnections.find((c) => c.id === body.walletConnectionId && c.userId === user.id)
      if (!connection || connection.network !== fresh.network) {
        return fail('WALLET_NOT_CONNECTED', 'Conecte uma carteira na rede selecionada para continuar')
      }
      const wallets = db.wallets[user.id]
      const wallet = [wallets?.primary, wallets?.secondary].find((w) => w?.id === connection.walletId)
      if (!wallet) return fail('WALLET_NOT_CONNECTED', 'Carteira não encontrada')

      const createdAt = nowIso()
      const order: DbOrder = {
        id: `ord_${Date.now().toString(36)}${randomId('').slice(1, 7)}`,
        userId: user.id,
        status: 'pending',
        version: 1,
        txHash: null,
        explorerUrl: null,
        declineReason: null,
        snapshot: {
          lines: fresh.lines,
          subtotalEth: fresh.subtotalEth,
          discountEth: fresh.discountEth,
          couponCode: fresh.coupon?.code ?? null,
          networkFeeEth: fresh.networkFeeEth,
          totalEth: fresh.totalEth,
          network: fresh.network,
          walletType: connection.provider,
          walletAddress: wallet.address,
        },
        collector: body.collector,
        cartId: cart.id,
        settleAt: Date.now() + scenario.orderSettleMs,
        outcome: scenario.paymentDeclined ? 'declined' : 'confirmed',
        createdAt,
        updatedAt: createdAt,
      }
      db.orders.push(order)
      db.idempotency.push({ key, userId: user.id, requestHash, orderId: order.id })
      reserveStock(order, 1)
      scheduleSettlement(order)

      if (scenario.dropSocketOnOrder > 0) {
        setTimeout(() => dropAllSockets(scenario.dropSocketOnOrder), 50)
      }
      if (consumeBool('orderTimeout')) {
        // The order exists server-side, but the client never gets the reply.
        persist()
        await delay('infinite')
      }
      return json<Order>(orderView(order), { status: 201 })
    }),
  ),

  http.get(
    `${API}/orders`,
    route(({ request }) => {
      const user = sessionUser(request, { required: true })
      const status = new URL(request.url).searchParams.get('status')
      const mine = db.orders.filter((o) => o.userId === user.id)
      mine.forEach(settleIfDue)
      const items = mine
        .filter((o) => !status || o.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(orderView)
      return json<ActiveOrdersResponse>({ items })
    }),
  ),

  http.get(
    `${API}/orders/:id`,
    route(({ request, params }) => {
      const user = sessionUser(request, { required: true })
      const order = db.orders.find((o) => o.id === params.id)
      // Other users' orders are reported as missing (no existence leak).
      if (!order || order.userId !== user.id) return fail('NOT_FOUND', 'Pedido não encontrado')
      settleIfDue(order)
      return json<Order>(orderView(order))
    }),
  ),
]
