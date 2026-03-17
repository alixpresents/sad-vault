"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Talent } from "@/lib/types";

const talentSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  slug: z
    .string()
    .min(1, "Le slug est requis")
    .regex(
      /^[a-z0-9-]+$/,
      "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"
    ),
  bio: z.string().optional(),
  avatar_url: z.string().url("URL invalide").optional().or(z.literal("")),
});

type TalentFormValues = z.infer<typeof talentSchema>;

type Props = {
  talent?: Talent;
  action: (formData: FormData) => Promise<{ error: string } | void>;
};

export function TalentForm({ talent, action }: Props) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TalentFormValues>({
    resolver: zodResolver(talentSchema),
    defaultValues: {
      name: talent?.name ?? "",
      slug: talent?.slug ?? "",
      bio: talent?.bio ?? "",
      avatar_url: talent?.avatar_url ?? "",
    },
  });

  const [state, formAction, pending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => {
      // Validate client-side first
      const result = talentSchema.safeParse({
        name: formData.get("name"),
        slug: formData.get("slug"),
        bio: formData.get("bio"),
        avatar_url: formData.get("avatar_url"),
      });
      if (!result.success) {
        return { error: result.error.issues[0].message };
      }
      const res = await action(formData);
      if (res && "error" in res) return res;
      return null;
    },
    null
  );

  const nameValue = watch("name");

  function generateSlug() {
    const slug = nameValue
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setValue("slug", slug);
  }

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <div className="flex gap-2">
          <Input id="slug" {...register("slug")} />
          <Button type="button" variant="outline" onClick={generateSlug}>
            Generer
          </Button>
        </div>
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" rows={3} {...register("bio")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatar_url">URL Avatar</Label>
        <Input
          id="avatar_url"
          type="url"
          placeholder="https://..."
          {...register("avatar_url")}
        />
        {errors.avatar_url && (
          <p className="text-sm text-destructive">
            {errors.avatar_url.message}
          </p>
        )}
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Enregistrement..."
            : talent
              ? "Mettre a jour"
              : "Creer le talent"}
        </Button>
      </div>
    </form>
  );
}
