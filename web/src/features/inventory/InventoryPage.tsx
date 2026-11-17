import { Plus, ScanLine, Search, SearchX, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAdjustItem, useItems } from '../../api/hooks';
import { LOCATIONS, type FoodItem, type Location } from '../../api/types';
import { useNavigate } from '../../app/navigation';
import { Button } from '../../components/atoms/Button';
import { EmptyState } from '../../components/atoms/EmptyState';
import { FoodItemRow } from '../../components/molecules/FoodItemRow';
import { PageHeader } from '../../components/molecules/PageHeader';
import { LOCATION_ICON } from '../../shared/icons';
import { LOCATION_LABEL } from '../../shared/labels';
import { FoodItemDialog } from './FoodItemDialog';

type Filter = Location | 'all';

export function InventoryPage() {
  const navigate = useNavigate();
  const items = useItems();
  const adjust = useAdjustItem();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ item: FoodItem | 'new'; location?: Location } | null>(null);

  const all = useMemo(() => [...(items.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')), [items.data]);
  const alerts = all.filter((item) => item.status !== 'ok').length;
  const term = search.trim().toLocaleLowerCase('es');
  const visible = all.filter((item) => !term || item.name.toLocaleLowerCase('es').includes(term));
  const zones = filter === 'all' ? LOCATIONS : [filter];

  return (
    <section className="page">
      <PageHeader
        title="Alimentos"
        actions={
          <>
            <Button icon={ScanLine} onClick={() => navigate('receipt')} className="hide-narrow">
              Ticket
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setEditing({ item: 'new', location: filter === 'all' ? undefined : filter })}>
              Añadir
            </Button>
          </>
        }
      />

      {alerts > 0 && (
        <p className="notice notice-warn" role="status">
          <TriangleAlert aria-hidden size={18} />
          <span>
            {alerts === 1 ? '1 alimento se está acabando.' : `${alerts} alimentos se están acabando.`} Ya están en la lista de la compra.
          </span>
        </p>
      )}

      <div className="filters">
        <label className="search">
          <Search aria-hidden size={18} />
          <input type="search" placeholder="Buscar alimento" aria-label="Buscar alimento" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <div className="chips" role="group" aria-label="Filtrar por lugar">
          {(['all', ...LOCATIONS] as Filter[]).map((f) => {
            const Icon = f === 'all' ? null : LOCATION_ICON[f];
            return (
              <button key={f} type="button" aria-pressed={filter === f} className={`chip ${filter === f ? 'chip-active' : ''}`} data-zone={f === 'all' ? undefined : f} onClick={() => setFilter(f)}>
                {Icon && <Icon aria-hidden size={16} />}
                {f === 'all' ? 'Todo' : LOCATION_LABEL[f]}
                <span className="chip-count">{f === 'all' ? all.length : all.filter((i) => i.location === f).length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {items.isPending && <p className="muted">Cargando alimentos…</p>}
      {items.error && (
        <p className="error" role="alert">
          {items.error.message}
        </p>
      )}

      {items.isSuccess && all.length === 0 && (
        <EmptyState icon={Plus} title="Tu cocina está vacía">
          <p>Añade lo que tienes en la nevera, el congelador y la despensa, o escanea el ticket de tu última compra.</p>
          <div className="empty-actions">
            <Button variant="primary" icon={Plus} onClick={() => setEditing({ item: 'new' })}>
              Añadir alimento
            </Button>
            <Button icon={ScanLine} onClick={() => navigate('receipt')}>
              Escanear ticket
            </Button>
          </div>
        </EmptyState>
      )}

      {items.isSuccess && all.length > 0 && term && visible.length === 0 && (
        <EmptyState icon={SearchX} title={`No hay nada que se llame «${search.trim()}»`} />
      )}

      {items.isSuccess && all.length > 0 && (
        <div className={`zones ${filter === 'all' ? 'zones-all' : ''}`}>
          {zones.map((location) => {
            const group = visible.filter((item) => item.location === location);
            if (term && !group.length) return null;
            const Icon = LOCATION_ICON[location];
            return (
              <section key={location} className="zone" data-zone={location} aria-labelledby={`zone-${location}`}>
                <h2 id={`zone-${location}`} className="zone-title">
                  <span className="zone-badge">
                    <Icon aria-hidden size={18} />
                  </span>
                  {LOCATION_LABEL[location]}
                  <span className="zone-count">{group.length}</span>
                </h2>
                {group.length ? (
                  <ul className="items">
                    {group.map((item) => (
                      <FoodItemRow key={item.id} item={item} busy={adjust.isPending} onEdit={() => setEditing({ item })} onAdjust={(delta) => adjust.mutate({ id: item.id, delta })} />
                    ))}
                  </ul>
                ) : (
                  <button type="button" className="zone-empty" onClick={() => setEditing({ item: 'new', location })}>
                    <Plus aria-hidden size={16} /> Añadir a {LOCATION_LABEL[location].toLocaleLowerCase('es')}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}

      {editing && <FoodItemDialog item={editing.item} defaultLocation={editing.location} onClose={() => setEditing(null)} />}
    </section>
  );
}
