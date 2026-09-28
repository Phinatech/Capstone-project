
export function AuthDivider({ label }: {label: string;}) {
  return (
    <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs text-muted">
      <span className="h-px bg-line" />
      <span>{label}</span>
      <span className="h-px bg-line" />
    </div>);

}

export const submitButtonClass =
'flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70';