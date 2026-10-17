/**
 * „Intencje" — eine Messe mit ihren Intentionen, im Eingabemodus der Kanzlei (Enter, Strg+Enter, Escape).
 */

import { useEffect, useRef, useState } from 'react';

import { type Duty, setPeople } from '../calendar/calendar';
import type { Candidate } from '../calendar/PeoplePicker';
import { areaKeys, newestKey } from '../chat/chat';
import { Field, aad, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { askText } from '../ui/dialogs';
import { INTENTION_STATUS_LABEL, type IntentionKind, KIND_LABEL, type OfficeIntention, type OfficeMass, addIntention, dayLabel, deleteIntention, hour, updateIntention } from './mass';
import { PeopleLine } from './MassPlan';
import { keyOf } from './officeDays';

/* -- Eine Messe mit ihren Intentionen -------------------------------------- */

export function MassEntry({ me, mass, masses, candidates: people, names, position, hasNext, onNextMass, onEdit, onChanged, onError }: {
  me: Me | null;
  mass: OfficeMass;
  /** Alle Messen des Fensters — wohin eine Intention verlegt werden kann. */
  masses: readonly OfficeMass[];
  /** Die Menschen der Gruppe — `null` ohne Schlüssel. */
  candidates: readonly Candidate[] | null;
  names: ReadonlyMap<string, string>;
  position: string;
  hasNext: boolean;
  onNextMass: () => void;
  onEdit: () => void;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<IntentionKind>('single');
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  /* Wer eine Intention lesen kann: die Menschen des Bereichs — die, die schon feiern, zuerst. */
  const celebrants = (mass.people ?? []).filter((p) => p.duty === 'celebrant').map((p) => p.roleId);
  const candidates = people === null ? null : [
    ...people.filter((p) => celebrants.includes(p.roleId)),
    ...people.filter((p) => !celebrants.includes(p.roleId))
  ];

  /*
   * Beim Wechsel der Messe steht der Kursor sofort im Feld. Ohne das müsste
   * nach jedem Strg+Enter doch wieder zur Maus gegriffen werden — und damit
   * wäre der ganze Modus umsonst.
   */
  useEffect(() => { field.current?.focus(); }, [mass.occurrenceAt]);

  const save = async (thenNext: boolean) => {
    const value = text.trim();

    if (value === '') {
      // Leer und Strg+Enter heisst: diese Messe hat nichts, weiter.
      if (thenNext && hasNext) onNextMass();
      return;
    }

    setBusy(true);
    onError(null);

    try {
      /*
       * `occurrenceAt` und NICHT `startsAt`: die Adresse einer Intention ist der
       * URSPRÜNGLICHE Beginn des Vorkommens. Bei einer verlegten Messe sind das
       * zwei verschiedene Zeitpunkte — und die Intention hinge dann an einer
       * Adresse, nach der der Plan nie wieder fragt.
       */
      await addIntention(mass.itemId, mass.occurrenceAt, { text: value, kind });
      setText('');
      onChanged();

      if (thenNext && hasNext) onNextMass();
      else field.current?.focus();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać intencji.');
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setText(''); return; }
    if (e.key !== 'Enter') return;

    /*
     * Verhindern, BEVOR gespeichert wird: sonst schickt der Browser das
     * umgebende Formular ab und die Seite lädt neu — mitten in einer Reihe von
     * zwanzig Intentionen.
     */
    e.preventDefault();
    void save(e.ctrlKey || e.metaKey);
  };

  /* Nach der Messe: alle angenommenen als gelesen — ein Griff statt zwanzig. */
  const past = new Date(mass.endsAt).getTime() <= Date.now();
  const open = mass.intentions.filter((i) => i.status === 'accepted');
  const markAll = async () => {
    setBusy(true);
    onError(null);
    try {
      for (const one of open) await updateIntention(one.intentionId, { status: 'celebrated' });
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się oznaczyć.');
    } finally {
      setBusy(false);
    }
  };

  /* Die Reihenfolge des Vorlesens: mit dem Nachbarn tauschen. */
  const ordered = [...mass.intentions].sort((a, b) => a.ordinal - b.ordinal);
  const swap = async (index: number, by: -1 | 1) => {
    const a = ordered[index];
    const b = ordered[index + by];
    if (a === undefined || b === undefined) return;
    setBusy(true);
    try {
      /* Gleiche Stellen (alte Einträge) bekommen erst eigene. */
      const ordA = a.ordinal === b.ordinal ? index : a.ordinal;
      const ordB = a.ordinal === b.ordinal ? index + by : b.ordinal;
      await updateIntention(a.intentionId, { ordinal: ordB });
      await updateIntention(b.intentionId, { ordinal: ordA });
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zmienić kolejności.');
    } finally {
      setBusy(false);
    }
  };

  const singles = mass.intentions.filter((i) => i.kind === 'single' && i.status !== 'cancelled');

  return (
    <article className="wk-mo-mass">
      <header className="wk-mo-head">
        <strong>{hour(mass.startsAt)}</strong>
        {(mass.title ?? '') !== '' && <span className="wk-mass-title">{mass.title}</span>}
        {mass.moved === true && <span className="wk-tag">przeniesiona</span>}
        <span className="wk-row-side">{dayLabel(mass.startsAt)} · {position}</span>
        <PeopleLine mass={mass} names={names} />
        <span className="wk-mo-head-actions">
          <button type="button" className="wk-link-btn" onClick={onEdit}>Zmień mszę</button>
          {past && open.length > 0 && (
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void markAll()}>
              Oznacz jako odprawione ({open.length})
            </button>
          )}
        </span>
      </header>

      {ordered.length === 0 ? (
        <p className="wk-empty">Bez intencji.</p>
      ) : (
        <ul className="wk-list">
          {ordered.map((one, index) => (
            <Row
              key={one.intentionId}
              me={me}
              mass={mass}
              intention={one}
              masses={masses}
              candidates={candidates}
              first={index === 0}
              last={index === ordered.length - 1}
              onUp={() => void swap(index, -1)}
              onDown={() => void swap(index, 1)}
              onChanged={onChanged}
              onError={onError}
            />
          ))}
        </ul>
      )}

      {/*
        Zwei einzelne Intentionen heissen zwei Priester. Das ist der Grund, aus
        dem es die Unterscheidung überhaupt gibt — also steht es da, und mit
        ihr, wie viele schon eingeteilt sind.
      */}
      {singles.length > 1 && (
        <p className="wk-mo-need">
          {singles.length} pojedyncze — potrzeba {singles.length} kapłanów
          {celebrants.length > 0 && ` (odprawia: ${celebrants.length})`}.
        </p>
      )}

      <div className="wk-mo-entry">
        <input
          ref={field}
          type="text"
          value={text}
          maxLength={400}
          disabled={busy}
          placeholder="Za śp. Jana Kowalskiego"
          aria-label="Nowa intencja"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
        />

        <select
          value={kind}
          disabled={busy}
          aria-label="Rodzaj nowej intencji"
          onChange={(e) => setKind(e.target.value as IntentionKind)}
        >
          <option value="single">{KIND_LABEL.single}</option>
          <option value="collective">{KIND_LABEL.collective}</option>
        </select>
      </div>
    </article>
  );
}

/**
 * Eine Intention — unmittelbar änderbar.
 *
 * Der Text wird beim VERLASSEN des Feldes gespeichert und nicht bei jedem
 * Anschlag: ein Aufruf je Buchstabe wäre ein Aufruf je Buchstabe. Alles andere
 * (Art, Stand, wer sie liest) sofort beim Wählen.
 */
function Row({ me, mass, intention, masses, candidates, first, last, onUp, onDown, onChanged, onError }: {
  me: Me | null;
  mass: OfficeMass;
  intention: OfficeIntention;
  masses: readonly OfficeMass[];
  candidates: readonly Candidate[] | null;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState(intention.text);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const cancelled = intention.status === 'cancelled';

  useEffect(() => { setText(intention.text); }, [intention.text]);

  const change = async (body: Parameters<typeof updateIntention>[1], failed = 'Nie udało się zapisać.') => {
    setBusy(true);
    onError(null);
    try {
      await updateIntention(intention.intentionId, body);
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : failed);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    const value = text.trim();
    if (value === '' || value === intention.text) { setText(intention.text); return; }
    await change({ text: value });
  };

  /*
   * WER SIE LIEST — und, wenn er an dieser Messe noch nicht steht, steht er
   * jetzt dort (Kto odprawia, nur dieser Termin). Sonst sähe der Priester die
   * Intention, aber die Messe nicht in seinem Kalender.
   */
  const pickCelebrant = async (roleId: string) => {
    setBusy(true);
    onError(null);
    try {
      await updateIntention(intention.intentionId, { celebrantRoleId: roleId });
      const present = mass.people ?? [];
      if (roleId !== '' && !present.some((p) => p.roleId === roleId)) {
        await setPeople(mass.itemId, [
          ...present.map((p) => ({ roleId: p.roleId, duty: p.duty as Duty })),
          { roleId, duty: 'celebrant' as Duty }
        ], mass.occurrenceAt);
      }
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się przypisać.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await askText(`Usunąć intencję „${intention.text}"? Tego nie da się cofnąć.`))) return;
    setBusy(true);
    try {
      await deleteIntention(intention.intentionId);
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.');
    } finally {
      setBusy(false);
    }
  };

  const others = masses.filter((m) => keyOf(m) !== keyOf(mass));

  return (
    <li className="wk-row wk-mo-int" data-cancelled={cancelled} data-status={intention.status}>
      <span className="wk-mo-order">
        <button type="button" className="wk-icon-btn" aria-label="Wyżej" title="Wyżej" disabled={busy || first} onClick={onUp}>↑</button>
        <button type="button" className="wk-icon-btn" aria-label="Niżej" title="Niżej" disabled={busy || last} onClick={onDown}>↓</button>
      </span>

      <input
        type="text"
        value={text}
        maxLength={400}
        disabled={busy || cancelled}
        aria-label="Treść intencji"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      />

      <span className="wk-mo-int-controls">
        <select value={intention.kind} disabled={busy} aria-label="Rodzaj" onChange={(e) => void change({ kind: e.target.value as IntentionKind })}>
          <option value="single">{KIND_LABEL.single}</option>
          <option value="collective">{KIND_LABEL.collective}</option>
        </select>

        <select value={intention.status} disabled={busy} aria-label="Stan" onChange={(e) => void change({ status: e.target.value })}>
          {(['accepted', 'celebrated', 'cancelled'] as const).map((s) => <option key={s} value={s}>{INTENTION_STATUS_LABEL[s]}</option>)}
        </select>

        {candidates !== null && (
          <select value={intention.celebrantRoleId ?? ''} disabled={busy} aria-label="Kto odprawia tę intencję"
            onChange={(e) => void pickCelebrant(e.target.value)}>
            <option value="">— kto odprawia —</option>
            {candidates.map((c) => <option key={c.roleId} value={c.roleId}>{c.name}</option>)}
          </select>
        )}

        <button type="button" className="wk-link-btn" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? 'Mniej' : 'Więcej'}
        </button>
      </span>

      {more && (
        <div className="wk-mo-int-more">
          <Sealed me={me} mass={mass} intention={intention} busy={busy} onChanged={onChanged} onError={onError} />

          {others.length > 0 && (
            <label className="wk-field">
              <span>Przenieś na inną mszę</span>
              <select value="" disabled={busy} onChange={(e) => {
                const target = others.find((m) => keyOf(m) === e.target.value);
                if (target !== undefined) void change({ itemId: target.itemId, occurrenceAt: target.occurrenceAt }, 'Nie udało się przenieść.');
              }}>
                <option value="">— wybierz mszę —</option>
                {others.map((m) => (
                  <option key={keyOf(m)} value={keyOf(m)}>
                    {dayLabel(m.startsAt)} {hour(m.startsAt)}{(m.title ?? '') === '' ? '' : ` — ${m.title}`}
                  </option>
                ))}
              </select>
              <span className="wk-hint">Inny termin poza tymi dwoma tygodniami: wybierz wyżej inny dzień.</span>
            </label>
          )}

          {intention.status !== 'celebrated' && (
            <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => void remove()}>Usuń intencję</button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * KTO ZAMÓWIŁ I OFIARA — versiegelt, unter dem Schlüssel des Bereichs des
 * Kalenders. Sie hängen an keinem Zettel an der Tür; der Dienst legt sie ab,
 * ohne sie zu lesen (`app.mass_intention_field`).
 */
function Sealed({ me, mass, intention, busy: outerBusy, onChanged, onError }: {
  me: Me | null;
  mass: OfficeMass;
  intention: OfficeIntention;
  busy: boolean;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [giver, setGiver] = useState<string | null>(null);
  const [offering, setOffering] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const aadOf = (field: 'giver' | 'offering') =>
    aad('mass', 'intention', intention.intentionId, field === 'giver' ? Field.MassIntentionGiver : Field.MassIntentionOffering, 1);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const opened: Record<string, string> = {};
      if (me !== null) {
        for (const f of intention.fields) {
          try {
            const key = (await areaKeys(me.ring, f.areaId)).get(f.epoch);
            if (key !== undefined) opened[f.field] = await openText(key, aadOf(f.field as 'giver' | 'offering'), fromBase64Url(f.sealed));
          } catch { /* nicht für mich */ }
        }
      }
      if (!alive) return;
      setGiver(opened.giver ?? '');
      setOffering(opened.offering ?? '');
    })();
    return () => { alive = false; };
  }, [me, intention.intentionId, intention.fields]);

  if (me === null || mass.areaId == null) {
    return <p className="wk-hint">Ofiarodawca i ofiara są zaszyfrowane — bez kluczy w tej karcie ich nie widać.</p>;
  }
  if (giver === null || offering === null) return <p className="wk-hint">Odczytywanie…</p>;

  const save = async () => {
    setBusy(true);
    onError(null);
    setSaved(false);
    try {
      const newest = newestKey(await areaKeys(me.ring, mass.areaId!, true));
      if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się zapisać.');
      const seal = async (field: 'giver' | 'offering', value: string) => ({
        field, areaId: mass.areaId!, epoch: newest.epoch,
        sealed: toBase64Url(await sealText(newest.key, aadOf(field), value))
      });
      await updateIntention(intention.intentionId, {
        fields: [await seal('giver', giver.trim()), await seal('offering', offering.trim())]
      });
      setSaved(true);
      onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wk-mo-sealed">
      <label className="wk-field">
        <span>Kto zamówił</span>
        <input value={giver} maxLength={200} disabled={busy || outerBusy} placeholder="np. rodzina Kowalskich, tel. …" onChange={(e) => { setGiver(e.target.value); setSaved(false); }} />
      </label>
      <label className="wk-field">
        <span>Ofiara</span>
        <input value={offering} maxLength={100} disabled={busy || outerBusy} placeholder="np. 50 zł" onChange={(e) => { setOffering(e.target.value); setSaved(false); }} />
      </label>
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || outerBusy} onClick={() => void save()}>Zapisz</button>
        {saved && <span className="wk-row-side">Zapisano.</span>}
        <span className="wk-hint">Zaszyfrowane — w gablocie i na wydruku ich nie ma.</span>
      </div>
    </div>
  );
}
