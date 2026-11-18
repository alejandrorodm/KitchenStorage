import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { LOCATIONS, UNITS, type FoodItem, type FoodItemInput, type Location } from '../../api/types';
import { LOCATION_ICON } from '../../shared/icons';
import { alertLabel, LOCATION_LABEL, UNIT_LABEL } from '../../shared/labels';
import { Button } from '../atoms/Button';
import { Field, NumberInput, TextInput } from '../atoms/Field';
import { Segmented } from '../atoms/Segmented';

const ALERT_MODES = ['household', 'own'] as const;
type AlertMode = (typeof ALERT_MODES)[number];
const ALERT_MODE_LABEL: Record<AlertMode, string> = { household: 'Como la casa', own: 'Personalizado' };

interface FoodItemFormProps {
  item?: FoodItem;
  /** The household's alert threshold, used while the item has no value of its own. */
  householdThreshold: number;
  defaultLocation: Location;
  error?: string;
  busy?: boolean;
  onSubmit: (input: FoodItemInput) => void;
  onDelete?: () => void;
}

export function FoodItemForm({ item, householdThreshold, defaultLocation, error, busy, onSubmit, onDelete }: FoodItemFormProps) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    location: item?.location ?? defaultLocation,
    quantity: String(item?.quantity ?? 1),
    unit: item?.unit ?? 'unit',
    alertMode: (item?.lowThreshold == null ? 'household' : 'own') as AlertMode,
    lowThreshold: String(item?.lowThreshold ?? householdThreshold),
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      name: form.name,
      location: form.location,
      quantity: Number(form.quantity),
      unit: form.unit,
      lowThreshold: form.alertMode === 'household' ? null : Number(form.lowThreshold),
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
      <div className="field">
        <span className="field-label">Avisarme</span>
        <Segmented label="Avisarme" value={form.alertMode} options={ALERT_MODES} labels={ALERT_MODE_LABEL} onChange={(v) => set('alertMode', v)} />
        {form.alertMode === 'household' && (
          <span className="field-hint">Se avisa {alertLabel(householdThreshold, form.unit)}, como el resto de tu casa. Lo cambias en Mi casa.</span>
        )}
      </div>
      {form.alertMode === 'own' && (
        <Field label="Avisarme cuando queden" hint="Al llegar a esta cantidad se marca como «se está acabando» y se añade a la compra. 0 = al acabarse.">
          <NumberInput value={form.lowThreshold} onChange={(e) => set('lowThreshold', e.target.value)} required />
        </Field>
      )}
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
