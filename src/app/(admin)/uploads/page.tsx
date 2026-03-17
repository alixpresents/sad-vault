import { createServerClient } from "@/lib/supabase-server";
import { VideoUpload } from "@/components/video-upload";
import type { Talent } from "@/lib/types";

export default async function UploadsPage({ searchParams }: { searchParams: Promise<{ talent?: string }> }) {
  const { talent: initialTalentId } = await searchParams;
  const supabase = await createServerClient();
  const { data: talents } = await supabase.from("talents").select("*").order("name");

  return (
    <div className="mx-auto" style={{ maxWidth: 680 }}>
      <div className="anim-in anim-d1 mb-6">
        <h1 className="text-[15px] font-semibold text-neutral-900">Upload</h1>
        <p className="mt-0.5 text-[13px] text-neutral-400">Uploader une video et l'associer a un talent.</p>
      </div>
      <div className="anim-in anim-d2">
        <VideoUpload talents={(talents as Talent[]) ?? []} initialTalentId={initialTalentId} />
      </div>
    </div>
  );
}
