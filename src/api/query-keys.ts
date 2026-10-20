import type { Network, NftListQuery } from './contracts'

/**
 * Query key factory. Public data is keyed by its parameters; private data is
 * always keyed by the owner (`user:<id>` or `guest:<cartId>`), so cache
 * entries can never be served to another user and can be dropped per owner.
 */
export type Owner = `user:${string}` | `guest:${string}`

export const qk = {
  nfts: {
    all: ['nfts'] as const,
    lists: () => ['nfts', 'list'] as const,
    list: (q: NftListQuery) => ['nfts', 'list', q] as const,
    featured: () => ['nfts', 'featured'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
    related: (id: string) => ['nfts', 'related', id] as const,
  },
  session: () => ['session'] as const,
  /** Everything private lives under ['private', owner, ...]. */
  private: (owner: Owner) => ['private', owner] as const,
  cart: (owner: Owner) => ['private', owner, 'cart'] as const,
  quote: (owner: Owner, network: Network) => ['private', owner, 'quote', network] as const,
  quotes: (owner: Owner) => ['private', owner, 'quote'] as const,
  favorites: (owner: Owner) => ['private', owner, 'favorites'] as const,
  profile: (owner: Owner) => ['private', owner, 'profile'] as const,
  wallets: (owner: Owner) => ['private', owner, 'wallets'] as const,
  order: (owner: Owner, id: string) => ['private', owner, 'order', id] as const,
  orders: (owner: Owner, status?: string) => ['private', owner, 'orders', status ?? 'all'] as const,
}
