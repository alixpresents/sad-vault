import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import type { Talent, Video } from "@/lib/types";
import { ShareLinkForm } from "./share-link-form";

export default async function NewLinkPage() {
  const supabase = await createServerClient();

  const [{ data: talents }, { data: videos }] = await Promise.all([
    supabase.from("talents").select("*").order("name"),
    supabase.from("videos").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/links">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouveau lien de partage
        </h1>
      </div>
      <ShareLinkForm
        talents={(talents as Talent[]) ?? []}
        videos={(videos as Video[]) ?? []}
      />
    </div>
  );
}
