-- Run this in Supabase SQL Editor after applying 202610120001_threads.sql.
-- The Threads backend uses service_role; these grants do not expose the tables
-- to anon or authenticated clients.
do $fix$
begin
  if to_regclass('public.threads_connections') is null
     or to_regclass('public.threads_posts') is null then
    raise exception 'Threads tables are missing. Apply supabase/migrations/202610120001_threads.sql first.';
  end if;

  execute 'grant usage on schema public to service_role';
  execute 'grant select, insert, update, delete on public.threads_connections, public.threads_posts to service_role';
end
$fix$;

notify pgrst, 'reload schema';
