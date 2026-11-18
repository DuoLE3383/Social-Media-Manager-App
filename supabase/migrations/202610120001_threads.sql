create table if not exists public.threads_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  threads_user_id text not null,
  threads_username text,
  encrypted_access_token text not null,
  token_iv text not null,
  token_auth_tag text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.threads_connections enable row level security;
drop policy if exists "Users view own Threads connection" on public.threads_connections;
create policy "Users view own Threads connection" on public.threads_connections
  for select using (auth.uid() = user_id);

create table if not exists public.threads_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  threads_post_id text not null,
  container_id text,
  text_content text,
  media_paths text[] not null default '{}',
  status text not null default 'published' check (status in ('published', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists threads_posts_user_created_idx
  on public.threads_posts (user_id, created_at desc);
alter table public.threads_posts enable row level security;
drop policy if exists "Users view own Threads posts" on public.threads_posts;
create policy "Users view own Threads posts" on public.threads_posts
  for select using (auth.uid() = user_id);

-- The API accesses these tables only from the backend with its service-role key.
-- Keep them unavailable to anon/authenticated and grant only the required server role.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.threads_connections, public.threads_posts to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('threads-media', 'threads-media', false, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own Threads media" on storage.objects;
create policy "Users upload own Threads media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'threads-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users read own Threads media" on storage.objects;
create policy "Users read own Threads media" on storage.objects
  for select to authenticated
  using (bucket_id = 'threads-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own Threads media" on storage.objects;
create policy "Users delete own Threads media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'threads-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
