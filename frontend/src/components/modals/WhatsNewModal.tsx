import { motion } from 'framer-motion';
import { CheckIcon, SparklesIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { btnPrimary } from '../ui/buttons';
import { RELEASE_VERSION, releaseNotes } from '../../data/onboarding';
import { useI18n } from '../../contexts/I18nContext';

export function WhatsNewModal({ open, onClose }: {open: boolean;onClose: () => void;}) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      icon={
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
          <SparklesIcon className="h-5 w-5" aria-hidden />
        </span>
      }
      title={t('menu.whatsNew')}
      description={`Version ${RELEASE_VERSION}`}
      footer={
      <button type="button" data-autofocus onClick={onClose} className={btnPrimary}>
          {t('common.done')}
        </button>
      }>
      
      <ul className="space-y-4">
        {releaseNotes.map((n, i) =>
        <motion.li
          key={n.title}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 + i * 0.04, ease: [0.23, 1, 0.32, 1] }}
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckIcon className="h-3 w-3" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">{n.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{n.body}</p>
            </div>
          </motion.li>
        )}
      </ul>
    </Modal>);

}