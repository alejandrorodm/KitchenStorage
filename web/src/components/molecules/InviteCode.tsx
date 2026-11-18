import { Copy } from 'lucide-react';
import { formatInviteCode } from '../../shared/invite-code';
import { useToast } from '../atoms/Toast';
import { IconButton } from '../atoms/Button';

/** A code shown large enough to dictate, with a button to copy it. */
export function InviteCode({ code, size = 'md' }: { code: string; size?: 'md' | 'lg' }) {
  const toast = useToast();
  const formatted = formatInviteCode(code);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      toast('Código copiado');
    } catch {
      toast('No se pudo copiar; selecciónalo a mano');
    }
  };

  return (
    <span className={`invite-code invite-code-${size}`}>
      <code>{formatted}</code>
      <IconButton icon={Copy} label="Copiar código" onClick={copy} />
    </span>
  );
}
