# Fire House — storefront

Next.js 16 app, deployed to Cloudflare Workers through the OpenNext adapter.
Setup, deployment and environment variables are in the [root README](../README.md).

| Command | Does |
| --- | --- |
| `npm run dev` | dev server on http://localhost:3101 |
| `npm run preview` | production build in the real Workers runtime, on http://localhost:8787 |
| `npm run deploy` | build and deploy from this machine (normally Cloudflare builds from Git instead) |
| `npm run images` | regenerate `public/images` from `image-sources/` after changing a photo |

Files specific to Cloudflare:

- `wrangler.jsonc` — Worker name, bindings, and the site's public addresses
- `worker.ts` — the Worker entry; proxies `/api/backend` to the API, hands everything else to Next
- `open-next.config.ts` — where Next's page cache lives (Workers KV)
- `public/_headers` — cache rules for static files
