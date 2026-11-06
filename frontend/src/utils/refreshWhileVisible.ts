/**
 * Background refreshes that stop while nobody is looking.
 *
 * Every API call from the site runs through its Pages Function (the
 * same-origin proxy in functions/_middleware.js), and Cloudflare's free plan
 * allows 100,000 Function requests a day for all visitors together. Reloading
 * the chain data on every Sepolia block (every 12 s, five calls each) cost one
 * open tab about 36,000 a day, so three tabs left open used the whole day's
 * allowance. Refreshes now run on a timer only while the tab is visible, and
 * once more when the person comes back to it, so a forgotten tab costs nothing.
 */

/** A tab switch fires both `visibilitychange` and `focus`; one refresh is enough. */
const SAME_RETURN_MS = 2_000;

/**
 * Runs `tick` now, then every `everyMs` while the page is visible, and again
 * as soon as a hidden or unfocused tab is brought back. Returns the function
 * that stops it, so it can be returned straight from a `useEffect`.
 */
export function refreshWhileVisible(tick: () => void, everyMs: number): () => void {
  const page = window.document;
  let last = Date.now();
  tick();
  const run = () => {
    if (page.visibilityState === 'hidden') return;
    const now = Date.now();
    if (now - last < SAME_RETURN_MS) return;
    last = now;
    tick();
  };
  const id = setInterval(run, everyMs);
  page.addEventListener('visibilitychange', run);
  window.addEventListener('focus', run);
  return () => {
    clearInterval(id);
    page.removeEventListener('visibilitychange', run);
    window.removeEventListener('focus', run);
  };
}
