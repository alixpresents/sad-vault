import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Upload } from "lucide-react";
import { createServerClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VideoCard } from "@/components/video-card";
import type { Talent, Video } from "@/lib/types";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: talent } = await supabase
    .from("talents")
    .select("name")
    .eq("id", id)
    .single();
  return { title: talent ? (talent as { name: string }).name : "Talent" };
}

export default async function TalentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: talent } = await supabase
    .from("talents")
    .select("*")
    .eq("id", id)
    .single();

  if (!talent) notFound();

  const { data: videos } = await supabase
    .from("videos")
    .select("*")
    .eq("talent_id", id)
    .order("created_at", { ascending: false });

  const t = talent as Talent;
  const v = (videos as Video[]) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/talents">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {t.name}
              </h1>
              <Badge variant="secondary">{t.slug}</Badge>
            </div>
            {t.bio && (
              <p className="mt-1 text-sm text-muted-foreground">{t.bio}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 pl-10 sm:pl-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/talents/${id}/edit`}>
              <Pencil />
              Modifier
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/uploads?talent=${id}`}>
              <Upload />
              Uploader
            </Link>
          </Button>
        </div>
      </div>

      {/* Videos */}
      <div>
        <h2 className="text-lg font-medium">
          Videos ({v.length})
        </h2>
        {v.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Aucune video pour ce talent.
            </p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href={`/uploads?talent=${id}`}>
                <Upload />
                Uploader une video
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {v.map((video) => (
              <VideoCard key={video.id} video={video} talentSlug={t.slug} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
