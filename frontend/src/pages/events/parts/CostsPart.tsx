import { asArray, asOptionalText, asRecord, asText, definePart } from './contracts';
import { AreaRow, Fieldset, ListEditor, TextRow } from './editorKit';

type CostItem = {
  label: string;
  suggested: number | null;
  actual: number | null;
};

type Donation = {
  label: string;
  amount: number | null;
};

type CostsConfig = {
  currency: string;
  participantCount: number | null;
  costItems: CostItem[];
  donations: Donation[];
  note: string | null;
};

function optionalNonNegativeNumber(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number.parseFloat(value)
      : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readParticipantCount(value: unknown): number | null {
  const parsed = optionalNonNegativeNumber(value);
  return parsed !== null && parsed >= 1 ? Math.floor(parsed) : null;
}

function readCurrency(value: unknown): string {
  const candidate = asText(value, 'PLN').trim().toUpperCase();
  // Keep a one- or two-letter value while the controlled editor is being typed.
  // Intl.NumberFormat is guarded below, so a half-finished code is harmless.
  return /^[A-Z]{1,3}$/.test(candidate) ? candidate : 'PLN';
}

function sumDefined(values: Array<number | null>): { total: number | null; count: number } {
  const defined = values.filter((value): value is number => value !== null);
  return {
    total: defined.length > 0 ? defined.reduce((sum, value) => sum + value, 0) : null,
    count: defined.length
  };
}

function formatMoney(value: number | null, currency: string): string {
  if (value === null) return 'Do uzupełnienia';
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function perPerson(total: number | null, count: number | null): number | null {
  return total !== null && count !== null && count > 0 ? total / count : null;
}

function OptionalNumberRow({
  label,
  value,
  onChange,
  hint,
  step = '0.01'
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  hint?: string;
  step?: string;
}) {
  return (
    <label className="eve-row">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        value={value ?? ''}
        placeholder="Do uzupełnienia"
        onChange={(event) => onChange(optionalNonNegativeNumber(event.target.value))}
      />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

/** A transparent event budget: estimates, actual spending and received donations. */
export const costsPart = definePart<CostsConfig>({
  kind: 'costs',
  label: 'Koszty i darowizny',
  description: 'Planowane i rzeczywiste koszty, przeliczenie na osobę oraz suma darowizn.',

  defaultConfig: () => ({
    currency: 'PLN',
    participantCount: null,
    costItems: [],
    donations: [],
    note: null
  }),

  example: () => ({
    currency: 'PLN',
    participantCount: 24,
    costItems: [
      { label: 'Nocleg', suggested: 2400, actual: 2280 },
      { label: 'Wyżywienie', suggested: 1800, actual: 1764 },
      { label: 'Transport bagażu i rowerów', suggested: 1200, actual: 1320 }
    ],
    donations: [
      { label: 'Darowizny uczestników', amount: 3600 },
      { label: 'Wsparcie sponsorów', amount: 1000 }
    ],
    note: 'Kwoty są aktualizowane przez organizatora.'
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    const costItems = asArray(record.costItems)
      .map((entry): CostItem | null => {
        const item = asRecord(entry);
        const label = asText(item.label).trim();
        if (!label) return null;
        return {
          label,
          suggested: optionalNonNegativeNumber(item.suggested),
          actual: optionalNonNegativeNumber(item.actual)
        };
      })
      .filter((entry): entry is CostItem => entry !== null);
    const donations = asArray(record.donations)
      .map((entry): Donation | null => {
        const item = asRecord(entry);
        const label = asText(item.label).trim();
        if (!label) return null;
        return { label, amount: optionalNonNegativeNumber(item.amount) };
      })
      .filter((entry): entry is Donation => entry !== null);

    return {
      currency: readCurrency(record.currency),
      participantCount: readParticipantCount(record.participantCount),
      costItems,
      donations,
      note: asOptionalText(record.note)
    };
  },

  Renderer: ({ config }) => {
    const suggested = sumDefined(config.costItems.map((item) => item.suggested));
    const actual = sumDefined(config.costItems.map((item) => item.actual));
    const donations = sumDefined(config.donations.map((item) => item.amount));
    const countLabel = config.participantCount === null
      ? 'Podaj liczbę uczestników, aby zobaczyć przeliczenie.'
      : `Przeliczenie dla ${config.participantCount} ${config.participantCount === 1 ? 'osoby' : 'osób'}.`;

    return (
      <div className="ev-costs">
        <div className="ev-costs-summary">
          <article>
            <span>Koszty sugerowane</span>
            <strong>{formatMoney(suggested.total, config.currency)}</strong>
            <small>{formatMoney(perPerson(suggested.total, config.participantCount), config.currency)} / os.</small>
          </article>
          <article>
            <span>Koszty rzeczywiste</span>
            <strong>{formatMoney(actual.total, config.currency)}</strong>
            <small>{formatMoney(perPerson(actual.total, config.participantCount), config.currency)} / os.</small>
          </article>
          <article className="is-donations">
            <span>Suma wszystkich darowizn</span>
            <strong>{formatMoney(donations.total, config.currency)}</strong>
            <small>{donations.count} uzupełnionych wpłat</small>
          </article>
        </div>

        <p className="ev-costs-count">{countLabel}</p>

        {config.costItems.length > 0 ? (
          <div className="ev-costs-table-wrap">
            <table className="ev-costs-table">
              <thead>
                <tr>
                  <th>Pozycja</th>
                  <th>Sugerowane</th>
                  <th>Rzeczywiste</th>
                </tr>
              </thead>
              <tbody>
                {config.costItems.map((item, index) => (
                  <tr key={`${item.label}-${index}`}>
                    <th scope="row">{item.label}</th>
                    <td>{formatMoney(item.suggested, config.currency)}</td>
                    <td>{formatMoney(item.actual, config.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ev-note">Pozycje kosztów nie zostały jeszcze uzupełnione.</p>
        )}

        {config.donations.length > 0 ? (
          <dl className="ev-costs-donations">
            {config.donations.map((donation, index) => (
              <div key={`${donation.label}-${index}`}>
                <dt>{donation.label}</dt>
                <dd>{formatMoney(donation.amount, config.currency)}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {config.note ? <p className="ev-note">{config.note}</p> : null}
      </div>
    );
  },

  Editor: ({ config, onChange }) => (
    <>
      <Fieldset legend="Podstawy obliczeń">
        <TextRow
          label="Waluta (kod ISO)"
          value={config.currency}
          placeholder="PLN"
          hint="Na przykład PLN, EUR albo USD."
          onChange={(currency) => onChange({ ...config, currency: currency.trim().toUpperCase().slice(0, 3) || 'PLN' })}
        />
        <OptionalNumberRow
          label="Liczba uczestników"
          value={config.participantCount}
          step="1"
          hint="Na tej podstawie obliczane są koszty sugerowane i rzeczywiste na osobę."
          onChange={(next) => onChange({ ...config, participantCount: readParticipantCount(next) })}
        />
      </Fieldset>

      <ListEditor<CostItem>
        legend="Pozycje kosztów"
        items={config.costItems}
        addLabel="Dodaj koszt"
        blank={() => ({ label: 'Nowy koszt', suggested: null, actual: null })}
        titleOf={(item) => item.label || 'Koszt'}
        onChange={(costItems) => onChange({ ...config, costItems })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Nazwa" value={item.label} onChange={(label) => update({ ...item, label })} />
            <OptionalNumberRow
              label={`Koszt sugerowany (${config.currency})`}
              value={item.suggested}
              onChange={(suggested) => update({ ...item, suggested })}
            />
            <OptionalNumberRow
              label={`Koszt rzeczywisty (${config.currency})`}
              value={item.actual}
              onChange={(actual) => update({ ...item, actual })}
            />
          </>
        )}
      />

      <ListEditor<Donation>
        legend="Darowizny"
        items={config.donations}
        addLabel="Dodaj darowiznę"
        blank={() => ({ label: 'Darowizna', amount: null })}
        titleOf={(item) => item.label || 'Darowizna'}
        onChange={(donations) => onChange({ ...config, donations })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Opis" value={item.label} onChange={(label) => update({ ...item, label })} />
            <OptionalNumberRow
              label={`Kwota (${config.currency})`}
              value={item.amount}
              onChange={(amount) => update({ ...item, amount })}
            />
          </>
        )}
      />

      <AreaRow
        label="Uwaga pod zestawieniem"
        rows={2}
        value={config.note ?? ''}
        onChange={(note) => onChange({ ...config, note: note || null })}
      />
    </>
  )
});
