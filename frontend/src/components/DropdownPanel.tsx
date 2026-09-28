import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface DropdownPanelProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
  label?: string;
}

export function DropdownPanel({ open, children, className = 'w-64', align = 'right', label }: DropdownPanelProps) {
  return (
    <AnimatePresence>
      {open &&
      <motion.div
        role="menu"
        aria-label={label}
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -4 }}
        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
        className={`scroll-area absolute top-full z-50 mt-2 max-h-[min(70vh,520px)] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg border border-line bg-raised shadow-pop ${
        align === 'right' ? 'right-0' : 'left-0'} ${
        className}`}>
        
          {children}
        </motion.div>
      }
    </AnimatePresence>);

}

export const menuItemClass =
'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-ink transition-colors duration-150 ease-out hover:bg-canvas focus:bg-canvas focus:outline-none';

export const iconButtonClass =
'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';