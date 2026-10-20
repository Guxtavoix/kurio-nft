import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ChangePasswordRequest,
  Profile,
  SecondaryWalletRequest,
  UpdateProfileRequest,
  WalletInput,
  WalletsResponse,
} from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { useOwner, useSession } from '@/session/hooks'
import { sessionStore } from '@/session/store'

export function useProfile() {
  const owner = useOwner()
  const s = useSession()
  return useQuery({
    queryKey: qk.profile(owner),
    queryFn: ({ signal }) => api.profile.get({ signal }),
    enabled: s.status === 'authenticated',
  })
}

function useProfileMutation<V>(fn: (v: V) => Promise<Profile>) {
  const qc = useQueryClient()
  const owner = useOwner()
  return useMutation({
    mutationFn: fn,
    onSuccess: (profile) => {
      qc.setQueryData(qk.profile(owner), profile)
      // Header shows name/avatar from the session user.
      const s = sessionStore.get()
      if (s.status === 'authenticated') {
        sessionStore.updateUser({
          ...s.user,
          displayName: profile.displayName,
          username: profile.username,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
        })
      }
    },
  })
}

export const useUpdateProfile = () => useProfileMutation((v: UpdateProfileRequest) => api.profile.update(v))
export const useSetAvatar = () => useProfileMutation((dataUrl: string) => api.profile.setAvatar(dataUrl))
export const useRemoveAvatar = () => useProfileMutation(() => api.profile.removeAvatar())

export function useChangePassword() {
  return useMutation({ mutationFn: (v: ChangePasswordRequest) => api.profile.changePassword(v) })
}

export function useWallets() {
  const owner = useOwner()
  const s = useSession()
  return useQuery({
    queryKey: qk.wallets(owner),
    queryFn: ({ signal }) => api.wallets.get({ signal }),
    enabled: s.status === 'authenticated',
  })
}

function useWalletsMutation<V>(fn: (v: V) => Promise<WalletsResponse>) {
  const qc = useQueryClient()
  const owner = useOwner()
  return useMutation({
    mutationFn: fn,
    onSuccess: (w) => qc.setQueryData(qk.wallets(owner), w),
  })
}

export const useSavePrimaryWallet = () => useWalletsMutation((v: WalletInput) => api.wallets.savePrimary(v))
export const useSaveSecondaryWallet = () =>
  useWalletsMutation((v: SecondaryWalletRequest) => api.wallets.saveSecondary(v))
