-- Apply in the Supabase SQL editor. Each user owns their own starter workspace data.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  brand_voice text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  audience text not null default '',
  voice text not null default '',
  goals text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Custom',
  prompt text not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid,
  title text not null default '',
  body text not null default '',
  platform text,
  status text not null default 'draft' check (status in ('draft', 'planned', 'published', 'archived')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, brand_id) references public.brands(user_id, id) on delete set null (brand_id)
);

create table if not exists public.prompt_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid,
  content_item_id uuid,
  template_id uuid,
  provider text not null,
  model text not null,
  prompt text not null,
  output text not null,
  created_at timestamptz not null default now(),
  foreign key (user_id, brand_id) references public.brands(user_id, id) on delete set null (brand_id),
  foreign key (user_id, content_item_id) references public.content_items(user_id, id) on delete set null (content_item_id),
  foreign key (user_id, template_id) references public.prompt_templates(user_id, id) on delete set null (template_id)
);

create table if not exists public.post_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_item_id uuid not null,
  recorded_at timestamptz not null default now(),
  impressions bigint not null default 0 check (impressions >= 0),
  reach bigint not null default 0 check (reach >= 0),
  likes bigint not null default 0 check (likes >= 0),
  comments bigint not null default 0 check (comments >= 0),
  shares bigint not null default 0 check (shares >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  foreign key (user_id, content_item_id) references public.content_items(user_id, id) on delete cascade
);

create table if not exists public.billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'free' check (plan in ('free', 'pro', 'team')),
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- OAuth page tokens are encrypted by the API and must never be read from the browser.
create table if not exists public.meta_page_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id text not null,
  page_name text not null,
  encrypted_access_token text not null,
  token_iv text not null,
  token_auth_tag text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, page_id)
);

create index if not exists brands_user_id_idx on public.brands(user_id);
create index if not exists prompts_user_updated_idx on public.prompt_templates(user_id, updated_at desc);
create index if not exists content_user_schedule_idx on public.content_items(user_id, scheduled_at);
create index if not exists runs_user_created_idx on public.prompt_runs(user_id, created_at desc);
create index if not exists metrics_content_recorded_idx on public.post_metrics(content_item_id, recorded_at desc);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.brands enable row level security;
alter table public.prompt_templates enable row level security;
alter table public.content_items enable row level security;
alter table public.prompt_runs enable row level security;
alter table public.post_metrics enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.meta_page_connections enable row level security;

create policy "Users manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users manage own settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own brands" on public.brands for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own prompt templates" on public.prompt_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own content" on public.content_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own prompt runs" on public.prompt_runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own post metrics" on public.post_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Billing mutations must happen in a trusted server/webhook using the service role.
create policy "Users read own billing account" on public.billing_accounts for select using (auth.uid() = user_id);

create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute procedure public.create_profile_for_user();
