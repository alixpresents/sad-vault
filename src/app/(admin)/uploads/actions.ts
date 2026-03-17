"use server";

import { z } from "zod";
import { createServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autorise");
  return supabase;
}

const createVideoSchema = z.object({
  talent_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  r2_key: z.string().min(1).max(500),
  file_size_bytes: z.number().int().positive(),
  duration_seconds: z.number().int().nonnegative().nullable(),
  thumbnail_key: z.string().max(500).nullable(),
});

export async function createVideo(data: {
  talent_id: string;
  title: string;
  r2_key: string;
  file_size_bytes: number;
  duration_seconds: number | null;
  thumbnail_key: string | null;
}) {
  const supabase = await requireAuth();

  const parsed = createVideoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase.from("videos").insert(parsed.data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/talents/${parsed.data.talent_id}`);
  revalidatePath("/uploads");
}

export async function deleteVideo(id: string, talentId: string) {
  const supabase = await requireAuth();

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "ID invalide" };
  }

  const { error } = await supabase.from("videos").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/talents/${talentId}`);
}

export async function updateVideoTitle(
  videoId: string,
  talentId: string,
  title: string
) {
  const supabase = await requireAuth();

  const parsed = z.string().min(1).max(500).safeParse(title.trim());
  if (!parsed.success) {
    return { error: "Le titre ne peut pas etre vide" };
  }

  const { error } = await supabase
    .from("videos")
    .update({ title: parsed.data })
    .eq("id", videoId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/talents/${talentId}`);
}

export async function updateVideoThumbnail(
  videoId: string,
  talentId: string,
  thumbnailKey: string
) {
  const supabase = await requireAuth();

  if (!z.string().min(1).max(500).safeParse(thumbnailKey).success) {
    return { error: "Cle thumbnail invalide" };
  }

  const { error } = await supabase
    .from("videos")
    .update({ thumbnail_key: thumbnailKey })
    .eq("id", videoId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/talents/${talentId}`);
}
