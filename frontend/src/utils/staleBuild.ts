/**
 * After a deploy, a tab still running the old build asks for page files that
 * no longer exist. Cloudflare Pages answers those with the app's HTML, which
 * the browser refuses as a module ("Failed to fetch dynamically imported
 * module"), and the page crashed. Reloading fetches the new build, so the app
 * does that once instead of showing an error.
 */
const RELOADED_AT = 'sokoto-cover-reloaded-for-new-build';

// Chrome and Firefox say "…dynamically imported module", Safari "Importing a
// module script failed"; Vite's own CSS preload says "Unable to preload CSS".
const STALE_BUILD = /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export function isStaleBuildError(err: unknown): boolean {
  return err instanceof Error && STALE_BUILD.test(err.message);
}

/**
 * Reloads the page, unless it already did in the last minute: then the files
 * really are unreachable (offline, or the site is down), and the error should
 * show rather than the page reloading forever. Returns whether it reloaded.
 */
export function reloadForNewBuild(now = Date.now()): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOADED_AT) ?? 0);
    if (now - last < 60_000) return false;
    window.sessionStorage.setItem(RELOADED_AT, String(now));
  } catch {
    // Without storage there is no guard against a reload loop.
    return false;
  }
  window.location.reload();
  return true;
}
