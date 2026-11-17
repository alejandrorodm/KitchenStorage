import { LOCATIONS, UNITS, type ReceiptLine } from '../../api/types';
import { LOCATION_LABEL, UNIT_LABEL } from '../../shared/labels';
import { Button } from '../atoms/Button';
import { NumberInput, Select, TextInput } from '../atoms/Field';

interface ReceiptReviewProps {
  lines: ReceiptLine[];
  busy?: boolean;
  error?: string;
  onChange: (lines: ReceiptLine[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReceiptReview({ lines, busy, error, onChange, onConfirm, onCancel }: ReceiptReviewProps) {
  const update = (index: number, patch: Partial<ReceiptLine>) => onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const valid = lines.length > 0 && lines.every((l) => l.name.trim() && l.quantity > 0);

  return (
    <div className="form">
      <p className="muted">Revisa lo que se ha leído antes de añadirlo. Los productos con el mismo nombre, lugar y unidad se suman a los que ya tienes.</p>
      <ul className="receipt-lines">
        {lines.map((line, index) => (
          <li key={index} className="receipt-line">
            <TextInput value={line.name} onChange={(e) => update(index, { name: e.target.value })} aria-label="Nombre" />
            <NumberInput className="input qty" value={line.quantity} onChange={(e) => update(index, { quantity: Number(e.target.value) })} aria-label="Cantidad" />
            <Select value={line.unit} options={UNITS} labels={UNIT_LABEL} onChange={(unit) => update(index, { unit })} aria-label="Unidad" />
            <Select value={line.location} options={LOCATIONS} labels={LOCATION_LABEL} onChange={(location) => update(index, { location })} aria-label="Dónde" />
            <button type="button" className="icon-btn" onClick={() => onChange(lines.filter((_, i) => i !== index))} aria-label={`Quitar ${line.name}`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      {lines.length === 0 && <p className="muted">No queda ningún producto.</p>}
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={busy || !valid}>
          Añadir {lines.length} al inventario
        </Button>
      </div>
    </div>
  );
}
