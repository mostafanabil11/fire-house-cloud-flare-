import type { NextConfig } from "next";
import { unstable_readConfig } from "wrangler";
import imageManifest from "./src/lib/image-manifest.json";

// The site's public addresses — the API origin and the site's own URL — are
// written once, in wrangler.jsonc "vars". The Worker reads them there at
// runtime (worker.ts proxies /api/backend with API_ORIGIN), and a production
// build copies them in here, because the build needs them too: Server
// Components prerender against the API, and NEXT_PUBLIC_SITE_URL is inlined
// into the page metadata.
//
// Anything already in the environment wins, so a .env.local can point a local
// production build at a local API without editing the committed file.
if (process.env.NODE_ENV === "production") {
  const { vars } = unstable_readConfig({ config: "wrangler.jsonc" }, { hideWarnings: true });
  for (const [key, value] of Object.entries(vars)) {
    // Empty counts as unset: "" is what an unfilled variable looks like.
    if (typeof value === "string" && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

// Deployed without these the site still builds and still renders, so it looks
// alive — while every Server Component fetch goes to localhost and returns
// nothing, and every link preview points at localhost. Failing the build names
// the missing variable instead of shipping that.
function requireInProduction(...names: string[]) {
  if (process.env.NODE_ENV !== "production") return;
  if (names.some((name) => process.env[name])) return;
  throw new Error(
    `${names.join(" (or ")}${names.length > 1 ? ")" : ""} must be set for a production build — ` +
      "fill it in under vars in wrangler.jsonc.",
  );
}

requireInProduction("API_ORIGIN", "NEXT_PUBLIC_API_URL");
requireInProduction("NEXT_PUBLIC_SITE_URL");

const nextConfig: NextConfig = {
  // Next 16 serves /_next/* dev resources only to the origin the dev server
  // was addressed by, so opening the site as 127.0.0.1 instead of localhost
  // silently blocks every client chunk — the HTML renders but nothing
  // hydrates. Both spellings point at this machine, so both are allowed.
  // Dev-only setting; it has no effect on a production build.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  // Images are resized ahead of time by scripts/optimize-images.mjs rather than
  // on request — Cloudflare's free plan has no image optimizer, and Next's own
  // would cost Worker CPU on every new size. The loader picks the pre-made file
  // for each width, and these lists are exactly the widths that were made, so
  // every srcset entry names a file that exists.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    imageSizes: imageManifest.widths.filter((w) => w < 640),
    deviceSizes: imageManifest.widths.filter((w) => w >= 640),
  },

  // The storefront this project grew out of shelved things under /products
  // and hung menu sections off the site root. A restaurant has one menu, so
  // both now live under /menu — these keep any link that was already shared
  // (or indexed) working instead of turning it into a 404.
  async redirects() {
    return [
      { source: "/products", destination: "/menu", permanent: true },
      { source: "/products/:slug", destination: "/menu/:slug", permanent: true },
      { source: "/sale", destination: "/menu", permanent: true },
      { source: "/size-guide", destination: "/menu", permanent: true },
    ];
  },

  // Deployed, worker.ts proxies /api/backend before a request ever reaches Next
  // — see the comment there for why the API must sit on this site's own origin.
  // `next dev` has no Worker in front of it, so in development alone a rewrite
  // stands in for it.
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    const apiOrigin = process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3100";
    return [{ source: "/api/backend/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
