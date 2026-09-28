import { useEffect, useState } from 'react';
import { ClockIcon } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';
import { usePreferences } from '../../contexts/PreferencesContext';

const TIME_ZONE = 'Africa/Lagos';

function safeFormat(locale: string, options: Intl.DateTimeFormatOptions, date: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, ...options }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-NG', { timeZone: TIME_ZONE, ...options }).format(date);
  }
}

export function LiveClock() {
  const { locale } = useI18n();
  const { prefs } = usePreferences();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const date = safeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, now);
  const time = safeFormat(
    locale,
    {
      hour: '2-digit',
      minute: '2-digit',
      second: prefs.showSeconds ? '2-digit' : undefined,
      hour12: prefs.timeFormat === '12h'
    },
    now
  );

  return (
    <time
      dateTime={now.toISOString()}
      title={`${date} · ${time} WAT`}
      className="hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-line px-2.5 py-1.5 text-xs min-[400px]:flex">
      
      <ClockIcon className="hidden h-3.5 w-3.5 text-muted sm:block" aria-hidden />
      <span className="hidden text-muted xl:inline">{date}</span>
      <span className="hidden h-3 w-px bg-line xl:inline-block" aria-hidden />
      <span className="font-mono font-medium tabular-nums">{time}</span>
      <span className="hidden text-muted md:inline">WAT</span>
    </time>);

}