import Link from "next/link";
import { createServerClient } from "@/lib/supabase-server";
import type { Talent } from "@/lib/types";
import { TalentsTable } from "./talents-table";

export default async function TalentsPage() {
  const supabase = await createServerClient();
  const { data: talents } = await supabase
    .from("talents")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="anim-in anim-d1 mb-6 flex items-center justify-between">
        <h1 className="text-[15px] font-semibold text-neutral-900">Talents</h1>
        <Link
          href="/talents/new"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800"
        >
          + Ajouter un talent
        </Link>
      </div>
      <div className="anim-in anim-d2">
        <TalentsTable talents={(talents as Talent[]) ?? []} />
      </div>
    </div>
  );
}
