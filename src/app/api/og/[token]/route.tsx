import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createServiceClient } from "@/lib/supabase-service";
import type { ShareLink, Video, Talent } from "@/lib/types";

export const runtime = "nodejs";

async function getThumbnailUrl(thumbnailKey: string): Promise<string | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: thumbnailKey,
    });
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

  // Validate token format
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

  // Get first video thumbnail
  let thumbnailUrl: string | null = null;
  if (shareLink.video_ids.length > 0) {
    const { data: video } = await supabase
      .from("videos")
      .select("thumbnail_key")
      .eq("id", shareLink.video_ids[0])
      .single();

    if (video && (video as Video).thumbnail_key) {
      thumbnailUrl = await getThumbnailUrl((video as Video).thumbnail_key!);
    }
  }

  const videoCount = shareLink.video_ids.length;

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
        {/* Thumbnail background */}
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1200,
              height: 630,
              objectFit: "cover",
            }}
          />
        ) : null}

        {/* Gradient overlay at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 250,
            display: "flex",
            background: thumbnailUrl
              ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)"
              : "transparent",
          }}
        />

        {/* Bottom content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            padding: "0 48px 40px",
            width: "100%",
          }}
        >
          {/* Left: title + talent */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 40,
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
              {talentName
                ? `${talentName} · ${videoCount} video${videoCount !== 1 ? "s" : ""}`
                : `${videoCount} video${videoCount !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* Right: Sad Pictures text */}
          <span
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.3)",
              fontWeight: 500,
              letterSpacing: "0.05em",
            }}
          >
            Sad Pictures
          </span>
        </div>

        {/* No thumbnail fallback: centered title */}
        {!thumbnailUrl && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 28,
                color: "rgba(255,255,255,0.15)",
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase" as const,
              }}
            >
              SAD PICTURES
            </span>
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
