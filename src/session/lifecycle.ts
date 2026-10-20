import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import type { RealtimeClient } from '@/realtime/client' // type-only: keeps socket.io out of the eager graph
import type { AppRouter } from '@/router'
import { sessionStore } from './store'

const PRIVATE_PREFIXES = ['/pagamento', '/pedido', '/perfil']

/**
 * Reacts to identity changes (login, logout, expiry, user switch):
 *  1. drops every private cache entry of the previous identity;
 *  2. replaces the socket (old listeners/subscriptions are released, the new
 *     one authenticates as the new user);
 *  3. on expiry inside a private route, sends the user to login keeping the
 *     current location so the flow can resume.
 */
export function startSessionLifecycle({
  queryClient,
  getRealtime,
  router,
}: {
  queryClient: QueryClient
  /** The socket client is created once the network layer is ready. */
  getRealtime: () => RealtimeClient | null
  router: AppRouter
}) {
  sessionStore.subscribe((next, prev) => {
    const prevId = prev.status === 'authenticated' ? prev.user.id : null
    const nextId = next.status === 'authenticated' ? next.user.id : null
    if (prevId === nextId) return

    queryClient.cancelQueries({ queryKey: ['private'] })
    queryClient.removeQueries({ queryKey: ['private'] })
    queryClient.removeQueries({ queryKey: qk.session() })
    getRealtime()?.connect()

    if (next.status === 'anonymous' && next.reason === 'expired') {
      const loc = router.state.location
      const isPrivate = PRIVATE_PREFIXES.some((p) => loc.pathname.startsWith(p))
      toast.warning('Sua sessão expirou. Entre novamente para continuar.', { id: 'session-expired' })
      if (isPrivate) {
        void router.navigate({ to: '/entrar', search: { redirect: loc.href, motivo: 'expirada' } })
      }
    } else if (next.status === 'anonymous') {
      void router.invalidate()
    }
  })

  // Revalidate a persisted session on boot (expired → interceptor signs out).
  if (sessionStore.token()) {
    api.auth.session().then(
      (info) => {
        const s = sessionStore.get()
        if (s.status === 'authenticated' && s.user.id === info.user.id) {
          sessionStore.signIn({ token: s.token, user: info.user, expiresAt: info.expiresAt })
        }
      },
      () => undefined,
    )
  }

  // Proactive expiry: sign out locally when the expiry time passes.
  setInterval(() => {
    const s = sessionStore.get()
    if (s.status === 'authenticated' && Date.parse(s.expiresAt) <= Date.now()) sessionStore.signOut('expired')
  }, 15_000)
}
