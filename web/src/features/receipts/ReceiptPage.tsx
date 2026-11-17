import { useState } from 'react';
import { useConfirmReceipt, useReadReceipt, useReceiptStatus } from '../../api/hooks';
import type { ReceiptLine } from '../../api/types';
import { ReceiptReview } from '../../components/organisms/ReceiptReview';

export function ReceiptPage({ onDone }: { onDone: () => void }) {
  const status = useReceiptStatus();
  const read = useReadReceipt();
  const confirm = useConfirmReceipt();
  const [lines, setLines] = useState<ReceiptLine[] | null>(null);

  const reset = () => {
    setLines(null);
    read.reset();
    confirm.reset();
  };

  if (status.data && !status.data.enabled) {
    return (
      <section className="page">
        <p className="empty">Receipt reading is not configured on the server (missing GEMINI_API_KEY). You can still add food manually.</p>
      </section>
    );
  }

  if (lines) {
    return (
      <section className="page">
        <h2>Review receipt</h2>
        <ReceiptReview
          lines={lines}
          busy={confirm.isPending}
          error={confirm.error?.message}
          onChange={setLines}
          onCancel={reset}
          onConfirm={() =>
            confirm.mutate(lines, {
              onSuccess: () => {
                reset();
                onDone();
              },
            })
          }
        />
      </section>
    );
  }

  return (
    <section className="page">
      <label className={`dropzone ${read.isPending ? 'dropzone-busy' : ''}`}>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={read.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) read.mutate(file, { onSuccess: (data) => setLines(data.lines) });
          }}
        />
        <span className="dropzone-icon">🧾</span>
        <strong>{read.isPending ? 'Reading receipt…' : 'Take or choose a photo of the receipt'}</strong>
        <small>Flat, well lit and with the whole receipt visible works best.</small>
      </label>
      {read.error && <p className="error">{read.error.message}</p>}
    </section>
  );
}
