# Deployment guide

MandiMitra runs as three free-tier pieces. Do the steps **in this order**, because each one needs a value from the previous one.

```
Browser ──► Vercel (React site, https)  ──fetch + CORS──►  Render (Express API, https)  ──►  MongoDB Atlas
                                                               │
                                                               └──► Gnani Prisma (speech to text) and Timbre (text to speech)
```

Nothing here needs a paid plan. The Gnani key is used only by the API and never reaches the browser.

## What was verified before writing this

The built API in `NODE_ENV=production` and the built frontend on a **different origin** were run together locally against a throwaway database with the real Gnani APIs: the 41-check user journey passed, and CORS, safe error responses and the demo switch behaved as described below. What has **not** been verified is the real Render, Vercel and Atlas environments themselves; the first deploy is the first time those run.

## 1. MongoDB Atlas (free M0 cluster)

1. Create a cluster, then **Database Access → Add user**: a username and a long password made of letters and digits only (so it needs no URL encoding), role **Read and write to any database** or, better, a custom role limited to the one database below.
2. **Network Access → Add IP address → Allow access from anywhere (`0.0.0.0/0`)**. Render's free plan has no fixed outgoing address. The database is still protected by the user and password.
3. **Connect → Drivers**: copy the connection string and put the database name in it, for example `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/mandimitra-prod?retryWrites=true&w=majority`.
   - Use a **new database name** such as `mandimitra-prod`. The collections and indexes are created automatically on first start, and the demo data is seeded the first time someone presses "Try the demo account". This keeps your development and test records out of production without deleting anything.

## 2. Render (backend)

Create the service in one of two ways.

- **Blueprint:** New → Blueprint → select this repository. `render.yaml` defines everything. (If Render asks for a payment method for Blueprints, use the manual way below; the free web service itself needs no card.)
- **Manual:** New → Web Service → this repository. Runtime **Node**, region **Singapore** (closest to India), plan **Free**, build command `npm ci && npm run build:shared && npm run build -w @mandimitra/api`, start command `node apps/api/dist/server.js`, health check path `/api/health`, auto-deploy **off**.

Environment variables (Render → Environment):

| Variable | Value | Secret? |
|---|---|---|
| `NODE_ENV` | `production` | no |
| `NODE_VERSION` | `22` | no |
| `MONGODB_URI` | the Atlas string from step 1 | **yes** |
| `JWT_SECRET` | a long random value (the Blueprint generates one; manually: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) | **yes** |
| `GNANI_API_KEY` | your Gnani key | **yes** |
| `GNANI_STT_MODEL` | `prisma-v3.0` | no |
| `GNANI_TTS_MODEL` | `timbre-v2.5` | no |
| `CORS_ORIGINS` | your Vercel address, set in step 4 (put any `https://` placeholder for now) | no |
| `DEMO_MODE_ENABLED` | `true` if evaluators should be able to press "Try the demo account", otherwise `false` | no |

Optional (defaults are fine): `JWT_EXPIRES_IN=7d`, `GNANI_STT_FORMAT=transcribe`, `GNANI_TIMEOUT_MS=30000`, `DEFAULT_PAYMENT_TERM_DAYS=15`, `GNANI_BASE_URL=https://api.vachana.ai`.

About the demo switch: the demo account is **shared by everyone** and spends Gnani credits, so `render.yaml` ships with it **off**. Turn it on deliberately for the submission, and do not record your own demo sales in it (they would be visible to everyone). Use a normal account for that.

When it is live, open `https://YOUR-SERVICE.onrender.com/api/health`. You should see `"status":"ok"`, `"database":"up"` and `"gnani":{"configured":true…}`. Note the service address for step 3.

The free plan **sleeps after about 15 minutes without traffic**; the first request afterwards takes roughly 30 to 60 seconds. Open the site a minute or two before a demo.

## 3. Vercel (frontend)

1. Add New → Project → import this repository.
2. **Root Directory: `apps/web`** (this matters). The framework is detected as Vite; `apps/web/vercel.json` sets the install and build commands and the single-page-app rewrite.
3. Environment variable, for **Production**: `VITE_API_BASE_URL` = `https://YOUR-SERVICE.onrender.com` with **no trailing slash**. It is read at build time, so changing it later needs a redeploy.
4. Deploy and note the address, for example `https://mandimitra.vercel.app`.

Note: `apps/web/vercel.json` contains `"git": { "deploymentEnabled": false }`, which stops Vercel from deploying on every push so that the GitHub workflow is the only automatic path. If Vercel refuses the very first deployment because of it, either deploy once from the Vercel dashboard after temporarily removing that block, or deploy with the CLI from the repository root. This behaviour is not verified.

## 4. Tell the API about the site (CORS)

In Render set `CORS_ORIGINS` to the **exact** Vercel address, `https://mandimitra.vercel.app`: no trailing slash and no path. Add a second address, comma separated, for a custom domain if you use one. Vercel preview URLs are not allowed unless you add them. Render restarts the service by itself.

## 5. Verify the live site

From any terminal (replace the two addresses):

```bash
curl -s https://YOUR-SERVICE.onrender.com/api/health

# CORS must echo your site's address back...
curl -s -i -X OPTIONS https://YOUR-SERVICE.onrender.com/api/auth/login \
  -H "Origin: https://YOUR-SITE.vercel.app" -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin

# ...and must not for anyone else (no Access-Control-Allow-Origin line expected)
curl -s -i -X OPTIONS https://YOUR-SERVICE.onrender.com/api/auth/login \
  -H "Origin: https://evil.example" -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
```

Then in Chrome on the live site: register, press the mic (allow it; it needs https, which Vercel provides), record the example sentence, confirm, open the receipt and PDF, record a payment, open Payments, Analytics and export the CSV. The header should show a green "Gnani AI connected".

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| The site says "Could not reach the server" | `CORS_ORIGINS` does not match the site address exactly, or `VITE_API_BASE_URL` is wrong or missing (redeploy Vercel after fixing it) |
| The first page load or sign-in is very slow | Render free plan waking up |
| Health shows `"database":"down"` or the service will not start | Atlas network access is not open to `0.0.0.0/0`, or the password or database name in `MONGODB_URI` is wrong |
| Voice features return `GNANI_NOT_CONFIGURED` or `GNANI_AUTH_FAILED` | `GNANI_API_KEY` missing or rejected |
| "Try the demo account" says the demo is disabled | `DEMO_MODE_ENABLED` is `false` |
| The microphone is blocked | The page is not on https, or the browser permission was denied; use **Upload audio** or **Enter manually** meanwhile |

## Updating later

Push to GitHub, then in Render press **Manual Deploy → Deploy latest commit**, and in Vercel press **Redeploy** (or use the optional GitHub workflow described in the README, which needs environment reviewers and secrets set up first).

## Security checklist before sharing the link

- `JWT_SECRET` is random and only in Render. `GNANI_API_KEY` and `MONGODB_URI` are only in Render. None of them is in the repository (checked across the full Git history).
- The Atlas user has the minimum rights it needs, and the password is long and unique.
- `DEMO_MODE_ENABLED` is a conscious choice.
- If a key was ever pasted into a chat or a screenshot, rotate it in the Gnani dashboard and update Render.
