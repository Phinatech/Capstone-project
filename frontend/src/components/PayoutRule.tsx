import { InfoIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFx } from '../contexts/FxContext';
import { useI18n } from '../contexts/I18nContext';
import { formatNgn } from '../utils/currency';
import { formatEth } from '../utils/format';

/**
 * The payout rule in plain words, with this policy's own numbers.
 *
 * In acceptance testing every participant marked the payout tasks as done, yet
 * none could say when the cover pays, and the defence panel pointed out that a
 * rule people cannot explain undermines a "trusted and fair" payout. So the
 * rule is spelt out wherever cover is bought or looked at: what has to happen
 * for it to pay, that nobody has to claim, what happens otherwise, and the
 * basis risk the buyer carries because rainfall is measured at one point.
 */
export function PayoutRule({
  thresholdMm,
  payoutEth,
  windowCovers
}: {thresholdMm: number | null;payoutEth: number;windowCovers: string | undefined;}) {
  const { t } = useI18n();
  const { ethToNgn } = useFx();
  const { user } = useAuth();
  if (thresholdMm === null) return null;
  const payout = payoutEth > 0 ? `${formatEth(payoutEth)} (≈ ${formatNgn(ethToNgn(payoutEth))})` : t('payoutRule.thePayout');
  const window = windowCovers ?? t('payoutRule.theWindow');
  return (
    <section aria-label={t('payoutRule.title')} className="mt-4 rounded-md border border-line bg-accent-soft px-4 py-3 text-sm leading-relaxed">
      <p className="flex items-center gap-2 font-semibold text-accent-strong">
        <InfoIcon className="h-4 w-4 shrink-0" aria-hidden />
        {t('payoutRule.title')}
      </p>
      <p className="mt-1.5 text-ink">{t('payoutRule.pays', { payout, window, mm: thresholdMm })}</p>
      <p className="mt-1 text-ink">{t('payoutRule.auto')}</p>
      <p className="mt-1 text-ink">{t('payoutRule.otherwise', { mm: thresholdMm })}</p>
      {user?.role === 'agent' && <p className="mt-1 text-ink">{t('payoutRule.agent')}</p>}
      <p className="mt-1 text-muted">{t('payoutRule.basis')}</p>
    </section>);

}
