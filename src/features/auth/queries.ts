import { useMutation } from '@tanstack/react-query'
import type { LoginRequest, RegisterRequest } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { guestCartId, rotateGuestCartId, sessionStore } from '@/session/store'

/** Login/registration also merge the visitor's cart server-side. */
export function useLogin() {
  return useMutation({
    mutationFn: (body: Omit<LoginRequest, 'guestCartId'>) => api.auth.login({ ...body, guestCartId: guestCartId() }),
    onSuccess: (session) => {
      rotateGuestCartId()
      sessionStore.signIn(session)
    },
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: Omit<RegisterRequest, 'guestCartId'>) =>
      api.auth.register({ ...body, guestCartId: guestCartId() }),
    onSuccess: (session) => {
      rotateGuestCartId()
      sessionStore.signIn(session)
    },
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout()
      } catch {
        // Local logout must succeed even if the server is unreachable.
      }
    },
    onSettled: () => sessionStore.signOut('logout'),
  })
}
