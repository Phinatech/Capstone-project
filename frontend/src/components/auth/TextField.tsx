import React from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  trailing?: React.ReactNode;
}

export const fieldInputClass =
'w-full rounded-md border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted transition-colors duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-accent-soft';

export function TextField({ label, error, hint, trailing, id, className, ...props }: TextFieldProps) {
  const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${fieldInputClass} ${trailing ? 'pr-11' : ''} ${
          error ? 'border-danger focus:border-danger' : 'border-line focus:border-accent'}`
          }
          {...props} />
        
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {error ?
      <p id={`${inputId}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p> :
      hint ?
      <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p> :
      null}
    </div>);

}