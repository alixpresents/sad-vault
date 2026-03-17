import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";

// In-memory rate limiter
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { share_link_id, video_id, session_id, duration_seconds, completed } = body;

  if (!share_link_id || !video_id || !session_id) {
    return NextResponse.json(
      { error: "share_link_id, video_id, session_id required" },
      { status: 400 }
    );
  }

  // Validate UUIDs
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(share_link_id) || !uuidRe.test(video_id) || !uuidRe.test(session_id)) {
    return NextResponse.json({ error: "Invalid UUID" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const country = request.headers.get("x-vercel-ip-country") ?? null;

  const supabase = createServiceClient();

  // Upsert: update duration/completed if same session+video, otherwise insert
  // Use session_id + video_id as the natural key
  const { data: existing } = await supabase
    .from("view_events")
    .select("id, duration_seconds, completed")
    .eq("session_id", session_id)
    .eq("video_id", video_id)
    .eq("share_link_id", share_link_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Update with the max duration and completed flag
    const newDuration = Math.max(
      existing.duration_seconds ?? 0,
      typeof duration_seconds === "number" ? Math.round(duration_seconds) : 0
    );
    const newCompleted = existing.completed || completed === true;

    const { error } = await supabase
      .from("view_events")
      .update({ duration_seconds: newDuration, completed: newCompleted })
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // Insert new event
    const { error } = await supabase.from("view_events").insert({
      share_link_id,
      video_id,
      session_id,
      duration_seconds: typeof duration_seconds === "number" ? Math.round(duration_seconds) : 0,
      completed: completed === true,
      user_agent: userAgent,
      ip_country: country,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
