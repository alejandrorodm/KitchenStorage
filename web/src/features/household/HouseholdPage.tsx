import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useHousehold, useRegenerateHouseholdCode, useUpdateHousehold } from '../../api/hooks';
import type { Household } from '../../api/types';
import { Button } from '../../components/atoms/Button';
import { Field, NumberInput } from '../../components/atoms/Field';
import { useToast } from '../../components/atoms/Toast';
import { InviteCode } from '../../components/molecules/InviteCode';
import { PageHeader } from '../../components/molecules/PageHeader';
import { alertLabel } from '../../shared/labels';
import { PushSettings } from './PushSettings';

/** The signed-in user's household: its code to invite people and who is in it. */
export function HouseholdPage() {
  const household = useHousehold();
  const regenerate = useRegenerateHouseholdCode();
  const toast = useToast();
  const data = household.data;

  return (
    <section className="page page-narrow">
      <PageHeader title="Mi casa" kicker={data?.name} />

      {household.error && (
        <p className="error" role="alert">
          {household.error.message}
        </p>
      )}

      {data && (
        <>
          <section className="panel" aria-labelledby="household-code">
            <div className="panel-head">
              <h2 id="household-code">Código de tu casa</h2>
            </div>
            <p className="muted">Quien cree una cuenta con este código entrará en tu casa y verá vuestros alimentos, el menú y la lista de la compra.</p>
            <InviteCode code={data.inviteCode} size="lg" />
            <div>
              <Button
                size="sm"
                variant="ghost"
                icon={RefreshCw}
                disabled={regenerate.isPending}
                onClick={() => regenerate.mutate(undefined, { onSuccess: () => toast('Código nuevo creado; el anterior ya no sirve') })}
              >
                Cambiar código
              </Button>
            </div>
            {regenerate.error && (
              <p className="error" role="alert">
                {regenerate.error.message}
              </p>
            )}
          </section>

          <AlertSettings household={data} />

          <PushSettings />

          <section className="panel" aria-labelledby="household-members">
            <div className="panel-head">
              <h2 id="household-members">Quién vive aquí</h2>
              <span className="muted">{data.members.length}</span>
            </div>
            <ul className="member-list">
              {data.members.map((member) => (
                <li key={member.username} className="member">
                  <span className="avatar" aria-hidden>
                    {member.username.charAt(0).toLocaleUpperCase('es')}
                  </span>
                  <span>{member.username}</span>
                  {member.isAdmin && (
                    <span className="member-tag">
                      <ShieldCheck aria-hidden size={14} /> Admin
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </section>
  );
}

/** When items are flagged as running low and added to the shopping list. */
function AlertSettings({ household }: { household: Household }) {
  const update = useUpdateHousehold();
  const toast = useToast();
  const [value, setValue] = useState(String(household.lowThreshold));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const lowThreshold = Number(value);
    update.mutate({ lowThreshold }, { onSuccess: () => toast(`Avisaremos ${alertLabel(lowThreshold)}`) });
  };

  return (
    <section className="panel" aria-labelledby="household-alerts">
      <div className="panel-head">
        <h2 id="household-alerts">Avisos de «se está acabando»</h2>
      </div>
      <p className="muted">
        Ahora se avisa {alertLabel(household.lowThreshold)}. Se aplica a los alimentos que no tienen su propio aviso y los añade a la lista de la compra.
      </p>
      <form className="form" onSubmit={submit}>
        <Field label="Avisar cuando queden" hint="0 = solo cuando se acabe.">
          <NumberInput value={value} onChange={(e) => setValue(e.target.value)} required />
        </Field>
        {update.error && (
          <p className="error" role="alert">
            {update.error.message}
          </p>
        )}
        <div className="form-actions">
          <Button variant="primary" type="submit" disabled={update.isPending || Number(value) === household.lowThreshold}>
            Guardar
          </Button>
        </div>
      </form>
    </section>
  );
}
