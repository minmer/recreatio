/**
 * Die Seite einer Person: vier Angaben, vier Schlüssel, vier Freigaben.
 *
 * <b>Der Grund für den ganzen Aufbau steht in einem Satz:</b> jede Angabe ist
 * einzeln verschlüsselt, damit sie einzeln weitergegeben werden kann. Wer eine
 * Telefonnummer braucht, bekommt die Telefonnummer — nicht den Geburtstag
 * dazu, weil beide zufällig in derselben Zeile standen.
 *
 * Deshalb gibt es hier kein Formular, das „die Person speichert". Jede Zeile
 * ist ein eigenes Ding mit einem eigenen Zustand: sie kann fehlen, sie kann
 * angelegt, geändert, freigegeben und vernichtet werden, und jede dieser
 * Handlungen betrifft genau sie.
 *
 * <b>Lesen wird protokolliert</b> (12.9). Das gilt auch für den Eigentümer und
 * ist Absicht: ein Protokoll, das den häufigsten Fall auslässt, beantwortet
 * die Frage „wer hat das gesehen" nicht mehr. Wer das Protokoll sehen will,
 * findet es an jeder Zeile.
 *
 * <b>Löschen heißt Schlüsselvernichtung</b> (12.3.2 Weg b). Der Geheimtext
 * bleibt liegen und geht nie wieder auf. Das steht auch so auf dem Knopf: ein
 * „Löschen", das etwas anderes tut als es sagt, ist die Sorte Zusicherung, die
 * später niemand belegen kann.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  RC_PERSON_FIELDS, rcCreateData, rcDataValues, rcDestroyData, rcRepeats, rcShareData,
  rcUpdateData, rcDataAccessLog, type RcDataValue, type RcPersonField
} from './lib/rcPerson';
import { rcRoles } from './lib/rcChat';
import { RcRequestError } from './lib/rcApi';
import { rcPath } from './lib/rcRoute';
import { rcCopy, type RcLang } from './i18n';

type Row = {
  readonly field: RcPersonField;
  /** `null`, solange die Angabe noch nicht angelegt ist. */
  readonly item: RcDataValue | null;
};

export function RcPersonSection({
  lang, roleId, unlocked, onError
}: {
  lang: RcLang;
  roleId: string | null;
  unlocked: boolean;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].person;

  const [rows, setRows] = useState<readonly Row[]>([]);
  const [name, setName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const describe = useCallback(
    (e: unknown): string =>
      e instanceof RcRequestError
        ? (rcCopy[lang].auth.errors[e.code] ?? rcCopy[lang].auth.unknownError)
        : rcCopy[lang].auth.unknownError,
    [lang]
  );

  const refresh = useCallback(async () => {
    if (!unlocked || roleId === null) return;
    try {
      const [values, roles] = await Promise.all([rcDataValues(roleId), rcRoles()]);
      const found = (values.values ?? []);

      /*
       * Die vier Zeilen stehen IMMER da, auch wenn es die Angabe noch nicht
       * gibt. Eine Seite, die nur zeigt, was schon eingetragen ist, verrät
       * nicht, was man eintragen könnte — und wirkt bei einem neuen Konto
       * schlicht leer und kaputt.
       */
      const next: Row[] = [];
      for (const field of RC_PERSON_FIELDS) {
        const mine = found.filter((v) => v.field === field);
        if (rcRepeats(field)) {
          // Eine Zeile JE Eintrag und eine leere zum Anlegen. Ein `find` haette
          // die zweite Telefonnummer stillschweigend verschluckt: angelegt,
          // mit einem eigenen Schluessel bezahlt, und nirgends zu sehen.
          for (const item of mine) next.push({ field, item });
          next.push({ field, item: null });
        } else {
          next.push({ field, item: mine[0] ?? null });
        }
      }
      setRows(next);

      setName((roles.roles ?? []).find((r) => r.roleId === roleId)?.displayName ?? null);
      setLoaded(true);
    } catch (e) { onError(describe(e)); }
  }, [unlocked, roleId, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (roleId === null) {
    return (
      <div className="rc-panel">
        <p className="rc-note">{t.noRole}</p>
        <a className="rc-btn rc-btn-quiet" href={rcPath('account')}>{t.toAccount}</a>
      </div>
    );
  }

  if (!unlocked) return <p className="rc-note">{t.locked}</p>;
  if (!loaded) return <p className="rc-note">{t.loading}</p>;

  return (
    <div className="rc-panel">
      <header className="rc-person-head">
        <h4 className="rc-person-title">{name ?? t.unnamed}</h4>
        <p className="rc-note">{t.lead}</p>
      </header>

      <ul className="rc-fields">
        {rows.map((row) => (
          <RcFieldRow
            key={row.item?.dataItemId ?? `neu-${row.field}`}
            lang={lang}
            roleId={roleId}
            row={row}
            repeats={rcRepeats(row.field)}
            onDone={refresh}
            onError={onError}
          />
        ))}
      </ul>

      <p className="rc-note rc-fine">{t.logNote}</p>
    </div>
  );
}

/**
 * Eine Angabe.
 *
 * Sie hat drei Zustände, und jeder sieht anders aus: es gibt sie nicht, es
 * gibt sie und sie steht da, oder es gibt sie und dieses Konto darf sie nicht
 * lesen. Der dritte ist der, den man leicht vergisst — er entsteht, sobald
 * jemand anders eine Angabe an diese Rolle freigegeben hat.
 */
function RcFieldRow({
  lang, roleId, row, repeats, onDone, onError
}: {
  lang: RcLang;
  roleId: string;
  row: Row;
  /** Ob dieses Feld mehrfach vorkommen darf — dann bekommt es eine leere Zeile. */
  repeats: boolean;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].person;

  const [draft, setDraft] = useState(row.item?.value ?? '');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareTo, setShareTo] = useState('');
  const [sharing, setSharing] = useState(false);
  const [log, setLog] = useState<readonly { at: string; via: string }[] | null>(null);

  const describe = (e: unknown): string =>
    e instanceof RcRequestError
      ? (rcCopy[lang].auth.errors[e.code] ?? rcCopy[lang].auth.unknownError)
      : rcCopy[lang].auth.unknownError;

  const run = async (what: () => Promise<unknown>) => {
    setBusy(true);
    try { await what(); await onDone(); }
    catch (e) { onError(describe(e)); }
    finally { setBusy(false); }
  };

  const save = () =>
    run(async () => {
      const value = draft.trim();
      if (value.length === 0) return;
      if (row.item === null) await rcCreateData(roleId, row.field, value);
      else await rcUpdateData(row.item.dataItemId, value);
      setEditing(false);
    });

  const share = () =>
    run(async () => {
      if (row.item === null || shareTo.trim().length === 0) return;
      await rcShareData(row.item.dataItemId, shareTo.trim());
      setShareTo('');
      setSharing(false);
    });

  const destroy = () =>
    run(async () => {
      if (row.item === null) return;
      await rcDestroyData(row.item.dataItemId, t.destroyReason);
    });

  const showLog = async () => {
    if (row.item === null) return;
    try {
      const answer = await rcDataAccessLog(row.item.dataItemId);
      setLog((answer.accesses ?? []).map((e) => ({
        at: e.accessedAt ?? '', via: e.readerRoleId ?? ''
      })));
    } catch (e) { onError(describe(e)); }
  };

  const missing = row.item === null;

  /*
   * Bei einem wiederholbaren Feld traegt nur die ERSTE Zeile die Beschriftung,
   * und die leere am Ende sagt „noch eine". Viermal „Telefon" untereinander
   * liest sich als Fehler; eine leere Zeile ohne Wort liest sich als Rest.
   */
  const label = repeats && missing ? t.addAnother : t.fields[row.field];
  const unreadable = row.item !== null && row.item.readable === false;

  return (
    <li className="rc-field-row" data-state={missing ? 'missing' : unreadable ? 'sealed' : 'set'}>
      <div className="rc-field-main">
        <span className="rc-field-label">{label}</span>

        {/* Es gibt sie nicht. */}
        {missing && !editing && (
          <button type="button" className="rc-btn rc-btn-quiet" onClick={() => setEditing(true)}>
            {t.add}
          </button>
        )}

        {/*
          Es gibt sie, aber nicht für dieses Konto. Der Text sagt WARUM — sonst
          liest sich eine leere Zeile als Fehler. Eine Angabe, die jemand
          anders an diese Rolle freigegeben hat, ohne dass dieses Konto den
          Schlüssel hält, sieht sonst genauso aus wie eine kaputte.
        */}
        {unreadable && <span className="rc-field-sealed">{t.sealed}</span>}

        {/* Es gibt sie und sie steht da. */}
        {!missing && !unreadable && !editing && (
          <>
            <span className="rc-field-value">{row.item?.value}</span>
            <button type="button" className="rc-btn rc-btn-quiet" onClick={() => setEditing(true)}>
              {t.change}
            </button>
          </>
        )}

        {editing && (
          <span className="rc-field-edit">
            <input
              type={row.field === 'PersonBorn' ? 'date' : row.field === 'PersonPhone' ? 'tel' : 'text'}
              value={draft}
              disabled={busy}
              autoComplete={AUTOCOMPLETE[row.field]}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="button" className="rc-btn" disabled={busy} onClick={() => void save()}>
              {t.save}
            </button>
            <button
              type="button"
              className="rc-btn rc-btn-quiet"
              disabled={busy}
              onClick={() => { setEditing(false); setDraft(row.item?.value ?? ''); }}
            >
              {t.cancel}
            </button>
          </span>
        )}
      </div>

      {!missing && !unreadable && (
        <div className="rc-field-acts">
          <button type="button" className="rc-link-btn" onClick={() => setSharing(!sharing)}>
            {t.share}
          </button>
          <button type="button" className="rc-link-btn" onClick={() => void showLog()}>
            {t.showLog}
          </button>
          <button type="button" className="rc-link-btn rc-link-danger" disabled={busy} onClick={() => void destroy()}>
            {t.destroy}
          </button>
        </div>
      )}

      {sharing && (
        <div className="rc-field-share">
          {/*
            Freigeben heißt hier wörtlich: derselbe Elementschlüssel wird unter
            dem Verpackungsschlüssel der anderen Rolle noch einmal verpackt.
            Kein Weiterreichen einer Kopie des Wertes, kein Server, der ihn
            zwischendurch sieht.
          */}
          <p className="rc-note">{t.shareWhat}</p>
          <label className="rc-inline-field">
            <span>{t.shareTo}</span>
            <input
              type="text"
              value={shareTo}
              disabled={busy}
              placeholder={t.shareToHint}
              onChange={(e) => setShareTo(e.target.value)}
            />
          </label>
          <button type="button" className="rc-btn" disabled={busy || shareTo.trim().length === 0} onClick={() => void share()}>
            {t.shareDo}
          </button>
        </div>
      )}

      {log !== null && (
        <div className="rc-field-log">
          <h6 className="rc-fine">{t.logHeading}</h6>
          {log.length === 0 && <p className="rc-note">{t.logEmpty}</p>}
          <ul>
            {log.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <time>{e.at}</time>
                {e.via !== '' && <span className="rc-fine">{e.via.slice(0, 8)}</span>}
              </li>
            ))}
          </ul>
          <button type="button" className="rc-link-btn" onClick={() => setLog(null)}>{t.logHide}</button>
        </div>
      )}
    </li>
  );
}

/**
 * Was der Browser ausfüllen darf.
 *
 * Bewusst NICHT für die Telefonnummer und das Geburtsdatum: ein Browser, der
 * gespeicherte Werte in ein Feld schreibt, macht aus einer bewussten Eingabe
 * eine unbemerkte. Bei Vor- und Nachnamen ist das eine Bequemlichkeit, bei den
 * beiden anderen wäre es eine Angabe, die jemand nicht gemacht hat.
 */
const AUTOCOMPLETE: Record<RcPersonField, string> = {
  PersonGivenName: 'given-name',
  PersonSurname: 'family-name',
  PersonPhone: 'off',
  PersonBorn: 'off'
};

export default RcPersonSection;

/** Die Rollenkennung steht in der Adresse — der Teil hinter `person`. */
export function RcPersonOutlet({
  lang, roleId, unlocked
}: {
  lang: RcLang;
  roleId: string | null;
  unlocked: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <RcPersonSection lang={lang} roleId={roleId} unlocked={unlocked} onError={setError} />
      {error !== null && <p className="rc-auth-error rc-chat-error">{error}</p>}
    </>
  );
}
