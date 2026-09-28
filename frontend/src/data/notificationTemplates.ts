import type { NotificationKind } from '../types/notification';

export interface NotificationTemplate {
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
}

export interface SeedNotification extends NotificationTemplate {
  minutesAgo: number;
  read: boolean;
}

// Periodic "live" events pushed while a user is signed in.
export const liveTemplates: Record<'farmer' | 'admin', NotificationTemplate[]> = {
  farmer: [
  { kind: 'oracle', title: 'Rainfall update', body: 'New dekadal readings arrived from CHIRPS for Sokoto State.', href: '/farmer/policies' },
  { kind: 'evaluation', title: 'Coverage window reminder', body: 'One of your coverage windows closes in 3 days.', href: '/farmer/policies' },
  { kind: 'oracle', title: 'Sources in agreement', body: 'All three rainfall sources agree within 6% this dekad.', href: '/farmer' },
  { kind: 'system', title: 'Wallet synced', body: 'Your Sepolia wallet balance was refreshed.', href: '/farmer/payouts' }],

  admin: [
  { kind: 'oracle', title: 'NASA POWER feed updated', body: 'Dekadal values ingested. Reputation scores recomputed.', href: '/admin/oracles' },
  { kind: 'oracle', title: 'Meteostat latency', body: 'Station feed responded in 2.8 s, above the 2 s target.', href: '/admin/oracles' },
  { kind: 'policy', title: 'Premium received', body: 'A premium payment was confirmed on Sepolia.', href: '/admin/policies' },
  { kind: 'evaluation', title: 'Evaluation queue', body: 'Policies are awaiting an oracle round.', href: '/admin' }]

};

export const seedNotifications: Record<'farmer' | 'admin', SeedNotification[]> = {
  farmer: [
  { kind: 'system', title: 'Welcome to Sokoto Rainfall Cover', body: 'Your wallet is connected to the Sepolia testnet.', href: '/farmer/profile', minutesAgo: 2, read: false },
  { kind: 'oracle', title: 'Dry spell detected', body: 'July rainfall is tracking 12% below the 2023 average in your LGA.', href: '/farmer/policies', minutesAgo: 95, read: false },
  { kind: 'evaluation', title: 'Evaluation scheduled', body: 'Policies for the July window will be evaluated after 31 Jul.', href: '/farmer/policies', minutesAgo: 60 * 26, read: true }],

  admin: [
  { kind: 'evaluation', title: 'Policies awaiting evaluation', body: 'Coverage windows have closed for several active policies.', href: '/admin', minutesAgo: 5, read: false },
  { kind: 'oracle', title: 'Reputation recomputed', body: 'CHIRPS now leads with the highest peer agreement.', href: '/admin/oracles', minutesAgo: 140, read: false },
  { kind: 'system', title: 'Backtest completed', body: '30 historical policies scored across three configurations.', href: '/admin/backtest', minutesAgo: 60 * 20, read: true }]

};