-- Minimal operational telemetry for the protected admin dashboard.
create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  mode text not null,
  is_guest boolean not null default false,
  succeeded boolean not null default false,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_created_idx on public.ai_usage_events (created_at desc);
create index if not exists ai_usage_user_idx on public.ai_usage_events (user_id, created_at desc);
alter table public.ai_usage_events enable row level security;
-- No client policies: only server-side service-role code can write/read telemetry.
