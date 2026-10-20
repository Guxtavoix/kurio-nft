import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FavoritesResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/api/errors'
import { qk } from '@/api/query-keys'
import { announce } from '@/lib/announcer'
import { useOwner, useSession } from '@/session/hooks'
import { toast } from 'sonner'

export function useFavorites() {
  const owner = useOwner()
  const session = useSession()
  return useQuery({
    queryKey: qk.favorites(owner),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
    enabled: session.status === 'authenticated',
    staleTime: 60_000,
  })
}

/**
 * Optimistic toggle with rollback: the heart flips immediately; on failure
 * the previous cache snapshot is restored and the user is told.
 */
export function useToggleFavorite() {
  const qc = useQueryClient()
  const owner = useOwner()
  const key = qk.favorites(owner)
  return useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? api.favorites.add(nftId) : api.favorites.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<FavoritesResponse>(key)
      qc.setQueryData<FavoritesResponse>(key, (prev) => {
        const base = prev ?? { nftIds: [], items: [] }
        return {
          nftIds: favorite ? [...new Set([...base.nftIds, nftId])] : base.nftIds.filter((id) => id !== nftId),
          items: favorite ? base.items : base.items.filter((n) => n.id !== nftId),
        }
      })
      return { previous }
    },
    onError: (err, vars, ctx) => {
      qc.setQueryData(key, ctx?.previous)
      toast.error(`Não foi possível ${vars.favorite ? 'favoritar' : 'remover dos favoritos'}: ${errorMessage(err)}`)
    },
    onSuccess: (_d, vars) => {
      announce(vars.favorite ? `${vars.name} adicionado aos favoritos` : `${vars.name} removido dos favoritos`)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
