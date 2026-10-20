import { createFileRoute } from '@tanstack/react-router'
import { authSearchSchema, AuthScreen, redirectIfAuthenticated } from '@/features/auth/auth-route'

export const Route = createFileRoute('/entrar')({
  validateSearch: authSearchSchema,
  beforeLoad: redirectIfAuthenticated,
  head: () => ({ meta: [{ title: 'Entrar — Kurio' }, { name: 'description', content: 'Entre na sua conta Kurio.' }] }),
  component: LoginRoute,
})

function LoginRoute() {
  return <AuthScreen mode="login" search={Route.useSearch()} />
}
