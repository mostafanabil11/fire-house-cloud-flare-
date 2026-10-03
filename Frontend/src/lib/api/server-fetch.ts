// Server Components fetch through here rather than calling fetch directly.
//
// Native fetch is used instead of the axios client because only fetch hooks
// into Next's request-deduping and next:{revalidate} caching — axios goes
// through Node's http module and bypasses that layer entirely.
//
// The deadline is the important part. A machine reaching an API that isn't
// there does not necessarily get a connection refused: if the address routes
// nowhere, or a firewall drops the packets rather than rejecting them, the
// socket simply waits. Without a deadline that wait is unbounded, every page
// rendering the layout stalls, and the build dies on a timeout that names the
// page rather than the cause. An AbortSignal turns that silence into a prompt,
// catchable error.
//
// Build and runtime want very different deadlines, and conflating them caused a
// real bug: a shared 8s limit is right for a build, where the API may genuinely
// not exist and waiting achieves nothing, but far too short in production,
// where an idle free-tier host takes the better part of a minute to wake. The
// nav would time out, fall back to empty, and that empty render then sat in the
// cache — a working API serving a category menu that wasn't there.
// How long catalog data and the pages built from it (home, menu, each dish)
// are served from cache before being refreshed in the background.
//
// Ten minutes is set by the cache's budget, not by how often the menu changes.
// Deployed, the page cache lives in Cloudflare Workers KV, whose free plan
// allows 1,000 writes a day, and every refresh writes the page plus the API
// responses it was built from. Five minutes could pass that on a busy day; ten
// stays well under it. (Prices are not at stake: the cart and checkout always
// re-read them from the API.)
export const CATALOG_REVALIDATE_SECONDS = 600;

const BUILD_TIMEOUT_MS = 8000;
const RUNTIME_TIMEOUT_MS = 20000;

// The patient second attempt, once a first short one has had a chance to wake a
// sleeping host. Sized for a free-tier cold start, which is tens of seconds.
const WAKE_RETRY_TIMEOUT_MS = 35000;

// Retrying is worth it once, to wake a sleeping host. Retrying on *every* call
// is not: a build renders many pages, each making several requests, and Next
// abandons a page that takes more than 60 seconds. Two patient attempts per
// request against an API that is simply absent blows that budget and fails the
// build — the exact breakage the deadline was added to prevent.
//
// So the first proven-unreachable request trips this, and every later one fails
// on the short deadline alone. It is per-process and never reset, which is the
// right lifetime: a build is one process, and a server that recovers gets a
// fresh one on the next deploy.
let apiConfirmedUnreachable = false;

// Next sets NEXT_PHASE while `next build` runs; anything else is a live request.
function defaultTimeout(): number {
  return process.env.NEXT_PHASE === 'phase-production-build' ? BUILD_TIMEOUT_MS : RUNTIME_TIMEOUT_MS;
}

export class ServerFetchError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ServerFetchError';
  }
}

interface ServerFetchOptions {
  /** Seconds Next should serve this response from cache before refetching. */
  revalidate: number;
  timeoutMs?: number;
}

export async function serverFetch(
  path: string,
  { revalidate, timeoutMs = defaultTimeout() }: ServerFetchOptions,
): Promise<Response> {
  // Straight to the API, not through the /api/backend proxy the browser uses:
  // there is no cookie or CORS question server-side, and looping back through
  // this app's own origin would just add a hop. `||` rather than `??` because
  // an empty variable is an unfilled one, not a configured empty origin.
  const baseUrl = process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL;

  // Explicit rather than letting the URL become the string "undefined/..." and
  // failing several frames away from the actual mistake.
  if (!baseUrl) {
    throw new ServerFetchError('Neither API_ORIGIN nor NEXT_PUBLIC_API_URL is set', null);
  }

  // Two attempts, short then patient. A host that sleeps when idle — which any
  // free tier does — takes the better part of a minute to answer its first
  // request, and a single short deadline gives up before it ever replies. A
  // single long deadline would instead make every build crawl against an API
  // that is simply absent.
  //
  // So: ask quickly, and if that times out treat the attempt as having *woken*
  // the host rather than as a verdict, then ask again and wait properly. A
  // genuinely dead API costs two timeouts and no more.
  const attempts = apiConfirmedUnreachable ? [timeoutMs] : [timeoutMs, WAKE_RETRY_TIMEOUT_MS];
  let lastReason = 'unreachable';

  for (let i = 0; i < attempts.length; i++) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        next: { revalidate },
        signal: AbortSignal.timeout(attempts[i]),
      });
      // Something answered, so the API is not dead after all.
      apiConfirmedUnreachable = false;
      return response;
    } catch (err) {
      // TimeoutError is what AbortSignal.timeout throws; anything else is a
      // genuine network failure. Both mean the same to a caller: no answer.
      const timedOut = err instanceof Error && err.name === 'TimeoutError';
      lastReason = timedOut ? `timed out after ${attempts[i]}ms` : 'unreachable';

      // Only a timeout is worth retrying. A refused connection means nothing
      // is listening, and asking again more patiently will not change that.
      if (!timedOut || i === attempts.length - 1) {
        break;
      }
    }
  }

  // Both attempts failed: stop paying the patient retry on every later call.
  apiConfirmedUnreachable = true;
  throw new ServerFetchError(`API ${lastReason}: ${path}`, null);
}

/**
 * For data a page can render without. Returns `fallback` if the API is
 * unreachable, times out, or answers with an error status.
 *
 * Deliberately separate from serverFetch: swallowing a failure is right for a
 * nav menu or a currency symbol, and wrong for the product a page is about —
 * that should 404 or error rather than quietly render as if it doesn't exist.
 */
export async function serverFetchOptional<T>(
  path: string,
  options: ServerFetchOptions,
  fallback: T,
): Promise<T> {
  try {
    const res = await serverFetch(path, options);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}
