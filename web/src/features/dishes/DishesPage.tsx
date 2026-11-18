import { BookOpen, Check, ChefHat, Clock, Info, LoaderCircle, Plus, ShoppingCart, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAddShopping, useAiStatus, useDishAction, useDishes, useShopping, useSuggestDishes } from '../../api/hooks';
import type { DishSuggestion } from '../../api/types';
import { Button, IconButton } from '../../components/atoms/Button';
import { EmptyState } from '../../components/atoms/EmptyState';
import { Segmented } from '../../components/atoms/Segmented';
import { Field, TextInput } from '../../components/atoms/Field';
import { useToast } from '../../components/atoms/Toast';
import { PageHeader } from '../../components/molecules/PageHeader';
import { normalizeForMatch, suggestionToDish } from '../../shared/dishes';
import { MyDishes, SourceLink } from './MyDishes';

type Tab = 'ideas' | 'mine';
const TABS: readonly Tab[] = ['ideas', 'mine'];
const TAB_LABEL: Record<Tab, string> = { ideas: 'Ideas con IA', mine: 'Mis platos' };
const TAB_ICON = { ideas: Sparkles, mine: BookOpen };
const TAB_KEY = 'dishes-tab';

function storedTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'mine' ? 'mine' : 'ideas';
  } catch {
    return 'ideas';
  }
}

/** Dishes: the household's own, and ideas from the AI built around what is in stock. */
export function DishesPage() {
  const [tab, setTabState] = useState<Tab>(storedTab);
  const setTab = (next: Tab) => {
    setTabState(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Only a convenience: the page opens on the ideas next time.
    }
  };

  return (
    <section className="page page-narrow">
      <PageHeader title="Platos" />
      <Segmented label="Platos" value={tab} options={TABS} labels={TAB_LABEL} icons={TAB_ICON} onChange={setTab} />
      {tab === 'ideas' ? <DishIdeas /> : <MyDishes />}
    </section>
  );
}

function DishIdeas() {
  const status = useAiStatus();
  const suggest = useSuggestDishes();
  const [wish, setWish] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    suggest.mutate(wish);
  };

  if (status.data && !status.data.enabled) {
    return (
      <EmptyState icon={Info} title="La IA no está activada">
        <p>Falta configurar GEMINI_API_KEY en el servidor para recibir ideas de platos.</p>
      </EmptyState>
    );
  }

  const dishes = suggest.data?.dishes;

  return (
    <>
      <p className="lead">La IA te propone platos con lo que tienes en casa, algunos inspirados en recetas de TheMealDB, y te dice qué faltaría comprar. Guarda con + los que te gusten.</p>

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
          {dishes.map((dish, index) => (
            <DishCard key={`${index}:${dish.title}`} dish={dish} />
          ))}
        </ul>
      )}
    </>
  );
}

function DishCard({ dish }: { dish: DishSuggestion }) {
  const shopping = useShopping().data ?? [];
  const add = useAddShopping();
  const saved = useDishes().data ?? [];
  const save = useDishAction();
  const toast = useToast();
  const isSaved = saved.some((d) => normalizeForMatch(d.title) === normalizeForMatch(dish.title));
  const keep = () => save.mutate({ type: 'create', input: suggestionToDish(dish) }, { onSuccess: () => toast(`${dish.title} guardado en Mis platos`) });
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
        <span className="dish-head-actions">
          <span className="dish-time">
            <Clock aria-hidden size={16} /> {dish.minutes} min
          </span>
          {isSaved ? (
            <span className="dish-saved" title="Guardado en Mis platos">
              <Check aria-hidden size={18} />
              <span className="sr-only">Guardado en Mis platos</span>
            </span>
          ) : (
            <IconButton icon={Plus} className="dish-keep" label={`Guardar ${dish.title} en Mis platos`} onClick={keep} disabled={save.isPending} />
          )}
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
      {dish.sourceUrl && <SourceLink url={dish.sourceUrl} />}
      {(add.error ?? save.error) && (
        <p className="error" role="alert">
          {(add.error ?? save.error)!.message}
        </p>
      )}
    </li>
  );
}
