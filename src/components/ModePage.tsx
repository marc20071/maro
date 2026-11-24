import ChatPanel, { type Msg } from './ChatPanel';
import AdSlot from './AdSlot';
import { createServerSupabase } from '@/lib/supabase-server';
import type { Mode } from '@/lib/prompts';

type Props = { mode: Mode; title: string; blurb: string; notice?: React.ReactNode; searchParams: Promise<{ c?: string }> } & Omit<React.ComponentProps<typeof ChatPanel>, 'mode' | 'initialMessages' | 'conversationId'>;

export default async function ModePage({ title, blurb, notice, searchParams, mode, ...chat }: Props) {
  const { c } = await searchParams;
  let initial: Msg[] = []; let id: string | null = null;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (c && user) {
    const { data: conv } = await supabase.from('conversations').select('id').eq('id', c).eq('user_id', user.id).eq('mode', mode).maybeSingle();
    if (conv) {
      id = conv.id;
      const { data } = await supabase.from('messages').select('role, content').eq('conversation_id', c).order('created_at');
      initial = (data ?? []) as Msg[];
    }
  }
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mb-4 mt-1 text-sm text-mute">{blurb}</p>
      {notice}
      <ChatPanel key={id ?? 'new'} mode={mode} initialMessages={initial} conversationId={id} allowAttachments={!!user} {...chat} />
      <AdSlot placement={`${mode}-footer`} />
    </>
  );
}
