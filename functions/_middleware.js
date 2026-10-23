/**
 * Same-origin shim for the Render API.
 *
 * Cloudflare Pages and Render are different sites (`*.pages.dev` vs
 * `*.onrender.com`), and the session cookie minted by `/auth/login` is
 * `SameSite=Lax` — so a browser pointed straight at Render would drop it on
 * every request and every visitor would appear signed out, no matter what they
 * typed. Rather than weaken the cookie to `SameSite=None` (which is what it
 * takes to cross origins, and which gives up the CSRF protection the Lax
 * setting was there for), the request is proxied from the same site the page
 * came from.
 *
 * From the browser's point of view everything is one origin: it posts to
 * `/auth/login` on `*.pages.dev`, gets a cookie for `*.pages.dev`, and sends
 * it back with each call. This file is the only place that knows Render is
 * involved. Everything not matching a prefix below — the app, its bundles, the
 * favicon — is left to Pages to serve as a static file.
 *
 * Requires `API_URL` on the Pages project, set to the Render service URL with
 * no trailing slash. `VITE_API_URL` must be left *empty*: if it is set the
 * frontend calls Render directly and this function is bypassed, which is the
 * cross-origin problem it exists to avoid.
 *
 * Both prefixes matter. The first version of this shim forwarded only `/api`
 * and missed `/auth`, which is where every login, session and reset call
 * lives — the site looked deployed and sign-in returned the HTML page instead
 * of a session.
 */

/** Both halves of the backend the browser talks to. */
const PROXIED_PREFIXES = ['/api', '/auth'];

/** Headers describing the hop, not the request; forwarding them only confuses the next server. */
const STRIP_REQUEST = [
  'host',
  'origin',
  'referer',
  // The browser sends Cloudflare's own metadata to Pages; Render has no use
  // for it and should not be told where the request really came from.
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'cdn-loop',
  'x-forwarded-for',
  'x-forwarded-proto',
  'accept-encoding'
];

/** Copied straight through unless they describe the wire rather than the content. */
const STRIP_RESPONSE = ['content-encoding', 'content-length'];

function shouldProxy(pathname) {
  return PROXIED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function onRequest(context) {
  const { request, env } = context;
  const incoming = new URL(request.url);

  // Static asset, SPA route, favicon: nothing to do, hand it back untouched.
  if (!shouldProxy(incoming.pathname)) return context.next();

  const apiUrl = (env.API_URL ?? '').trim().replace(/\/+$/, '');
  if (!apiUrl) {
    return new Response(
      'API_URL is not set on this Pages project. Set it to the Render service URL, e.g. https://sokoto-cover-api.onrender.com',
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

  const target = new URL(`${incoming.pathname}${incoming.search}`, `${apiUrl}/`);

  const headers = new Headers(request.headers);
  for (const name of STRIP_REQUEST) headers.delete(name);

  // Buffered rather than streamed: these bodies are JSON receipts and form
  // submissions, and a `ReadableStream` body needs a `duplex` option that not
  // every runtime agrees on.
  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let upstream;
  try {
    upstream = await fetch(target.toString(), init);
  } catch (err) {
    // 502 rather than a thrown error, so the browser shows the app's own
    // offline handling instead of a Cloudflare error page.
    return new Response(
      `Could not reach the API at ${apiUrl}: ${err instanceof Error ? err.message : String(err)}`,
      { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const name of STRIP_RESPONSE) responseHeaders.delete(name);

  // `getSetCookie` returns every `Set-Cookie` rather than a comma-joined mess,
  // which matters: a session cookie and a logout clear must both arrive intact,
  // or signing out would quietly leave the old session usable.
  const setCookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
  responseHeaders.delete('set-cookie');
  for (const cookie of setCookies) responseHeaders.append('set-cookie', cookie);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
}
