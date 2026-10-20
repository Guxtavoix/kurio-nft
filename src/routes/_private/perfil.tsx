import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AccountLayout } from '@/features/account/components/account-layout'

export const Route = createFileRoute('/_private/perfil')({
  component: () => (
    <AccountLayout>
      <Outlet />
    </AccountLayout>
  ),
})
