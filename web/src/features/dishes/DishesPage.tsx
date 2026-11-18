import { Check, ChefHat, Clock, Info, LoaderCircle, ShoppingCart, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAddShopping, useAiStatus, useShopping, useSuggestDishes } from '../../api/hooks';
import type { DishSuggestion } from '../../api/types';
import { Button } from '../../components/atoms/Button';
import { EmptyState } from '../../components/atoms/EmptyState';
import { Field, TextInput } from '../../components/atoms/Field';
import { useToast } from '../../components/atoms/Toast';
import { PageHeader } from '../../components/molecules/PageHeader';
import { normalizeForMatch } from '../../shared/dishes';

/** Dish ideas from the AI, built around what is in stock. */
export function DishesPage() {
  const status = useAiStatus();
  const suggest = useSuggestDishes();
  const [wish, setWish] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    suggest.mutate(wish);
  };

  if (status.data && !status.data.enabled) {
    return (
      <section className="page page-narrow">
        <PageHeader title="Ideas de platos" />
        <EmptyState icon={Info} title="La IA no está activada">
          <p>Falta configurar GEMINI_API_KEY en el servidor para recibir ideas de platos.</p>
        </EmptyState>
      </section>
    );
  }

  const dishes = suggest.data?.dishes;

  return (
    <section className="page page-narrow">
      <PageHeader title="Ideas de platos" />
      <p className="lead">La IA te propone platos con lo que tienes en casa y te dice qué faltaría comprar.</p>

      <form className="form dish-form" onSubmit={submit}>
        <Field label="¿Qué te apetece? (opcional)">
          <TextInput value={wish} onChange={(e) => setWish(e.target.value)} maxLength={200} placeholder="p. ej. algo rápido, cena ligera, sin horno" />
        </Field>
        <div className="form-actions">
          <Button type="submit" variant="primary" icon={Sparkles} disabled={suggest.isPending}>
            {dishes ? 'Otras ideas' : 'Sugerir platos'}
          </Button>
        </div>
      </form>

      {suggest.isPending && (
        <p className="capture-progress" role="status">
          <LoaderCircle aria-hidden size={28} className="spin" /> Pensando platos…
        </p>
      )}
      {suggest.error && (
        <p className="error" role="alert">
          {suggest.error.message}
        </p>
      )}

      {!suggest.isPending && dishes && dishes.length === 0 && <EmptyState icon={ChefHat} title="No salió ninguna idea. Prueba otra vez." />}
      {!suggest.isPending && dishes && dishes.length > 0 && (
        <ul className="dish-list">
          {dishes.map((dish) => (
            <DishCard key={dish.title} dish={dish} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DishCard({ dish }: { dish: DishSuggestion }) {
  const shopping = useShopping().data ?? [];
  const add = useAddShopping();
  const toast = useToast();
  const onList = new Set(shopping.filter((e) => !e.checked).map((e) => normalizeForMatch(e.name)));
  const toBuy = dish.missing.filter((name) => !onList.has(normalizeForMatch(name)));

  const addMissing = async () => {
    for (const name of toBuy) await add.mutateAsync({ name });
    toast(`${toBuy.length === 1 ? 'Añadido' : `${toBuy.length} añadidos`} a la compra`);
  };

  return (
    <li className="panel dish">
      <div className="panel-head">
        <h2>{dish.title}</h2>
        <span className="dish-time">
          <Clock aria-hidden size={16} /> {dish.minutes} min
        </span>
      </div>
      {dish.description && <p className="muted">{dish.description}</p>}
      <p className="dish-uses">
        <strong>Usa:</strong> {dish.uses.length ? dish.uses.join(', ') : '—'}
      </p>
      {dish.missing.length > 0 ? (
        <p className="dish-missing">
          <strong>Te falta:</strong> {dish.missing.join(', ')}
        </p>
      ) : (
        <p className="dish-complete">
          <Check aria-hidden size={16} /> Tienes todo lo necesario
        </p>
      )}
      <details>
        <summary>Cómo se hace</summary>
        <ol className="dish-steps">
          {dish.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </details>
      {dish.missing.length > 0 && (
        <div>
          <Button size="sm" icon={ShoppingCart} onClick={() => void addMissing()} disabled={add.isPending || toBuy.length === 0}>
            {toBuy.length === 0 ? 'Ya está en la compra' : 'Añadir lo que falta a la compra'}
          </Button>
        </div>
      )}
      {add.error && (
        <p className="error" role="alert">
          {add.error.message}
        </p>
      )}
    </li>
  );
}
