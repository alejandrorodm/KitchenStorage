import { useMemo, useState } from 'react';
import { useAdjustItem, useDeleteItem, useItems, useSaveItem } from '../../api/hooks';
import { LOCATIONS, type FoodItem, type Location } from '../../api/types';
import { Button } from '../../components/atoms/Button';
import { Modal } from '../../components/atoms/Modal';
import { FoodItemRow } from '../../components/molecules/FoodItemRow';
import { FoodItemForm } from '../../components/organisms/FoodItemForm';
import { formatQuantity, LOCATION_ICON, LOCATION_LABEL, STATUS_LABEL } from '../../shared/labels';

type Filter = Location | 'all';

export function InventoryPage({ onScanReceipt }: { onScanReceipt: () => void }) {
  const items = useItems();
  const save = useSaveItem();
  const adjust = useAdjustItem();
  const remove = useDeleteItem();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FoodItem | 'new' | null>(null);

  const all = items.data ?? [];
  const alerts = all.filter((item) => item.status !== 'ok');
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return all.filter((item) => (filter === 'all' || item.location === filter) && (!term || item.name.toLocaleLowerCase().includes(term)));
  }, [all, filter, search]);

  const close = () => {
    setEditing(null);
    save.reset();
    remove.reset();
  };

  return (
    <section className="page">
      {alerts.length > 0 && (
        <div className="alerts" role="status">
          <strong>⚠️ {alerts.length === 1 ? '1 item needs attention' : `${alerts.length} items need attention`}</strong>
          <ul>
            {alerts.map((item) => (
              <li key={item.id} className={`alert-${item.status}`}>
                {item.name}: {STATUS_LABEL[item.status].toLowerCase()} ({formatQuantity(item.available, item.unit)} available)
              </li>
            ))}
          </ul>
          <small>They are already on the shopping list.</small>
        </div>
      )}

      <div className="toolbar">
        <input className="input search" type="search" placeholder="Search food…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="primary" onClick={() => setEditing('new')}>
          + Add
        </Button>
        <Button onClick={onScanReceipt}>🧾 Receipt</Button>
      </div>

      <div className="chips" role="tablist">
        {(['all', ...LOCATIONS] as Filter[]).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} className={`chip ${filter === f ? 'chip-active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : `${LOCATION_ICON[f]} ${LOCATION_LABEL[f]}`}
            <span className="chip-count">{f === 'all' ? all.length : all.filter((i) => i.location === f).length}</span>
          </button>
        ))}
      </div>

      {items.isPending && <p className="muted">Loading…</p>}
      {items.error && <p className="error">{items.error.message}</p>}
      {items.isSuccess && visible.length === 0 && <p className="empty">Nothing here yet. Add food manually or from a receipt.</p>}

      {(filter === 'all' ? LOCATIONS : [filter]).map((location) => {
        const group = visible.filter((item) => item.location === location);
        if (!group.length) return null;
        return (
          <div key={location} className="group">
            <h2>
              {LOCATION_ICON[location]} {LOCATION_LABEL[location]}
            </h2>
            <ul className="list">
              {group.map((item) => (
                <FoodItemRow
                  key={item.id}
                  item={item}
                  busy={adjust.isPending}
                  onEdit={() => setEditing(item)}
                  onAdjust={(delta) => adjust.mutate({ id: item.id, delta })}
                />
              ))}
            </ul>
          </div>
        );
      })}

      {editing && (
        <Modal title={editing === 'new' ? 'Add food' : `Edit ${editing.name}`} onClose={close}>
          <FoodItemForm
            item={editing === 'new' ? undefined : editing}
            defaultLocation={filter === 'all' ? 'fridge' : filter}
            busy={save.isPending || remove.isPending}
            error={save.error?.message ?? remove.error?.message}
            onSubmit={(input) => save.mutate({ id: editing === 'new' ? undefined : editing.id, input }, { onSuccess: close })}
            onDelete={editing === 'new' ? undefined : () => remove.mutate(editing.id, { onSuccess: close })}
          />
        </Modal>
      )}
    </section>
  );
}
