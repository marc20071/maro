import { NextResponse } from 'next/server';
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server';
import { generateStream, AIError } from '@/lib/groq';
import { MODES, systemPrompt, type Mode } from '@/lib/prompts';
import { isAllowedMime, MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, type Attachment } from '@/lib/attachments';

export const runtime = 'nodejs';
export const maxDuration = 90;
const MAX_INPUT = 20_000;
const HISTORY_LIMIT = 30;
const guestHits = new Map<string, number[]>();
type Body = { message?: unknown; mode?: unknown; conversationId?: unknown; regenerate?: unknown; search?: unknown; history?: unknown; attachments?: unknown; options?: { language?: string; level?: string } };
function parseAttachments(raw: unknown): Attachment[] | string {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_FILES) return `You can attach up to ${MAX_FILES} files.`;
  let total = 0; const out: Attachment[] = [];
  for (const a of raw as Partial<Attachment>[]) {
    if (typeof a?.data !== 'string' || typeof a?.mimeType !== 'string' || typeof a?.name !== 'string') return 'Invalid attachment.';
    if (!isAllowedMime(a.mimeType)) return `“${a.name.slice(0, 60)}” is not a supported file type.`;
    const bytes = Math.floor(a.data.length * 0.75); if (bytes > MAX_FILE_BYTES) return `“${a.name.slice(0, 60)}” is larger than 10 MB.`;
    total += bytes; if (!/^[A-Za-z0-9+/=]+$/.test(a.data)) return 'Invalid attachment data.';
    out.push({ name: a.name.slice(0, 120), mimeType: a.mimeType, data: a.data });
  }
  return total > MAX_TOTAL_BYTES ? 'Attachments are too large in total (max 15 MB).' : out;
}
function sse(data: unknown) { return `data: ${JSON.stringify(data)}\n\n`; }
export async function POST(req: Request) {
  let body: Body; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const mode = body.mode as Mode; const regenerate = body.regenerate === true;
  const attachments = parseAttachments(body.attachments);
  if (typeof attachments === 'string') return NextResponse.json({ error: attachments }, { status: 400 });
  if (user) { const { data: profile } = await supabase.from('profiles').select('is_suspended').eq('id', user.id).maybeSingle(); if (profile?.is_suspended) return NextResponse.json({ error: 'This account is currently suspended. Contact support.' }, { status: 403 }); }
  if (!user && attachments.length) return NextResponse.json({ error: 'Sign in to use file attachments.' }, { status: 403 });
  if (!regenerate && !message && !attachments.length) return NextResponse.json({ error: 'Write a message to begin.' }, { status: 400 });
  if (message.length > MAX_INPUT) return NextResponse.json({ error: `Message is too long (max ${MAX_INPUT} characters).` }, { status: 400 });
  if (!MODES.includes(mode)) return NextResponse.json({ error: 'Unknown mode.' }, { status: 400 });
  const rateKey = user ? `user:${user.id}` : `guest:${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'}`;
  const now = Date.now(); const hits = (guestHits.get(rateKey) ?? []).filter((t) => now - t < 60_000);
  const limit = user ? 20 : 12;
  if (hits.length >= limit) return NextResponse.json({ error: user ? 'You are sending messages too quickly. Wait a minute and try again.' : 'Guest limit reached. Please wait a minute or create an account.' }, { status: 429 });
  hits.push(now); guestHits.set(rateKey, hits);
  if (guestHits.size > 5000) for (const [key, values] of guestHits) if (!values.some((t) => now - t < 60_000)) guestHits.delete(key);
  let conversationId = typeof body.conversationId === 'string' ? body.conversationId : null;
  let prior: { role: 'user' | 'assistant'; content: string }[] = [];
  let regenId: string | null = null;
  if (user && conversationId) {
    const { data: conv } = await supabase.from('conversations').select('id').eq('id', conversationId).eq('user_id', user.id).maybeSingle();
    if (!conv) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    const { data } = await supabase.from('messages').select('id, role, content').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(HISTORY_LIMIT);
    const desc = data ?? []; prior = [...desc].reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    if (regenerate) { const last = desc[0]; if (last?.role === 'assistant') { regenId = last.id; prior = prior.slice(0, -1); } if (!prior.length || prior[prior.length - 1].role !== 'user') return NextResponse.json({ error: 'Nothing to regenerate.' }, { status: 400 }); }
  } else if (regenerate && user) return NextResponse.json({ error: 'Nothing to regenerate.' }, { status: 400 });
  if (user && !conversationId) {
    const title = (message || attachments[0]?.name || 'New conversation').replace(/\s+/g, ' ').slice(0, 60);
    const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, mode, title }).select('id').single();
    if (error || !data) return NextResponse.json({ error: 'Could not create conversation.' }, { status: 500 }); conversationId = data.id;
  }
  const stored = attachments.length ? `${message}${message ? '\n\n' : ''}📎 ${attachments.map((a) => a.name).join(', ')}` : message;
  if (!user && Array.isArray(body.history)) prior = body.history.slice(-HISTORY_LIMIT).filter((m): m is { role: 'user' | 'assistant'; content: string } => !!m && typeof m === 'object' && ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'assistant') && typeof (m as { content?: unknown }).content === 'string').map((m) => ({ role: m.role, content: m.content.slice(0, MAX_INPUT) }));
  if (!user && regenerate && prior[prior.length - 1]?.role === 'assistant') prior = prior.slice(0, -1);
  if (!user && regenerate && (!prior.length || prior[prior.length - 1].role !== 'user')) return NextResponse.json({ error: 'Nothing to regenerate.' }, { status: 400 });
  const turns = [...prior, ...(regenerate ? [] : [{ role: 'user' as const, content: message || 'Please analyze the attached file(s).' }])];
  if (user && !regenerate) { const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, user_id: user.id, role: 'user', content: stored }); if (error) return NextResponse.json({ error: 'Could not save your message.' }, { status: 500 }); }
  if (user && regenId) await supabase.from('messages').delete().eq('id', regenId);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    const emit = (v: unknown) => controller.enqueue(encoder.encode(sse(v)));
    (async () => {
      const startedAt = Date.now(); let succeeded = false;
      try {
        emit({ type: 'start', conversationId });
        const { text, sources } = await generateStream(systemPrompt(mode, { language: body.options?.language?.slice(0, 40), level: body.options?.level?.slice(0, 40) }), turns, { attachments, search: body.search === true }, (delta) => emit({ type: 'delta', text: delta }));
        if (user) {
          const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, user_id: user.id, role: 'assistant', content: text });
          if (error) emit({ type: 'warning', message: 'The response was generated but could not be saved to history.' });
          else await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId).eq('user_id', user.id);
        }
        succeeded = true; emit({ type: 'done', sources });
      } catch (e) { const err = e instanceof AIError ? e : new AIError('Something went wrong.'); emit({ type: 'error', error: err.message, status: err.status }); }
      finally { if (process.env.SUPABASE_SERVICE_ROLE_KEY) { try { await createAdminSupabase().from('ai_usage_events').insert({ user_id: user?.id ?? null, mode, is_guest: !user, succeeded, duration_ms: Date.now() - startedAt }); } catch {} } controller.close(); }
    })();
  } });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
