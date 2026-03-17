-- Add is_active column to share_links (default true)
alter table share_links add column if not exists is_active boolean not null default true;
