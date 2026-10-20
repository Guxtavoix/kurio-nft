import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts'
import promoArrow from '@/assets/icons/promo-arrow.svg'
import promoMask from '@/assets/icons/promo-mask.svg'
import { NftImage } from '@/components/nft/nft-image'

/** Figma "Featured NFT Banner" (sidebar, below filters). */
export function SpotlightBanner({ nft }: { nft: NftSummary | null | undefined }) {
  return (
    <section
      aria-labelledby="spotlight-title"
      className="relative flex flex-col gap-4 bg-gradient-to-b from-[rgba(210,138,76,0.1)] to-[rgba(210,138,76,0.03)] pt-6 pb-1"
    >
      <div className="flex flex-col items-center gap-4 px-5">
        <h2 id="spotlight-title" className="text-accent-text w-full text-center text-2xl leading-8 font-bold">
          NFT EM DESTAQUE
        </h2>
        <p className="text-fg text-center text-[22px] leading-4 font-bold">OFERTA LIMITADA</p>
      </div>
      {nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block overflow-hidden rounded-[22px]" aria-label={`Ver ${nft.name}`}>
          <NftImage src={nft.image} alt={nft.imageAlt} sizes="310px" width={310} height={368} className="h-[368px] w-full" />
        </Link>
      ) : (
        <div className="skeleton-shimmer h-[368px] rounded-[22px]" aria-hidden />
      )}
    </section>
  )
}

const PROMOS = [
  {
    title: ['Lançamentos gênesis', 'de edição limitada'],
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/nfts/emerald-ape',
    alt: 'Macaco marrom com óculos verdes e jaqueta college',
    search: { tab: 'new' as const },
  },
  {
    title: ['Arte digital selecionada', 'e muito mais'],
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/nfts/ivory-baron',
    alt: 'Chimpanzé de gola alta verde e blazer bege',
    search: { categories: ['arte-digital' as const] },
  },
]

/** Figma "Promos": two 586×250 cards. */
export function PromoCards() {
  return (
    <section aria-label="Coleções em destaque" className="defer-render mx-auto mt-16 grid w-full max-w-[1200px] gap-7 px-4 md:grid-cols-2 xl:px-0">
      {PROMOS.map((p) => (
        <article key={p.title[0]} className="bg-surface-card relative grid h-[250px] grid-cols-[1fr_1fr] overflow-hidden rounded-lg">
          <NftImage src={p.image} alt={p.alt} sizes="(min-width: 768px) 292px, 50vw" width={292} height={250} className="h-[250px] w-full rounded-[18px]" />
          <img src={promoMask} alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full" width={586} height={250} />
          <div className="relative flex flex-col items-end justify-center gap-4 px-4 text-right lg:pr-[30px]">
            <h2 className="text-fg text-base leading-6 font-bold lg:text-lg">
              {p.title[0]}
              <br />
              {p.title[1]}
            </h2>
            <p className="text-text-secondary text-xs leading-5 lg:text-sm lg:leading-6">{p.text}</p>
            <Link
              to="/"
              search={p.search}
              hash="catalogo"
              className="bg-brand text-ink flex h-10 w-[140px] items-center justify-center gap-1 rounded-md text-sm leading-5 font-medium"
            >
              Explorar
              <img src={promoArrow} alt="" width={11} height={13} className="-rotate-90" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: '/nfts/ivory-baron' },
  { date: '15 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: '/nfts/emerald-ape' },
  { date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: '/nfts/sage-nomad' },
  { date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: '/nfts/golden-beat' },
]

/** Figma "Blog" — editorial content is out of scope; "Ler mais" says so. */
export function BlogSection() {
  return (
    <section aria-labelledby="blog-title" className="defer-render mx-auto mt-24 w-full max-w-[1200px] px-4 xl:px-0">
      <div className="flex flex-col gap-3 text-center">
        <h2 id="blog-title" className="text-fg text-[24px] leading-[37px] font-bold md:text-[28px]">
          Diário da Cunhagem
        </h2>
        <p className="text-text-secondary text-sm leading-[18px]">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </div>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((p) => (
          <li key={p.title} className="bg-surface-card flex flex-col overflow-hidden rounded-lg">
            <NftImage src={p.image} alt="" sizes="(min-width: 1024px) 268px, 50vw" width={268} height={195} className="h-[195px] w-full" />
            <div className="flex flex-col gap-2 px-4 pt-3 pb-4">
              <p className="text-text-secondary text-xs leading-4 font-medium whitespace-pre-wrap">{`${p.date}  |  Leitura de ${p.read} min`}</p>
              <h3 className="text-text-primary text-base font-bold">{p.title}</h3>
              <p className="text-text-secondary text-xs leading-4 font-medium">{p.text}</p>
              <Link to="/em-breve/$secao" params={{ secao: 'aprenda' }} className="text-accent-text flex gap-1 text-xs">
                <span className="leading-[14px] font-bold">Ler mais</span>
                <span aria-hidden>→</span>
                <span className="sr-only">: {p.title}</span>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
