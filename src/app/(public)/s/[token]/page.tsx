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
    .select("title, talent_id, video_ids")
    .eq("token", token)
    .single();

  if (!link) {
    return { title: "Lien introuvable" };
  }

  const shareLink = link as { title: string | null; talent_id: string | null; video_ids: string[] };
  const title = shareLink.title || "Reel";
  const videoCount = shareLink.video_ids?.length ?? 0;

  // Fetch talent name for description
  let talentName: string | null = null;
  if (shareLink.talent_id) {
    const { data: talent } = await supabase
      .from("talents")
      .select("name")
      .eq("id", shareLink.talent_id)
      .single();
    if (talent) talentName = (talent as Talent).name;
  }

  const description = talentName
    ? `${talentName} · ${videoCount} video${videoCount !== 1 ? "s" : ""}`
    : `${videoCount} video${videoCount !== 1 ? "s" : ""}`;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://reel.sad-pictures.com";
  const ogImageUrl = `${baseUrl}/api/og/${token}`;

  return {
    title,
    description,
    metadataBase: new URL(baseUrl),
    openGraph: {
      title,
      description,
      type: "video.other",
      siteName: "Sad Pictures",
      images: [
        {
          url: ogImageUrl,
          width: 900,
          height: 470,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
    },
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
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-sad-pictures.png" alt="Sad Pictures" className="h-8 w-auto opacity-70" />
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
      shareLinkId={shareLink.id}
      title={shareLink.title}
      talentName={talentName}
      allowDownload={shareLink.allow_download}
    />
  );
}
