import { z } from 'zod'
import { EthAmount, IsoDate, Network, Paginated } from './common'

export const CATEGORIES = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export const Category = z.enum(CATEGORIES)
export type Category = z.infer<typeof Category>

export const EDITION_KINDS = ['1/1', '1/10', '1/50', 'open'] as const
export const EditionKind = z.enum(EDITION_KINDS)
export type EditionKind = z.infer<typeof EditionKind>

export const Edition = z.object({
  id: z.string(),
  kind: EditionKind,
  label: z.string(),
  priceEth: EthAmount,
  /** Total supply; null for open editions. */
  supply: z.number().int().positive().nullable(),
  available: z.number().int().min(0),
  /** Max units of this edition one collector may buy per order. */
  maxPerOrder: z.number().int().positive(),
})
export type Edition = z.infer<typeof Edition>

export const NftSummary = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  category: Category,
  network: Network,
  collectionName: z.string(),
  /** Price of the default edition. */
  priceEth: EthAmount,
  /** Previous price, shown struck through when present. */
  compareAtPriceEth: EthAmount.nullable(),
  badge: z.enum(['raro', 'novo']).nullable(),
  /** True when every edition is sold out. */
  soldOut: z.boolean(),
  createdAt: IsoDate,
  /** Monotonic version, bumped on every price/availability change. */
  version: z.number().int(),
})
export type NftSummary = z.infer<typeof NftSummary>

export const NftDetail = NftSummary.extend({
  description: z.string(),
  longDescription: z.array(z.string()),
  gallery: z.array(z.object({ src: z.string(), alt: z.string() })),
  attributes: z.array(z.string()),
  rating: z.object({ average: z.number(), count: z.number().int() }),
  contractAddress: z.string(),
  royaltyPercent: z.number(),
  defaultEditionId: z.string(),
  editions: z.array(Edition),
  reviews: z.array(
    z.object({ id: z.string(), author: z.string(), rating: z.number(), text: z.string() }),
  ),
})
export type NftDetail = z.infer<typeof NftDetail>

export const NFT_TABS = ['all', 'new', 'trending'] as const
export const NftTab = z.enum(NFT_TABS)
export type NftTab = z.infer<typeof NftTab>

export const NFT_SORTS = ['recent', 'price-asc', 'price-desc', 'popular'] as const
export const NftSort = z.enum(NFT_SORTS)
export type NftSort = z.infer<typeof NftSort>

/** Query params for GET /api/nfts. Also the shape of the home route search. */
export const NftListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  tab: NftTab.optional(),
  categories: z.array(Category).optional(),
  networks: z.array(Network).optional(),
  minPrice: EthAmount.optional(),
  maxPrice: EthAmount.optional(),
  sort: NftSort.optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(48).optional(),
})
export type NftListQuery = z.infer<typeof NftListQuery>

export const FacetCount = z.object({ value: z.string(), count: z.number().int() })

export const NftListResponse = Paginated(NftSummary).extend({
  facets: z.object({
    categories: z.array(FacetCount),
    networks: z.array(FacetCount),
    priceRange: z.object({ min: EthAmount, max: EthAmount }),
  }),
})
export type NftListResponse = z.infer<typeof NftListResponse>

export const FeaturedResponse = z.object({
  hero: z.array(NftSummary),
  spotlight: NftSummary.nullable(),
})
export type FeaturedResponse = z.infer<typeof FeaturedResponse>
