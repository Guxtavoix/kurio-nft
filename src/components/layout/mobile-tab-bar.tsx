import { Link, useLocation } from '@tanstack/react-router'
import { Heart, Home, ScanLine, ShoppingCart, User } from 'lucide-react'
import { useCart } from '@/features/cart/queries'
import { cn } from '@/lib/utils'
import { useAuthUser } from '@/session/hooks'

/** Mobile bottom navigation (Figma mobile frames). Hidden from md up. */
export function MobileTabBar() {
  const { pathname } = useLocation()
  const user = useAuthUser()
  const count = useCart().data?.itemCount ?? 0
  const item = (active: boolean) =>
    cn('grid size-12 place-items-center rounded-full', active ? 'text-brand' : 'text-text-secondary')

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-surface-card fixed inset-x-0 bottom-0 z-40 rounded-t-[32px] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex h-[76px] max-w-[414px] items-center justify-between px-6">
        <li>
          <Link to="/" aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined} className={item(pathname === '/')}>
            <Home className="size-6" aria-hidden fill="currentColor" />
          </Link>
        </li>
        <li>
          <Link
            to="/perfil/favoritos"
            aria-label="Favoritos"
            className={item(pathname === '/perfil/favoritos')}
          >
            <Heart className="size-6" aria-hidden fill="currentColor" />
          </Link>
        </li>
        <li className="-mt-12">
          <Link
            to="/"
            hash="catalogo"
            aria-label="Explorar catálogo"
            className="bg-brand text-ink border-ink grid size-16 place-items-center rounded-full border-[6px]"
          >
            <ScanLine className="size-6" aria-hidden />
          </Link>
        </li>
        <li>
          <Link
            to="/carrinho"
            aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
            className={cn(item(pathname === '/carrinho'), 'relative')}
          >
            <ShoppingCart className="size-6" aria-hidden />
            {count > 0 && (
              <span aria-hidden className="bg-brand text-ink absolute top-1 right-0 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold">
                {count}
              </span>
            )}
          </Link>
        </li>
        <li>
          <Link
            to={user ? '/perfil' : '/entrar'}
            aria-label={user ? 'Meu perfil' : 'Entrar'}
            className={item(pathname.startsWith('/perfil') || pathname === '/entrar')}
          >
            <User className="size-6" aria-hidden fill="currentColor" />
          </Link>
        </li>
      </ul>
    </nav>
  )
}
