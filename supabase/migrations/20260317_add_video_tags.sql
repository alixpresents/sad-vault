-- Add tags column to videos
alter table videos add column if not exists tags text[] not null default '{}';

-- GIN index for array search
create index if not exists idx_videos_tags on videos using gin(tags);
