import { createFileRoute } from '@tanstack/react-router'
import { authSearchSchema, AuthScreen, redirectIfAuthenticated } from '@/features/auth/auth-route'

export const Route = createFileRoute('/cadastro')({
  validateSearch: authSearchSchema,
  beforeLoad: redirectIfAuthenticated,
  head: () => ({ meta: [{ title: 'Criar conta — Kurio' }, { name: 'description', content: 'Crie sua conta de colecionador na Kurio.' }] }),
  component: RegisterRoute,
})

function RegisterRoute() {
  return <AuthScreen mode="register" search={Route.useSearch()} />
}
