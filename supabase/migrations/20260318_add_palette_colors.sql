-- Add palette_colors column to videos (array of hex color strings extracted from filmstrip frames)
alter table videos add column if not exists palette_colors text[] not null default '{}';
