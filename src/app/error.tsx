"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">Erreur</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Quelque chose s'est mal passe
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Une erreur inattendue est survenue. Veuillez reessayer.
      </p>
      <Button variant="outline" className="mt-6" onClick={reset}>
        Reessayer
      </Button>
    </div>
  );
}
