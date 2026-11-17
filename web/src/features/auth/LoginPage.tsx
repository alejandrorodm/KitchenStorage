import { useState, type FormEvent } from 'react';
import { useLogin } from '../../api/hooks';
import { Button } from '../../components/atoms/Button';
import { Field, TextInput } from '../../components/atoms/Field';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ username: '', password: '', inviteCode: '' });
  const login = useLogin(mode);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate(mode === 'login' ? { username: form.username, password: form.password } : form);
  };

  return (
    <main className="auth">
      <img src="/icon.svg" alt="" width={72} height={72} />
      <h1>Kitchen Storage</h1>
      <form className="form card" onSubmit={submit}>
        <Field label="Username">
          <TextInput autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        </Field>
        <Field label="Password">
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
          <Field label="Household invite code">
            <TextInput value={form.inviteCode} onChange={(e) => setForm({ ...form, inviteCode: e.target.value })} required />
          </Field>
        )}
        {login.error && <p className="error">{login.error.message}</p>}
        <Button variant="primary" type="submit" disabled={login.isPending}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
        <Button variant="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'I already have an account'}
        </Button>
      </form>
    </main>
  );
}
