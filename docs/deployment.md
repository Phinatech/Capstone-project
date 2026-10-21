# Deployment

| Part | Where | Address |
|------|-------|---------|
| Frontend (React dapp) | Cloudflare Pages, free | `https://<project>.pages.dev` |
| Backend (API, oracle relayer, settlement keeper) | Render web service, defined in [`render.yaml`](../render.yaml) | `https://<service>.onrender.com` |
| Contracts | Sepolia | aggregator `0x1b595A484A0a26eaC8764307c19bbfDaA2E4aDE1`, insurance `0x8520A0697D018a380a91CB65096AB50F5B65D6D5` |

The backend has to run all the time: the relayer and the keeper act every hour.
Cloudflare Workers can't host it as it is (no long-running process, and the
free plan allows 10 ms of CPU per run), so it goes on Render and the static
frontend on Cloudflare Pages. Both build from GitHub `main` and redeploy on
every push.

## 0. Before you start

1. Commit and push to `main`; both hosts build from GitHub.
2. Only one backend may run the relayer. In your local `backend/.env` set
   `RELAYER_ENABLED=false`, and restart (or stop) your local backend.

## 1. Backend on Render

1. Sign in at <https://dashboard.render.com> with GitHub and allow Render to
   read `Phinatech/Capstone-project`.
2. **New > Blueprint**, pick the repository. Render reads `render.yaml`.
3. Render asks for the secret values. Copy them from your `backend/.env`:

   | Variable | Value |
   |----------|-------|
   | `RPC_URL` | your Alchemy Sepolia URL |
   | `ORACLE_SOURCES` | the whole `CHIRPS:0x…,NASA_POWER:0x…,Meteostat:0x…` line |
   | `KEEPER_PRIVATE_KEY` | the keeper key |
   | `METEOSTAT_API_KEY` | the RapidAPI key |
   | `CORS_ORIGINS` | `http://localhost:5173` for now; step 3 changes it |
   | `TURNSTILE_SECRET_KEY`, `NOTIFY_API_KEY`, `TERMINII_API_KEY`, `TERMINII_SENDER_ID` | leave empty for now |

   The auth variables — `SECURE_COOKIES`, `GOOGLE_CLIENT_ID`,
   `AUTH_DEMO_ACCOUNTS`, `AUTH_DEMO_CODES` — are plain values written into
   `render.yaml`, so they come across with the Blueprint and you are not asked
   for them. Both demo flags are **on** there, and that is what makes the
   deployed demo usable: with `AUTH_DEMO_ACCOUNTS` off nothing is seeded, so
   the sign-in panel is empty and no account exists to sign in with; with
   `AUTH_DEMO_CODES` off a new sign-up has no way to read its verification
   code, because there is no mail service to send one. If the live site starts
   refusing every sign-in, check those two first — they default to off in the
   code, which is the safe choice for a clone and the wrong one for this demo.

4. **Apply**. The first build takes a few minutes. The service's **Logs** should
   show `[api] listening on …` and
   `[relayer] started: 3 source(s) and settlement, every 60 min`.
5. Copy the service URL from the top of its page and open
   `https://<service>.onrender.com/health` and `…/api/readings`.

## 2. Frontend on Cloudflare Pages

1. At <https://dash.cloudflare.com>: **Workers & Pages > Create > Pages >
   Import an existing Git repository**, pick `Phinatech/Capstone-project`.
2. Build settings:

   | Setting | Value |
   |---------|-------|
   | Framework preset | None |
   | Build command | `npm run build --workspace frontend` |
   | Build output directory | `frontend/dist` |
   | Root directory | *(leave empty: the repository root)* |

3. Environment variables (Production):

   | Variable | Value |
   |----------|-------|
   | `NODE_VERSION` | `22` |
   | `VITE_API_URL` | **leave empty** — see the note below |
   | `API_URL` | the Render URL from step 1, without a trailing slash |
   | `VITE_RPC_URL` | `https://ethereum-sepolia-rpc.publicnode.com` (keyless, so no API key ends up in the public site) |
   | `VITE_ORACLE_AGGREGATOR_ADDRESS` | `0x1b595A484A0a26eaC8764307c19bbfDaA2E4aDE1` |
   | `VITE_WEATHER_INDEX_INSURANCE_ADDRESS` | `0x8520A0697D018a380a91CB65096AB50F5B65D6D5` |

   **Why `VITE_API_URL` is empty.** It used to hold the Render URL, which made
   every API call cross-origin — and a cross-origin call does not carry a
   `SameSite=Lax` session cookie, so sign-in would return 200, drop the cookie,
   and bounce you straight back to the sign-in page. It is empty now so the
   frontend calls relative paths, which `functions/api/[[path]].js` forwards to
   Render over Cloudflare's own network. The browser only ever sees
   `*.pages.dev`, the cookie stays first-party, and the session works.

   If you ever set `VITE_API_URL` again, you bypass that function and
   reintroduce the problem — leave it empty.

4. **Save and Deploy**. The site is at `https://<project>.pages.dev`.

## 3. Connect them

`CORS_ORIGINS` no longer carries the connection. The Pages Function forwards
server-to-server, so the browser never talks to Render and the API's CORS list
is not involved; leave the variable as it is, since it only matters again if
you start calling the API directly from a browser.

Open the site and sign in with an account from the panel on the sign-in page.
The sidebar should say **Sepolia testnet**, not "Simulated data".

**Only one relayer may run.** The Blueprint turns `RELAYER_ENABLED` on for the
Render service, so your local backend must have `RELAYER_ENABLED=false` and be
stopped. Two relayers submitting with the same keeper key is how nonce
conflicts happen, and it looks exactly like a stuck oracle.

## 4. Keep the backend awake

A free Render service sleeps after 15 minutes without requests, and the
relayer sleeps with it (it catches up when the service wakes). Either:

- create a free uptime monitor (e.g. UptimeRobot) that requests
  `https://<service>.onrender.com/health` every 5 minutes; Render's 750 free
  hours a month cover one service running all month, or
- switch the service to a paid instance type, which never sleeps.

## 5. Optional, after it works

- **Real Turnstile check**: Cloudflare > Turnstile > Add widget for your
  `*.pages.dev` hostname. Put the site key in Pages as `VITE_TURNSTILE_SITE_KEY`
  (and redeploy) and the secret in Render as `TURNSTILE_SECRET_KEY`.
- **Google sign-in**: Google Cloud Console > Credentials > the OAuth client >
  Authorized JavaScript origins: add the Pages address.

## When something is off

| Symptom | Check |
|---------|-------|
| The site shows "Simulated data" | Hover the label for the reason; usually `VITE_API_URL` is wrong or `CORS_ORIGINS` doesn't match the site's address exactly |
| Render logs `[relayer] off` | `RELAYER_ENABLED` must be `true` |
| Readings stop for hours | The free service is asleep: see step 4 |
| A build fails in `npm` with `edgesOut` | That npm 10 bug only hits when adding packages; regenerate the lockfile locally with `npx npm@11 install` and push |
