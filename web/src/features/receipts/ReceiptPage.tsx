import { Camera, ImageUp, Info, LoaderCircle } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { useCategories, useConfirmReceipt, useReadReceipt, useReceiptStatus } from '../../api/hooks';
import type { ReceiptLine } from '../../api/types';
import { useNavigate } from '../../app/navigation';
import { EmptyState } from '../../components/atoms/EmptyState';
import { useToast } from '../../components/atoms/Toast';
import { PageHeader } from '../../components/molecules/PageHeader';
import { countOf } from '../../shared/labels';
import { ReceiptReview } from '../../components/organisms/ReceiptReview';

export function ReceiptPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const status = useReceiptStatus();
  const read = useReadReceipt();
  const confirm = useConfirmReceipt();
  const categories = useCategories().data ?? [];
  const [lines, setLines] = useState<ReceiptLine[] | null>(null);

  const reset = () => {
    setLines(null);
    read.reset();
    confirm.reset();
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // lets the same photo be picked again after an error
    if (file) read.mutate(file, { onSuccess: (data) => setLines(data.lines) });
  };

  if (status.data && !status.data.enabled) {
    return (
      <section className="page page-narrow">
        <PageHeader title="Escanear ticket" />
        <EmptyState icon={Info} title="La lectura de tickets no está activada">
          <p>Falta configurar GEMINI_API_KEY en el servidor. Mientras tanto puedes añadir los alimentos a mano.</p>
        </EmptyState>
      </section>
    );
  }

  if (lines) {
    return (
      <section className="page page-narrow">
        <PageHeader title="Revisar ticket" kicker={countOf(lines.length, 'producto leído', 'productos leídos')} />
        <ReceiptReview
          lines={lines}
          categories={categories}
          busy={confirm.isPending}
          error={confirm.error?.message}
          onChange={setLines}
          onCancel={reset}
          onConfirm={() =>
            confirm.mutate(lines, {
              onSuccess: () => {
                toast(`${countOf(lines.length, 'producto añadido', 'productos añadidos')}`);
                reset();
                navigate('inventory');
              },
            })
          }
        />
      </section>
    );
  }

  return (
    <section className="page page-narrow">
      <PageHeader title="Escanear ticket" />
      <p className="lead">Haz una foto al ticket de la compra y añadiremos los productos a tus alimentos. Antes de guardarlos podrás revisarlos.</p>
      <div className={`capture ${read.isPending ? 'capture-busy' : ''}`}>
        {read.isPending ? (
          <p className="capture-progress" role="status">
            <LoaderCircle aria-hidden size={28} className="spin" /> Leyendo el ticket…
          </p>
        ) : (
          <>
            <label className="btn btn-primary btn-md capture-btn">
              <input type="file" className="sr-only" accept="image/*" capture="environment" onChange={onFile} />
              <Camera aria-hidden size={20} /> Hacer foto
            </label>
            <label className="btn btn-secondary btn-md capture-btn">
              <input type="file" className="sr-only" accept="image/*" onChange={onFile} />
              <ImageUp aria-hidden size={20} /> Elegir imagen
            </label>
          </>
        )}
      </div>
      {read.error && (
        <p className="error" role="alert">
          {read.error.message}
        </p>
      )}
      <ul className="tips">
        <li>Estira el ticket y que salga entero en la foto.</li>
        <li>Busca buena luz y evita reflejos.</li>
        <li>Si es muy largo, haz una foto por mitad.</li>
      </ul>
    </section>
  );
}
