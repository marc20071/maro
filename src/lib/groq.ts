
import type { Attachment } from './attachments';

export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type Source = {
  title: string;
  uri: string;
};

export type GenerateOptions = {
  attachments?: Attachment[];
  search?: boolean;
};

export class AIError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
    this.name = 'AIError';
  }
}

const API = 'https://api.groq.com/openai/v1';

const env = (key: string, fallback: string) =>
  process.env[key] || fallback;

export const models = () => ({
  text: env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
  vision: env(
    'GROQ_VISION_MODEL',
    'meta-llama/llama-4-scout-17b-16e-instruct'
  ),
  search: env('GROQ_SEARCH_MODEL', 'groq/compound'),
  stt: env('GROQ_TRANSCRIBE_MODEL', 'whisper-large-v3-turbo'),
  fallback: process.env.GROQ_FALLBACK_MODEL || '',
});

const MAX_DOC_CHARS = () =>
  Number(process.env.GROQ_MAX_DOC_CHARS) || 30_000;

const MAX_IMAGE_B64 = 4_000_000;
const MAX_IMAGES = 5;

const RETRY = [429, 500, 502, 503, 504];

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isText = (mimeType: string) =>
  mimeType.startsWith('text/');

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as UnknownRecord;
}

/**
 * Extracts search sources safely from Groq tool responses.
 *
 * Groq can return executed_tools as either a single object
 * or an array. This helper supports both formats.
 */
function collectSources(
  rawTools: unknown,
  sources: Source[]
): void {
  const tools = Array.isArray(rawTools)
    ? rawTools
    : rawTools == null
      ? []
      : [rawTools];

  for (const rawTool of tools) {
    const tool = asRecord(rawTool);
    if (!tool) continue;

    const rawGroups = tool.search_results;

    const groups = Array.isArray(rawGroups)
      ? rawGroups
      : rawGroups == null
        ? []
        : [rawGroups];

    for (const rawGroup of groups) {
      const group = asRecord(rawGroup);
      if (!group || !Array.isArray(group.results)) continue;

      for (const rawResult of group.results) {
        const result = asRecord(rawResult);
        if (!result) continue;

        const url =
          typeof result.url === 'string' ? result.url : '';

        if (!url || sources.some((source) => source.uri === url)) {
          continue;
        }

        const title =
          typeof result.title === 'string' && result.title
            ? result.title
            : url;

        sources.push({ uri: url, title });
      }
    }
  }
}

function key(): string {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new AIError(
      'The AI service is not configured (missing GROQ_API_KEY).',
      500
    );
  }

  return apiKey;
}

async function transcribe(a: Attachment): Promise<string> {
  const fd = new FormData();

  fd.append(
    'file',
    new Blob([Buffer.from(a.data, 'base64')], {
      type: a.mimeType,
    }),
    a.name
  );

  fd.append('model', models().stt);
  fd.append('response_format', 'json');

  let res: Response;

  try {
    res = await fetch(`${API}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key()}`,
      },
      body: fd,
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new AIError(
      `Could not transcribe “${a.name}”: the AI service is unreachable.`
    );
  }

  if (!res.ok) {
    console.error(
      '[groq] transcribe',
      res.status,
      (await res.text().catch(() => '')).slice(0, 300)
    );

    throw new AIError(
      `Could not transcribe “${a.name}” (error ${res.status}). Try a different audio file.`,
      res.status === 429 ? 429 : 400
    );
  }

  const data = await res.json();
  const transcript = String(data?.text ?? '').trim();

  if (!transcript) {
    throw new AIError(
      `No speech was detected in “${a.name}”.`,
      422
    );
  }

  return transcript;
}

async function pdfText(
  a: Attachment
): Promise<{ pages: string[] }> {
  const { extractText, getDocumentProxy } = await import('unpdf');

  const pdf = await getDocumentProxy(
    new Uint8Array(Buffer.from(a.data, 'base64'))
  );

  const { text } = await extractText(pdf, {
    mergePages: false,
  });

  return {
    pages: (text as string[]).map((page) => page.trim()),
  };
}

/**
 * Converts attachments into model-readable text and images.
 */
async function prepare(
  attachments: Attachment[]
): Promise<{
  text: string;
  images: string[];
  notes: string[];
}> {
  const images: string[] = [];
  const notes: string[] = [];
  const blocks: string[] = [];

  let budget = MAX_DOC_CHARS();

  const add = (
    label: string,
    body: string,
    unitNote?: (kept: number) => string
  ) => {
    if (budget <= 0) {
      notes.push(
        `“${label}” was not included because the document size limit was reached.`
      );
      return;
    }

    let kept = body;

    if (body.length > budget) {
      kept = body.slice(0, budget);

      notes.push(
        unitNote
          ? unitNote(kept.length)
          : `Only the first ${kept.length.toLocaleString()} characters of “${label}” were read (limit ${MAX_DOC_CHARS().toLocaleString()}).`
      );
    }

    budget -= kept.length;

    blocks.push(
      `--- Attached: ${label} ---\n${kept}\n--- End of ${label} ---`
    );
  };

  for (const attachment of attachments) {
    if (attachment.mimeType.startsWith('image/')) {
      if (attachment.data.length > MAX_IMAGE_B64) {
        throw new AIError(
          `“${attachment.name}” is too large for image analysis (max about 3 MB). Compress or resize it.`,
          400
        );
      }

      if (images.length >= MAX_IMAGES) {
        throw new AIError(
          `You can analyze at most ${MAX_IMAGES} images at once.`,
          400
        );
      }

      images.push(
        `data:${attachment.mimeType};base64,${attachment.data}`
      );
    } else if (isText(attachment.mimeType)) {
      add(
        attachment.name,
        Buffer.from(attachment.data, 'base64').toString('utf8')
      );
    } else if (attachment.mimeType === 'application/pdf') {
      let pages: string[];

      try {
        pages = (await pdfText(attachment)).pages;
      } catch {
        throw new AIError(
          `Could not read “${attachment.name}”. It may be corrupted or password-protected.`,
          400
        );
      }

      if (!pages.some((page) => page.length)) {
        throw new AIError(
          `“${attachment.name}” has no selectable text (it may be a scan). Upload page images instead.`,
          422
        );
      }

      const parts: string[] = [];
      let used = 0;
      let lastPage = 0;

      for (let i = 0; i < pages.length; i++) {
        const piece = `[Page ${i + 1}]\n${pages[i]}\n`;

        if (used + piece.length > Math.max(budget, 0)) {
          break;
        }

        parts.push(piece);
        used += piece.length;
        lastPage = i + 1;
      }

      if (!parts.length) {
        add(attachment.name, pages.join('\n'));
      } else {
        add(attachment.name, parts.join('\n'));

        if (lastPage < pages.length) {
          notes.push(
            `Only pages 1–${lastPage} of ${pages.length} in “${attachment.name}” were read because of the size limit.`
          );
        }
      }
    } else if (attachment.mimeType.startsWith('audio/')) {
      add(
        `${attachment.name} (audio transcript)`,
        await transcribe(attachment)
      );
    } else {
      throw new AIError(
        `“${attachment.name}” is not a supported file type.`,
        400
      );
    }
  }

  return {
    text: blocks.join('\n\n'),
    images,
    notes,
  };
}

async function callChat(
  model: string,
  messages: unknown[],
  stream = false
): Promise<Response> {
  let last: Response | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      last = await fetch(`${API}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key()}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_completion_tokens: 4096,
          ...(stream ? { stream: true } : {}),
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      console.error(
        '[groq] network error',
        model,
        error instanceof Error ? error.name : error
      );

      await sleep(800 * 2 ** attempt);
      continue;
    }

    if (!RETRY.includes(last.status)) {
      return last;
    }

    console.error(
      '[groq]',
      last.status,
      'model=' + model,
      'attempt',
      attempt + 1
    );

    if (attempt < 2) {
      await sleep(800 * 2 ** attempt);
    }
  }

  if (!last) {
    throw new AIError(
      'Could not reach the AI service. Check your internet connection.'
    );
  }

  return last;
}

function formatNotes(notes: string[]): string {
  return notes.length
    ? notes.map((note) => `_${note}_`).join('\n') + '\n\n'
    : '';
}

function getErrorMessage(data: unknown): string {
  const root = asRecord(data);
  const error = asRecord(root?.error);

  return typeof error?.message === 'string'
    ? error.message
    : '';
}

function getError(status: number, model: string, detail = ''): AIError {
  const hint = detail ? ` (${detail.slice(0, 160)})` : '';

  if (status === 401) {
    return new AIError(
      'Groq rejected the API key. Check GROQ_API_KEY.',
      401
    );
  }

  if (status === 404) {
    return new AIError(
      `Groq model “${model}” was not found for your account${hint}. Check the GROQ_*_MODEL values.`,
      404
    );
  }

  if (status === 413) {
    return new AIError(
      'That request is too large for the model. Use a shorter message or smaller files.',
      413
    );
  }

  if (status === 429) {
    return new AIError(
      'Groq rate limit reached. Wait a moment and try again.',
      429
    );
  }

  if (status === 400) {
    return new AIError(
      `Groq could not process that request${hint}.`,
      400
    );
  }

  return new AIError(
    'Groq is busy right now. Wait a moment and press send again.',
    503
  );
}

function buildMessages(
  system: string,
  turns: ChatTurn[],
  fileText: string,
  images: string[]
) {
  const messages: { role: string; content: unknown }[] =
    turns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));

  const last = messages[messages.length - 1];

  if (last?.role === 'user') {
    const body = fileText
      ? `${String(last.content)}\n\n${fileText}`
      : String(last.content);

    last.content = images.length
      ? [
          { type: 'text', text: body },
          ...images.map((url) => ({
            type: 'image_url',
            image_url: { url },
          })),
        ]
      : body;
  }

  return [
    { role: 'system', content: system },
    ...messages,
  ];
}

/**
 * Standard non-streaming generation.
 */
export async function generate(
  system: string,
  turns: ChatTurn[],
  opts: GenerateOptions = {}
): Promise<{ text: string; sources: Source[] }> {
  key();

  const configuredModels = models();

  const {
    text: fileText,
    images,
    notes,
  } = await prepare(opts.attachments ?? []);

  const useSearch = !!opts.search && !images.length;

  if (opts.search && images.length) {
    notes.push(
      'Web search was skipped because images were attached.'
    );
  }

  const model = images.length
    ? configuredModels.vision
    : useSearch
      ? configuredModels.search
      : configuredModels.text;

  const messages = buildMessages(
    system,
    turns,
    fileText,
    images
  );

  let res = await callChat(model, messages);

  if (
    !res.ok &&
    RETRY.includes(res.status) &&
    configuredModels.fallback &&
    configuredModels.fallback !== model &&
    !images.length
  ) {
    res = await callChat(configuredModels.fallback, messages);
  }

  if (!res.ok) {
    let detail = '';

    try {
      detail = getErrorMessage(await res.json());
    } catch {
      // Ignore unreadable error responses.
    }

    console.error(
      '[groq] final',
      res.status,
      'model=' + model,
      detail.slice(0, 300)
    );

    throw getError(res.status, model, detail);
  }

  const data = await res.json();
  const choices = data?.choices;
  const message = choices?.[0]?.message;

  const output = String(message?.content ?? '').trim();

  if (!output) {
    throw new AIError(
      'The AI returned an empty response. Try again.'
    );
  }

  const sources: Source[] = [];

  collectSources(message?.executed_tools, sources);

  if (useSearch && !sources.length) {
    notes.push(
      'Web search was enabled, but no sources were returned for this answer.'
    );
  }

  return {
    text: formatNotes(notes) + output,
    sources,
  };
}

/**
 * Streaming generation.
 * Sends each received text delta immediately to onDelta.
 */
export async function generateStream(
  system: string,
  turns: ChatTurn[],
  opts: GenerateOptions = {},
  onDelta: (delta: string) => void
): Promise<{ text: string; sources: Source[] }> {
  key();

  const configuredModels = models();

  const {
    text: fileText,
    images,
    notes,
  } = await prepare(opts.attachments ?? []);

  const useSearch = !!opts.search && !images.length;

  if (opts.search && images.length) {
    notes.push(
      'Web search was skipped because images were attached.'
    );
  }

  const model = images.length
    ? configuredModels.vision
    : useSearch
      ? configuredModels.search
      : configuredModels.text;

  const messages = buildMessages(
    system,
    turns,
    fileText,
    images
  );

  let res = await callChat(model, messages, true);

  if (
    !res.ok &&
    RETRY.includes(res.status) &&
    configuredModels.fallback &&
    configuredModels.fallback !== model &&
    !images.length
  ) {
    res = await callChat(
      configuredModels.fallback,
      messages,
      true
    );
  }

  if (!res.ok) {
    let detail = '';

    try {
      detail = getErrorMessage(await res.json());
    } catch {
      // Ignore unreadable error responses.
    }

    throw getError(res.status, model, detail);
  }

  if (!res.body) {
    throw new AIError(
      'The AI service returned an empty stream.'
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let output = '';

  const sources: Source[] = [];

  /**
   * Processes one Server-Sent Event data line.
   */
  const processLine = (line: string) => {
    if (!line.startsWith('data:')) return;

    const raw = line.slice(5).trim();

    if (!raw || raw === '[DONE]') return;

    try {
      const item = JSON.parse(raw);

      const delta = item?.choices?.[0]?.delta?.content;

      if (typeof delta === 'string' && delta) {
        output += delta;
        onDelta(delta);
      }

      // IMPORTANT:
      // executed_tools can be an object OR an array.
      // collectSources handles both safely.
      const rawTools =
        item?.choices?.[0]?.delta?.executed_tools;

      collectSources(rawTools, sources);
    } catch (error) {
      console.error(
        '[groq] Could not process streaming event:',
        error instanceof Error ? error.message : error
      );
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split('\n');

      buffer = lines.pop() ?? '';

      for (const line of lines) {
        processLine(line);
      }
    }

    // Flush the decoder and process any remaining event.
    buffer += decoder.decode();

    if (buffer.trim()) {
      processLine(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  if (!output.trim()) {
    throw new AIError(
      'The AI returned an empty response. Try again.'
    );
  }

  if (useSearch && !sources.length) {
    notes.push(
      'Web search was enabled, but no sources were returned for this answer.'
    );
  }

  return {
    text: formatNotes(notes) + output,
    sources,
  };
}
