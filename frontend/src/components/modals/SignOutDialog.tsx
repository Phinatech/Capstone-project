import { useNavigate } from 'react-router-dom';
import { LogOutIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { btnDanger, btnSecondary } from '../ui/buttons';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';

export function SignOutDialog({ open, onClose }: {open: boolean;onClose: () => void;}) {
  const { signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-soft text-danger">
          <LogOutIcon className="h-5 w-5" aria-hidden />
        </span>
      }
      title={t('signout.title')}
      description={t('signout.body')}
      bodyClassName="p-0"
      footer={
      <>
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.cancel')}
          </button>
          <button
          type="button"
          data-autofocus
          onClick={() => {
            onClose();
            signOut();
            navigate('/sign-in', { replace: true });
          }}
          className={btnDanger}>
          
            {t('menu.signOut')}
          </button>
        </>
      } />);


}