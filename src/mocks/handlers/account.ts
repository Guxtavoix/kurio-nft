import { http } from 'msw'
import {
  ChangePasswordRequest,
  ConnectWalletRequest,
  SecondaryWalletRequest,
  UpdateAvatarRequest,
  UpdateProfileRequest,
  WalletInput,
  type Profile,
  type Wallet,
  type WalletConnection,
  type WalletSlot,
  type WalletsResponse,
} from '@/api/contracts'
import { db } from '../db/store'
import type { DbUser } from '../db/types'
import { API, fail, json, nowIso, parseBody, readJson, route, sessionUser } from '../lib/http'
import { randomId, sha256Hex } from '../lib/random'
import { scenario } from '../scenarios'

const MAX_AVATAR_CHARS = 2_000_000 // ~1.5MB of base64

const toProfile = (u: DbUser): Profile => ({
  id: u.id,
  displayName: u.displayName,
  username: u.username,
  email: u.email,
  ensName: u.ensName,
  walletNickname: u.walletNickname,
  avatarUrl: u.avatarUrl,
  updatedAt: u.updatedAt,
})

function walletsOf(userId: string) {
  return (db.wallets[userId] ??= { primary: null, secondary: null, secondarySameAsPrimary: false })
}

function walletsView(userId: string): WalletsResponse {
  const w = walletsOf(userId)
  return { primary: w.primary, secondary: w.secondary, secondarySameAsPrimary: w.secondarySameAsPrimary }
}

function upsertWallet(userId: string, slot: WalletSlot, input: WalletInput): Wallet {
  const w = walletsOf(userId)
  const current = w[slot]
  const wallet: Wallet = {
    id: current?.id ?? randomId(`wal_${slot}`),
    slot,
    ...input,
    secondaryAddress: input.secondaryAddress ?? '',
    updatedAt: nowIso(),
  }
  w[slot] = wallet
  return wallet
}

export const accountHandlers = [
  http.get(
    `${API}/me/profile`,
    route(({ request }) => json<Profile>(toProfile(sessionUser(request, { required: true })))),
  ),
  http.patch(
    `${API}/me/profile`,
    route(async ({ request }) => {
      const user = sessionUser(request, { required: true })
      const body = parseBody(UpdateProfileRequest, await readJson(request))
      const fieldErrors: Record<string, string> = {}
      if (db.users.some((u) => u.id !== user.id && u.email.toLowerCase() === body.email.toLowerCase())) {
        fieldErrors.email = 'Este e-mail já está em uso'
      }
      if (db.users.some((u) => u.id !== user.id && u.username.toLowerCase() === body.username.toLowerCase())) {
        fieldErrors.username = 'Este nome de usuário já está em uso'
      }
      if (Object.keys(fieldErrors).length) fail('CONFLICT', 'Alguns dados já estão em uso', { fieldErrors })
      Object.assign(user, body, { updatedAt: nowIso() })
      return json<Profile>(toProfile(user))
    }),
  ),
  http.put(
    `${API}/me/avatar`,
    route(async ({ request }) => {
      const user = sessionUser(request, { required: true })
      const body = parseBody(UpdateAvatarRequest, await readJson(request))
      if (body.dataUrl.length > MAX_AVATAR_CHARS) {
        fail('VALIDATION_ERROR', 'Imagem muito grande', { fieldErrors: { avatar: 'Envie uma imagem de até 1,5 MB' } })
      }
      user.avatarUrl = body.dataUrl
      user.updatedAt = nowIso()
      return json<Profile>(toProfile(user))
    }),
  ),
  http.delete(
    `${API}/me/avatar`,
    route(({ request }) => {
      const user = sessionUser(request, { required: true })
      user.avatarUrl = null
      user.updatedAt = nowIso()
      return json<Profile>(toProfile(user))
    }),
  ),
  http.post(
    `${API}/me/password`,
    route(async ({ request }) => {
      const user = sessionUser(request, { required: true })
      const body = parseBody(ChangePasswordRequest, await readJson(request))
      if ((await sha256Hex(`${user.salt}:${body.currentPassword}`)) !== user.passwordHash) {
        fail('VALIDATION_ERROR', 'Senha atual incorreta', { fieldErrors: { currentPassword: 'Senha atual incorreta' } })
      }
      if (body.currentPassword === body.newPassword) {
        fail('VALIDATION_ERROR', 'A nova senha deve ser diferente da atual', {
          fieldErrors: { newPassword: 'Use uma senha diferente da atual' },
        })
      }
      user.salt = randomId('salt')
      user.passwordHash = await sha256Hex(`${user.salt}:${body.newPassword}`)
      user.updatedAt = nowIso()
      return new Response(null, { status: 204 })
    }),
  ),

  // ── Wallets ────────────────────────────────────────────────────────────
  http.get(
    `${API}/me/wallets`,
    route(({ request }) => json<WalletsResponse>(walletsView(sessionUser(request, { required: true }).id))),
  ),
  http.put(
    `${API}/me/wallets/primary`,
    route(async ({ request }) => {
      const user = sessionUser(request, { required: true })
      const input = parseBody(WalletInput, await readJson(request))
      upsertWallet(user.id, 'primary', input)
      return json<WalletsResponse>(walletsView(user.id))
    }),
  ),
  http.put(
    `${API}/me/wallets/secondary`,
    route(async ({ request }) => {
      const user = sessionUser(request, { required: true })
      const body = parseBody(SecondaryWalletRequest, await readJson(request))
      const w = walletsOf(user.id)
      if (body.sameAsPrimary) {
        if (!w.primary) fail('VALIDATION_ERROR', 'Cadastre a carteira principal primeiro')
        w.secondarySameAsPrimary = true
        w.secondary = null
      } else {
        if (w.primary && body.wallet.address.toLowerCase() === w.primary.address.toLowerCase()) {
          fail('VALIDATION_ERROR', 'Endereço igual ao da carteira principal', {
            fieldErrors: { address: 'Use "Igual à carteira principal" ou informe outro endereço' },
          })
        }
        w.secondarySameAsPrimary = false
        upsertWallet(user.id, 'secondary', body.wallet)
      }
      return json<WalletsResponse>(walletsView(user.id))
    }),
  ),

  // Simulated wallet extension handshake: connect / reject / disconnect.
  http.post(
    `${API}/me/wallets/:walletId/connect`,
    route(async ({ request, params }) => {
      const user = sessionUser(request, { required: true })
      const { network, provider } = parseBody(ConnectWalletRequest, await readJson(request))
      const w = walletsOf(user.id)
      const wallet = [w.primary, w.secondary].find((x) => x?.id === params.walletId)
      if (!wallet) return fail('NOT_FOUND', 'Carteira não encontrada')
      if (wallet.network !== network) {
        fail('VALIDATION_ERROR', 'Esta carteira não está na rede selecionada', {
          fieldErrors: { network: `A carteira está na rede ${wallet.network}` },
        })
      }
      if (scenario.walletReject) fail('WALLET_REJECTED', 'A conexão foi recusada na carteira')
      db.walletConnections = db.walletConnections.filter((c) => c.userId !== user.id)
      const connection = {
        id: randomId('conn'),
        userId: user.id,
        walletId: wallet.id,
        network,
        provider,
        connectedAt: nowIso(),
      }
      db.walletConnections.push(connection)
      return json<WalletConnection>({
        walletId: wallet.id,
        connectionId: connection.id,
        network,
        provider,
        status: 'connected',
        connectedAt: connection.connectedAt,
      })
    }),
  ),
  http.delete(
    `${API}/me/wallet-connections/:id`,
    route(({ request, params }) => {
      const user = sessionUser(request, { required: true })
      db.walletConnections = db.walletConnections.filter((c) => !(c.id === params.id && c.userId === user.id))
      return new Response(null, { status: 204 })
    }),
  ),
]
