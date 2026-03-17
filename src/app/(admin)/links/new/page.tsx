import Link from "next/link";
import { createServerClient } from "@/lib/supabase-server";
import type { Talent, Video } from "@/lib/types";
import { ShareLinkForm } from "./share-link-form";

export default async function NewLinkPage({ searchParams }: { searchParams: Promise<{ videos?: string }> }) {
  const { videos: preSelectedVideos } = await searchParams;
  const supabase = await createServerClient();
  const [{ data: talents }, { data: videos }] = await Promise.all([
    supabase.from("talents").select("*").order("name"),
    supabase.from("videos").select("*").order("created_at", { ascending: false }),
  ]);

  // Parse pre-selected video IDs from URL
  const initialVideoIds = preSelectedVideos ? preSelectedVideos.split(",").filter(Boolean) : undefined;

  return (
    <div className="mx-auto" style={{ maxWidth: 680 }}>
      <nav className="anim-in anim-d1 mb-6 flex items-center gap-1.5 text-[13px]">
        <Link href="/links" className="text-neutral-400 transition-colors hover:text-neutral-600">Liens</Link>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-900">Nouveau lien de partage</span>
      </nav>
      <div className="anim-in anim-d2">
        <ShareLinkForm talents={(talents as Talent[]) ?? []} videos={(videos as Video[]) ?? []} initialVideoIds={initialVideoIds} />
      </div>
    </div>
  );
}
