import { Link } from 'react-router-dom';
import { CloudRainIcon } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';

interface BrandProps {
  to: string;
  inverted?: boolean;
  compact?: boolean;
}

export function Brand({ to, inverted, compact }: BrandProps) {
  const { t } = useI18n();
  return (
    <Link
      to={to}
      className="flex min-w-0 items-center gap-2.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
        inverted ? 'bg-white text-accent' : 'bg-accent text-white'}`
        }>
        
        <CloudRainIcon className="h-4 w-4" aria-hidden />
      </span>
      <span className={`min-w-0 flex-col leading-tight ${compact ? 'hidden sm:flex' : 'flex'}`}>
        <span className={`truncate text-[15px] font-semibold ${inverted ? 'text-white' : 'text-ink'}`}>{t('brand.name')}</span>
        {!compact &&
        <span className={`truncate text-xs ${inverted ? 'text-white/70' : 'text-muted'}`}>{t('brand.tagline')}</span>
        }
      </span>
    </Link>);

}