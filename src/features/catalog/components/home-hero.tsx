import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { NftImage } from '@/components/nft/nft-image'
import { cn } from '@/lib/utils'

const AUTOPLAY_MS = 7000

/**
 * Hero (Figma "Hero"): copy + CTA on the left, 450px featured artwork on the
 * right, 3 carousel dots. The artwork rotates through featured NFTs; autoplay
 * pauses on hover/focus and is disabled with prefers-reduced-motion.
 */
export function HomeHero({ items }: { items: NftSummary[] | undefined }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = items?.length ?? 0

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (paused || reduce || count < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS)
    return () => clearInterval(t)
  }, [paused, count])

  const current = items?.[index]

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="mx-auto w-full max-w-[1200px] px-4 xl:px-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative mt-4 flex items-center justify-between gap-3 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#3a2418] to-[#241612] p-4 md:mt-8 md:h-[450px] md:gap-8 md:rounded-none md:bg-none md:p-0 md:pl-10">
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:w-[600px] md:flex-none md:shrink md:gap-11">
          <div className="flex flex-col gap-2 md:gap-8">
            <div className="flex flex-col gap-1">
              <div className="text-fg flex flex-col gap-1 md:gap-2">
                <p className="text-xs leading-4 font-medium tracking-[0.5px] md:text-sm md:tracking-[1.4px]">Bem-vindo à Kurio</p>
                <h1 className="text-[17px] leading-[28px] font-bold md:text-[34px] md:leading-[56px] lg:text-[43px] lg:leading-[70px]">
                  SEJA DONO DO FUTURO
                  <br />
                  DA ARTE DIGITAL
                </h1>
              </div>
              <p className="text-text-secondary max-w-[557px] text-xs leading-5 md:text-sm md:leading-6">
                Descubra NFTs selecionados de criadores emergentes e consagrados.
                <span className="hidden md:inline"> Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</span>
              </p>
            </div>
            <Link
              to="/"
              hash="catalogo"
              className="text-accent-text flex w-fit items-center gap-2 text-sm font-bold md:bg-brand md:text-ink md:h-10 md:w-[140px] md:justify-center md:rounded-md md:text-base md:leading-5 md:hover:brightness-110"
            >
              EXPLORAR <span aria-hidden className="md:hidden">→</span>
            </Link>
          </div>
          {count > 1 && (
            <div className="-my-2 flex self-end" role="group" aria-label="Escolher destaque">
              {items!.map((n, i) => (
                // 24px hit area around the 8px dot (WCAG target size).
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Destaque ${i + 1}: ${n.name}`}
                  aria-current={i === index}
                  className="grid size-6 place-items-center"
                >
                  <span aria-hidden className={cn('size-2 rounded-full transition-opacity', i === index ? 'bg-brand' : 'bg-brand opacity-40')} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative size-[138px] shrink-0 overflow-hidden rounded-[18px] md:size-[360px] md:rounded-[24px] lg:size-[450px]">
          {current ? (
            <Link to="/nft/$nftId" params={{ nftId: current.id }} aria-label={`Ver ${current.name}`} aria-live="polite">
              <NftImage
                src={current.image}
                alt={current.imageAlt}
                sizes="(min-width: 1024px) 450px, (min-width: 768px) 360px, 138px"
                priority
                width={450}
                height={450}
                className="size-full"
              />
            </Link>
          ) : (
            <div className="skeleton-shimmer size-full" aria-hidden />
          )}
        </div>
      </div>
    </section>
  )
}
