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

import { t, useT } from '../../core/i18n';
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

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { address: 'ul. Przykładowa 1, 30-001 Kraków', phone: '+48 12 000 00 00', email: 'kancelaria@example.pl' }, // i18n-ignore
  label: 'moduleContent.contact.label',
  use: 'moduleContent.contact.use',
  box: { colSpan: 2, rowSpan: 3 },

  fields: [
    { key: 'address', label: 'moduleContent.contact.address', kind: 'line', hint: 'moduleContent.contact.addressHint' },
    { key: 'phone', label: 'moduleContent.contact.phone', kind: 'line' },
    { key: 'email', label: 'moduleContent.contact.email', kind: 'line' }
  ],

  read,
  hasContent: (c) => c.address !== '' || c.phone !== '' || c.email !== '',

  /*
   * DIESELBEN DREI ANGABEN, anders gelegt: im Streifen hintereinander, schmal
   * untereinander mit Beschriftung, breit nebeneinander. Hoch kommt der Weg
   * dazu — ein Verweis auf die Karte, erst beim Anklicken geht die Anschrift
   * hinaus.
   */
  shows: (_config, size) =>
    size.height === 'strip' ? t('moduleContent.contact.showsStrip')
    : size.width === 'wide' || size.width === 'full'
      ? t(size.height === 'tall' ? 'moduleContent.contact.showsWideMap' : 'moduleContent.contact.showsWide')
      : t(size.height === 'tall' ? 'moduleContent.contact.showsListMap' : 'moduleContent.contact.showsList'),

  View: function ContactView({ config, ctx }) {
    const t = useT();
    return (
    <>
      <h2 className="wk-card-title">{t('moduleContent.contact.title')}</h2>
      <ul className="wk-card-lines wk-contact">
        {config.address !== '' && (
          <li>
            <span className="wk-contact-label">{t('moduleContent.contact.address')}</span>
            <span>{config.address}</span>
            {ctx.size.height === 'tall' && (
              <a
                className="wk-link wk-contact-map"
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(config.address)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('moduleContent.contact.showMap')}
              </a>
            )}
          </li>
        )}

        {config.phone !== '' && (
          <li>
            <span className="wk-contact-label">{t('moduleContent.contact.phone')}</span>
            <a className="wk-link" href={`tel:${config.phone.replace(/\s+/g, '')}`}>
              {config.phone}
            </a>
          </li>
        )}

        {config.email !== '' && (
          <li>
            <span className="wk-contact-label">{t('moduleContent.contact.email')}</span>
            <a className="wk-link" href={`mailto:${config.email}`}>{config.email}</a>
          </li>
        )}
      </ul>
    </>
    );
  }
});
