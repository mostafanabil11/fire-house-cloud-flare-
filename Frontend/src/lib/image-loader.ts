"use client";

import manifest from "./image-manifest.json";

// next/image's loader, pointed at files that already exist instead of at an
// optimization service. scripts/optimize-images.mjs writes a copy of each photo
// at every width in manifest.widths (smaller than the original), named
// photo-640.webp and so on; next.config.ts hands the same widths to next/image,
// so each srcset entry this returns is a real file.
//
// Anything not in the manifest — a photo an admin linked from elsewhere — is
// returned untouched. It still displays; it just isn't resized.
const images: Record<string, number> = manifest.images;

export default function imageLoader({ src, width }: { src: string; width: number }): string {
  const fullWidth = images[src];
  if (fullWidth === undefined) return src;

  // The smallest copy at least as wide as asked for, so the browser never
  // stretches a smaller file. Past the largest copy, the full-size file is it.
  const copy = manifest.widths.find((w) => w >= width && w < fullWidth);
  return copy === undefined ? src : src.replace(/\.webp$/, `-${copy}.webp`);
}
