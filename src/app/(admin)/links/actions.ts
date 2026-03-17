"use server";

import { createServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function generateToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    token += chars[byte % chars.length];
  }
  return token;
}

export async function createShareLink(data: {
  title: string | null;
  talent_id: string | null;
  video_ids: string[];
  expires_at: string | null;
  allow_download: boolean;
}) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non autorise" };
  }

  if (data.video_ids.length === 0) {
    return { error: "Selectionnez au moins une video" };
  }

  const token = generateToken();

  const { error } = await supabase.from("share_links").insert({
    token,
    title: data.title,
    talent_id: data.talent_id,
    video_ids: data.video_ids,
    expires_at: data.expires_at,
    allow_download: data.allow_download,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/links");
  redirect("/links");
}

export async function updateShareLink(
  id: string,
  data: {
    title: string | null;
    video_ids: string[];
    expires_at: string | null;
    allow_download: boolean;
  }
) {
  const supabase = await createServerClient();

  if (data.video_ids.length === 0) {
    return { error: "Le lien doit contenir au moins une video" };
  }

  const { error } = await supabase
    .from("share_links")
    .update({
      title: data.title,
      video_ids: data.video_ids,
      expires_at: data.expires_at,
      allow_download: data.allow_download,
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
  const supabase = await createServerClient();

  const { error } = await supabase.from("share_links").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/links");
}
