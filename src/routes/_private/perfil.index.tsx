import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/account/components/profile-page'

export const Route = createFileRoute('/_private/perfil/')({
  head: () => ({ meta: [{ title: 'Meu perfil — Kurio' }] }),
  component: ProfilePage,
})
