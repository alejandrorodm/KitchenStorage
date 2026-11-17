import type { FoodItem } from '../../api/types';
import { formatQuantity } from '../../shared/labels';
import { StatusBadge } from '../atoms/StatusBadge';

interface FoodItemRowProps {
  item: FoodItem;
  onEdit: () => void;
  onAdjust: (delta: number) => void;
  busy?: boolean;
}

export function FoodItemRow({ item, onEdit, onAdjust, busy }: FoodItemRowProps) {
  const step = item.unit === 'g' || item.unit === 'ml' ? 100 : item.unit === 'unit' ? 1 : 0.5;
  return (
    <li className={`row row-${item.status}`}>
      <button type="button" className="row-main" onClick={onEdit}>
        <span className="row-title">{item.name}</span>
        <span className="row-meta">
          {formatQuantity(item.quantity, item.unit)}
          {item.planned > 0 && <> · {formatQuantity(item.planned, item.unit)} planned · {formatQuantity(item.available, item.unit)} free</>}
        </span>
        <StatusBadge status={item.status} />
      </button>
      <div className="stepper">
        <button type="button" className="icon-btn" disabled={busy || item.quantity <= 0} onClick={() => onAdjust(-step)} aria-label={`Remove ${step} ${item.name}`}>
          −
        </button>
        <button type="button" className="icon-btn" disabled={busy} onClick={() => onAdjust(step)} aria-label={`Add ${step} ${item.name}`}>
          +
        </button>
      </div>
    </li>
  );
}
