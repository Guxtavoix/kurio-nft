import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChangePasswordForm, UpdateProfileRequest, type Profile } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import imagePlaceholder from '@/assets/icons/image-placeholder.svg'
import { ErrorState } from '@/components/feedback/states'
import { FormError, FormField, inputClass, PasswordInput } from '@/components/ui/form-field'
import { useZodForm } from '@/lib/use-zod-form'
import { useChangePassword, useProfile, useRemoveAvatar, useSetAvatar, useUpdateProfile } from '../queries'
import { EnsInput } from './ens-input'

export function ProfilePage() {
  const profile = useProfile()
  if (profile.isPending) return <ProfileSkeleton />
  if (profile.isError)
    return <ErrorState title="Não foi possível carregar seu perfil" message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
  return <ProfileForm profile={profile.data} />
}

const emptyPasswords = { currentPassword: '', newPassword: '', confirmPassword: '' }

function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const changePassword = useChangePassword()
  const form = useZodForm(UpdateProfileRequest, toValues(profile))
  const pwd = useZodForm(ChangePasswordForm, emptyPasswords)
  const [saved, setSaved] = useState<string | null>(null)

  // Keep the form in sync when the server data changes (e.g. other tab).
  const lastUpdated = useRef(profile.updatedAt)
  useEffect(() => {
    if (profile.updatedAt !== lastUpdated.current) {
      lastUpdated.current = profile.updatedAt
      form.reset(toValues(profile))
    }
  }, [profile, form])

  const wantsPasswordChange = Object.values(pwd.values).some((v) => v)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(null)
    const data = form.validate()
    const pwdData = wantsPasswordChange ? pwd.validate() : null
    if (!data || (wantsPasswordChange && !pwdData)) return

    const results: string[] = []
    try {
      await update.mutateAsync(data)
      results.push('Dados do perfil salvos.')
    } catch (err) {
      form.applyServerError(err, 'Não foi possível salvar o perfil.')
      return
    }
    if (pwdData) {
      try {
        const { confirmPassword: _c, ...body } = pwdData
        await changePassword.mutateAsync(body)
        pwd.reset(emptyPasswords)
        results.push('Senha alterada.')
      } catch (err) {
        pwd.applyServerError(err, 'Não foi possível alterar a senha.')
      }
    }
    const msg = results.join(' ')
    setSaved(msg)
    toast.success(msg)
  }

  const saving = update.isPending || changePassword.isPending

  return (
    <form ref={form.formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-8" data-testid="profile-form">
      <h1 className="text-fg text-base leading-4 font-bold">Perfil do colecionador</h1>
      <FormError message={form.errors._form} />

      <div className="grid gap-6 md:grid-cols-2 md:gap-x-[28px]">
        <FormField label="Nome de exibição" required error={form.errors.displayName}>
          {(a) => <input {...a} {...form.field('displayName')} autoComplete="name" className={inputClass} />}
        </FormField>
        <FormField label="Nome de usuário" required error={form.errors.username}>
          {(a) => <input {...a} {...form.field('username')} autoComplete="username" className={inputClass} />}
        </FormField>
        <FormField label="E-mail" required error={form.errors.email}>
          {(a) => <input {...a} {...form.field('email')} type="email" autoComplete="email" className={inputClass} />}
        </FormField>
        <FormField label="Nome ENS" required error={form.errors.ensName}>
          {(a) => <EnsInput {...a} {...form.field('ensName')} />}
        </FormField>
        <FormField label="Apelido da carteira" required error={form.errors.walletNickname}>
          {(a) => <input {...a} {...form.field('walletNickname')} className={inputClass} />}
        </FormField>
        <AvatarField profile={profile} />
      </div>

      <fieldset className="flex flex-col gap-6 md:max-w-[417px]" ref={pwd.formRef as unknown as React.Ref<HTMLFieldSetElement>}>
        <legend className="text-fg mb-6 text-base leading-4 font-medium">Alterar senha</legend>
        <FormError message={pwd.errors._form} />
        <FormField label="Senha atual" error={pwd.errors.currentPassword}>
          {(a) => <PasswordInput {...a} {...pwd.field('currentPassword')} autoComplete="current-password" />}
        </FormField>
        <FormField label="Nova senha" error={pwd.errors.newPassword} hint="Mínimo de 8 caracteres, com letras e números.">
          {(a) => <PasswordInput {...a} {...pwd.field('newPassword')} autoComplete="new-password" />}
        </FormField>
        <FormField label="Confirmar nova senha" error={pwd.errors.confirmPassword}>
          {(a) => <PasswordInput {...a} {...pwd.field('confirmPassword')} autoComplete="new-password" />}
        </FormField>
      </fieldset>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={saving} className="bg-brand text-ink h-10 w-[131px] rounded-[3px] text-sm leading-4 font-bold disabled:opacity-60">
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <p role="status" className="text-success text-sm">
          {saved}
        </p>
      </div>
    </form>
  )
}

function toValues(p: Profile) {
  return {
    displayName: p.displayName,
    username: p.username,
    email: p.email,
    ensName: p.ensName,
    walletNickname: p.walletNickname,
  }
}

const MAX_BYTES = 1.5 * 1024 * 1024

/** Downscale to 256px WebP before upload (keeps the mock DB small). */
async function fileToAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
  return canvas.toDataURL('image/webp', 0.85)
}

function AvatarField({ profile }: { profile: Profile }) {
  const setAvatar = useSetAvatar()
  const removeAvatar = useRemoveAvatar()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = setAvatar.isPending || removeAvatar.isPending

  const onFile = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Envie uma imagem PNG, JPG ou WEBP.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('A imagem deve ter no máximo 1,5 MB.')
      return
    }
    try {
      const dataUrl = await fileToAvatar(file)
      setAvatar.mutate(dataUrl, {
        onSuccess: () => toast.success('Avatar atualizado'),
        onError: (e) => setError(errorMessage(e)),
      })
    } catch {
      setError('Não foi possível ler a imagem.')
    }
  }

  return (
    <div className="flex flex-col gap-2.5" role="group" aria-labelledby="avatar-label">
      <span id="avatar-label" className="text-fg text-sm leading-5">
        Avatar
      </span>
      <div className="flex items-center gap-6">
        <span className="border-line grid size-[50px] place-items-center overflow-hidden rounded-full border bg-[#2f1d15]" data-testid="avatar-preview">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Seu avatar" width={50} height={50} className="size-full object-cover" />
          ) : (
            <img src={imagePlaceholder} alt="Sem avatar" width={24} height={24} />
          )}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            e.target.value = ''
          }}
          data-testid="avatar-input"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="bg-brand text-ink h-10 w-[98px] rounded-[3px] text-sm leading-4 font-bold disabled:opacity-60"
        >
          {setAvatar.isPending ? 'Enviando…' : 'Alterar'}
        </button>
        <button
          type="button"
          disabled={busy || !profile.avatarUrl}
          onClick={() =>
            removeAvatar.mutate(undefined, {
              onSuccess: () => toast.success('Avatar removido'),
              onError: (e) => setError(errorMessage(e)),
            })
          }
          className="text-fg text-sm leading-4 disabled:opacity-50"
        >
          Remover
        </button>
      </div>
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Carregando perfil">
      <div className="skeleton-shimmer h-4 w-56 rounded" />
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <div className="skeleton-shimmer h-4 w-40 rounded" />
            <div className="skeleton-shimmer h-10 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
