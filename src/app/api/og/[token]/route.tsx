import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createServiceClient } from "@/lib/supabase-service";
import type { ShareLink, Talent } from "@/lib/types";

export const runtime = "nodejs";

async function getPresignedUrl(key: string): Promise<string | null> {
  try {
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    return await getSignedUrl(r2, command, { expiresIn: 300 });
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!/^[a-z0-9]+$/.test(token) || token.length < 12) {
    return new Response("Invalid token", { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: link } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", token)
    .single();

  if (!link) {
    return new Response("Not found", { status: 404 });
  }

  const shareLink = link as ShareLink;
  const linkTitle = shareLink.title || "Reel";

  // Fetch talent name
  let talentName: string | null = null;
  if (shareLink.talent_id) {
    const { data: talent } = await supabase
      .from("talents")
      .select("name")
      .eq("id", shareLink.talent_id)
      .single();
    if (talent) talentName = (talent as Talent).name;
  }

  // Find the first video that has a thumbnail_key, in video_ids order
  let thumbnailUrl: string | null = null;
  if (shareLink.video_ids.length > 0) {
    const { data: videos } = await supabase
      .from("videos")
      .select("id, thumbnail_key")
      .in("id", shareLink.video_ids);

    if (videos) {
      // Build a map so we can iterate in video_ids order
      const videoMap = new Map<string, string | null>();
      for (const v of videos as { id: string; thumbnail_key: string | null }[]) {
        videoMap.set(v.id, v.thumbnail_key);
      }

      for (const id of shareLink.video_ids) {
        const thumbKey = videoMap.get(id);
        if (thumbKey) {
          thumbnailUrl = await getPresignedUrl(thumbKey);
          if (thumbnailUrl) break;
        }
      }
    }
  }

  const videoCount = shareLink.video_ids.length;
  const subtitle = talentName
    ? `${talentName} · ${videoCount} video${videoCount !== 1 ? "s" : ""}`
    : `${videoCount} video${videoCount !== 1 ? "s" : ""}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          backgroundColor: "#000",
          position: "relative",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Thumbnail background - full cover */}
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            width={1200}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1200,
              height: 630,
              objectFit: "cover",
            }}
          />
        )}

        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: thumbnailUrl ? 260 : 630,
            display: "flex",
            background: thumbnailUrl
              ? "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)"
              : "transparent",
          }}
        />

        {/* Fallback centered watermark when no thumbnail */}
        {!thumbnailUrl && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 32,
                color: "rgba(255,255,255,0.1)",
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase" as const,
              }}
            >
              SAD PICTURES
            </span>
          </div>
        )}

        {/* Bottom bar */}
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            padding: "0 48px 44px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 42,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1.1,
              }}
            >
              {linkTitle}
            </span>
            <span
              style={{
                fontSize: 22,
                color: "rgba(255,255,255,0.5)",
                fontWeight: 400,
              }}
            >
              {subtitle}
            </span>
          </div>
          <span
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.25)",
              fontWeight: 500,
              letterSpacing: "0.06em",
            }}
          >
            Sad Pictures
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
