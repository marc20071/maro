export const ALLOWED_MIME = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
  'text/plain', 'text/csv', 'text/markdown', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4',
] as const;
export const ACCEPT = ALLOWED_MIME.join(',') + ',.md,.csv,.txt';
export const MAX_FILES = 4;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
export type Attachment = { name: string; mimeType: string; data: string }; // data = base64 (no prefix)

export function normalizeMime(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'md' ? 'text/markdown' : ext === 'csv' ? 'text/csv' : ext === 'txt' ? 'text/plain' : '';
}
export function isAllowedMime(m: string): boolean { return (ALLOWED_MIME as readonly string[]).includes(m); }
