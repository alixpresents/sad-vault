import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import type { ShareLink, Video, Talent } from "@/lib/types";
import { EditLinkForm } from "./edit-link-form";
import { LinkAnalytics } from "./link-analytics";

export default async function EditLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: link } = await supabase.from("share_links").select("*").eq("id", id).single();
  if (!link) notFound();
  const shareLink = link as ShareLink;
  const { data: allVideos } = await supabase.from("videos").select("*").order("created_at", { ascending: false });
  const { data: talents } = await supabase.from("talents").select("*").order("name");

  return (
    <div className="mx-auto" style={{ maxWidth: 680 }}>
      <nav className="anim-in anim-d1 mb-6 flex items-center gap-1.5 text-[13px]">
        <Link href="/links" className="text-neutral-400 transition-colors hover:text-neutral-600">Liens</Link>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-900">{shareLink.title || "Sans titre"}</span>
      </nav>
      <div className="anim-in anim-d2">
        <EditLinkForm link={shareLink} allVideos={(allVideos as Video[]) ?? []} talents={(talents as Talent[]) ?? []} />
      </div>
      <div className="anim-in anim-d3">
        <LinkAnalytics shareLinkId={shareLink.id} videos={(allVideos as Video[]) ?? []} />
      </div>
    </div>
  );
}
