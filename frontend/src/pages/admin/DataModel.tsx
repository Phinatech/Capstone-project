import { PageHeader } from '../../components/PageHeader';
import { useI18n } from '../../contexts/I18nContext';

// Entity names are the contract's own identifiers, so they stay as written.
const entities = [
{ name: 'Farmer', text: 'dataModel.farmer' },
{ name: 'Policy', text: 'dataModel.policy' },
{ name: 'OracleSource', text: 'dataModel.source' },
{ name: 'WeatherReading', text: 'dataModel.reading' },
{ name: 'Payout', text: 'dataModel.payout' }] as const;


export function DataModel() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader
        title={t('dataModel.title')}
        description={t('dataModel.description')} />
      
      <figure className="rounded-lg border border-line bg-surface p-4 md:p-8">
        <img
          src="/pasted-image.png"
          alt={t('dataModel.alt')}
          className="mx-auto w-full max-w-4xl" />
        
        <figcaption className="mt-4 text-center text-xs text-muted">{t('dataModel.caption')}</figcaption>
      </figure>
      <dl className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2">
        {entities.map((e) =>
        <div key={e.name} className="border-t border-line pt-4">
            <dt className="font-mono text-sm font-medium">{e.name}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{t(e.text)}</dd>
          </div>
        )}
      </dl>
    </div>);

}