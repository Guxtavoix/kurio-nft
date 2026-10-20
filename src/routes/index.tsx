import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '@/features/catalog/components/home-page'
import { featuredQuery, nftListQuery } from '@/features/catalog/queries'
import { catalogSearchSchema, toListQuery } from '@/features/catalog/search'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => toListQuery(search),
  // Prefetch without blocking navigation: the page renders skeletons while
  // data loads (no waterfall, no blank screen).
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(deps))
    void context.queryClient.prefetchQuery(featuredQuery())
  },
  head: () => ({
    meta: [
      { title: 'Kurio — Marketplace de NFTs' },
      { name: 'description', content: 'Descubra, colecione e compre NFTs selecionados de criadores emergentes e consagrados na Kurio.' },
    ],
  }),
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  return <HomePage search={search} />
}
