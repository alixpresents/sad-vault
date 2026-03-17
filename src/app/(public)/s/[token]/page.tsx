import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase-service";
import type { Video, ShareLink, Talent } from "@/lib/types";
import { ShareView } from "./share-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data: link } = await supabase
    .from("share_links")
    .select("title")
    .eq("token", token)
    .single();
  return {
    title: link ? (link as { title: string | null }).title ?? "Reel" : "Lien",
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: link } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", token)
    .single();

  if (!link) notFound();

  const shareLink = link as ShareLink;

  // Check expiration
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-white/40">
            Sad Pictures
          </p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">
            Ce lien a expire
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Contactez l'expediteur pour obtenir un nouveau lien.
          </p>
        </div>
      </div>
    );
  }

  // Fetch videos
  const { data: videos } = await supabase
    .from("videos")
    .select("*")
    .in("id", shareLink.video_ids);

  // Sort videos in the order of video_ids
  const orderedVideos = shareLink.video_ids
    .map((id) => (videos as Video[])?.find((v) => v.id === id))
    .filter(Boolean) as Video[];

  // Fetch talent name if linked
  let talentName: string | null = null;
  if (shareLink.talent_id) {
    const { data: talent } = await supabase
      .from("talents")
      .select("name")
      .eq("id", shareLink.talent_id)
      .single();
    if (talent) talentName = (talent as Talent).name;
  }

  // Increment view count (fire and forget)
  supabase
    .from("share_links")
    .update({ view_count: shareLink.view_count + 1 })
    .eq("id", shareLink.id)
    .then();

  return (
    <ShareView
      videos={orderedVideos}
      token={token}
      title={shareLink.title}
      talentName={talentName}
      allowDownload={shareLink.allow_download}
    />
  );
}
