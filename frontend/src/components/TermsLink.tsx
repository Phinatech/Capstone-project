import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';

/**
 * A translated sentence with the Terms and Privacy link in place of `{link}`.
 * The link opens in a new tab, so a half-filled form is not lost.
 */
export function WithTermsLink({ text }: {text: string;}) {
  const { t } = useI18n();
  const [before, after = ''] = text.split('{link}');
  return (
    <>
      {before}
      <Link
        to="/terms"
        target="_blank"
        rel="noopener"
        onClick={(e) => e.stopPropagation()}
        className="font-medium text-accent underline-offset-2 hover:underline">
        {t('legal.link')}
      </Link>
      {after}
    </>);

}

/** Splits a section body into paragraphs and bullet lists ("- " lines). */
export function LegalBody({ text }: {text: string;}) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-5 list-disc space-y-1.5">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    );
    bullets = [];
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2));
    } else {
      flush();
      blocks.push(<p key={`p-${blocks.length}`}>{line}</p>);
    }
  }
  flush();
  return <div className="space-y-3">{blocks}</div>;
}
