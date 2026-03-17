import { createServerClient } from "@/lib/supabase-server";
import { VideoUpload } from "@/components/video-upload";
import type { Talent } from "@/lib/types";

export default async function UploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ talent?: string }>;
}) {
  const { talent: initialTalentId } = await searchParams;
  const supabase = await createServerClient();
  const { data: talents } = await supabase
    .from("talents")
    .select("*")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uploader une video et l'associer a un talent.
        </p>
      </div>
      <VideoUpload
        talents={(talents as Talent[]) ?? []}
        initialTalentId={initialTalentId}
      />
    </div>
  );
}
