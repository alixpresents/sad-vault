"use client";

type ColorBandProps = {
  /** Pre-computed hex colors from all videos, already sorted by hue */
  colors: string[];
};

export function ColorBand({ colors }: ColorBandProps) {
  if (colors.length === 0) return null;

  return (
    <div
      className="pointer-events-none h-1.5 w-full select-none overflow-hidden rounded-full"
      style={{
        background: `linear-gradient(to right, ${colors.join(", ")})`,
        filter: "blur(2px) saturate(1.2)",
      }}
    />
  );
}
