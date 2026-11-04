import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotionConfig } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

const AUTO_ADVANCE_MS = 5000;

// Slide width, and the spacer that lets the first and last slides reach the
// middle: (100% - slide) / 2. Both are percentages of the track, so they stay
// in step at every breakpoint.
const SLIDE = 'w-[85%] sm:w-[60%] lg:w-[40%]';
const SPACER = 'w-[7.5%] sm:w-[20%] lg:w-[30%]';

const arrowClass =
'flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-150 ease-out hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40';

/**
 * A row of cards that slides sideways on every screen size: swipe or scroll,
 * the arrows, or the dots. The active card sits in the middle with its
 * neighbours peeking in, so every card gets a turn and each step moves by one
 * card. It advances on its own every few seconds, but stops while someone is
 * hovering, touching or tabbing through it, and never moves for people who
 * asked for reduced motion (the OS setting or the app's own).
 */
export function CardSlider({ label, children }: {label: string;children: React.ReactNode[];}) {
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotionConfig();
  const count = children.length;

  /** Where the track must scroll for slide `i` to sit in the middle. */
  const centreOf = (el: HTMLDivElement, slide: HTMLDivElement) =>
  slide.offsetLeft - el.offsetLeft - (el.clientWidth - slide.clientWidth) / 2;

  const goTo = useCallback((i: number) => {
    const el = track.current;
    const slide = slides.current[i];
    if (!el || !slide) return;
    el.scrollTo({ left: centreOf(el, slide), behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [reduceMotion]);

  // The active slide follows the scroll position, however it was moved.
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    let nearest = 0;
    let best = Infinity;
    slides.current.forEach((slide, i) => {
      if (!slide) return;
      const d = Math.abs(centreOf(el, slide) - el.scrollLeft);
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
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className={`${SPACER} shrink-0`} aria-hidden />
        {children.map((child, i) =>
        <div
          key={i}
          ref={(node) => {slides.current[i] = node;}}
          role="group"
          aria-roledescription="slide"
          aria-label={t('landing.slideOf', { n: i + 1, total: count })}
          className={`${SLIDE} flex shrink-0 snap-center transition-opacity duration-300 ease-out [&>*]:w-full ${i === active ? 'opacity-100' : 'opacity-60'}`}>
            {child}
          </div>
        )}
        <div className={`${SPACER} shrink-0`} aria-hidden />
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
