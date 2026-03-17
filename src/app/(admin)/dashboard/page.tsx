import Link from "next/link";
import { createServerClient } from "@/lib/supabase-server";

const avatarColors = [
  { bg: "bg-blue-50", text: "text-blue-500" },
  { bg: "bg-purple-50", text: "text-purple-500" },
  { bg: "bg-emerald-50", text: "text-emerald-500" },
  { bg: "bg-amber-50", text: "text-amber-500" },
];

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
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

function getLinkStatus(expiresAt: string | null, isActive?: boolean) {
  if (isActive === false) return "inactive" as const;
  if (expiresAt) {
    const exp = new Date(expiresAt);
    if (exp <= new Date()) return "expired" as const;
    if ((exp.getTime() - Date.now()) / 86400000 <= 7) return "expiring" as const;
  }
  return "active" as const;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

const statusConfig = {
  active: { borderColor: "border-t-emerald-400", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400", label: "Actif" },
  expiring: { borderColor: "border-t-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400", label: "" },
  expired: { borderColor: "border-t-neutral-300", badge: "bg-neutral-100 text-neutral-500 border-neutral-200", dot: "bg-neutral-400", label: "Expire" },
  inactive: { borderColor: "border-t-neutral-200", badge: "bg-neutral-100 text-neutral-400 border-neutral-200", dot: "bg-neutral-300", label: "Inactif" },
};

export default async function DashboardPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [
    { count: talentCount },
    { count: videoCount },
    { count: linkCount },
    { data: recentLinks },
    { data: talents },
    { data: totalSizeData },
    { data: viewSumData },
    { data: activeLinksData },
  ] = await Promise.all([
    supabase.from("talents").select("*", { count: "exact", head: true }),
    supabase.from("videos").select("*", { count: "exact", head: true }),
    supabase.from("share_links").select("*", { count: "exact", head: true }),
    supabase
      .from("share_links")
      .select("id, token, title, talent_id, video_ids, view_count, created_at, expires_at, is_active, talents(name)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("talents").select("id, name, slug").order("name"),
    supabase.from("videos").select("file_size_bytes"),
    supabase.from("share_links").select("view_count"),
    supabase.from("share_links").select("id, expires_at, is_active"),
  ]);

  const totalSize = (totalSizeData || []).reduce((sum: number, v: { file_size_bytes: number | null }) => sum + (v.file_size_bytes || 0), 0);
  const totalViews = (viewSumData || []).reduce((sum: number, l: { view_count: number }) => sum + (l.view_count || 0), 0);
  const activeLinks = (activeLinksData || []).filter((l: { id: string; expires_at: string | null; is_active: boolean }) =>
    l.is_active !== false && (!l.expires_at || new Date(l.expires_at) > new Date())
  ).length;

  // Counts per talent
  const talentVideoCount: Record<string, number> = {};
  const talentLinkCount: Record<string, number> = {};
  if (talents) {
    const { data: videos } = await supabase.from("videos").select("talent_id");
    const { data: links } = await supabase.from("share_links").select("talent_id");
    for (const v of videos || []) talentVideoCount[v.talent_id] = (talentVideoCount[v.talent_id] || 0) + 1;
    for (const l of links || []) if (l.talent_id) talentLinkCount[l.talent_id] = (talentLinkCount[l.talent_id] || 0) + 1;
  }

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Alix";
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto" style={{ maxWidth: 680 }}>
      {/* Greeting */}
      <div className="anim-in anim-d1 mb-8">
        <h1 className="text-[20px] font-semibold tracking-tight text-neutral-900">
          Bonjour {userName}
        </h1>
        <p className="mt-0.5 text-[13px] capitalize text-neutral-400">{today}</p>
      </div>

      {/* Stats */}
      <div className="anim-in anim-d2 mb-8 grid grid-cols-4 gap-3">
        {[
          { label: "Talents", value: talentCount ?? 0, sub: null },
          { label: "Videos", value: videoCount ?? 0, sub: totalSize > 0 ? formatFileSize(totalSize) : null },
          { label: "Liens actifs", value: activeLinks, sub: `${linkCount ?? 0} au total` },
          { label: "Vues", value: totalViews, sub: null },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{stat.label}</p>
            <p className="mt-0.5 text-[20px] font-semibold tabular-nums text-neutral-900">{stat.value}</p>
            {stat.sub && <p className="mt-0.5 text-[10px] text-neutral-400">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Recent links header */}
      <div className="anim-in anim-d3 mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Liens recents</p>
        <div className="flex gap-2">
          <Link
            href="/links"
            className="text-[12px] text-neutral-400 transition-colors hover:text-neutral-600"
          >
            Voir tout
          </Link>
          <Link
            href="/links/new"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800"
          >
            + Nouveau lien
          </Link>
        </div>
      </div>

      {/* Recent links grid */}
      <div className="anim-in anim-d4 mb-8 grid grid-cols-2 gap-3">
        {recentLinks && recentLinks.length > 0 ? (
          recentLinks.map(
            (link: {
              id: string;
              token: string;
              title: string | null;
              talent_id: string | null;
              video_ids: string[];
              view_count: number;
              created_at: string;
              expires_at: string | null;
              is_active: boolean;
              talents: { name: string }[] | { name: string } | null;
            }) => {
              const status = getLinkStatus(link.expires_at, link.is_active);
              const cfg = statusConfig[status];
              let badgeLabel = cfg.label;
              if (status === "expiring" && link.expires_at) {
                const days = Math.ceil((new Date(link.expires_at).getTime() - Date.now()) / 86400000);
                badgeLabel = `Expire ${days}j`;
              }
              const talentName = link.talents
                ? Array.isArray(link.talents) ? link.talents[0]?.name : link.talents.name
                : null;
              const videoCount = Array.isArray(link.video_ids) ? link.video_ids.length : 0;

              const isInactive = status === "inactive";

              return (
                <Link
                  key={link.id}
                  href={`/links/${link.id}/edit`}
                  className={`group rounded-lg border border-neutral-200 border-t-2 ${cfg.borderColor} bg-white p-4 shadow-sm transition-all hover:shadow-md ${isInactive ? "opacity-60" : ""}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="truncate text-[13px] font-semibold text-neutral-900">
                      {link.title || "Sans titre"}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {badgeLabel}
                    </span>
                  </div>
                  {talentName && (
                    <p className="mb-1.5 text-[12px] text-neutral-500">{talentName}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                    <span>{videoCount} video{videoCount !== 1 ? "s" : ""}</span>
                    <span>{link.view_count} vue{link.view_count !== 1 ? "s" : ""}</span>
                    <span className="ml-auto">{getRelativeTime(link.created_at)}</span>
                  </div>
                </Link>
              );
            }
          )
        ) : (
          <div className="col-span-2 flex flex-col items-center rounded-lg border border-dashed border-neutral-200 py-14 text-center">
            <p className="text-[14px] font-medium text-neutral-500">Aucun lien de partage</p>
            <p className="mt-1 text-[13px] text-neutral-400">Creez votre premier lien pour partager des videos</p>
            <Link
              href="/links/new"
              className="mt-4 rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Creer un lien
            </Link>
          </div>
        )}
      </div>

      {/* Talents */}
      <div className="anim-in anim-d5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Talents</p>
          <Link
            href="/talents/new"
            className="text-[12px] text-neutral-400 transition-colors hover:text-neutral-600"
          >
            + Ajouter
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {talents && talents.length > 0 ? (
            talents.map((talent: { id: string; name: string; slug: string }, idx: number) => {
              const ac = avatarColors[idx % avatarColors.length];
              const vc = talentVideoCount[talent.id] || 0;
              const lc = talentLinkCount[talent.id] || 0;
              return (
                <Link
                  key={talent.id}
                  href={`/talents/${talent.id}`}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${ac.bg} ${ac.text}`}>
                    {getInitials(talent.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-neutral-900">{talent.name}</p>
                    <p className="text-[11px] text-neutral-400">
                      {vc} video{vc !== 1 ? "s" : ""} · {lc} lien{lc !== 1 ? "s" : ""}
                    </p>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="col-span-2 flex flex-col items-center rounded-lg border border-dashed border-neutral-200 py-14 text-center">
              <p className="text-[14px] font-medium text-neutral-500">Aucun talent</p>
              <Link
                href="/talents/new"
                className="mt-4 rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800"
              >
                Ajouter un talent
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
