-- View events analytics table
create table if not exists view_events (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references share_links(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  session_id uuid not null,
  started_at timestamptz not null default now(),
  duration_seconds integer not null default 0,
  completed boolean not null default false,
  user_agent text,
  ip_country text,
  created_at timestamptz not null default now()
);

-- Index for querying by share link
create index if not exists idx_view_events_share_link_id on view_events(share_link_id);
-- Index for querying by session
create index if not exists idx_view_events_session_id on view_events(session_id);

-- RLS
alter table view_events enable row level security;

-- Anon users (public viewers) can insert
create policy "anon_insert_view_events" on view_events
  for insert to anon with check (true);

-- Authenticated users (admin) can read all
create policy "auth_select_view_events" on view_events
  for select to authenticated using (true);
