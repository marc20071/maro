import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import ProfileForm from './ProfileForm';
export const metadata = { title: 'Settings' };
export default async function Page() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: p } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
  return (<><h1 className="mb-4 text-2xl font-semibold tracking-tight">Settings</h1><ProfileForm userId={user.id} email={user.email ?? ''} initialName={p?.display_name ?? ''} /></>);
}
