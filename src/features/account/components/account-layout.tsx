import { Link, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import activityIcon from '@/assets/icons/account/activity.svg'
import dangerIcon from '@/assets/icons/account/danger.svg'
import downloadIcon from '@/assets/icons/account/download.svg'
import heartIcon from '@/assets/icons/account/heart.svg'
import locationIcon from '@/assets/icons/account/location.svg'
import logoutIcon from '@/assets/icons/account/logout.svg'
import shoppingIcon from '@/assets/icons/account/shopping.svg'
import userIcon from '@/assets/icons/account/user.svg'
import { useLogout } from '@/features/auth/queries'
import { cn } from '@/lib/utils'

type Item = { label: string; icon: string; size: number } & ({ to: '/perfil' | '/perfil/carteiras' | '/perfil/favoritos' } | { soon: string })

const ITEMS: Item[] = [
  { label: 'Dados do perfil', icon: userIcon, size: 18, to: '/perfil' },
  { label: 'Carteiras', icon: locationIcon, size: 20, to: '/perfil/carteiras' },
  { label: 'Atividade', icon: shoppingIcon, size: 18, soon: 'atividade' },
  { label: 'Lista de interesse', icon: heartIcon, size: 16, to: '/perfil/favoritos' },
  { label: 'Ofertas', icon: activityIcon, size: 18, soon: 'ofertas' },
  { label: 'Arquivos baixados', icon: downloadIcon, size: 18, soon: 'downloads' },
  { label: 'Suporte', icon: dangerIcon, size: 18, soon: 'suporte' },
]

/** Figma "Account Sidebar" (310px) + content column. */
export function AccountLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const logout = useLogout()

  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-7 px-4 pt-6 md:pt-8 lg:grid-cols-[310px_minmax(0,1fr)] xl:px-0">
      <nav aria-label="Meu perfil" className="bg-surface-card h-fit min-w-0 py-2">
        <h2 className="text-fg p-2.5 text-lg leading-4 font-bold">Meu perfil</h2>
        <ul className="flex overflow-x-auto lg:flex-col">
          {ITEMS.map((item) => {
            const active = 'to' in item && pathname === item.to
            const content = (
              <>
                <img src={item.icon} alt="" width={item.size} height={item.size} className="shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </>
            )
            const cls = cn(
              'text-accent-text flex items-center gap-3 border-l-[6px] px-4 text-[15px] leading-[45px] hover:bg-surface-dark',
              active ? 'border-brand' : 'border-transparent',
            )
            return (
              <li key={item.label}>
                {'to' in item ? (
                  <Link to={item.to} className={cls} aria-current={active ? 'page' : undefined}>
                    {content}
                  </Link>
                ) : (
                  <Link to="/em-breve/$secao" params={{ secao: item.soon }} className={cls}>
                    {content}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
        <div aria-hidden className="bg-brand h-[0.3px]" />
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="text-accent-text flex h-10 w-full items-center gap-2 px-4 text-[15px] leading-[15px] font-bold hover:bg-surface-dark"
          data-testid="sidebar-logout"
        >
          <img src={logoutIcon} alt="" width={20} height={20} />
          Sair
        </button>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
