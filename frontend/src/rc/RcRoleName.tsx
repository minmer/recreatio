/**
 * Den Anzeigenamen einer Rolle ändern — mit beliebig vielen Titeln davor.
 *
 * <b>Jeder Titel ist ein eigenes Stück, frei geschrieben.</b> Vorher stand hier
 * eine Auswahlliste mit fertigen Kombinationen — „ks.", „ks. dr",
 * „ks. prof." —, und das war in zwei Richtungen falsch: es gibt beliebig viele
 * Verbindungen, und wer die Liste pflegt, entscheidet, welche Titel überhaupt
 * existieren. Beides gehört nicht in ein Formular.
 *
 * Die Vorschläge darunter sind Tastendruckersparnis und keine Schranke: jeder
 * landet als gewöhnliches Stück in der Liste und lässt sich danach ändern oder
 * entfernen wie ein selbst getipptes.
 *
 * <b>Ändern wirkt rückwirkend</b> (9.13.2): der Name liegt einmal an der Rolle
 * und nicht als Kopie in allem, was sie je geschrieben hat. Wer geweiht wird
 * oder promoviert, heisst danach überall anders — auch über alten Beiträgen.
 * Das steht unter dem Formular; eine Änderung, deren Reichweite man erst
 * hinterher merkt, ist eine Überraschung und keine Einstellung.
 */

import { useState } from 'react';

import { rcRenameRole } from './lib/rcChat';
import { RC_TITLE_HINTS, rcJoinTitles, rcSplitTitles } from './lib/rcTitle';
import { RcRequestError } from './lib/rcApi';
import { rcCopy, type RcLang } from './i18n';

export function RcRoleName({
  lang, roleId, current, onDone, onError
}: {
  lang: RcLang;
  roleId: string;
  /** Der Name, wie er jetzt dasteht — mit Titeln, falls welche davor stehen. */
  current: string | null;
  onDone: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].roles;

  const split = rcSplitTitles(current ?? '');
  const [open, setOpen] = useState(false);
  const [titles, setTitles] = useState<readonly string[]>(split.titles);
  const [name, setName] = useState(split.name);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const describe = (e: unknown): string =>
    e instanceof RcRequestError
      ? (rcCopy[lang].auth.errors[e.code] ?? rcCopy[lang].auth.unknownError)
      : rcCopy[lang].auth.unknownError;

  const full = rcJoinTitles(titles, name);

  const add = (word: string) => {
    const value = word.trim();
    // Zweimal derselbe Titel ist kein Fehler, den man melden müsste — er wird
    // einfach nicht noch einmal angefügt.
    if (value.length === 0 || titles.includes(value)) return;
    setTitles([...titles, value]);
    setDraft('');
  };

  const drop = (at: number) => setTitles(titles.filter((_, i) => i !== at));

  /*
   * Die Reihenfolge macht den Unterschied zwischen „ks. dr" und „dr ks." — und
   * die richtige kennt nur der Mensch davor. Deshalb Verschieben und keine
   * automatische Sortierung: eine Regel dafür wäre eine Behauptung darüber,
   * wie Titel in jedem Land und jeder Gemeinschaft geordnet werden.
   */
  const move = (at: number, by: -1 | 1) => {
    const to = at + by;
    if (to < 0 || to >= titles.length) return;
    const next = [...titles];
    [next[at], next[to]] = [next[to], next[at]];
    setTitles(next);
  };

  const save = async () => {
    if (full.length === 0 || busy) return;
    setBusy(true);
    try {
      await rcRenameRole(roleId, full);
      setOpen(false);
      await onDone();
    } catch (e) { onError(describe(e)); }
    finally { setBusy(false); }
  };

  const cancel = () => {
    setOpen(false);
    const again = rcSplitTitles(current ?? '');
    setTitles(again.titles);
    setName(again.name);
    setDraft('');
  };

  if (!open) {
    return (
      <button type="button" className="rc-link-btn" onClick={() => setOpen(true)}>
        {t.rename}
      </button>
    );
  }

  return (
    <form
      className="rc-rename"
      onSubmit={(e) => { e.preventDefault(); void save(); }}
    >
      <div className="rc-titles">
        <span className="rc-fine">{t.titles}</span>

        {titles.length === 0 && <span className="rc-note rc-fine">{t.noTitles}</span>}

        <ul className="rc-title-chips">
          {titles.map((title, i) => (
            <li key={`${title}-${i}`} className="rc-chip">
              <span className="rc-chip-text">{title}</span>

              {/* Verschieben nur dort, wo es etwas zu verschieben gibt: ein
                  Knopf, der nie wirkt, ist ein Knopf, den man ausprobiert. */}
              {titles.length > 1 && (
                <>
                  <button
                    type="button" className="rc-chip-act" disabled={busy || i === 0}
                    aria-label={t.moveLeft} onClick={() => move(i, -1)}
                  >‹</button>
                  <button
                    type="button" className="rc-chip-act" disabled={busy || i === titles.length - 1}
                    aria-label={t.moveRight} onClick={() => move(i, 1)}
                  >›</button>
                </>
              )}

              <button
                type="button" className="rc-chip-act rc-chip-drop" disabled={busy}
                aria-label={t.removeTitle} onClick={() => drop(i)}
              >×</button>
            </li>
          ))}
        </ul>

        <div className="rc-title-add">
          <input
            type="text"
            value={draft}
            disabled={busy}
            autoComplete="off"
            placeholder={t.titleHint}
            onChange={(e) => setDraft(e.target.value)}
            /*
              Eingabe fügt an, statt das Formular abzuschicken. Ohne das wäre
              der häufigste Handgriff — Titel tippen, Eingabe — ein Sichern mit
              einem Titel, der noch im Feld steht und nirgends angekommen ist.
            */
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); add(draft); }
            }}
          />
          <button
            type="button" className="rc-btn rc-btn-quiet"
            disabled={busy || draft.trim().length === 0}
            onClick={() => add(draft)}
          >
            {t.addTitle}
          </button>
        </div>

        <div className="rc-title-hints">
          {RC_TITLE_HINTS.filter((h) => !titles.includes(h)).map((hint) => (
            <button
              key={hint} type="button" className="rc-hint" disabled={busy}
              onClick={() => add(hint)}
            >
              + {hint}
            </button>
          ))}
        </div>
      </div>

      <label className="rc-inline-field rc-rename-name">
        <span>{t.alias}</span>
        <input
          type="text"
          value={name}
          disabled={busy}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {/* Was danach dasteht, bevor es dasteht. Bei einer Änderung, die
          rückwirkend wirkt, ist eine Vorschau keine Spielerei. */}
      <p className="rc-rename-preview">
        <span className="rc-fine">{t.preview}</span>
        <strong>{full === '' ? '—' : full}</strong>
      </p>

      <div className="rc-rename-acts">
        <button type="submit" className="rc-btn" disabled={busy || full.length === 0}>
          {t.save}
        </button>
        <button type="button" className="rc-btn rc-btn-quiet" disabled={busy} onClick={cancel}>
          {t.cancel}
        </button>
      </div>

      <p className="rc-note rc-fine">{t.renameWarns}</p>
    </form>
  );
}

export default RcRoleName;
