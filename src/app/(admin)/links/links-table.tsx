"use client";

import { useState } from "react";
import { Copy, Trash2, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ShareLink } from "@/lib/types";
import { deleteShareLink } from "./actions";

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function LinksTable({
  links,
  talentMap,
}: {
  links: ShareLink[];
  talentMap: Map<string, string>;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await deleteShareLink(deleteId);
    setDeleting(false);
    setDeleteId(null);
  }

  function copyLink(token: string, id: string) {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun lien de partage pour le moment.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Talent</TableHead>
              <TableHead>Videos</TableHead>
              <TableHead>Vues</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead>Cree le</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => {
              const expired = isExpired(link.expires_at);
              return (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">
                    {link.title || "Sans titre"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {link.talent_id
                      ? talentMap.get(link.talent_id) ?? "-"
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {link.video_ids.length} video
                      {link.video_ids.length > 1 ? "s" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {link.view_count}
                  </TableCell>
                  <TableCell>
                    {link.expires_at ? (
                      <Badge variant={expired ? "destructive" : "secondary"}>
                        {expired ? "Expire" : formatDate(link.expires_at)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Illimite</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(link.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => copyLink(link.token, link.id)}
                      >
                        {copiedId === link.id ? (
                          <Check className="text-green-600" />
                        ) : (
                          <Copy />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon-xs" asChild>
                        <a
                          href={`/s/${link.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeleteId(link.id)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce lien ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le lien ne sera plus accessible par les personnes avec qui il a ete
              partage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
