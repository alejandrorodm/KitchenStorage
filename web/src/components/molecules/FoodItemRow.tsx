import { Minus, Plus } from 'lucide-react';
import type { FoodItem } from '../../api/types';
import { formatQuantity, LOCATION_LABEL, stepFor } from '../../shared/labels';
import { IconButton } from '../atoms/Button';
import { StatusBadge } from '../atoms/StatusBadge';

interface FoodItemRowProps {
  item: FoodItem;
  onEdit: () => void;
  onAdjust: (delta: number) => void;
  busy?: boolean;
  /** Shows where it is stored (when the list is not grouped by place). */
  showLocation?: boolean;
}

export function FoodItemRow({ item, onEdit, onAdjust, busy, showLocation = false }: FoodItemRowProps) {
  const step = stepFor(item.unit);
  return (
    <li className={`item item-${item.status}`} data-zone={item.location}>
      <button type="button" className="item-main" onClick={onEdit} aria-label={`Editar ${item.name}`}>
        <span className="item-name">{item.name}</span>
        <span className="item-meta">
          {showLocation && <span className="item-place">{LOCATION_LABEL[item.location]}</span>}
          <StatusBadge status={item.status} />
          {item.planned > 0 && (
            <span>
              {formatQuantity(item.planned, item.unit)} reservado en el menú, {formatQuantity(item.available, item.unit)} libre
            </span>
          )}
        </span>
      </button>
      <div className="stepper">
        <IconButton icon={Minus} label={`Quitar ${formatQuantity(step, item.unit)} de ${item.name}`} disabled={busy || item.quantity <= 0} onClick={() => onAdjust(-step)} />
        <span className="stepper-value">{formatQuantity(item.quantity, item.unit)}</span>
        <IconButton icon={Plus} label={`Añadir ${formatQuantity(step, item.unit)} de ${item.name}`} disabled={busy} onClick={() => onAdjust(step)} />
      </div>
    </li>
  );
}
