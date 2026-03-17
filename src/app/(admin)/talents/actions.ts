"use server";

import { z } from "zod";
import { createServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const talentSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  bio: z.string().max(2000).nullable(),
  avatar_url: z.string().url().max(2000).nullable().or(z.literal("")),
});

async function requireAuth() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autorise");
  return supabase;
}

export async function createTalent(formData: FormData) {
  const supabase = await requireAuth();

  const parsed = talentSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    bio: (formData.get("bio") as string) || null,
    avatar_url: (formData.get("avatar_url") as string) || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase.from("talents").insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    bio: parsed.data.bio,
    avatar_url: parsed.data.avatar_url || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/talents");
  redirect("/talents");
}

export async function updateTalent(id: string, formData: FormData) {
  const supabase = await requireAuth();

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "ID invalide" };
  }

  const parsed = talentSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    bio: (formData.get("bio") as string) || null,
    avatar_url: (formData.get("avatar_url") as string) || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("talents")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      bio: parsed.data.bio,
      avatar_url: parsed.data.avatar_url || null,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/talents");
  redirect("/talents");
}

export async function deleteTalent(id: string) {
  const supabase = await requireAuth();

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "ID invalide" };
  }

  const { error } = await supabase.from("talents").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/talents");
}
