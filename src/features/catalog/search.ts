import { z } from 'zod'
import {
  Category,
  EthAmount,
  Network,
  NftSort,
  NftTab,
  type Category as CategoryT,
  type Network as NetworkT,
  type NftListQuery,
  type NftSort as NftSortT,
  type NftTab as NftTabT,
} from '@/api/contracts'

/**
 * Home route search params = catalog state. Invalid values are dropped
 * (`.catch`) instead of breaking the page, so any shared/edited URL works.
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  tab: NftTab.optional().catch(undefined),
  categories: z.array(Category).optional().catch(undefined),
  networks: z.array(Network).optional().catch(undefined),
  minPrice: EthAmount.optional().catch(undefined),
  maxPrice: EthAmount.optional().catch(undefined),
  sort: NftSort.optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export function toListQuery(s: CatalogSearch): NftListQuery {
  return {
    q: s.q || undefined,
    tab: s.tab && s.tab !== 'all' ? s.tab : undefined,
    categories: s.categories?.length ? [...s.categories].sort() : undefined,
    networks: s.networks?.length ? [...s.networks].sort() : undefined,
    minPrice: s.minPrice,
    maxPrice: s.maxPrice,
    sort: s.sort && s.sort !== 'recent' ? s.sort : undefined,
    page: s.page && s.page > 1 ? s.page : undefined,
  }
}

export const CATEGORY_LABELS: Record<CategoryT, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const NETWORK_LABELS: Record<NetworkT, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const TAB_LABELS: Record<NftTabT, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

export const SORT_LABELS: Record<NftSortT, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  popular: 'Mais populares',
}
