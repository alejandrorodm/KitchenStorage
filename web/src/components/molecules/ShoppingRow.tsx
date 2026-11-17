import { Check, Trash2 } from 'lucide-react';
import type { ShoppingEntry } from '../../api/types';
import { formatQuantity } from '../../shared/labels';
import { IconButton } from '../atoms/Button';
import { StatusBadge } from '../atoms/StatusBadge';

interface ShoppingRowProps {
  entry: ShoppingEntry;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
}

export function ShoppingRow({ entry, onToggle, onDelete }: ShoppingRowProps) {
  return (
    <li className={`buy ${entry.checked ? 'buy-checked' : ''}`}>
      <label className="buy-main">
        <input type="checkbox" className="sr-only" checked={entry.checked} onChange={(e) => onToggle(e.target.checked)} />
        <span className="checkbox" aria-hidden>
          <Check size={16} strokeWidth={3} />
        </span>
        <span className="buy-text">
          <span className="buy-name">{entry.name}</span>
          <span className="buy-meta">
            {entry.quantity !== null && <span>{formatQuantity(entry.quantity, entry.unit)}</span>}
            {entry.source === 'auto' && entry.status && <StatusBadge status={entry.status} />}
            {entry.source === 'auto' && !entry.status && <span>Añadido automáticamente</span>}
          </span>
        </span>
      </label>
      <IconButton icon={Trash2} label={`Eliminar ${entry.name} de la lista`} onClick={onDelete} />
    </li>
  );
}
