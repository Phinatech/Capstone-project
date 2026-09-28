// Cloudflare Turnstile site key. This is Cloudflare's public test key (always passes, visible widget).
// Replace with your own site key from the Cloudflare dashboard for production.
export const TURNSTILE_SITE_KEY = '1x00000000000000000000AA';

// Google Identity Services OAuth client ID. Leave empty to use the built-in demo Google flow.
// Set to your "xxxx.apps.googleusercontent.com" client ID to render the real GIS button.
export const GOOGLE_CLIENT_ID = '';

// Identities used by the demo Google flow when no client ID is configured.
export const demoGoogleIdentities = {
  signin: { email: 'amina.bello@mail.ng', name: 'Amina Bello', sub: 'demo-google-amina' },
  signup: { email: 'zainab.ibrahim@gmail.com', name: 'Zainab Ibrahim', sub: 'demo-google-zainab' }
};