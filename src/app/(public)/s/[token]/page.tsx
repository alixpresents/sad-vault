import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createServiceClient } from "@/lib/supabase-service";
import type { Video, ShareLink, Talent } from "@/lib/types";
import { ShareView } from "./share-view";

/** Find a share link by custom_slug first, then by token */
async function findLink(supabase: ReturnType<typeof createServiceClient>, param: string) {
  // Try custom_slug first
  const { data: bySlug } = await supabase
    .from("share_links")
    .select("*")
    .eq("custom_slug", param)
    .single();
  if (bySlug) return bySlug as ShareLink;

  // Fall back to token
  const { data: byToken } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", param)
    .single();
  if (byToken) return byToken as ShareLink;

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceClient();
  const link = await findLink(supabase, token);

  if (!link) {
    return { title: "Lien introuvable" };
  }

  const title = link.title || "Reel";
  const videoCount = link.video_ids?.length ?? 0;

  let talentName: string | null = null;
  if (link.talent_id) {
    const { data: talent } = await supabase
      .from("talents")
      .select("name")
      .eq("id", link.talent_id)
      .single();
    if (talent) talentName = (talent as Talent).name;
  }

  const description = talentName
    ? `${talentName} · ${videoCount} video${videoCount !== 1 ? "s" : ""}`
    : `${videoCount} video${videoCount !== 1 ? "s" : ""}`;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://reel.sad-pictures.com";

  // Get a presigned R2 URL for the first video's thumbnail (lightweight JPEG, no ImageResponse)
  let ogImageUrl: string | undefined;
  if (link.video_ids?.length > 0) {
    const { data: videos } = await supabase
      .from("videos")
      .select("id, thumbnail_key")
      .in("id", link.video_ids);
    if (videos) {
      const videoMap = new Map<string, string | null>();
      for (const v of videos as { id: string; thumbnail_key: string | null }[]) {
        videoMap.set(v.id, v.thumbnail_key);
      }
      for (const id of link.video_ids) {
        const thumbKey = videoMap.get(id);
        if (thumbKey) {
          try {
            const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: thumbKey });
            ogImageUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });
          } catch { /* ignore */ }
          if (ogImageUrl) break;
        }
      }
    }
  }

  const metadata: Metadata = {
    title,
    description,
    metadataBase: new URL(baseUrl),
    openGraph: {
      title,
      description,
      type: "video.other",
      siteName: "Sad Pictures",
      ...(ogImageUrl && {
        images: [{ url: ogImageUrl, alt: title }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImageUrl && { images: [ogImageUrl] }),
    },
    robots: {
      index: true,
      follow: true,
    },
  };

  return metadata;
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: param } = await params;
  const supabase = createServiceClient();
  const link = await findLink(supabase, param);

  if (!link) notFound();

  // If accessed via token but has a custom_slug, redirect to the pretty URL
  if (link.custom_slug && param === link.token) {
    redirect(`/s/${link.custom_slug}`);
  }

  // Check inactive or expired
  const isUnavailable = link.is_active === false;
  const isExpired = link.expires_at && new Date(link.expires_at) < new Date();

  if (isUnavailable || isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-sad-pictures.png" alt="Sad Pictures" className="h-8 w-auto opacity-70" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">
            {isUnavailable ? "Ce lien n'est plus disponible" : "Ce lien a expire"}
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
    .in("id", link.video_ids);

  const orderedVideos = link.video_ids
    .map((id) => (videos as Video[])?.find((v) => v.id === id))
    .filter(Boolean) as Video[];

  let talentName: string | null = null;
  if (link.talent_id) {
    const { data: talent } = await supabase
      .from("talents")
      .select("name")
      .eq("id", link.talent_id)
      .single();
    if (talent) talentName = (talent as Talent).name;
  }

  // Increment view count
  supabase
    .from("share_links")
    .update({ view_count: link.view_count + 1 })
    .eq("id", link.id)
    .then();

  return (
    <ShareView
      videos={orderedVideos}
      token={link.token}
      shareLinkId={link.id}
      title={link.title}
      talentName={talentName}
      allowDownload={link.allow_download}
      filmstripStyle={link.filmstrip_style ?? "thumbnails"}
    />
  );
}
