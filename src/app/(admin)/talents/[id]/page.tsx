import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { VideoCard } from "@/components/video-card";
import type { Talent, Video } from "@/lib/types";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: talent } = await supabase.from("talents").select("name").eq("id", id).single();
  return { title: talent ? (talent as { name: string }).name : "Talent" };
}

export default async function TalentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: talent } = await supabase.from("talents").select("*").eq("id", id).single();
  if (!talent) notFound();
  const { data: videos } = await supabase.from("videos").select("*").eq("talent_id", id).order("created_at", { ascending: false });
  const t = talent as Talent;
  const v = (videos as Video[]) ?? [];

  return (
    <div>
      <nav className="anim-in anim-d1 mb-1 flex items-center gap-1.5 text-[13px]">
        <Link href="/talents" className="text-neutral-400 transition-colors hover:text-neutral-600">Talents</Link>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-900">{t.name}</span>
      </nav>

      <div className="anim-in anim-d2 mb-6 flex items-center justify-between">
        <div>
          {t.bio && <p className="mt-1 text-[13px] text-neutral-500">{t.bio}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/talents/${id}/edit`} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50">
            Modifier
          </Link>
          <Link href={`/uploads?talent=${id}`} className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800">
            Upload
          </Link>
        </div>
      </div>

      <p className="anim-in anim-d3 mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Videos ({v.length})
      </p>

      <div className="anim-in anim-d4">
        {v.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-200 py-14 text-center">
            <p className="text-[14px] font-medium text-neutral-500">Aucune video pour ce talent</p>
            <Link href={`/uploads?talent=${id}`} className="mt-4 rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800">
              Uploader une video
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {v.map((video) => (
              <VideoCard key={video.id} video={video} talentSlug={t.slug} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
