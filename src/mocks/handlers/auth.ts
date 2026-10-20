import { http } from 'msw'
import { LoginRequest, RegisterRequest, type Session, type SessionInfo, type User } from '@/api/contracts'
import { db } from '../db/store'
import type { DbUser } from '../db/types'
import { mergeGuestCart } from '../domain/cart'
import { API, bearer, fail, json, nowIso, parseBody, readJson, route, sessionUser } from '../lib/http'
import { randomId, sha256Hex } from '../lib/random'
import { dropUserSockets } from '../realtime'
import { scenario } from '../scenarios'

export const toUser = (u: DbUser): User => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  email: u.email,
  avatarUrl: u.avatarUrl,
})

export const hashPassword = (salt: string, password: string) => sha256Hex(`${salt}:${password}`)

function openSession(user: DbUser): Session {
  const token = randomId('tok')
  const expiresAt = new Date(Date.now() + scenario.sessionTtlMs).toISOString()
  db.sessions.push({ token, userId: user.id, expiresAt })
  return { token, user: toUser(user), expiresAt }
}

export const authHandlers = [
  http.post(
    `${API}/auth/register`,
    route(async ({ request }) => {
      const body = parseBody(RegisterRequest, await readJson(request))
      const fieldErrors: Record<string, string> = {}
      if (db.users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) {
        fieldErrors.email = 'Este e-mail já está cadastrado'
      }
      if (db.users.some((u) => u.username.toLowerCase() === body.username.toLowerCase())) {
        fieldErrors.username = 'Este nome de usuário já está em uso'
      }
      if (Object.keys(fieldErrors).length) {
        fail('CONFLICT', 'Já existe uma conta com esses dados', { fieldErrors })
      }
      const salt = randomId('salt')
      const user: DbUser = {
        id: randomId('usr'),
        username: body.username,
        displayName: body.username,
        email: body.email,
        salt,
        passwordHash: await hashPassword(salt, body.password),
        ensName: '',
        walletNickname: '',
        avatarUrl: null,
        updatedAt: nowIso(),
      }
      db.users.push(user)
      db.wallets[user.id] = { primary: null, secondary: null, secondarySameAsPrimary: false }
      db.favorites[user.id] = []
      mergeGuestCart(body.guestCartId, user.id)
      return json<Session>(openSession(user), { status: 201 })
    }),
  ),

  http.post(
    `${API}/auth/login`,
    route(async ({ request }) => {
      const body = parseBody(LoginRequest, await readJson(request))
      const user = db.users.find((u) => u.email.toLowerCase() === body.email.toLowerCase())
      const ok = user && (await hashPassword(user.salt, body.password)) === user.passwordHash
      if (!user || !ok) {
        return fail('UNAUTHENTICATED', 'E-mail ou senha incorretos', {
          fieldErrors: { password: 'E-mail ou senha incorretos' },
        })
      }
      mergeGuestCart(body.guestCartId, user.id)
      return json<Session>(openSession(user))
    }),
  ),

  http.get(
    `${API}/auth/session`,
    route(({ request }) => {
      const user = sessionUser(request, { required: true })
      const session = db.sessions.find((s) => s.token === bearer(request))!
      return json<SessionInfo>({ user: toUser(user), expiresAt: session.expiresAt })
    }),
  ),

  http.post(
    `${API}/auth/logout`,
    route(({ request }) => {
      const token = bearer(request)
      const session = db.sessions.find((s) => s.token === token)
      db.sessions = db.sessions.filter((s) => s.token !== token)
      if (session) {
        db.walletConnections = db.walletConnections.filter((c) => c.userId !== session.userId)
        dropUserSockets(session.userId)
      }
      return new Response(null, { status: 204 })
    }),
  ),
]
