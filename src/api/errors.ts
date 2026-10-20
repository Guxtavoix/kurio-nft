import { AxiosError, isAxiosError, isCancel } from 'axios'
import { ApiErrorBody, type ApiErrorCode } from './contracts'

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'canceled' | 'contract'

/** Single error type surfaced by the API layer to state and UI. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly code: ApiErrorCode | null
  readonly fieldErrors: Record<string, string>
  readonly details: unknown

  constructor(init: {
    kind: ApiErrorKind
    message: string
    status?: number | null
    code?: ApiErrorCode | null
    fieldErrors?: Record<string, string>
    details?: unknown
    cause?: unknown
  }) {
    super(init.message, { cause: init.cause })
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status ?? null
    this.code = init.code ?? null
    this.fieldErrors = init.fieldErrors ?? {}
    this.details = init.details
  }

  /** Worth retrying automatically (transient). */
  get isTransient() {
    return (
      this.kind === 'network' ||
      this.kind === 'timeout' ||
      (this.status !== null && (this.status >= 500 || this.status === 429))
    )
  }

  get isAuthError() {
    return this.code === 'UNAUTHENTICATED' || this.code === 'SESSION_EXPIRED'
  }
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  if (isCancel(e)) return new ApiError({ kind: 'canceled', message: 'Requisição cancelada', cause: e })
  if (isAxiosError(e)) {
    const err = e as AxiosError
    if (err.code === AxiosError.ECONNABORTED || err.code === AxiosError.ETIMEDOUT) {
      return new ApiError({ kind: 'timeout', message: 'O servidor demorou para responder', cause: e })
    }
    if (!err.response) {
      return new ApiError({ kind: 'network', message: 'Sem conexão com o servidor', cause: e })
    }
    const parsed = ApiErrorBody.safeParse(err.response.data)
    if (parsed.success) {
      const { code, message, fieldErrors, details } = parsed.data.error
      return new ApiError({ kind: 'http', status: err.response.status, code, message, fieldErrors, details, cause: e })
    }
    return new ApiError({
      kind: 'http',
      status: err.response.status,
      message: `Erro inesperado (${err.response.status})`,
      cause: e,
    })
  }
  return new ApiError({ kind: 'contract', message: e instanceof Error ? e.message : 'Erro desconhecido', cause: e })
}

/** Human message for toasts / inline alerts. */
export function errorMessage(e: unknown, fallback = 'Algo deu errado. Tente novamente.') {
  const err = toApiError(e)
  if (err.kind === 'network') return 'Sem conexão. Verifique sua internet e tente novamente.'
  if (err.kind === 'timeout') return 'O servidor demorou para responder. Tente novamente.'
  if (err.kind === 'contract') return fallback
  return err.message || fallback
}
