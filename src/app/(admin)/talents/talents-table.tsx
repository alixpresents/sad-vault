"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Talent } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteTalent } from "./actions";

const avatarColors = [
  { bg: "bg-blue-50", text: "text-blue-500" },
  { bg: "bg-purple-50", text: "text-purple-500" },
  { bg: "bg-emerald-50", text: "text-emerald-500" },
  { bg: "bg-amber-50", text: "text-amber-500" },
];

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function TalentsTable({ talents }: { talents: Talent[] }) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await deleteTalent(deleteId);
    setDeleting(false);
    setDeleteId(null);
  }

  if (talents.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-200 py-14 text-center">
        <p className="text-[14px] font-medium text-neutral-500">Aucun talent pour le moment</p>
        <p className="mt-1 text-[13px] text-neutral-400">Ajoutez votre premier talent</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        {talents.map((talent, idx) => {
          const ac = avatarColors[idx % avatarColors.length];
          return (
            <Link
              key={talent.id}
              href={`/talents/${talent.id}`}
              className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 ${
                idx < talents.length - 1 ? "border-b border-neutral-100" : ""
              }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${ac.bg} ${ac.text}`}>
                {getInitials(talent.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-neutral-900">{talent.name}</p>
                <p className="truncate text-[11px] text-neutral-400">
                  {talent.slug}
                  {talent.bio ? ` · ${talent.bio.slice(0, 50)}${talent.bio.length > 50 ? "..." : ""}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
                  Modifier
                </span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(talent.id); }}
                  className="rounded-md p-1.5 text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </Link>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer ce talent ?"
        message="Cette action est irreversible. Le talent et toutes ses videos associees seront supprimes."
        confirmLabel={deleting ? "Suppression..." : "Supprimer"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
