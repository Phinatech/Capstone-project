import type { Role } from './user';

export type NotificationKind = 'payout' | 'evaluation' | 'policy' | 'oracle' | 'system';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
  userId?: string;
  role?: Role;
}

export interface NewNotification {
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  userId?: string;
  role?: Role;
  toast?: boolean;
}