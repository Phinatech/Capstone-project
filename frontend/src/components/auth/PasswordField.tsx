import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { TextField } from './TextField';
import { useI18n } from '../../contexts/I18nContext';

interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  hint?: string;
}

export function PasswordField(props: PasswordFieldProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        className="flex h-8 w-8 items-center justify-center rounded text-muted transition-colors duration-150 ease-out hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        
          {visible ? <EyeOffIcon className="h-4 w-4" aria-hidden /> : <EyeIcon className="h-4 w-4" aria-hidden />}
        </button>
      } />);


}