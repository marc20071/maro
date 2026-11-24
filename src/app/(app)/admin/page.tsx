import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import AdminDashboard from './AdminDashboard';
export const metadata = { title: 'Admin' };
export default async function Page() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user!.id).maybeSingle();
  if (!me?.is_admin) notFound();
  return <AdminDashboard />;
}
