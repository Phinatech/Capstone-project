import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellIcon, FlaskConicalIcon, RadioTowerIcon, ScaleIcon, ShieldCheckIcon, WalletIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { btnGhost, btnPrimary, btnSecondary } from '../ui/buttons';
import { onboardingSteps } from '../../data/onboarding';
import type { OnboardingStep } from '../../data/onboarding';
import { useI18n } from '../../contexts/I18nContext';
import type { User } from '../../types/user';

const icons: Record<OnboardingStep['icon'], typeof BellIcon> = {
  shield: ShieldCheckIcon,
  radio: RadioTowerIcon,
  wallet: WalletIcon,
  scale: ScaleIcon,
  flask: FlaskConicalIcon,
  bell: BellIcon
};

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  user: User;
}

export function WelcomeModal({ open, onClose, user }: WelcomeModalProps) {
  const { t } = useI18n();
  const steps = onboardingSteps[user.role];
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const step = steps[index];
  const Icon = icons[step.icon];
  const last = index === steps.length - 1;

  const go = (next: number) => {
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      hideClose
      bodyClassName="px-6 pb-2 pt-4 sm:px-8"
      footer={
      <>
          {index === 0 ?
        <button type="button" onClick={onClose} className={`${btnGhost} sm:mr-auto`}>
              {t('common.skip')}
            </button> :

        <button type="button" onClick={() => go(index - 1)} className={`${btnSecondary} sm:mr-auto`}>
              {t('common.back')}
            </button>
        }
          <button type="button" data-autofocus onClick={() => last ? onClose() : go(index + 1)} className={btnPrimary}>
            {last ? t('common.done') : t('common.continue')}
          </button>
        </>
      }>
      
      <p className="text-center text-xs font-medium text-muted">
        {t('greeting.hello')}, {user.name.split(' ')[0]}
      </p>
      <div className="relative mt-4 min-h-[220px] overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={index}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col items-center text-center">
            
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
              <Icon className="h-7 w-7" aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">{step.title}</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{step.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex justify-center gap-1.5 pb-2" aria-hidden>
        {steps.map((_step, i) =>
        <span
          key={i}
          className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out ${i === index ? 'w-6 bg-accent' : 'w-1.5 bg-line'}`} />

        )}
      </div>
    </Modal>);

}