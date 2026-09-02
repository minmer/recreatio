/**
 * „Narzędzia" — das Verzeichnis dessen, was gebaut wird.
 *
 * <b>Diese Seite ist ein Nachschlagewerk, keine Haltung.</b> Warum die
 * Werkzeuge so gebaut sind, steht auf der Sicherheitsseite; hier steht, WELCHE
 * es gibt, wo sie liegen und was ohne Schlüssel davon zu sehen ist. Die beiden
 * Seiten verweisen aufeinander und wiederholen sich nicht.
 *
 * <b>Die Adressen werden nicht getippt, sondern gebaut.</b> `rcPath` und
 * `RC_HASH_BASE` stammen aus derselben Datei, die auch die Plattform benutzt —
 * steht dort eines Tages `#` statt `#/new`, ändert sich diese Seite von selbst
 * mit. Eine Liste von Adressen, die als Text danebensteht, ist genau die Art
 * Angabe, die still veraltet.
 *
 * <b>Der Stand gehört dazu.</b> Ein Verzeichnis ohne die Zeile, dass die Teile
 * verschieden weit sind, liest sich als Angebot. Es ist aber eine Auskunft
 * darüber, was entsteht.
 */

import type { PublicCopy } from '../content';
import { RC_HASH_BASE, rcPath } from '../../rc/lib/rcRoute';
import { rcKnownSlugs } from '../../rc/lib/rcSlugs';
import { publicHref } from '../publicRoutes';

export function ToolsPage({ copy }: { copy: PublicCopy }) {
  const t = copy.tools;

  return (
    <article className="pub-page pub-wide">
      <h1 className="pub-h1">{t.title}</h1>
      <p className="pub-lead">{t.lead}</p>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.addressTitle}</h2>
        <p className="pub-p">{t.address}</p>
      </section>

      <div className="pub-tools">
        {t.items.map((tool) => {
          /*
           * Ein Werkzeug ohne eigenen Teil hat keine Adresse — und bekommt
           * deshalb auch keinen Verweis, der ins Leere zeigte. Stattdessen
           * steht dort, was stattdessen gilt.
           */
          const part = tool.part;
          const home = part === null ? null : rcPath(part);
          const shown = part === null ? null : `${RC_HASH_BASE}/${part}/${t.slug}`;

          /*
           * Was es davon schon GIBT. Ein Muster allein sagt nur, wie eine
           * Adresse gebaut waere; erst ein wirklicher Name sagt, dass es das
           * Ding gibt. Die Liste steht in rcSlugs und nicht im Text: sie
           * gehoert zu den Adressen und wird nicht uebersetzt.
           */
          const known = part === null ? [] : rcKnownSlugs(part);

          return (
            <section className="pub-tool" key={tool.name}>
              <h3 className="pub-h3">
                {home === null ? tool.name : <a href={home}>{tool.name}</a>}
              </h3>

              <p className="pub-p">{tool.body}</p>

              {shown === null
                ? <p className="pub-tool-at" data-kind="none">{t.embedded}</p>
                : <p className="pub-tool-at"><code>{shown}</code></p>}

              {part !== null && known.length > 0 && (
                <p className="pub-tool-open">
                  <span className="pub-tool-tag">{t.instances}</span>
                  {known.map((slug, at) => (
                    <span key={slug}>
                      {at > 0 && ', '}
                      <a href={rcPath(part, slug)}><code>{slug}</code></a>
                    </span>
                  ))}
                </p>
              )}

              <p className="pub-tool-open">
                <span className="pub-tool-tag">{t.openLabel}</span>
                {tool.open}
              </p>
            </section>
          );
        })}
      </div>

      <p className="pub-note">{t.note}</p>

      <p className="pub-onward">
        <a href={publicHref('bezpieczenstwo')}>{copy.nav.bezpieczenstwo}</a>
        <a href={publicHref('przejrzystosc')}>{copy.nav.przejrzystosc}</a>
      </p>
    </article>
  );
}
