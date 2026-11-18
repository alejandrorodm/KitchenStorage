import { Bell, BellOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePushKey } from '../../api/hooks';
import { Button } from '../../components/atoms/Button';
import { useToast } from '../../components/atoms/Toast';
import { currentSubscription, disablePush, enablePush, pushSupported } from '../../shared/push';

type DeviceState = 'loading' | 'on' | 'off';

/** Turns stock notifications on or off for this device. */
export function PushSettings() {
  const key = usePushKey();
  const toast = useToast();
  const [state, setState] = useState<DeviceState>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const supported = pushSupported();

  useEffect(() => {
    if (!supported) return;
    currentSubscription()
      .then((subscription) => setState(subscription && Notification.permission === 'granted' ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, [supported]);

  const run = async (action: () => Promise<void>, next: DeviceState, message: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      setState(next);
      toast(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar');
    } finally {
      setBusy(false);
    }
  };

  const publicKey = key.data?.publicKey;
  let content;
  if (!supported) {
    content = <p className="muted">Este navegador no admite notificaciones. En iPhone, añade la app a la pantalla de inicio primero.</p>;
  } else if (key.isPending || state === 'loading') {
    content = null;
  } else if (!publicKey) {
    content = <p className="muted">Las notificaciones no están configuradas en el servidor.</p>;
  } else if (state === 'on') {
    content = (
      <>
        <p className="muted">Activadas en este dispositivo.</p>
        <div>
          <Button size="sm" variant="ghost" icon={BellOff} disabled={busy} onClick={() => run(disablePush, 'off', 'Notificaciones desactivadas')}>
            Desactivar
          </Button>
        </div>
      </>
    );
  } else {
    content = (
      <div>
        <Button size="sm" variant="primary" icon={Bell} disabled={busy} onClick={() => run(() => enablePush(publicKey), 'on', 'Notificaciones activadas')}>
          Activar en este dispositivo
        </Button>
      </div>
    );
  }

  return (
    <section className="panel" aria-labelledby="household-push">
      <div className="panel-head">
        <h2 id="household-push">Notificaciones</h2>
      </div>
      <p className="muted">Te avisamos cuando un alimento se acaba o se está acabando: uno por alimento si son hasta 3, y un resumen si son más.</p>
      {content}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
