import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeftIcon, FileTextIcon, SearchIcon, UserIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Avatar } from "../Avatar";
import { allNavItems } from "./navigation";
import { useI18n } from "../../contexts/I18nContext";
import { usePolicies } from "../../contexts/PolicyContext";
import { getWindow } from "../../utils/oracle";
import { findUser, getFarmers } from "../../utils/users";
import { User } from "../../types/user";
interface Result {
  id: string;
  group: 'pages' | 'policies' | 'farmers';
  label: string;
  sub?: string;
  to: string;
  icon?: LucideIcon;
  avatar?: string;
}
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  user: User;
}
export function CommandPalette({
  open,
  onClose,
  user
}: CommandPaletteProps) {
  const {
    t
  } = useI18n();
  const {
    policies
  } = usePolicies();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);
  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const pages: Result[] = allNavItems(user.role).map((i) => ({
      id: i.to,
      group: 'pages' as const,
      label: t(i.labelKey),
      to: i.to,
      icon: i.icon
    })).filter((r) => !q || r.label.toLowerCase().includes(q));
    const scoped = user.role === 'admin' ? policies : policies.filter((p) => p.farmerId === user.id);
    const policyResults: Result[] = q ? scoped.filter((p) => {
      const farmer = findUser(p.farmerId)?.name.toLowerCase() ?? '';
      return `#${p.id} ${p.id} ${p.lga} ${p.crop} ${farmer}`.toLowerCase().includes(q);
    }).slice(0, 6).map((p) => ({
      id: `p-${p.id}`,
      group: 'policies' as const,
      label: `#${p.id} · ${p.lga} ${p.crop}`,
      sub: `${getWindow(p.windowId).label}${user.role === 'admin' ? ` · ${findUser(p.farmerId)?.name ?? ''}` : ''}`,
      to: `/${user.role}/policies/${p.id}`,
      icon: FileTextIcon
    })) : [];
    const farmerResults: Result[] = q && user.role === 'admin' ? getFarmers().filter((f) => `${f.name} ${f.lga ?? ''} ${f.email}`.toLowerCase().includes(q)).slice(0, 5).map((f) => ({
      id: `f-${f.id}`,
      group: 'farmers' as const,
      label: f.name,
      sub: `${f.lga ?? '—'} · ${f.email}`,
      to: `/admin/farmers?q=${encodeURIComponent(f.name)}`,
      avatar: f.name
    })) : [];
    return [...pages, ...policyResults, ...farmerResults];
  }, [query, policies, user, t]);
  useEffect(() => setActive(0), [query]);
  function go(r: Result | undefined) {
    if (!r) return;
    onClose();
    navigate(r.to);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  }
  const groups: Result['group'][] = ['pages', 'policies', 'farmers'];
  return <Modal open={open} onClose={onClose} size="lg" hideClose bodyClassName="p-0" placement="top">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <SearchIcon className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        <input data-autofocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} placeholder={t('search.placeholder')} aria-label={t('nav.search')} className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none" />
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted sm:block">Esc</kbd>
        <button type="button" onClick={onClose} className="text-sm font-medium text-accent sm:hidden">
          {t('common.cancel')}
        </button>
      </div>
      <div className="scroll-area max-h-[min(60vh,440px)] overflow-y-auto p-2" role="listbox">
        {results.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted">{t('search.empty', {
          q: query
        })}</p>}
        {groups.map((g) => {
        const items = results.filter((r) => r.group === g);
        if (items.length === 0) return null;
        return <div key={g} className="py-1">
              <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted">{t(`search.${g}`)}</p>
              {items.map((r) => {
            const index = results.indexOf(r);
            const selected = index === active;
            const Icon = r.icon ?? UserIcon;
            return <button key={r.id} type="button" role="option" aria-selected={selected} onMouseEnter={() => setActive(index)} onClick={() => go(r)} className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors duration-100 ease-out ${selected ? 'bg-accent-soft' : ''}`}>
                    {r.avatar ? <Avatar name={r.avatar} /> : <span className="flex h-8 w-8 items-center justify-center rounded-md bg-canvas text-muted">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>}
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-medium ${selected ? 'text-accent-strong' : ''}`}>{r.label}</span>
                      {r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}
                    </span>
                    {selected && <CornerDownLeftIcon className="h-4 w-4 text-muted" aria-hidden />}
                  </button>;
          })}
            </div>;
      })}
      </div>
    </Modal>;
}