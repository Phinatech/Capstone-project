import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotionConfig } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

const AUTO_ADVANCE_MS = 4500;
// The cards are rendered three times so the row can loop: the middle copy is
// the one people see, and when a slide lands in an outer copy the track jumps,
// without animating, to the same card in the middle one.
const COPIES = 3;

const arrowClass =
'flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-150 ease-out hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/**
 * A row of cards that slides sideways, one card per step, on every screen
 * size: swipe or scroll, the arrows or the dots. Cards keep a readable width
 * (most of the screen on a phone, about 300–340 px above that), start at the
 * left edge and loop round endlessly, so there is always a next card even when
 * every card fits. It advances on its own every few seconds, but stops while
 * someone is hovering, touching or tabbing through it, and never moves for
 * people who asked for reduced motion (the OS setting or the app's own).
 */
export function CardSlider({ label, children }: {label: string;children: React.ReactNode[];}) {
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const settle = useRef<number>();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotionConfig();
  const count = children.length;

  /** Distance between neighbouring cards, and where each copy starts. */
  const geometry = useCallback(() => {
    const el = track.current;
    const first = el?.children[0] as HTMLElement | undefined;
    const second = el?.children[1] as HTMLElement | undefined;
    if (!el || !first || !second) return null;
    const step = second.offsetLeft - first.offsetLeft;
    return { el, step, middle: step * count };
  }, [count]);

  // Start on the middle copy, and stay on the same card when the layout
  // changes width.
  useLayoutEffect(() => {
    const g = geometry();
    if (g) g.el.scrollLeft = g.middle;
    const onResize = () => {
      const r = geometry();
      if (r) r.el.scrollLeft = r.middle + active * r.step;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // Only on mount and when the card count changes; `active` is read fresh on resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry]);

  const onScroll = () => {
    const g = geometry();
    if (!g) return;
    const index = Math.round((g.el.scrollLeft - g.middle) / g.step);
    setActive((index % count + count) % count);
    // Once the slide settles, move from an outer copy back to the middle one.
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const s = geometry();
      if (!s) return;
      const span = s.step * count;
      if (s.el.scrollLeft < s.middle - s.step / 2) s.el.scrollLeft += span;else
      if (s.el.scrollLeft >= s.middle + span - s.step / 2) s.el.scrollLeft -= span;
    }, 150);
  };

  const move = useCallback((cards: number) => {
    const g = geometry();
    if (!g) return;
    g.el.scrollBy({ left: cards * g.step, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [geometry, reduceMotion]);

  const goTo = (i: number) => move(i - active);

  useEffect(() => {
    if (paused || reduceMotion || count < 2) return;
    const id = window.setTimeout(() => move(1), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [active, paused, reduceMotion, count, move]);

  useEffect(() => () => window.clearTimeout(settle.current), []);

  const copies = Array.from({ length: COPIES }, (_, copy) => children.map((child, i) =>
  <div
    key={`${copy}-${i}`}
    role={copy === 1 ? 'group' : undefined}
    aria-roledescription={copy === 1 ? 'slide' : undefined}
    aria-label={copy === 1 ? t('landing.slideOf', { n: i + 1, total: count }) : undefined}
    aria-hidden={copy === 1 ? undefined : true}
    className="flex w-[85%] shrink-0 snap-start sm:w-[300px] lg:w-[340px] [&>*]:w-full">
      {child}
    </div>
  ));

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}>
      <div
        ref={track}
        onScroll={onScroll}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto py-1 [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {copies}
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          {children.map((_, i) =>
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={t('landing.slideOf', { n: i + 1, total: count })}
            aria-current={i === active}
            className={`h-2 rounded-full transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            i === active ? 'w-6 bg-accent' : 'w-2 bg-line hover:bg-muted'}`
            } />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} aria-label={t('landing.prev')} className={arrowClass}>
            <ChevronLeftIcon className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => move(1)} aria-label={t('landing.next')} className={arrowClass}>
            <ChevronRightIcon className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>);

}
