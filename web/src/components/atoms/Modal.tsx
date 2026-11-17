import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Native <dialog>: the browser handles focus trapping and Escape.
 * Shown as a bottom sheet on phones and a centred panel on larger screens.
 */
export function Modal({ title, subtitle, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the backdrop lands on the <dialog> element itself.
      onClick={(event) => event.target === ref.current && onClose()}
      aria-labelledby="modal-title"
    >
      <header className="modal-header">
        <div>
          <h2 id="modal-title">{title}</h2>
          {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        </div>
        <IconButton icon={X} label="Cerrar" onClick={onClose} />
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
