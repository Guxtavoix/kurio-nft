import { delay, http } from 'msw'
import {
  NftListQuery,
  type FeaturedResponse,
  type NftDetail,
  type NftListResponse,
  type NftSummary,
} from '@/api/contracts'
import { db } from '../db/store'
import { findNft, listNfts, toSummary } from '../domain/catalog'
import { API, fail, json, parseBody, route } from '../lib/http'
import { consume, scenario } from '../scenarios'

/** Arrays travel as comma-separated values: ?categories=musica,arte-3d */
function parseListQuery(url: URL) {
  const p = url.searchParams
  const list = (k: string) => p.get(k)?.split(',').filter(Boolean)
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined)
  return parseBody(NftListQuery, {
    q: p.get('q') ?? undefined,
    tab: p.get('tab') ?? undefined,
    categories: list('categories'),
    networks: list('networks'),
    minPrice: p.get('minPrice') ?? undefined,
    maxPrice: p.get('maxPrice') ?? undefined,
    sort: p.get('sort') ?? undefined,
    page: num('page'),
    pageSize: num('pageSize'),
  })
}

let listSeq = 0

export const catalogHandlers = [
  http.get(
    `${API}/nfts`,
    route(async ({ request }) => {
      const query = parseListQuery(new URL(request.url))
      // Out-of-order: odd requests are slow, even ones fast, so a quick
      // second filter change resolves before the first one.
      if (scenario.outOfOrder) await delay(++listSeq % 2 === 1 ? 2000 : 250)
      if (consume('catalogFailures')) fail('INTERNAL', 'Falha temporária ao carregar o catálogo')
      if (scenario.catalogEmpty) return json<NftListResponse>(listNfts({ ...query, q: '__empty__' }))
      return json<NftListResponse>(listNfts(query))
    }),
  ),

  http.get(
    `${API}/nfts/featured`,
    route(() => {
      const pick = (ids: string[]) =>
        ids.map((id) => db.nfts.find((n) => n.id === id)).filter(Boolean).map((n) => toSummary(n!))
      return json<FeaturedResponse>({
        hero: pick(['emerald-ape-042', 'ivory-baron-088', 'golden-beat-207']),
        spotlight: pick(['sage-nomad-009'])[0] ?? null,
      })
    }),
  ),

  http.get(
    `${API}/nfts/:id`,
    route(({ params }) => {
      if (consume('detailFailures')) fail('UNAVAILABLE', 'Serviço temporariamente indisponível')
      const nft = findNft(String(params.id))
      if (!nft) return fail('NOT_FOUND', 'NFT não encontrado')
      return json<NftDetail>(nft)
    }),
  ),

  http.get(
    `${API}/nfts/:id/related`,
    route(({ params }) => {
      const nft = findNft(String(params.id))
      if (!nft) return fail('NOT_FOUND', 'NFT não encontrado')
      const same = db.nfts.filter((n) => n.id !== nft.id && n.collectionName === nft.collectionName)
      const others = db.nfts.filter((n) => n.id !== nft.id && n.collectionName !== nft.collectionName)
      return json<{ items: NftSummary[] }>({ items: [...same, ...others].slice(0, 10).map(toSummary) })
    }),
  ),
]
