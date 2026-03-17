import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { TalentForm } from "../../talent-form";
import { updateTalent } from "../../actions";
import type { Talent } from "@/lib/types";

export default async function EditTalentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: talent } = await supabase.from("talents").select("*").eq("id", id).single();
  if (!talent) notFound();
  const boundAction = updateTalent.bind(null, id);

  return (
    <div className="mx-auto" style={{ maxWidth: 680 }}>
      <nav className="anim-in anim-d1 mb-6 flex items-center gap-1.5 text-[13px]">
        <Link href="/talents" className="text-neutral-400 transition-colors hover:text-neutral-600">Talents</Link>
        <span className="text-neutral-300">›</span>
        <Link href={`/talents/${id}`} className="text-neutral-400 transition-colors hover:text-neutral-600">{(talent as Talent).name}</Link>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-900">Modifier</span>
      </nav>
      <div className="anim-in anim-d2">
        <TalentForm talent={talent as Talent} action={boundAction} />
      </div>
    </div>
  );
}
