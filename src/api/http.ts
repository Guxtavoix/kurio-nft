import axios from 'axios'
import { guestCartId, sessionStore } from '@/session/store'
import { toApiError } from './errors'
import { networkReady } from './network-ready'

/**
 * Single Axios instance for every REST call. Responsibilities:
 *  - base URL and default timeout
 *  - Authorization (session token) or X-Cart-Id (visitor cart)
 *  - normalize every failure into ApiError
 *  - react to SESSION_EXPIRED / invalid session by ending the local session
 * It contains no business fallbacks or fake data.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use(async (config) => {
  await networkReady
  const token = sessionStore.token()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  else config.headers.set('X-Cart-Id', guestCartId())
  return config
})

http.interceptors.response.use(
  (res) => res,
  (e: unknown) => {
    const err = toApiError(e)
    // Token was sent and the server rejected it → session is over.
    const sentToken = (e as { config?: { headers?: { Authorization?: string } } })?.config?.headers?.Authorization
    if (err.isAuthError && sentToken && sessionStore.token() && sentToken === `Bearer ${sessionStore.token()}`) {
      sessionStore.signOut('expired')
    }
    return Promise.reject(err)
  },
)
