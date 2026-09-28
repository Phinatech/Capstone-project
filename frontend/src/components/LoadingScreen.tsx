import { motion } from 'framer-motion';
import { CloudRainIcon } from 'lucide-react';

interface LoadingScreenProps {
  label: string;
  sublabel?: string;
}

const drops = [0, 1, 2, 3, 4];

export function LoadingScreen({ label, sublabel }: LoadingScreenProps) {
  return (
    <motion.div
      key="loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-canvas px-6 text-center">
      
      <motion.span
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-white">
        
        <CloudRainIcon className="h-7 w-7" aria-hidden />
      </motion.span>

      <div className="mt-5 flex h-8 items-start gap-1.5" aria-hidden>
        {drops.map((i) =>
        <motion.span
          key={i}
          className="block w-1 rounded-full bg-accent"
          initial={{ height: 6, opacity: 0.3 }}
          animate={{ height: [6, 22, 6], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }} />

        )}
      </div>

      <p className="mt-3 text-sm font-medium text-ink">{label}</p>
      {sublabel && <p className="mt-1 max-w-xs truncate text-xs text-muted">{sublabel}</p>}
    </motion.div>);

}