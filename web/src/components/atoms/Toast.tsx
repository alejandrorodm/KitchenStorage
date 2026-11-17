import { CircleCheck } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Show = (text: string) => void;

const ToastContext = createContext<Show>(() => {});

/** Short confirmations ("Alimento añadido") announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  const show = useCallback<Show>((text) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, text }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 2800);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <CircleCheck aria-hidden size={18} />
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Show {
  return useContext(ToastContext);
}
