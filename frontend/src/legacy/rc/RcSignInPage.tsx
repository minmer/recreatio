/**
 * Die Anmeldeseite — und sonst nichts.
 *
 * <b>Wer nicht angemeldet ist, sieht keine Werkstatt.</b> Vorher stand das
 * Formular als ein Abschnitt unter vielen: darüber die Baustandsliste, daneben
 * die Teile-Navigation, darunter sechs Module, die alle „gesperrt" meldeten.
 * Das ist die Werkstatt von innen gezeigt, mit einem Schild an jeder Tür — und
 * die eine Sache, die zu tun ist, ging darin unter.
 *
 * Also dasselbe, was Google und Outlook tun: ein Bild, eine Aufgabe. Das
 * Zeichen, das Formular, die Sprache. Kein Menü, keine Fusszeile, kein Weg
 * woandershin — es gibt hier nur einen Weg, und der führt hinein.
 *
 * <b>Die Einladung bleibt trotzdem sichtbar.</b> Wer über einen Einladungslink
 * kommt, soll VOR dem Anmelden erfahren, wohin er führt; sonst tippt er einen
 * Namen ein, ohne zu wissen, wofür. Deshalb steht das Band hier oben und nicht
 * hinter der Anmeldung — es ist die einzige Ausnahme von „nichts ausser dem
 * Formular", und sie hat genau diesen Grund.
 */

import type { ReactNode } from 'react';
import { rcCopy, type RcLang } from './i18n';

export function RcSignInPage({
  lang, onLang, banner, children
}: {
  lang: RcLang;
  onLang: (lang: RcLang) => void;
  /** Das Einladungsband, wenn jemand über einen Link kommt. */
  banner: ReactNode;
  /** Das Anmeldeformular selbst. */
  children: ReactNode;
}) {
  const t = rcCopy[lang];

  return (
    <div className="rc-gate">
      <main className="rc-gate-in">
        {/*
          Das Zeichen wechselt mit der Ansicht: die Werkstatt ist hell oder
          dunkel, je nach Einstellung des Geräts, und eine dunkle Zeichnung auf
          dunklem Grund ist keine.
        */}
        <a className="rc-gate-mark" href="https://recreatio.pl">
          <picture>
            <source srcSet="/logo_inv.svg" media="(prefers-color-scheme: dark)" />
            <img src="/logo_new.svg" alt={t.shell.title} width="220" height="50" />
          </picture>
        </a>

        {banner}

        <div className="rc-gate-card">{children}</div>

        {/* Die Sprache gehört auf diese Seite: wer hier steht, hat noch kein
            Konto und damit auch keine hinterlegte Einstellung. */}
        <div className="rc-gate-lang">
          {(['pl', 'de', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className="rc-btn rc-btn-quiet"
              aria-pressed={lang === l}
              onClick={() => onLang(l)}
            >
              {t.lang[l]}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
