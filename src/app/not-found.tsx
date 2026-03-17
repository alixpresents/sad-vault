import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Page introuvable
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        La page que vous cherchez n'existe pas ou a ete deplacee.
      </p>
      <Button variant="outline" className="mt-6" asChild>
        <Link href="/dashboard">Retour au dashboard</Link>
      </Button>
    </div>
  );
}
