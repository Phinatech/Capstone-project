import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStaleBuildError, reloadForNewBuild } from './staleBuild';

function fakeWindow() {
  const store = new Map<string, string>();
  const reload = vi.fn();
  vi.stubGlobal('window', {
    sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    location: { reload }
  });
  return reload;
}

afterEach(() => vi.unstubAllGlobals());

describe('a tab left open across a deploy', () => {
  it('recognises the missing-page-file error in Chrome, Firefox and Safari', () => {
    expect(isStaleBuildError(new TypeError('Failed to fetch dynamically imported module: https://sokoto-cover.pages.dev/assets/SignIn-CwMUb83S.js'))).toBe(true);
    expect(isStaleBuildError(new TypeError('error loading dynamically imported module: https://x/assets/a.js'))).toBe(true);
    expect(isStaleBuildError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleBuildError(new Error('Something else broke'))).toBe(false);
    expect(isStaleBuildError('Failed to fetch dynamically imported module')).toBe(false);
  });

  it('reloads once to fetch the new build, but not again within a minute', () => {
    const reload = fakeWindow();
    expect(reloadForNewBuild(1_000_000)).toBe(true);
    expect(reloadForNewBuild(1_030_000)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadForNewBuild(1_070_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
