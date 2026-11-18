import { BookOpen, Clock, ExternalLink, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useDishes } from '../../api/hooks';
import type { Dish } from '../../api/types';
import { Button, IconButton } from '../../components/atoms/Button';
import { EmptyState } from '../../components/atoms/EmptyState';
import { DishDialog } from './DishDialog';

/** The household's own dishes: written by hand or saved from an AI idea. */
export function MyDishes() {
  const dishes = useDishes();
  const [editing, setEditing] = useState<Dish | 'new' | null>(null);
  const list = dishes.data ?? [];

  return (
    <>
      <div className="form-actions">
        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
          Nuevo plato
        </Button>
      </div>
      {dishes.isSuccess && list.length === 0 && (
        <EmptyState icon={BookOpen} title="Aún no tienes platos guardados">
          <p>Escribe los tuyos o guarda con + las ideas de la IA que te gusten.</p>
        </EmptyState>
      )}
      {list.length > 0 && (
        <ul className="dish-list">
          {list.map((dish) => (
            <li key={dish.id} className="panel dish">
              <div className="panel-head">
                <h2>{dish.title}</h2>
                <span className="dish-head-actions">
                  {dish.minutes && (
                    <span className="dish-time">
                      <Clock aria-hidden size={16} /> {dish.minutes} min
                    </span>
                  )}
                  <IconButton icon={Pencil} label={`Editar ${dish.title}`} onClick={() => setEditing(dish)} />
                </span>
              </div>
              {dish.description && <p className="muted">{dish.description}</p>}
              {dish.ingredients.length > 0 && (
                <p className="dish-uses">
                  <strong>Ingredientes:</strong> {dish.ingredients.join(', ')}
                </p>
              )}
              {dish.steps.length > 0 && (
                <details>
                  <summary>Cómo se hace</summary>
                  <ol className="dish-steps">
                    {dish.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </details>
              )}
              {dish.sourceUrl && <SourceLink url={dish.sourceUrl} />}
            </li>
          ))}
        </ul>
      )}
      {editing && <DishDialog dish={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export function SourceLink({ url }: { url: string }) {
  return (
    <a className="dish-source" href={url} target="_blank" rel="noopener noreferrer">
      <ExternalLink aria-hidden size={14} /> Receta original en TheMealDB
    </a>
  );
}
