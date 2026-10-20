import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LogOut, User, Wallet } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import cartIcon from '@/assets/icons/cart.svg'
import logoutIcon from '@/assets/icons/logout.svg'
import searchIcon from '@/assets/icons/search.svg'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/auth/queries'
import { useCart } from '@/features/cart/queries'
import { cn } from '@/lib/utils'
import { useAuthUser } from '@/session/hooks'
import { UserAvatar } from './user-avatar'

type NavKey = 'home' | 'market' | 'creators' | 'learn'

export function activeNav(pathname: string): NavKey | null {
  if (/^\/(nft|carrinho|pagamento|pedido)/.test(pathname)) return 'market'
  if (pathname.startsWith('/em-breve/criadores')) return 'creators'
  if (pathname.startsWith('/em-breve/aprenda')) return 'learn'
  return 'home'
}

const NAV: { key: NavKey; label: string; to: string; params?: Record<string, string>; hash?: string }[] = [
  { key: 'home', label: 'Início', to: '/' },
  { key: 'market', label: 'Mercado', to: '/', hash: 'catalogo' },
  { key: 'creators', label: 'Criadores', to: '/em-breve/$secao', params: { secao: 'criadores' } },
  { key: 'learn', label: 'Aprenda', to: '/em-breve/$secao', params: { secao: 'aprenda' } },
]

/** Desktop/tablet header (Figma "Header Row"). Hidden below md, where the
 *  mobile layout uses a bottom tab bar instead. */
export function Header({ divider = true }: { divider?: boolean }) {
  const { pathname, href } = useLocation()
  const active = activeNav(pathname)
  const user = useAuthUser()
  const cart = useCart()
  const count = cart.data?.itemCount ?? 0
  const logout = useLogout()

  return (
    <header className="hidden md:block">
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 xl:px-0">
        <div className="flex items-start justify-between gap-6">
          <Link to="/" className="text-fg flex h-[34px] w-[160px] items-center text-sm font-bold tracking-[1.4px]" aria-label="Kurio — página inicial">
            KURIO
          </Link>
          <nav aria-label="Principal" className="flex gap-6 lg:gap-10">
            {NAV.map((item) => {
              const isActive = item.key === active
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  params={item.params as never}
                  hash={item.hash}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex flex-col gap-6 text-base whitespace-nowrap',
                    isActive ? 'text-accent-text font-bold' : 'text-fg font-normal hover:text-accent-text',
                  )}
                >
                  <span>{item.label}</span>
                  <span aria-hidden className={cn('h-[3px] w-full', isActive ? 'bg-brand' : 'bg-transparent')} />
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-7">
            <HeaderSearch />
            <Link
              to="/carrinho"
              className="relative inline-grid size-6 place-items-start"
              aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
              data-testid="header-cart"
            >
              <img src={cartIcon} alt="" width={24} height={24} />
              {count > 0 && (
                <span
                  aria-hidden
                  className="bg-brand text-ink absolute -top-0.5 left-[13px] grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink px-1 text-[10px] font-medium"
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="bg-surface-card text-fg flex h-[35px] items-center gap-2 rounded-md px-2 text-sm"
                  aria-label={`Menu da conta de ${user.displayName}`}
                  data-testid="account-menu"
                >
                  <UserAvatar user={user} size={24} />
                  <span className="max-w-[120px] truncate">{user.displayName}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-text-secondary truncate text-xs">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/perfil">
                      <User aria-hidden /> Meu perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/perfil/carteiras">
                      <Wallet aria-hidden /> Carteiras
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => logout.mutate()} data-testid="logout">
                    <LogOut aria-hidden /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/entrar"
                search={{ redirect: href }}
                className="bg-brand text-ink flex h-[35px] w-[100px] items-center justify-center gap-1 rounded-md text-base font-medium hover:brightness-110"
              >
                <img src={logoutIcon} alt="" width={18} height={17} />
                Entrar
              </Link>
            )}
          </div>
        </div>
        {divider && <div aria-hidden className="bg-brand mt-0 h-[0.3px] w-full" />}
      </div>
    </header>
  )
}

function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const navigate = useNavigate()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  return (
    <form
      role="search"
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const q = value.trim()
        void navigate({ to: '/', search: (prev) => ({ ...prev, q: q || undefined, page: undefined }), hash: 'catalogo' })
        setOpen(false)
      }}
    >
      <label htmlFor={id} className="sr-only">
        Buscar NFTs
      </label>
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Buscar NFTs…"
        className={cn(
          'bg-surface-card text-fg placeholder:text-muted-gold h-[35px] rounded-md border border-line px-3 text-sm transition-[width,opacity]',
          open ? 'w-[200px] opacity-100' : 'pointer-events-none w-0 border-0 px-0 opacity-0',
        )}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
      />
      <button
        type={open ? 'submit' : 'button'}
        onClick={() => !open && setOpen(true)}
        aria-label={open ? 'Buscar' : 'Abrir busca'}
        aria-expanded={open}
        className="grid size-8 place-items-center rounded-md"
      >
        <img src={searchIcon} alt="" width={20} height={20} />
      </button>
    </form>
  )
}
