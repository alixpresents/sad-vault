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

const shareLinkSchema = z.object({
  title: z.string().max(500).nullable(),
  talent_id: z.string().uuid().nullable(),
  video_ids: z.array(z.string().uuid()).min(1, "Selectionnez au moins une video"),
  expires_at: z.string().datetime().nullable(),
  allow_download: z.boolean(),
});

export async function createShareLink(data: {
  title: string | null;
  talent_id: string | null;
  video_ids: string[];
  expires_at: string | null;
  allow_download: boolean;
}) {
  const { supabase, user } = await requireAuth();

  const parsed = shareLinkSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const token = generateToken();

  const { error } = await supabase.from("share_links").insert({
    token,
    title: parsed.data.title,
    talent_id: parsed.data.talent_id,
    video_ids: parsed.data.video_ids,
    expires_at: parsed.data.expires_at,
    allow_download: parsed.data.allow_download,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/links");
  redirect("/links");
}

const updateShareLinkSchema = z.object({
  title: z.string().max(500).nullable(),
  video_ids: z.array(z.string().uuid()).min(1, "Le lien doit contenir au moins une video"),
  expires_at: z.string().datetime().nullable(),
  allow_download: z.boolean(),
});

export async function updateShareLink(
  id: string,
  data: {
    title: string | null;
    video_ids: string[];
    expires_at: string | null;
    allow_download: boolean;
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
      video_ids: parsed.data.video_ids,
      expires_at: parsed.data.expires_at,
      allow_download: parsed.data.allow_download,
    })
    .eq("id", id);

  if (error) {
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
