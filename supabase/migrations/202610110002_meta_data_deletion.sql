-- Associate stored Page tokens with the Meta app-scoped user that authorized them,
-- so Meta's signed data-deletion callback can remove only that user's Meta data.
alter table public.meta_page_connections
  add column if not exists facebook_user_id text;

create index if not exists meta_connections_facebook_user_idx
  on public.meta_page_connections (facebook_user_id)
  where facebook_user_id is not null;

-- This private table is accessed by the API using the service-role key only.
alter table public.meta_page_connections enable row level security;
