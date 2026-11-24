# MARO AI — production readiness report (honest status)

No network was available when this was prepared, so `npm install`, `tsc`, lint, `next build`, and any live test against Groq or Supabase were NOT run.
The only automated check performed: every .ts/.tsx file parses without syntax errors (30 files), `sw.js` passes `node --check`, the manifest parses and its icon files exist.

| Feature | Status | Notes |
|---|---|---|
| Home assistant (chat, history save, copy, clear, language) | PARTIAL | Implemented; never executed against Groq/Supabase |
| Regenerate | PARTIAL | Re-sends the original attachments while they are still in the browser session; otherwise shows a notice that the reply is regenerated from text only |
| Attachments (image, paste, PDF, TXT/CSV/MD, audio) | PARTIAL | Validated client and server, sent inline to Groq; not tested with real files |
| Voice dictation + read aloud | PARTIAL | Browser APIs; needs Chrome/Edge/Safari support; Kinyarwanda recognition varies. No Groq native audio/speech |
| Search grounding + source links | PARTIAL | Sources come only from Groq's search tool results; never invented |
| Coding / Medicine / Learning | PARTIAL | Groq with module prompts; medicine safety rules + banner |
| Auth (register, login, logout, reset), protected routes | PARTIAL | Needs Supabase "Confirm email" off |
| Chat history: search (title), rename, pin, folders, move, filter, sort, delete | PARTIAL | New this round; requires migration 002; search covers titles only |
| Rate limiting | PARTIAL | 20 chat requests/user/minute, counted in the database |
| Admin dashboard (stats, server-side authorization) | PARTIAL | Read-only stats; no user management or Groq/error stats |
| Ad slots | PARTIAL | Hidden unless NEXT_PUBLIC_ADS_ENABLED=true; no network connected |
| PWA (manifest, icons, SW, offline, install button) | PARTIAL | Syntax/paths verified only; install flow untested |
| Cross-user isolation (RLS) | PARTIAL | Policies written; not tested with two accounts |
| Document Intelligence | NOT IMPLEMENTED | No upload library, extraction, chunking or citations |
| Study Mode (quizzes, progress), Coding Studio editor/ZIP | NOT IMPLEMENTED | Only the chat-based Learning and Coding pages exist |
| Research Assistant, Image Studio, Personal Memory, Productivity, Workspace | NOT IMPLEMENTED | Not in the navigation, so not advertised |
| Settings beyond display name | NOT IMPLEMENTED | Language/theme/memory/data-deletion controls absent |
| Seven user journeys | BLOCKED | Need npm, a Supabase project and a Groq key |
