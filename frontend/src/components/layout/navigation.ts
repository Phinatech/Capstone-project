import {
  BarChart3Icon,
  BellIcon,
  DatabaseIcon,
  FileTextIcon,
  FlaskConicalIcon,
  LayoutDashboardIcon,
  PlusIcon,
  RadioTowerIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
  WalletIcon } from
'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TranslationKey } from '../../data/translations';
import type { Role } from '../../types/user';

export interface NavItem {
  to: string;
  labelKey: TranslationKey;
  shortKey: TranslationKey;
  icon: LucideIcon;
  exact?: boolean;
  exclude?: string[];
  primary?: boolean;
  badge?: 'notifications';
}

export interface NavSection {
  titleKey: TranslationKey;
  items: NavItem[];
}

const farmerHome: NavItem = { to: '/farmer', labelKey: 'nav.dashboard', shortKey: 'nav.home', icon: LayoutDashboardIcon, exact: true };
const farmerPolicies: NavItem = {
  to: '/farmer/policies',
  labelKey: 'nav.myPolicies',
  shortKey: 'nav.policies',
  icon: FileTextIcon,
  exclude: ['/farmer/policies/new']
};
const farmerBuy: NavItem = { to: '/farmer/policies/new', labelKey: 'nav.buyCover', shortKey: 'nav.buy', icon: PlusIcon, exact: true, primary: true };
const farmerPayouts: NavItem = { to: '/farmer/payouts', labelKey: 'nav.payouts', shortKey: 'nav.payouts', icon: WalletIcon };
const farmerNotifications: NavItem = {
  to: '/farmer/notifications',
  labelKey: 'nav.notifications',
  shortKey: 'nav.notifications',
  icon: BellIcon,
  badge: 'notifications'
};
const farmerProfile: NavItem = { to: '/farmer/profile', labelKey: 'nav.profile', shortKey: 'nav.profile', icon: UserIcon };
const farmerSettings: NavItem = { to: '/farmer/settings', labelKey: 'nav.settings', shortKey: 'nav.settings', icon: SettingsIcon };

const adminOverview: NavItem = { to: '/admin', labelKey: 'nav.overview', shortKey: 'nav.overview', icon: LayoutDashboardIcon, exact: true };
const adminPolicies: NavItem = { to: '/admin/policies', labelKey: 'nav.policies', shortKey: 'nav.policies', icon: FileTextIcon };
const adminFarmers: NavItem = { to: '/admin/farmers', labelKey: 'nav.farmers', shortKey: 'nav.farmers', icon: UsersIcon };
const adminAnalytics: NavItem = { to: '/admin/analytics', labelKey: 'nav.analytics', shortKey: 'nav.analytics', icon: BarChart3Icon };
const adminOracles: NavItem = { to: '/admin/oracles', labelKey: 'nav.oracles', shortKey: 'nav.oraclesShort', icon: RadioTowerIcon };
const adminBacktest: NavItem = { to: '/admin/backtest', labelKey: 'nav.backtest', shortKey: 'nav.backtest', icon: FlaskConicalIcon };
const adminDataModel: NavItem = { to: '/admin/data-model', labelKey: 'nav.dataModel', shortKey: 'nav.dataModel', icon: DatabaseIcon };
const adminNotifications: NavItem = {
  to: '/admin/notifications',
  labelKey: 'nav.notifications',
  shortKey: 'nav.notifications',
  icon: BellIcon,
  badge: 'notifications'
};
const adminProfile: NavItem = { to: '/admin/profile', labelKey: 'nav.profile', shortKey: 'nav.profile', icon: UserIcon };
const adminSettings: NavItem = { to: '/admin/settings', labelKey: 'nav.settings', shortKey: 'nav.settings', icon: SettingsIcon };

export const navSections: Record<Role, NavSection[]> = {
  farmer: [
  { titleKey: 'section.cover', items: [farmerHome, farmerPolicies, farmerBuy, farmerPayouts] },
  { titleKey: 'section.account', items: [farmerNotifications, farmerProfile, farmerSettings] }],

  admin: [
  { titleKey: 'section.operations', items: [adminOverview, adminPolicies, adminFarmers, adminAnalytics] },
  { titleKey: 'section.research', items: [adminOracles, adminBacktest, adminDataModel] },
  { titleKey: 'section.account', items: [adminNotifications, adminProfile, adminSettings] }]

};

export const mobileNav: Record<Role, NavItem[]> = {
  farmer: [farmerHome, farmerPolicies, farmerBuy, farmerPayouts, farmerProfile],
  admin: [adminOverview, adminPolicies, adminAnalytics, adminOracles, adminFarmers]
};

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.exclude?.some((p) => pathname === p)) return false;
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function currentNavItem(role: Role, pathname: string): NavItem | undefined {
  return navSections[role].flatMap((s) => s.items).find((item) => isNavActive(item, pathname));
}

export function allNavItems(role: Role): NavItem[] {
  return navSections[role].flatMap((s) => s.items);
}