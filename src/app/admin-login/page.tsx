'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase-browser';
export default function AdminLogin() {
  const router = useRouter(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); const client = createClient();
    const { data, error: authError } = await client.auth.signInWithPassword({ email, password });
    if (authError || !data.user) { setError(authError?.message || 'Sign in failed.'); setBusy(false); return; }
    const { data: profile, error: profileError } = await client.from('profiles').select('is_admin').eq('id', data.user.id).maybeSingle();
    if (profileError || !profile?.is_admin) { await client.auth.signOut(); setError('This account does not have administrator access.'); setBusy(false); return; }
    router.replace('/admin'); router.refresh();
  }
  return <main className="grid min-h-dvh place-items-center p-4"><form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-ink-700 bg-ink-800 p-6"><div className="flex justify-center"><Logo size={42} /></div><h1 className="text-center text-xl font-semibold">Administrator sign in</h1><label className="block text-sm text-mute">Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="input mt-1" /></label><label className="block text-sm text-mute">Password<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} className="input mt-1" /></label>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}<button disabled={busy} className="btn btn-primary w-full">{busy ? 'Checking access…' : 'Sign in as administrator'}</button></form></main>;
}
