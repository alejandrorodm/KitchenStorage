import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, children }: EmptyStateProps) {
  return (
    <div className="empty">
      <Icon aria-hidden size={28} strokeWidth={1.8} />
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}
