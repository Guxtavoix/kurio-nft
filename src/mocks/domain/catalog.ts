import {
  CATEGORIES,
  NETWORKS,
  type NftDetail,
  type NftListQuery,
  type NftListResponse,
  type NftSummary,
} from '@/api/contracts'
import { eth } from '@/lib/eth'
import { db } from '../db/store'
import { FIXTURE_EPOCH, popularityOf } from '../fixtures/nfts'

export function toSummary(n: NftDetail): NftSummary {
  return {
    id: n.id,
    slug: n.slug,
    name: n.name,
    tokenId: n.tokenId,
    image: n.image,
    imageAlt: n.imageAlt,
    category: n.category,
    network: n.network,
    collectionName: n.collectionName,
    priceEth: n.priceEth,
    compareAtPriceEth: n.compareAtPriceEth,
    badge: n.badge,
    soldOut: n.soldOut,
    createdAt: n.createdAt,
    version: n.version,
  }
}

export function findNft(id: string) {
  return db.nfts.find((n) => n.id === id || n.slug === id)
}

/** "Novos lançamentos": created within 14 days of the fixture epoch. */
const NEW_WINDOW_MS = 14 * 24 * 3600 * 1000
const isNew = (n: NftDetail) => FIXTURE_EPOCH - Date.parse(n.createdAt) <= NEW_WINDOW_MS
const TRENDING_THRESHOLD = 450

export function listNfts(q: NftListQuery): NftListResponse {
  const page = q.page ?? 1
  const pageSize = q.pageSize ?? 9
  const text = q.q?.toLowerCase().trim()

  // Base set: search + tab. Facet counts are computed on it so each facet
  // shows how many results it would add.
  let base = db.nfts
  if (text) {
    base = base.filter(
      (n) =>
        n.name.toLowerCase().includes(text) ||
        n.collectionName.toLowerCase().includes(text) ||
        n.tokenId.toLowerCase().includes(text),
    )
  }
  if (q.tab === 'new') base = base.filter(isNew)
  if (q.tab === 'trending') base = base.filter((n) => popularityOf(n.id) >= TRENDING_THRESHOLD)

  const inPrice = (n: NftDetail) =>
    (!q.minPrice || eth.cmp(n.priceEth, q.minPrice) >= 0) &&
    (!q.maxPrice || eth.cmp(n.priceEth, q.maxPrice) <= 0)
  const inCats = (n: NftDetail) => !q.categories?.length || q.categories.includes(n.category)
  const inNets = (n: NftDetail) => !q.networks?.length || q.networks.includes(n.network)

  const filtered = base.filter((n) => inPrice(n) && inCats(n) && inNets(n))

  const sorted = [...filtered]
  switch (q.sort ?? 'recent') {
    case 'recent':
      sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
      break
    case 'price-asc':
      sorted.sort((a, b) => eth.cmp(a.priceEth, b.priceEth) || a.id.localeCompare(b.id))
      break
    case 'price-desc':
      sorted.sort((a, b) => eth.cmp(b.priceEth, a.priceEth) || a.id.localeCompare(b.id))
      break
    case 'popular':
      sorted.sort((a, b) => popularityOf(b.id) - popularityOf(a.id) || a.id.localeCompare(b.id))
      break
  }

  const total = sorted.length
  const totalPages = Math.ceil(total / pageSize)
  const items = sorted.slice((page - 1) * pageSize, page * pageSize).map(toSummary)

  const prices = db.nfts.map((n) => n.priceEth)
  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    facets: {
      categories: CATEGORIES.map((c) => ({
        value: c,
        count: base.filter((n) => n.category === c && inPrice(n) && inNets(n)).length,
      })),
      networks: NETWORKS.map((v) => ({
        value: v,
        count: base.filter((n) => n.network === v && inPrice(n) && inCats(n)).length,
      })),
      priceRange: {
        min: prices.reduce((a, b) => eth.min(a, b)),
        max: prices.reduce((a, b) => eth.max(a, b)),
      },
    },
  }
}

/** Recompute derived fields after editions change and bump the version. */
export function touchNft(n: NftDetail) {
  const def = n.editions.find((e) => e.id === n.defaultEditionId)!
  n.priceEth = def.priceEth
  n.soldOut = n.editions.every((e) => e.available === 0)
  n.version += 1
}
