
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Copy,
  Eraser,
  FileText,
  Globe,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  RefreshCw,
  SendHorizonal,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

import Markdown from './Markdown';
import type { Mode } from '@/lib/prompts';
import {
  ACCEPT,
  isAllowedMime,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  normalizeMime,
  type Attachment,
} from '@/lib/attachments';

type Source = {
  title: string;
  uri: string;
};

export type Msg = {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
};

type Pending = Attachment & {
  preview?: string;
  size: number;
};

type Props = {
  mode: Mode;
  placeholder: string;
  starters?: string[];
  initialMessages?: Msg[];
  conversationId?: string | null;
  languages?: string[];
  levels?: string[];
  emptyTitle?: string;
  emptyText?: string;
  compact?: boolean;
  allowAttachments?: boolean;
};

const SPEECH_LANG: Record<string, string> = {
  English: 'en-US',
  Kinyarwanda: 'rw-RW',
  'Français': 'fr-FR',
  Kiswahili: 'sw-KE',
};

type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  }
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () =>
      resolve(String(reader.result).split(',')[1] ?? '');

    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

export default function ChatPanel({
  mode,
  placeholder,
  starters = [],
  initialMessages = [],
  conversationId = null,
  languages,
  levels,
  emptyTitle,
  emptyText,
  compact,
  allowAttachments = false,
}: Props) {
  const router = useRouter();

  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [convId, setConvId] = useState<string | null>(conversationId);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(languages?.[0] ?? '');
  const [level, setLevel] = useState(levels?.[1] ?? levels?.[0] ?? '');
  const [search, setSearch] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [canListen, setCanListen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SR | null>(null);
  const busy = useRef(false);
  const lastFiles = useRef<Pending[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Guest access control
  function requireLogin(): boolean {
    if (!allowAttachments) {
      router.push('/login');
      return false;
    }

    return true;
  }

  useEffect(() => {
    setCanListen(
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    );

    return () => {
      recRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [messages, loading]);

  useEffect(() => {
    const textarea = taRef.current;

    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height =
        Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // FILE ATTACHMENTS
  async function addFiles(files: File[]) {
    if (!requireLogin()) return;

    setError(null);

    const next = [...pending];

    for (const file of files) {
      const mimeType = normalizeMime(file);

      if (next.length >= MAX_FILES) {
        setError(`You can attach up to ${MAX_FILES} files.`);
        break;
      }

      if (!isAllowedMime(mimeType)) {
        setError(
          `“${file.name}” isn’t supported. Use images, PDF, text/CSV or audio.`
        );
        continue;
      }

      if (file.size > MAX_FILE_BYTES) {
        setError(`“${file.name}” is larger than 10 MB.`);
        continue;
      }

      if (
        next.reduce((total, item) => total + item.size, 0) +
          file.size >
        MAX_TOTAL_BYTES
      ) {
        setError('Attachments are too large in total (max 15 MB).');
        break;
      }

      try {
        next.push({
          name: file.name,
          mimeType,
          data: await toBase64(file),
          size: file.size,
          preview: mimeType.startsWith('image/')
            ? URL.createObjectURL(file)
            : undefined,
        });
      } catch {
        setError(`Could not read “${file.name}”.`);
      }
    }

    setPending(next);
  }

  function removePending(index: number) {
    setPending((previous) => {
      const item = previous[index];

      if (item?.preview) {
        URL.revokeObjectURL(item.preview);
      }

      return previous.filter((_, i) => i !== index);
    });
  }

  // SEND MESSAGE AND STREAM AI RESPONSE
  async function send(
    text: string,
    regenerate = false,
    removed: Msg | null = null
  ) {
    const message = text.trim();

    if (
      busy.current ||
      loading ||
      (!regenerate && !message && !pending.length)
    ) {
      return;
    }

    busy.current = true;

    const files = regenerate ? lastFiles.current : pending;

    if (!regenerate) {
      lastFiles.current = pending;
    }

    setError(null);
    setNotice(null);
    setLoading(true);

    if (!regenerate) {
      setInput('');
      setPending([]);

      setMessages((previous) => [
        ...previous,
        {
          role: 'user',
          content:
            message +
            (files.length
              ? `${message ? '\n\n' : ''}📎 ${files
                  .map((file) => file.name)
                  .join(', ')}`
              : ''),
        },
        {
          role: 'assistant',
          content: '',
        },
      ]);
    } else {
      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: '',
        },
      ]);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          mode,
          conversationId: convId,
          regenerate,
          search,
          history: messages.slice(-30).map(({ role, content }) => ({
            role,
            content,
          })),
          attachments: files.map(({ name, mimeType, data }) => ({
            name,
            mimeType,
            data,
          })),
          options: {
            language,
            level,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || 'Something went wrong. Try again.'
        );
      }

      if (!response.body) {
        throw new Error(
          'Streaming is not supported by this connection.'
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      let assistantText = '';
      let sources: Source[] = [];

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;

          try {
            const event = JSON.parse(line.slice(5).trim());

            if (event.type === 'start' && event.conversationId) {
              setConvId(event.conversationId);
            }

            if (event.type === 'delta') {
              assistantText += event.text;

              setMessages((previous) => {
                const next = [...previous];
                const index = next.length - 1;

                if (next[index]?.role === 'assistant') {
                  next[index] = {
                    ...next[index],
                    content: assistantText,
                  };
                }

                return next;
              });
            }

            if (event.type === 'done') {
              sources = event.sources ?? [];
            }

            if (event.type === 'warning') {
              setNotice(event.message);
            }

            if (event.type === 'error') {
              throw new Error(
                event.error || 'Generation failed.'
              );
            }
          } catch (e) {
            if (
              e instanceof Error &&
              e.message !== 'Unexpected end of JSON input'
            ) {
              throw e;
            }
          }
        }
      }

      setMessages((previous) => {
        const next = [...previous];
        const index = next.length - 1;

        if (next[index]?.role === 'assistant') {
          next[index] = {
            ...next[index],
            content: assistantText,
            sources,
          };
        }

        return next;
      });
    } catch (e) {
      if (controller.signal.aborted) {
        setNotice('Generation stopped.');
      } else {
        setError(
          e instanceof Error
            ? e.message
            : 'Network error. Check your connection and try again.'
        );

        setMessages((previous) => {
          const next = [...previous];

          if (
            next[next.length - 1]?.role === 'assistant' &&
            !next[next.length - 1].content
          ) {
            next.pop();
          }

          if (
            !regenerate &&
            next[next.length - 1]?.role === 'user'
          ) {
            next.pop();
          }

          return next;
        });

        if (!regenerate) {
          setInput(message);
          setPending(files);
        } else if (removed) {
          setMessages((previous) => [...previous, removed]);
        }
      }
    } finally {
      setLoading(false);
      busy.current = false;
      abortRef.current = null;
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  function regenerate() {
    const lastUser = [...messages]
      .reverse()
      .find((message) => message.role === 'user');

    if (
      lastUser?.content.includes('📎') &&
      !lastFiles.current.length
    ) {
      setNotice(
        'This answer used attached files that are no longer available in this session, so the reply is regenerated from the text only. Attach the files again to include them.'
      );
    }

    const removed =
      messages[messages.length - 1]?.role === 'assistant'
        ? messages[messages.length - 1]
        : null;

    if (removed) {
      setMessages((previous) => previous.slice(0, -1));
    }

    send('', true, removed);
  }

  function clearChat() {
    lastFiles.current = [];

    pending.forEach((file) => {
      if (file.preview) URL.revokeObjectURL(file.preview);
    });

    setNotice(null);
    setMessages([]);
    setConvId(null);
    setError(null);
    setInput('');
    setPending([]);

    window.speechSynthesis?.cancel();
  }

  // VOICE INPUT
  function toggleMic() {
    if (!requireLogin()) return;

    if (listening) {
      recRef.current?.stop();
      return;
    }

    const Ctor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Ctor) {
      setError('Voice input is not supported by this browser.');
      return;
    }

    const rec = new Ctor();
    recRef.current = rec;

    rec.lang = SPEECH_LANG[language] ?? navigator.language;
    rec.interimResults = true;
    rec.continuous = true;

    const base = input ? input + ' ' : '';

    rec.onresult = (event) => {
      let transcript = '';

      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      setInput(base + transcript);
    };

    rec.onend = () => setListening(false);

    rec.onerror = () => {
      setListening(false);
      setError(
        'Voice input failed. Check microphone permission, or type instead.'
      );
    };

    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  // READ AI RESPONSE ALOUD
  function speak(index: number, text: string) {
    const synth = window.speechSynthesis;

    if (!synth) {
      setError('Spoken replies are not supported in this browser.');
      return;
    }

    if (speakingIdx === index) {
      synth.cancel();
      setSpeakingIdx(null);
      return;
    }

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(
      text
        .replace(/```[\s\S]*?```/g, ' code block. ')
        .replace(/[*_#`>|]/g, '')
    );

    utterance.lang =
      SPEECH_LANG[language] ?? navigator.language;

    utterance.onend = () => setSpeakingIdx(null);
    utterance.onerror = () => setSpeakingIdx(null);

    setSpeakingIdx(index);
    synth.speak(utterance);
  }

  // COPY RESPONSE
  async function copy(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(index);

      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      // Clipboard unavailable
    }
  }

  const lastIdx = messages.length - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">

      {/* LANGUAGE AND LEVEL */}
      {(languages || levels) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">

          {languages && (
            <label className="flex items-center gap-2 text-sm text-mute">
              Language

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input !w-auto !py-2"
              >
                {languages.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}

          {levels && (
            <label className="flex items-center gap-2 text-sm text-mute">
              Level

              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="input !w-auto !py-2"
              >
                {levels.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}

        </div>
      )}

      {/* CHAT MESSAGES */}
      <div
        className={`min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900/60 p-3 sm:p-4 ${
          compact
            ? 'max-h-[460px] min-h-[220px]'
            : 'min-h-[320px]'
        }`}
        aria-live="polite"
      >

        {messages.length === 0 && !loading && (
          <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-3 py-8 text-center">

            {emptyTitle && (
              <h2 className="text-xl font-semibold">
                {emptyTitle}
              </h2>
            )}

            {emptyText && (
              <p className="text-sm text-mute">
                {emptyText}
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-2">
              {starters.map((starter) => (
                <button
                  key={starter}
                  onClick={() => send(starter)}
                  className="rounded-full border border-ink-600 px-3 py-2 text-left text-xs text-mute hover:border-saffron hover:text-paper"
                >
                  {starter}
                </button>
              ))}
            </div>

          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'flex justify-end'
                : 'flex flex-col items-start'
            }
          >

            {message.role === 'user' ? (
              <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-saffron px-4 py-2.5 text-sm text-ink-950">
                {message.content}
              </div>
            ) : (
              <>
                <div className="w-full max-w-full rounded-2xl rounded-bl-md bg-ink-800 px-4 py-2 sm:max-w-[92%]">

                  <Markdown>
                    {message.content}
                  </Markdown>

                  {!!message.sources?.length && (
                    <div className="mb-2 border-t border-ink-700 pt-2 text-xs text-mute">

                      <p className="mb-1 font-medium">
                        Sources
                      </p>

                      <ul className="space-y-1">
                        {message.sources.map((source) => (
                          <li
                            key={source.uri}
                            className="truncate"
                          >
                            <a
                              href={source.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-saffron underline"
                            >
                              {source.title}
                            </a>
                          </li>
                        ))}
                      </ul>

                    </div>
                  )}

                </div>

                {/* RESPONSE ACTIONS */}
                <div className="mt-1 flex gap-1 text-mute">

                  <button
                    onClick={() => copy(index, message.content)}
                    aria-label="Copy reply"
                    className="grid h-9 w-9 place-items-center rounded-lg hover:bg-ink-700"
                  >
                    {copiedIdx === index
                      ? <Check size={16} />
                      : <Copy size={16} />
                    }
                  </button>

                  <button
                    onClick={() => speak(index, message.content)}
                    aria-label={
                      speakingIdx === index
                        ? 'Stop speaking'
                        : 'Read reply aloud'
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg hover:bg-ink-700"
                  >
                    {speakingIdx === index
                      ? <VolumeX size={16} />
                      : <Volume2 size={16} />
                    }
                  </button>

                  {index === lastIdx && (
                    <button
                      onClick={regenerate}
                      disabled={loading}
                      aria-label="Regenerate reply"
                      className="grid h-9 w-9 place-items-center rounded-lg hover:bg-ink-700"
                    >
                      <RefreshCw size={16} />
                    </button>
                  )}

                </div>
              </>
            )}

          </div>
        ))}

        {/* GENERATION STATUS */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-mute">

            <Loader2 size={16} className="animate-spin" />

            {messages[lastIdx]?.content
              ? 'MARO is responding…'
              : 'MARO is starting…'
            }

            <button
              onClick={stopGeneration}
              className="ml-2 rounded-lg border border-ink-600 px-2 py-1 text-xs hover:bg-ink-700"
            >
              Stop
            </button>

          </div>
        )}

        <div ref={endRef} />

      </div>

      {/* NOTIFICATIONS */}
      {notice && (
        <p
          role="status"
          className="mt-3 rounded-xl border border-saffron/40 bg-saffron-soft px-3 py-2 text-sm"
        >
          {notice}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      {/* ATTACHMENT PREVIEWS */}
      {pending.length > 0 && (
        <ul
          className="mt-3 flex flex-wrap gap-2"
          aria-label="Attachments"
        >
          {pending.map((file, index) => (
            <li
              key={index}
              className="relative flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-800 p-1.5 pr-8 text-xs"
            >

              {file.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.preview}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-ink-700">
                  <FileText size={18} />
                </span>
              )}

              <span className="max-w-[140px] truncate">
                {file.name}
              </span>

              <button
                onClick={() => removePending(index)}
                aria-label={`Remove ${file.name}`}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full hover:bg-ink-600"
              >
                <X size={14} />
              </button>

            </li>
          ))}
        </ul>
      )}

      {/* MESSAGE COMPOSER */}
      <div className="mt-3 rounded-2xl border border-ink-600 bg-ink-800 p-2 focus-within:border-saffron">

        <textarea
          ref={taRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            listening
              ? 'Listening… speak now'
              : placeholder
          }
          aria-label="Message"

          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}

          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);

            if (!files.length) return;

            e.preventDefault();

            if (!allowAttachments) {
              router.push('/login');
              return;
            }

            addFiles(files);
          }}

          className="max-h-[200px] w-full resize-none bg-transparent px-2 py-2 text-sm text-paper placeholder:text-mute focus:outline-none"
        />

        <div className="flex items-center gap-1">

          {/* HIDDEN FILE INPUT */}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />

          {/* ATTACHMENT BUTTON: VISIBLE TO EVERYONE */}
          <button
            type="button"
            onClick={() => {
              if (!requireLogin()) return;
              fileRef.current?.click();
            }}
            aria-label="Attach files"
            title={
              allowAttachments
                ? 'Attach images, PDF, text or audio'
                : 'Log in to attach files'
            }
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-mute hover:bg-ink-700 hover:text-paper"
          >
            <Paperclip size={18} />
          </button>

          {/* MICROPHONE BUTTON: GUESTS ARE REDIRECTED */}
          {(!allowAttachments || canListen) && (
            <button
              type="button"
              onClick={() => {
                if (!requireLogin()) return;
                toggleMic();
              }}
              aria-label={
                listening
                  ? 'Stop voice input'
                  : 'Start voice input'
              }
              title={
                !allowAttachments
                  ? 'Log in to use voice input'
                  : 'Use voice input'
              }
              aria-pressed={listening}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl hover:bg-ink-700 ${
                listening
                  ? 'animate-pulse text-red-400'
                  : 'text-mute hover:text-paper'
              }`}
            >
              {listening
                ? <MicOff size={18} />
                : <Mic size={18} />
              }
            </button>
          )}

          {/* WEB SEARCH */}
          <button
            onClick={() => setSearch(!search)}
            aria-pressed={search}
            title="Search the web for this answer"
            className={`flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs hover:bg-ink-700 ${
              search
                ? 'bg-saffron-soft text-saffron'
                : 'text-mute'
            }`}
          >
            <Globe size={16} />
            <span className="hidden sm:inline">
              Search
            </span>
          </button>

          <span className="flex-1" />

          {/* CLEAR INPUT */}
          <button
            onClick={() => setInput('')}
            disabled={!input}
            aria-label="Clear input"
            className="grid h-10 w-10 place-items-center rounded-xl text-mute hover:bg-ink-700 disabled:opacity-40"
          >
            <Eraser size={18} />
          </button>

          {/* CLEAR CHAT */}
          <button
            onClick={clearChat}
            disabled={
              !messages.length &&
              !input &&
              !pending.length
            }
            aria-label="Clear chat and start a new one"
            title="Clear chat"
            className="grid h-10 w-10 place-items-center rounded-xl text-mute hover:bg-ink-700 disabled:opacity-40"
          >
            <Trash2 size={18} />
          </button>

          {/* SEND */}
          <button
            onClick={() => send(input)}
            disabled={
              loading ||
              (!input.trim() && !pending.length)
            }
            aria-label="Send"
            className="btn btn-primary !min-h-[40px] !px-3.5"
          >
            <SendHorizonal size={18} />
          </button>

        </div>
      </div>
    </div>
  );
}
