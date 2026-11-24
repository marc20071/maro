'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FolderPlus, Pencil, Pin, PinOff, Search, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';

type Row = { id: string; title: string; mode: string; updated_at: string; pinned: boolean; folder_id: string | null };
type Folder = { id: string; name: string };
const ROUTE: Record<string, string> = { general: '/', coding: '/coding', medicine: '/medicine', learning: '/learning' };
const MODE_LABEL: Record<string, string> = { general: 'Assistant', coding: 'Coding', medicine: 'Medicine', learning: 'Learning' };

export default function HistoryList({ initial, initialFolders }: { initial: Row[]; initialFolders: Folder[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(initial);
  const [folders, setFolders] = useState(initialFolders);
  const [q, setQ] = useState(''); const [mode, setMode] = useState('all'); const [folder, setFolder] = useState('all'); const [sort, setSort] = useState('recent');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const fail = (m: string) => setError(m);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (mode === 'all' || r.mode === mode) && (folder === 'all' || (folder === 'none' ? !r.folder_id : r.folder_id === folder)) && (!s || r.title.toLowerCase().includes(s)))
      .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (sort === 'title' ? a.title.localeCompare(b.title) : sort === 'oldest' ? +new Date(a.updated_at) - +new Date(b.updated_at) : +new Date(b.updated_at) - +new Date(a.updated_at)));
  }, [rows, q, mode, folder, sort]);

  async function patch(id: string, change: Partial<Row>, okMsg?: string) {
    setError(null);
    const { error } = await supabase.from('conversations').update(change).eq('id', id);
    if (error) return fail('That change could not be saved. Try again.');
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...change } : x))); void okMsg;
  }
  async function saveTitle() {
    if (!editing) return; const t = editing.title.trim().slice(0, 120);
    if (!t) return setEditing(null);
    await patch(editing.id, { title: t }); setEditing(null);
  }
  async function remove(r: Row) {
    if (!confirm(`Delete “${r.title}”? This cannot be undone.`)) return;
    const { error } = await supabase.from('conversations').delete().eq('id', r.id);
    if (error) fail('Could not delete the conversation.'); else setRows((x) => x.filter((y) => y.id !== r.id));
  }
  async function newFolder() {
    const name = prompt('Folder name')?.trim().slice(0, 60); if (!name) return;
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return fail('Your session expired. Sign in again.');
    const { data, error } = await supabase.from('folders').insert({ name, user_id: user.id }).select('id, name').single();
    if (error || !data) return fail('Could not create the folder.'); setFolders((f) => [...f, data]);
  }
  const current = folders.find((f) => f.id === folder);
  async function renameFolder() {
    if (!current) return; const name = prompt('New folder name', current.name)?.trim().slice(0, 60); if (!name) return;
    const { error } = await supabase.from('folders').update({ name }).eq('id', current.id);
    if (error) return fail('Could not rename the folder.'); setFolders((f) => f.map((x) => (x.id === current.id ? { ...x, name } : x)));
  }
  async function deleteFolder() {
    if (!current || !confirm(`Delete folder “${current.name}”? Its conversations are kept and moved to “No folder”.`)) return;
    const { error } = await supabase.from('folders').delete().eq('id', current.id);
    if (error) return fail('Could not delete the folder.');
    setFolders((f) => f.filter((x) => x.id !== current.id)); setRows((r) => r.map((x) => (x.folder_id === current.id ? { ...x, folder_id: null } : x))); setFolder('all');
  }

  return (
    <>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative block"><span className="sr-only">Search conversations by title</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…" className="input !pl-9" /></label>
        <select aria-label="Filter by module" value={mode} onChange={(e) => setMode(e.target.value)} className="input !w-auto"><option value="all">All modules</option>{Object.entries(MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Filter by folder" value={folder} onChange={(e) => setFolder(e.target.value)} className="input !w-auto"><option value="all">All folders</option><option value="none">No folder</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="input !w-auto"><option value="recent">Most recent</option><option value="oldest">Oldest</option><option value="title">Title A–Z</option></select>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={newFolder} className="btn btn-ghost !min-h-[40px]"><FolderPlus size={16} /> New folder</button>
        {current && <><button onClick={renameFolder} className="btn btn-ghost !min-h-[40px]"><Pencil size={16} /> Rename folder</button><button onClick={deleteFolder} className="btn btn-ghost !min-h-[40px]"><Trash2 size={16} /> Delete folder</button></>}
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
      {!shown.length ? <p className="rounded-2xl border border-dashed border-ink-600 p-8 text-center text-sm text-mute">{rows.length ? 'No conversations match your filters.' : 'No conversations yet. Start one from Home, Coding, Medicine or Learning.'}</p> : (
        <ul className="space-y-2">{shown.map((r) => (
          <li key={r.id} className="rounded-xl border border-ink-700 bg-ink-800 p-1 pr-2">
            <div className="flex items-center gap-1">
              {editing?.id === r.id ? (
                <input autoFocus value={editing.title} onChange={(e) => setEditing({ id: r.id, title: e.target.value })} onBlur={saveTitle} onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditing(null); }} aria-label="Conversation title" className="input m-1 flex-1" />
              ) : (
                <Link href={`${ROUTE[r.mode] ?? '/'}?c=${r.id}`} className="min-w-0 flex-1 px-3 py-2.5"><p className="truncate text-sm">{r.pinned && <Pin size={12} className="mr-1 inline text-saffron" />}{r.title}</p>
                  <p className="text-xs text-mute">{MODE_LABEL[r.mode] ?? r.mode} · {new Date(r.updated_at).toLocaleString()}{r.folder_id && ` · ${folders.find((f) => f.id === r.folder_id)?.name ?? ''}`}</p></Link>
              )}
              <select aria-label={`Move “${r.title}” to folder`} value={r.folder_id ?? ''} onChange={(e) => patch(r.id, { folder_id: e.target.value || null })} className="hidden h-9 max-w-[130px] rounded-lg border border-ink-600 bg-ink-900 px-2 text-xs sm:block"><option value="">No folder</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
              <button onClick={() => patch(r.id, { pinned: !r.pinned })} aria-label={r.pinned ? 'Unpin' : 'Pin'} className="grid h-10 w-10 place-items-center text-mute hover:text-saffron">{r.pinned ? <PinOff size={17} /> : <Pin size={17} />}</button>
              <button onClick={() => setEditing({ id: r.id, title: r.title })} aria-label="Rename" className="grid h-10 w-10 place-items-center text-mute hover:text-paper"><Pencil size={17} /></button>
              <button onClick={() => remove(r)} aria-label="Delete" className="grid h-10 w-10 place-items-center text-mute hover:text-red-300"><Trash2 size={17} /></button>
            </div>
            <select aria-label={`Move “${r.title}” to folder`} value={r.folder_id ?? ''} onChange={(e) => patch(r.id, { folder_id: e.target.value || null })} className="m-1 h-9 w-[calc(100%-8px)] rounded-lg border border-ink-600 bg-ink-900 px-2 text-xs sm:hidden"><option value="">No folder</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          </li>))}
        </ul>)}
    </>
  );
}
