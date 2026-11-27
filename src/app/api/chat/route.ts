
import { NextResponse } from 'next/server';
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server';
import { generateStream, AIError } from '@/lib/groq';
import { MODES, systemPrompt, type Mode } from '@/lib/prompts';
import {
  isAllowedMime,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  type Attachment,
} from '@/lib/attachments';

export const runtime = 'nodejs';
export const maxDuration = 90;

const MAX_INPUT = 20_000;
const HISTORY_LIMIT = 30;
const guestHits = new Map<string, number[]>();

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type Body = {
  message?: unknown;
  mode?: unknown;
  conversationId?: unknown;
  regenerate?: unknown;
  search?: unknown;
  history?: unknown;
  attachments?: unknown;
  options?: {
    language?: unknown;
    level?: unknown;
  };
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[?!.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Prevent known external AI brands and company names from appearing
 * in MARO's generated responses.
 */
function removeExternalAIReferences(value: string): string {
  return value.replace(
    /\b(?:chat\s*gpt|chatgpt|open\s*ai|openai|gpt[- ]?\d+(?:\.\d+)?|claude|anthropic|gemini|google\s*gemini|copilot|microsoft\s*copilot|deepseek|deep\s*seek|grok|perplexity|meta\s*ai|llama(?:\s*\d+)?|mistral\s*ai|mistral)\b/gi,
    'another AI service',
  );
}

function parseAttachments(raw: unknown): Attachment[] | string {
  if (raw == null) return [];

  if (!Array.isArray(raw) || raw.length > MAX_FILES) {
    return `You can attach up to ${MAX_FILES} files.`;
  }

  let total = 0;
  const out: Attachment[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return 'Invalid attachment.';
    }

    const a = item as Partial<Attachment>;

    if (
      typeof a.data !== 'string' ||
      typeof a.mimeType !== 'string' ||
      typeof a.name !== 'string'
    ) {
      return 'Invalid attachment.';
    }

    if (!isAllowedMime(a.mimeType)) {
      return `“${a.name.slice(0, 60)}” is not a supported file type.`;
    }

    if (
      !a.data ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(a.data) ||
      a.data.length % 4 !== 0
    ) {
      return 'Invalid attachment data.';
    }

    const padding = a.data.endsWith('==')
      ? 2
      : a.data.endsWith('=')
        ? 1
        : 0;

    const bytes = (a.data.length / 4) * 3 - padding;

    if (bytes > MAX_FILE_BYTES) {
      return `“${a.name.slice(0, 60)}” is larger than 10 MB.`;
    }

    total += bytes;

    if (total > MAX_TOTAL_BYTES) {
      return 'Attachments are too large in total (max 15 MB).';
    }

    out.push({
      name: a.name.slice(0, 120),
      mimeType: a.mimeType,
      data: a.data,
    });
  }

  return out;
}

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function safeOption(value: unknown): string | undefined {
  return typeof value === 'string'
    ? value.slice(0, 40)
    : undefined;
}

function validateHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .slice(-HISTORY_LIMIT)
    .filter((item): item is ChatMessage => {
      if (!item || typeof item !== 'object') return false;

      const value = item as {
        role?: unknown;
        content?: unknown;
      };

      return (
        (value.role === 'user' || value.role === 'assistant') &&
        typeof value.content === 'string'
      );
    })
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, MAX_INPUT),
    }));
}

/**
 * Respond to identity questions without calling the AI model.
 * This guarantees that creator answers are consistent.
 */
function getCreatorAnswer(message: string): string | null {
  const text = normalizeText(message);

  const patterns = [
    // English
    /\bwho (created|made|built|developed|founded|designed) you\b/,
    /\bwho is your (creator|developer|founder|owner|maker)\b/,
    /\bwho (created|made|built|developed|founded) maro\b/,
    /\bwho (created|made|built|developed|founded) maro ai\b/,
    /\bwho is behind maro\b/,
    /\bwho is behind maro ai\b/,
    /\bwho is the (creator|developer|founder|owner) of maro\b/,
    /\bwho is the (creator|developer|founder|owner) of maro ai\b/,
    /\bwho created this ai\b/,
    /\bwho made this ai\b/,
    /\bwho developed this ai\b/,
    /\bwho created this app\b/,
    /\bwho made this app\b/,
    /\bwho developed this app\b/,
    /\bwho created this chatbot\b/,
    /\bwho made this chatbot\b/,
    /\bwho developed this chatbot\b/,
    /\bwho created this application\b/,
    /\bwho developed this application\b/,
    /\bwho made this application\b/,
    /\bwhat company created you\b/,
    /\bwhat company made you\b/,
    /\bwhat company developed you\b/,
    /\bwhat organization created you\b/,
    /\bwhat organization made you\b/,
    /\bwhat organization developed you\b/,
    /\bwho owns maro\b/,
    /\bwho owns maro ai\b/,
    /\bwho owns you\b/,
    /\bwho is your maker\b/,
    /\bwho is your founder\b/,
    /\bwho is your developer\b/,
    /\bwho is your creator\b/,
    /\bwho is your owner\b/,
    /\bwho made maro ai\b/,
    /\bwho created maro ai\b/,
    /\bwho developed maro ai\b/,
    /\bwho founded maro ai\b/,
    /\bwho founded maro\b/,
    /\bwho are you\b/,
    /\bwhat are you\b/,
    /\bwhat ai are you\b/,
    /\bwhich ai are you\b/,
    /\bwhat model are you\b/,
    /\bwhich model are you\b/,
    /\bwhat is your identity\b/,
    /\bintroduce yourself\b/,
    /\btell me about maro ai\b/,
    /\btell me about maro\b/,
    /\bwhat is maro ai\b/,
    /\bwhat is maro\b/,
    /\bwho made this\b/,
    /\bwho created this\b/,
    /\bwho developed this\b/,
    /\bare you (?:a |an )?(?:chatbot|bot|language model|virtual assistant|ai assistant)\b/,

    // Kinyarwanda
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
    /\bmaro ni iki\b/,
    /\bmaro ai ni iki\b/,
    /\buri nde\b/,

    // French
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
    /\bqui est le fondateur de maro\b/,
    /\bqui est le fondateur de maro ai\b/,
    /\bqui es tu\b/,
    /\bpresente toi\b/,
    /\bquest ce que maro\b/,
    /\bquest ce que maro ai\b/,

    // Swahili
    /\bni nani aliyekutengeneza\b/,
    /\bni nani aliyekuunda\b/,
    /\bni nani aliyekuumba\b/,
    /\bmaro imetengenezwa na nani\b/,
    /\bmaro ai imetengenezwa na nani\b/,
    /\bmaro iliundwa na nani\b/,
    /\bmaro ai iliundwa na nani\b/,
    /\bwewe ni nani\b/,
    /\bmaro ni nini\b/,
    /\bmaro ai ni nini\b/,
  ];

  if (!patterns.some((pattern) => pattern.test(text))) {
    return null;
  }

  // Kinyarwanda
  if (
    /\b(wagukora|waguhanga|uwagukoze|uwaguhimbye|maro yakozwe|maro ai yakozwe|maro yahanzwe|maro ai yahanzwe|maro yateguwe|maro ai yateguwe|maro ni iki|maro ai ni iki|uri nde)\b/.test(text)
  ) {
    return (
      'Ndi MARO AI, umufasha w’ubwenge buhangano wakozwe kandi ' +
      'utezurwe na GISUBIZO Marc, umuteza imbere w’ikoranabuhanga ' +
      'ukomoka mu Rwanda. Ndagufasha mu kwiga, gukora, ' +
      'gukemura ibibazo no kubona amakuru.'
    );
  }

  // French
  if (
    /\b(qui ta cree|qui ta developpe|qui a cree|qui a developpe|qui est ton createur|qui est ton developpeur|qui est le createur|qui est le developpeur|qui est le fondateur|qui es tu|presente toi|quest ce que maro)\b/.test(text)
  ) {
    return (
      'Je suis MARO AI, un assistant d’intelligence artificielle ' +
      'créé et développé par GISUBIZO Marc, un développeur rwandais. ' +
      'Je peux vous aider à apprendre, écrire, programmer, ' +
      'résoudre des problèmes et trouver des informations.'
    );
  }

  // Swahili
  if (
    /\b(ni nani aliyekutengeneza|ni nani aliyekuunda|ni nani aliyekuumba|maro imetengenezwa|maro ai imetengenezwa|maro iliundwa|maro ai iliundwa|wewe ni nani|maro ni nini|maro ai ni nini)\b/.test(text)
  ) {
    return (
      'Mimi ni MARO AI, msaidizi wa akili bandia aliyeundwa ' +
      'na kuendelezwa na GISUBIZO Marc, msanidi programu kutoka Rwanda. ' +
      'Ninaweza kukusaidia kujifunza, kuandika, kupanga, ' +
      'kutatua matatizo na kupata taarifa.'
    );
  }

  // English
  return (
    'I am MARO AI, an AI assistant created and developed by ' +
    'GISUBIZO Marc, a Rwandan developer. I can help you learn, ' +
    'write, code, solve problems, and explore information.'
  );
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

  // Account suspension check
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

  // Guests cannot upload attachments
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

  // Rate limiting
  const rateKey = user
    ? `user:${user.id}`
    : `guest:${
        req.headers
          .get('x-forwarded-for')
          ?.split(',')[0]
          ?.trim() || 'unknown'
      }`;

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

  let prior: ChatMessage[] = [];
  let regenId: string | null = null;

  // Load authenticated conversation
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

  // Create new conversation
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

  // Guest conversation history
  if (!user) {
    prior = validateHistory(body.history);
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

  const turns: ChatMessage[] = [
    ...prior,
    ...(regenerate
      ? []
      : [
          {
            role: 'user' as const,
            content:
              message || 'Please analyze the attached file(s).',
          },
        ]),
  ];

  // Save user message
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

  // Remove old assistant response when regenerating
  if (user && regenId) {
    await supabase
      .from('messages')
      .delete()
      .eq('id', regenId);
  }

  // Direct identity response
  const creatorAnswer =
    !regenerate && !attachments.length
      ? getCreatorAnswer(message)
      : null;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const emit = (value: unknown) => {
        if (closed) return;

        try {
          controller.enqueue(
            encoder.encode(sse(value)),
          );
        } catch {
          closed = true;
        }
      };

      (async () => {
        const startedAt = Date.now();
        let succeeded = false;

        try {
          emit({
            type: 'start',
            conversationId,
          });

          let answer = '';
          let sources: unknown[] = [];

          if (creatorAnswer) {
            answer = creatorAnswer;
            emit({
              type: 'delta',
              text: answer,
            });
          } else {
            // Buffer a small tail to avoid splitting blocked names
            // across streaming chunks.
            let pending = '';
            const HOLD = 48;

            const result = await generateStream(
              systemPrompt(mode, {
                language: safeOption(body.options?.language),
                level: safeOption(body.options?.level),
              }),
              turns,
              {
                attachments,
                search: body.search === true,
              },
              (delta) => {
                pending += delta;

                if (pending.length > HOLD) {
                  const flushLength = pending.length - HOLD;
                  const safePart = pending.slice(0, flushLength);
                  pending = pending.slice(flushLength);

                  const cleaned = removeExternalAIReferences(safePart);

                  answer += cleaned;

                  emit({
                    type: 'delta',
                    text: cleaned,
                  });
                }
              },
            );

            // Flush remaining text after generation completes.
            const finalPart = removeExternalAIReferences(pending);
            answer += finalPart;

            if (finalPart) {
              emit({
                type: 'delta',
                text: finalPart,
              });
            }

            // Ensure the final saved response is sanitized too.
            answer = removeExternalAIReferences(answer);

            sources = result.sources;
          }

          // Save assistant response
          if (user) {
            const { error } = await supabase
              .from('messages')
              .insert({
                conversation_id: conversationId,
                user_id: user.id,
                role: 'assistant',
                content: answer,
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
        } catch (error) {
          const err =
            error instanceof AIError
              ? error
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
            } catch {
              // Usage logging must not interrupt chat.
            }
          }

          if (!closed) {
            try {
              controller.close();
            } catch {
              // Client may have disconnected.
            }
          }
        }
      })();
    },

    cancel() {
      // The browser has disconnected.
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
