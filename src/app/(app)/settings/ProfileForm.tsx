'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function ProfileForm({ userId, email, initialName }: { userId: string; email: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const { error } = await createClient().from('profiles').update({ display_name: name.trim().slice(0, 60) }).eq('id', userId);
    setMsg(error ? { ok: false, text: 'Could not save your profile.' } : { ok: true, text: 'Profile saved. Your name updates on next page load.' }); setBusy(false);
  }
  return (
    <form onSubmit={save} className="max-w-md space-y-4 rounded-2xl border border-ink-700 bg-ink-800 p-5">
      <label className="block text-sm text-mute">Email<input value={email} disabled className="input mt-1 opacity-60" /></label>
      <label className="block text-sm text-mute">Display name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input mt-1" /></label>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
      <button disabled={busy} className="btn btn-primary">Save changes</button>
    </form>
  );
}
