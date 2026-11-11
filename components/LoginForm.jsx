'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter();
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json().catch(()=>({})); setBusy(false);
      if (!response.ok) return setError(data.error || 'Login failed.');
      router.replace('/editor'); router.refresh();
    } catch { setBusy(false); setError('Login failed. Please try again.'); }
  }
  return <main className="login-shell"><form className="login-card" onSubmit={submit}>
    <div className="login-mark">LM</div><p className="eyebrow">PRIVATE STUDIO</p><h1>Website editor</h1><p>Sign in to edit Leah’s portfolio and publish updates.</p>
    <label>Password<input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
    {error && <p className="form-error" role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Signing in…' : 'Open editor'}</button>
  </form></main>;
}
