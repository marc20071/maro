import Shell from '@/components/Shell';
import { createServerSupabase } from '@/lib/supabase-server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from('profiles').select('display_name, is_admin').eq('id', user.id).maybeSingle() : { data: null };
  return <Shell name={profile?.display_name || user?.email?.split('@')[0] || 'Guest'} email={user?.email ?? 'Not signed in'} isAdmin={!!profile?.is_admin}>{children}</Shell>;
}
