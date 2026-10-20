import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/checkout/components/order-page'

export const Route = createFileRoute('/_private/pedido/$orderId')({
  head: () => ({ meta: [{ title: 'Pedido — Kurio' }] }),
  component: OrderRoute,
})

function OrderRoute() {
  const { orderId } = Route.useParams()
  return <OrderPage key={orderId} orderId={orderId} />
}
