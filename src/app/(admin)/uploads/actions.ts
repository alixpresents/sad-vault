"use server";

import { createServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function createVideo(data: {
  talent_id: string;
  title: string;
  r2_key: string;
  file_size_bytes: number;
  duration_seconds: number | null;
}) {
  const supabase = await createServerClient();

  const { error } = await supabase.from("videos").insert({
    talent_id: data.talent_id,
    title: data.title,
    r2_key: data.r2_key,
    file_size_bytes: data.file_size_bytes,
    duration_seconds: data.duration_seconds,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/talents/${data.talent_id}`);
  revalidatePath("/uploads");
}

export async function deleteVideo(id: string, talentId: string) {
  const supabase = await createServerClient();

  const { error } = await supabase.from("videos").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/talents/${talentId}`);
}
