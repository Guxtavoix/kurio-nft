import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { sessionStore } from '@/session/store'

/**
 * Guard for checkout, profile, wallets, favorites and orders. Visitors are
 * sent to /entrar with the full current location so they come back to it.
 */
export const Route = createFileRoute('/_private')({
  beforeLoad: ({ location }) => {
    const s = sessionStore.get()
    if (s.status !== 'authenticated') {
      throw redirect({
        to: '/entrar',
        search: { redirect: location.href, motivo: s.reason === 'expired' ? 'expirada' : undefined },
      })
    }
  },
  component: Outlet,
})
