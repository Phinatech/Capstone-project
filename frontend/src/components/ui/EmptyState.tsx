import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}
export function EmptyState({
  icon: Icon,
  title,
  body,
  action
}: EmptyStateProps) {
  return <motion.div initial={{
    opacity: 0,
    y: 4
  }} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    duration: 0.2,
    ease: [0.23, 1, 0.32, 1]
  }} className="flex flex-col items-center rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-muted">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>;
}