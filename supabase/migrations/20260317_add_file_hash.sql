-- Add file_hash and original_filename columns for duplicate detection
alter table videos add column if not exists file_hash text;
alter table videos add column if not exists original_filename text;

-- Index for fast hash lookups
create index if not exists idx_videos_file_hash on videos(file_hash) where file_hash is not null;
