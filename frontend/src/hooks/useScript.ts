import { useCallback, useEffect, useState } from 'react';

export type ScriptStatus = 'loading' | 'ready' | 'error';

const cache = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = cache.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      cache.delete(src);
      el.remove();
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.appendChild(el);
  });
  cache.set(src, promise);
  return promise;
}

export function useScript(src: string | null) {
  const [status, setStatus] = useState<ScriptStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    setStatus('loading');
    loadScript(src).
    then(() => !cancelled && setStatus('ready')).
    catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [src, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { status, retry };
}