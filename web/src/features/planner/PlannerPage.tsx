import { useState } from 'react';
import { useItems, useMealAction, useMeals, useSaveMeal } from '../../api/hooks';
import { MEAL_TYPES, type MealType } from '../../api/types';
import { Button } from '../../components/atoms/Button';
import { Modal } from '../../components/atoms/Modal';
import { MealSlot } from '../../components/molecules/MealSlot';
import { MealEditor } from '../../components/organisms/MealEditor';
import { MEAL_LABEL } from '../../shared/labels';
import { addDays, formatDay, startOfWeek, toIsoDate, weekDays } from '../../shared/week';

export function PlannerPage() {
  const [monday, setMonday] = useState(() => startOfWeek(new Date()));
  const [open, setOpen] = useState<{ date: string; mealType: MealType } | null>(null);
  const days = weekDays(monday);
  const meals = useMeals(days[0]!, days[6]!);
  const items = useItems();
  const save = useSaveMeal();
  const action = useMealAction();
  const today = toIsoDate(new Date());

  const find = (date: string, mealType: MealType) => meals.data?.find((m) => m.date === date && m.mealType === mealType);
  const current = open ? find(open.date, open.mealType) : undefined;
  const close = () => {
    setOpen(null);
    save.reset();
    action.reset();
  };

  return (
    <section className="page">
      <div className="toolbar week-nav">
        <Button size="sm" onClick={() => setMonday(addDays(monday, -7))} aria-label="Previous week">
          ‹
        </Button>
        <strong>
          {formatDay(days[0]!)} – {formatDay(days[6]!)}
        </strong>
        <Button size="sm" onClick={() => setMonday(addDays(monday, 7))} aria-label="Next week">
          ›
        </Button>
        {monday !== startOfWeek(new Date()) && (
          <Button size="sm" variant="ghost" onClick={() => setMonday(startOfWeek(new Date()))}>
            Today
          </Button>
        )}
      </div>

      {meals.error && <p className="error">{meals.error.message}</p>}

      <div className="week">
        {days.map((date) => (
          <div key={date} className={`day ${date === today ? 'day-today' : ''}`}>
            <h3>{formatDay(date)}</h3>
            {MEAL_TYPES.map((mealType) => (
              <MealSlot key={mealType} mealType={mealType} meal={find(date, mealType)} onOpen={() => setOpen({ date, mealType })} />
            ))}
          </div>
        ))}
      </div>

      {open && (
        <Modal title={`${MEAL_LABEL[open.mealType]} · ${formatDay(open.date)}`} onClose={close}>
          <MealEditor
            key={`${open.date}-${open.mealType}-${current?.consumed}`}
            meal={current}
            items={items.data ?? []}
            busy={save.isPending || action.isPending}
            error={save.error?.message ?? action.error?.message}
            onSave={(input) => save.mutate({ ...open, input }, { onSuccess: close })}
            onConsume={() => current && action.mutate({ id: current.id, action: 'consume' })}
            onUnconsume={() => current && action.mutate({ id: current.id, action: 'unconsume' })}
            onDelete={() => current && action.mutate({ id: current.id, action: 'delete' }, { onSuccess: close })}
          />
        </Modal>
      )}
    </section>
  );
}
