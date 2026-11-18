import { House, Plus, TicketCheck, Trash2 } from 'lucide-react';
import { useHouseholds, useInviteAction, useInvites } from '../../api/hooks';
import { Button, IconButton } from '../../components/atoms/Button';
import { EmptyState } from '../../components/atoms/EmptyState';
import { useToast } from '../../components/atoms/Toast';
import { InviteCode } from '../../components/molecules/InviteCode';
import { PageHeader } from '../../components/molecules/PageHeader';
import { formatInviteCode } from '../../shared/invite-code';

const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

/** Admin only: codes that create new households, and every household using the app. */
export function AdminPage() {
  const invites = useInvites();
  const households = useHouseholds();
  const act = useInviteAction();
  const toast = useToast();

  const pending = (invites.data ?? []).filter((invite) => !invite.usedAt);
  const used = (invites.data ?? []).filter((invite) => invite.usedAt);
  const error = invites.error ?? households.error ?? act.error;

  return (
    <section className="page page-narrow">
      <PageHeader
        title="Administración"
        actions={
          <Button variant="primary" icon={Plus} disabled={act.isPending} onClick={() => act.mutate({ type: 'create' }, { onSuccess: () => toast('Código creado') })}>
            Nuevo código
          </Button>
        }
      />

      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}

      <section className="panel" aria-labelledby="admin-pending">
        <div className="panel-head">
          <h2 id="admin-pending">Códigos para casas nuevas</h2>
        </div>
        <p className="muted">Cada código sirve una sola vez: quien lo use creará su propia casa, separada de las demás.</p>
        {invites.isSuccess && pending.length === 0 && (
          <EmptyState icon={TicketCheck} title="No hay códigos pendientes">
            <p>Crea uno con «Nuevo código» y pásaselo a quien quiera usar la app.</p>
          </EmptyState>
        )}
        {pending.length > 0 && (
          <ul className="admin-list">
            {pending.map((invite) => (
              <li key={invite.code} className="admin-row">
                <InviteCode code={invite.code} />
                <span className="muted">Creado el {formatDate(invite.createdAt)}</span>
                <IconButton
                  icon={Trash2}
                  tone="danger"
                  label={`Revocar ${formatInviteCode(invite.code)}`}
                  disabled={act.isPending}
                  onClick={() => act.mutate({ type: 'revoke', code: invite.code }, { onSuccess: () => toast('Código revocado') })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {used.length > 0 && (
        <section className="panel" aria-labelledby="admin-used">
          <div className="panel-head">
            <h2 id="admin-used">Códigos usados</h2>
          </div>
          <ul className="admin-list">
            {used.map((invite) => (
              <li key={invite.code} className="admin-row">
                <code className="muted">{formatInviteCode(invite.code)}</code>
                <span>
                  {invite.usedBy ?? 'Usuario eliminado'} · {formatDate(invite.usedAt!)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel" aria-labelledby="admin-households">
        <div className="panel-head">
          <h2 id="admin-households">Casas</h2>
          <span className="muted">{households.data?.length ?? ''}</span>
        </div>
        <ul className="admin-list">
          {(households.data ?? []).map((household) => (
            <li key={household.id} className="admin-row">
              <House aria-hidden size={18} />
              <span className="admin-row-main">
                <strong>{household.name}</strong>
                <span className="muted">{household.members.length ? household.members.join(', ') : 'Sin miembros'}</span>
              </span>
              <span className="muted">{formatDate(household.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
