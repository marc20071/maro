import { NextResponse } from 'next/server';
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server';
import { MODES } from '@/lib/prompts';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, { status: 500 });

  const admin = createAdminSupabase();
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  async function count(table: string, filter?: { col: string; op: 'gte' | 'eq'; val: string }) {
    let q = admin.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = filter.op === 'gte' ? q.gte(filter.col, filter.val) : q.eq(filter.col, filter.val);
    const { count: c } = await q;
    return c ?? 0;
  }
  const [users, activeUsers, conversations, messages, convWeek, newUsersWeek, aiRequests, aiRequestsWeek, ...perMode] = await Promise.all([
    count('profiles'), count('profiles', { col: 'is_suspended', op: 'eq', val: 'false' }), count('conversations'), count('messages'),
    count('conversations', { col: 'created_at', op: 'gte', val: since }),
    count('profiles', { col: 'created_at', op: 'gte', val: since }),
    count('ai_usage_events'), count('ai_usage_events', { col: 'created_at', op: 'gte', val: since }),
    ...MODES.map((m) => count('conversations', { col: 'mode', op: 'eq', val: m })),
  ]);
  const { data: recent } = await admin.from('profiles').select('id, email, display_name, is_admin, created_at').order('created_at', { ascending: false }).limit(10);
  return NextResponse.json({
    users, activeUsers, aiRequests, aiRequestsLast7Days: aiRequestsWeek, conversations, messages, conversationsLast7Days: convWeek, newUsersLast7Days: newUsersWeek,
    byMode: Object.fromEntries(MODES.map((m, i) => [m, perMode[i]])), recentUsers: recent ?? [],
  });
}
