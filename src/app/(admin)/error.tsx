"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="size-10 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold">
        Erreur de chargement
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Impossible de charger cette page. Verifiez votre connexion et reessayez.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
        Reessayer
      </Button>
    </div>
  );
}
