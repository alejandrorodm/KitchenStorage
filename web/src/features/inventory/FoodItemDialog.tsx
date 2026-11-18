import { useDeleteItem, useHousehold, useSaveItem } from '../../api/hooks';
import type { FoodItem, Location } from '../../api/types';
import { Modal } from '../../components/atoms/Modal';
import { useToast } from '../../components/atoms/Toast';
import { FoodItemForm } from '../../components/organisms/FoodItemForm';
import { LOCATION_LABEL } from '../../shared/labels';

interface FoodItemDialogProps {
  item: FoodItem | 'new';
  defaultLocation?: Location;
  onClose: () => void;
}

/** Add or edit one food item; shared by the inventory and the home screen. */
export function FoodItemDialog({ item, defaultLocation = 'fridge', onClose }: FoodItemDialogProps) {
  const save = useSaveItem();
  const remove = useDeleteItem();
  const householdThreshold = useHousehold().data?.lowThreshold ?? 0;
  const toast = useToast();
  const isNew = item === 'new';

  return (
    <Modal title={isNew ? 'Añadir alimento' : item.name} subtitle={isNew ? undefined : LOCATION_LABEL[item.location]} onClose={onClose}>
      <FoodItemForm
        item={isNew ? undefined : item}
        householdThreshold={householdThreshold}
        defaultLocation={defaultLocation}
        busy={save.isPending || remove.isPending}
        error={save.error?.message ?? remove.error?.message}
        onSubmit={(input) =>
          save.mutate(
            { id: isNew ? undefined : item.id, input },
            {
              onSuccess: () => {
                toast(isNew ? `${input.name} añadido` : 'Cambios guardados');
                onClose();
              },
            },
          )
        }
        onDelete={
          isNew
            ? undefined
            : () =>
                remove.mutate(item.id, {
                  onSuccess: () => {
                    toast(`${item.name} eliminado`);
                    onClose();
                  },
                })
        }
      />
    </Modal>
  );
}
