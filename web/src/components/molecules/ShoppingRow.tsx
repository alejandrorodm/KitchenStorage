import type { ShoppingEntry } from '../../api/types';
import { formatQuantity } from '../../shared/labels';
import { StatusBadge } from '../atoms/StatusBadge';

interface ShoppingRowProps {
  entry: ShoppingEntry;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
}

export function ShoppingRow({ entry, onToggle, onDelete }: ShoppingRowProps) {
  return (
    <li className={`row ${entry.checked ? 'row-checked' : ''}`}>
      <label className="row-main row-check">
        <input type="checkbox" checked={entry.checked} onChange={(e) => onToggle(e.target.checked)} />
        <span className="row-title">{entry.name}</span>
        <span className="row-meta">
          {entry.quantity !== null && formatQuantity(entry.quantity, entry.unit)}
          {entry.source === 'auto' && <span className="tag">automático</span>}
        </span>
        {entry.status && <StatusBadge status={entry.status} />}
      </label>
      <button type="button" className="icon-btn" onClick={onDelete} aria-label={`Eliminar ${entry.name}`}>
        🗑
      </button>
    </li>
  );
}
