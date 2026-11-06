import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshWhileVisible } from './refreshWhileVisible';

/** A page whose visibility the test controls, with the events it would fire. */
function fakePage() {
  const handlers: Record<string, Set<() => void>> = {};
  const target = (prefix: string) => ({
    addEventListener: (type: string, fn: () => void) => (handlers[prefix + type] ??= new Set()).add(fn),
    removeEventListener: (type: string, fn: () => void) => handlers[prefix + type]?.delete(fn)
  });
  const document = { visibilityState: 'visible', ...target('document:') };
  vi.stubGlobal('window', { document, ...target('window:') });
  return {
    show: () => {
      document.visibilityState = 'visible';
      handlers['document:visibilitychange']?.forEach((fn) => fn());
    },
    hide: () => {
      document.visibilityState = 'hidden';
      handlers['document:visibilitychange']?.forEach((fn) => fn());
    },
    focus: () => handlers['window:focus']?.forEach((fn) => fn()),
    listening: () => Object.values(handlers).reduce((n, set) => n + set.size, 0)
  };
}

const MINUTE = 60_000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('refreshing a page in the background', () => {
  it('loads at once, then once a minute while the tab is on screen', () => {
    fakePage();
    const tick = vi.fn();
    refreshWhileVisible(tick, MINUTE);
    expect(tick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MINUTE);
    expect(tick).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(2 * MINUTE);
    expect(tick).toHaveBeenCalledTimes(4);
  });

  it('makes no requests while the tab is hidden, and catches up the moment it is shown', () => {
    const page = fakePage();
    const tick = vi.fn();
    refreshWhileVisible(tick, MINUTE);
    page.hide();
    vi.advanceTimersByTime(8 * 60 * MINUTE);
    expect(tick).toHaveBeenCalledTimes(1);
    page.show();
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('refreshes once, not twice, when switching back fires both events', () => {
    const page = fakePage();
    const tick = vi.fn();
    refreshWhileVisible(tick, MINUTE);
    page.hide();
    vi.advanceTimersByTime(MINUTE / 2);
    page.show();
    page.focus();
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('stops completely when the page closes', () => {
    const page = fakePage();
    const tick = vi.fn();
    const stop = refreshWhileVisible(tick, MINUTE);
    stop();
    vi.advanceTimersByTime(5 * MINUTE);
    page.focus();
    expect(tick).toHaveBeenCalledTimes(1);
    expect(page.listening()).toBe(0);
  });
});
