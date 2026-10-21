// Cloudflare's public test key: always passes, visibly marked as a test widget.
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

// Cloudflare Turnstile site key from VITE_TURNSTILE_SITE_KEY, or the test key for the demo.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || TURNSTILE_TEST_SITE_KEY;

// With a real key, every token must also pass the backend's check with Cloudflare.
export const TURNSTILE_ENFORCED = TURNSTILE_SITE_KEY !== TURNSTILE_TEST_SITE_KEY;

// Google Identity Services OAuth client ID, read from the environment with the
// pilot's own client as the default so a missing .env does not silently
// disable sign-in. A client ID is public by design — it ships in every page
// that renders the Google button — so keeping it here is not a disclosure.
//
// The server must be given the same value as GOOGLE_CLIENT_ID: ID tokens are
// verified against the audience, so a token minted for a different client is
// rejected there.
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ||
  '207080296274-lh5pae0hs5svb7tf22p5fldlfrtinsk8.apps.googleusercontent.com';