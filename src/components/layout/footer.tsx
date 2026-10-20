import { Link } from '@tanstack/react-router'
import { useId, useState } from 'react'
import facebook from '@/assets/icons/facebook.svg'
import instagram from '@/assets/icons/instagram.svg'
import linkedin from '@/assets/icons/linkedin.svg'
import twitter from '@/assets/icons/twitter.svg'
import youtube from '@/assets/icons/youtube.svg'
import type { Category } from '@/api/contracts'
import { cn } from '@/lib/utils'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

type FooterLink = { label: string } & (
  | { to: '/perfil' | '/perfil/favoritos' }
  | { soon: string }
  | { category: Category }
)

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Meu perfil',
    links: [
      { label: 'Meu perfil', to: '/perfil' },
      { label: 'Minha coleção', soon: 'colecao' },
      { label: 'Atividade', soon: 'atividade' },
      { label: 'Estúdio do criador', soon: 'estudio' },
      { label: 'Lista de interesse', to: '/perfil/favoritos' },
    ],
  },
  {
    title: 'Central de ajuda',
    links: [
      { label: 'Central de ajuda', soon: 'ajuda' },
      { label: 'Como comprar NFTs', soon: 'ajuda' },
      { label: 'Carteira e segurança', soon: 'ajuda' },
      { label: 'Política do mercado', soon: 'ajuda' },
      { label: 'Denunciar item', soon: 'suporte' },
    ],
  },
  {
    title: 'Coleções',
    links: [
      { label: 'Arte digital', category: 'arte-digital' },
      { label: 'Fotografia', category: 'fotografia' },
      { label: 'Música', category: 'musica' },
      { label: 'Arte 3D', category: 'arte-3d' },
      { label: 'Utilidade', category: 'utilidade' },
    ],
  },
]

const SOCIAL = [
  { icon: facebook, label: 'Facebook' },
  { icon: instagram, label: 'Instagram' },
  { icon: twitter, label: 'X (Twitter)' },
  { icon: linkedin, label: 'LinkedIn' },
  { icon: youtube, label: 'YouTube' },
]

function FooterAnchor({ link }: { link: FooterLink }) {
  const cls = 'text-fg hover:text-accent-text text-sm leading-[30px]'
  if ('to' in link) return <Link to={link.to} className={cls}>{link.label}</Link>
  if ('category' in link)
    return (
      <Link to="/" search={{ categories: [link.category] }} hash="catalogo" className={cls}>
        {link.label}
      </Link>
    )
  return (
    <Link to="/em-breve/$secao" params={{ secao: link.soon }} className={cls}>
      {link.label}
    </Link>
  )
}

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn('defer-render mx-auto mt-16 w-full max-w-[1200px] px-4 xl:px-0', className)}>
      <div className="bg-surface-card grid gap-8 p-8 md:grid-cols-2 lg:grid-cols-[1fr_1px_auto_1px_auto_1px_357px] lg:gap-0">
        {FEATURES.map((f, i) => (
          <FeatureItem key={f.letter} {...f} divider={i > 0} />
        ))}
        <div aria-hidden className="bg-brand hidden w-px lg:block" />
        <Newsletter />
      </div>
      <div className="bg-surface-dark text-fg grid gap-4 p-8 text-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_228px] lg:items-center lg:gap-[92px]">
        <p className="font-bold tracking-[1.4px]">KURIO</p>
        <p className="leading-[22px]">
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        <a href="mailto:contato@email.com" className="hover:text-accent-text leading-[22px]">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="hover:text-accent-text leading-[22px]">
          +55 11 4002 8922
        </a>
      </div>
      <div className="bg-surface-card grid gap-8 p-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_228px] lg:gap-[124px]">
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2">
            <h2 className="text-fg text-lg leading-4 font-bold">{col.title}</h2>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}>
                  <FooterAnchor link={l} />
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-5">
            <h2 className="text-fg text-lg leading-4 font-bold">Redes sociais</h2>
            <ul className="flex gap-2.5">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <Link
                    to="/em-breve/$secao"
                    params={{ secao: 'redes-sociais' }}
                    aria-label={`${s.label} da Kurio`}
                    className="block size-8 rounded-[5px]"
                  >
                    <img src={s.icon} alt="" width={32} height={32} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-fg text-lg leading-4 font-bold whitespace-nowrap">Carteiras compatíveis</h2>
            <p className="bg-surface-dark border-line-soft text-accent-text flex h-[26px] items-center justify-center rounded-md border px-2 text-[9px] font-bold tracking-[0.1px] whitespace-pre">
              {'METAMASK  •  WALLETCONNECT  •  COINBASE'}
            </p>
          </div>
        </div>
      </div>
      <p className="text-fg py-1 text-center text-sm leading-[30px]">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}

function FeatureItem({ letter, title, text, divider }: { letter: string; title: string; text: string; divider: boolean }) {
  return (
    <>
      {divider && <div aria-hidden className="bg-brand hidden w-px lg:block" />}
      <div className="flex flex-col gap-3 lg:px-4">
        <span aria-hidden className="bg-brand text-ink grid size-[74px] place-items-center rounded-full text-2xl font-bold">
          {letter}
        </span>
        <h2 className="text-fg text-[17px] leading-4 font-bold">{title}</h2>
        <p className="text-text-secondary w-[204px] max-w-full text-sm leading-[22px]">{text}</p>
      </div>
    </>
  )
}

/** Newsletter is out of scope: validates the e-mail, then says so honestly. */
function Newsletter() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<{ type: 'error' | 'info'; text: string } | null>(null)
  return (
    <form
      noValidate
      className="flex flex-col gap-3 lg:px-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!/^\S+@\S+\.\S+$/.test(email)) setMsg({ type: 'error', text: 'Informe um e-mail válido.' })
        else setMsg({ type: 'info', text: 'A inscrição na newsletter não está disponível nesta demonstração.' })
      }}
    >
      <h2 className="text-fg text-lg leading-4 font-bold">Antecipe-se ao próximo lançamento</h2>
      <div className="bg-surface-dark mt-1 flex h-10 items-center rounded-md pl-3 shadow-[0_0_10px_rgba(10,6,4,0.45)]">
        <label htmlFor={id} className="sr-only">
          E-mail para newsletter
        </label>
        <input
          id={id}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          aria-invalid={msg?.type === 'error'}
          aria-describedby={`${id}-msg`}
          className="text-fg placeholder:text-muted-gold min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button type="submit" className="bg-brand text-ink h-10 w-[85px] rounded-r-md text-lg font-bold">
          Enviar
        </button>
      </div>
      <p id={`${id}-msg`} role="status" className={cn('text-[13px] leading-[22px]', msg?.type === 'error' ? 'text-danger' : 'text-text-secondary')}>
        {msg?.text ?? 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
      </p>
    </form>
  )
}
