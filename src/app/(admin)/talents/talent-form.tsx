"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useActionState } from "react";
import type { Talent } from "@/lib/types";

const talentSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  slug: z.string().min(1, "Le slug est requis").regex(/^[a-z0-9-]+$/, "Lettres minuscules, chiffres et tirets uniquement"),
  bio: z.string().optional(),
  avatar_url: z.string().url("URL invalide").optional().or(z.literal("")),
});

type TalentFormValues = z.infer<typeof talentSchema>;

export function TalentForm({ talent, action }: {
  talent?: Talent;
  action: (formData: FormData) => Promise<{ error: string } | void>;
}) {
  const { register, setValue, watch, formState: { errors } } = useForm<TalentFormValues>({
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
      const result = talentSchema.safeParse({
        name: formData.get("name"),
        slug: formData.get("slug"),
        bio: formData.get("bio"),
        avatar_url: formData.get("avatar_url"),
      });
      if (!result.success) return { error: result.error.issues[0].message };
      const res = await action(formData);
      if (res && "error" in res) return res;
      return null;
    },
    null
  );

  const nameValue = watch("name");

  function generateSlug() {
    const slug = nameValue.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    setValue("slug", slug);
  }

  const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500";
  const inputCls = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-400";

  return (
    <form action={formAction} className="max-w-md">
      <div className="mb-5">
        <label htmlFor="name" className={labelCls}>Nom</label>
        <input id="name" type="text" {...register("name")} className={inputCls} />
        {errors.name && <p className="mt-1 text-[12px] text-red-600">{errors.name.message}</p>}
      </div>
      <div className="mb-5">
        <label htmlFor="slug" className={labelCls}>Slug</label>
        <div className="flex gap-2">
          <input id="slug" type="text" {...register("slug")} className={inputCls} />
          <button
            type="button"
            onClick={generateSlug}
            className="shrink-0 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Generer
          </button>
        </div>
        {errors.slug && <p className="mt-1 text-[12px] text-red-600">{errors.slug.message}</p>}
      </div>
      <div className="mb-5">
        <label htmlFor="bio" className={labelCls}>Bio</label>
        <textarea id="bio" rows={3} {...register("bio")} className={`${inputCls} resize-y`} />
      </div>
      <div className="mb-6">
        <label htmlFor="avatar_url" className={labelCls}>URL Avatar</label>
        <input id="avatar_url" type="url" placeholder="https://..." {...register("avatar_url")} className={inputCls} />
        {errors.avatar_url && <p className="mt-1 text-[12px] text-red-600">{errors.avatar_url.message}</p>}
      </div>
      {state?.error && <p className="mb-4 text-[12px] text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : talent ? "Mettre a jour" : "Creer le talent"}
      </button>
    </form>
  );
}
