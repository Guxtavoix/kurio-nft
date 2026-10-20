import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { NftListQuery } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'

export const PAGE_SIZE = 9

/**
 * TanStack Query passes an AbortSignal; Axios cancels the in-flight request
 * when the key changes (new filters) so obsolete responses are discarded —
 * and since each param set has its own cache entry, a late response can
 * never overwrite the list for different filters.
 */
export const nftListQuery = (q: NftListQuery) =>
  queryOptions({
    queryKey: qk.nfts.list(q),
    queryFn: ({ signal }) => api.nfts.list({ pageSize: PAGE_SIZE, ...q }, { signal }),
    placeholderData: keepPreviousData,
  })

export const featuredQuery = () =>
  queryOptions({
    queryKey: qk.nfts.featured(),
    queryFn: ({ signal }) => api.nfts.featured({ signal }),
    staleTime: 60_000,
  })

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nfts.detail(id),
    queryFn: ({ signal }) => api.nfts.detail(id, { signal }),
  })

export const relatedQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nfts.related(id),
    queryFn: ({ signal }) => api.nfts.related(id, { signal }),
    staleTime: 60_000,
  })

export const useNftList = (q: NftListQuery) => useQuery(nftListQuery(q))
export const useFeatured = () => useQuery(featuredQuery())
export const useNftDetail = (id: string) => useQuery(nftDetailQuery(id))
export const useRelated = (id: string) => useQuery(relatedQuery(id))
