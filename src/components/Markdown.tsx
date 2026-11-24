'use client';
import { isValidElement, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy, Download } from 'lucide-react';

const EXT: Record<string, string> = { python: 'py', javascript: 'js', typescript: 'ts', tsx: 'tsx', jsx: 'jsx', java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs', go: 'go', rust: 'rs', php: 'php', ruby: 'rb', sql: 'sql', bash: 'sh', shell: 'sh', html: 'html', css: 'css', json: 'json', yaml: 'yml', kotlin: 'kt', swift: 'swift', markdown: 'md' };

function Pre({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const cls = isValidElement<{ className?: string }>(children) ? children.props.className ?? '' : '';
  const lang = /language-([\w+-]+)/.exec(cls)?.[1] ?? 'text';
  const text = () => ref.current?.textContent ?? '';
  async function copy() { try { await navigator.clipboard.writeText(text()); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } }
  function download() {
    const url = URL.createObjectURL(new Blob([text()], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = `maro-code.${EXT[lang] ?? 'txt'}`; a.click(); URL.revokeObjectURL(url);
  }
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-ink-600 bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-ink-700 px-3 py-1.5 text-xs text-mute">
        <span className="font-mono">{lang}</span>
        <span className="flex gap-1">
          <button onClick={download} aria-label="Download code" className="flex min-h-[32px] items-center gap-1 rounded px-2 hover:bg-ink-700"><Download size={14} /></button>
          <button onClick={copy} aria-label="Copy code" className="flex min-h-[32px] items-center gap-1 rounded px-2 hover:bg-ink-700">{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
        </span>
      </div>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}

export default function Markdown({ children }: { children: string }) {
  return <div className="prose-maro"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ pre: Pre }}>{children}</ReactMarkdown></div>;
}
