import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddCartItemRequest, Cart, Network } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { useOwner } from '@/session/hooks'

/**
 * Cart is server state: the API owns availability rules and totals. After
 * every mutation the returned cart replaces the cache, and the quote (which
 * depends on the cart) is invalidated.
 */
export function useCart() {
  const owner = useOwner()
  return useQuery({
    queryKey: qk.cart(owner),
    queryFn: ({ signal }) => api.cart.get({ signal }),
    staleTime: 15_000,
  })
}

export function useQuote(network: Network, enabled = true) {
  const owner = useOwner()
  return useQuery({
    queryKey: qk.quote(owner, network),
    queryFn: ({ signal }) => api.cart.quote(network, { signal }),
    enabled,
    staleTime: 10_000,
  })
}

function useCartMutation<V>(fn: (v: V) => Promise<Cart>) {
  const qc = useQueryClient()
  const owner = useOwner()
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => {
      qc.setQueryData(qk.cart(owner), cart)
      void qc.invalidateQueries({ queryKey: qk.quotes(owner) })
    },
    onError: () => {
      // Server may have changed (e.g. availability conflict): resync.
      void qc.invalidateQueries({ queryKey: qk.cart(owner) })
    },
  })
}

export const useAddToCart = () => useCartMutation((v: AddCartItemRequest) => api.cart.add(v))
export const useUpdateCartLine = () =>
  useCartMutation((v: { lineId: string; quantity: number }) => api.cart.update(v.lineId, v.quantity))
export const useRemoveCartLine = () => useCartMutation((lineId: string) => api.cart.remove(lineId))
export const useApplyCoupon = () => useCartMutation((code: string) => api.cart.applyCoupon(code))
export const useRemoveCoupon = () => useCartMutation(() => api.cart.removeCoupon())
export const useAcknowledgePrices = () => useCartMutation(() => api.cart.acknowledge())
