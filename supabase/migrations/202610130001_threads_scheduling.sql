alter table public.threads_posts
  alter column threads_post_id drop not null,
  alter column container_id drop not null,
  add column if not exists scheduled_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists image_prompt text,
  add column if not exists calendar_day integer,
  add column if not exists content_pillar text,
  add column if not exists content_format text,
  add column if not exists source_topic text,
  add column if not exists opening_hook text,
  add column if not exists call_to_action text,
  add column if not exists production_notes text,
  add column if not exists attempts integer not null default 0,
  add column if not exists image_attempts integer not null default 0,
  add column if not exists claimed_at timestamptz;

alter table public.threads_posts drop constraint if exists threads_posts_status_check;
alter table public.threads_posts add constraint threads_posts_status_check
  check (status in ('image_pending', 'image_generating', 'scheduled', 'processing', 'published', 'failed', 'cancelled'));

create index if not exists threads_posts_due_idx
  on public.threads_posts (scheduled_at)
  where status = 'scheduled';

create or replace function public.claim_due_threads_posts(batch_size integer default 3)
returns setof public.threads_posts
language sql
security definer
set search_path = public
as $$
  with due as (
    select id
    from public.threads_posts
    where (status = 'scheduled' and scheduled_at <= now())
       or (status = 'processing' and claimed_at < now() - interval '10 minutes' and attempts < 2)
    order by coalesce(scheduled_at, claimed_at)
    for update skip locked
    limit greatest(1, least(batch_size, 10))
  )
  update public.threads_posts as posts
  set status = 'processing', claimed_at = now(), attempts = posts.attempts + 1
  from due
  where posts.id = due.id
  returning posts.*;
$$;

revoke all on function public.claim_due_threads_posts(integer) from public, anon, authenticated;
grant execute on function public.claim_due_threads_posts(integer) to service_role;

create or replace function public.claim_threads_image_jobs(batch_size integer default 1)
returns setof public.threads_posts
language sql
security definer
set search_path = public
as $$
  with due as (
    select id
    from public.threads_posts
    where status = 'image_pending'
       or (status = 'image_generating' and claimed_at < now() - interval '15 minutes' and image_attempts < 2)
    order by scheduled_at nulls last, created_at
    for update skip locked
    limit greatest(1, least(batch_size, 3))
  )
  update public.threads_posts as posts
  set status = 'image_generating', claimed_at = now(), image_attempts = posts.image_attempts + 1
  from due
  where posts.id = due.id
  returning posts.*;
$$;

revoke all on function public.claim_threads_image_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_threads_image_jobs(integer) to service_role;
