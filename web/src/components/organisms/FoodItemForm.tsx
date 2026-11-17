import { useState, type FormEvent } from 'react';
import { LOCATIONS, UNITS, type FoodItem, type FoodItemInput, type Location } from '../../api/types';
import { LOCATION_LABEL, UNIT_LABEL } from '../../shared/labels';
import { Button } from '../atoms/Button';
import { Field, NumberInput, Select, TextInput } from '../atoms/Field';

interface FoodItemFormProps {
  item?: FoodItem;
  defaultLocation: Location;
  error?: string;
  busy?: boolean;
  onSubmit: (input: FoodItemInput) => void;
  onDelete?: () => void;
}

export function FoodItemForm({ item, defaultLocation, error, busy, onSubmit, onDelete }: FoodItemFormProps) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    location: item?.location ?? defaultLocation,
    quantity: String(item?.quantity ?? 1),
    unit: item?.unit ?? 'unit',
    lowThreshold: String(item?.lowThreshold ?? 1),
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      name: form.name,
      location: form.location,
      quantity: Number(form.quantity),
      unit: form.unit,
      lowThreshold: Number(form.lowThreshold),
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Nombre">
        <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} autoFocus />
      </Field>
      <Field label="Dónde">
        <Select value={form.location} options={LOCATIONS} labels={LOCATION_LABEL} onChange={(v) => set('location', v)} />
      </Field>
      <div className="form-row">
        <Field label="Cantidad">
          <NumberInput value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />
        </Field>
        <Field label="Unidad">
          <Select value={form.unit} options={UNITS} labels={UNIT_LABEL} onChange={(v) => set('unit', v)} />
        </Field>
      </div>
      <Field label="Avisarme cuando quede esto o menos">
        <NumberInput value={form.lowThreshold} onChange={(e) => set('lowThreshold', e.target.value)} required />
      </Field>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        {onDelete && (
          <Button variant="danger" onClick={onDelete} disabled={busy}>
            Eliminar
          </Button>
        )}
        <Button variant="primary" type="submit" disabled={busy}>
          {item ? 'Guardar' : 'Añadir'}
        </Button>
      </div>
    </form>
  );
}
