import { useItems, useMealAction, useSaveMeal } from '../../api/hooks';
import type { Meal, MealType } from '../../api/types';
import { Modal } from '../../components/atoms/Modal';
import { useToast } from '../../components/atoms/Toast';
import { MealEditor } from '../../components/organisms/MealEditor';
import { MEAL_LABEL } from '../../shared/labels';
import { formatLongDay } from '../../shared/week';

interface MealDialogProps {
  date: string;
  mealType: MealType;
  meal: Meal | undefined;
  onClose: () => void;
}

/** Plan, consume or remove one meal; shared by the planner and the home screen. */
export function MealDialog({ date, mealType, meal, onClose }: MealDialogProps) {
  const items = useItems();
  const save = useSaveMeal();
  const action = useMealAction();
  const toast = useToast();

  return (
    <Modal title={MEAL_LABEL[mealType]} subtitle={formatLongDay(date)} onClose={onClose}>
      <MealEditor
        key={`${date}-${mealType}-${meal?.consumed}`}
        meal={meal}
        items={items.data ?? []}
        busy={save.isPending || action.isPending}
        error={save.error?.message ?? action.error?.message}
        onSave={(input) =>
          save.mutate(
            { date, mealType, input },
            {
              onSuccess: () => {
                toast('Menú guardado');
                onClose();
              },
            },
          )
        }
        onConsume={() => meal && action.mutate({ id: meal.id, action: 'consume' }, { onSuccess: () => toast('Marcada como consumida') })}
        onUnconsume={() => meal && action.mutate({ id: meal.id, action: 'unconsume' }, { onSuccess: () => toast('Devuelto al stock') })}
        onDelete={() =>
          meal &&
          action.mutate(
            { id: meal.id, action: 'delete' },
            {
              onSuccess: () => {
                toast('Comida eliminada del menú');
                onClose();
              },
            },
          )
        }
      />
    </Modal>
  );
}
