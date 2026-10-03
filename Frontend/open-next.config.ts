import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

// Bindings for both live in wrangler.jsonc.
//
// KV rather than R2 (OpenNext's default suggestion) because R2 cannot be
// enabled without a payment method on the account, and this site runs on the
// free plan with none. KV's catch is its free allowance of 1,000 writes a day —
// see CATALOG_REVALIDATE_SECONDS in src/lib/api/server-fetch.ts for how the
// refresh interval keeps under it. OpenNext also notes KV is eventually
// consistent: a refreshed page can take up to a minute to reach every region,
// which a restaurant menu can live with.
//
// No tag cache: the app refreshes pages on a timer (revalidate), never with
// revalidateTag or revalidatePath, which are the only things a tag cache serves.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  queue: doQueue,
});
