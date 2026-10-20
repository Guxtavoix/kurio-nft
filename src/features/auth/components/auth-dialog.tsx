import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { LoginRequest, RegisterForm } from '@/api/contracts'
import closeIcon from '@/assets/icons/close.svg'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FormError, FormField, inputClass, PasswordInput } from '@/components/ui/form-field'
import { useZodForm } from '@/lib/use-zod-form'
import { cn } from '@/lib/utils'
import { useLogin, useRegister } from '../queries'
import { SocialButtons } from './social-buttons'

type Mode = 'login' | 'register'

/** Only same-origin relative paths are accepted as return targets. */
export function safeRedirect(target: string | undefined) {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/'
  if (target.startsWith('/entrar') || target.startsWith('/cadastro')) return '/'
  return target
}

/**
 * Figma "Sign In Modal" / "Sign Up Modal" (500px, surface-card, orange
 * bottom bar). Full-screen on mobile (Figma Mobile / Login). Focus is
 * trapped by the Radix dialog and returns to the page on close.
 */
export function AuthDialog({ mode, redirect, reason }: { mode: Mode; redirect?: string; reason?: 'expirada' }) {
  const navigate = useNavigate()
  const target = safeRedirect(redirect)
  const close = () => void navigate({ to: target === '/' ? '/' : target, replace: true })

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'bg-surface-card text-fg max-w-none gap-0 overflow-y-auto border-0 p-0 shadow-2xl',
          'inset-0 h-dvh w-full translate-x-0 translate-y-0 rounded-none',
          'md:inset-auto md:top-[160px] md:left-1/2 md:h-auto md:max-h-[calc(100dvh-180px)] md:w-[500px] md:-translate-x-1/2',
        )}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(document.querySelector('[data-autofocus]') as HTMLElement | null)?.focus()
        }}
      >
        <DialogClose className="absolute top-3 right-3 grid size-8 place-items-center rounded-md" aria-label="Fechar">
          <img src={closeIcon} alt="" width={18} height={18} />
        </DialogClose>

        <div className="flex flex-col items-center gap-10 px-6 pt-24 md:px-12 md:pt-12">
          <p className="text-fg text-3xl font-bold tracking-[1.4px] md:hidden" aria-hidden>
            KURIO
          </p>
          <nav aria-label="Acesso" className="flex items-center gap-2 text-xl leading-4 font-medium">
            <Link
              to="/entrar"
              search={{ redirect }}
              replace
              aria-current={mode === 'login' ? 'page' : undefined}
              className={mode === 'login' ? 'text-accent-text' : 'text-fg hover:text-accent-text'}
            >
              Entrar
            </Link>
            <span aria-hidden className="bg-coral h-5 w-px" />
            <Link
              to="/cadastro"
              search={{ redirect }}
              replace
              aria-current={mode === 'register' ? 'page' : undefined}
              className={mode === 'register' ? 'text-accent-text' : 'text-fg hover:text-accent-text'}
            >
              Criar conta
            </Link>
          </nav>
          <DialogTitle className="sr-only">{mode === 'login' ? 'Entrar na Kurio' : 'Criar conta na Kurio'}</DialogTitle>
          <DialogDescription className="text-fg text-center text-[13px] leading-4 font-normal">
            {mode === 'login'
              ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
              : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
          </DialogDescription>
        </div>

        {reason === 'expirada' && (
          <p role="alert" className="text-accent-text bg-surface-dark mx-6 mt-6 rounded-md px-3 py-2 text-center text-sm md:mx-20">
            Sua sessão expirou. Entre novamente para continuar de onde parou.
          </p>
        )}

        {mode === 'login' ? <LoginForm onDone={close} /> : <RegisterFormView onDone={close} />}

        <div className="flex flex-col gap-3 pt-6 pb-12">
          <div className="flex items-center gap-3">
            <span aria-hidden className="bg-line h-px flex-1" />
            <span className="text-fg text-[13px] leading-4">Ou continue com</span>
            <span aria-hidden className="bg-line h-px flex-1" />
          </div>
          <div className="px-6 md:px-20">
            <SocialButtons />
          </div>
          <p className="text-text-secondary mt-6 text-center text-sm md:hidden">
            {mode === 'login' ? (
              <Link to="/cadastro" search={{ redirect }} replace>
                Novo na Kurio? Crie uma conta
              </Link>
            ) : (
              <Link to="/entrar" search={{ redirect }} replace>
                Já tem conta? Entrar
              </Link>
            )}
          </p>
        </div>
        <div aria-hidden className="bg-brand absolute inset-x-0 bottom-0 hidden h-2.5 md:block" />
      </DialogContent>
    </Dialog>
  )
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const login = useLogin()
  const form = useZodForm(LoginRequest.omit({ guestCartId: true }), { email: '', password: '' })

  return (
    <form
      ref={form.formRef}
      noValidate
      className="flex flex-col gap-5 px-6 pt-6 md:px-20"
      onSubmit={(e) => {
        e.preventDefault()
        const data = form.validate()
        if (!data || login.isPending) return
        login.mutate(data, {
          onSuccess: (s) => {
            toast.success(`Bem-vindo(a), ${s.user.displayName}!`)
            onDone()
          },
          onError: (err) => form.applyServerError(err),
        })
      }}
      data-testid="login-form"
    >
      <FormError message={form.errors._form} />
      <FormField label="E-mail" hideLabel error={form.errors.email}>
        {(a) => <input {...a} {...form.field('email')} type="email" autoComplete="email" placeholder="contato@email.com" className={inputClass} data-autofocus />}
      </FormField>
      <FormField label="Senha" hideLabel error={form.errors.password}>
        {(a) => <PasswordInput {...a} {...form.field('password')} autoComplete="current-password" placeholder="Senha" />}
      </FormField>
      <div className="flex justify-end">
        <Link to="/em-breve/$secao" params={{ secao: 'esqueci-senha' }} className="text-accent-text text-sm leading-4">
          Esqueceu a senha?
        </Link>
      </div>
      <button
        type="submit"
        disabled={login.isPending}
        className="bg-brand text-ink mt-6 h-[45px] rounded-[5px] text-base leading-4 font-bold disabled:opacity-60"
      >
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function RegisterFormView({ onDone }: { onDone: () => void }) {
  const register = useRegister()
  const form = useZodForm(RegisterForm, { username: '', email: '', password: '', confirmPassword: '' })

  return (
    <form
      ref={form.formRef}
      noValidate
      className="flex flex-col gap-5 px-6 pt-6 md:px-20"
      onSubmit={(e) => {
        e.preventDefault()
        const data = form.validate()
        if (!data || register.isPending) return
        const { confirmPassword: _c, ...body } = data
        register.mutate(body, {
          onSuccess: () => {
            toast.success('Conta criada com sucesso!')
            onDone()
          },
          onError: (err) => form.applyServerError(err),
        })
      }}
      data-testid="register-form"
    >
      <FormError message={form.errors._form} />
      <FormField label="Nome de usuário" hideLabel error={form.errors.username}>
        {(a) => <input {...a} {...form.field('username')} autoComplete="username" placeholder="Nome de usuário" className={inputClass} data-autofocus />}
      </FormField>
      <FormField label="E-mail" hideLabel error={form.errors.email}>
        {(a) => <input {...a} {...form.field('email')} type="email" autoComplete="email" placeholder="Digite seu e-mail" className={inputClass} />}
      </FormField>
      <FormField label="Senha" hideLabel error={form.errors.password} hint="Mínimo de 8 caracteres, com letras e números.">
        {(a) => <PasswordInput {...a} {...form.field('password')} autoComplete="new-password" placeholder="Senha" />}
      </FormField>
      <FormField label="Confirmar senha" hideLabel error={form.errors.confirmPassword}>
        {(a) => <PasswordInput {...a} {...form.field('confirmPassword')} autoComplete="new-password" placeholder="Confirmar senha" />}
      </FormField>
      <button
        type="submit"
        disabled={register.isPending}
        className="bg-brand text-ink mt-3 h-[45px] rounded-[5px] text-base leading-4 font-bold disabled:opacity-60"
      >
        {register.isPending ? 'Criando conta…' : 'Criar conta'}
      </button>
    </form>
  )
}
