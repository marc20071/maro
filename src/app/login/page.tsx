'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase-browser';

type View = 'signin' | 'signup' | 'reset';

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('signin');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const supabase = createClient();
    try {
      if (view === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/'); router.refresh();
      } else if (view === 'signup') {
        if (!name.trim()) throw new Error('Enter your full name.');
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() } } });
        if (error) throw error;
        if (!data.session) throw new Error('Account created, but email confirmation is still enabled in Supabase. Turn it off (Authentication → Providers → Email) or confirm via the email we sent.');
        router.replace('/'); router.refresh();
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || location.origin}/auth/update-password` });
        if (error) throw error;
        setMsg({ ok: true, text: 'If an account exists for that email, a reset link is on its way.' });
      }
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong.' }); }
    setBusy(false);
  }
  const title = { signin: 'Sign in', signup: 'Create your account', reset: 'Reset your password' }[view];
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Logo size={44} /></div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-800 p-5">
          <h1 className="text-xl font-semibold">{title}</h1>
          {view === 'signup' && <label className="block text-sm text-mute">Full name<input type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" /></label>}
          <label className="block text-sm text-mute">Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1" /></label>
          {view !== 'reset' && <label className="block text-sm text-mute">Password<input type="password" required autoComplete={view === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-1" /></label>}
          {msg && <p role="alert" className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
          <button disabled={busy} className="btn btn-primary w-full">{busy ? 'Please wait…' : view === 'signin' ? 'Sign in' : view === 'signup' ? 'Create account' : 'Send reset link'}</button>
          <div className="flex justify-between text-sm text-mute">
            {view === 'signin' ? <><button type="button" onClick={() => { setView('signup'); setMsg(null); }} className="hover:text-paper">Create account</button><button type="button" onClick={() => { setView('reset'); setMsg(null); }} className="hover:text-paper">Forgot password?</button></>
              : <button type="button" onClick={() => { setView('signin'); setMsg(null); }} className="hover:text-paper">Back to sign in</button>}
          </div>
          <p className="text-center text-xs text-mute"><a href="/admin-login" className="hover:text-saffron">Administrator sign in</a></p>
        </form>
      </div>
    </main>
  );
}
