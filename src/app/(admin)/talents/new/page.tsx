import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TalentForm } from "../talent-form";
import { createTalent } from "../actions";

export default function NewTalentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/talents">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouveau talent
        </h1>
      </div>
      <TalentForm action={createTalent} />
    </div>
  );
}
