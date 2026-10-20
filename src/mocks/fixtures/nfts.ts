import type { Category, EditionKind, Network, NftDetail } from '@/api/contracts'
import { eth } from '@/lib/eth'
import { mulberry32 } from '../lib/random'

/**
 * Deterministic catalog. The first entries reproduce the cards in the Figma
 * layout (names, prices, struck-through price, "RARO" badge); the rest are
 * generated from a fixed seed so filters and pagination have enough variety.
 */

type ArtKey = 'emerald' | 'sage' | 'ivory' | 'golden'
const ART: Record<ArtKey, { key: string; alt: string }> = {
  emerald: { key: '/nfts/emerald-ape', alt: 'Macaco marrom com óculos redondos de lentes verdes e jaqueta college verde' },
  sage: { key: '/nfts/sage-nomad', alt: 'Gorila cinza com chapéu bucket verde-oliva e moletom roxo' },
  ivory: { key: '/nfts/ivory-baron', alt: 'Chimpanzé de pelo preto com brinco dourado, gola alta verde e blazer bege' },
  golden: { key: '/nfts/golden-beat', alt: 'Macaco dourado com fones de ouvido verdes e jaqueta creme' },
}

type Seed = {
  name: string
  art: ArtKey
  price: string
  compareAt?: string
  badge?: 'raro' | 'novo'
  category: Category
  network: Network
  collection: string
  soldOut?: boolean
}

const FIGMA_SEEDS: Seed[] = [
  { name: 'Emerald Ape #042', art: 'emerald', price: '1.19', category: 'arte-digital', network: 'ethereum', collection: 'Kurio Apes' },
  { name: 'Sage Nomad #009', art: 'sage', price: '1.69', category: 'arte-digital', network: 'ethereum', collection: 'Nomad Club' },
  { name: 'Neon Vessel #552', art: 'ivory', price: '1.99', compareAt: '2.29', badge: 'raro', category: 'colecionaveis', network: 'polygon', collection: 'Baron Society' },
  { name: 'Cosmic Bloom #118', art: 'sage', price: '1.29', category: 'generativa', network: 'solana', collection: 'Nomad Club' },
  { name: 'Violet Nomad #314', art: 'sage', price: '1.39', category: 'arte-digital', network: 'ethereum', collection: 'Nomad Club' },
  { name: 'Ivory Baron #088', art: 'ivory', price: '1.79', category: 'arte-3d', network: 'ethereum', collection: 'Baron Society' },
  { name: 'Golden Beat #207', art: 'golden', price: '0.99', category: 'musica', network: 'polygon', collection: 'Golden Frequencies' },
  { name: 'Golden Frequency #071', art: 'golden', price: '0.59', category: 'musica', network: 'solana', collection: 'Golden Frequencies' },
  { name: 'Golden Signal #160', art: 'golden', price: '0.39', category: 'musica', network: 'ethereum', collection: 'Golden Frequencies' },
]

const ADJECTIVES = ['Amber', 'Lunar', 'Velvet', 'Crimson', 'Silent', 'Hollow', 'Solar', 'Jade', 'Rust', 'Copper', 'Midnight', 'Dusty', 'Electric', 'Quiet', 'Wild', 'Iron']
const NOUNS: Record<ArtKey, string[]> = {
  emerald: ['Ape', 'Captain', 'Rider', 'Scholar'],
  sage: ['Nomad', 'Drifter', 'Monk', 'Wanderer'],
  ivory: ['Baron', 'Vessel', 'Curator', 'Duke'],
  golden: ['Beat', 'Signal', 'Pulse', 'Echo'],
}
const COLLECTION_BY_ART: Record<ArtKey, string> = {
  emerald: 'Kurio Apes',
  sage: 'Nomad Club',
  ivory: 'Baron Society',
  golden: 'Golden Frequencies',
}
const CATEGORIES_CYCLE: Category[] = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade']
const NETWORKS_CYCLE: Network[] = ['ethereum', 'polygon', 'solana']
const ARTS = Object.keys(ART) as (ArtKey)[]

const TOTAL = 48
/** Reference "now" for fixture timestamps, so data is stable across runs. */
export const FIXTURE_EPOCH = Date.parse('2026-07-29T12:00:00.000Z')

function generatedSeeds(): Seed[] {
  const rnd = mulberry32(20260729)
  const seeds: Seed[] = []
  const used = new Set(FIGMA_SEEDS.map((s) => s.name))
  let i = 0
  while (seeds.length < TOTAL - FIGMA_SEEDS.length) {
    const art = ARTS[i % ARTS.length]!
    const adj = ADJECTIVES[Math.floor(rnd() * ADJECTIVES.length)]!
    const noun = NOUNS[art][Math.floor(rnd() * NOUNS[art].length)]!
    const num = String(Math.floor(rnd() * 900) + 10).padStart(3, '0')
    const name = `${adj} ${noun} #${num}`
    i++
    if (used.has(name)) continue
    used.add(name)
    const price = eth.round(String(0.08 + rnd() * 12.2), 2)
    const discounted = rnd() < 0.15
    seeds.push({
      name,
      art,
      price,
      compareAt: discounted ? eth.round(eth.mul(price, '1.18'), 2) : undefined,
      badge: rnd() < 0.12 ? 'raro' : undefined,
      category: CATEGORIES_CYCLE[Math.floor(rnd() * CATEGORIES_CYCLE.length)]!,
      network: NETWORKS_CYCLE[Math.floor(rnd() * NETWORKS_CYCLE.length)]!,
      collection: COLLECTION_BY_ART[art],
      soldOut: rnd() < 0.06,
    })
  }
  return seeds
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const EDITION_SPECS: { kind: EditionKind; label: string; mult: string; supply: number | null; maxPerOrder: number }[] = [
  { kind: '1/1', label: '1/1', mult: '3.5', supply: 1, maxPerOrder: 1 },
  { kind: '1/10', label: '1/10', mult: '1.6', supply: 10, maxPerOrder: 3 },
  { kind: '1/50', label: '1/50', mult: '1', supply: 50, maxPerOrder: 10 },
  { kind: 'open', label: 'ABERTA', mult: '0.6', supply: null, maxPerOrder: 20 },
]

const CATEGORY_LABEL: Record<Category, string> = {
  'arte-digital': 'arte digital',
  fotografia: 'fotografia',
  musica: 'música',
  'arte-3d': 'arte 3D',
  colecionaveis: 'colecionável',
  generativa: 'arte generativa',
  jogos: 'jogos',
  assinaturas: 'assinatura',
  utilidade: 'utilidade',
}
const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }

const ATTRS: Record<ArtKey, string[]> = {
  emerald: ['Óculos', 'Esmeralda', 'Raro'],
  sage: ['Chapéu bucket', 'Moletom', 'Calmo'],
  ivory: ['Brinco dourado', 'Gola alta', 'Elegante'],
  golden: ['Fones', 'Jaqueta creme', 'Sonoro'],
}

export function buildNftFixtures(): NftDetail[] {
  const seeds = [...FIGMA_SEEDS, ...generatedSeeds()]
  const rnd = mulberry32(42)
  return seeds.map((s, idx) => {
    const tokenNum = s.name.split('#')[1] ?? String(idx).padStart(3, '0')
    const tokenId = `#${tokenNum.padStart(4, '0')}`
    const id = slugify(s.name)
    const art = ART[s.art]!
    const editions = EDITION_SPECS.map((spec) => {
      const priceEth = eth.round(eth.mul(s.price, spec.mult), 3)
      let available: number
      if (s.soldOut) available = 0
      else if (spec.supply === null) available = 999
      else if (spec.kind === '1/1') available = rnd() < 0.7 ? 1 : 0
      else available = Math.max(0, Math.floor(rnd() * (spec.supply + 1)))
      // Keep the Figma cards fully purchasable in the default edition.
      if (idx < FIGMA_SEEDS.length && spec.kind === '1/50') available = 40
      return {
        id: `${id}--${spec.kind === 'open' ? 'open' : spec.kind.replace('/', '-')}`,
        kind: spec.kind,
        label: spec.label,
        priceEth,
        supply: spec.supply,
        available,
        maxPerOrder: spec.maxPerOrder,
      }
    })
    const defaultEdition = editions.find((e) => e.kind === '1/50')!
    // Newest first in the fixture order → index 0 is the most recent.
    const createdAt = new Date(FIXTURE_EPOCH - idx * 36 * 3600 * 1000).toISOString()
    const contractAddress = `0x${Array.from({ length: 40 }, () => Math.floor(rnd() * 16).toString(16)).join('')}`
    const ratingCount = 3 + Math.floor(rnd() * 30)
    const net = NETWORK_LABEL[s.network]
    return {
      id,
      slug: id,
      name: s.name,
      tokenId,
      image: art.key,
      imageAlt: `${s.name}: ${art.alt}`,
      category: s.category,
      network: s.network,
      collectionName: s.collection,
      priceEth: defaultEdition.priceEth,
      compareAtPriceEth: s.compareAt ?? null,
      badge: s.badge ?? null,
      soldOut: editions.every((e) => e.available === 0),
      createdAt,
      version: 1,
      description: `Um colecionável digital finalizado à mão da coleção ${s.collection}, verificado na ${net}, com arte desbloqueável e acesso para colecionadores.`,
      longDescription: [
        `${s.name} é uma obra digital de ${CATEGORY_LABEL[s.category]} da coleção ${s.collection}. Cada atributo fica armazenado nos metadados do token e verificado na ${net}.`,
        'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede.',
      ],
      gallery: Array.from({ length: 4 }, (_, g) => ({ src: art.key, alt: `${s.name}, vista ${g + 1} de 4` })),
      attributes: ATTRS[s.art],
      rating: { average: 4 + Math.round(rnd() * 10) / 10, count: ratingCount },
      contractAddress,
      royaltyPercent: 5,
      defaultEditionId: defaultEdition.id,
      editions,
      reviews: Array.from({ length: Math.min(3, ratingCount) }, (_, r) => ({
        id: `${id}-review-${r}`,
        author: ['nova.sato', 'lia.mint', 'caio.eth'][r]!,
        rating: 5 - (r % 2),
        text: [
          'Arte impecável, a procedência on-chain me deu muita segurança.',
          'Detalhes lindos na versão em alta resolução.',
          'Comunidade ativa e lançamentos frequentes.',
        ][r]!,
      })),
    }
  })
}

/** Popularity score per NFT (stable), used by the "Em alta" tab and sort. */
export function popularityOf(id: string): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % 1000
}
