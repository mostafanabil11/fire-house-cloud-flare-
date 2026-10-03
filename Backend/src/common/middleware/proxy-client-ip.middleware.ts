import { createHash, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import type { NextFunction, Request, Response } from 'express';

export const CLIENT_IP_HEADER = 'x-client-ip';
export const PROXY_SECRET_HEADER = 'x-proxy-secret';

// Browsers reach this API through the site's own Cloudflare Worker (see
// Frontend/worker.ts), so to Express every one of those requests comes from a
// Cloudflare address. 'trust proxy' can't fix that: it trusts Render's load
// balancer, and the hop before it is Cloudflare, not the customer. Left alone,
// the rate limiter counts all customers as one caller — five sign-ins a minute
// for the whole site, sixty requests a minute for everyone combined.
//
// The Worker sends the customer's real address along with a shared secret, and
// this replaces req.ip with it when the secret matches. Everything that reads
// req.ip — the rate limiter, sign-in device records, the request log — then
// sees the customer without having to know any of this.
//
// Without the secret the headers are ignored, so someone calling the API
// directly can't pick their own address to dodge the limit. And with
// PROXY_SECRET unset the middleware does nothing beyond discarding them.
export function proxyClientIp(secret: string | undefined) {
  const expected = secret ? digest(secret) : null;

  return (req: Request, _res: Response, next: NextFunction) => {
    const presented = req.headers[PROXY_SECRET_HEADER];
    const clientIp = req.headers[CLIENT_IP_HEADER];

    // Removed either way, so the secret can never reach a log or a handler.
    delete req.headers[PROXY_SECRET_HEADER];
    delete req.headers[CLIENT_IP_HEADER];

    if (
      expected &&
      typeof presented === 'string' &&
      typeof clientIp === 'string' &&
      isIP(clientIp) !== 0 &&
      // Compared as fixed-length digests: timingSafeEqual needs equal lengths,
      // and comparing the raw strings would leak the secret's length.
      timingSafeEqual(digest(presented), expected)
    ) {
      // Express defines ip as a getter on the request prototype; an own
      // property on this request shadows it.
      Object.defineProperty(req, 'ip', { value: clientIp, configurable: true, enumerable: true });
    }

    next();
  };
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
