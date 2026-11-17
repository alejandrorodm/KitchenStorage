import { ChevronRight, CircleCheck, LogOut, Plus, ScanLine, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useItems, useLogout, useMeals, useShopping } from '../../api/hooks';
import { MEAL_TYPES, type FoodItem, type MealType } from '../../api/types';
import { useNavigate } from '../../app/navigation';
import { Button, IconButton } from '../../components/atoms/Button';
import { StatusBadge } from '../../components/atoms/StatusBadge';
import { MealSlot } from '../../components/molecules/MealSlot';
import { LOCATION_ICON } from '../../shared/icons';
import { formatQuantity } from '../../shared/labels';
import { fromIsoDate, toIsoDate } from '../../shared/week';
import { FoodItemDialog } from '../inventory/FoodItemDialog';
import { MealDialog } from '../planner/MealDialog';

/** Home screen: what we eat today, what is running out and what to buy. */
export function TodayPage({ username }: { username: string }) {
  const navigate = useNavigate();
  const logout = useLogout();
  const today = toIsoDate(new Date());
  const meals = useMeals(today, today);
  const items = useItems();
  const shopping = useShopping();
  const [openMeal, setOpenMeal] = useState<MealType | null>(null);
  const [editing, setEditing] = useState<FoodItem | 'new' | null>(null);

  const alerts = (items.data ?? []).filter((item) => item.status !== 'ok').sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'out' ? -1 : 1));
  const toBuy = (shopping.data ?? []).filter((entry) => !entry.checked);
  const mealFor = (mealType: MealType) => meals.data?.find((m) => m.mealType === mealType);
  const date = fromIsoDate(today);

  return (
    <section className="page">
      <header className="today-head">
        <div>
          <p className="page-kicker">Hola, {username}</p>
          <h1 className="today-date">
            <span className="today-weekday">{date.toLocaleDateString('es-ES', { weekday: 'long' })}</span>
            <span>{date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</span>
          </h1>
        </div>
        <IconButton icon={LogOut} label="Cerrar sesión" className="mobile-only" onClick={() => logout.mutate()} />
      </header>

      <div className="quick-actions">
        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
          Añadir alimento
        </Button>
        <Button icon={ScanLine} onClick={() => navigate('receipt')}>
          Escanear ticket
        </Button>
      </div>

      <div className="today-grid">
        <section className="panel panel-menu" aria-labelledby="today-menu">
          <div className="panel-head">
            <h2 id="today-menu">Menú de hoy</h2>
            <button type="button" className="text-link" onClick={() => navigate('planner')}>
              Ver la semana <ChevronRight aria-hidden size={16} />
            </button>
          </div>
          <ol className="timeline">
            {MEAL_TYPES.map((mealType) => (
              <li key={mealType}>
                <MealSlot mealType={mealType} meal={mealFor(mealType)} onOpen={() => setOpenMeal(mealType)} />
              </li>
            ))}
          </ol>
        </section>

        <section className="panel" aria-labelledby="today-alerts">
          <div className="panel-head">
            <h2 id="today-alerts">Se está acabando</h2>
            {alerts.length > 0 && <span className="count count-alert">{alerts.length}</span>}
          </div>
          {items.isSuccess && alerts.length === 0 ? (
            <p className="all-good">
              <CircleCheck aria-hidden size={20} /> Tienes de todo. Te avisaremos cuando algo se acabe.
            </p>
          ) : (
            <ul className="mini-list">
              {alerts.slice(0, 6).map((item) => {
                const Icon = LOCATION_ICON[item.location];
                return (
                  <li key={item.id}>
                    <button type="button" className="mini-row" data-zone={item.location} onClick={() => setEditing(item)}>
                      <Icon aria-hidden size={16} className="zone-icon" />
                      <span className="mini-name">{item.name}</span>
                      <span className="mini-qty">{formatQuantity(item.available, item.unit)}</span>
                      <StatusBadge status={item.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {alerts.length > 6 && (
            <button type="button" className="text-link" onClick={() => navigate('inventory')}>
              Ver los {alerts.length} <ChevronRight aria-hidden size={16} />
            </button>
          )}
        </section>

        <section className="panel" aria-labelledby="today-shopping">
          <div className="panel-head">
            <h2 id="today-shopping">Lista de la compra</h2>
            {toBuy.length > 0 && <span className="count">{toBuy.length}</span>}
          </div>
          {shopping.isSuccess && toBuy.length === 0 ? (
            <p className="all-good">
              <CircleCheck aria-hidden size={20} /> No falta nada por comprar.
            </p>
          ) : (
            <p className="shopping-preview">{toBuy.slice(0, 8).map((entry) => entry.name).join(', ')}{toBuy.length > 8 ? '…' : ''}</p>
          )}
          <Button icon={ShoppingCart} onClick={() => navigate('shopping')}>
            Abrir la lista
          </Button>
        </section>
      </div>

      {openMeal && <MealDialog date={today} mealType={openMeal} meal={mealFor(openMeal)} onClose={() => setOpenMeal(null)} />}
      {editing && <FoodItemDialog item={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}
