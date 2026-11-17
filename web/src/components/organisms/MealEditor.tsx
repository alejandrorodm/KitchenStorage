import { Check, Plus, Trash2, Undo2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { LOCATIONS, type FoodItem, type Meal, type MealInput } from '../../api/types';
import { formatQuantity, LOCATION_LABEL, UNIT_LABEL } from '../../shared/labels';
import { Button, IconButton } from '../atoms/Button';
import { Field, NumberInput, TextInput } from '../atoms/Field';

interface Row {
  foodItemId: string;
  quantity: string;
}

interface MealEditorProps {
  meal: Meal | undefined;
  items: FoodItem[];
  error?: string;
  busy?: boolean;
  onSave: (input: MealInput) => void;
  onConsume: () => void;
  onUnconsume: () => void;
  onDelete: () => void;
}

export function MealEditor({ meal, items, error, busy, onSave, onConsume, onUnconsume, onDelete }: MealEditorProps) {
  const [title, setTitle] = useState(meal?.title ?? '');
  const [rows, setRows] = useState<Row[]>(
    meal?.allocations.map((a) => ({ foodItemId: a.foodItemId, quantity: String(a.quantity) })) ?? [],
  );
  const itemById = new Map(items.map((item) => [item.id, item]));

  const update = (index: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      title,
      allocations: rows
        .filter((r) => r.foodItemId && Number(r.quantity) > 0)
        .map((r) => ({ foodItemId: r.foodItemId, quantity: Number(r.quantity) })),
    });
  };

  if (meal?.consumed) {
    return (
      <div className="form">
        <div className="notice notice-ok">
          <Check aria-hidden size={18} />
          <span>Consumida. Estas cantidades ya se han descontado de tus alimentos.</span>
        </div>
        {meal.title && <p className="meal-done-title">{meal.title}</p>}
        <ul className="plain-list">
          {meal.allocations.map((a) => (
            <li key={a.id}>
              <span>{a.foodName}</span>
              <strong>{formatQuantity(a.consumedQuantity, a.unit)}</strong>
            </li>
          ))}
        </ul>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button icon={Undo2} onClick={onUnconsume} disabled={busy}>
            Deshacer y devolver al stock
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Plato" hint="Opcional. Puedes planificar solo con ingredientes.">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="p. ej. Tortilla de patatas" />
      </Field>

      <fieldset className="allocations">
        <legend className="field-label">Ingredientes</legend>
        <p className="field-hint">Se reservan de tus alimentos y se descuentan al marcar la comida como consumida.</p>
        {rows.map((row, index) => {
          const item = itemById.get(row.foodItemId);
          return (
            <div className="allocation" key={index}>
              <select className="input" value={row.foodItemId} onChange={(e) => update(index, { foodItemId: e.target.value })} required aria-label={`Ingrediente ${index + 1}`}>
                <option value="">Elige un alimento</option>
                {LOCATIONS.map((location) => {
                  const group = items.filter((i) => i.location === location);
                  if (!group.length) return null;
                  return (
                    <optgroup key={location} label={LOCATION_LABEL[location]}>
                      {group.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({formatQuantity(i.available, i.unit)} libre)
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <div className="allocation-qty">
                <NumberInput value={row.quantity} onChange={(e) => update(index, { quantity: e.target.value })} aria-label={`Cantidad del ingrediente ${index + 1}`} required />
                <span className="unit">{item ? UNIT_LABEL[item.unit] : ''}</span>
                <IconButton icon={X} label="Quitar ingrediente" onClick={() => setRows((rs) => rs.filter((_, i) => i !== index))} />
              </div>
            </div>
          );
        })}
        {items.length === 0 ? (
          <p className="muted">Todavía no tienes alimentos. Añádelos primero en la sección Alimentos.</p>
        ) : (
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setRows((rs) => [...rs, { foodItemId: '', quantity: '1' }])}>
            Añadir ingrediente
          </Button>
        )}
      </fieldset>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        {meal && (
          <>
            <Button variant="danger" icon={Trash2} onClick={onDelete} disabled={busy} className="push-left">
              Eliminar
            </Button>
            <Button icon={Check} onClick={onConsume} disabled={busy || meal.allocations.length === 0} title="Descuenta los ingredientes guardados de tus alimentos">
              Marcar como consumida
            </Button>
          </>
        )}
        <Button variant="primary" type="submit" disabled={busy}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
