"use client";

import { useEffect, useRef } from "react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Supprimer",
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "confirm";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
        <h3 className="text-[14px] font-semibold text-neutral-900">{title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium text-white transition-colors ${
              variant === "confirm"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
