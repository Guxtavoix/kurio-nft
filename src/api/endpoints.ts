import type { z } from 'zod'
import {
  ActiveOrdersResponse,
  Cart,
  FavoritesResponse,
  FeaturedResponse,
  NftDetail,
  NftListResponse,
  NftSummary,
  Order,
  Profile,
  Quote,
  Session,
  SessionInfo,
  WalletConnection,
  WalletsResponse,
  type AddCartItemRequest,
  type ChangePasswordRequest,
  type CreateOrderRequest,
  type LoginRequest,
  type Network,
  type NftListQuery,
  type RegisterRequest,
  type SecondaryWalletRequest,
  type UpdateProfileRequest,
  type WalletInput,
  type WalletType,
} from './contracts'
import { ApiError } from './errors'
import { http } from './http'

/** Validates the payload against the contract so drift fails loudly. */
function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const res = schema.safeParse(data)
  if (!res.success) {
    console.error('[api] contract mismatch', res.error.issues)
    throw new ApiError({ kind: 'contract', message: 'Resposta da API fora do contrato', details: res.error.issues })
  }
  return res.data
}

type Opts = { signal?: AbortSignal }

export function nftListParams(q: NftListQuery) {
  return {
    q: q.q || undefined,
    tab: q.tab,
    categories: q.categories?.length ? q.categories.join(',') : undefined,
    networks: q.networks?.length ? q.networks.join(',') : undefined,
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    sort: q.sort,
    page: q.page,
    pageSize: q.pageSize,
  }
}

export const api = {
  auth: {
    login: async (body: LoginRequest) => parse(Session, (await http.post('/auth/login', body)).data),
    register: async (body: RegisterRequest) => parse(Session, (await http.post('/auth/register', body)).data),
    session: async (o: Opts = {}) => parse(SessionInfo, (await http.get('/auth/session', o)).data),
    logout: async () => {
      await http.post('/auth/logout')
    },
  },

  nfts: {
    list: async (q: NftListQuery, o: Opts = {}) =>
      parse(NftListResponse, (await http.get('/nfts', { params: nftListParams(q), signal: o.signal })).data),
    featured: async (o: Opts = {}) => parse(FeaturedResponse, (await http.get('/nfts/featured', o)).data),
    detail: async (id: string, o: Opts = {}) =>
      parse(NftDetail, (await http.get(`/nfts/${encodeURIComponent(id)}`, o)).data),
    related: async (id: string, o: Opts = {}) =>
      parse(NftSummary.array(), (await http.get(`/nfts/${encodeURIComponent(id)}/related`, o)).data.items),
  },

  favorites: {
    list: async (o: Opts = {}) => parse(FavoritesResponse, (await http.get('/me/favorites', o)).data),
    add: async (nftId: string) => {
      await http.put(`/me/favorites/${encodeURIComponent(nftId)}`)
    },
    remove: async (nftId: string) => {
      await http.delete(`/me/favorites/${encodeURIComponent(nftId)}`)
    },
  },

  cart: {
    get: async (o: Opts = {}) => parse(Cart, (await http.get('/cart', o)).data),
    add: async (body: AddCartItemRequest) => parse(Cart, (await http.post('/cart/items', body)).data),
    update: async (lineId: string, quantity: number) =>
      parse(Cart, (await http.patch(`/cart/items/${lineId}`, { quantity })).data),
    remove: async (lineId: string) => parse(Cart, (await http.delete(`/cart/items/${lineId}`)).data),
    acknowledge: async () => parse(Cart, (await http.post('/cart/acknowledge')).data),
    applyCoupon: async (code: string) => parse(Cart, (await http.put('/cart/coupon', { code })).data),
    removeCoupon: async () => parse(Cart, (await http.delete('/cart/coupon')).data),
    quote: async (network: Network, o: Opts = {}) =>
      parse(Quote, (await http.get('/cart/quote', { params: { network }, signal: o.signal })).data),
  },

  orders: {
    create: async (body: CreateOrderRequest, idempotencyKey: string, o: Opts & { timeout?: number } = {}) =>
      parse(
        Order,
        (
          await http.post('/orders', body, {
            headers: { 'Idempotency-Key': idempotencyKey },
            signal: o.signal,
            timeout: o.timeout,
          })
        ).data,
      ),
    get: async (id: string, o: Opts = {}) => parse(Order, (await http.get(`/orders/${id}`, o)).data),
    list: async (status?: Order['status'], o: Opts = {}) =>
      parse(ActiveOrdersResponse, (await http.get('/orders', { params: { status }, signal: o.signal })).data),
  },

  profile: {
    get: async (o: Opts = {}) => parse(Profile, (await http.get('/me/profile', o)).data),
    update: async (body: UpdateProfileRequest) => parse(Profile, (await http.patch('/me/profile', body)).data),
    setAvatar: async (dataUrl: string) => parse(Profile, (await http.put('/me/avatar', { dataUrl })).data),
    removeAvatar: async () => parse(Profile, (await http.delete('/me/avatar')).data),
    changePassword: async (body: ChangePasswordRequest) => {
      await http.post('/me/password', body)
    },
  },

  wallets: {
    get: async (o: Opts = {}) => parse(WalletsResponse, (await http.get('/me/wallets', o)).data),
    savePrimary: async (body: WalletInput) =>
      parse(WalletsResponse, (await http.put('/me/wallets/primary', body)).data),
    saveSecondary: async (body: SecondaryWalletRequest) =>
      parse(WalletsResponse, (await http.put('/me/wallets/secondary', body)).data),
    connect: async (walletId: string, network: Network, provider: WalletType) =>
      parse(WalletConnection, (await http.post(`/me/wallets/${walletId}/connect`, { network, provider })).data),
    disconnect: async (connectionId: string) => {
      await http.delete(`/me/wallet-connections/${connectionId}`)
    },
  },
}
