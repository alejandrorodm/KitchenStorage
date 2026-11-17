import { CircleCheck, ListChecks, Plus, ShoppingCart } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAddShopping, useShopping, useShoppingAction } from '../../api/hooks';
import { Button } from '../../components/atoms/Button';
import { EmptyState } from '../../components/atoms/EmptyState';
import { useToast } from '../../components/atoms/Toast';
import { PageHeader } from '../../components/molecules/PageHeader';
import { ShoppingRow } from '../../components/molecules/ShoppingRow';

export function ShoppingPage() {
  const shopping = useShopping();
  const add = useAddShopping();
  const act = useShoppingAction();
  const toast = useToast();
  const [name, setName] = useState('');

  const entries = shopping.data ?? [];
  const pending = entries.filter((e) => !e.checked);
  const checked = entries.filter((e) => e.checked);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    add.mutate({ name }, { onSuccess: () => setName('') });
  };

  const row = (entry: (typeof entries)[number]) => (
    <ShoppingRow
      key={entry.id}
      entry={entry}
      onToggle={(value) => act.mutate({ type: 'check', id: entry.id, checked: value })}
      onDelete={() => act.mutate({ type: 'delete', id: entry.id })}
    />
  );

  return (
    <section className="page page-narrow">
      <PageHeader title="Lista de la compra" kicker={pending.length ? `${pending.length} por comprar` : undefined} />

      <form className="add-bar" onSubmit={submit}>
        <input className="input" placeholder="¿Qué hay que comprar?" aria-label="Producto que comprar" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <Button variant="primary" type="submit" icon={Plus} disabled={add.isPending || !name.trim()}>
          Añadir
        </Button>
      </form>
      {(add.error ?? act.error) && (
        <p className="error" role="alert">
          {(add.error ?? act.error)?.message}
        </p>
      )}

      {shopping.isSuccess && entries.length === 0 && (
        <EmptyState icon={ShoppingCart} title="La lista está vacía">
          <p>Lo que se vaya acabando en tu cocina aparecerá aquí solo. También puedes añadir cosas a mano.</p>
        </EmptyState>
      )}

      {pending.length > 0 && <ul className="buy-list">{pending.map(row)}</ul>}
      {shopping.isSuccess && entries.length > 0 && pending.length === 0 && (
        <p className="all-good">
          <CircleCheck aria-hidden size={20} /> Ya lo tienes todo.
        </p>
      )}

      {checked.length > 0 && (
        <section className="bought" aria-labelledby="bought-title">
          <div className="panel-head">
            <h2 id="bought-title">En el carro</h2>
            <Button
              size="sm"
              variant="ghost"
              icon={ListChecks}
              disabled={act.isPending}
              onClick={() => act.mutate({ type: 'clear' }, { onSuccess: () => toast('Comprados quitados de la lista') })}
            >
              Quitar comprados
            </Button>
          </div>
          <ul className="buy-list">{checked.map(row)}</ul>
        </section>
      )}

      <p className="footnote">Al añadir la compra con el ticket, lo que se había añadido automáticamente desaparece de la lista.</p>
    </section>
  );
}
