export default function ShareNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
          Sad Pictures
        </p>
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
