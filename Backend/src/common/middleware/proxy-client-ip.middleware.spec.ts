import type { Request, Response } from 'express';
import { CLIENT_IP_HEADER, PROXY_SECRET_HEADER, proxyClientIp } from './proxy-client-ip.middleware';

const SECRET = 'a-proxy-secret-that-is-long-enough-to-pass';
const PROXY_ADDRESS = '172.70.1.1';

// A stand-in for an Express request: ip is a prototype getter there too, which
// is the thing the middleware has to shadow.
function makeRequest(headers: Record<string, string>): Request {
  const proto = {};
  Object.defineProperty(proto, 'ip', { get: () => PROXY_ADDRESS, configurable: true });
  const req = Object.create(proto);
  req.headers = { ...headers };
  return req as Request;
}

function run(secret: string | undefined, headers: Record<string, string>) {
  const req = makeRequest(headers);
  const next = jest.fn();
  proxyClientIp(secret)(req, {} as Response, next);
  expect(next).toHaveBeenCalledTimes(1);
  return req;
}

describe('proxyClientIp', () => {
  it('uses the forwarded address when the secret matches', () => {
    const req = run(SECRET, { [PROXY_SECRET_HEADER]: SECRET, [CLIENT_IP_HEADER]: '41.33.12.7' });
    expect(req.ip).toBe('41.33.12.7');
  });

  it('accepts IPv6 addresses', () => {
    const req = run(SECRET, { [PROXY_SECRET_HEADER]: SECRET, [CLIENT_IP_HEADER]: '2001:db8::1' });
    expect(req.ip).toBe('2001:db8::1');
  });

  // The point of the secret: a direct caller must not be able to choose the
  // address the rate limiter counts them under.
  it('ignores the forwarded address when the secret is wrong', () => {
    const req = run(SECRET, { [PROXY_SECRET_HEADER]: 'guessed', [CLIENT_IP_HEADER]: '41.33.12.7' });
    expect(req.ip).toBe(PROXY_ADDRESS);
  });

  it('ignores the forwarded address when no secret is sent', () => {
    const req = run(SECRET, { [CLIENT_IP_HEADER]: '41.33.12.7' });
    expect(req.ip).toBe(PROXY_ADDRESS);
  });

  it('ignores the headers entirely when PROXY_SECRET is not configured', () => {
    const req = run(undefined, { [PROXY_SECRET_HEADER]: SECRET, [CLIENT_IP_HEADER]: '41.33.12.7' });
    expect(req.ip).toBe(PROXY_ADDRESS);
  });

  it('ignores a value that is not an IP address', () => {
    const req = run(SECRET, { [PROXY_SECRET_HEADER]: SECRET, [CLIENT_IP_HEADER]: 'not-an-ip' });
    expect(req.ip).toBe(PROXY_ADDRESS);
  });

  it('removes both headers so the secret never reaches a handler or a log', () => {
    const req = run(SECRET, { [PROXY_SECRET_HEADER]: SECRET, [CLIENT_IP_HEADER]: '41.33.12.7' });
    expect(req.headers[PROXY_SECRET_HEADER]).toBeUndefined();
    expect(req.headers[CLIENT_IP_HEADER]).toBeUndefined();
  });
});
