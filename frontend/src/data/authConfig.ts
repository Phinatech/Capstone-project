// Cloudflare's public test key: always passes, visibly marked as a test widget.
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

// Cloudflare Turnstile site key from VITE_TURNSTILE_SITE_KEY, or the test key for the demo.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || TURNSTILE_TEST_SITE_KEY;

// With a real key, every token must also pass the backend's check with Cloudflare.
export const TURNSTILE_ENFORCED = TURNSTILE_SITE_KEY !== TURNSTILE_TEST_SITE_KEY;

// Google Identity Services OAuth client ID. Leave empty to use the built-in demo Google flow.
// Set to your "xxxx.apps.googleusercontent.com" client ID to render the real GIS button.
export const GOOGLE_CLIENT_ID = '207080296274-lh5pae0hs5svb7tf22p5fldlfrtinsk8.apps.googleusercontent.com';

// Identities used by the demo Google flow when no client ID is configured.
export const demoGoogleIdentities = {
  signin: { email: 'amina.bello@mail.ng', name: 'Amina Bello', sub: 'demo-google-amina' },
  signup: { email: 'zainab.ibrahim@gmail.com', name: 'Zainab Ibrahim', sub: 'demo-google-zainab' }
};