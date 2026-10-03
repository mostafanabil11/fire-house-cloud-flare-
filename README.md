# Restaurant Ordering Website

A full-stack restaurant ordering system — menu catalog, cart,
checkout with card and cash-on-delivery payments, order tracking, and an admin
dashboard.

## Stack

**Backend** — NestJS 10, MongoDB (Mongoose), JWT auth in httpOnly cookies with
per-device refresh-token rotation, Paymob card payments, Nodemailer, Zod
validation, Swagger.

**Frontend** — Next.js 16 (App Router, Turbopack), React 19, TanStack Query,
Tailwind CSS v4, shadcn/ui, React Hook Form, Zustand.

## Features

- Catalog with categories, subcategories, search, filtering, and sale pricing
- Server-authoritative cart — prices and stock are always re-read from the
  database, never trusted from the client
- Checkout with stock reservation, idempotent order creation, and coupons
- Paymob card payments with HMAC-verified webhooks, plus cash on delivery
- Accounts: email/password with OTP verification, Google OAuth, password reset,
  addresses, order history, wishlist
- Reviews, newsletter signup, and back-in-stock notifications
- Admin area: dashboard, products, stock movements, orders, categories,
  coupons, customers, reviews, settings, and an audit log

## Prerequisites

- Node.js 20+
- MongoDB running locally (or a connection string to a hosted instance)

## Setup

Install dependencies for each app separately — this is not a monorepo, and there
is no root package manifest.

```bash
cd Backend && npm install
cd ../Frontend && npm install
```

### Backend environment

Copy the example file and fill it in:

```bash
cd Backend && cp .env.example .env
```

`MONGODB_URI` and `JWT_SECRET` are required — `JWT_SECRET` must be at least 32
characters. Generate one with:

```bash
openssl rand -base64 48
```

Email, Google OAuth, and Paymob variables are optional; card checkout stays
disabled unless all four `PAYMOB_*` values are set. The server validates its
environment on boot and refuses to start with an invalid config.

### Frontend environment

Create `Frontend/.env.local`:

```bash
API_ORIGIN=http://localhost:3100
NEXT_PUBLIC_SITE_URL=http://localhost:3101
```

### Seed the database

One command loads the categories and the whole menu. It **empties the catalog
first** — products, categories, carts, reviews — so it prints which database it
connected to before touching anything; check that line.

```bash
cd Backend
npm run seed:menu:inspect   # read-only: shows what is there
npm run seed:menu           # replaces the menu
npm run create:admin        # creates the restaurant's admin account
```

Both scripts read `MONGODB_URI` from the environment first, then
`Backend/.env.local`, then `Backend/.env`, so a database can be named on the
command line: `MONGODB_URI="mongodb+srv://..." npm run seed:menu`.

## Running

Start the backend first — the frontend's initial requests will fail until the API
is up.

```bash
cd Backend && npm run start:dev    # http://localhost:3100
```

```bash
cd Frontend && npm run dev         # http://localhost:3101
```

To run the site exactly as Cloudflare will — the real Workers runtime, the
`/api/backend` proxy in `worker.ts`, the page cache — build and preview it:

```bash
cd Frontend && npm run preview     # http://localhost:8787
```

The preview's Worker reads `Frontend/.dev.vars` (not committed):

```bash
API_ORIGIN=http://localhost:3100
PROXY_SECRET=<the same value as PROXY_SECRET in Backend/.env.local>
```

Swagger docs are served at `http://localhost:3100/api` in non-production
environments only.

## Tests

```bash
cd Backend && npm test
```

## Deployment

The two halves deploy to different places, for a reason worth stating: the
backend runs in-process cron jobs (`orders.scheduler.ts` releases stock from
abandoned card checkouts every minute) which need a host that keeps a process
alive. A serverless platform would never run them, and inventory reserved by an
abandoned checkout would never come back.

- **Frontend → Cloudflare Workers** (free plan), via the OpenNext adapter.
  Config: `Frontend/wrangler.jsonc`, `Frontend/open-next.config.ts`,
  `Frontend/worker.ts`. Needs no payment method on the Cloudflare account.
- **Backend → Render.** See `render.yaml`; it deploys `Backend` as a web service.
- **Database → MongoDB Atlas.** A cloud backend cannot reach a database on your
  laptop, so local MongoDB is development-only. Under *Network Access*, allow
  `0.0.0.0/0`: Render's free instances have no fixed address.

### First deploy, in order

The site and the API each need the other's address, so the order matters.

1. **Pick the site's address.** It will be
   `https://fire-house.<your-subdomain>.workers.dev` — the subdomain is shown in
   the Cloudflare dashboard under *Workers & Pages*.
2. **Generate the proxy secret** — one value, used on both sides:
   `openssl rand -base64 48`.
3. **Render:** *New → Blueprint*, choose this repository. Fill in the
   `sync:false` variables (table below), with `FRONTEND_URL` set to the site
   address from step 1. Note the service URL once it is live.
4. **Seed the new database** from your machine — see *Seed the database* above.
5. **Fill in `vars` in `Frontend/wrangler.jsonc`** — `API_ORIGIN` (the Render
   URL) and `NEXT_PUBLIC_SITE_URL` (step 1) — then commit and push.
6. **Cloudflare:**
   - *Storage & databases → Workers KV → Create* a namespace named
     `fire-house-next-cache`, and paste its ID into `kv_namespaces` in
     `wrangler.jsonc`. (KV rather than R2 because R2 needs a payment method on
     the account; KV does not.)
   - *Workers & Pages → Create → Import a repository*. Project name
     `fire-house` (it must match `name` in `wrangler.jsonc`), root directory
     `Frontend`, build command `npx opennextjs-cloudflare build`, deploy
     command `npx opennextjs-cloudflare deploy`.
   - After it exists: *Settings → Variables and Secrets*, add `PROXY_SECRET` as
     a **Secret** with the value from step 2, and redeploy.
7. **GitHub:** add the repository secret `API_HEALTH_URL` =
   `<Render URL>/health`, for `.github/workflows/keep-api-awake.yml`.

Optional, once the rest works:

- **Google sign-in:** `GOOGLE_CALLBACK_URL` =
  `<site>/api/backend/auth/google/callback`, and add the same URL to the OAuth
  client's authorized redirect URIs in Google Cloud Console.
- **Paymob:** transaction processed callback `<Render URL>/payments/paymob/webhook`,
  transaction response callback `<Render URL>/payments/paymob/return`.

### Environment variables

On Render (`render.yaml` lists the rest; these are the ones marked `sync:false`):

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | the Atlas connection string |
| `JWT_SECRET` | 32+ chars — `openssl rand -base64 48` |
| `FRONTEND_URL` | the site URL; comma-separate several to allow a custom domain too |
| `PROXY_SECRET` | the same value as the Cloudflare secret below |
| `BREVO_API_KEY` | see *Email in production* below |
| `MAIL_FROM_ADDRESS` | the sender address verified with Brevo |

On Cloudflare — public values in `Frontend/wrangler.jsonc` under `vars`, the
secret in the dashboard:

| Variable | Where | Value |
| --- | --- | --- |
| `API_ORIGIN` | `wrangler.jsonc` | the Render service URL |
| `NEXT_PUBLIC_SITE_URL` | `wrangler.jsonc` | the site URL |
| `PROXY_SECRET` | dashboard, type *Secret* | the same value as on Render |

`FRONTEND_URL` and `API_ORIGIN` point at each other. A build with either
`wrangler.jsonc` value empty fails and names the missing one.

### How the browser reaches the API

The browser never calls Render directly. It calls `/api/backend/*` on the site
itself, and `Frontend/worker.ts` forwards that to `API_ORIGIN`. That keeps the
session cookie first-party — Safari drops third-party cookies, which would sign
people out on every refresh — and it runs ahead of Next.js, so API calls cost
almost none of the free plan's per-request CPU.

Because every forwarded request reaches Render from a Cloudflare address, the
Worker also sends each customer's real address with `PROXY_SECRET`, and
`proxy-client-ip.middleware.ts` restores it as `req.ip`. Without the secret the
rate limiter would count every customer as one caller.

### Email in production

Gmail over SMTP is fine locally and does not work on a managed host: free Render
instances block outbound traffic on ports 25, 465 and 587, so mail silently goes
nowhere while everything looks healthy. `EmailService` therefore has two
transports and picks whichever is configured, preferring Brevo:

| Transport | When | Configured by |
| --- | --- | --- |
| Brevo HTTP API | production | `BREVO_API_KEY`, `MAIL_FROM_ADDRESS` |
| Gmail SMTP | local development | `EMAIL_USER`, `EMAIL_PASSWORD` |

Brevo verifies a **single sender address**, not a whole domain, so this works
before you own a brand domain — verify the address under *Senders* and use it as
`MAIL_FROM_ADDRESS`. The free tier allows 300 messages a day.

Whichever transport is active is logged at startup, along with whether it could
be reached, so "no email arrived" is answerable from the logs rather than by
guesswork.

### Why the cookies change in production

Auth cookies are `SameSite=Lax` in development and `SameSite=None; Secure` when
`NODE_ENV` is `production`, which browsers only accept over HTTPS. Behind the
`/api/backend` proxy the cookies are first-party either way; `None` matters only
for anything calling the API from another site. It does mean the API cannot be
tested over plain HTTP in production mode.

## Notes

Menu photos are served by the site itself out of `Frontend/public/images`, as
root-relative paths stored in the database. The originals live in
`Frontend/image-sources/`; `npm run images` (in `Frontend`) turns them into
WebP copies at each width `next/image` asks for, and a custom loader
(`src/lib/image-loader.ts`) picks the right one. Cloudflare's free plan has no
image optimizer, so this is done once, ahead of time — run it after adding or
replacing a photo.

## Troubleshooting

**Images or pages fail to load after an abrupt shutdown.** If the dev server was
killed rather than stopped, Next.js's build cache can be left locked, producing
`EPERM: operation not permitted` rename errors on the next start. Delete
`Frontend/.next` and start again.

**The site loads but nothing works, and half the homepage is missing.** Check
the address bar: Next serves `/_next/*` only to the origin the dev server was
addressed by, and the API's CORS allowlist is pinned to `FRONTEND_URL`. Opening
the site as `127.0.0.1:3101` rather than `localhost:3101` fails both checks —
the HTML renders, no JavaScript loads, and every API call is blocked. Use
`localhost`.

**Atlas connections hang forever, in Compass and in the app.** A
`mongodb+srv://` string needs two DNS lookups: an SRV record for the server
list and a TXT record for the connection options. Some home routers and ISP
resolvers answer the first and silently drop the second, which surfaces as
`queryTxt ETIMEOUT` or a spinner that never resolves. Either set your DNS
servers to `1.1.1.1` / `8.8.8.8`, or use the non-SRV connection string Atlas
offers under "Connect → Drivers → older version", which lists the hosts
directly and needs no TXT lookup.
