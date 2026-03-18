-- Add filmstrip_style column to share_links
alter table share_links add column if not exists filmstrip_style text not null default 'thumbnails';
