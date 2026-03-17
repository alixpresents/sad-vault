import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import type { Talent } from "@/lib/types";
import { TalentsTable } from "./talents-table";

export default async function TalentsPage() {
  const supabase = await createServerClient();
  const { data: talents } = await supabase
    .from("talents")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Talents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerez vos talents et leurs profils.
          </p>
        </div>
        <Button asChild>
          <Link href="/talents/new">
            <Plus />
            Ajouter un talent
          </Link>
        </Button>
      </div>
      <TalentsTable talents={(talents as Talent[]) ?? []} />
    </div>
  );
}
