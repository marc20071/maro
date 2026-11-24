import Link from 'next/link';
import { Code2, GraduationCap, Stethoscope } from 'lucide-react';
import ChatPanel, { type Msg } from '@/components/ChatPanel';
import AdSlot from '@/components/AdSlot';
import { createServerSupabase } from '@/lib/supabase-server';

const LANGS = ['Auto', 'English', 'Kinyarwanda', 'Français', 'Kiswahili'];
const SECTIONS = [{ href: '/coding', label: 'Coding', icon: Code2 }, { href: '/medicine', label: 'Medicine', icon: Stethoscope }, { href: '/learning', label: 'Learning', icon: GraduationCap }];
const ROUTE: Record<string, string> = { general: '/', coding: '/coding', medicine: '/medicine', learning: '/learning' };

export default async function Home({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle() : { data: null };

  let initial: Msg[] = []; let id: string | null = null;
  if (c && user) {
    const { data: conv } = await supabase.from('conversations').select('id').eq('id', c).eq('user_id', user?.id ?? '').eq('mode', 'general').maybeSingle();
    if (conv) { id = conv.id; const { data } = await supabase.from('messages').select('role, content').eq('conversation_id', c).order('created_at'); initial = (data ?? []) as Msg[]; }
  }
  const { data: recent } = user ? await supabase.from('conversations').select('id, title, mode').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(4) : { data: [] };

  return (
    <>
      <ChatPanel key={id ?? 'new'} mode="general" languages={LANGS} initialMessages={initial} conversationId={id}
        placeholder="Ask anything…" allowAttachments={!!user}
        emptyTitle={`Hi ${profile?.display_name ?? 'there'}, what can I help with?`}
        emptyText="Ask anything: write, explain, translate, analyze a screenshot or PDF, plan, or solve a problem."
        starters={['Explain this error from a screenshot', 'Translate to Kinyarwanda: “Good morning, how are you?”', 'Summarize this PDF in 5 bullet points', 'Plan a 3-day study schedule for exams']} />
      <nav aria-label="Specialist sections" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-mute">Specialist modes:</span>
        {SECTIONS.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-ink-600 px-3 text-mute hover:border-saffron hover:text-paper"><Icon size={14} className="text-saffron" />{label}</Link>)}
      </nav>
      {!!recent?.length && !id && (
        <section className="mt-3" aria-label="Recent conversations"><ul className="flex flex-wrap gap-2 text-xs">
          {recent.map((r) => <li key={r.id}><Link href={`${ROUTE[r.mode]}?c=${r.id}`} className="block max-w-[220px] truncate rounded-lg bg-ink-800 px-3 py-2 text-mute hover:text-paper">{r.title}</Link></li>)}
        </ul></section>
      )}
      <AdSlot placement="home-middle" />
    </>
  );
}
