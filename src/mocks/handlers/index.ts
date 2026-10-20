import { http, HttpResponse } from 'msw'
import { realtimeHandler } from '../realtime'
import { accountHandlers } from './account'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { catalogHandlers } from './catalog'
import { orderHandlers } from './orders'

export const handlers = [
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
  // Unknown API routes → 404 in the API error format.
  http.all('/api/*', () =>
    HttpResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Rota da API não encontrada' } },
      { status: 404 },
    ),
  ),
  realtimeHandler,
]
