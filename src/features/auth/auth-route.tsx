import { redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { HomePage } from '@/features/catalog/components/home-page'
import { sessionStore } from '@/session/store'
import { AuthDialog, safeRedirect } from './components/auth-dialog'

export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  motivo: z.literal('expirada').optional().catch(undefined),
})
export type AuthSearch = z.infer<typeof authSearchSchema>

/** Already signed in → go straight to the return target. */
export function redirectIfAuthenticated({ search }: { search: AuthSearch }) {
  if (sessionStore.get().status === 'authenticated') {
    throw redirect({ href: safeRedirect(search.redirect), replace: true })
  }
}

/** Desktop shows the home behind the modal (as in the layout); mobile is full-screen. */
export function AuthScreen({ mode, search }: { mode: 'login' | 'register'; search: AuthSearch }) {
  return (
    <>
      <div className="hidden md:block" aria-hidden="true" inert>
        <HomePage search={{}} />
      </div>
      <AuthDialog mode={mode} redirect={search.redirect} reason={search.motivo} />
    </>
  )
}
