import { delay, HttpResponse } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/api/contracts'
import { db, persist } from '../db/store'
import type { DbUser } from '../db/types'
import { mulberry32 } from './random'
import { scenario } from '../scenarios'

export const API = '/api'

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  AVAILABILITY_CONFLICT: 409,
  QUOTE_STALE: 409,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  IDEMPOTENCY_CONFLICT: 409,
  WALLET_REJECTED: 400,
  WALLET_NOT_CONNECTED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  UNAVAILABLE: 503,
}

let requestSeq = 0
export function apiError(
  code: ApiErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string>; details?: unknown; status?: number } = {},
) {
  const body: ApiErrorBody = {
    error: { code, message, fieldErrors: extra.fieldErrors, details: extra.details },
    requestId: `req_${++requestSeq}`,
  }
  return HttpResponse.json(body, { status: extra.status ?? STATUS[code] })
}

/** Thrown inside handlers to short-circuit with an error response. */
export class HandlerError extends Error {
  readonly response: Response
  constructor(response: Response) {
    super('handler error')
    this.response = response
  }
}
export const fail = (...args: Parameters<typeof apiError>): never => {
  throw new HandlerError(apiError(...args))
}

const latencyRnd = mulberry32(7)
/** Simulated network latency according to the active profile. */
export async function networkDelay(kind: 'read' | 'write' = 'read') {
  const base = kind === 'write' ? 1.4 : 1
  switch (scenario.latency) {
    case 'none':
      return
    case 'fast':
      return delay(Math.round(60 * base))
    case 'realistic':
      return delay(Math.round((180 + latencyRnd() * 220) * base))
    case 'slow':
      return delay(Math.round(2200 * base))
    case 'variable':
      return delay(Math.round((100 + latencyRnd() * 2400) * base))
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return HttpResponse.json(data as never, init)
}

/** Wraps a resolver with offline simulation, latency and HandlerError handling. */
type RouteArgs = { request: Request; params: Record<string, string | readonly string[] | undefined> }

export function route(
  fn: (args: RouteArgs) => Promise<Response> | Response,
  opts: { kind?: 'read' | 'write'; skipDelay?: boolean } = {},
) {
  return async (args: RouteArgs) => {
    if (scenario.offline) return HttpResponse.error()
    if (!opts.skipDelay) await networkDelay(opts.kind ?? (args.request.method === 'GET' ? 'read' : 'write'))
    try {
      const res = await fn(args)
      persist()
      return res
    } catch (e) {
      if (e instanceof HandlerError) {
        persist()
        return e.response
      }
      console.error('[mock] unhandled error', e)
      return apiError('INTERNAL', 'Erro interno simulado')
    }
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return fail('VALIDATION_ERROR', 'Corpo da requisição inválido')
  }
}

/** zod-like parse with API validation errors. */
export function parseBody<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
  value: unknown,
): T {
  const res = schema.safeParse(value)
  if (res.success) return res.data
  const fieldErrors: Record<string, string> = {}
  for (const issue of res.error.issues) {
    const key = issue.path.map(String).join('.') || '_'
    fieldErrors[key] ??= issue.message
  }
  return fail('VALIDATION_ERROR', 'Verifique os campos destacados', { fieldErrors })
}

// ── Auth ─────────────────────────────────────────────────────────────────

export function bearer(request: Request) {
  const h = request.headers.get('authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

export function sessionUser(request: Request, opts: { required: true }): DbUser
export function sessionUser(request: Request, opts?: { required?: boolean }): DbUser | null
export function sessionUser(request: Request, opts: { required?: boolean } = {}): DbUser | null {
  const token = bearer(request)
  if (!token) return opts.required ? fail('UNAUTHENTICATED', 'Faça login para continuar') : null
  const session = db.sessions.find((s) => s.token === token)
  if (!session) {
    return opts.required ? fail('UNAUTHENTICATED', 'Sessão inválida. Faça login novamente.') : null
  }
  if (Date.parse(session.expiresAt) <= Date.now()) {
    // Expired sessions are always reported, even on public endpoints, so the
    // client can clear private state.
    return fail('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  const user = db.users.find((u) => u.id === session.userId)
  if (!user) return fail('UNAUTHENTICATED', 'Sessão inválida')
  return user
}

export const nowIso = () => new Date().toISOString()
