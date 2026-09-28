const base =
'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';

export const btnPrimary = `${base} h-10 bg-accent px-4 font-semibold text-white hover:bg-accent-hover`;
export const btnSecondary = `${base} h-10 border border-line bg-surface px-4 text-ink hover:border-muted`;
export const btnGhost = `${base} h-9 px-3 text-muted hover:bg-canvas hover:text-ink`;
export const btnDanger = `${base} h-10 bg-danger px-4 font-semibold text-white hover:opacity-90`;
export const btnSmall = `${base} h-8 border border-line bg-surface px-3 text-xs text-ink hover:border-muted`;