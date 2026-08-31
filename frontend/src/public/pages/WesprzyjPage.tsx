/**
 * „Wesprzyj" — die SEITE, nicht der Mechanismus (Abschnitt 6).
 *
 * <b>Kein Konto, kein Knopf, kein Betrag, kein „1,5 %".</b> Eine formlose
 * Initiative darf keinen Spendenaufruf fuehren; sie hat keine Rechtsperson, die
 * eine Zuwendung entgegennehmen koennte, und keine Buchfuehrung, die sie
 * ausweisen wuerde. Was bleibt, ist die ehrliche Aufzaehlung dessen, was
 * jemand wirklich beitragen kann.
 *
 * <b>Die Naht fuer spaeter.</b> Aus dieser Seite wird einmal die Sammelstelle
 * eines Finanzteils mit zwei Schichten: versiegelte Buchfuehrung und Belege
 * unten, eine schmale oeffentliche Projektion oben, die Projektkosten und
 * Fehlbetraege zeigt — niemals, wer was gegeben hat. Nichts davon wird jetzt
 * gebaut. Die Naht ist diese Datei und der Abschnitt `financialLater`: dort
 * tritt spaeter der Verweis auf den Finanzteil an die Stelle des Satzes.
 */

import type { PublicCopy } from '../content';

export function WesprzyjPage({ copy }: { copy: PublicCopy }) {
  const t = copy.wesprzyj;

  return (
    <article className="pub-page">
      <h1 className="pub-h1">{t.title}</h1>
      <p className="pub-lead">{t.lead}</p>

      <ul className="pub-ways">
        {t.ways.map((way) => (
          <li key={way.name}>
            <h2 className="pub-h3">{way.name}</h2>
            <p className="pub-p">{way.body}</p>
          </li>
        ))}
      </ul>

      {/* Die eine ehrliche Zeile. Mehr nicht — jeder Zusatz waere ein Aufruf. */}
      <p className="pub-standing">{t.financialLater}</p>

      <p className="pub-onward">
        <a href={`mailto:${copy.contact.email}`}>{copy.contact.email}</a>
      </p>
    </article>
  );
}
