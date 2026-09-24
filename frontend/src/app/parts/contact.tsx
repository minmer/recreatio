/**
 * Anschrift, Nummer, E-Mail.
 *
 * <b>Der eine Baustein, der etwas kann, was ein Text nicht kann:</b> auf einem
 * Telefon ist eine Nummer zum Anrufen da und nicht zum Abtippen. Dieselben drei
 * Zeilen als Fliesstext wären dreimal Abtippen.
 *
 * <b>Die Überschrift steht fest.</b> „Kontakt" heisst dieser Kasten überall;
 * ein Feld dafür wäre eine Frage, deren Antwort schon dasteht.
 */

import { definePart, text, type RawConfig } from '../part';

interface Config {
  readonly address: string;
  readonly phone: string;
  readonly email: string;
}

const read = (raw: RawConfig): Config => ({
  address: text(raw, 'address'),
  phone: text(raw, 'phone'),
  email: text(raw, 'email')
});

export const contactPart = definePart<Config>({
  kind: 'contact',
  label: 'Kontakt',
  use: 'Adres, telefon, e-mail — numer da się kliknąć.',
  box: { colSpan: 2, rowSpan: 3 },

  fields: [
    { key: 'address', label: 'Adres', kind: 'line', hint: 'ul. …, 00-000 Miasto' },
    { key: 'phone', label: 'Telefon', kind: 'line' },
    { key: 'email', label: 'E-mail', kind: 'line' }
  ],

  read,
  hasContent: (c) => c.address !== '' || c.phone !== '' || c.email !== '',

  View: ({ config }) => (
    <>
      <h2 className="wk-card-title">Kontakt</h2>
      <ul className="wk-card-lines">
        {config.address !== '' && <li>{config.address}</li>}

        {config.phone !== '' && (
          <li>
            <a className="wk-link" href={`tel:${config.phone.replace(/\s+/g, '')}`}>
              {config.phone}
            </a>
          </li>
        )}

        {config.email !== '' && (
          <li><a className="wk-link" href={`mailto:${config.email}`}>{config.email}</a></li>
        )}
      </ul>
    </>
  )
});
