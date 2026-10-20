import { useLocation, useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { useFavorites, useToggleFavorite } from '@/features/favorites/queries'
import { cn } from '@/lib/utils'
import { useAuthUser } from '@/session/hooks'

/**
 * Favorite toggle (aria-pressed). Visitors are sent to login and brought
 * back. Uses the optimistic mutation; the pressed state is derived from the
 * favorites cache, so a rollback is reflected immediately.
 */
export function FavoriteButton({
  nftId,
  name,
  variant = 'card',
  className,
}: {
  nftId: string
  name: string
  variant?: 'card' | 'detail' | 'round'
  className?: string
}) {
  const user = useAuthUser()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const { href } = useLocation()
  const isFav = favorites.data?.nftIds.includes(nftId) ?? false

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      void navigate({ to: '/entrar', search: { redirect: href } })
      return
    }
    toggle.mutate({ nftId, favorite: !isFav, name })
  }

  const label = isFav ? `Remover ${name} dos favoritos` : `Favoritar ${name}`

  if (variant === 'detail') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isFav}
        aria-label={label}
        data-testid="favorite-toggle"
        className={cn(
          'border-brand text-accent-text flex h-[35px] items-center justify-center gap-2 rounded-md border px-3 text-sm',
          className,
        )}
      >
        <Heart className="size-5" aria-hidden fill={isFav ? 'currentColor' : 'none'} />
        {isFav ? 'Favoritado' : 'Favoritar'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isFav}
      aria-label={label}
      data-testid="favorite-toggle"
      className={cn(
        'bg-ink/80 text-accent-text border-line-soft grid size-9 place-items-center rounded-full border backdrop-blur',
        variant === 'round' && 'bg-transparent',
        className,
      )}
    >
      <Heart className="size-[18px]" aria-hidden fill={isFav ? 'currentColor' : 'none'} />
    </button>
  )
}
