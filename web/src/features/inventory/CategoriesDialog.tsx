import { Check, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useCategories, useCategoryAction, useItems } from '../../api/hooks';
import type { Category } from '../../api/types';
import { Button, IconButton } from '../../components/atoms/Button';
import { TextInput } from '../../components/atoms/Field';
import { Modal } from '../../components/atoms/Modal';
import { useToast } from '../../components/atoms/Toast';
import { countOf } from '../../shared/labels';

/** Create, rename and delete the household's food categories. */
export function CategoriesDialog({ onClose }: { onClose: () => void }) {
  const categories = useCategories();
  const items = useItems().data ?? [];
  const action = useCategoryAction();
  const toast = useToast();
  const [name, setName] = useState('');

  const create = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    action.mutate({ type: 'create', name: trimmed }, { onSuccess: () => { setName(''); toast(`Sección «${trimmed}» creada`); } });
  };

  return (
    <Modal title="Secciones" subtitle="Agrupan tus alimentos: proteínas, verduras, frutas…" onClose={onClose}>
      <div className="form">
        <form className="category-add" onSubmit={create}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nueva sección, p. ej. Congelados" aria-label="Nombre de la nueva sección" />
          <Button type="submit" variant="primary" icon={Plus} disabled={action.isPending || !name.trim()}>
            Crear
          </Button>
        </form>
        {action.error && (
          <p className="error" role="alert">
            {action.error.message}
          </p>
        )}
        <ul className="category-list">
          {(categories.data ?? []).map((category) => (
            <CategoryRow
              key={`${category.id}:${category.name}`}
              category={category}
              count={items.filter((i) => i.categoryId === category.id).length}
              busy={action.isPending}
              onRename={(next) => action.mutate({ type: 'rename', id: category.id, name: next }, { onSuccess: () => toast('Sección renombrada') })}
              onDelete={() => action.mutate({ type: 'delete', id: category.id }, { onSuccess: () => toast(`Sección «${category.name}» eliminada`) })}
            />
          ))}
        </ul>
        <p className="field-hint">Al eliminar una sección, sus alimentos no se borran: quedan sin sección.</p>
      </div>
    </Modal>
  );
}

interface CategoryRowProps {
  category: Category;
  count: number;
  busy: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function CategoryRow({ category, count, busy, onRename, onDelete }: CategoryRowProps) {
  const [value, setValue] = useState(category.name);
  const changed = value.trim() !== '' && value.trim() !== category.name;

  return (
    <li className="category-row">
      <form
        className="category-rename"
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) onRename(value.trim());
        }}
      >
        <TextInput value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} aria-label={`Nombre de la sección ${category.name}`} />
        {changed && <IconButton icon={Check} label={`Guardar el nombre de ${category.name}`} type="submit" disabled={busy} />}
      </form>
      <span className="muted category-count">{countOf(count, 'alimento', 'alimentos')}</span>
      <IconButton icon={Trash2} label={`Eliminar la sección ${category.name}`} disabled={busy} onClick={onDelete} />
    </li>
  );
}
