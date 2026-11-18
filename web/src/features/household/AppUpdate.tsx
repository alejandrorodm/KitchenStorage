import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/atoms/Button';
import { useToast } from '../../components/atoms/Toast';
import { buildLabel, checkForUpdate } from '../../shared/app-update';

/** Shows the running version and checks for a newer one on demand. */
export function AppUpdate() {
  const toast = useToast();
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const result = await checkForUpdate();
      if (result === 'up-to-date') {
        toast('Ya tienes la última versión');
        setChecking(false);
      } else {
        toast('Actualizando…');
      }
    } catch {
      toast('No se pudo comprobar. ¿Tienes conexión?');
      setChecking(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="household-app">
      <div className="panel-head">
        <h2 id="household-app">Aplicación</h2>
      </div>
      <p className="muted">Versión del {buildLabel(__APP_BUILD__)}. La app se actualiza sola al abrirla; este botón lo hace al momento.</p>
      <div>
        <Button size="sm" variant="ghost" icon={RefreshCw} disabled={checking} onClick={check}>
          {checking ? 'Buscando…' : 'Buscar actualizaciones'}
        </Button>
      </div>
    </section>
  );
}
