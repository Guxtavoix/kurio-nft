import { createFileRoute, Link } from '@tanstack/react-router'
import { errorMessage } from '@/api/errors'
import { EmptyState, ErrorState } from '@/components/feedback/states'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { useFavorites } from '@/features/favorites/queries'

export const Route = createFileRoute('/_private/perfil/favoritos')({
  head: () => ({ meta: [{ title: 'Lista de interesse — Kurio' }] }),
  component: FavoritesPage,
})

function FavoritesPage() {
  const favorites = useFavorites()
  return (
    <section aria-labelledby="fav-title" className="flex flex-col gap-8">
      <h1 id="fav-title" className="text-fg text-base leading-4 font-bold">
        Lista de interesse
      </h1>
      {favorites.isPending ? (
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : favorites.isError ? (
        <ErrorState message={errorMessage(favorites.error)} onRetry={() => void favorites.refetch()} />
      ) : favorites.data.items.length === 0 ? (
        <EmptyState
          title="Nenhum favorito ainda"
          message="Toque no coração de um NFT para guardá-lo aqui."
          action={
            <Link to="/" hash="catalogo" className="text-accent-text underline">
              Explorar NFTs
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3" data-testid="favorites-grid">
          {favorites.data.items.map((n) => (
            <li key={n.id}>
              <NftCard nft={n} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
