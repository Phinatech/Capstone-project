import { BanknoteIcon, BellIcon, FileTextIcon, RadioTowerIcon, ScaleIcon } from 'lucide-react';
import type { NotificationKind } from '../../types/notification';

const map: Record<NotificationKind, {icon: typeof BellIcon;tone: string;}> = {
  payout: { icon: BanknoteIcon, tone: 'bg-clay-soft text-clay' },
  evaluation: { icon: ScaleIcon, tone: 'bg-accent-soft text-accent-strong' },
  policy: { icon: FileTextIcon, tone: 'bg-canvas text-muted' },
  oracle: { icon: RadioTowerIcon, tone: 'bg-accent-soft text-accent-strong' },
  system: { icon: BellIcon, tone: 'bg-canvas text-muted' }
};

export function NotificationIcon({ kind }: {kind: NotificationKind;}) {
  const { icon: Icon, tone } = map[kind];
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>);

}