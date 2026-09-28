import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: {to: string;label: string;};
}

export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  return (
    <div className="mb-4 md:mb-8">
      {back &&
      <Link to={back.to} className="mb-2 inline-flex max-w-full items-center gap-1.5 truncate text-xs text-muted hover:text-ink sm:mb-3 sm:text-sm">
          <ArrowLeftIcon className="h-4 w-4" aria-hidden />
          {back.label}
        </Link>
      }
      <div className="flex flex-row flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-60">
          <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl md:text-[28px]">{title}</h1>
          {description && <div className="mt-1 line-clamp-2 max-w-2xl text-[13px] leading-relaxed text-muted sm:line-clamp-none sm:text-sm">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>);

}

export const primaryButtonClass =
'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.98]';

export const secondaryButtonClass =
'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors duration-150 ease-out hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';