import { useI18n } from '../../contexts/I18nContext';
import { passwordStrength } from '../../utils/users';

const tones = ['bg-line', 'bg-danger', 'bg-clay', 'bg-success'];

export function PasswordStrength({ password }: {password: string;}) {
  const { t } = useI18n();
  const score = passwordStrength(password);
  if (!password) return null;
  const label = score === 1 ? t('strength.weak') : score === 2 ? t('strength.fair') : t('strength.strong');
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="grid flex-1 grid-cols-3 gap-1">
        {[1, 2, 3].map((i) =>
        <span
          key={i}
          className={`h-1 rounded-full transition-colors duration-200 ease-out ${i <= score ? tones[score] : 'bg-line'}`} />

        )}
      </div>
      <span className="w-14 text-right text-xs text-muted">{label}</span>
    </div>);

}