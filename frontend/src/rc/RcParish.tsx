/**
 * Pfarrei — Messplan, Intentionen, Gaben.
 *
 * Die eine Entscheidung, die diese Ansicht trägt: **beide Sichtbarkeiten einer
 * Intention stehen nebeneinander, und beschriftet.**
 *
 * Ein Eingabefeld „Text" und daneben eines „interner Text" wäre eine Falle:
 * beide sehen gleich aus, beide nehmen dasselbe entgegen, und der Unterschied
 * — das eine hängt im Schaukasten, das andere sieht niemand ausserhalb der
 * Pfarrei — steht dann nur im Kopf dessen, der es gerade tippt.
 *
 * Also steht bei jedem der beiden Felder, was mit dem passiert, was man
 * hineinschreibt. Nicht als Fussnote, sondern direkt darunter.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rcCopy, rcPlural, type RcLang } from './i18n';
import type { RcArea } from './lib/rcChat';
import {
  rcAddIntention, rcAddMass, rcAddOffering, rcCreateParish, rcIntentionSealed, rcIntentions,
  rcMasses, rcMassesByDay, rcParishes, rcSaveParishSite,
  type RcIntention, type RcMass, type RcParish
} from './lib/rcParish';
import { rcIsAllowedSlug, rcIsSlug, rcAllowedSlugs } from './lib/rcSlugs';
import { useRcError } from './RcThreads';

export function RcParishSection({
  lang, areas, unlocked, onError
}: {
  lang: RcLang;
  areas: readonly RcArea[];
  unlocked: boolean;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].parish;
  const describe = useRcError(lang);

  const [list, setList] = useState<readonly RcParish[]>([]);
  const [open, setOpen] = useState<RcParish | null>(null);

  const refresh = useCallback(async () => {
    if (!unlocked) return;
    try { setList((await rcParishes()).parishes ?? []); }
    catch (e) { onError(describe(e)); }
  }, [unlocked, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!unlocked) return <p className="rc-note">{rcCopy[lang].chat.locked}</p>;

  if (open !== null) {
    return (
      <RcParishDetail
        lang={lang}
        parish={open}
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
        {list.map((parish) => (
          <li key={parish.parishId} className="rc-event-row">
            <button type="button" className="rc-event-open" onClick={() => setOpen(parish)}>
              <span className="rc-event-title">{parish.name}</span>
              <span className="rc-event-meta">
                <code>/{parish.slug}</code>
                {parish.location !== null && parish.location !== undefined && <> · {parish.location}</>}
                {' · '}
                {parish.masses} × {t.plan}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {usable.length > 0 && (
        <RcNewParish lang={lang} areas={usable} onDone={refresh} onError={onError} />
      )}
    </div>
  );
}

/**
 * Der Katalog der Bausteine.
 *
 * Uebernommen aus dem Altbestand (`pages/parish/ParishPage.tsx`), weil er sich
 * dort bewaehrt hat und weil eine Pfarrei, die umzieht, dieselben Bausteine
 * wiederfinden soll. Die Beschriftungen kommen aus der Sprachschicht; hier
 * steht nur, WAS es gibt.
 */
const PARISH_MODULES = [
  'masses', 'announcements', 'intentions', 'calendar',
  'news', 'groups', 'events', 'sacraments',
  'hours', 'contact', 'gallery', 'sticky'
] as const;

/** Die Farbklaenge. Wie die Bausteine: nur die Namen, die Farben stehen im Stilblatt. */
const PARISH_THEMES = ['classic', 'warm', 'stone', 'night'] as const;

/**
 * Eine Pfarrei anlegen — in ZWEI Schritten, und die Trennung ist der Punkt.
 *
 * <b>Erster Schritt: wer sie ist.</b> Name und Adresse. Die Adresse wird hier
 * vergeben und ist danach nicht mehr zu aendern — sie wird weitergegeben,
 * gedruckt, verlinkt. Deshalb steht auf diesem Schritt nichts anderes: keine
 * Farbwahl, keine Bausteine, nichts, was von der einen Entscheidung ablenkt,
 * die wirklich endgueltig ist.
 *
 * <b>Zweiter Schritt: wie ihre Seite aussieht.</b> Farbe und Bausteine. Alles
 * daran ist jederzeit anders zu haben, und genau deshalb gehoert es nicht in
 * denselben Schritt: ein Formular, in dem Endgueltiges und Beilaeufiges
 * nebeneinander stehen, laesst beides gleich wichtig aussehen.
 *
 * Die Pfarrei entsteht schon nach dem ersten Schritt. Wer den zweiten
 * abbricht, hat keine halbe Pfarrei, sondern eine mit den Vorgaben — und die
 * Frage bleibt offen, bis jemand sie beantwortet (`configured`).
 */
function RcNewParish({
  lang, areas, onDone, onError
}: {
  lang: RcLang;
  areas: readonly RcArea[];
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].parish;
  const describe = useRcError(lang);

  const [areaId, setAreaId] = useState(areas[0]?.areaId ?? '');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);

  /** Nach dem ersten Schritt: die angelegte Pfarrei. Solange null, Schritt eins. */
  const [made, setMade] = useState<{ id: string; slug: string; name: string } | null>(null);

  const [theme, setTheme] = useState<string>('classic');
  const [chosen, setChosen] = useState<readonly string[]>(
    ['masses', 'announcements', 'intentions', 'contact']
  );

  /*
   * Der Vorschlag aus dem Namen bleibt eine Starthilfe; er entscheidet nichts.
   * Abgeleitet wurde frueher fest, und fuer polnische Namen war das unbrauchbar:
   * „Grzegorzki" wurde zu `grzeg-rzki`, weil jedes diakritische Zeichen durch
   * einen Bindestrich ersetzt wurde.
   */
  const guess = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const wanted = (slug === '' ? guess : slug).trim();

  const known = rcAllowedSlugs('parish');
  const shaped = wanted === '' || rcIsSlug(wanted);
  const listed = wanted !== '' && rcIsAllowedSlug('parish', wanted);
  const may = listed && !busy && name.trim().length > 0;

  const create = async () => {
    if (!may) return;
    setBusy(true);
    try {
      const created = await rcCreateParish(areaId, wanted, name, location.trim() || undefined);
      setMade({ id: created.parishId ?? '', slug: created.slug ?? wanted, name: created.name ?? name });
    } catch (err) {
      onError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (made === null || busy) return;
    setBusy(true);
    try {
      await rcSaveParishSite(made.id, theme, chosen);
      setMade(null); setName(''); setLocation(''); setSlug('');
      await onDone();
    } catch (err) {
      onError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (module: string) =>
    setChosen((current) =>
      current.includes(module) ? current.filter((m) => m !== module) : [...current, module]);

  // -- Schritt 2 --------------------------------------------------------------

  if (made !== null) {
    return (
      <section className="rc-make" data-step="2">
        <header className="rc-make-head">
          <span className="rc-make-count">{t.stepTwo}</span>
          <h5 className="rc-make-title">{t.lookTitle}</h5>
          <p className="rc-make-lead">{t.lookLead}</p>

          {/* Was im ersten Schritt entschieden wurde, steht weiter da — aber als
              Tatsache, nicht als Feld. Es ist nicht mehr zu aendern. */}
          <p className="rc-make-done">
            <strong>{made.name}</strong> <code>/{made.slug}</code>
          </p>
        </header>

        <div className="rc-make-body">
          <fieldset className="rc-pick">
            <legend>{t.theme}</legend>
            <div className="rc-pick-row">
              {PARISH_THEMES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="rc-swatch"
                  data-theme={option}
                  aria-pressed={theme === option}
                  disabled={busy}
                  onClick={() => setTheme(option)}
                >
                  {t.themes[option]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="rc-pick">
            <legend>{t.modules}</legend>
            <p className="rc-note">{t.modulesLead}</p>
            <div className="rc-pick-grid">
              {PARISH_MODULES.map((module) => (
                <button
                  key={module}
                  type="button"
                  className="rc-tile"
                  aria-pressed={chosen.includes(module)}
                  disabled={busy}
                  onClick={() => toggle(module)}
                >
                  <span className="rc-tile-name">{t.moduleNames[module]}</span>
                  <span className="rc-tile-mark" aria-hidden="true">
                    {chosen.includes(module) ? '✓' : '+'}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <footer className="rc-make-foot">
          <button type="button" className="rc-btn" disabled={busy} onClick={() => void save()}>
            {t.finish}
          </button>
          {/* Ueberspringen ist kein Abbruch: die Pfarrei steht schon. */}
          <button
            type="button"
            className="rc-btn rc-btn-quiet"
            disabled={busy}
            onClick={() => { setMade(null); void onDone(); }}
          >
            {t.later}
          </button>
        </footer>
      </section>
    );
  }

  // -- Schritt 1 --------------------------------------------------------------

  return (
    <form
      className="rc-make"
      data-step="1"
      onSubmit={(e) => { e.preventDefault(); void create(); }}
    >
      <header className="rc-make-head">
        <span className="rc-make-count">{t.stepOne}</span>
        <h5 className="rc-make-title">{t.create}</h5>
        <p className="rc-make-lead">{t.nameLead}</p>
      </header>

      <div className="rc-make-body">
        {areas.length > 1 && (
          <label className="rc-inline-field">
            <span>{rcCopy[lang].chat.areas}</span>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              {areas.map((a) => (
                <option key={a.areaId} value={a.areaId}>{a.title ?? a.areaId.slice(0, 8)}</option>
              ))}
            </select>
          </label>
        )}

        <label className="rc-field">
          <span>{t.name}</span>
          <input type="text" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="rc-field">
          <span>{t.location}</span>
          <input type="text" value={location} disabled={busy} onChange={(e) => setLocation(e.target.value)} />
        </label>

        <label className="rc-field">
          <span>{t.slug}</span>
          <input
            type="text"
            value={slug === '' ? guess : slug}
            disabled={busy}
            spellCheck={false}
            autoCapitalize="none"
            onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
          />
          {/* Die Adresse, wie sie danach dasteht — bevor sie endgueltig ist. */}
          {wanted !== '' && shaped && (
            <span className="rc-make-preview"><code>/parish/{wanted}</code></span>
          )}
        </label>

        {wanted !== '' && !shaped && <p className="rc-auth-error">{t.slugShape}</p>}

        {wanted !== '' && shaped && !listed && (
          <p className="rc-auth-error">
            {t.slugUnknown}
            {known.length > 0 && <> {t.slugAvailable}: {known.join(', ')}.</>}
          </p>
        )}
      </div>

      <footer className="rc-make-foot">
        <button type="submit" className="rc-btn" disabled={!may}>{t.make}</button>
      </footer>
    </form>
  );
}

// -- Eine Pfarrei -------------------------------------------------------------

function RcParishDetail({
  lang, parish, onBack, onError
}: {
  lang: RcLang;
  parish: RcParish;
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].parish;
  const describe = useRcError(lang);

  const [masses, setMasses] = useState<readonly RcMass[]>([]);
  const [intentions, setIntentions] = useState<readonly RcIntention[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [plan, list] = await Promise.all([
        rcMasses(parish.slug),
        rcIntentions(parish.parishId)
      ]);
      setMasses(plan.masses ?? []);
      setIntentions(list.intentions ?? []);
    } catch (e) {
      onError(describe(e));
    }
  }, [parish.slug, parish.parishId, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  const days = useMemo(() => rcMassesByDay(masses, lang), [masses, lang]);

  // Was an keiner Messe hängt, geht sonst unter: eine Intention ohne Termin
  // ist keine Kleinigkeit, sondern etwas, das noch angesetzt werden muss.
  const unassigned = intentions.filter((i) => i.massId === null || i.massId === undefined);

  return (
    <div className="rc-panel">
      <header className="rc-event-head">
        <button type="button" className="rc-link" onClick={onBack}>←</button>
        <h3>{parish.name}</h3>
        <span className="rc-event-meta">{rcPlural(lang, t.intentions, intentions.length)}</span>
      </header>

      <h4 className="rc-chat-h">{t.plan}</h4>

      {days.length === 0 && <p className="rc-note">{t.noMasses}</p>}

      {days.map(([day, ofDay]) => (
        <section key={day} className="rc-mass-day">
          <h5>{day}</h5>
          {ofDay.map((mass) => (
            <RcMassRow
              key={mass.massId}
              lang={lang}
              mass={mass}
              intentions={intentions.filter((i) => i.massId === mass.massId)}
              onError={onError}
              onChanged={refresh}
            />
          ))}
        </section>
      ))}

      {unassigned.length > 0 && (
        <section className="rc-mass-day">
          <h5>{t.unassigned}</h5>
          {unassigned.map((intention) => (
            <RcIntentionRow
              key={intention.intentionId}
              lang={lang}
              intention={intention}
              onError={onError}
              onChanged={refresh}
            />
          ))}
        </section>
      )}

      <RcNewMass lang={lang} parishId={parish.parishId} onDone={refresh} onError={onError} />
      <RcNewIntention
        lang={lang}
        parishId={parish.parishId}
        masses={masses}
        onDone={refresh}
        onError={onError}
      />
    </div>
  );
}

function RcMassRow({
  lang, mass, intentions, onError, onChanged
}: {
  lang: RcLang;
  mass: RcMass;
  intentions: readonly RcIntention[];
  onError: (message: string) => void;
  onChanged: () => Promise<void>;
}) {
  const t = rcCopy[lang].parish;

  return (
    <article className="rc-mass">
      <header className="rc-mass-head">
        <time dateTime={mass.startsUtc}>
          {new Date(mass.startsUtc).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
        </time>
        <span className="rc-mass-church">{mass.church}</span>
        {mass.title !== null && mass.title !== undefined && (
          <span className="rc-mass-title">{mass.title}</span>
        )}
        {mass.isCollective && <span className="rc-mass-coll">{t.collective}</span>}
      </header>

      {/* Der öffentliche Text steht so da, wie er im Schaukasten hängt. Wer
          den Schlüssel hat, sieht darunter zusätzlich, was gemeint ist. */}
      {intentions.map((intention) => (
        <RcIntentionRow
          key={intention.intentionId}
          lang={lang}
          intention={intention}
          onError={onError}
          onChanged={onChanged}
        />
      ))}

      {mass.note !== null && mass.note !== undefined && (
        <p className="rc-mass-note">{mass.note}</p>
      )}
    </article>
  );
}

function RcIntentionRow({
  lang, intention, onError, onChanged
}: {
  lang: RcLang;
  intention: RcIntention;
  onError: (message: string) => void;
  onChanged: () => Promise<void>;
}) {
  const t = rcCopy[lang].parish;
  const describe = useRcError(lang);

  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState(false);

  return (
    <div className="rc-intention">
      <p className="rc-intention-public">{intention.publicText}</p>

      {/* 15.9 — Ein Vermerk, den der Leser nicht öffnen kann, fällt NICHT weg.
          Er steht da, mit dem Grund: sonst hielte der Leser den öffentlichen
          Text für alles, was es gibt. */}
      {rcIntentionSealed(intention) && (
        <p className="rc-intention-sealed">{t.sealedPart}</p>
      )}

      {intention.internalText !== null && intention.internalText !== undefined && (
        <p className="rc-intention-internal">
          <span className="rc-intention-label">{t.internalText}</span>
          {intention.internalText}
        </p>
      )}

      {intention.donorRef !== null && intention.donorRef !== undefined && (
        <p className="rc-intention-donor">
          <span className="rc-intention-label">{t.donor}</span>
          {intention.donorRef}
        </p>
      )}

      {booked ? (
        <p className="rc-note rc-booked">{t.booked}</p>
      ) : (
        <form
          className="rc-offering-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (amount.trim().length === 0 || busy) return;
            setBusy(true);
            try {
              await rcAddOffering(intention.intentionId, amount);
              setAmount('');
              setBooked(true);
              await onChanged();
            } catch (err) {
              onError(describe(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            placeholder={t.amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button type="submit" className="rc-btn rc-btn-quiet" disabled={busy || amount.trim().length === 0}>
            {t.addOffering}
          </button>
        </form>
      )}
    </div>
  );
}

// -- Anlegen ------------------------------------------------------------------

function RcNewMass({
  lang, parishId, onDone, onError
}: {
  lang: RcLang;
  parishId: string;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].parish;
  const describe = useRcError(lang);

  const [when, setWhen] = useState('');
  const [church, setChurch] = useState('');
  const [title, setTitle] = useState('');
  const [collective, setCollective] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="rc-new-event"
      onSubmit={async (e) => {
        e.preventDefault();
        if (when === '' || church.trim().length === 0 || busy) return;
        setBusy(true);
        try {
          await rcAddMass(parishId, new Date(when).toISOString(), church, {
            title: title.trim() || undefined,
            isCollective: collective
          });
          setWhen(''); setTitle('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{t.addMass}</h5>

      <div className="rc-poll-opts">
        <label className="rc-inline-field">
          <span>{t.when}</span>
          <input type="datetime-local" value={when} disabled={busy}
            onChange={(e) => setWhen(e.target.value)} />
        </label>
      </div>

      <label className="rc-field">
        <span>{t.church}</span>
        <input type="text" value={church} disabled={busy} onChange={(e) => setChurch(e.target.value)} />
      </label>

      <label className="rc-field">
        <span>{t.massTitle}</span>
        <input type="text" value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="rc-check">
        <input type="checkbox" checked={collective} disabled={busy}
          onChange={(e) => setCollective(e.target.checked)} />
        <span>{t.collective}</span>
      </label>
      {collective && <p className="rc-note rc-hint">{t.collectiveWhy}</p>}

      <button type="submit" className="rc-btn rc-btn-quiet"
        disabled={busy || when === '' || church.trim().length === 0}>
        {t.addMass}
      </button>
    </form>
  );
}

/**
 * Der Kern der Ansicht: zwei Textfelder, die gleich aussehen und es nicht
 * sind. Unter jedem steht, was mit dem geschieht, was man hineinschreibt.
 */
function RcNewIntention({
  lang, parishId, masses, onDone, onError
}: {
  lang: RcLang;
  parishId: string;
  masses: readonly RcMass[];
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].parish;
  const describe = useRcError(lang);

  const [publicText, setPublicText] = useState('');
  const [internalText, setInternalText] = useState('');
  const [donor, setDonor] = useState('');
  const [massId, setMassId] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="rc-new-intention"
      onSubmit={async (e) => {
        e.preventDefault();
        if (publicText.trim().length === 0 || busy) return;
        setBusy(true);
        try {
          await rcAddIntention(parishId, publicText, {
            internalText: internalText.trim() || undefined,
            donorRef: donor.trim() || undefined,
            massId: massId === '' ? undefined : massId
          });
          setPublicText(''); setInternalText(''); setDonor(''); setMassId('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{t.addIntention}</h5>

      {/* Öffentlich: Klartext, im Schaukasten. */}
      <label className="rc-field rc-field-public">
        <span>{t.publicText}</span>
        <input type="text" value={publicText} disabled={busy}
          onChange={(e) => setPublicText(e.target.value)} />
      </label>
      <p className="rc-note rc-why-public">{t.publicWhy}</p>

      {/* Intern: versiegelt. Beide Erklärungen stehen da — auch die für den
          öffentlichen Fall, denn das ist dieselbe Entscheidung. */}
      <label className="rc-field rc-field-internal">
        <span>{t.internalText}</span>
        <textarea rows={2} value={internalText} disabled={busy}
          onChange={(e) => setInternalText(e.target.value)} />
      </label>

      <label className="rc-field rc-field-internal">
        <span>{t.donor}</span>
        <input type="text" value={donor} disabled={busy} onChange={(e) => setDonor(e.target.value)} />
      </label>
      <p className="rc-note rc-why-internal">{t.internalWhy}</p>

      <label className="rc-inline-field">
        <span>{t.forMass}</span>
        <select value={massId} disabled={busy} onChange={(e) => setMassId(e.target.value)}>
          <option value="">{t.unassigned}</option>
          {masses.map((m) => (
            <option key={m.massId} value={m.massId}>
              {new Date(m.startsUtc).toLocaleString(lang, {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })} · {m.church}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" className="rc-btn" disabled={busy || publicText.trim().length === 0}>
        {t.addIntention}
      </button>
    </form>
  );
}
