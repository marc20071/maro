-- Chat history management: pinning and folders. Additive and safe to re-run. Run after 001_base.sql.
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
create index if not exists folders_user_idx on public.folders (user_id, created_at);
alter table public.folders enable row level security;
drop policy if exists "folders_all_own" on public.folders;
create policy "folders_all_own" on public.folders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.conversations add column if not exists pinned boolean not null default false;
alter table public.conversations add column if not exists folder_id uuid references public.folders(id) on delete set null;
create index if not exists conversations_user_pinned_idx on public.conversations (user_id, pinned, updated_at desc);
create index if not exists conversations_folder_idx on public.conversations (folder_id);

-- A conversation may only be placed in a folder owned by the same user.
create or replace function public.check_conversation_folder() returns trigger
language plpgsql as $$
begin
  if new.folder_id is not null and not exists (select 1 from public.folders f where f.id = new.folder_id and f.user_id = new.user_id) then
    raise exception 'folder does not belong to user';
  end if;
  return new;
end $$;
drop trigger if exists conversations_folder_check on public.conversations;
create trigger conversations_folder_check before insert or update of folder_id on public.conversations for each row execute function public.check_conversation_folder();
