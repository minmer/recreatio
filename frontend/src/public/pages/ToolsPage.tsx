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
import { rcPublicParishes } from '../../rc/parish/rcParishPublic';
import { publicHref } from '../publicRoutes';

export function ToolsPage({ copy }: { copy: PublicCopy }) {
  const t = copy.tools;

  return (
    <article className="pub-page pub-wide">
      <h1 className="pub-h1">{t.title}</h1>
      <p className="pub-lead">{t.lead}</p>

      {/*
        ZUERST DAS KONTO, DANN DIE LISTE.

        Vorher stand hier ein Verzeichnis von Werkzeugen und nirgends, dass
        keines davon ohne Konto etwas zeigt. Wer einer der Adressen folgte,
        landete auf einer Seite, die richtig aussieht und leer ist — und das
        liest sich als Fehler, nicht als Grenze.

        Der Hinweis steht deshalb VOR den Werkzeugen und nicht als Fussnote
        darunter: er ist die Voraussetzung fuer alles, was folgt.
      */}
      <aside className="pub-signin">
        <p className="pub-p">{t.signIn}</p>
        {/*
          Das Ziel ist die Kontouebersicht und nicht „die Anmeldeseite": eine
          eigene Adresse dafuer gibt es nicht. Solange die Schluessel fehlen,
          zeigt JEDE Adresse der Werkstatt das Anmeldeformular — und danach
          steht man dort, wo man hinwollte. Ein Umweg ueber eine Startseite
          waere ein Schritt, den niemand gewollt hat.
        */}
        <a className="pub-btn" href={rcPath('account')}>{t.signInDo}</a>
      </aside>

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

          return (
            <section className="pub-tool" key={tool.name}>
              <h3 className="pub-h3">
                {home === null ? tool.name : <a href={home}>{tool.name}</a>}
              </h3>

              <p className="pub-p">{tool.body}</p>

              {shown === null
                ? <p className="pub-tool-at" data-kind="none">{t.embedded}</p>
                : <p className="pub-tool-at"><code>{shown}</code></p>}


              <p className="pub-tool-open">
                <span className="pub-tool-tag">{t.openLabel}</span>
                {tool.open}
              </p>
            </section>
          );
        })}
      </div>

      {/*
        WAS ES SCHON GIBT — mit dem amtlichen Namen.

        Ein Verzeichnis von Werkzeugen sagt, was gebaut wird. Es sagt nicht,
        dass es schon eine Seite gibt, die man aufrufen kann. Wer seine eigene
        Pfarrei sucht, sucht ihren NAMEN und nicht das Wort „Parafia" — und
        findet ihn sonst nicht, obwohl die Seite fertig dasteht.
      */}
      <section className="pub-sec">
        <h2 className="pub-h2">{t.liveTitle}</h2>
        <p className="pub-p">{t.liveLead}</p>

        <ul className="pub-live">
          {rcPublicParishes().map((parish) => (
            <li key={parish.slug}>
              <a className="pub-live-link" href={rcPath('parish', parish.slug)}>
                <span className="pub-live-name">{parish.name}</span>
                <span className="pub-live-place">{parish.place}</span>
                <span className="pub-live-lead">{parish.lead}</span>
                <code>{`${RC_HASH_BASE}/parish/${parish.slug}`}</code>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="pub-note">{t.note}</p>

      <p className="pub-onward">
        <a href={publicHref('bezpieczenstwo')}>{copy.nav.bezpieczenstwo}</a>
        <a href={publicHref('przejrzystosc')}>{copy.nav.przejrzystosc}</a>
      </p>
    </article>
  );
}
