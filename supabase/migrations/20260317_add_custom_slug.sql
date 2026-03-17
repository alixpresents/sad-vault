-- Add custom_slug column to share_links
alter table share_links add column if not exists custom_slug text unique;

-- Constraint: 3-50 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens
alter table share_links add constraint custom_slug_format
  check (custom_slug is null or (
    length(custom_slug) >= 3
    and length(custom_slug) <= 50
    and custom_slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
  ));

-- Index for fast lookups
create index if not exists idx_share_links_custom_slug on share_links(custom_slug) where custom_slug is not null;
