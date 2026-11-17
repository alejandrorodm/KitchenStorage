import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  kicker?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, kicker, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {kicker && <p className="page-kicker">{kicker}</p>}
        <h1 className="page-title">{title}</h1>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
