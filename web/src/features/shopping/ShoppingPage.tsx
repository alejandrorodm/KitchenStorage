import { useState, type FormEvent } from 'react';
import { useAddShopping, useShopping, useShoppingAction } from '../../api/hooks';
import { Button } from '../../components/atoms/Button';
import { ShoppingRow } from '../../components/molecules/ShoppingRow';

export function ShoppingPage() {
  const shopping = useShopping();
  const add = useAddShopping();
  const act = useShoppingAction();
  const [name, setName] = useState('');

  const entries = shopping.data ?? [];
  const checkedCount = entries.filter((e) => e.checked).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    add.mutate({ name }, { onSuccess: () => setName('') });
  };

  return (
    <section className="page">
      <form className="toolbar" onSubmit={submit}>
        <input className="input search" placeholder="Añade algo que comprar…" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <Button variant="primary" type="submit" disabled={add.isPending || !name.trim()}>
          Añadir
        </Button>
      </form>
      {(add.error ?? act.error) && <p className="error">{(add.error ?? act.error)?.message}</p>}
      {shopping.isSuccess && entries.length === 0 && <p className="empty">La lista está vacía. Lo que se vaya acabando se añade solo.</p>}

      <ul className="list">
        {entries.map((entry) => (
          <ShoppingRow
            key={entry.id}
            entry={entry}
            onToggle={(checked) => act.mutate({ type: 'check', id: entry.id, checked })}
            onDelete={() => act.mutate({ type: 'delete', id: entry.id })}
          />
        ))}
      </ul>

      {checkedCount > 0 && (
        <Button className="block" onClick={() => act.mutate({ type: 'clear' })} disabled={act.isPending}>
          Quitar {checkedCount} comprados
        </Button>
      )}
      <p className="muted small">Consejo: añade la compra con la foto del ticket y los artículos automáticos desaparecen solos.</p>
    </section>
  );
}
