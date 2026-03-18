"use server";

import { z } from "zod";
import { createServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAuth() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autorise");
  return { supabase, user };
}

function generateToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    token += chars[byte % chars.length];
  }
  return token;
}

const slugSchema = z
  .string()
  .min(3, "Le slug doit faire au moins 3 caracteres")
  .max(50, "Le slug doit faire au plus 50 caracteres")
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Uniquement lettres minuscules, chiffres et tirets (pas au debut/fin)")
  .nullable();

const filmstripStyleSchema = z.enum(["thumbnails", "colors", "none"]).default("thumbnails");

const shareLinkSchema = z.object({
  title: z.string().max(500).nullable(),
  custom_slug: slugSchema,
  talent_id: z.string().uuid().nullable(),
  video_ids: z.array(z.string().uuid()).min(1, "Selectionnez au moins une video"),
  expires_at: z.string().datetime().nullable(),
  allow_download: z.boolean(),
  filmstrip_style: filmstripStyleSchema,
});

export async function createShareLink(data: {
  title: string | null;
  custom_slug: string | null;
  talent_id: string | null;
  video_ids: string[];
  expires_at: string | null;
  allow_download: boolean;
  filmstrip_style?: "thumbnails" | "colors" | "none";
}) {
  const { supabase, user } = await requireAuth();

  const parsed = shareLinkSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const token = generateToken();

  const { error } = await supabase.from("share_links").insert({
    token,
    custom_slug: parsed.data.custom_slug || null,
    title: parsed.data.title,
    talent_id: parsed.data.talent_id,
    video_ids: parsed.data.video_ids,
    expires_at: parsed.data.expires_at,
    allow_download: parsed.data.allow_download,
    filmstrip_style: parsed.data.filmstrip_style,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505" && error.message.includes("custom_slug")) {
      return { error: "Ce slug est deja utilise" };
    }
    return { error: error.message };
  }

  revalidatePath("/links");
  redirect("/links");
}

const updateShareLinkSchema = z.object({
  title: z.string().max(500).nullable(),
  custom_slug: slugSchema,
  video_ids: z.array(z.string().uuid()).min(1, "Le lien doit contenir au moins une video"),
  expires_at: z.string().datetime().nullable(),
  allow_download: z.boolean(),
  filmstrip_style: filmstripStyleSchema,
});

export async function updateShareLink(
  id: string,
  data: {
    title: string | null;
    custom_slug: string | null;
    video_ids: string[];
    expires_at: string | null;
    allow_download: boolean;
    filmstrip_style?: "thumbnails" | "colors" | "none";
  }
) {
  const { supabase } = await requireAuth();

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "ID invalide" };
  }

  const parsed = updateShareLinkSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("share_links")
    .update({
      title: parsed.data.title,
      custom_slug: parsed.data.custom_slug || null,
      video_ids: parsed.data.video_ids,
      expires_at: parsed.data.expires_at,
      allow_download: parsed.data.allow_download,
      filmstrip_style: parsed.data.filmstrip_style,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505" && error.message.includes("custom_slug")) {
      return { error: "Ce slug est deja utilise" };
    }
    return { error: error.message };
  }

  revalidatePath("/links");
  revalidatePath(`/links/${id}/edit`);
  redirect("/links");
}

export async function deleteShareLink(id: string) {
  const { supabase } = await requireAuth();

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "ID invalide" };
  }

  const { error } = await supabase.from("share_links").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/links");
}

export async function toggleShareLinkActive(id: string) {
  const { supabase } = await requireAuth();

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "ID invalide" };
  }

  const { data: link } = await supabase
    .from("share_links")
    .select("is_active")
    .eq("id", id)
    .single();

  if (!link) return { error: "Lien introuvable" };

  const { error } = await supabase
    .from("share_links")
    .update({ is_active: !(link as { is_active: boolean }).is_active })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/links");
  revalidatePath("/dashboard");
  revalidatePath(`/links/${id}/edit`);
}

/** Check if a custom_slug is available (for real-time validation) */
export async function checkSlugAvailability(
  slug: string,
  excludeLinkId?: string
): Promise<{ available: boolean }> {
  const { supabase } = await requireAuth();

  let query = supabase
    .from("share_links")
    .select("id")
    .eq("custom_slug", slug)
    .limit(1);

  if (excludeLinkId) {
    query = query.neq("id", excludeLinkId);
  }

  const { data } = await query;
  return { available: !data || data.length === 0 };
}
