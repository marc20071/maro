'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase-browser';

export default function UpdatePassword() {
  const router = useRouter();
  const [password, setPassword] = useState(''); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (password.length < 8) return setMsg('Use a password with at least 8 characters.');
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) { setMsg(error.message); setBusy(false); } else { router.replace('/'); router.refresh(); }
  }
  return (
    <main className="grid min-h-dvh place-items-center p-4"><div className="w-full max-w-sm"><div className="mb-6 flex justify-center"><Logo size={44} /></div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-800 p-5">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <p className="text-xs text-mute">Open this page from the link in your reset email.</p>
        <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" aria-label="New password" />
        {msg && <p role="alert" className="text-sm text-red-300">{msg}</p>}
        <button disabled={busy} className="btn btn-primary w-full">Save password</button>
      </form></div></main>
  );
}
