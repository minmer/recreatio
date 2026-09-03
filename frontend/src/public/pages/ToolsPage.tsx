/**
 * „Narzędzia" — was REcreatio baut und wer es benutzen darf.
 *
 * <b>Die Seite hat drei Sätze pro Werkzeug und nicht drei Absätze.</b> Wer
 * hierherkommt, will wissen, was es gibt und ob etwas davon schon läuft. Eine
 * Begründung, warum die Werkzeuge so gebaut sind, steht auf der
 * Sicherheitsseite; hier wäre sie im Weg.
 *
 * <b>Die fertigen Instanzen stehen unter ihrem Werkzeug</b>, mit dem Namen, den
 * sie wirklich tragen — geholt vom Dienst und nicht aus einer Liste in dieser
 * Datei. Eine gepflegte Liste läuft auseinander, und zwar unbemerkt: sie sieht
 * richtig aus, während sie es nicht mehr ist.
 *
 * <b>Bierzmowanie ist kein eigenes Werkzeug.</b> Es ist ein Teil der Pfarrei —
 * ein eigener Punkt daneben liesse es wie eine zweite Einrichtung aussehen,
 * die man getrennt anlegt.
 */

import { useEffect, useState } from 'react';

import type { PublicCopy } from '../content';
import { RC_HASH_BASE, rcPath } from '../../rc/lib/rcRoute';
import { publicHref } from '../publicRoutes';
import { rcPublicParishes, type RcPublicParishView } from '../../rc/parish/rcPublicParish';

export function ToolsPage({ copy }: { copy: PublicCopy }) {
  const t = copy.tools;

  /*
   * Die Pfarrseiten kommen vom Dienst. Schweigt er, bleibt die Liste leer und
   * der Rest der Seite steht trotzdem — ein Verzeichnis von Werkzeugen ist
   * auch ohne laufende Instanzen eine Auskunft.
   */
  const [parishes, setParishes] = useState<readonly RcPublicParishView[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const answer = await rcPublicParishes();
        if (alive) setParishes(answer.parishes ?? []);
      } catch { /* Die Liste bleibt leer; die Seite sagt es selbst. */ }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <article className="pub-page pub-wide">
      <h1 className="pub-h1">{t.title}</h1>
      <p className="pub-lead">{t.lead}</p>

      <div className="pub-tools">
        {t.items.map((tool) => {
          const instances = tool.part === 'parish'
            ? parishes.map((p) => ({
                key: p.slug,
                name: p.name,
                note: p.location ?? '',
                href: rcPath('parish', p.slug),
                at: `${RC_HASH_BASE}/parish/${p.slug}`
              }))
            : [];

          return (
            <section className="pub-tool" key={tool.name}>
              <h2 className="pub-tool-name">{tool.name}</h2>
              <p className="pub-tool-body">{tool.body}</p>

              {/*
                Die fertigen Instanzen. Sie stehen unter ihrem Werkzeug und
                nicht in einem eigenen Abschnitt: „was gibt es davon schon"
                ist eine Frage ZU diesem Werkzeug.
              */}
              {instances.length > 0 && (
                <ul className="pub-instances">
                  {instances.map((i) => (
                    <li key={i.key}>
                      <a className="pub-instance" href={i.href}>
                        <span className="pub-instance-name">{i.name}</span>
                        {i.note !== '' && <span className="pub-instance-note">{i.note}</span>}
                        <code>{i.at}</code>
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {instances.length === 0 && tool.part !== null && (
                <p className="pub-instances-none">{t.noneYet}</p>
              )}

              {/*
                Der Weg zum eigenen. Er führt in die Werkstatt; wer dort keine
                Schlüssel hat, sieht zuerst das Anmeldeformular und danach die
                Stelle, an der er anlegt.
              */}
              {tool.part !== null && (
                <a className="pub-btn pub-tool-make" href={rcPath(tool.part)}>
                  {tool.make}
                </a>
              )}

              {tool.part === null && <p className="pub-tool-at" data-kind="none">{t.embedded}</p>}
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
