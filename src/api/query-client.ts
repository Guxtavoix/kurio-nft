import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toApiError } from './errors'

/**
 * Cache policy (see ARCHITECTURE.md → "Estratégia de cache"):
 *  - catalog lists: staleTime 30s, kept 5 min; realtime events patch them.
 *  - detail: staleTime 30s; nft.updated patches price/availability in place.
 *  - private data (cart, quote, favorites, profile, wallets, orders): keyed by
 *    owner, staleTime per hook; removed entirely on logout / user switch.
 *  - retries: only transient failures (network, timeout, 5xx, 429), max 2,
 *    exponential backoff. 4xx are never retried. Mutations never auto-retry
 *    (orders use explicit idempotent retry instead).
 *  - refetchOnWindowFocus for stale queries; refetchOnReconnect always.
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error) => failureCount < 2 && toApiError(error).isTransient,
        retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
      },
      mutations: { retry: false },
    },
  })
}
