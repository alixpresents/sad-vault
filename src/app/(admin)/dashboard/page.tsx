import Link from "next/link";
import { Users, Film, Link2, Eye } from "lucide-react";
import { createServerClient } from "@/lib/supabase-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const supabase = await createServerClient();

  const [
    { count: talentCount },
    { count: videoCount },
    { count: linkCount },
    { data: recentLinks },
  ] = await Promise.all([
    supabase.from("talents").select("*", { count: "exact", head: true }),
    supabase.from("videos").select("*", { count: "exact", head: true }),
    supabase.from("share_links").select("*", { count: "exact", head: true }),
    supabase
      .from("share_links")
      .select("id, token, title, view_count, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const stats = [
    { label: "Talents", value: talentCount ?? 0, icon: Users, href: "/talents" },
    { label: "Videos", value: videoCount ?? 0, icon: Film, href: "/uploads" },
    { label: "Liens", value: linkCount ?? 0, icon: Link2, href: "/links" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d'ensemble de votre vault.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent links */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Derniers liens</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/links">Voir tout</Link>
          </Button>
        </div>
        {recentLinks && recentLinks.length > 0 ? (
          <div className="mt-3 space-y-2">
            {recentLinks.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {(link as { title: string | null }).title || "Sans titre"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(link.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="size-3" />
                  {(link as { view_count: number }).view_count}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucun lien de partage.
          </p>
        )}
      </div>
    </div>
  );
}
