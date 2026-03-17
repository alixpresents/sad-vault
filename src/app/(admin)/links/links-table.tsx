"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, Trash2, ExternalLink, Pencil } from "lucide-react";
import type { ShareLink } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteShareLink, toggleShareLinkActive } from "./actions";

function getLinkStatus(link: ShareLink) {
  if (!link.is_active) return "inactive" as const;
  if (link.expires_at) {
    const exp = new Date(link.expires_at);
    if (exp <= new Date()) return "expired" as const;
    if ((exp.getTime() - Date.now()) / 86400000 <= 7) return "expiring" as const;
  }
  return "active" as const;
}

function getRelativeTime(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD < 30) return `il y a ${diffD}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const statusConfig = {
  active: { borderColor: "border-t-emerald-400", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400", label: "Actif" },
  expiring: { borderColor: "border-t-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400", label: "" },
  expired: { borderColor: "border-t-neutral-300", badge: "bg-neutral-100 text-neutral-500 border-neutral-200", dot: "bg-neutral-400", label: "Expire" },
  inactive: { borderColor: "border-t-neutral-200", badge: "bg-neutral-100 text-neutral-400 border-neutral-200", dot: "bg-neutral-300", label: "Inactif" },
};

export function LinksTable({ links, talentMap }: { links: ShareLink[]; talentMap: Map<string, string> }) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await deleteShareLink(deleteId);
    setDeleting(false);
    setDeleteId(null);
  }

  function copyLink(token: string, id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleToggle(id: string) {
    setTogglingId(id);
    await toggleShareLinkActive(id);
    setTogglingId(null);
  }

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-200 py-14 text-center">
        <p className="text-[14px] font-medium text-neutral-500">Aucun lien de partage</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {links.map((link) => {
          const status = getLinkStatus(link);
          const cfg = statusConfig[status];
          let badgeLabel = cfg.label;
          if (status === "expiring" && link.expires_at) {
            const days = Math.ceil((new Date(link.expires_at).getTime() - Date.now()) / 86400000);
            badgeLabel = `Expire ${days}j`;
          }
          const videoCount = Array.isArray(link.video_ids) ? link.video_ids.length : 0;
          const isInactive = status === "inactive";

          return (
            <div
              key={link.id}
              className={`group relative rounded-lg border border-neutral-200 border-t-2 ${cfg.borderColor} bg-white p-4 shadow-sm transition-all hover:shadow-md ${isInactive ? "opacity-60" : ""}`}
            >
              <Link href={`/links/${link.id}/edit`} className="absolute inset-0 rounded-lg" />
              <div className="relative">
                <div className="mb-2 flex items-center justify-between">
                  <span className="truncate text-[13px] font-semibold text-neutral-900">
                    {link.title || "Sans titre"}
                  </span>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggle(link.id); }}
                    disabled={togglingId === link.id}
                    className={`relative z-10 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all ${cfg.badge} ${
                      status === "expired" ? "cursor-default" : "cursor-pointer hover:opacity-80"
                    } ${togglingId === link.id ? "opacity-50" : ""}`}
                    title={status === "expired" ? "Lien expire" : isInactive ? "Cliquer pour reactiver" : "Cliquer pour desactiver"}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full transition-colors ${cfg.dot}`} />
                    {badgeLabel}
                  </button>
                </div>
                {link.talent_id && talentMap.get(link.talent_id) && (
                  <p className="mb-1.5 text-[12px] text-neutral-500">{talentMap.get(link.talent_id)}</p>
                )}
                <div className="mb-3 flex items-center gap-3 text-[11px] text-neutral-400">
                  <span>{videoCount} video{videoCount !== 1 ? "s" : ""}</span>
                  <span>{link.view_count} vue{link.view_count !== 1 ? "s" : ""}</span>
                  <span className="ml-auto">{getRelativeTime(link.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); copyLink(link.custom_slug || link.token, link.id); }}
                    className="relative z-10 rounded-md border border-neutral-200 p-1.5 text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600"
                    title="Copier le lien"
                  >
                    {copiedId === link.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <Link
                    href={`/links/${link.id}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    className="relative z-10 rounded-md border border-neutral-200 p-1.5 text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600"
                    title="Modifier"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                  <a
                    href={`/s/${link.custom_slug || link.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="relative z-10 rounded-md border border-neutral-200 p-1.5 text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600"
                    title="Ouvrir"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteId(link.id); }}
                    className="relative z-10 ml-auto rounded-md p-1.5 text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer ce lien ?"
        message="Le lien ne sera plus accessible par les personnes avec qui il a ete partage."
        confirmLabel={deleting ? "Suppression..." : "Supprimer"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
