import { useState, type FormEvent } from 'react';
import type { FoodItem, Meal, MealInput } from '../../api/types';
import { formatQuantity, LOCATION_ICON, UNIT_LABEL } from '../../shared/labels';
import { Button } from '../atoms/Button';
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
  const locked = meal?.consumed ?? false;

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

  if (locked && meal) {
    return (
      <div className="form">
        <p className="muted">Eaten. These quantities were taken from stock:</p>
        <ul className="plain-list">
          {meal.allocations.map((a) => (
            <li key={a.id}>
              {a.foodName}: {formatQuantity(a.consumedQuantity, a.unit)}
            </li>
          ))}
        </ul>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <Button onClick={onUnconsume} disabled={busy}>
            Undo (return to stock)
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Dish (optional)">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Potato omelette" />
      </Field>

      <fieldset className="allocations">
        <legend>Ingredients from your stock</legend>
        {rows.map((row, index) => {
          const item = itemById.get(row.foodItemId);
          return (
            <div className="allocation" key={index}>
              <select className="input" value={row.foodItemId} onChange={(e) => update(index, { foodItemId: e.target.value })} required>
                <option value="">Choose food…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {LOCATION_ICON[i.location]} {i.name} ({formatQuantity(i.available, i.unit)} free)
                  </option>
                ))}
              </select>
              <NumberInput
                className="input qty"
                value={row.quantity}
                onChange={(e) => update(index, { quantity: e.target.value })}
                aria-label="Quantity"
                required
              />
              <span className="unit">{item ? UNIT_LABEL[item.unit] : ''}</span>
              <button type="button" className="icon-btn" onClick={() => setRows((rs) => rs.filter((_, i) => i !== index))} aria-label="Remove ingredient">
                ✕
              </button>
            </div>
          );
        })}
        <Button size="sm" variant="ghost" onClick={() => setRows((rs) => [...rs, { foodItemId: '', quantity: '1' }])} disabled={items.length === 0}>
          + Add ingredient
        </Button>
        {items.length === 0 && <p className="muted">Add food to your inventory first.</p>}
      </fieldset>

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        {meal && (
          <>
            <Button variant="danger" onClick={onDelete} disabled={busy}>
              Delete
            </Button>
            <Button onClick={onConsume} disabled={busy || meal.allocations.length === 0} title="Take the ingredients out of stock">
              Mark as eaten
            </Button>
          </>
        )}
        <Button variant="primary" type="submit" disabled={busy}>
          Save
        </Button>
      </div>
    </form>
  );
}
