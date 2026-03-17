import { createServerClient } from "@/lib/supabase-server";
import type { Talent, Video } from "@/lib/types";
import { VideosGallery } from "./videos-gallery";

export type VideoWithTalent = Video & { talent_name: string; talent_slug: string; talent_id: string };
export type VideoStats = { link_count: number; view_count: number };

export default async function VideosPage() {
  const supabase = await createServerClient();

  const [{ data: videos }, { data: talents }, { data: shareLinks }] = await Promise.all([
    supabase.from("videos").select("*").order("created_at", { ascending: false }),
    supabase.from("talents").select("id, name, slug"),
    supabase.from("share_links").select("video_ids, view_count"),
  ]);

  // Build talent map
  const talentMap = new Map<string, { name: string; slug: string }>();
  for (const t of (talents ?? []) as Talent[]) {
    talentMap.set(t.id, { name: t.name, slug: t.slug });
  }

  // Enrich videos with talent info
  const enrichedVideos: VideoWithTalent[] = ((videos ?? []) as Video[]).map((v) => {
    const t = talentMap.get(v.talent_id);
    return {
      ...v,
      talent_name: t?.name ?? "Inconnu",
      talent_slug: t?.slug ?? "",
    };
  });

  // Compute per-video stats: how many links include it, total views across all links
  const videoStats = new Map<string, VideoStats>();
  for (const link of (shareLinks ?? []) as { video_ids: string[]; view_count: number }[]) {
    for (const vid of link.video_ids) {
      const existing = videoStats.get(vid) ?? { link_count: 0, view_count: 0 };
      existing.link_count++;
      existing.view_count += link.view_count;
      videoStats.set(vid, existing);
    }
  }

  // Unique talent list for filter pills
  const talentList = Array.from(talentMap.entries())
    .map(([id, t]) => ({ id, name: t.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Serialize stats to plain object
  const statsObj: Record<string, VideoStats> = {};
  for (const [k, v] of videoStats) statsObj[k] = v;

  return (
    <div className="mx-auto" style={{ maxWidth: 960 }}>
      <VideosGallery
        videos={enrichedVideos}
        talents={talentList}
        stats={statsObj}
      />
    </div>
  );
}
