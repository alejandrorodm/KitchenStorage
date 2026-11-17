import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: LucideIcon;
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, className = '', type = 'button', children, ...props }: ButtonProps) {
  return (
    <button type={type} className={`btn btn-${variant} btn-${size} ${className}`} {...props}>
      {Icon && <Icon aria-hidden size={size === 'sm' ? 16 : 18} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  tone?: 'plain' | 'danger';
}

/** Square button with only an icon; `label` is announced to screen readers and shown as a tooltip. */
export function IconButton({ icon: Icon, label, tone = 'plain', className = '', type = 'button', ...props }: IconButtonProps) {
  return (
    <button type={type} className={`icon-btn icon-btn-${tone} ${className}`} aria-label={label} title={label} {...props}>
      <Icon aria-hidden size={20} strokeWidth={2.2} />
    </button>
  );
}
