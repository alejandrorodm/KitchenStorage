import { Check, Plus } from 'lucide-react';
import type { Meal, MealType } from '../../api/types';
import { MEAL_ICON } from '../../shared/icons';
import { formatQuantity, MEAL_LABEL } from '../../shared/labels';

interface MealSlotProps {
  mealType: MealType;
  meal: Meal | undefined;
  onOpen: () => void;
}

export function MealSlot({ mealType, meal, onOpen }: MealSlotProps) {
  const empty = !meal || (!meal.title && meal.allocations.length === 0);
  const Icon = MEAL_ICON[mealType];
  return (
    <button
      type="button"
      className={`slot ${meal?.consumed ? 'slot-done' : ''} ${empty ? 'slot-empty' : ''}`}
      onClick={onOpen}
      aria-label={`${MEAL_LABEL[mealType]}: ${empty ? 'sin planificar' : meal.title || 'planificada'}${meal?.consumed ? ', consumida' : ''}`}
    >
      <span className="slot-type">
        <Icon aria-hidden size={15} />
        {MEAL_LABEL[mealType]}
        {meal?.consumed && <Check aria-hidden size={15} className="slot-check" />}
      </span>
      {empty ? (
        <span className="slot-placeholder">
          <Plus aria-hidden size={15} /> Planificar
        </span>
      ) : (
        <>
          {meal.title && <span className="slot-title">{meal.title}</span>}
          {meal.allocations.length > 0 && (
            <span className="slot-foods">{meal.allocations.map((a) => `${a.foodName} ${formatQuantity(a.quantity, a.unit)}`).join(', ')}</span>
          )}
        </>
      )}
    </button>
  );
}
