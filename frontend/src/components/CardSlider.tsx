import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotionConfig } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

const AUTO_ADVANCE_MS = 5000;

const arrowClass =
'flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-150 ease-out hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40';

/**
 * A row of cards that slides sideways on every screen size: swipe or scroll,
 * the arrows, or the dots. Slides are narrower than the row, so the next card
 * always peeks in. It advances on its own every few seconds, but stops while
 * someone is hovering, touching or tabbing through it, and never moves for
 * people who asked for reduced motion (the OS setting or the app's own).
 */
export function CardSlider({ label, children }: {label: string;children: React.ReactNode[];}) {
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotionConfig();
  const count = children.length;

  const goTo = useCallback((i: number) => {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [reduceMotion]);

  // The active slide follows the scroll position, however it was moved. At
  // the end of the row the last slide counts as active even though it cannot
  // reach the left edge.
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 4) {
      setActive(count - 1);
      return;
    }
    let nearest = 0;
    let best = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const d = Math.abs((c as HTMLElement).offsetLeft - el.offsetLeft - el.scrollLeft);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setActive(nearest);
  };

  useEffect(() => {
    if (paused || reduceMotion || count < 2) return;
    const id = window.setTimeout(() => goTo((active + 1) % count), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [active, paused, reduceMotion, count, goTo]);

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
        className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children.map((child, i) =>
        <div
          key={i}
          role="group"
          aria-roledescription="slide"
          aria-label={t('landing.slideOf', { n: i + 1, total: count })}
          className="flex w-[85%] shrink-0 snap-start sm:w-[60%] lg:w-[40%] 2xl:w-[36%] [&>*]:w-full">
            {child}
          </div>
        )}
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
          <button type="button" onClick={() => goTo(Math.max(0, active - 1))} disabled={active === 0} aria-label={t('landing.prev')} className={arrowClass}>
            <ChevronLeftIcon className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => goTo(active + 1 < count ? active + 1 : 0)} aria-label={t('landing.next')} className={arrowClass}>
            <ChevronRightIcon className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>);

}
