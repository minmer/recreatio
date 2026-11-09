/**
 * KOSZTY I DAROWIZNY — ein offener Haushalt: geplant, tatsächlich, je Person,
 * und was an Spenden kam (Altbestand: `CostsPart`).
 *
 * Was ein Leser vom Haushalt will, ist, was es IHN kostet; der Topf ist
 * Zusammenhang. Ohne Teilnehmerzahl gibt es keinen Betrag je Person — dann
 * nimmt die Summe die Überschrift zurück, statt eine Lücke zu lassen.
 *
 * <b>Je Grösse:</b> im Streifen die drei Summen; als Block und hoch dazu die
 * Tabelle der Posten und die Spenden.
 */

import { appLang, localeOf, t, tIn, useT, type Lang } from '../../core/i18n';
import { lazyPart } from './partTexts';
import { AreaRow, asArray, asOptionalText, asRecord, asText, defineEventPart, Fieldset, ListEditor, NumberRow, TextRow } from '../event/kit';

type CostItem = { label: string; suggested: number | null; actual: number | null };
type Donation = { label: string; amount: number | null };
type CostsConfig = { currency: string; participantCount: number | null; costItems: CostItem[]; donations: Donation[]; note: string | null };

function optionalNonNegativeNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value
    : typeof value === 'string' && value.trim().length > 0 ? Number.parseFloat(value)
    : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readParticipantCount(value: unknown): number | null {
  const parsed = optionalNonNegativeNumber(value);
  return parsed !== null && parsed >= 1 ? Math.floor(parsed) : null;
}

const DEFAULT_CURRENCY = 'PLN';

function readCurrency(value: unknown): string {
  const candidate = asText(value, 'PLN').trim().toUpperCase();
  /* Ein halb getippter Code bleibt stehen; Intl.NumberFormat ist unten abgesichert. */
  return /^[A-Z]{1,3}$/.test(candidate) ? candidate : 'PLN';
}

function sumDefined(values: Array<number | null>): { total: number | null; count: number } {
  const defined = values.filter((value): value is number => value !== null);
  return { total: defined.length > 0 ? defined.reduce((sum, value) => sum + value, 0) : null, count: defined.length };
}

export function formatMoney(value: number | null, currency: string, lang: Lang = appLang()): string {
  if (value === null) return tIn(lang, 'moduleData.costs.missing');
  try {
    return new Intl.NumberFormat(localeOf(lang), { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

const perPerson = (total: number | null, count: number | null): number | null =>
  total !== null && count !== null && count > 0 ? total / count : null;

function Amount({ total, count, currency }: { total: number | null; count: number | null; currency: string }) {
  const t = useT();
  const each = perPerson(total, count);
  if (each === null) return <span className="ev-costs-lead">{formatMoney(total, currency, t.lang)}</span>;
  return (
    <>
      <span className="ev-costs-lead is-person">{formatMoney(each, currency, t.lang)}</span>
      <span className="ev-costs-sub">{t('moduleData.costs.perPersonTotal', { total: formatMoney(total, currency, t.lang) })}</span>
    </>
  );
}

function Costs({ config, strip }: { config: CostsConfig; strip: boolean }) {
  const t = useT();
  const suggested = sumDefined(config.costItems.map((item) => item.suggested));
  const actual = sumDefined(config.costItems.map((item) => item.actual));
  const donations = sumDefined(config.donations.map((item) => item.amount));
  const count = config.participantCount;
  const hasPerPerson = count !== null && count > 0;

  return (
    <div className="ev-costs">
      <div className="ev-costs-summary">
        <article className={hasPerPerson ? 'is-person' : ''}>
          <span>{hasPerPerson ? t('moduleData.costs.suggestedEach') : t('moduleData.costs.suggestedAll')}</span>
          <Amount total={suggested.total} count={count} currency={config.currency} />
        </article>
        <article className={hasPerPerson ? 'is-person' : ''}>
          <span>{hasPerPerson ? t('moduleData.costs.actualEach') : t('moduleData.costs.actualAll')}</span>
          <Amount total={actual.total} count={count} currency={config.currency} />
        </article>
        <article className="is-donations">
          <span>{t('moduleData.costs.donationsSum')}</span>
          <span className="ev-costs-lead">{formatMoney(donations.total, config.currency, t.lang)}</span>
          <span className="ev-costs-sub">{t('moduleData.costs.donationsCount', { count: donations.count })}</span>
        </article>
      </div>

      {!strip && (
        <>
          <p className="ev-costs-count">
            {count === null ? t('moduleData.costs.countMissing') : t('moduleData.costs.countFor', { count })}
          </p>

          {config.costItems.length > 0 ? (
            <div className="ev-costs-table-wrap">
              <table className="ev-costs-table">
                <thead>
                  <tr>
                    <th>{t('moduleData.costs.item')}</th>
                    <th>{hasPerPerson ? t('moduleData.costs.colSuggestedEach') : t('moduleData.costs.colSuggested')}</th>
                    <th>{hasPerPerson ? t('moduleData.costs.colActualEach') : t('moduleData.costs.colActual')}</th>
                  </tr>
                </thead>
                <tbody>
                  {config.costItems.map((item, index) => (
                    <tr key={`${item.label}-${index}`}>
                      <th scope="row">{item.label}</th>
                      <td><Amount total={item.suggested} count={count} currency={config.currency} /></td>
                      <td><Amount total={item.actual} count={count} currency={config.currency} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">{t('moduleData.costs.total')}</th>
                    <td><Amount total={suggested.total} count={count} currency={config.currency} /></td>
                    <td><Amount total={actual.total} count={count} currency={config.currency} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : <p className="ev-note">{t('moduleData.costs.noItems')}</p>}

          {config.donations.length > 0 && (
            <dl className="ev-costs-donations">
              {config.donations.map((donation, index) => (
                <div key={`${donation.label}-${index}`}>
                  <dt>{donation.label}</dt>
                  <dd>{formatMoney(donation.amount, config.currency, t.lang)}</dd>
                </div>
              ))}
            </dl>
          )}

          {config.note !== null && <p className="ev-note">{config.note}</p>}
        </>
      )}
    </div>
  );
}

/* Die Texte der Beschreibung je Sprache (`lazyPart`): `defineEventPart` liest sie beim Anlegen. */
export const costsPart = lazyPart(() => defineEventPart<CostsConfig>({
  kind: 'costs',
  label: t('moduleData.costs.label'),
  use: t('moduleData.costs.use'),
  box: { colSpan: 6, rowSpan: 3 },
  fullscreen: true,

  blank: () => ({ currency: 'PLN', participantCount: null, costItems: [], donations: [], note: null }),
  example: () => ({
    currency: 'PLN',
    participantCount: 24,
    costItems: [
      { label: t('moduleData.costs.ex.lodging'), suggested: 2400, actual: 2280 },
      { label: t('moduleData.costs.ex.food'), suggested: 1800, actual: 1764 },
      { label: t('moduleData.costs.ex.transport'), suggested: 1200, actual: 1320 }
    ],
    donations: [{ label: t('moduleData.costs.ex.donations'), amount: 3600 }, { label: t('moduleData.costs.ex.sponsors'), amount: 1000 }],
    note: t('moduleData.costs.ex.note')
  }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    currency: t('moduleData.costs.k.currency'),
    participantCount: t('moduleData.costs.k.participantCount'),
    costItems: t('moduleData.costs.k.costItems'),
    'costItems[].label': t('moduleData.costs.k.costLabel'),
    'costItems[].suggested': t('moduleData.costs.k.costSuggested'),
    'costItems[].actual': t('moduleData.costs.k.costActual'),
    donations: t('moduleData.costs.k.donations'),
    'donations[].label': t('moduleData.costs.k.donationLabel'),
    'donations[].amount': t('moduleData.costs.k.donationAmount'),
    note: t('moduleData.costs.k.note')
  },

  parse: (raw) => {
    const record = asRecord(raw);
    /* Posten ohne Namen fallen beim Lesen NICHT weg — der Editor legt sie leer an. Die Ansicht nimmt nur benannte. */
    const costItems = asArray(record.costItems).map((entry): CostItem => {
      const item = asRecord(entry);
      return { label: asText(item.label).trim(), suggested: optionalNonNegativeNumber(item.suggested), actual: optionalNonNegativeNumber(item.actual) };
    });
    const donations = asArray(record.donations).map((entry): Donation => {
      const item = asRecord(entry);
      return { label: asText(item.label).trim(), amount: optionalNonNegativeNumber(item.amount) };
    });
    return { currency: readCurrency(record.currency), participantCount: readParticipantCount(record.participantCount), costItems, donations, note: asOptionalText(record.note) };
  },

  hasContent: (c) => c.costItems.some((item) => item.label !== '') || c.donations.some((item) => item.label !== ''),

  shows: (_c, size) => size.height === 'strip' ? t('moduleData.costs.showsStrip') : t('moduleData.costs.showsBlock'),

  Body: ({ config, ctx }) => (
    <Costs
      config={{ ...config, costItems: config.costItems.filter((i) => i.label !== ''), donations: config.donations.filter((d) => d.label !== '') }}
      strip={ctx.size.height === 'strip'}
    />
  ),

  Edit: function CostsEdit({ config, onChange }) {
    const t = useT();
    return (
    <>
      <Fieldset legend={t('moduleData.costs.basis')}>
        <TextRow label={t('moduleData.costs.currency')} value={config.currency} placeholder={DEFAULT_CURRENCY} hint={t('moduleData.costs.currencyHint')}
          onChange={(currency) => onChange({ ...config, currency: currency.trim().toUpperCase().slice(0, 3) || 'PLN' })} />
        <NumberRow label={t('moduleData.costs.participants')} value={config.participantCount} step={1} min={1} placeholder={t('moduleData.costs.missing')}
          hint={t('moduleData.costs.participantsHint')} onChange={(next) => onChange({ ...config, participantCount: readParticipantCount(next) })} />
      </Fieldset>

      <ListEditor<CostItem>
        legend={t('moduleData.costs.items')}
        items={config.costItems}
        addLabel={t('moduleData.costs.addCost')}
        blank={() => ({ label: '', suggested: null, actual: null })}
        titleOf={(item, index) => item.label || t('moduleData.costs.costN', { n: index + 1 })}
        onChange={(costItems) => onChange({ ...config, costItems })}
        renderItem={(item, update) => (
          <>
            <TextRow label={t('common.name')} value={item.label} onChange={(label) => update({ ...item, label })} />
            <NumberRow label={t('moduleData.costs.suggestedIn', { currency: config.currency })} value={item.suggested} step="0.01" min={0} placeholder={t('moduleData.costs.missing')}
              onChange={(suggested) => update({ ...item, suggested: optionalNonNegativeNumber(suggested) })} />
            <NumberRow label={t('moduleData.costs.actualIn', { currency: config.currency })} value={item.actual} step="0.01" min={0} placeholder={t('moduleData.costs.missing')}
              onChange={(actual) => update({ ...item, actual: optionalNonNegativeNumber(actual) })} />
          </>
        )}
      />

      <ListEditor<Donation>
        legend={t('moduleData.costs.donationsLegend')}
        items={config.donations}
        addLabel={t('moduleData.costs.addDonation')}
        blank={() => ({ label: '', amount: null })}
        titleOf={(item, index) => item.label || t('moduleData.costs.donationN', { n: index + 1 })}
        onChange={(donations) => onChange({ ...config, donations })}
        renderItem={(item, update) => (
          <>
            <TextRow label={t('common.description')} value={item.label} onChange={(label) => update({ ...item, label })} />
            <NumberRow label={t('moduleData.costs.amountIn', { currency: config.currency })} value={item.amount} step="0.01" min={0} placeholder={t('moduleData.costs.missing')}
              onChange={(amount) => update({ ...item, amount: optionalNonNegativeNumber(amount) })} />
          </>
        )}
      />

      <AreaRow label={t('moduleData.costs.noteLabel')} rows={2} value={config.note ?? ''} onChange={(note) => onChange({ ...config, note: note || null })} />
    </>
    );
  }
}));
