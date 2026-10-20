import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { FavoriteButton } from './favorite-button'
import { NftImage } from './nft-image'

/**
 * Catalog card (Figma "Frame 141"): 258×300 surface with the 250px artwork,
 * name and price below. The whole card is one link; the favorite toggle is a
 * separate button so keyboard users get both actions.
 */
export function NftCard({ nft, priority = false }: { nft: NftSummary; priority?: boolean }) {
  return (
    <article className="group relative flex flex-col gap-3" aria-labelledby={`nft-${nft.id}-name`} data-testid="nft-card">
      <div className="bg-surface-card relative grid aspect-[258/300] place-items-center">
        <NftImage
          src={nft.image}
          alt={nft.imageAlt}
          sizes="(min-width: 1024px) 250px, (min-width: 640px) 30vw, 45vw"
          priority={priority}
          width={250}
          height={250}
          className={cn('aspect-square w-[96.9%] rounded-xl md:rounded-[15px]', nft.soldOut && 'opacity-60 grayscale-[40%]')}
        />
        {nft.badge === 'raro' && (
          <span className="bg-brand text-ink absolute top-0 left-0 px-3 py-1.5 text-[13px] font-bold">RARO</span>
        )}
        {nft.soldOut && (
          <span className="bg-ink/85 text-fg border-line-soft absolute top-2 right-2 rounded-full border px-3 py-1 text-xs font-bold">
            Esgotado
          </span>
        )}
        <div className="absolute right-3 bottom-3 z-10 flex gap-2 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <FavoriteButton nftId={nft.id} name={nft.name} variant="card" />
        </div>
      </div>
      <h3 id={`nft-${nft.id}-name`} className="text-fg text-sm leading-4 font-normal md:text-base">
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none [&:focus-visible]:after:outline-2 [&:focus-visible]:after:outline-offset-2 [&:focus-visible]:after:outline-[var(--kurio-accent)]"
        >
          {nft.name}
        </Link>
      </h3>
      <p className="flex items-center gap-3 text-base leading-4 md:text-lg">
        <span className="text-accent-text font-bold" data-testid="nft-card-price">
          {formatEth(nft.priceEth)}
        </span>
        {nft.compareAtPriceEth && (
          <span className="text-muted-gold font-normal">
            <span className="sr-only">Preço anterior: </span>
            {formatEth(nft.compareAtPriceEth)}
          </span>
        )}
      </p>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="skeleton-shimmer aspect-[258/300]" />
      <div className="skeleton-shimmer h-4 w-2/3 rounded" />
      <div className="skeleton-shimmer h-4 w-1/3 rounded" />
    </div>
  )
}
