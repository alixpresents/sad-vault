-- Add filmstrip_keys column to videos (array of R2 keys for filmstrip frames)
alter table videos add column if not exists filmstrip_keys text[] not null default '{}';
