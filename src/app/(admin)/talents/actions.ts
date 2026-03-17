"use server";

import { createServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTalent(formData: FormData) {
  const supabase = await createServerClient();

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const bio = (formData.get("bio") as string) || null;
  const avatar_url = (formData.get("avatar_url") as string) || null;

  const { error } = await supabase.from("talents").insert({
    name,
    slug,
    bio,
    avatar_url,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/talents");
  redirect("/talents");
}

export async function updateTalent(id: string, formData: FormData) {
  const supabase = await createServerClient();

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const bio = (formData.get("bio") as string) || null;
  const avatar_url = (formData.get("avatar_url") as string) || null;

  const { error } = await supabase
    .from("talents")
    .update({ name, slug, bio, avatar_url })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/talents");
  redirect("/talents");
}

export async function deleteTalent(id: string) {
  const supabase = await createServerClient();

  const { error } = await supabase.from("talents").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/talents");
}
