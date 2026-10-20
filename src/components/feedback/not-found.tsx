import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFound({ title = 'Página não encontrada', description }: { title?: string; description?: string }) {
  return (
    <section className="mx-auto flex max-w-[600px] flex-col items-center gap-6 px-4 py-24 text-center" aria-labelledby="nf-title">
      <p className="text-accent-text text-sm font-bold tracking-[1.4px]">ERRO 404</p>
      <h1 id="nf-title" className="text-fg text-[28px] font-bold leading-[36px]">
        {title}
      </h1>
      <p className="text-text-secondary text-sm leading-6">
        {description ?? 'O endereço acessado não existe ou foi removido. Volte ao início para continuar explorando.'}
      </p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </section>
  )
}
