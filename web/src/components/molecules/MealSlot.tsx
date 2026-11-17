import type { Meal, MealType } from '../../api/types';
import { formatQuantity, MEAL_LABEL } from '../../shared/labels';

interface MealSlotProps {
  mealType: MealType;
  meal: Meal | undefined;
  onOpen: () => void;
}

export function MealSlot({ mealType, meal, onOpen }: MealSlotProps) {
  const empty = !meal || (!meal.title && meal.allocations.length === 0);
  return (
    <button type="button" className={`slot ${meal?.consumed ? 'slot-done' : ''} ${empty ? 'slot-empty' : ''}`} onClick={onOpen}>
      <span className="slot-type">
        {MEAL_LABEL[mealType]}
        {meal?.consumed && ' ✓'}
      </span>
      {empty ? (
        <span className="slot-placeholder">+ Plan</span>
      ) : (
        <>
          {meal.title && <span className="slot-title">{meal.title}</span>}
          <span className="slot-foods">
            {meal.allocations.map((a) => `${a.foodName} (${formatQuantity(a.quantity, a.unit)})`).join(', ')}
          </span>
        </>
      )}
    </button>
  );
}
