/**
 * DAS PORTAL EINES BOGENS — die Seite, auf der jemand nach dem Absenden landet.
 *
 * <b>Es entstand bisher von selbst, und das war das Problem.</b> Wer ein
 * Formular abschickte, bekam einen Platz, und der Platz hing „eine Ebene über
 * dem Formular" — abgeleitet, nicht entschieden. Gab es die Seite darüber
 * nicht, fiel er auf die Seite mit dem Formular zurück: der Mensch öffnete
 * seinen Link und sah den Bogen, den er gerade abgeschickt hatte.
 *
 * <b>Und die Seite darüber ist oft die falsche.</b> Sie ist die öffentliche
 * Übersicht. Wer dort die Platz-Bausteine ablegte, stellte jedem Besucher
 * Kacheln hin, die für ihn leer bleiben — „Tu pojawi się…", unter dem
 * Pfarrtext.
 *
 * <b>Zwei Wege, und beide kommen vor.</b> Eine vorhandene Seite dafür zu
 * benennen ist manchmal genau richtig; manchmal soll das Portal seine eigene
 * Seite sein. Also steht hier beides nebeneinander — wählen und anlegen.
 *
 * <b>Angelegt wird sie NICHT leer.</b> Ein Portal ohne den Baustein, der die
 * eigene Einsendung zeigt, ist kein Portal — es ist eine leere Seite hinter
 * einem geheimen Link. Also stehen zwei Bausteine darauf, sobald sie entsteht,
 * und der erste ist der, um den es geht: <b>was ich eingeschickt habe, und die
 * Möglichkeit, es zu berichtigen.</b>
 */

import { useCallback, useEffect, useState } from 'react';

import { openSubpage } from './access';
import { loadDesk, type PageCard } from './desk';
import { setPartConfig } from './form';
import { newId } from './ids';
import { COLUMNS, type Layout } from './layout';
import { saveParts, type DraftPart } from './page';
import { viewPath } from './routes';
import { WorkspaceError } from './session';

/**
 * Wie der Schritt heisst, den ein neues Portal bekommt.
 *
 * <b>Nicht `portal`.</b> Das Wort ist im Register gesperrt (`Slug.IsReserved`),
 * weil hinter ihm der Link eines Menschen beginnt — `…/portal/<token>`. Eine
 * Unterseite so zu nennen verdeckte jeden dieser Links, und zwar lautlos.
 */
const STEP = 'moje';

/**
 * Welche Seiten ein Platz tragen darf — dieselbe Regel wie im Dienst.
 *
 * <b>Die Seite mit dem Bogen, eine darüber, eine darunter.</b> Alle drei liegen
 * im Zuständigkeitsbereich derselben Kanzlei. Eine Auswahl, die mehr anböte,
 * endete in einer Absage (403) — und zwar erst beim Absenden des ersten
 * Menschen, also da, wo es niemand mehr sieht.
 */
const mayCarry = (formPage: string, path: string): boolean =>
  path === formPage
  || formPage.startsWith(path + '/')
  || path.startsWith(formPage + '/');

/**
 * Was auf einem frischen Portal steht.
 *
 * <b>Über die ganze Breite und untereinander.</b> Ein Portal liest man von oben
 * nach unten; nebeneinander zu stellen ist eine Entscheidung, die der treffen
 * soll, der die Seite danach baut.
 */
const SEED: readonly { kind: string; rowSpan: number; config: Record<string, string> }[] = [
  {
    /* DER GRUND, warum es das Portal gibt. */
    kind: 'seat-submission',
    rowSpan: 3,
    config: { title: 'Twoje zgłoszenie' }
  },
  {
    /* Und der Rückweg: was die Kanzlei diesem einen Menschen schreibt. */
    kind: 'seat-note',
    rowSpan: 2,
    config: { title: 'Od kancelarii' }
  }
];

/** Dieselbe Anordnung in jeder Grösse — volle Breite, der Reihe nach. */
function fullWidth(row: number, rowSpan: number): Layout {
  const out: Layout = {};

  for (const [breakpoint, columns] of Object.entries(COLUMNS)) {
    out[breakpoint as keyof Layout] = {
      position: { row, col: 1 },
      size: { colSpan: columns, rowSpan }
    };
  }

  return out;
}

export function Portal({ moduleId, onPage, portalUnder, ownerRoleId, onSet }: {
  moduleId: string;

  /**
   * Die Seite, über die dieser Bogen aufgeschlagen wurde.
   *
   * <b>`null` heisst: er steht nirgends</b> — dann gibt es keine Seite, unter
   * die ein Portal gehören könnte, und es wird auch keine angeboten. Ein
   * Baustein kann auf mehreren Seiten stehen; welche gemeint ist, weiss nur der
   * Weg, über den man hier hereinkam.
   */
  onPage: string | null;

  /** Worauf der Bogen heute zeigt. Leer heisst: eine Ebene über der Seite. */
  portalUnder: string;

  /** Wer die neue Unterseite führen soll. */
  ownerRoleId: string | null;

  /** Nach dem Setzen — damit die Einstellung im Bild nachzieht. */
  onSet: (portalUnder: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [pages, setPages] = useState<readonly PageCard[]>([]);

  const look = useCallback(async () => {
    try { setPages((await loadDesk()).pages); } catch { setPages([]); }
  }, []);

  useEffect(() => { void look(); }, [look]);

  const wanted = onPage === null ? null : `${onPage}/${STEP}`;
  const has = portalUnder !== '';

  /* Was schon dasteht und in Frage käme. */
  const choices = onPage === null
    ? []
    : pages.filter((one) => mayCarry(onPage, one.path));

  /*
   * WELCHE SEITE DER LINK WIRKLICH ÖFFNET.
   *
   * Ohne Einstellung leitet der Dienst sie ab: eine Ebene höher, und wenn
   * es die nicht gibt, die Seite mit dem Bogen (`Form.Above`). Das ist eine
   * Regel, auf die niemand von selbst kommt — also steht hier nicht „o
   * poziom wyżej", sondern die Adresse, die dabei herauskommt.
   *
   * <b>Dieselbe Ableitung ein zweites Mal, und das ist der Preis.</b> Sie
   * steht im Dienst, weil sie dort gilt; hier steht sie, damit man sie
   * VORHER sieht. Laufen sie auseinander, zeigt diese Zeile das Falsche —
   * deshalb steht der Name der Gegenstelle im Kommentar.
   */
  const derived = (() => {
    if (onPage === null) return null;

    const cut = onPage.lastIndexOf('/');
    if (cut < 0) return onPage;

    const above = onPage.slice(0, cut);
    return pages.some((one) => one.path === above) ? above : onPage;
  })();

  const opens = has ? portalUnder : derived;

  const said = (e: unknown) =>
    setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');

  /** Auf eine Seite zeigen, die es schon gibt. */
  const point = async (where: string) => {
    setBusy(true);
    setFailed(null);

    try {
      await setPartConfig(moduleId, { portalUnder: where });
      onSet(where);
    } catch (e) {
      said(e);
    } finally {
      setBusy(false);
    }
  };

  /** Eine eigene anlegen. */
  const make = async () => {
    if (wanted === null || ownerRoleId === null) return;

    setBusy(true);
    setFailed(null);

    try {
      /*
       * DREI SCHRITTE, UND DIE REIHENFOLGE IST EINE ENTSCHEIDUNG.
       *
       * Erst die Seite — ohne sie zeigte die Einstellung auf nichts. Dann die
       * Bausteine, damit niemand eine leere Seite vorfindet. Zuletzt die
       * Einstellung: ab da landen die Plätze dort, und ab da soll auch etwas
       * da sein.
       */
      await openSubpage(wanted, ownerRoleId, 'Portal');

      const parts: DraftPart[] = SEED.map((one, at) => ({
        id: newId(),
        moduleId: null,
        kind: one.kind,
        layout: fullWidth(at === 0 ? 1 : 1 + SEED[0].rowSpan, one.rowSpan),
        config: one.config
      }));

      await saveParts(wanted, parts);
      await setPartConfig(moduleId, { portalUnder: wanted });

      onSet(wanted);
      window.location.hash = viewPath('pages', ...wanted.split('/'));
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się założyć portalu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="wk-form">
      <h3 className="wk-h2">Po wysłaniu</h3>

      {has ? (
        <p className="wk-hint">
          Kto wyśle ten formularz, trafia na <code>recreatio.pl/{portalUnder}</code>.
        </p>
      ) : (
        /*
          WAS HEUTE PASSIERT, wenn niemand etwas entschieden hat. Es
          auszusprechen ist der halbe Grund für diesen Abschnitt: „eine Ebene
          wyżej" ist keine Regel, auf die jemand von selbst kommt.
        */
        <p className="wk-hint">
          Nikt tego jeszcze nie ustawił — więc link otworzy stronę o poziom
          wyżej, a jeśli jej nie ma, tę z formularzem.
        </p>
      )}

      {opens !== null && (
        <p className="wk-warn">
          Link otwiera <code>recreatio.pl/{opens}</code>
          {!has && ' — tak wychodzi z ustawień, nikt tego nie wybrał.'}
        </p>
      )}

      <Choose
        now={portalUnder}
        choices={choices}
        busy={busy}
        onPick={(where) => void point(where)}
      />

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        {has && (
          <a className="wk-btn" href={viewPath('pages', ...portalUnder.split('/'))}>
            Otwórz tę stronę
          </a>
        )}

        {/*
          EINE EIGENE SEITE. Sie entsteht mit zwei Bausteinen — dem Zgłoszenie
          dieser Person, das sie poprawić kann, und dem Platz für die Antwort
          der Kanzlei. Ein Portal ohne den ersten wäre keines.
        */}
        {!choices.some((one) => one.path === wanted) && (
          <button
            type="button"
            className={has ? 'wk-link-btn' : 'wk-btn'}
            disabled={busy || wanted === null || ownerRoleId === null}
            onClick={() => void make()}
          >
            {busy ? 'Zakładanie…' : 'Załóż własną stronę portalu'}
          </button>
        )}

        {wanted === null && (
          <span className="wk-blocker">
            Ten formularz nie stoi na żadnej stronie — najpierw go gdzieś postaw.
          </span>
        )}
      </div>

      {!has && wanted !== null && (
        <p className="wk-hint">
          Własna strona powstanie jako <code>recreatio.pl/{wanted}</code> —
          ze zgłoszeniem tej osoby, które <strong>może poprawić</strong>,
          i miejscem na wiadomość od kancelarii.
        </p>
      )}
    </section>
  );
}

/**
 * Eine Seite, die es schon gibt.
 *
 * <b>Sie steht NEBEN dem Anlegen und nicht statt seiner.</b> Die Übersicht
 * darüber ist manchmal genau die richtige Seite — und manchmal soll das Portal
 * seine eigene sein.
 */
function Choose({ now, choices, busy, onPick }: {
  now: string;
  choices: readonly PageCard[];
  busy: boolean;
  onPick: (path: string) => void;
}) {
  if (choices.length === 0) return null;

  return (
    <label className="wk-field">
      <span>Strona po wysłaniu</span>
      <select
        value={now}
        disabled={busy}
        onChange={(e) => { if (e.target.value !== '') onPick(e.target.value); }}
      >
        <option value="">— o poziom wyżej —</option>
        {choices.map((one) => (
          <option key={one.path} value={one.path}>recreatio.pl/{one.path}</option>
        ))}
      </select>
    </label>
  );
}

export default Portal;
