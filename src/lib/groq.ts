import type { Attachment } from './attachments';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };
export type Source = { title: string; uri: string };
export type GenerateOptions = { attachments?: Attachment[]; search?: boolean };

export class AIError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

const API = 'https://api.groq.com/openai/v1';
const env = (k: string, d: string) => process.env[k] || d;
/** All models are configurable; check https://console.groq.com/docs/models for what your account offers. */
export const models = () => ({
  text: env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
  vision: env('GROQ_VISION_MODEL', 'meta-llama/llama-4-scout-17b-16e-instruct'),
  search: env('GROQ_SEARCH_MODEL', 'groq/compound'),
  stt: env('GROQ_TRANSCRIBE_MODEL', 'whisper-large-v3-turbo'),
  fallback: process.env.GROQ_FALLBACK_MODEL || '',
});
const MAX_DOC_CHARS = () => Number(process.env.GROQ_MAX_DOC_CHARS) || 30_000;
const MAX_IMAGE_B64 = 4_000_000; // Groq limit for base64 images is 4 MB
const MAX_IMAGES = 5;
const RETRY = [429, 500, 502, 503, 504];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isText = (m: string) => m.startsWith('text/');

function key(): string {
  const k = process.env.GROQ_API_KEY;
  if (!k) throw new AIError('The AI service is not configured (missing GROQ_API_KEY).', 500);
  return k;
}

async function transcribe(a: Attachment): Promise<string> {
  const fd = new FormData();
  fd.append('file', new Blob([Buffer.from(a.data, 'base64')], { type: a.mimeType }), a.name);
  fd.append('model', models().stt);
  fd.append('response_format', 'json');
  let res: Response;
  try { res = await fetch(`${API}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${key()}` }, body: fd, signal: AbortSignal.timeout(90_000) }); }
  catch { throw new AIError(`Could not transcribe “${a.name}”: the AI service is unreachable.`); }
  if (!res.ok) { console.error('[groq] transcribe', res.status, (await res.text().catch(() => '')).slice(0, 300)); throw new AIError(`Could not transcribe “${a.name}” (error ${res.status}). Try a different audio file.`, res.status === 429 ? 429 : 400); }
  const data = await res.json();
  const t = String(data?.text ?? '').trim();
  if (!t) throw new AIError(`No speech was detected in “${a.name}”.`, 422);
  return t;
}

async function pdfText(a: Attachment): Promise<{ pages: string[] }> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(a.data, 'base64')));
  const { text } = await extractText(pdf, { mergePages: false });
  return { pages: (text as string[]).map((t) => t.trim()) };
}

/** Turns attachments into plain text for the model plus image data URLs. Notes list anything truncated or skipped. */
async function prepare(atts: Attachment[]): Promise<{ text: string; images: string[]; notes: string[] }> {
  const images: string[] = []; const notes: string[] = []; const blocks: string[] = [];
  let budget = MAX_DOC_CHARS();
  const add = (label: string, body: string, unitNote?: (kept: number) => string) => {
    if (budget <= 0) { notes.push(`“${label}” was not included because the document size limit was reached.`); return; }
    let kept = body;
    if (body.length > budget) { kept = body.slice(0, budget); notes.push(unitNote ? unitNote(kept.length) : `Only the first ${kept.length.toLocaleString()} characters of “${label}” were read (limit ${MAX_DOC_CHARS().toLocaleString()}).`); }
    budget -= kept.length;
    blocks.push(`--- Attached: ${label} ---\n${kept}\n--- End of ${label} ---`);
  };
  for (const a of atts) {
    if (a.mimeType.startsWith('image/')) {
      if (a.data.length > MAX_IMAGE_B64) throw new AIError(`“${a.name}” is too large for image analysis (max about 3 MB). Compress or resize it.`, 400);
      if (images.length >= MAX_IMAGES) throw new AIError(`You can analyze at most ${MAX_IMAGES} images at once.`, 400);
      images.push(`data:${a.mimeType};base64,${a.data}`);
    } else if (isText(a.mimeType)) {
      add(a.name, Buffer.from(a.data, 'base64').toString('utf8'));
    } else if (a.mimeType === 'application/pdf') {
      let pages: string[];
      try { pages = (await pdfText(a)).pages; } catch { throw new AIError(`Could not read “${a.name}”. It may be corrupted or password-protected.`, 400); }
      if (!pages.some((p) => p.length)) throw new AIError(`“${a.name}” has no selectable text (it may be a scan). Upload page images instead.`, 422);
      const parts: string[] = []; let used = 0; let lastPage = 0;
      for (let i = 0; i < pages.length; i++) {
        const piece = `[Page ${i + 1}]\n${pages[i]}\n`;
        if (used + piece.length > Math.max(budget, 0)) break;
        parts.push(piece); used += piece.length; lastPage = i + 1;
      }
      if (!parts.length) add(a.name, pages.join('\n'));
      else { add(a.name, parts.join('\n')); if (lastPage < pages.length) notes.push(`Only pages 1–${lastPage} of ${pages.length} in “${a.name}” were read because of the size limit.`); }
    } else if (a.mimeType.startsWith('audio/')) {
      add(`${a.name} (audio transcript)`, await transcribe(a));
    } else throw new AIError(`“${a.name}” is not a supported file type.`, 400);
  }
  return { text: blocks.join('\n\n'), images, notes };
}

async function callChat(model: string, messages: unknown[], stream = false): Promise<Response> {
  let last: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      last = await fetch(`${API}/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key()}` },
        body: JSON.stringify({ model, messages, temperature: 0.7, max_completion_tokens: 4096, ...(stream ? { stream: true } : {}) }), signal: AbortSignal.timeout(90_000),
      });
    } catch (e) { console.error('[groq] network error', model, e instanceof Error ? e.name : e); await sleep(800 * 2 ** attempt); continue; }
    if (!RETRY.includes(last.status)) return last;
    console.error('[groq]', last.status, 'model=' + model, 'attempt', attempt + 1);
    if (attempt < 2) await sleep(800 * 2 ** attempt);
  }
  if (!last) throw new AIError('Could not reach the AI service. Check your internet connection.');
  return last;
}

export async function generate(system: string, turns: ChatTurn[], opts: GenerateOptions = {}): Promise<{ text: string; sources: Source[] }> {
  key();
  const m = models();
  const { text: fileText, images, notes } = await prepare(opts.attachments ?? []);
  const useSearch = !!opts.search && !images.length;
  if (opts.search && images.length) notes.push('Web search was skipped because images were attached.');
  const model = images.length ? m.vision : useSearch ? m.search : m.text;

  const msgs: { role: string; content: unknown }[] = turns.map((t) => ({ role: t.role, content: t.content }));
  const last = msgs[msgs.length - 1];
  if (last?.role === 'user') {
    const body = fileText ? `${last.content}\n\n${fileText}` : String(last.content);
    last.content = images.length ? [{ type: 'text', text: body }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))] : body;
  }
  const messages = [{ role: 'system', content: system }, ...msgs];

  let res = await callChat(model, messages);
  if (!res.ok && RETRY.includes(res.status) && m.fallback && m.fallback !== model && !images.length) res = await callChat(m.fallback, messages);
  if (!res.ok) {
    let detail = ''; try { detail = String((await res.json())?.error?.message ?? ''); } catch { /* ignore */ }
    console.error('[groq] final', res.status, 'model=' + model, detail.slice(0, 300));
    const hint = detail ? ` (${detail.slice(0, 160)})` : '';
    if (res.status === 401) throw new AIError('Groq rejected the API key. Check GROQ_API_KEY.', 401);
    if (res.status === 404) throw new AIError(`Groq model “${model}” was not found for your account${hint}. Check the GROQ_*_MODEL values.`, 404);
    if (res.status === 413) throw new AIError('That request is too large for the model. Use a shorter message or smaller files.', 413);
    if (res.status === 429) throw new AIError('Groq rate limit reached. Wait a moment and try again.', 429);
    if (res.status === 400) throw new AIError(`Groq could not process that request${hint}.`, 400);
    throw new AIError('Groq is busy right now. Wait a moment and press send again.', 503);
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  const out = String(msg?.content ?? '').trim();
  if (!out) throw new AIError('The AI returned an empty response. Try again.');

  const seen = new Set<string>(); const sources: Source[] = [];
  for (const t of (msg?.executed_tools ?? []) as { search_results?: { results?: { title?: string; url?: string }[] } }[])
    for (const r of t.search_results?.results ?? []) if (r.url && !seen.has(r.url)) { seen.add(r.url); sources.push({ uri: r.url, title: r.title || r.url }); }
  if (useSearch && !sources.length) notes.push('Web search was enabled, but no sources were returned for this answer.');
  return { text: (notes.length ? notes.map((n) => `_${n}_`).join('\n') + '\n\n' : '') + out, sources };
}


/** Streams model deltas to the caller while retaining a complete final answer for persistence. */
export async function generateStream(system: string, turns: ChatTurn[], opts: GenerateOptions = {}, onDelta: (delta: string) => void): Promise<{ text: string; sources: Source[] }> {
  key();
  const m = models();
  const { text: fileText, images, notes } = await prepare(opts.attachments ?? []);
  const useSearch = !!opts.search && !images.length;
  if (opts.search && images.length) notes.push('Web search was skipped because images were attached.');
  const model = images.length ? m.vision : useSearch ? m.search : m.text;
  const msgs: { role: string; content: unknown }[] = turns.map((t) => ({ role: t.role, content: t.content }));
  const last = msgs[msgs.length - 1];
  if (last?.role === 'user') {
    const body = fileText ? `${last.content}\n\n${fileText}` : String(last.content);
    last.content = images.length ? [{ type: 'text', text: body }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))] : body;
  }
  const messages = [{ role: 'system', content: system }, ...msgs];
  let res = await callChat(model, messages, true);
  if (!res.ok && RETRY.includes(res.status) && m.fallback && m.fallback !== model && !images.length) res = await callChat(m.fallback, messages, true);
  if (!res.ok) {
    let detail = ''; try { detail = String((await res.json())?.error?.message ?? ''); } catch {}
    if (res.status === 401) throw new AIError('Groq rejected the API key. Check GROQ_API_KEY.', 401);
    if (res.status === 404) throw new AIError(`Groq model “${model}” was not found for your account. Check the GROQ_*_MODEL values.`, 404);
    if (res.status === 429) throw new AIError('Groq rate limit reached. Wait a moment and try again.', 429);
    throw new AIError(detail ? `Groq could not process that request (${detail.slice(0, 140)}).` : 'Groq is busy right now. Try again.', res.status >= 500 ? 503 : res.status);
  }
  if (!res.body) throw new AIError('The AI service returned an empty stream.');
  const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let out = ''; let sources: Source[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue; const raw = line.slice(5).trim(); if (!raw || raw === '[DONE]') continue;
        try { const item = JSON.parse(raw); const delta = item?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) { out += delta; onDelta(delta); }
          const tools = item?.choices?.[0]?.delta?.executed_tools ?? [];
          for (const t of tools as { search_results?: { results?: { title?: string; url?: string }[] }[] }) for (const r of t.search_results ?? []) for (const x of r.results ?? []) if (x.url && !sources.some((z) => z.uri === x.url)) sources.push({ uri: x.url, title: x.title || x.url });
        } catch {}
      }
    }
  } finally { reader.releaseLock(); }
  if (!out.trim()) throw new AIError('The AI returned an empty response. Try again.');
  if (useSearch && !sources.length) notes.push('Web search was enabled, but no sources were returned for this answer.');
  return { text: (notes.length ? notes.map((n) => `_${n}_`).join('\n') + '\n\n' : '') + out, sources };
}
