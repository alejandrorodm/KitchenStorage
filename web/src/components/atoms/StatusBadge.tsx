import type { StockStatus } from '../../api/types';
import { STATUS_LABEL } from '../../shared/labels';

export function StatusBadge({ status }: { status: StockStatus }) {
  if (status === 'ok') return null;
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>;
}
