"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError("Email ou mot de passe incorrect."); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500";
  const inputCls = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[13px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-400";

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-xs px-6">
        <div className="mb-8 text-center">
          <h1 className="text-[14px] font-semibold tracking-tight text-neutral-900">
            Sad Vault
          </h1>
          <p className="mt-1 text-[13px] text-neutral-400">Connectez-vous pour continuer</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className={labelCls}>Email</label>
            <input id="email" type="email" autoComplete="email" placeholder="admin@sad-pictures.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required className={inputCls} style={{ opacity: loading ? 0.5 : 1 }} />
          </div>
          <div className="mb-5">
            <label htmlFor="password" className={labelCls}>Mot de passe</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} required className={inputCls} style={{ opacity: loading ? 0.5 : 1 }} />
          </div>
          {error && <p className="mb-4 text-[12px] text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50">
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
