-- Admin user monitoring and account status. Safe to re-run.
alter table public.profiles add column if not exists is_suspended boolean not null default false;
create index if not exists profiles_created_idx on public.profiles (created_at desc);
