import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { TalentForm } from "../../talent-form";
import { updateTalent } from "../../actions";
import type { Talent } from "@/lib/types";

export default async function EditTalentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: talent } = await supabase
    .from("talents")
    .select("*")
    .eq("id", id)
    .single();

  if (!talent) notFound();

  const boundAction = updateTalent.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/talents">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Modifier {(talent as Talent).name}
        </h1>
      </div>
      <TalentForm talent={talent as Talent} action={boundAction} />
    </div>
  );
}
