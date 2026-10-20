import { createFileRoute } from '@tanstack/react-router'
import { CartPage } from '@/features/cart/components/cart-page'

export const Route = createFileRoute('/carrinho')({
  head: () => ({ meta: [{ title: 'Carrinho — Kurio' }, { name: 'description', content: 'Revise os NFTs do seu carrinho.' }] }),
  component: CartPage,
})
