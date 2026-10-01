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

function readCurrency(value: unknown): string {
  const candidate = asText(value, 'PLN').trim().toUpperCase();
  /* Ein halb getippter Code bleibt stehen; Intl.NumberFormat ist unten abgesichert. */
  return /^[A-Z]{1,3}$/.test(candidate) ? candidate : 'PLN';
}

function sumDefined(values: Array<number | null>): { total: number | null; count: number } {
  const defined = values.filter((value): value is number => value !== null);
  return { total: defined.length > 0 ? defined.reduce((sum, value) => sum + value, 0) : null, count: defined.length };
}

export function formatMoney(value: number | null, currency: string): string {
  if (value === null) return 'Do uzupełnienia';
  try {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

const perPerson = (total: number | null, count: number | null): number | null =>
  total !== null && count !== null && count > 0 ? total / count : null;

function Amount({ total, count, currency }: { total: number | null; count: number | null; currency: string }) {
  const each = perPerson(total, count);
  if (each === null) return <span className="ev-costs-lead">{formatMoney(total, currency)}</span>;
  return (
    <>
      <span className="ev-costs-lead is-person">{formatMoney(each, currency)}</span>
      <span className="ev-costs-sub">na osobę · {formatMoney(total, currency)} łącznie</span>
    </>
  );
}

function Costs({ config, strip }: { config: CostsConfig; strip: boolean }) {
  const suggested = sumDefined(config.costItems.map((item) => item.suggested));
  const actual = sumDefined(config.costItems.map((item) => item.actual));
  const donations = sumDefined(config.donations.map((item) => item.amount));
  const count = config.participantCount;
  const hasPerPerson = count !== null && count > 0;

  return (
    <div className="ev-costs">
      <div className="ev-costs-summary">
        <article className={hasPerPerson ? 'is-person' : ''}>
          <span>{hasPerPerson ? 'Koszt sugerowany na osobę' : 'Koszty sugerowane'}</span>
          <Amount total={suggested.total} count={count} currency={config.currency} />
        </article>
        <article className={hasPerPerson ? 'is-person' : ''}>
          <span>{hasPerPerson ? 'Koszt rzeczywisty na osobę' : 'Koszty rzeczywiste'}</span>
          <Amount total={actual.total} count={count} currency={config.currency} />
        </article>
        <article className="is-donations">
          <span>Suma wszystkich darowizn</span>
          <span className="ev-costs-lead">{formatMoney(donations.total, config.currency)}</span>
          <span className="ev-costs-sub">{donations.count} uzupełnionych wpłat</span>
        </article>
      </div>

      {!strip && (
        <>
          <p className="ev-costs-count">
            {count === null ? 'Podaj liczbę uczestników, aby zobaczyć przeliczenie.' : `Przeliczenie dla ${count} ${count === 1 ? 'osoby' : 'osób'}.`}
          </p>

          {config.costItems.length > 0 ? (
            <div className="ev-costs-table-wrap">
              <table className="ev-costs-table">
                <thead>
                  <tr>
                    <th>Pozycja</th>
                    <th>Sugerowane{hasPerPerson ? ' na osobę' : ''}</th>
                    <th>Rzeczywiste{hasPerPerson ? ' na osobę' : ''}</th>
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
                    <th scope="row">Razem</th>
                    <td><Amount total={suggested.total} count={count} currency={config.currency} /></td>
                    <td><Amount total={actual.total} count={count} currency={config.currency} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : <p className="ev-note">Pozycje kosztów nie zostały jeszcze uzupełnione.</p>}

          {config.donations.length > 0 && (
            <dl className="ev-costs-donations">
              {config.donations.map((donation, index) => (
                <div key={`${donation.label}-${index}`}>
                  <dt>{donation.label}</dt>
                  <dd>{formatMoney(donation.amount, config.currency)}</dd>
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

export const costsPart = defineEventPart<CostsConfig>({
  kind: 'costs',
  label: 'Koszty i darowizny',
  use: 'Planowane i rzeczywiste koszty, przeliczenie na osobę oraz suma darowizn.',
  box: { colSpan: 6, rowSpan: 3 },
  fullscreen: true,

  blank: () => ({ currency: 'PLN', participantCount: null, costItems: [], donations: [], note: null }),
  example: () => ({
    currency: 'PLN',
    participantCount: 24,
    costItems: [
      { label: 'Nocleg', suggested: 2400, actual: 2280 },
      { label: 'Wyżywienie', suggested: 1800, actual: 1764 },
      { label: 'Transport bagażu i rowerów', suggested: 1200, actual: 1320 }
    ],
    donations: [{ label: 'Darowizny uczestników', amount: 3600 }, { label: 'Wsparcie sponsorów', amount: 1000 }],
    note: 'Kwoty są aktualizowane przez organizatora.'
  }),

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

  shows: (_c, size) => size.height === 'strip' ? 'Trzy sumy: sugerowane, rzeczywiste, darowizny.' : 'Sumy, tabela pozycji (na osobę, jeśli podano liczbę uczestników) i darowizny.',

  Body: ({ config, ctx }) => (
    <Costs
      config={{ ...config, costItems: config.costItems.filter((i) => i.label !== ''), donations: config.donations.filter((d) => d.label !== '') }}
      strip={ctx.size.height === 'strip'}
    />
  ),

  Edit: ({ config, onChange }) => (
    <>
      <Fieldset legend="Podstawy obliczeń">
        <TextRow label="Waluta (kod ISO)" value={config.currency} placeholder="PLN" hint="Na przykład PLN, EUR albo USD."
          onChange={(currency) => onChange({ ...config, currency: currency.trim().toUpperCase().slice(0, 3) || 'PLN' })} />
        <NumberRow label="Liczba uczestników" value={config.participantCount} step={1} min={1} placeholder="Do uzupełnienia"
          hint="Na tej podstawie liczone są koszty na osobę." onChange={(next) => onChange({ ...config, participantCount: readParticipantCount(next) })} />
      </Fieldset>

      <ListEditor<CostItem>
        legend="Pozycje kosztów"
        items={config.costItems}
        addLabel="Dodaj koszt"
        blank={() => ({ label: '', suggested: null, actual: null })}
        titleOf={(item, index) => item.label || `Koszt ${index + 1}`}
        onChange={(costItems) => onChange({ ...config, costItems })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Nazwa" value={item.label} onChange={(label) => update({ ...item, label })} />
            <NumberRow label={`Koszt sugerowany (${config.currency})`} value={item.suggested} step="0.01" min={0} placeholder="Do uzupełnienia"
              onChange={(suggested) => update({ ...item, suggested: optionalNonNegativeNumber(suggested) })} />
            <NumberRow label={`Koszt rzeczywisty (${config.currency})`} value={item.actual} step="0.01" min={0} placeholder="Do uzupełnienia"
              onChange={(actual) => update({ ...item, actual: optionalNonNegativeNumber(actual) })} />
          </>
        )}
      />

      <ListEditor<Donation>
        legend="Darowizny"
        items={config.donations}
        addLabel="Dodaj darowiznę"
        blank={() => ({ label: '', amount: null })}
        titleOf={(item, index) => item.label || `Darowizna ${index + 1}`}
        onChange={(donations) => onChange({ ...config, donations })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Opis" value={item.label} onChange={(label) => update({ ...item, label })} />
            <NumberRow label={`Kwota (${config.currency})`} value={item.amount} step="0.01" min={0} placeholder="Do uzupełnienia"
              onChange={(amount) => update({ ...item, amount: optionalNonNegativeNumber(amount) })} />
          </>
        )}
      />

      <AreaRow label="Uwaga pod zestawieniem" rows={2} value={config.note ?? ''} onChange={(note) => onChange({ ...config, note: note || null })} />
    </>
  )
});
