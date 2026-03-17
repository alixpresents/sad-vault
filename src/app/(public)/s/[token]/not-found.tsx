export default function ShareNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-sad-pictures.png" alt="Sad Pictures" className="h-8 w-auto opacity-70" />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          Lien introuvable
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Ce lien de partage n'existe pas ou a ete supprime.
        </p>
      </div>
    </div>
  );
}
