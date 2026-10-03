// The Cloudflare Worker that serves the site (wrangler.jsonc "main").
//
// `opennextjs-cloudflare build` compiles the Next.js app into
// .open-next/worker.js; this file wraps it to answer one path before Next:
// /api/backend, the browser's way to the NestJS API.
//
// Why the API goes through this site at all: deployed, the site and the API
// sit on unrelated domains (workers.dev and onrender.com). Called directly,
// the API's session cookie would be a *third-party* cookie, which Safari blocks
// outright and Chrome is phasing out — signing in appears to work and every
// request after it arrives anonymous. Proxied through /api/backend, the cookie
// belongs to this site, and no browser has a reason to drop it.
//
// Why here rather than as a Next.js rewrite: every request counts against the
// free plan's 10 ms of CPU, and most of the Worker's requests are API calls.
// Answering them before Next means they never load or run Next's server.
//
// Not type-checked by `next build` (tsconfig excludes it): it imports the
// OpenNext output, which only exists after that build has finished.

import nextWorker from "./.open-next/worker.js";

// The Durable Object behind the page cache's refresh queue (wrangler.jsonc).
export { DOQueueHandler } from "./.open-next/worker.js";

interface Env {
  API_ORIGIN?: string;
  PROXY_SECRET?: string;
}

const API_PREFIX = "/api/backend";

// Headers that describe this one connection rather than the request itself;
// a proxy must not pass them on.
const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
];

const worker = {
  async fetch(request: Request, env: Env, ctx: unknown): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === API_PREFIX || url.pathname.startsWith(`${API_PREFIX}/`)) {
      return proxyToApi(request, url, env);
    }
    return nextWorker.fetch(request, env, ctx);
  },
};

export default worker;

async function proxyToApi(request: Request, url: URL, env: Env): Promise<Response> {
  if (!env.API_ORIGIN) {
    return apiUnavailable("API_ORIGIN is not configured for this site.", 500);
  }

  const target = new URL(url.pathname.slice(API_PREFIX.length) || "/", env.API_ORIGIN);
  target.search = url.search;

  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP_HEADERS) {
    headers.delete(name);
  }

  // The API rate-limits per visitor, and every request it receives from here
  // comes from a Cloudflare address — so without this, all customers share one
  // allowance and five sign-ins a minute, site-wide, locks everyone out.
  // Cloudflare supplies the visitor's real address; the secret is what lets the
  // API believe it. Whatever the browser itself sent under these names is
  // dropped first, so a visitor can't choose their own address.
  headers.delete("x-client-ip");
  headers.delete("x-proxy-secret");
  const clientIp = request.headers.get("cf-connecting-ip");
  if (env.PROXY_SECRET && clientIp) {
    headers.set("x-client-ip", clientIp);
    headers.set("x-proxy-secret", env.PROXY_SECRET);
  }

  try {
    return await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      // Handed back to the browser as-is: Google sign-in finishes with a
      // redirect that also sets the session cookies, and following it here
      // would swallow those cookies along with the redirect.
      redirect: "manual",
    });
  } catch {
    // Same envelope as the API's own errors, so the site shows this message
    // the way it shows any other.
    return apiUnavailable("We couldn't reach the kitchen just now. Please try again in a moment.", 502);
  }
}

function apiUnavailable(message: string, status: number): Response {
  return Response.json({ success: false, message }, { status });
}
