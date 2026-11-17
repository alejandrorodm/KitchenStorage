import { useState, type FormEvent } from 'react';
import { useLogin } from '../../api/hooks';
import { LOCATIONS } from '../../api/types';
import { Button } from '../../components/atoms/Button';
import { Field, TextInput } from '../../components/atoms/Field';
import { LOCATION_ICON } from '../../shared/icons';
import { LOCATION_LABEL } from '../../shared/labels';

type Mode = 'login' | 'register';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ username: '', password: '', inviteCode: '' });
  const login = useLogin(mode);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate(mode === 'login' ? { username: form.username, password: form.password } : form);
  };

  const switchTo = (next: Mode) => {
    setMode(next);
    login.reset();
  };

  return (
    <main className="auth">
      <section className="auth-brand" aria-hidden>
        <img src="/icon.svg" alt="" width={56} height={56} />
        <p className="auth-name">Kitchen Storage</p>
        <p className="auth-tagline">Lo que hay en casa, lo que vais a comer y lo que falta comprar. En todos vuestros dispositivos.</p>
        <ul className="auth-zones">
          {LOCATIONS.map((location) => {
            const Icon = LOCATION_ICON[location];
            return (
              <li key={location} data-zone={location}>
                <Icon size={18} /> {LOCATION_LABEL[location]}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="auth-panel">
        <h1 className="auth-title">{mode === 'login' ? 'Entra en tu cocina' : 'Únete a tu hogar'}</h1>
        <div className="segmented auth-switch" role="tablist" aria-label="Acceso">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={`segment ${mode === 'login' ? 'segment-active' : ''}`} onClick={() => switchTo('login')}>
            Entrar
          </button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={`segment ${mode === 'register' ? 'segment-active' : ''}`} onClick={() => switchTo('register')}>
            Crear cuenta
          </button>
        </div>
        <form className="form" onSubmit={submit}>
          <Field label="Usuario">
            <TextInput autoComplete="username" autoCapitalize="none" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </Field>
          <Field label="Contraseña" hint={mode === 'register' ? 'Mínimo 8 caracteres.' : undefined}>
            <TextInput
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : undefined}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </Field>
          {mode === 'register' && (
            <Field label="Código de invitación" hint="Te lo da quien configuró la app en tu casa.">
              <TextInput value={form.inviteCode} onChange={(e) => setForm({ ...form, inviteCode: e.target.value })} required />
            </Field>
          )}
          {login.error && (
            <p className="error" role="alert">
              {login.error.message}
            </p>
          )}
          <Button variant="primary" type="submit" disabled={login.isPending} className="block">
            {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </Button>
        </form>
      </section>
    </main>
  );
}
