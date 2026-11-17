import { Plus, X } from 'lucide-react';
import { LOCATIONS, UNITS, type ReceiptLine } from '../../api/types';
import { countOf, LOCATION_LABEL, UNIT_LABEL } from '../../shared/labels';
import { Button, IconButton } from '../atoms/Button';
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
      <p className="lead">Comprueba lo que se ha leído. Si ya tienes un producto con el mismo nombre, lugar y unidad, se suma a lo que hay.</p>
      <ul className="receipt-lines">
        {lines.map((line, index) => (
          <li key={index} className="receipt-line" data-zone={line.location}>
            <TextInput className="receipt-name" value={line.name} onChange={(e) => update(index, { name: e.target.value })} aria-label={`Nombre del producto ${index + 1}`} />
            <NumberInput className="receipt-qty" value={line.quantity} onChange={(e) => update(index, { quantity: Number(e.target.value) })} aria-label={`Cantidad de ${line.name}`} />
            <Select value={line.unit} options={UNITS} labels={UNIT_LABEL} onChange={(unit) => update(index, { unit })} aria-label={`Unidad de ${line.name}`} />
            <Select value={line.location} options={LOCATIONS} labels={LOCATION_LABEL} onChange={(location) => update(index, { location })} aria-label={`Dónde guardar ${line.name}`} />
            <IconButton icon={X} label={`Quitar ${line.name}`} onClick={() => onChange(lines.filter((_, i) => i !== index))} />
          </li>
        ))}
      </ul>
      {lines.length === 0 && <p className="muted">No queda ningún producto. Vuelve a intentarlo con otra foto.</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions sticky-actions">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Descartar
        </Button>
        <Button variant="primary" icon={Plus} onClick={onConfirm} disabled={busy || !valid}>
          Añadir {countOf(lines.length, 'producto', 'productos')}
        </Button>
      </div>
    </div>
  );
}
