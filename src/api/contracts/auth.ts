import { z } from 'zod'
import { IsoDate } from './common'

export const User = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof User>

export const Session = z.object({
  token: z.string(),
  user: User,
  expiresAt: IsoDate,
})
export type Session = z.infer<typeof Session>

export const SessionInfo = z.object({
  user: User,
  expiresAt: IsoDate,
})
export type SessionInfo = z.infer<typeof SessionInfo>

const password = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(72, 'A senha deve ter no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'A senha deve conter letras')
  .regex(/\d/, 'A senha deve conter números')

export const LoginRequest = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
  /** Guest cart to merge into the user's cart after authentication. */
  guestCartId: z.string().optional(),
})
export type LoginRequest = z.infer<typeof LoginRequest>

export const RegisterRequest = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Mínimo de 3 caracteres')
    .max(24, 'Máximo de 24 caracteres')
    .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, "_" ou "."'),
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  password,
  guestCartId: z.string().optional(),
})
export type RegisterRequest = z.infer<typeof RegisterRequest>

/** Client-side form schema (adds confirmation, stripped before sending). */
export const RegisterForm = RegisterRequest.omit({ guestCartId: true })
  .extend({ confirmPassword: z.string().min(1, 'Confirme a senha') })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
export type RegisterForm = z.infer<typeof RegisterForm>

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: password,
})
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>

export const ChangePasswordForm = ChangePasswordRequest.extend({
  confirmPassword: z.string().min(1, 'Confirme a nova senha'),
}).refine((v) => v.newPassword === v.confirmPassword, {
  path: ['confirmPassword'],
  message: 'As senhas não coincidem',
})
export type ChangePasswordForm = z.infer<typeof ChangePasswordForm>

export { password as PasswordRule }
