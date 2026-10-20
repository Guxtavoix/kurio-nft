import { createFileRoute } from '@tanstack/react-router'
import { CheckoutPage } from '@/features/checkout/components/checkout-page'

export const Route = createFileRoute('/_private/pagamento')({
  head: () => ({ meta: [{ title: 'Pagamento — Kurio' }] }),
  component: CheckoutPage,
})
