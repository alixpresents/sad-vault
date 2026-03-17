import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import type { ShareLink, Video, Talent } from "@/lib/types";
import { EditLinkForm } from "./edit-link-form";

export default async function EditLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: link } = await supabase
    .from("share_links")
    .select("*")
    .eq("id", id)
    .single();

  if (!link) notFound();

  const shareLink = link as ShareLink;

  // Fetch all videos (for adding new ones)
  const { data: allVideos } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch talents for filtering
  const { data: talents } = await supabase
    .from("talents")
    .select("*")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/links">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Modifier le lien
        </h1>
      </div>
      <EditLinkForm
        link={shareLink}
        allVideos={(allVideos as Video[]) ?? []}
        talents={(talents as Talent[]) ?? []}
      />
    </div>
  );
}
