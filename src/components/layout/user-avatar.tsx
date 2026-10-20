import type { User } from '@/api/contracts'

export function UserAvatar({ user, size = 32 }: { user: Pick<User, 'displayName' | 'avatarUrl'>; size?: number }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="bg-brand text-ink grid place-items-center rounded-full font-bold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {user.displayName.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
