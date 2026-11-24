import { NextResponse } from 'next/server';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase-server';
async function authorize() { const supabase = await createServerSupabase(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return null; const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(); return data?.is_admin ? user : null; }
export async function GET(req: Request) {
  if (!await authorize()) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Admin service key is not configured.' }, { status: 500 });
  const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, 100) ?? ''; const admin = createAdminSupabase();
  let query = admin.from('profiles').select('id, email, display_name, is_admin, is_suspended, created_at').order('created_at', { ascending: false }).limit(100);
  if (q) query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);
  const { data, error } = await query; if (error) return NextResponse.json({ error: 'Could not load users.' }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}
export async function PATCH(req: Request) {
  const actor = await authorize(); if (!actor) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  let body: { userId?: string; suspended?: boolean }; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!body.userId || typeof body.suspended !== 'boolean' || body.userId === actor.id) return NextResponse.json({ error: 'Invalid account update.' }, { status: 400 });
  const admin = createAdminSupabase(); const { error } = await admin.from('profiles').update({ is_suspended: body.suspended }).eq('id', body.userId);
  if (error) return NextResponse.json({ error: 'Could not update account status.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
