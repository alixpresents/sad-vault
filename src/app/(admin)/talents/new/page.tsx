import Link from "next/link";
import { TalentForm } from "../talent-form";
import { createTalent } from "../actions";

export default function NewTalentPage() {
  return (
    <div className="mx-auto" style={{ maxWidth: 680 }}>
      <nav className="anim-in anim-d1 mb-6 flex items-center gap-1.5 text-[13px]">
        <Link href="/talents" className="text-neutral-400 transition-colors hover:text-neutral-600">Talents</Link>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-900">Nouveau talent</span>
      </nav>
      <div className="anim-in anim-d2">
        <TalentForm action={createTalent} />
      </div>
    </div>
  );
}
