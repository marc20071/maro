
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

type Body = {
  message?: unknown;
  mode?: unknown;
  conversationId?: unknown;
  regenerate?: unknown;
  search?: unknown;
  history?: unknown;
  attachments?: unknown;
  options?: {
    language?: string;
    level?: string;
  };
};

function parseAttachments(raw: unknown): Attachment[] | string {
  if (raw == null) return [];

  if (!Array.isArray(raw) || raw.length > MAX_FILES) {
    return `You can attach up to ${MAX_FILES} files.`;
  }

  let total = 0;
  const out: Attachment[] = [];

  for (const a of raw as Partial<Attachment>[]) {
    if (
      typeof a?.data !== 'string' ||
      typeof a?.mimeType !== 'string' ||
      typeof a?.name !== 'string'
    ) {
      return 'Invalid attachment.';
    }

    if (!isAllowedMime(a.mimeType)) {
      return `“${a.name.slice(0, 60)}” is not a supported file type.`;
    }

    const bytes = Math.floor(a.data.length * 0.75);

    if (bytes > MAX_FILE_BYTES) {
      return `“${a.name.slice(0, 60)}” is larger than 10 MB.`;
    }

    total += bytes;

    if (!/^[A-Za-z0-9+/=]+$/.test(a.data)) {
      return 'Invalid attachment data.';
    }

    out.push({
      name: a.name.slice(0, 120),
      mimeType: a.mimeType,
      data: a.data,
    });
  }

  return total > MAX_TOTAL_BYTES
    ? 'Attachments are too large in total (max 15 MB).'
    : out;
}

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Handles questions about MARO AI's identity and creator directly.
 * This avoids relying on the AI model to follow creator-identity instructions.
 */
function getCreatorAnswer(message: string): string | null {
  const text = message
    .toLowerCase()
    .trim()
    .replace(/[’']/g, '')
    .replace(/[?!.,;:]+/g, ' ')
    .replace(/\s+/g, ' ');

  const creatorPatterns = [
    /\bwho (created|made|built|developed|founded|designed) you\b/,
    /\bwho is your (creator|developer|founder|owner|maker)\b/,
    /\bwho created maro\b/,
    /\bwho made maro\b/,
    /\bwho developed maro\b/,
    /\bwho is behind maro\b/,
    /\bwho owns maro\b/,
    /\bwho built maro ai\b/,
    /\bwho is maro ai creator\b/,
    /\bwho is maro ai developer\b/,
    /\bwho made maro ai\b/,
    /\bwho created maro ai\b/,
    /\bwho developed maro ai\b/,
    /\bwho founded maro ai\b/,
    /\bwho is the founder of maro\b/,
    /\bwho is the founder of maro ai\b/,
    /\bwho is the developer of maro\b/,
    /\bwho is the developer of maro ai\b/,
    /\bwho is the creator of maro\b/,
    /\bwho is the creator of maro ai\b/,
    /\bwho is the owner of maro\b/,
    /\bwho is the owner of maro ai\b/,
    /\byour creator\b/,
    /\byour developer\b/,
    /\byour founder\b/,
    /\byour maker\b/,
    /\byour owner\b/,
    /\bare you made by openai\b/,
    /\bare you created by openai\b/,
    /\bare you developed by openai\b/,
    /\bare you chatgpt\b/,
    /\bare you an openai product\b/,
    /\bwas maro made by openai\b/,
    /\bwas maro created by openai\b/,
    /\bwas maro developed by openai\b/,
    /\bmaro vs chatgpt\b/,
    /\bmaro ai vs chatgpt\b/,
    /\bwhat company created you\b/,
    /\bwhat company made you\b/,
    /\bwhat company developed you\b/,
    /\bwhat organization created you\b/,
    /\bwhat organization made you\b/,
    /\bwhat organization developed you\b/,
    /\bwho do you belong to\b/,
    /\bwho do you work for\b/,
    /\bwho are you owned by\b/,
    /\bwho are you made by\b/,
    /\bwho are you created by\b/,
    /\bwho are you developed by\b/,
    /\bwhat is your origin\b/,
    /\bwhat is maro ai\b/,
    /\bwhat is maro\b/,
    /\btell me about maro ai\b/,
    /\btell me about maro\b/,
    /\bintroduce yourself\b/,
    /\bwhat ai are you\b/,
    /\bwhich ai are you\b/,
    /\bwhat model are you\b/,
    /\bwhich model are you\b/,
    /\bwhat is your identity\b/,
    /\bwho are you\b/,
    /\bwhat are you\b/,
    /\bwho made this ai\b/,
    /\bwho created this ai\b/,
    /\bwho developed this ai\b/,
    /\bwho made this application\b/,
    /\bwho created this application\b/,
    /\bwho developed this application\b/,
    /\bwho made this app\b/,
    /\bwho created this app\b/,
    /\bwho developed this app\b/,
    /\bwho made this chatbot\b/,
    /\bwho created this chatbot\b/,
    /\bwho developed this chatbot\b/,
  ];

  const kinyarwandaPatterns = [
    /\bwagukora nde\b/,
    /\bwaguhanga nde\b/,
    /\buwagukoze ni nde\b/,
    /\buwaguhimbye ni nde\b/,
    /\bmaro yakozwe na nde\b/,
    /\bmaro ai yakozwe na nde\b/,
    /\bmaro yahanzwe na nde\b/,
    /\bmaro ai yahanzwe na nde\b/,
    /\bmaro yateguwe na nde\b/,
    /\bmaro ai yateguwe na nde\b/,
    /\buri nde\b/,
  ];

  const frenchPatterns = [
    /\bqui ta cree\b/,
    /\bqui ta developpe\b/,
    /\bqui a cree maro\b/,
    /\bqui a cree maro ai\b/,
    /\bqui a developpe maro\b/,
    /\bqui a developpe maro ai\b/,
    /\bqui est ton createur\b/,
    /\bqui est ton developpeur\b/,
    /\bqui est le createur de maro\b/,
    /\bqui est le createur de maro ai\b/,
    /\bqui est le developpeur de maro\b/,
    /\bqui est le developpeur de maro ai\b/,
    /\btu es chatgpt\b/,
    /\btu es une ia de openai\b/,
    /\btu es une intelligence artificielle de openai\b/,
    /\bpresente toi\b/,
    /\bqui es tu\b/,
    /\bquest ce que maro\b/,
    /\bquest ce que maro ai\b/,
  ];

  const swahiliPatterns = [
    /\bni nani aliyekutengeneza\b/,
    /\bni nani aliyekuunda\b/,
    /\bni nani aliyekuumba\b/,
    /\bmaro imetengenezwa na nani\b/,
    /\bmaro ai imetengenezwa na nani\b/,
    /\bmaro iliundwa na nani\b/,
    /\bmaro ai iliundwa na nani\b/,
    /\bwewe ni nani\b/,
  ];

  const allPatterns = [
    ...creatorPatterns,
    ...kinyarwandaPatterns,
    ...frenchPatterns,
    ...swahiliPatterns,
  ];

  if (!allPatterns.some((pattern) => pattern.test(text))) {
    return null;
  }

  // Respond in the language of the question where recognizable.
  if (
    kinyarwandaPatterns.some((pattern) => pattern.test(text))
  ) {
    return 'Ndi MARO AI, umufasha w’ubwenge buhangano (AI) wakozwe kandi utegurwa na GISUBIZO Marc. MARO AI si ChatGPT kandi si igicuruzwa cya OpenAI.';
  }

  if (
    frenchPatterns.some((pattern) => pattern.test(text))
  ) {
    return 'Je suis MARO AI, un assistant d’intelligence artificielle créé et développé par GISUBIZO Marc. MARO AI n’est pas ChatGPT et n’est pas un produit d’OpenAI.';
  }

  if (
    swahiliPatterns.some((pattern) => pattern.test(text))
  ) {
    return 'Mimi ni MARO AI, msaidizi wa akili bandia aliyeundwa na kuendelezwa na GISUBIZO Marc. MARO AI si ChatGPT wala bidhaa ya OpenAI.';
  }

  return 'I am MARO AI, an AI assistant created and developed by GISUBIZO Marc. I am not ChatGPT and I am not an OpenAI product. MARO AI is its own AI application.';
}

export async function POST(req: Request) {
  let body: Body;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request.' },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const message =
    typeof body.message === 'string'
      ? body.message.trim()
      : '';

  const mode = body.mode as Mode;
  const regenerate = body.regenerate === true;

  const attachments = parseAttachments(body.attachments);

  if (typeof attachments === 'string') {
    return NextResponse.json(
      { error: attachments },
      { status: 400 },
    );
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_suspended')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.is_suspended) {
      return NextResponse.json(
        {
          error:
            'This account is currently suspended. Contact support.',
        },
        { status: 403 },
      );
    }
  }

  if (!user && attachments.length) {
    return NextResponse.json(
      { error: 'Sign in to use file attachments.' },
      { status: 403 },
    );
  }

  if (!regenerate && !message && !attachments.length) {
    return NextResponse.json(
      { error: 'Write a message to begin.' },
      { status: 400 },
    );
  }

  if (message.length > MAX_INPUT) {
    return NextResponse.json(
      {
        error: `Message is too long (max ${MAX_INPUT} characters).`,
      },
      { status: 400 },
    );
  }

  if (!MODES.includes(mode)) {
    return NextResponse.json(
      { error: 'Unknown mode.' },
      { status: 400 },
    );
  }

  const rateKey = user
    ? `user:${user.id}`
    : `guest:${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'}`;

  const now = Date.now();

  const hits = (guestHits.get(rateKey) ?? []).filter(
    (t) => now - t < 60_000,
  );

  const limit = user ? 20 : 12;

  if (hits.length >= limit) {
    return NextResponse.json(
      {
        error: user
          ? 'You are sending messages too quickly. Wait a minute and try again.'
          : 'Guest limit reached. Please wait a minute or create an account.',
      },
      { status: 429 },
    );
  }

  hits.push(now);
  guestHits.set(rateKey, hits);

  if (guestHits.size > 5000) {
    for (const [key, values] of guestHits) {
      if (!values.some((t) => now - t < 60_000)) {
        guestHits.delete(key);
      }
    }
  }

  let conversationId =
    typeof body.conversationId === 'string'
      ? body.conversationId
      : null;

  let prior: {
    role: 'user' | 'assistant';
    content: string;
  }[] = [];

  let regenId: string | null = null;

  if (user && conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!conv) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 },
      );
    }

    const { data } = await supabase
      .from('messages')
      .select('id, role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);

    const desc = data ?? [];

    prior = [...desc]
      .reverse()
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    if (regenerate) {
      const last = desc[0];

      if (last?.role === 'assistant') {
        regenId = last.id;
        prior = prior.slice(0, -1);
      }

      if (
        !prior.length ||
        prior[prior.length - 1].role !== 'user'
      ) {
        return NextResponse.json(
          { error: 'Nothing to regenerate.' },
          { status: 400 },
        );
      }
    }
  } else if (regenerate && user) {
    return NextResponse.json(
      { error: 'Nothing to regenerate.' },
      { status: 400 },
    );
  }

  if (user && !conversationId) {
    const title = (
      message ||
      attachments[0]?.name ||
      'New conversation'
    )
      .replace(/\s+/g, ' ')
      .slice(0, 60);

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        mode,
        title,
      })
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Could not create conversation.' },
        { status: 500 },
      );
    }

    conversationId = data.id;
  }

  const stored = attachments.length
    ? `${message}${message ? '\n\n' : ''}📎 ${attachments.map((a) => a.name).join(', ')}`
    : message;

  if (!user && Array.isArray(body.history)) {
    prior = body.history
      .slice(-HISTORY_LIMIT)
      .filter(
        (
          m,
        ): m is {
          role: 'user' | 'assistant';
          content: string;
        } =>
          !!m &&
          typeof m === 'object' &&
          (
            (m as { role?: unknown }).role === 'user' ||
            (m as { role?: unknown }).role === 'assistant'
          ) &&
          typeof (m as { content?: unknown }).content === 'string',
      )
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, MAX_INPUT),
      }));
  }

  if (
    !user &&
    regenerate &&
    prior[prior.length - 1]?.role === 'assistant'
  ) {
    prior = prior.slice(0, -1);
  }

  if (
    !user &&
    regenerate &&
    (!prior.length || prior[prior.length - 1].role !== 'user')
  ) {
    return NextResponse.json(
      { error: 'Nothing to regenerate.' },
      { status: 400 },
    );
  }

  const turns = [
    ...prior,
    ...(regenerate
      ? []
      : [
          {
            role: 'user' as const,
            content: message || 'Please analyze the attached file(s).',
          },
        ]),
  ];

  if (user && !regenerate) {
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: stored,
      });

    if (error) {
      return NextResponse.json(
        { error: 'Could not save your message.' },
        { status: 500 },
      );
    }
  }

  if (user && regenId) {
    await supabase
      .from('messages')
      .delete()
      .eq('id', regenId);
  }

  // Detect identity questions before calling the AI provider.
  // This is only used for ordinary user messages, not regeneration.
  const creatorAnswer =
    !regenerate && !attachments.length
      ? getCreatorAnswer(message)
      : null;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (v: unknown) => {
        controller.enqueue(
          encoder.encode(sse(v)),
        );
      };

      (async () => {
        const startedAt = Date.now();
        let succeeded = false;

        try {
          emit({
            type: 'start',
            conversationId,
          });

          let text: string;
          let sources: unknown[] = [];

          if (creatorAnswer) {
            // Return the fixed identity answer directly.
            text = creatorAnswer;
            emit({
              type: 'delta',
              text,
            });
          } else {
            // Normal MARO AI generation.
            const result = await generateStream(
              systemPrompt(mode, {
                language: body.options?.language?.slice(0, 40),
                level: body.options?.level?.slice(0, 40),
              }),
              turns,
              {
                attachments,
                search: body.search === true,
              },
              (delta) =>
                emit({
                  type: 'delta',
                  text: delta,
                }),
            );

            text = result.text;
            sources = result.sources;
          }

          if (user) {
            const { error } = await supabase
              .from('messages')
              .insert({
                conversation_id: conversationId,
                user_id: user.id,
                role: 'assistant',
                content: text,
              });

            if (error) {
              emit({
                type: 'warning',
                message:
                  'The response was generated but could not be saved to history.',
              });
            } else {
              await supabase
                .from('conversations')
                .update({
                  updated_at: new Date().toISOString(),
                })
                .eq('id', conversationId)
                .eq('user_id', user.id);
            }
          }

          succeeded = true;

          emit({
            type: 'done',
            sources,
          });
        } catch (e) {
          const err =
            e instanceof AIError
              ? e
              : new AIError('Something went wrong.');

          emit({
            type: 'error',
            error: err.message,
            status: err.status,
          });
        } finally {
          if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            try {
              await createAdminSupabase()
                .from('ai_usage_events')
                .insert({
                  user_id: user?.id ?? null,
                  mode,
                  is_guest: !user,
                  succeeded,
                  duration_ms: Date.now() - startedAt,
                });
            } catch {}
          }

          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
