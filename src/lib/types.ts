export type Talent = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

export type Video = {
  id: string;
  talent_id: string;
  title: string;
  r2_key: string;
  thumbnail_key: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  created_at: string;
};

export type ShareLink = {
  id: string;
  token: string;
  custom_slug: string | null;
  title: string | null;
  talent_id: string | null;
  video_ids: string[];
  expires_at: string | null;
  allow_download: boolean;
  is_active: boolean;
  view_count: number;
  created_at: string;
  created_by: string | null;
};
