import type { DbUser, DbWallets } from '../db/types'

/**
 * Demo accounts (fictitious). Passwords are stored as salted SHA-256 hashes;
 * the plain values below are documented in the README for the evaluator:
 *   ana@kurio.test   / kurio2026
 *   bruno@kurio.test / nomad2026
 */
export const SEED_USERS: DbUser[] = [
  {
    id: 'usr_ana',
    username: 'ana.sato',
    displayName: 'Ana Sato',
    email: 'ana@kurio.test',
    salt: 's-ana-7f3a',
    passwordHash: '0c56894eb7b14e3a2073478e0575a5296c170c3875ff98e128b48264c19b2bfb',
    ensName: 'anasato',
    walletNickname: 'Cofre principal',
    avatarUrl: null,
    updatedAt: '2026-07-01T12:00:00.000Z',
  },
  {
    id: 'usr_bruno',
    username: 'bruno.lima',
    displayName: 'Bruno Lima',
    email: 'bruno@kurio.test',
    salt: 's-bruno-91c2',
    passwordHash: '76dc0b2ed82f0138899c9571c74479ecda8e989630f305b9bf6cde09a1af2440',
    ensName: 'brunolima',
    walletNickname: 'Carteira do Bruno',
    avatarUrl: null,
    updatedAt: '2026-07-01T12:00:00.000Z',
  },
]

export const SEED_WALLETS: Record<string, DbWallets> = {
  usr_ana: {
    primary: {
      id: 'wal_ana_primary',
      slot: 'primary',
      displayName: 'Ana Sato',
      nickname: 'Cofre principal',
      network: 'ethereum',
      profileName: 'anasato',
      address: '0x5aE1b2C3d4E5f60718293a4B5c6D7e8F90a1B2c3',
      secondaryAddress: '',
      walletType: 'metamask',
      referralCode: 'KURIO-ANA',
      email: 'ana@kurio.test',
      ensName: 'anasato',
      updatedAt: '2026-07-01T12:00:00.000Z',
    },
    secondary: null,
    secondarySameAsPrimary: false,
  },
  // Bruno starts without wallets to exercise the "cadastre uma carteira" path.
  usr_bruno: { primary: null, secondary: null, secondarySameAsPrimary: false },
}

export const SEED_FAVORITES: Record<string, string[]> = {
  usr_ana: ['sage-nomad-009', 'golden-beat-207'],
  usr_bruno: [],
}
