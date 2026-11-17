import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useMeals } from '../../api/hooks';
import { MEAL_TYPES, type MealType } from '../../api/types';
import { Button, IconButton } from '../../components/atoms/Button';
import { MealSlot } from '../../components/molecules/MealSlot';
import { PageHeader } from '../../components/molecules/PageHeader';
import { MEAL_ICON } from '../../shared/icons';
import { MEAL_LABEL } from '../../shared/labels';
import { addDays, dayParts, formatDay, formatLongDay, startOfWeek, toIsoDate, weekDays } from '../../shared/week';
import { MealDialog } from './MealDialog';

export function PlannerPage() {
  const today = toIsoDate(new Date());
  const thisWeek = startOfWeek(new Date());
  const [monday, setMonday] = useState(thisWeek);
  const [selected, setSelected] = useState(today);
  const [open, setOpen] = useState<{ date: string; mealType: MealType } | null>(null);
  const days = weekDays(monday);
  const meals = useMeals(days[0]!, days[6]!);

  const find = (date: string, mealType: MealType) => meals.data?.find((m) => m.date === date && m.mealType === mealType);
  const hasPlan = (date: string) => MEAL_TYPES.some((mealType) => find(date, mealType));
  const moveWeek = (offset: number) => {
    const next = addDays(monday, offset);
    setMonday(next);
    setSelected(next === thisWeek ? today : next);
  };

  return (
    <section className="page">
      <PageHeader
        title="Menú semanal"
        actions={
          <div className="week-nav">
            <IconButton icon={ChevronLeft} label="Semana anterior" onClick={() => moveWeek(-7)} />
            <span className="week-range">
              {formatDay(days[0]!)} – {formatDay(days[6]!)}
            </span>
            <IconButton icon={ChevronRight} label="Semana siguiente" onClick={() => moveWeek(7)} />
            {monday !== thisWeek && (
              <Button size="sm" variant="ghost" onClick={() => {
                  setMonday(thisWeek);
                  setSelected(today);
                }}>
                Hoy
              </Button>
            )}
          </div>
        }
      />

      {meals.error && (
        <p className="error" role="alert">
          {meals.error.message}
        </p>
      )}

      {/* Phones: pick a day, then see its three meals. Desktop: the whole week as a grid. */}
      <div className="day-picker" role="tablist" aria-label="Día de la semana">
        {days.map((date) => {
          const { weekday, day } = dayParts(date);
          return (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={selected === date}
              aria-label={formatLongDay(date)}
              className={`day-pick ${selected === date ? 'day-pick-active' : ''} ${date === today ? 'day-pick-today' : ''}`}
              onClick={() => setSelected(date)}
            >
              <span className="day-pick-weekday">{weekday}</span>
              <span className="day-pick-number">{day}</span>
              <span className={`day-pick-dot ${hasPlan(date) ? 'day-pick-dot-on' : ''}`} aria-hidden />
            </button>
          );
        })}
      </div>

      <div className="week">
        <div className="week-labels" aria-hidden>
          <span />
          {MEAL_TYPES.map((mealType) => {
            const Icon = MEAL_ICON[mealType];
            return (
              <span key={mealType} className="week-label">
                <Icon size={16} /> {MEAL_LABEL[mealType]}
              </span>
            );
          })}
        </div>
        {days.map((date) => {
          const { weekday, day } = dayParts(date);
          return (
            <div key={date} className={`day ${date === today ? 'day-today' : ''} ${selected === date ? 'day-selected' : ''}`}>
              <h2 className="day-title">
                <span className="day-weekday">{weekday}</span> <span className="day-number">{day}</span>
                <span className="day-long">{formatLongDay(date)}</span>
              </h2>
              {MEAL_TYPES.map((mealType) => (
                <MealSlot key={mealType} mealType={mealType} meal={find(date, mealType)} onOpen={() => setOpen({ date, mealType })} />
              ))}
            </div>
          );
        })}
      </div>

      {open && <MealDialog date={open.date} mealType={open.mealType} meal={find(open.date, open.mealType)} onClose={() => setOpen(null)} />}
    </section>
  );
}
