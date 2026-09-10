/**
 * Firmung — Jahrgang, Kandidaten, Treffen.
 *
 * Vier Entscheidungen tragen diese Ansicht:
 *
 *   1. **„Wer muss noch was abgeben" steht ganz oben.** Es ist die häufigste
 *      Frage eines Katecheten, und sie lässt sich aus den Klartext-Merkern
 *      beantworten, ohne einen einzigen Datensatz zu öffnen. Der Satz daneben
 *      sagt, warum das geht — sonst sähe es aus, als würde hier fahrlässig
 *      etwas offen gelassen.
 *
 *   2. **„Für die Familie" heisst NICHT „unverschlüsselt".** Beide Arten von
 *      Notiz liegen versiegelt. Anders als beim Messplan, wo öffentlich
 *      wirklich am Schaukasten hängt, gibt es bei einem Kind kein
 *      „öffentlich" — nur einen engeren und einen weiteren Kreis. Das steht
 *      am Schalter, nicht in einer Fussnote.
 *
 *   3. **Ein volles Treffen bietet keinen Knopf an.** Der Dienst würde absagen;
 *      einen Knopf zu zeigen, der zuverlässig mit einem Nein endet, sieht aus
 *      wie eine Befugnis.
 *
 *   4. **Ein unlesbarer Kandidat bleibt in der Liste** (15.9). Dass jemand da
 *      ist, den man nicht öffnen kann, ist eine Auskunft; ein Loch ist keine,
 *      und die Zahlen des Jahrgangs stimmten dann nicht mehr.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rcCopy, rcPlural, type RcLang } from './i18n';
import type { RcArea, RcRole } from './lib/rcChat';
import {
  rcAddCandidate, rcAddCandidateNote, rcAddMeetingSlot, rcBookSlot, rcCandidateLabel,
  rcCandidates, rcConfirmationGroups, rcCreateConfirmationGroup, rcFreeSeats,
  rcMeetingSlots, rcMissingSteps, rcOutstanding, rcSlotFull, rcWithdrawCandidate,
  type RcCandidate, type RcConfirmationGroup, type RcMeetingSlot
} from './lib/rcConfirmation';
import { rcParishes, type RcParish } from './lib/rcParish';
import { useRcError } from './RcThreads';

export function RcConfirmationSection({
  lang, areas, roles, unlocked, onError
}: {
  lang: RcLang;
  areas: readonly RcArea[];
  roles: readonly RcRole[];
  unlocked: boolean;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].conf;
  const describe = useRcError(lang);

  const [list, setList] = useState<readonly RcConfirmationGroup[]>([]);
  const [parishes, setParishes] = useState<readonly RcParish[]>([]);
  const [open, setOpen] = useState<RcConfirmationGroup | null>(null);

  const refresh = useCallback(async () => {
    if (!unlocked) return;
    try {
      const [groups, p] = await Promise.all([rcConfirmationGroups(), rcParishes()]);
      setList(groups.groups ?? []);
      setParishes(p.parishes ?? []);
    } catch (e) {
      onError(describe(e));
    }
  }, [unlocked, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!unlocked) return <p className="rc-note">{rcCopy[lang].chat.locked}</p>;

  if (open !== null) {
    return (
      <RcGroupDetail
        lang={lang}
        group={open}
        roles={roles}
        onBack={() => { setOpen(null); void refresh(); }}
        onError={onError}
      />
    );
  }

  const usable = areas.filter((a) => a.canCertify);

  return (
    <div className="rc-panel">
      {list.length === 0 && <p className="rc-note">{t.none}</p>}

      <ul className="rc-event-list">
        {list.map((group) => (
          <li key={group.groupId} className="rc-event-row">
            <button type="button" className="rc-event-open" onClick={() => setOpen(group)}>
              <span className="rc-event-title">{group.name}</span>
              <span className="rc-event-meta">
                {rcPlural(lang, t.candidates, group.candidates)}
                {' · '}
                {group.slots} × {t.slots}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {usable.length > 0 && parishes.length > 0 && (
        <RcNewGroup
          lang={lang}
          areas={usable}
          parishes={parishes}
          onDone={refresh}
          onError={onError}
        />
      )}
    </div>
  );
}

function RcNewGroup({
  lang, areas, parishes, onDone, onError
}: {
  lang: RcLang;
  areas: readonly RcArea[];
  parishes: readonly RcParish[];
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].conf;
  const describe = useRcError(lang);

  const [parishId, setParishId] = useState(parishes[0]?.parishId ?? '');
  const [areaId, setAreaId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  // Der Bereich der Pfarrei wird NICHT vorgeschlagen. Er wäre die bequeme
  // Wahl und die falsche — genau davor warnt der Satz darunter.
  const parishAreas = new Set(parishes.map((p) => p.areaId));
  const forRecords = areas.filter((a) => !parishAreas.has(a.areaId));

  return (
    <form
      className="rc-new-event"
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim().length === 0 || areaId === '' || busy) return;
        setBusy(true);
        try {
          await rcCreateConfirmationGroup(parishId, areaId, name);
          setName('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{t.create}</h5>

      {parishes.length > 1 && (
        <label className="rc-inline-field">
          <span>{rcCopy[lang].parish.heading}</span>
          <select value={parishId} onChange={(e) => setParishId(e.target.value)}>
            {parishes.map((p) => (
              <option key={p.parishId} value={p.parishId}>{p.name}</option>
            ))}
          </select>
        </label>
      )}

      <label className="rc-field">
        <span>{t.name}</span>
        <input type="text" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="rc-inline-field">
        <span>{t.ownArea}</span>
        <select value={areaId} disabled={busy} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">—</option>
          {forRecords.map((a) => (
            <option key={a.areaId} value={a.areaId}>{a.title ?? a.areaId.slice(0, 8)}</option>
          ))}
        </select>
      </label>

      {/* Warum ein eigener Bereich. Der Satz steht VOR der Wahl, nicht als
          Erklärung hinterher — die Wahl lässt sich nicht zurücknehmen. */}
      <p className="rc-note rc-why-internal">{t.ownAreaWhy}</p>

      <button type="submit" className="rc-btn"
        disabled={busy || name.trim().length === 0 || areaId === ''}>
        {t.make}
      </button>
    </form>
  );
}

// -- Ein Jahrgang -------------------------------------------------------------

function RcGroupDetail({
  lang, group, roles, onBack, onError
}: {
  lang: RcLang;
  group: RcConfirmationGroup;
  roles: readonly RcRole[];
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].conf;
  const describe = useRcError(lang);

  const [candidates, setCandidates] = useState<readonly RcCandidate[]>([]);
  const [slots, setSlots] = useState<readonly RcMeetingSlot[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        rcCandidates(group.groupId),
        rcMeetingSlots(group.groupId)
      ]);
      setCandidates(c.candidates ?? []);
      setSlots(s.slots ?? []);
    } catch (e) {
      onError(describe(e));
    }
  }, [group.groupId, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  const outstanding = useMemo(() => rcOutstanding(candidates), [candidates]);
  const writable = roles.find((r) => r.hasKey) ?? roles[0];

  return (
    <div className="rc-panel">
      <header className="rc-event-head">
        <button type="button" className="rc-link" onClick={onBack}>←</button>
        <h3>{group.name}</h3>
        <span className="rc-event-meta">{rcPlural(lang, t.candidates, candidates.length)}</span>
      </header>

      {/* Die häufigste Frage eines Katecheten — und der Satz, warum sie sich
          ohne einen einzigen entschlüsselten Datensatz beantworten lässt. */}
      {candidates.length > 0 && (
        <div className="rc-outstanding" data-clear={outstanding === 0}>
          <strong>
            {outstanding === 0 ? t.stepsDone : rcPlural(lang, t.outstanding, outstanding)}
          </strong>
          <p className="rc-note">{t.outstandingWhy}</p>
        </div>
      )}

      {candidates.length === 0 && <p className="rc-note">{t.noCandidates}</p>}

      <ul className="rc-cand-list">
        {candidates.map((candidate) => (
          <RcCandidateRow
            key={candidate.candidateId}
            lang={lang}
            candidate={candidate}
            role={writable}
            onChanged={refresh}
            onError={onError}
          />
        ))}
      </ul>

      {writable && (
        <RcNewCandidate
          lang={lang}
          groupId={group.groupId}
          onDone={refresh}
          onError={onError}
        />
      )}

      <h4 className="rc-chat-h">{t.slots}</h4>

      {slots.length === 0 && <p className="rc-note">{t.noSlots}</p>}

      {slots.map((slot) => (
        <RcSlotRow
          key={slot.slotId}
          lang={lang}
          slot={slot}
          candidates={candidates}
          onChanged={refresh}
          onError={onError}
        />
      ))}

      <RcNewSlot lang={lang} groupId={group.groupId} onDone={refresh} onError={onError} />
    </div>
  );
}

function RcCandidateRow({
  lang, candidate, role, onChanged, onError
}: {
  lang: RcLang;
  candidate: RcCandidate;
  role: RcRole | undefined;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].conf;
  const describe = useRcError(lang);

  const [open, setOpen] = useState(false);
  const missing = rcMissingSteps(candidate);
  const sealed = candidate.unreadable !== null && candidate.unreadable !== undefined;

  return (
    <li className="rc-cand" data-sealed={sealed} data-withdrawn={candidate.status === 'withdrawn'}>
      <button type="button" className="rc-cand-head" onClick={() => setOpen(!open)}>
        <span className="rc-cand-name">
          {rcCandidateLabel(candidate, t.sealedCandidate)}
        </span>

        {/* Die Merker im Klartext — deshalb sichtbar, ohne dass irgendetwas
            entschlüsselt werden musste. */}
        <span className="rc-cand-steps">
          {candidate.status === 'withdrawn' ? (
            <em>{t.withdrawn}</em>
          ) : missing.length === 0 ? (
            <span className="rc-step-done">{t.stepsDone}</span>
          ) : (
            missing.map((step) => (
              <span key={step} className="rc-step-missing">{t.steps[step] ?? step}</span>
            ))
          )}
        </span>
      </button>

      {open && !sealed && (
        <div className="rc-cand-body">
          <dl className="rc-cand-fields">
            {candidate.born && <><dt>{t.born}</dt><dd>{candidate.born}</dd></>}
            {candidate.contact && <><dt>{t.contact}</dt><dd>{candidate.contact}</dd></>}
            {candidate.school && <><dt>{t.school}</dt><dd>{candidate.school}</dd></>}
            {candidate.baptism && <><dt>{t.baptism}</dt><dd>{candidate.baptism}</dd></>}
          </dl>

          {candidate.notes.length > 0 && (
            <ul className="rc-note-list">
              {candidate.notes.map((note) => (
                <li key={note.noteId} className="rc-cand-note" data-family={note.forFamily}>
                  {/* Beide Arten sind versiegelt. Die Kennzeichnung sagt, WER
                      es lesen darf — nicht, ob es verschlüsselt ist. */}
                  <span className="rc-note-kind">
                    {note.forFamily ? t.forFamily : t.internalOnly}
                  </span>
                  <span className="rc-note-text">{note.text ?? t.sealedCandidate}</span>
                </li>
              ))}
            </ul>
          )}

          {role && candidate.status === 'enrolled' && (
            <RcNewNote
              lang={lang}
              candidateId={candidate.candidateId}
              role={role}
              onDone={onChanged}
              onError={onError}
            />
          )}

          {candidate.status === 'enrolled' && (
            <div className="rc-cand-withdraw">
              <button
                type="button"
                className="rc-msg-action"
                onClick={async () => {
                  try { await rcWithdrawCandidate(candidate.candidateId); await onChanged(); }
                  catch (e) { onError(describe(e)); }
                }}
              >
                {t.withdraw}
              </button>
              <p className="rc-note rc-hint">{t.withdrawWhy}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function RcNewNote({
  lang, candidateId, role, onDone, onError
}: {
  lang: RcLang;
  candidateId: string;
  role: RcRole;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].conf;
  const describe = useRcError(lang);

  const [text, setText] = useState('');
  const [forFamily, setForFamily] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="rc-new-note"
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.trim().length === 0 || busy) return;
        setBusy(true);
        try {
          await rcAddCandidateNote(candidateId, role.roleId, text, forFamily);
          setText('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="rc-field">
        <span>{t.noteText}</span>
        <textarea rows={2} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
      </label>

      <label className="rc-check">
        <input type="checkbox" checked={forFamily} disabled={busy}
          onChange={(e) => setForFamily(e.target.checked)} />
        <span>{t.forFamily}</span>
      </label>

      {/* Der wichtigste Satz dieses Formulars: „für die Familie" heisst nicht
          „unverschlüsselt". Er steht immer da, nicht nur wenn angehakt. */}
      <p className="rc-note rc-hint">{t.forFamilyWhy}</p>

      <button type="submit" className="rc-btn rc-btn-quiet" disabled={busy || text.trim().length === 0}>
        {t.addNote}
      </button>
    </form>
  );
}

function RcNewCandidate({
  lang, groupId, onDone, onError
}: {
  lang: RcLang;
  groupId: string;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].conf;
  const describe = useRcError(lang);

  const [name, setName] = useState('');
  const [born, setBorn] = useState('');
  const [contact, setContact] = useState('');
  const [school, setSchool] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="rc-new-event"
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim().length === 0 || busy) return;
        setBusy(true);
        try {
          await rcAddCandidate(groupId, name, {
            born: born.trim() || undefined,
            contact: contact.trim() || undefined,
            school: school.trim() || undefined
          });
          setName(''); setBorn(''); setContact(''); setSchool('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{t.add}</h5>

      {/* ALLE Felder tragen denselben Rand: hier ist nichts öffentlich. Beim
          Messplan und beim Kalender unterscheiden sich die Ränder, weil sich
          die Sichtbarkeit unterscheidet — hier nicht. */}
      <label className="rc-field rc-field-internal">
        <span>{t.name}</span>
        <input type="text" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="rc-field rc-field-internal">
        <span>{t.born}</span>
        <input type="date" value={born} disabled={busy} onChange={(e) => setBorn(e.target.value)} />
      </label>

      <label className="rc-field rc-field-internal">
        <span>{t.contact}</span>
        <input type="text" value={contact} disabled={busy} onChange={(e) => setContact(e.target.value)} />
      </label>

      <label className="rc-field rc-field-internal">
        <span>{t.school}</span>
        <input type="text" value={school} disabled={busy} onChange={(e) => setSchool(e.target.value)} />
      </label>

      <p className="rc-note rc-why-internal">{t.sealedWhy}</p>

      <button type="submit" className="rc-btn" disabled={busy || name.trim().length === 0}>
        {t.add}
      </button>
    </form>
  );
}

// -- Treffen ------------------------------------------------------------------

function RcSlotRow({
  lang, slot, candidates, onChanged, onError
}: {
  lang: RcLang;
  slot: RcMeetingSlot;
  candidates: readonly RcCandidate[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].conf;
  const describe = useRcError(lang);

  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);

  const free = rcFreeSeats(slot);
  const full = rcSlotFull(slot);

  const enrolled = candidates.filter((c) => c.status === 'enrolled');

  return (
    <article className="rc-slot" data-full={full}>
      <header className="rc-slot-head">
        <time dateTime={slot.startsUtc}>
          {new Date(slot.startsUtc).toLocaleString(lang,
            { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </time>
        {slot.label !== null && slot.label !== undefined && (
          <span className="rc-slot-label">{slot.label}</span>
        )}
        <span className="rc-slot-seats" data-full={full}>
          {full ? t.full : rcPlural(lang, t.free, free)}
        </span>
      </header>

      {/* Ein volles Treffen bietet keinen Knopf an. Der Dienst würde absagen;
          einen Knopf zu zeigen, der zuverlässig mit einem Nein endet, sieht
          aus wie eine Befugnis. */}
      {!full && slot.isOpen && enrolled.length > 0 && (
        <form
          className="rc-slot-book"
          onSubmit={async (e) => {
            e.preventDefault();
            if (who === '' || busy) return;
            setBusy(true);
            try { await rcBookSlot(slot.slotId, who); setWho(''); await onChanged(); }
            catch (err) { onError(describe(err)); }
            finally { setBusy(false); }
          }}
        >
          <label className="rc-inline-field">
            <span>{t.pick}</span>
            <select value={who} disabled={busy} onChange={(e) => setWho(e.target.value)}>
              <option value="">—</option>
              {enrolled.map((c) => (
                <option key={c.candidateId} value={c.candidateId}>
                  {rcCandidateLabel(c, t.sealedCandidate)}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="rc-btn rc-btn-quiet" disabled={busy || who === ''}>
            {t.book}
          </button>
        </form>
      )}
    </article>
  );
}

function RcNewSlot({
  lang, groupId, onDone, onError
}: {
  lang: RcLang;
  groupId: string;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].conf;
  const describe = useRcError(lang);

  const [when, setWhen] = useState('');
  const [capacity, setCapacity] = useState(1);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="rc-new-event"
      onSubmit={async (e) => {
        e.preventDefault();
        if (when === '' || busy) return;
        setBusy(true);
        try {
          await rcAddMeetingSlot(groupId, new Date(when).toISOString(), {
            capacity, label: label.trim() || undefined
          });
          setWhen(''); setLabel('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{t.addSlot}</h5>

      <div className="rc-poll-opts">
        <label className="rc-inline-field">
          <span>{t.when}</span>
          <input type="datetime-local" value={when} disabled={busy}
            onChange={(e) => setWhen(e.target.value)} />
        </label>

        <label className="rc-inline-field">
          <span>{t.capacity}</span>
          <input type="number" min={1} max={500} value={capacity} disabled={busy}
            onChange={(e) => setCapacity(Number(e.target.value))} />
        </label>
      </div>

      <label className="rc-field">
        <span>{t.label}</span>
        <input type="text" value={label} disabled={busy} onChange={(e) => setLabel(e.target.value)} />
      </label>

      <button type="submit" className="rc-btn rc-btn-quiet" disabled={busy || when === ''}>
        {t.addSlot}
      </button>
    </form>
  );
}
