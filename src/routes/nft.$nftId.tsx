import { createFileRoute } from '@tanstack/react-router'
import { NftDetailPage } from '@/features/catalog/components/nft-detail-page'
import { nftDetailQuery, relatedQuery } from '@/features/catalog/queries'

export const Route = createFileRoute('/nft/$nftId')({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId))
    void context.queryClient.prefetchQuery(relatedQuery(params.nftId))
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.nftId.replace(/-/g, ' ')} — Kurio` },
      { name: 'description', content: 'Detalhes, edições e compra do NFT na Kurio.' },
    ],
  }),
  component: NftRoute,
})

function NftRoute() {
  const { nftId } = Route.useParams()
  // key: reset local state (edition, quantity) when navigating between NFTs.
  return <NftDetailPage key={nftId} nftId={nftId} />
}
