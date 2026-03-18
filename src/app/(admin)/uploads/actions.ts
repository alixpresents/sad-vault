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

export type DuplicateMatch = {
  level: "certain" | "very_likely" | "likely" | "possible";
  videoId: string;
  title: string;
  talentName: string;
  reason: string;
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_\s]+/g, " ").trim();
}

function similarity(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Simple similarity: count matching words
  const wa = new Set(na.split(" "));
  const wb = new Set(nb.split(" "));
  const common = [...wa].filter((w) => wb.has(w)).length;
  const total = Math.max(wa.size, wb.size);
  return total > 0 && common / total >= 0.8;
}

export async function checkDuplicate(
  fileHash: string | null,
  fileSize: number,
  fileName: string
): Promise<DuplicateMatch[]> {
  const supabase = await requireAuth();

  const { data: allVideos } = await supabase
    .from("videos")
    .select("id, title, file_size_bytes, file_hash, original_filename, talent_id, talents(name)")
    .order("created_at", { ascending: false });

  if (!allVideos || allVideos.length === 0) return [];

  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();
  const fileNameNoExt = fileName.replace(/\.[^.]+$/, "");

  for (const v of allVideos as {
    id: string; title: string; file_size_bytes: number | null;
    file_hash: string | null; original_filename: string | null;
    talent_id: string; talents: { name: string }[] | { name: string } | null;
  }[]) {
    const talentName = v.talents
      ? Array.isArray(v.talents) ? v.talents[0]?.name ?? "" : v.talents.name
      : "";

    let level: DuplicateMatch["level"] | null = null;
    let reason = "";

    // 1. Exact hash match
    if (fileHash && v.file_hash && fileHash === v.file_hash) {
      level = "certain";
      reason = "Meme fichier (hash identique)";
    }
    // 2. Same original filename
    else if (v.original_filename) {
      const existingNoExt = v.original_filename.replace(/\.[^.]+$/, "");
      if (normalize(fileNameNoExt) === normalize(existingNoExt)) {
        level = "very_likely";
        reason = "Meme nom de fichier";
      }
    }

    // 3. Similar title (only if no higher match yet)
    if (!level && similarity(fileNameNoExt, v.title)) {
      level = "likely";
      reason = "Titre similaire";
    }

    // 4. Same file size ±1%
    if (!level && v.file_size_bytes) {
      const diff = Math.abs(v.file_size_bytes - fileSize) / fileSize;
      if (diff <= 0.01) {
        level = "possible";
        reason = "Taille identique";
      }
    }

    if (level && !seen.has(v.id)) {
      seen.add(v.id);
      matches.push({ level, videoId: v.id, title: v.title, talentName, reason });
    }
  }

  // Sort by severity
  const order = { certain: 0, very_likely: 1, likely: 2, possible: 3 };
  matches.sort((a, b) => order[a.level] - order[b.level]);

  return matches.slice(0, 5);
}

const createVideoSchema = z.object({
  talent_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  r2_key: z.string().min(1).max(500),
  file_size_bytes: z.number().int().positive(),
  duration_seconds: z.number().int().nonnegative().nullable(),
  thumbnail_key: z.string().max(500).nullable(),
  file_hash: z.string().max(128).nullable(),
  original_filename: z.string().max(500).nullable(),
  filmstrip_keys: z.array(z.string().max(500)).max(10).default([]),
});

export async function createVideo(data: {
  talent_id: string;
  title: string;
  r2_key: string;
  file_size_bytes: number;
  duration_seconds: number | null;
  thumbnail_key: string | null;
  file_hash?: string | null;
  original_filename?: string | null;
  filmstrip_keys?: string[];
}) {
  const supabase = await requireAuth();

  const parsed = createVideoSchema.safeParse({
    ...data,
    file_hash: data.file_hash ?? null,
    original_filename: data.original_filename ?? null,
    filmstrip_keys: data.filmstrip_keys ?? [],
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { data: inserted, error } = await supabase.from("videos").insert(parsed.data).select("id").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/talents/${parsed.data.talent_id}`);
  revalidatePath("/uploads");
  revalidatePath("/videos");

  return { videoId: inserted.id };
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

const replaceVideoSchema = z.object({
  file_size_bytes: z.number().int().positive(),
  duration_seconds: z.number().int().nonnegative().nullable(),
  thumbnail_key: z.string().max(500).nullable(),
});

export async function replaceVideo(
  videoId: string,
  talentId: string,
  data: {
    file_size_bytes: number;
    duration_seconds: number | null;
    thumbnail_key: string | null;
  }
) {
  const supabase = await requireAuth();

  if (!z.string().uuid().safeParse(videoId).success) {
    return { error: "ID invalide" };
  }

  const parsed = replaceVideoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("videos")
    .update({
      file_size_bytes: parsed.data.file_size_bytes,
      duration_seconds: parsed.data.duration_seconds,
      thumbnail_key: parsed.data.thumbnail_key,
    })
    .eq("id", videoId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/talents/${talentId}`);
}

export async function removeVideoTag(videoId: string, tag: string) {
  const supabase = await requireAuth();

  if (!z.string().uuid().safeParse(videoId).success) {
    return { error: "ID invalide" };
  }

  const { data: video } = await supabase
    .from("videos")
    .select("tags")
    .eq("id", videoId)
    .single();

  if (!video) return { error: "Video introuvable" };

  const updated = ((video as { tags: string[] }).tags ?? []).filter((t) => t !== tag);

  const { error } = await supabase
    .from("videos")
    .update({ tags: updated })
    .eq("id", videoId);

  if (error) return { error: error.message };

  revalidatePath("/videos");
}

export async function updateVideoTags(
  videoId: string,
  tags: string[]
) {
  const supabase = await requireAuth();

  if (!z.string().uuid().safeParse(videoId).success) {
    return { error: "ID invalide" };
  }

  const cleaned = tags.map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 10);

  const { error } = await supabase
    .from("videos")
    .update({ tags: cleaned })
    .eq("id", videoId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/videos");
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

export async function updateFilmstripKeys(
  videoId: string,
  filmstripKeys: string[]
) {
  const supabase = await requireAuth();

  if (!z.string().uuid().safeParse(videoId).success) {
    return { error: "ID invalide" };
  }

  const cleaned = filmstripKeys.filter((k) => k.length > 0).slice(0, 10);

  const { error } = await supabase
    .from("videos")
    .update({ filmstrip_keys: cleaned })
    .eq("id", videoId);

  if (error) return { error: error.message };

  revalidatePath("/videos");
}
