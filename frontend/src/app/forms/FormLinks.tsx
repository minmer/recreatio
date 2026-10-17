/**
 * Die Links der Menschen eines Formulars: lesen, senden, an einen Platz schreiben, die Prüffragen beim ersten Öffnen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { type AreaRow, areaPath, loadMembers, myEpochKeys } from '../areas/area';
import { meetingAreas } from '../areas/audience';
import { loadChats, startSeatChat } from '../chat/chat';
import { fromBase64Url } from '../core/crypto';
import type { Ring } from '../core/keys';
import { WorkspaceError } from '../core/session';
import { viewPath } from '../routes';
import { type Link, type SeatRow, loadSeats, officeSeatKey, relinkSeat, revokeSeat, seatPath } from '../seats/seat';
import { type CheckAnswer, checkText, openLink } from '../seats/seatCheck';
import { askText } from '../ui/dialogs';
import { numbersOf } from './entryDesk';
import { KIND_LABEL, type OpenField, fullNameOf, setLinkCheck } from './form';
import { type ValueCheck } from './valueCheck';
import { reviseAsOffice } from './revisions';
import { loadIntake, loadPublicIntake, openIntakeKey } from './intake';
import { joinPhones, splitPhones, withPhone } from './phone';

/**
 * 0069 — „NAPISZ DO TEJ OSOBY": die Rozmowa mit dem Menschen hinter diesem
 * Platz. Gibt es sie, öffnet sie sich; sonst entsteht sie — angelegt von einer
 * meiner Rollen, die den Bereich liest. Den Schlüssel gibt mein Browser ihm,
 * sobald er sie das erste Mal öffnet.
 *
 * 0080 — der Zugang „jeden na jeden" (`audience.ts`): AN WELCHEM BEREICH,
 * wählt, wer schreibt — der des Formulars, einer seiner Fragen, der des
 * Platzes, oder einer darüber (`meetingAreas`). Mitlesen alle, die diesen
 * Bereich lesen; die anderen aus dem Formular nicht. Je Bereich eine Rozmowa.
 */
export function WriteToSeat({ seatId, near, areas, ring, busy, onError }: {
  seatId: string;

  /** Die Bereiche, mit denen dieser Mensch zu tun hat — der nächste zuerst. */
  near: readonly (string | null)[];
  areas: readonly AreaRow[];
  ring: Ring;
  busy: boolean;
  onError: (message: string | null) => void;
}) {
  const [working, setWorking] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [pick, setPick] = useState('');
  const [had, setHad] = useState<ReadonlyMap<string, string>>(new Map());
  const choices = meetingAreas(areas, near);

  const open = async (areaId: string) => {
    setWorking(true);
    onError(null);
    try {
      const existing = (await loadChats()).chats.find((c) => c.seatId === seatId && c.areaId === areaId);
      if (existing !== undefined) { window.location.hash = viewPath('chat', existing.chatId); return; }
      const { members } = await loadMembers(areaId);
      const as = members.find((m) => ring.has(m.roleId) && m.kind !== 'account'
        && (m.capabilities.includes('read') || m.capabilities.includes('write') || m.capabilities.includes('admin')));
      if (as === undefined) throw new WorkspaceError('Żadna z Twoich ról nie czyta tego obszaru.');
      const chatId = await startSeatChat(areaId, as.roleId, seatId);
      window.location.hash = viewPath('chat', chatId);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć rozmowy.');
    } finally {
      setWorking(false);
    }
  };

  /* Ein Bereich zur Wahl: gleich hinein. Mehrere: wählen — einer, in dem es die Rozmowa schon gibt, steht vorn. */
  const begin = async () => {
    onError(null);
    if (choices.length === 0) { onError('Nie czytasz żadnego obszaru, z którego można napisać do tej osoby.'); return; }
    if (choices.length === 1) { await open(choices[0].areaId); return; }
    try {
      const mine = (await loadChats()).chats.filter((c) => c.seatId === seatId);
      setHad(new Map(mine.map((c) => [c.areaId, c.chatId])));
      setPick(mine.find((c) => choices.some((a) => a.areaId === c.areaId))?.areaId ?? choices[0].areaId);
      setChoosing(true);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć rozmowy.');
    }
  };

  if (choosing) {
    return (
      <span className="wk-seat-meet">
        <label>
          <span>Rozmowa z obszaru</span>{' '}
          <select value={pick} disabled={working} onChange={(e) => setPick(e.target.value)}>
            {choices.map((a) => (
              <option key={a.areaId} value={a.areaId} title={areaPath(areas, a.areaId).full}>
                {areaPath(areas, a.areaId).short}{had.has(a.areaId) ? ' — rozmowa już jest' : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="wk-link-btn" disabled={busy || working || pick === ''} onClick={() => void open(pick)}>
          {working ? 'Otwieranie…' : had.has(pick) ? 'Otwórz' : 'Zacznij'}
        </button>
        <button type="button" className="wk-link-btn" disabled={working} onClick={() => setChoosing(false)}>Anuluj</button>
        <span className="wk-hint">Czytają ją ta osoba i wszyscy, którzy mają dostęp do wybranego obszaru — inni z formularza nie.</span>
      </span>
    );
  }

  return (
    <button type="button" className="wk-link-btn" disabled={busy || working} onClick={() => void begin()}>
      {working ? 'Otwieranie…' : 'Napisz do tej osoby'}
    </button>
  );
}

/* -- Die Menschen, die sich eingetragen haben ------------------------------- */

/**
 * Was in einer Nachricht für DIESEN Menschen eingesetzt wird — nach
 * Beschriftung der Frage, dazu `{imie}` und `{osoba}`.
 *
 * `{imie}` neben `{osoba}` — der Altbestand hatte beide, und aus gutem Grund:
 * „Cześć Anna Kowalska" grüsst niemand.
 */
export function holesOf(values: ReadonlyMap<string, string> | undefined, fields: readonly OpenField[]): Map<string, string> {
  const out = new Map<string, string>();
  if (values === undefined) return out;

  for (const f of fields) {
    const v = values.get(f.fieldId);
    if (f.label !== null && v !== undefined) out.set(f.label, v);
  }

  const full = fullNameOf(fields.filter((f) => f.identityRole !== 'nickname'), (fieldId) => values.get(fieldId));
  const given = fields.find((f) => f.identityRole === 'given_name');
  const givenValue = given === undefined ? '' : (values.get(given.fieldId) ?? '').trim();

  if (full !== null) {
    out.set('osoba', full);
    out.set('imie', givenValue !== '' ? givenValue : full.split(/\s+/)[0]);
  }

  return out;
}

/** Was ein neuer Link dieses Menschen beim ersten Öffnen fragt — seine Antworten auf die gewählten Fragen. */
export const checkOf = (values: ReadonlyMap<string, string> | undefined, fields: readonly OpenField[]): readonly CheckAnswer[] =>
  fields.filter((f) => f.linkCheck)
    .map((f) => ({ fieldId: f.fieldId, kind: f.kind, value: values?.get(f.fieldId) ?? '' }));

/** Die Adresse, vor die ein Link gehängt wird. */
export const base = () => `${window.location.origin}${window.location.pathname}`;

/* -- Die Links der Menschen, für die Kanzlei (0046) ------------------------ */

/**
 * Was die Kanzlei über die Links ihrer Menschen weiss — und wie sie an einen
 * kommt.
 */
export interface SeatLinks {
  /** Die Plätze dieses Formulars, wie die Kanzlei sie sieht. */
  readonly rows: ReadonlyMap<string, SeatRow>;

  /** Der Link, OHNE etwas zu ändern — `null`, wenn die Kanzlei ihn nicht lesen kann. */
  readonly peek: (seatId: string) => Promise<string | null>;

  /**
   * Der Link zum VERSCHICKEN. Der vorhandene, wenn er taugt; sonst ein neuer,
   * der beim ersten Öffnen fragt, was das Formular dafür vorsieht.
   */
  readonly forSms: (seatId: string, check: readonly CheckAnswer[]) => Promise<string>;

  /** Ein NEUER Link — der bisherige hört auf zu gelten. */
  readonly renew: (seatId: string, check: readonly CheckAnswer[]) => Promise<string>;

  /** Der Platzschlüssel — für eine Berichtigung durch die Kanzlei. */
  readonly key: (seatId: string) => Promise<Uint8Array>;

  /** Die vorhandenen Links im Hintergrund aufmachen, damit ein Tipp auf nichts wartet. */
  readonly warm: (seatIds: readonly string[]) => void;

  readonly reload: () => Promise<void>;

  /** 0069 — in welchem Bereich der Platz steht (für die Rozmowa mit ihm). */
  readonly areaOf: (seatId: string) => string | null;
}

/** Die ganze Adresse eines Links — die Seite, unter der der Platz hängt, mit dem Platz daran. */
const linkUrl = (link: Link, under: string | null, at?: string | null) => `${base()}${seatPath(link, under, at)}`;

/**
 * DIE LINKS DER MENSCHEN — gelesen, nicht neu gewürfelt.
 *
 * <b>Vorher gab es nur „Wystaw link"</b>: gespeichert war vom Link nur sein
 * Abdruck, also stellte jeder Klick einen NEUEN aus, und der alte starb. Jetzt
 * liegt der Link versiegelt unter dem Platzschlüssel (0046), und die Kanzlei,
 * die den Platz öffnen kann, liest ihn — für jeden Menschen, ohne etwas zu
 * tun.
 *
 * <b>Neu gewürfelt wird nur, wenn es sein muss:</b> ein Platz von vor 0046
 * (sein Link ist nirgends lesbar), ein gesperrter, oder einer, der beim ersten
 * Öffnen fragen soll und es noch nicht tut — etwa der Link aus der eigenen
 * Anmeldung, der nie verschickt wurde. Dann entsteht der neue beim
 * Verschicken, und nur dann.
 */
export function useSeatLinks(
  areaIds: readonly string[], ring: Ring | null,
  /** 0086 — die Seite nach dem Absenden und ihr Zusatz (`portalAt`): der Link öffnet dort, wo die Kanzlei es will. */
  portal: { readonly under: string; readonly at: string } | null = null
): SeatLinks {
  const [rows, setRows] = useState<ReadonlyMap<string, SeatRow>>(new Map());

  /* Der Zusatz gilt nur an der Seite, für die er gewählt ist — ein Platz von früher hängt vielleicht anderswo. */
  const portalRef = useRef(portal);
  portalRef.current = portal;
  const urlOf = (link: Link, under: string | null): string => {
    const p = portalRef.current;
    return linkUrl(link, under, p !== null && p.at !== '' && under !== null && under.toLowerCase() === p.under.toLowerCase() ? p.at : null);
  };

  /* Stabil über das Zeichnen hinweg — die Funktionen unten lesen immer den neuesten Stand. */
  const found = useRef(new Map<string, { row: SeatRow; areaId: string }>());
  const links = useRef(new Map<string, Link>());
  const seatKeys = useRef(new Map<string, Uint8Array>());
  const areaKeys = useRef(new Map<string, { epochs: Map<number, Uint8Array>; intake: Uint8Array | undefined }>());

  const areaList = areaIds.join(',');

  const reload = useCallback(async () => {
    const out = new Map<string, { row: SeatRow; areaId: string }>();

    for (const areaId of areaList === '' ? [] : areaList.split(',')) {
      try {
        for (const row of (await loadSeats(areaId)).seats) out.set(row.seatId, { row, areaId });
      } catch {
        // Ein Bereich, dessen Plätze ich nicht sehe — seine Menschen bleiben ohne Link.
      }
    }

    found.current = out;

    /* Ein Link kann sich inzwischen geändert haben — ein Mensch hat seine Angaben berichtigt. */
    links.current = new Map();
    setRows(new Map([...out].map(([id, one]) => [id, one.row])));
  }, [areaList]);

  useEffect(() => { void reload(); }, [reload]);

  const key = useCallback(async (seatId: string): Promise<Uint8Array> => {
    const known = seatKeys.current.get(seatId);
    if (known !== undefined) return known;

    const one = found.current.get(seatId);
    if (one === undefined) throw new WorkspaceError('Tego miejsca nie ma wśród Twoich obszarów.');
    if (ring === null) throw new WorkspaceError('Bez hasła nie da się otworzyć linku.');

    let area = areaKeys.current.get(one.areaId);

    if (area === undefined) {
      const epochs = await myEpochKeys(ring, one.areaId).catch(() => new Map<number, Uint8Array>());
      const intake = await loadIntake(one.areaId).then((i) => openIntakeKey(i, ring)).catch(() => undefined);
      area = { epochs, intake };
      areaKeys.current.set(one.areaId, area);
    }

    const areaKey = area.epochs.get(one.row.epoch) ?? [...area.epochs.values()].pop() ?? new Uint8Array(32);
    const opened = await officeSeatKey(one.row, areaKey, area.intake);
    if (opened === null) throw new WorkspaceError('Do tego miejsca nie ma klucza.');

    seatKeys.current.set(seatId, opened);
    return opened;
  }, [ring]);

  const peek = useCallback(async (seatId: string): Promise<string | null> => {
    const one = found.current.get(seatId);
    const known = links.current.get(seatId);
    if (known !== undefined) return urlOf(known, one?.row.under ?? null);

    if (one === undefined || one.row.linkSealed === null || one.row.revokedAt !== null) return null;

    const link = await openLink(seatId, await key(seatId), one.row.linkSealed);
    if (link === null) return null;

    links.current.set(seatId, link);
    return urlOf(link, one.row.under);
  }, [key]);

  const renew = useCallback(async (seatId: string, check: readonly CheckAnswer[]): Promise<string> => {
    const link = await relinkSeat(seatId, await key(seatId), check);
    links.current.set(seatId, link);
    await reload();
    return urlOf(link, found.current.get(seatId)?.row.under ?? null);
  }, [key, reload]);

  const forSms = useCallback(async (seatId: string, check: readonly CheckAnswer[]): Promise<string> => {
    const one = found.current.get(seatId);
    if (one === undefined) throw new WorkspaceError('Tego miejsca nie ma wśród Twoich obszarów.');
    if (one.row.revokedAt !== null) throw new WorkspaceError('Link tej osoby jest wycofany — nie ma czego wysłać.');

    /*
     * DER VORHANDENE TAUGT, wenn er lesbar und nicht gesperrt ist — und wenn
     * er beim ersten Öffnen fragt, sobald das Formular es verlangt. Der Link
     * aus der eigenen Anmeldung fragt nicht (wer sich anmeldet, hat die Daten
     * eben getippt); verschickt wird deshalb ein neuer, der es tut.
     */
    const wantsQuestion = check.some((c) => checkText(c.kind, c.value) !== '');
    const reusable = one.row.linkSealed !== null && !one.row.locked && (one.row.asks || !wantsQuestion);

    if (reusable) {
      const url = await peek(seatId);
      if (url !== null) return url;
    }

    return renew(seatId, check);
  }, [peek, renew]);

  const warm = useCallback((seatIds: readonly string[]) => {
    void (async () => {
      for (const seatId of seatIds) await peek(seatId).catch(() => null);
    })();
  }, [peek]);

  const areaOf = useCallback((seatId: string) => found.current.get(seatId)?.areaId ?? null, []);

  return { rows, peek, forSms, renew, key, warm, reload, areaOf };
}

/* -- Der Link eines Menschen (0027/0046) ----------------------------------- */

/**
 * Der Link eines Menschen — wie er gerade ist, und was man mit ihm tun kann.
 *
 * <b>Er steht einfach da</b> (0046). Vorher stand hier „Wystaw link", und jeder
 * Klick machte den vorigen ungültig — weil der alte nirgends lesbar lag. Jetzt
 * liest die Kanzlei ihn; einen neuen gibt es nur, wenn sie ihn ausdrücklich
 * will („Wystaw nowy link") oder wenn beim Verschicken einer fällig ist.
 *
 * <b>Die SMS steht nicht mehr hier</b>, sondern an der Zeile — im Durchgang
 * „Napisz SMS", mit EINER Nachricht für alle.
 */
export function SendPanel({
  seatId, registrationId, values, fields, checks, links, onError, onChanged
}: {
  seatId: string;

  /** Welche Einsendung — eine Bestätigung hängt am WERT, nicht am Menschen. */
  readonly registrationId: string;

  values: ReadonlyMap<string, string> | undefined;
  fields: readonly OpenField[];

  /** Was an einzelnen Werten schon bestätigt ist (0030). */
  checks: readonly ValueCheck[];

  links: SeatLinks;
  onError: (message: string | null) => void;

  /** Nach dem Umschreiben ist die Liste veraltet. */
  onChanged: () => Promise<void>;
}) {
  /** `undefined`: wird gerade gelesen. `null`: die Kanzlei kennt ihn nicht. */
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const row = links.rows.get(seatId);
  const { peek } = links;

  useEffect(() => {
    let alive = true;
    void peek(seatId)
      .then((found) => { if (alive) setUrl(found); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [peek, seatId, row?.linkSealed]);

  const numbers = numbersOf(values, fields);
  const orphans = numbers.filter((n) => n.orphan);

  /** Wohin ein umgeschriebener Wert gehört — die Frage von heute. */
  const livePhone = fields.find((f) => f.kind === 'phone');

  /** Wonach der Link beim ersten Öffnen fragt — lesbar. */
  const asked = (row?.verifyFields ?? '').split(',').filter((id) => id !== '')
    .map((id) => fields.find((f) => f.fieldId === id)?.label ?? 'pytanie usunięte');

  const renew = async () => {
    if (url !== null && !(await askText('Wystawić nowy link? Obecny przestanie działać — także ten, który ta osoba już ma.'))) return;

    setBusy(true);
    onError(null);

    try {
      setUrl(await links.renew(seatId, checkOf(values, fields)));
      setCopied(false);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się wystawić linku.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Einen verwaisten Wert auf die HEUTIGE Frage umschreiben.
   *
   * <b>Warum es das überhaupt braucht.</b> `value_check.field_id` zeigt auf
   * `slug_field` — eine Bestätigung ohne Frage kann es nicht geben. Wer sein
   * Formular neu gebaut hat, trägt aber Antworten, die auf die Fragen von
   * gestern zeigen: lesbar, und trotzdem nicht zu bestätigen.
   *
   * <b>Der Platzschlüssel muss mit</b> — wie bei jeder Korrektur der Kanzlei.
   * Ohne ihn stünde im Portal des Menschen hinterher nichts mehr.
   */
  const rebind = async () => {
    if (livePhone === undefined) return;
    setBusy(true);
    onError(null);

    try {
      /* Die Annahme des Bereichs, in den DIESE Frage schreibt — bei mehreren nicht irgendeine. */
      const intake = await loadPublicIntake(livePhone.areaId);
      const seatKey = await links.key(seatId).catch(() => null);

      /* Was schon unter der heutigen Frage steht, bleibt — und geht voran. */
      let merged = [...splitPhones(values?.get(livePhone.fieldId) ?? '')];
      for (const one of orphans) merged = [...withPhone(merged, one.dial).numbers];

      await reviseAsOffice(registrationId, [
        { fieldId: livePhone.fieldId, value: joinPhones(merged) },
        /* Der verwaiste Wert wird geleert, nicht verdoppelt. */
        ...[...new Set(orphans.map((o) => o.fieldId))].map((fieldId) => ({ fieldId, value: '' }))
      ], { intakePublic: fromBase64Url(intake.publicKey), seatKey });

      await onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się przepisać numeru.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Den Link ZURÜCKNEHMEN — der einzige Handgriff gegen einen Link, der in
   * die falschen Hände geraten ist. Es löscht nichts: die Einsendung bleibt,
   * was aufhört, ist der Zugang über diesen Platz.
   */
  const withdraw = async () => {
    if (!(await askText('Wycofać link? Ta osoba straci dostęp przez link; zgłoszenie zostaje.'))) return;

    setBusy(true);
    onError(null);

    try {
      await revokeSeat(seatId);
      await links.reload();
      setUrl(null);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się wycofać linku.');
    } finally {
      setBusy(false);
    }
  };

  const when = (at: string) =>
    new Date(at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

  if (row !== undefined && row.revokedAt !== null) {
    return (
      <p className="wk-hint">
        Link tej osoby wycofano {when(row.revokedAt)} — przez link nie ma już dostępu.
        Zgłoszenie zostaje.
      </p>
    );
  }

  return (
    <div className="wk-form">
      <h4 className="wk-h3">Link osoby</h4>

      {url === undefined ? (
        <p className="wk-hint">Otwieranie linku…</p>
      ) : url === null ? (
        <p className="wk-hint">
          Ten link jest starszy i kancelaria go nie odczyta. Przy pierwszym SMS-ie powstanie nowy (stary przestanie działać).
        </p>
      ) : (
        <div className="wk-link-row">
          <input readOnly className="wk-mono" value={url} aria-label="Link osoby" onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button" className="wk-link-btn"
            onClick={() => {
              void navigator.clipboard?.writeText(url)
                .then(() => setCopied(true)).catch(() => setCopied(false));
            }}
          >
            {copied ? 'Skopiowano' : 'Kopiuj'}
          </button>
        </div>
      )}

      {row !== undefined && (
        <p className="wk-hint">
          {row.locked
            ? 'Link zablokowany — ktoś kilka razy źle odpowiedział przy pierwszym otwarciu. Wystaw nowy.'
            : row.asks && row.verifiedAt === null
              ? `Jeszcze nieotwarty. Przy pierwszym otwarciu zapyta o: ${asked.join(', ') || '—'}.`
              : row.asks
                ? `Otwarty i potwierdzony ${when(row.verifiedAt!)} — więcej nie pyta.`
                : 'Ten link nie pyta o nic przy otwarciu.'}
          {row.viewCount > 0 && ` Otwierany ${row.viewCount}×.`}
        </p>
      )}

      <div className="wk-actions">
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void renew()}>
          {busy ? 'Wystawianie…' : url === null ? 'Wystaw link' : 'Wystaw nowy link'}
        </button>
        <button
          type="button" className="wk-link-btn wk-danger" disabled={busy}
          title="Link przestaje działać. Zgłoszenie zostaje."
          onClick={() => void withdraw()}
        >
          Wycofaj link
        </button>
      </div>

      {/*
        DER VERWAISTE WERT — und was dagegen zu tun ist. Er lässt sich lesen
        und anwählen, aber NICHT bestätigen: eine Bestätigung zeigt auf eine
        Frage, und diese gibt es nicht mehr.
      */}
      {orphans.length > 0 && (
        <p className="wk-note">
          {orphans.length === 1
            ? 'Ten numer należy do pytania, którego już nie ma — '
            : 'Te numery należą do pytań, których już nie ma — '}
          SMS wyślesz, ale linku potwierdzającego numer do nich nie da się wystawić.
          {livePhone === undefined ? (
            <> Najpierw dodaj do formularza pytanie o telefon.</>
          ) : (
            <>
              {' '}
              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void rebind()}>
                Przepisz na „{livePhone.label ?? 'telefon'}"
              </button>
            </>
          )}
        </p>
      )}

      {/*
        DER ZUSTAND JEDER NUMMER, die einen Bestätigungslink (`{weryfikacja}`)
        bekommen hat — bestätigt, oder „ist draussen und wartet".
      */}
      {[...new Set(numbers.filter((n) => !n.orphan).map((n) => n.fieldId))].map((fieldId) => {
        const mark = checks.find((c) => c.fieldId === fieldId);
        if (mark === undefined) return null;

        const label = fields.find((f) => f.fieldId === fieldId)?.label ?? 'Numer';

        return mark.verifiedAt !== null ? (
          <p className="wk-hint" key={fieldId}>
            <strong>{label} — potwierdzony</strong> {when(mark.verifiedAt)}
            {mark.origin === 'sms'
              ? ' — ta osoba kliknęła link, który tam wysłaliście.'
              : ' — ta osoba potwierdziła to w swoim portalu. '
                + 'To nie dowód, że telefon działa — jeśli tego potrzebujecie, wyślijcie link.'}
          </p>
        ) : (
          <p className="wk-hint" key={fieldId}>
            Link potwierdzający numer wysłany{' '}
            {new Date(mark.sentAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })},
            {' '}bez odpowiedzi. Ważny do{' '}
            {new Date(mark.expiresAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}.
          </p>
        );
      })}
    </div>
  );
}

/* -- Das erste Öffnen eines Links (0046) ----------------------------------- */

/**
 * „O CO ZAPYTAĆ PRZY PIERWSZYM OTWARCIU LINKU" — eine Einstellung des
 * ganzen Formulars.
 *
 * <b>Wozu.</b> Ein Link in einer SMS kann bei der falschen Nummer landen. Wer
 * ihn zum ersten Mal öffnet, nennt einmal, was hier gewählt ist — etwa Imię
 * und Nazwisko —, so wie es im Zgłoszenie steht. Einmal richtig: der Link
 * fragt nie wieder. Nichts gewählt: er fragt nichts.
 */
export function LinkCheckBox({ partId, fields, busy, onSaved, onError }: {
  partId: string;
  fields: readonly OpenField[];
  busy: boolean;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const current = fields.filter((f) => f.linkCheck).map((f) => f.fieldId).join(',');
  const [draft, setDraft] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(new Set(current === '' ? [] : current.split(',')));
  }, [current]);

  /* Was sich zum Wiedererkennen eignet — keine langen Texte, keine Auswahl aus einer Liste. */
  const askable = fields.filter((f) => f.kind === 'line' || f.kind === 'date' || f.kind === 'phone'
    || f.kind === 'email' || f.kind === 'number');

  const changed = [...draft].sort().join(',') !== current.split(',').filter((id) => id !== '').sort().join(',');

  const save = async () => {
    setSaving(true);
    onError(null);

    try {
      await setLinkCheck(partId, askable.filter((f) => draft.has(f.fieldId)).map((f) => f.fieldId));
      onSaved();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wk-field">
      <span>Pierwsze otwarcie linku — o co zapytać</span>

      <p className="wk-hint">
        Kto pierwszy raz otworzy link z SMS-a, musi podać zaznaczone dane (jak w zgłoszeniu). Nic nie zaznaczone — link nie pyta.
      </p>

      {askable.length === 0 ? (
        <p className="wk-empty">W formularzu nie ma pytania, o które dałoby się zapytać.</p>
      ) : (
        <ul className="wk-checks">
          {askable.map((f) => (
            <li key={f.fieldId}>
              <label>
                <input
                  type="checkbox"
                  checked={draft.has(f.fieldId)}
                  disabled={busy || saving || (!draft.has(f.fieldId) && draft.size >= 10)}
                  onChange={(e) => {
                    const next = new Set(draft);
                    if (e.target.checked) next.add(f.fieldId); else next.delete(f.fieldId);
                    setDraft(next);
                  }}
                />
                {' '}{f.label ?? 'zapieczętowane pytanie'}
                <span className="wk-row-side"> · {KIND_LABEL[f.kind]}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <p className="wk-hint">
        Dotyczy linków wysyłanych od teraz.
      </p>

      {changed && (
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy || saving} onClick={() => void save()}>
            {saving ? 'Zapisywanie…' : 'Zapisz'}
          </button>
          <button
            type="button" className="wk-link-btn" disabled={saving}
            onClick={() => setDraft(new Set(current === '' ? [] : current.split(',')))}
          >
            Cofnij
          </button>
        </div>
      )}
    </div>
  );
}
