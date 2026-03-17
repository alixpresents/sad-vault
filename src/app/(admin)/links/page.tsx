import Link from "next/link";
import { createServerClient } from "@/lib/supabase-server";
import type { ShareLink, Talent } from "@/lib/types";
import { LinksTable } from "./links-table";

export default async function LinksPage() {
  const supabase = await createServerClient();
  const [{ data: links }, { data: talents }] = await Promise.all([
    supabase.from("share_links").select("*").order("created_at", { ascending: false }),
    supabase.from("talents").select("id, name"),
  ]);
  const talentMap = new Map<string, string>();
  for (const t of (talents ?? []) as { id: string; name: string }[]) talentMap.set(t.id, t.name);

  return (
    <div>
      <div className="anim-in anim-d1 mb-6 flex items-center justify-between">
        <h1 className="text-[15px] font-semibold text-neutral-900">Liens de partage</h1>
        <Link href="/links/new" className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800">
          + Creer un lien
        </Link>
      </div>
      <div className="anim-in anim-d2">
        <LinksTable links={(links as ShareLink[]) ?? []} talentMap={talentMap} />
      </div>
    </div>
  );
}
