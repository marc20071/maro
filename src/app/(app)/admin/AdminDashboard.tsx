'use client';
import { useEffect, useState } from 'react';

type Stats = { users: number; activeUsers: number; aiRequests: number; aiRequestsLast7Days: number; conversations: number; messages: number; conversationsLast7Days: number; newUsersLast7Days: number; byMode: Record<string, number>;
  recentUsers: { id: string; email: string; display_name: string; is_admin: boolean; created_at: string }[] };
const SLOTS = [{ id: 'home-middle', where: 'Home, between the chat and recent conversations' }, { id: 'coding-footer', where: 'Coding, below the chat' }, { id: 'medicine-footer', where: 'Medicine, below the chat' }, { id: 'learning-footer', where: 'Learning, below the chat' }];

type UserRow = { id: string; email: string; display_name: string; is_admin: boolean; is_suspended: boolean; created_at: string };
export default function AdminDashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]); const [query, setQuery] = useState(''); const [userErr, setUserErr] = useState(''); const [busyId, setBusyId] = useState<string | null>(null);
  async function loadUsers(q = query) { const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not load users'); setUsers(d.users); }
  async function toggleUser(u: UserRow) { setBusyId(u.id); setUserErr(''); try { const r = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id, suspended: !u.is_suspended }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); await loadUsers(); } catch (e) { setUserErr(e instanceof Error ? e.message : 'Update failed'); } finally { setBusyId(null); } }
  useEffect(() => { fetch('/api/admin/stats').then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setS(d); }).catch((e: Error) => setErr(e.message)); loadUsers('').catch((e: Error) => setUserErr(e.message)); }, []);
  if (err) return <p role="alert" className="text-red-300">{err}</p>;
  if (!s) return <p className="text-mute">Loading…</p>;
  const tiles = [['Registered users', s.users], ['Active accounts', s.activeUsers], ['AI requests', s.aiRequests], ['AI requests (7 days)', s.aiRequestsLast7Days], ['New users (7 days)', s.newUsersLast7Days], ['Conversations', s.conversations], ['Conversations (7 days)', s.conversationsLast7Days], ['Messages', s.messages]];
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Admin</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{tiles.map(([l, v]) => <div key={l} className="rounded-2xl border border-ink-700 bg-ink-800 p-4"><p className="text-2xl font-semibold">{v}</p><p className="text-xs text-mute">{l}</p></div>)}</div>
      <h2 className="mb-2 mt-6 font-semibold">Usage by section</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(s.byMode).map(([m, n]) => <div key={m} className="rounded-xl border border-ink-700 p-3 text-sm"><span className="capitalize text-mute">{m}</span><p className="text-lg font-semibold">{n}</p></div>)}</div>
      <h2 className="mb-2 mt-6 font-semibold">Newest users</h2>
      <div className="overflow-x-auto rounded-xl border border-ink-700"><table className="w-full text-left text-sm"><thead className="text-mute"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Joined</th><th className="p-3">Role</th></tr></thead>
        <tbody>{s.recentUsers.map((u) => <tr key={u.id} className="border-t border-ink-700"><td className="p-3">{u.display_name}</td><td className="p-3">{u.email}</td><td className="p-3">{new Date(u.created_at).toLocaleDateString()}</td><td className="p-3">{u.is_admin ? 'Admin' : 'User'}</td></tr>)}</tbody></table></div>

      <h2 className="mb-2 mt-6 font-semibold">User monitoring</h2>
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); loadUsers().catch((x: Error) => setUserErr(x.message)); }}><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or email" className="input"/><button className="btn btn-secondary">Search</button></form>
      {userErr && <p role="alert" className="mb-2 text-sm text-red-300">{userErr}</p>}
      <div className="overflow-x-auto rounded-xl border border-ink-700"><table className="w-full text-left text-sm"><thead className="text-mute"><tr><th className="p-3">User</th><th className="p-3">Joined</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{users.map(u => <tr key={u.id} className="border-t border-ink-700"><td className="p-3"><div>{u.display_name || 'Unnamed'}</div><div className="text-xs text-mute">{u.email}</div></td><td className="p-3">{new Date(u.created_at).toLocaleDateString()}</td><td className="p-3">{u.is_admin ? 'Admin' : u.is_suspended ? 'Suspended' : 'Active'}</td><td className="p-3">{!u.is_admin && <button disabled={busyId === u.id} onClick={() => toggleUser(u)} className="rounded-lg border border-ink-600 px-2 py-1 text-xs hover:bg-ink-700 disabled:opacity-50">{busyId === u.id ? 'Saving…' : u.is_suspended ? 'Restore' : 'Suspend'}</button>}</td></tr>)}</tbody></table></div>
      <h2 className="mb-2 mt-6 font-semibold">Ad placements</h2>
      <p className="mb-2 text-sm text-mute">Slots are reserved in the layout and stay hidden until <code className="font-mono">NEXT_PUBLIC_ADS_ENABLED=true</code> and an ad network script is added.</p>
      <ul className="space-y-2">{SLOTS.map((x) => <li key={x.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-ink-700 p-3 text-sm"><span><code className="font-mono">{x.id}</code> · {x.where}</span><span className="text-mute">Not connected</span></li>)}</ul>
    </>
  );
}
