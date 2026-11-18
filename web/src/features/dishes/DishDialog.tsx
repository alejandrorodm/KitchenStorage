import { Save, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useDishAction } from '../../api/hooks';
import type { Dish } from '../../api/types';
import { Button } from '../../components/atoms/Button';
import { Field, NumberInput, TextArea, TextInput } from '../../components/atoms/Field';
import { Modal } from '../../components/atoms/Modal';
import { useToast } from '../../components/atoms/Toast';
import { splitLines } from '../../shared/dishes';

/** Write a new dish for My dishes, or edit or delete one. */
export function DishDialog({ dish, onClose }: { dish: Dish | 'new'; onClose: () => void }) {
  const isNew = dish === 'new';
  const current = isNew ? undefined : dish;
  const action = useDishAction();
  const toast = useToast();
  const [title, setTitle] = useState(current?.title ?? '');
  const [minutes, setMinutes] = useState(current?.minutes ? String(current.minutes) : '');
  const [description, setDescription] = useState(current?.description ?? '');
  const [ingredients, setIngredients] = useState(current?.ingredients.join('\n') ?? '');
  const [steps, setSteps] = useState(current?.steps.join('\n') ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const time = Math.round(Number(minutes));
    const input = {
      title: title.trim(),
      description: description.trim(),
      minutes: minutes.trim() && time > 0 ? time : null,
      ingredients: splitLines(ingredients),
      steps: splitLines(steps),
      sourceUrl: current?.sourceUrl ?? null,
    };
    const done = () => {
      toast(isNew ? `${input.title} añadido a tus platos` : 'Cambios guardados');
      onClose();
    };
    if (current) action.mutate({ type: 'update', id: current.id, input }, { onSuccess: done });
    else action.mutate({ type: 'create', input }, { onSuccess: done });
  };

  const remove = () => {
    if (!current) return;
    action.mutate(
      { type: 'delete', id: current.id },
      {
        onSuccess: () => {
          toast(`${current.title} eliminado`);
          onClose();
        },
      },
    );
  };

  return (
    <Modal title={isNew ? 'Nuevo plato' : current!.title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Nombre">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="p. ej. Lentejas con chorizo" />
        </Field>
        <Field label="Tiempo en minutos (opcional)">
          <NumberInput value={minutes} onChange={(e) => setMinutes(e.target.value)} min={1} max={1440} step={1} inputMode="numeric" />
        </Field>
        <Field label="Descripción (opcional)">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} />
        </Field>
        <Field label="Ingredientes" hint="Uno por línea">
          <TextArea value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={'Lentejas\nChorizo\nZanahoria'} />
        </Field>
        <Field label="Pasos" hint="Uno por línea">
          <TextArea value={steps} onChange={(e) => setSteps(e.target.value)} rows={6} />
        </Field>
        {action.error && (
          <p className="error" role="alert">
            {action.error.message}
          </p>
        )}
        <div className="form-actions">
          {current && (
            <Button icon={Trash2} onClick={remove} disabled={action.isPending}>
              Eliminar
            </Button>
          )}
          <Button type="submit" variant="primary" icon={Save} disabled={action.isPending || !title.trim()}>
            {isNew ? 'Añadir' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
