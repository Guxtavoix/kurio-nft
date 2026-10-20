import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

const LABELS: Record<string, string> = {
  criadores: 'Criadores',
  aprenda: 'Aprenda',
  colecao: 'Minha coleção',
  atividade: 'Atividade',
  estudio: 'Estúdio do criador',
  ajuda: 'Central de ajuda',
  suporte: 'Suporte',
  ofertas: 'Ofertas',
  downloads: 'Arquivos baixados',
  'redes-sociais': 'Redes sociais',
  'esqueci-senha': 'Recuperação de senha',
  'login-social': 'Login social',
}

/** Honest placeholder for sections outside the challenge scope. */
export const Route = createFileRoute('/em-breve/$secao')({
  head: ({ params }) => ({ meta: [{ title: `${LABELS[params.secao] ?? 'Seção'} — Kurio` }] }),
  component: ComingSoon,
})

function ComingSoon() {
  const { secao } = Route.useParams()
  const label = LABELS[secao] ?? 'Esta seção'
  return (
    <section className="mx-auto flex max-w-[600px] flex-col items-center gap-6 px-4 py-24 text-center">
      <p className="text-accent-text text-sm font-bold tracking-[1.4px]">FORA DO ESCOPO DA DEMONSTRAÇÃO</p>
      <h1 className="text-fg text-[28px] leading-9 font-bold">{label}</h1>
      <p className="text-text-secondary text-sm leading-6">
        Esta área não faz parte desta versão do marketplace. Nenhuma ação foi realizada.
      </p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </section>
  )
}
