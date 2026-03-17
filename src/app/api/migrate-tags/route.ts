import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  // Get all videos that have tags
  const { data: videos } = await supabase
    .from("videos")
    .select("id, tags")
    .not("tags", "eq", "{}");

  if (!videos || videos.length === 0) {
    return NextResponse.json({ message: "No videos with tags found", count: 0 });
  }

  let updated = 0;
  const errors: string[] = [];

  for (const video of videos as { id: string; tags: string[] }[]) {
    if (!video.tags || video.tags.length === 0) continue;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 150,
          messages: [{
            role: "user",
            content: `Translate these French video tags to English equivalents. Keep them short (1-2 words), lowercase. Input: ${JSON.stringify(video.tags)}. Reply only in JSON: {"tags": ["tag1", "tag2", ...]}`,
          }],
        }),
      });

      if (!res.ok) {
        errors.push(`${video.id}: Claude API ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data.content?.find((c: { type: string }) => c.type === "text")?.text;
      if (!text) { errors.push(`${video.id}: empty response`); continue; }

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { errors.push(`${video.id}: no JSON`); continue; }

      const parsed = JSON.parse(jsonMatch[0]);
      const newTags = Array.isArray(parsed.tags)
        ? parsed.tags.map((t: string) => String(t).toLowerCase().trim()).filter(Boolean)
        : [];

      if (newTags.length > 0) {
        await supabase.from("videos").update({ tags: newTags }).eq("id", video.id);
        updated++;
      }
    } catch (err) {
      errors.push(`${video.id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({ updated, total: videos.length, errors });
}
