import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  hideClose?: boolean;
  bodyClassName?: string;
  labelledBy?: string;
  /** 'sheet' slides up from the bottom on phones; 'center' stays a centred dialog on every screen. */
  placement?: 'sheet' | 'center' | 'top';
}

const sizes = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-3xl' };
const ease = [0.23, 1, 0.32, 1] as const;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
  hideClose,
  bodyClassName = 'px-4 py-4 sm:px-6 sm:py-5',
  placement = 'sheet'
}: ModalProps) {
  const isWide = useMediaQuery('(min-width: 640px)');
  const isDesktop = isWide || placement !== 'sheet';
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`modal-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add('scroll-locked');
    const t = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current;
      target?.focus();
    }, 40);
    return () => {
      window.clearTimeout(t);
      document.body.classList.remove('scroll-locked');
      previous?.focus?.();
    };
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const hidden = isDesktop ? { opacity: 0, scale: 0.96, y: 8 } : { opacity: 1, y: '100%' };
  const shown = isDesktop ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 };

  return createPortal(
    <AnimatePresence>
      {open &&
      <div
        className={`fixed inset-0 z-[80] flex justify-center ${
        placement === 'top' ?
        'items-start px-3 pt-[8vh] sm:p-6 sm:pt-[12vh]' :
        placement === 'center' ?
        'items-center p-3 sm:p-6' :
        'items-end sm:items-center sm:p-6'}`
        }
        onKeyDown={onKeyDown}>
        
          <motion.div
          className="absolute inset-0"
          style={{ background: 'var(--backdrop)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease }}
          onClick={onClose}
          aria-hidden />
        
          <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          initial={hidden}
          animate={shown}
          exit={hidden}
          transition={{ duration: 0.24, ease }}
          className={`relative flex w-full flex-col overflow-hidden border border-line bg-raised shadow-pop focus:outline-none sm:rounded-xl ${sizes[size]} ${
          placement === 'sheet' ? 'max-h-[92dvh] rounded-t-2xl' : 'max-h-[84dvh] rounded-xl'}`
          }>
          
            {placement === 'sheet' && <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" aria-hidden />}
            {(title || !hideClose) &&
          <div className="flex shrink-0 items-start gap-3 px-4 pb-1 pt-3.5 sm:px-6 sm:pt-5">
                {icon && <div className="shrink-0">{icon}</div>}
                <div className="min-w-0 flex-1">
                  {title &&
              <h2 id={titleId} className="text-base font-semibold leading-snug sm:text-lg">
                      {title}
                    </h2>
              }
                  {description && <div className="mt-1 text-sm leading-relaxed text-muted">{description}</div>}
                </div>
                {!hideClose &&
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              
                    <XIcon className="h-4 w-4" aria-hidden />
                  </button>
            }
              </div>
          }
            <div className={`scroll-area min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
            {footer &&
          <div className="grid shrink-0 grid-flow-col auto-cols-fr gap-2 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end sm:px-6">
                {footer}
              </div>
          }
          </motion.div>
        </div>
      }
    </AnimatePresence>,
    document.body
  );
}