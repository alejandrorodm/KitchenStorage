import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { LOCATIONS, UNITS, type FoodItem, type FoodItemInput, type Location } from '../../api/types';
import { LOCATION_ICON } from '../../shared/icons';
import { LOCATION_LABEL, UNIT_LABEL } from '../../shared/labels';
import { Button } from '../atoms/Button';
import { Field, NumberInput, TextInput } from '../atoms/Field';
import { Segmented } from '../atoms/Segmented';

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
        <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} autoFocus={!item} placeholder="p. ej. Leche, Pechuga de pollo, Arroz" />
      </Field>
      <div className="field">
        <span className="field-label">Dónde lo guardas</span>
        <Segmented label="Dónde lo guardas" value={form.location} options={LOCATIONS} labels={LOCATION_LABEL} icons={LOCATION_ICON} zoned onChange={(v) => set('location', v)} />
      </div>
      <div className="form-row">
        <Field label="Cantidad">
          <NumberInput value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />
        </Field>
        <div className="field">
          <span className="field-label">Unidad</span>
          <Segmented label="Unidad" value={form.unit} options={UNITS} labels={UNIT_LABEL} onChange={(v) => set('unit', v)} />
        </div>
      </div>
      <Field label="Avisarme cuando queden" hint="Al llegar a esta cantidad se marca como «se está acabando» y se añade a la compra.">
        <NumberInput value={form.lowThreshold} onChange={(e) => set('lowThreshold', e.target.value)} required />
      </Field>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        {onDelete && (
          <Button variant="danger" icon={Trash2} onClick={onDelete} disabled={busy} className="push-left">
            Eliminar
          </Button>
        )}
        <Button variant="primary" type="submit" disabled={busy}>
          {item ? 'Guardar cambios' : 'Añadir alimento'}
        </Button>
      </div>
    </form>
  );
}
