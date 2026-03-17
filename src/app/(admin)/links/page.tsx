import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import type { ShareLink, Talent } from "@/lib/types";
import { LinksTable } from "./links-table";

export default async function LinksPage() {
  const supabase = await createServerClient();

  const [{ data: links }, { data: talents }] = await Promise.all([
    supabase
      .from("share_links")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("talents").select("id, name"),
  ]);

  // Build a talent name lookup
  const talentMap = new Map<string, string>();
  for (const t of (talents ?? []) as { id: string; name: string }[]) {
    talentMap.set(t.id, t.name);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Liens de partage
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creez et gerez des liens de partage pour vos clients.
          </p>
        </div>
        <Button asChild>
          <Link href="/links/new">
            <Plus />
            Creer un lien
          </Link>
        </Button>
      </div>
      <LinksTable
        links={(links as ShareLink[]) ?? []}
        talentMap={talentMap}
      />
    </div>
  );
}
