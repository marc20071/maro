import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import HistoryList from './HistoryList';
export const metadata = { title: 'Chat history' };
export default async function Page() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [convs, folders] = await Promise.all([
    supabase.from('conversations').select('id, title, mode, updated_at, pinned, folder_id').order('updated_at', { ascending: false }).limit(300),
    supabase.from('folders').select('id, name').order('created_at'),
  ]);
  const needsMigration = !!convs.error || !!folders.error;
  return (<><h1 className="text-2xl font-semibold tracking-tight">Chat history</h1><p className="mb-4 mt-1 text-sm text-mute">Only you can see these conversations. Showing your 300 most recent.</p>
    {needsMigration ? <p role="alert" className="text-sm text-red-300">History could not be loaded. If you just upgraded, run supabase/migrations/002_history.sql in Supabase.</p>
      : <HistoryList initial={convs.data ?? []} initialFolders={folders.data ?? []} />}</>);
}
