/**
 * Der Osrodek in Limanowa (Abschnitt 4.2).
 *
 * <b>Im Bau, und das steht ganz oben.</b> Der Quelltext sagt „powstajacy" —
 * entstehend. Eine Seite, die sich wie ein offenes Gaestehaus liest, waere eine
 * erfundene Tatsache, auch ohne einen einzigen falschen Satz: es genuegt, den
 * Stand zu verschweigen und Belegungsplan und Anfrageformular zu zeigen.
 * Deshalb der Hinweis vor allem anderen.
 *
 * <b>Eine einzige bewegliche Insel</b> — die Belegung. Alles andere ist
 * unveraenderlicher Text und steht auch dann da, wenn kein JavaScript laeuft.
 */

import type { PublicCopy } from '../content';
import { PublicText } from '../PublicText';
import { Availability } from '../osrodek/Availability';
import { EnquiryForm } from '../osrodek/EnquiryForm';

export function OsrodekPage({ copy }: { copy: PublicCopy }) {
  const t = copy.osrodek;

  return (
    <article className="pub-page pub-osrodek">
      <h1 className="pub-h1">{t.title}</h1>

      {/* Vor allem anderen. */}
      <p className="pub-standing pub-building">{t.underConstruction}</p>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.purpose.title}</h2>
        <p className="pub-p">{t.purpose.body}</p>
      </section>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.capacity.title}</h2>
        <p className="pub-p">{t.capacity.body}</p>
        <PublicText value={t.capacity.exact} copy={copy} as="div" />
        <ul className="pub-tags">
          {t.capacity.groups.map((group) => <li key={group}>{group}</li>)}
        </ul>
      </section>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.character.title}</h2>
        <p className="pub-p">{t.character.body}</p>
      </section>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.facilities.title}</h2>
        <ul className="pub-list">
          {t.facilities.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.openToOthers.title}</h2>
        <p className="pub-p">{t.openToOthers.body}</p>
        <ul className="pub-tags">
          {t.openToOthers.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.supports.title}</h2>
        <p className="pub-p">{t.supports.body}</p>
      </section>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.where.title}</h2>
        <PublicText value={t.where.address} copy={copy} as="div" />
        <PublicText value={t.photos} copy={copy} as="div" />
      </section>

      <Availability copy={copy} />
      <EnquiryForm copy={copy} />
    </article>
  );
}
