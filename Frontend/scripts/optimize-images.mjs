// Turns the photos in image-sources/ into the files the site actually serves.
//
// Run it after adding or replacing a photo:  npm run images
//
// Why this exists: Vercel resized and re-encoded every image on request, so
// a 2 MB PNG left the server as a 60 KB WebP sized for the screen asking for
// it. Cloudflare's free plan has no such service, so the same work happens
// here, once, ahead of time — and next/image picks the right file through the
// loader in src/lib/image-loader.ts, using the manifest this script writes.
//
// Without it a phone opening the menu downloads every dish photo at full size:
// tens of megabytes over mobile data, for pictures shown 96 pixels wide.

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE_DIR = "image-sources";
const OUTPUT_DIR = path.join("public", "images");
const MANIFEST = path.join("src", "lib", "image-manifest.json");

// The widths next/image will ask for. next.config.ts reads these back out of
// the manifest as imageSizes/deviceSizes, so every entry in a generated srcset
// names a file that exists. The largest doubles as the cap on the full-size
// file: nothing on the site is drawn wider than 1600 CSS pixels.
const WIDTHS = [128, 256, 384, 640, 828, 1200, 1600];
const QUALITY = 78;

// The link-preview image. WhatsApp quietly drops previews whose image is much
// over 300 KB, and some crawlers still don't read WebP — hence a plain JPEG at
// the 1.91:1 shape every network crops to.
const SOCIAL_PREVIEW = { from: "restaurant/hero.png", to: "og.jpg", width: 1200, height: 630 };

async function listImages(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? listImages(full) : [full];
    }),
  );
  return files.flat().filter((file) => /\.(png|jpe?g)$/i.test(file));
}

function toUrlPath(file) {
  return "/" + file.split(path.sep).join("/");
}

async function main() {
  // Start clean so a photo removed from image-sources disappears from the
  // site too, instead of lingering as an orphaned file nobody references.
  await rm(OUTPUT_DIR, { recursive: true, force: true });

  const manifest = { widths: WIDTHS, images: {} };
  const sources = await listImages(SOURCE_DIR);

  for (const source of sources) {
    const relative = path.relative(SOURCE_DIR, source);
    const outBase = path.join(OUTPUT_DIR, relative).replace(/\.(png|jpe?g)$/i, "");
    await mkdir(path.dirname(outBase), { recursive: true });

    const { width: intrinsicWidth } = await sharp(source).metadata();
    const fullWidth = Math.min(intrinsicWidth, WIDTHS[WIDTHS.length - 1]);

    await sharp(source).resize({ width: fullWidth }).webp({ quality: QUALITY }).toFile(`${outBase}.webp`);

    // Only widths smaller than the full file get their own copy — upscaling
    // a small photo would cost bytes and buy nothing.
    for (const width of WIDTHS.filter((w) => w < fullWidth)) {
      await sharp(source).resize({ width }).webp({ quality: QUALITY }).toFile(`${outBase}-${width}.webp`);
    }

    manifest.images[toUrlPath(path.relative("public", `${outBase}.webp`))] = fullWidth;
    console.log(`${relative} → ${fullWidth}px`);
  }

  await sharp(path.join(SOURCE_DIR, SOCIAL_PREVIEW.from))
    .resize({ width: SOCIAL_PREVIEW.width, height: SOCIAL_PREVIEW.height, fit: "cover" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(path.join(OUTPUT_DIR, SOCIAL_PREVIEW.to));

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n${sources.length} images written; manifest at ${MANIFEST}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
