/**
 * Veranstaltungen — ansehen, bauen, sich anmelden.
 *
 * Vier Stellen tragen hier eine Entscheidung, und alle vier sind Sätze, die in
 * der Oberfläche stehen und nicht nur im Code:
 *
 *   1. **Öffentlich heisst Klartext, und das steht dabei.** Wer einen Abschnitt
 *      öffentlich macht, soll wissen, dass er unverschlüsselt liegt. Ihn zu
 *      verschlüsseln und den Schlüssel mitzuliefern sähe nach Schutz aus, wo
 *      keiner ist — und das ist schlimmer als sichtbar ungeschützt.
 *
 *   2. **Ein Entwurf ist nicht öffentlich**, und das steht als Warnung da,
 *      nicht als kleiner Zustandsvermerk. Wer eine Seite fertig baut und sie
 *      dann verschickt, soll nicht erst am Telefon erfahren, dass niemand sie
 *      öffnen kann.
 *
 *   3. **Der Beleg wird EINMAL gezeigt, mit dem Grund.** Er ist die einzige
 *      Möglichkeit, eine Anmeldung ohne Konto zurückzunehmen; gespeichert wird
 *      nur sein Abdruck.
 *
 *   4. **Die Datenklasse steht an der Spalte** (12.9) — beim Ansehen der Liste,
 *      nicht erst, wenn jemand sie exportiert hat.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rcCopy, rcFormat, rcPlural, type RcLang } from './i18n';
import type { RcRole } from './lib/rcChat';
import {
  RC_PART_KINDS, rcAddEvent, rcAddPage, rcAddPart, rcEvent, rcEventCollection,
  rcEventCollections,
  rcMissingRequired, rcPublishEvent, rcRegistrations, rcSubmitAsMember, rcSubmitRegistration,
  rcPublishCollection, rcTakesRegistrations, rcWithdrawRegistration,
  type RcEventField, type RcEventPart, type RcEventView, type RcPartKind,
  type RcRegistration
} from './lib/rcEvents';
import type { RcApi } from './lib/rcApi';
import { useRcError } from './RcThreads';
import { RcFoundEvent } from './events/RcFoundEvent';
import { rcIsSlug } from './lib/rcSlugs';
import { rcPath } from './lib/rcRoute';

type RcCollection = RcApi<'RcEventCollectionsResponse'>['collections'][number];
type RcCollectionView = RcApi<'RcEventCollectionViewResponse'>;

// -- Die Übersicht ------------------------------------------------------------

/**
 * Die Uebersicht — SAMMLUNGEN, nicht einzelne Veranstaltungen.
 *
 * <b>Warum diese Ebene ueberhaupt da ist.</b> Vorher stand hier eine flache
 * Liste von Veranstaltungen, und jede trug ihre eigene Adresse, ihr eigenes
 * Amt und ihre eigene Klausel nach RODO. Wer zwei Feste ausrichtete, tippte
 * die Anschrift des Verantwortlichen zweimal — und bekam zwei Verwaltungen
 * fuer denselben Veranstalter.
 *
 * Jetzt liegt oben die Seite des Veranstalters, darin die Feste.
 */
export function RcEventList({
  lang, roles, unlocked, onError
}: {
  lang: RcLang;
  roles: readonly RcRole[];
  unlocked: boolean;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].events;
  const c = t.collection;
  const describe = useRcError(lang);

  const [list, setList] = useState<readonly RcCollection[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!unlocked) return;
    try { setList((await rcEventCollections()).collections ?? []); }
    catch (e) { onError(describe(e)); }
  }, [unlocked, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!unlocked) return <p className="rc-note">{rcCopy[lang].chat.locked}</p>;

  if (open !== null) {
    return (
      <RcCollectionPanel
        lang={lang}
        slug={open}
        roles={roles}
        onBack={() => { setOpen(null); void refresh(); }}
        onError={onError}
      />
    );
  }

  return (
    <div className="rc-panel">
      {list.length === 0 && <p className="rc-note">{c.none}</p>}

      <ul className="rc-event-list">
        {list.map((one) => (
          <li key={one.collectionId} className="rc-event-row" data-state={one.lifecycle}>
            <button type="button" className="rc-event-open" onClick={() => setOpen(one.slug)}>
              <span className="rc-event-title">{one.title}</span>
              <span className="rc-event-meta">
                <code>/{one.slug}</code>
                {' · '}
                {t.states[one.lifecycle] ?? one.lifecycle}
                {' · '}
                {rcPlural(lang, c.events, one.events)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/*
        Das Formular steht immer da. Es haengt an keinem Bereich mehr: der
        Bereich entsteht MIT der Seite, in einem Aufruf, samt Schluesseln und
        Verwaltungsrolle. Vorher hing hier ein Formular, das einen Bereich
        auswaehlen liess und die Klausel nicht kannte — und ohne
        Verantwortlichen und Anschrift darf nichts davon eine Anmeldung
        entgegennehmen.
      */}
      <RcFoundEvent lang={lang} roles={roles} onFounded={() => { void refresh(); }} />
    </div>
  );
}

// -- Eine Sammlung ------------------------------------------------------------

/**
 * Der Katalog einer Seite und das, was man daran tut.
 *
 * <b>Der Verantwortliche steht sichtbar dabei.</b> Er gilt fuer ALLES, was
 * hier drunter Anmeldungen entgegennimmt; wer eine Veranstaltung hinzufuegt,
 * soll wissen, unter wessen Klausel sie sammelt — und nicht erst, wenn jemand
 * danach fragt.
 */
function RcCollectionPanel({
  lang, slug, roles, onBack, onError
}: {
  lang: RcLang;
  slug: string;
  roles: readonly RcRole[];
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].events;
  const c = t.collection;
  const describe = useRcError(lang);

  const [view, setView] = useState<RcCollectionView | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setView(await rcEventCollection(slug)); }
    catch (e) { onError(describe(e)); }
  }, [slug, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (open !== null) {
    return (
      <RcEventDetail
        lang={lang}
        collection={slug}
        slug={open}
        roles={roles}
        onBack={() => { setOpen(null); void refresh(); }}
        onError={onError}
      />
    );
  }

  if (view === null) return <p className="rc-note">{rcCopy[lang].chat.loading}</p>;

  const events = view.events ?? [];

  return (
    <div className="rc-panel">
      <header className="rc-event-head">
        <button type="button" className="rc-link" onClick={onBack}>←</button>
        <h3>{view.title}</h3>
        <span className="rc-event-state" data-state={view.lifecycle}>
          {t.states[view.lifecycle] ?? view.lifecycle}
        </span>
      </header>

      <p className="rc-note">
        <code>/{view.slug}</code>
        {view.organizerName !== null && view.organizerName !== undefined && (
          <>{' · '}{c.organizer}: {view.organizerName}</>
        )}
      </p>

      {/* Ein Entwurf ist nicht oeffentlich — als Warnung, nicht als Vermerk. */}
      {view.lifecycle === 'draft' && view.mayRead && (
        <div className="rc-draft-warning">
          <p>{t.draftWarning}</p>
          <button
            type="button"
            className="rc-btn"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void rcPublishCollection(view.collectionId)
                .then(refresh)
                .catch((e) => onError(describe(e)))
                .finally(() => setBusy(false));
            }}
          >
            {t.publish}
          </button>
        </div>
      )}

      {events.length === 0 && (
        <p className="rc-note">{view.mayRead ? c.empty : c.emptyPublic}</p>
      )}

      <ul className="rc-event-list">
        {events.map((one) => (
          <li key={one.eventId} className="rc-event-row" data-state={one.lifecycle}>
            <button type="button" className="rc-event-open" onClick={() => setOpen(one.slug)}>
              <span className="rc-event-title">{one.title}</span>
              <span className="rc-event-meta">
                <code>/{view.slug}/{one.slug}</code>
                {' · '}
                {t.states[one.lifecycle] ?? one.lifecycle}
                {' · '}
                {rcPlural(lang, t.pages, one.pages)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {view.mayRead && (
        <RcAddEvent
          lang={lang}
          collectionId={view.collectionId}
          taken={events.map((one) => one.slug)}
          onAdded={refresh}
          onError={onError}
        />
      )}
    </div>
  );
}

/**
 * Eine Veranstaltung in die Sammlung stellen.
 *
 * <b>Nach dem Verantwortlichen wird hier NICHT gefragt.</b> Er steht an der
 * Sammlung und gilt fuer alles darunter — ihn je Fest zu erfragen hiesse,
 * dieselbe Auskunft an zwei Stellen zu fuehren, und irgendwann widersprechen
 * sich die beiden.
 *
 * <b>Der schon vergebene Name faellt beim Tippen auf</b>, nicht erst nach dem
 * Absenden. Der Server weist ihn ohnehin ab; die Schranke ist dort, hier steht
 * die Freundlichkeit.
 */
function RcAddEvent({
  lang, collectionId, taken, onAdded, onError
}: {
  lang: RcLang;
  collectionId: string;
  taken: readonly string[];
  onAdded: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].events;
  const c = t.collection;
  const describe = useRcError(lang);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);

  const clash = slug !== '' && taken.includes(slug);
  const shape = slug === '' || rcIsSlug(slug);
  const ready = !busy && title.trim() !== '' && slug !== '' && shape && !clash;

  return (
    <form
      className="rc-new-event"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return;
        setBusy(true);
        try {
          await rcAddEvent(collectionId, { slug, title: title.trim() });
          setTitle(''); setSlug('');
          await onAdded();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{c.addEvent}</h5>

      <label className="rc-field">
        <span>{t.eventTitle}</span>
        <input type="text" value={title} maxLength={200} disabled={busy}
          onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="rc-field">
        <span>{t.address}</span>
        <input type="text" value={slug} maxLength={48} disabled={busy}
          onChange={(e) => setSlug(e.target.value.toLowerCase())} />
      </label>

      {!shape && <p className="ap-error">{t.found.slugBad}</p>}
      {clash && <p className="ap-error">{t.found.taken}</p>}
      <p className="rc-note rc-hint">{t.addressHint}</p>

      <button type="submit" className="rc-btn" disabled={!ready}>
        {busy ? c.adding : c.add}
      </button>
    </form>
  );
}

// -- Eine Veranstaltung -------------------------------------------------------

export function RcEventDetail({
  lang, collection, slug, roles, onBack, onError
}: {
  lang: RcLang;
  /** Die Sammlung. Ohne sie ist der Name der Veranstaltung nicht eindeutig. */
  collection: string;
  slug: string;
  roles: readonly RcRole[];
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].events;
  const describe = useRcError(lang);

  const [view, setView] = useState<RcEventView | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setView(await rcEvent(collection, slug)); }
    catch (e) { onError(describe(e)); }
  }, [collection, slug, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  const role = useMemo(() => roles.find((r) => r.hasKey) ?? roles[0], [roles]);

  if (view === null) return <p className="rc-note">{rcCopy[lang].chat.loading}</p>;

  return (
    <div className="rc-panel">
      <header className="rc-event-head">
        <button type="button" className="rc-link" onClick={onBack}>←</button>
        <h3>{view.title}</h3>
        <span className="rc-event-state" data-state={view.lifecycle}>
          {t.states[view.lifecycle] ?? view.lifecycle}
        </span>
      </header>

      {/*
        DER HERAUSGEBER STEHT NICHT HIER, SONDERN UNTER EIGENER ADRESSE.

        Er stand einmal als Block an dieser Stelle, und das hatte zwei Kosten:
        wer daran arbeitete, konnte niemandem sagen WO — die Werkstattliste hat
        keine Adresse je Veranstaltung —, und dieselbe Ansicht haette es zweimal
        gegeben, sobald die oeffentliche Seite ihren eigenen Weg hinein bekam.
      */}
      {view.mayRead && (
        <p className="rc-note">
          <a className="rc-btn" href={rcPath('event', collection, slug, 'edit')}>
            Otwórz edytor
          </a>
        </p>
      )}

      {/* Ein Entwurf ist nicht öffentlich. Das gehört als Warnung hierher und
          nicht in einen kleinen Zustandsvermerk: wer die Seite fertig baut und
          verschickt, soll nicht am Telefon erfahren, dass niemand sie öffnet. */}
      {view.lifecycle === 'draft' && view.mayRead && (
        <div className="rc-draft-warning">
          <p>{t.draftWarning}</p>
          <button
            type="button"
            className="rc-btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await rcPublishEvent(view.eventId); await refresh(); }
              catch (e) { onError(describe(e)); }
              finally { setBusy(false); }
            }}
          >
            {t.publish}
          </button>
        </div>
      )}

      {/* 15.9 — Wer nur den öffentlichen Teil sieht, soll das WISSEN. Sonst
          hält er das Bruchstück für das Ganze. */}
      {!view.mayRead && <p className="rc-note rc-only-public">{t.onlyPublic}</p>}

      {view.pages.map((page) => (
        <section key={page.pageId} className="rc-event-page">
          <h4>{page.title}</h4>

          {page.parts.map((part) => (
            <RcPart
              key={part.partId}
              lang={lang}
              part={part}
              view={view}
              role={view.mayRead ? role : undefined}
              onChanged={refresh}
              onError={onError}
            />
          ))}

          {view.mayRead && (
            <RcNewPart lang={lang} pageId={page.pageId} onDone={refresh} onError={onError} />
          )}
        </section>
      ))}

      {view.mayRead && (
        <RcNewPage lang={lang} eventId={view.eventId} onDone={refresh} onError={onError} />
      )}
    </div>
  );
}

function RcPart({
  lang, part, view, role, onChanged, onError
}: {
  lang: RcLang;
  part: RcEventPart;
  view: RcEventView;
  role: RcRole | undefined;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].events;

  // 15.9 — Ein interner Abschnitt, den der Leser nicht öffnen kann, fällt NICHT
  // weg. Er steht da, mit dem Grund.
  if (part.unreadable !== null && part.unreadable !== undefined) {
    return (
      <article className="rc-part rc-part-sealed">
        <span className="rc-part-kind">{t.partKinds[part.kind] ?? part.kind}</span>
        <p>{t.sealedFor}</p>
      </article>
    );
  }

  return (
    <article className="rc-part" data-public={part.isPublic}>
      <header className="rc-part-head">
        <span className="rc-part-kind">{t.partKinds[part.kind] ?? part.kind}</span>
        {!part.isPublic && <span className="rc-part-lock">{t.isInternal}</span>}
      </header>

      {part.title !== null && part.title !== undefined && <h5>{part.title}</h5>}
      {part.intro !== null && part.intro !== undefined && <p className="rc-part-intro">{part.intro}</p>}

      {part.kind === 'form' && (
        <RcForm
          lang={lang}
          part={part}
          view={view}
          role={role}
          onChanged={onChanged}
          onError={onError}
        />
      )}
    </article>
  );
}

// -- Das Formular -------------------------------------------------------------

function RcForm({
  lang, part, view, role, onChanged, onError
}: {
  lang: RcLang;
  part: RcEventPart;
  view: RcEventView;
  role: RcRole | undefined;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].events;
  const describe = useRcError(lang);

  const [answers, setAnswers] = useState<ReadonlyMap<string, string>>(new Map());
  const [claim, setClaim] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (fieldId: string, value: string) =>
    setAnswers((now) => new Map(now).set(fieldId, value));

  const missing = rcMissingRequired(part.fields, answers);
  const takes = rcTakesRegistrations(view);

  if (done) {
    return (
      <div className="rc-registered">
        <strong>{t.registered}</strong>

        {/* Der Beleg, einmal — mit dem Grund daneben. Ohne ihn sieht die
            Einmaligkeit wie eine Schikane aus statt wie die Zusage, die sie
            ist. */}
        {claim !== null && (
          <>
            <p className="rc-note">{t.keepClaim}</p>
            <code className="rc-secret">{claim}</code>
            <p className="rc-note">{t.claimWhy}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <form
        className="rc-event-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || missing.length > 0 || !takes) return;
          setBusy(true);
          try {
            // Zwei Wege. Mitglieder schicken Klartext über TLS und der Server
            // versiegelt unter dem Epochenschlüssel; wer kein Konto hat,
            // versiegelt HIER und der Server sieht nur Geheimtext.
            if (role !== undefined && view.mayRead) {
              await rcSubmitAsMember(part.partId, role.roleId, answers);
              setClaim(null);
            } else {
              const sent = await rcSubmitRegistration(
                part.partId, crypto.randomUUID(), view.intakePublicKey!, answers);
              setClaim(sent.claim ?? null);
            }
            setDone(true);
            await onChanged();
          } catch (err) {
            onError(describe(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {part.fields.map((field) => (
          <RcFormField
            key={field.fieldId}
            lang={lang}
            field={field}
            value={answers.get(field.fieldId) ?? ''}
            onChange={(v) => set(field.fieldId, v)}
            disabled={busy || !takes}
          />
        ))}

        {!takes && <p className="rc-note rc-not-yet">{t.notYet}</p>}

        {/* Was noch fehlt, steht VOR dem Absenden da — nicht danach als
            Absage. Die Regel gilt trotzdem im Dienst. */}
        {takes && missing.length > 0 && (
          <p className="rc-note">
            {rcFormat(t.missing, { what: missing.map((f) => f.label).join(', ') })}
          </p>
        )}

        <button type="submit" className="rc-btn" disabled={busy || !takes || missing.length > 0}>
          {busy ? t.registering : t.register}
        </button>
      </form>

      {view.mayRead && (
        <RcRegistrationList lang={lang} partId={part.partId} onError={onError} />
      )}
    </>
  );
}

function RcFormField({
  lang, field, value, onChange, disabled
}: {
  lang: RcLang;
  field: RcEventField;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const t = rcCopy[lang].events;

  const label = (
    <span>
      {field.label}
      {field.isRequired && <span aria-hidden="true"> *</span>}
      {/* 12.9 — Wer etwas Besonderes eingibt, soll das beim Eintippen sehen
          und nicht in einer Datenschutzerklärung nachlesen müssen. */}
      {(field.dataClass === 'special' || field.dataClass === 'secret') && (
        <span className="rc-class-tag" data-class={field.dataClass}>
          {t.classes[field.dataClass] ?? field.dataClass}
        </span>
      )}
    </span>
  );

  return (
    <label className="rc-field" data-half={field.isHalfWidth}>
      {label}

      {field.kind === 'textarea' ? (
        <textarea rows={3} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      ) : field.kind === 'select' ? (
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="" />
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.kind === 'checkbox' ? (
        <input
          type="checkbox"
          checked={value === 'ja'}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? 'ja' : '')}
        />
      ) : (
        <input
          type={field.kind === 'number' ? 'number'
            : field.kind === 'date' ? 'date'
            : field.kind === 'email' ? 'email'
            : field.kind === 'phone' ? 'tel'
            : 'text'}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.helpText !== null && field.helpText !== undefined && (
        <span className="rc-field-help">{field.helpText}</span>
      )}
    </label>
  );
}

function RcRegistrationList({
  lang, partId, onError
}: {
  lang: RcLang;
  partId: string;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].events;
  const describe = useRcError(lang);

  const [list, setList] = useState<readonly RcRegistration[]>([]);

  const refresh = useCallback(async () => {
    try { setList((await rcRegistrations(partId)).registrations ?? []); }
    catch (e) { onError(describe(e)); }
  }, [partId, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (list.length === 0) return null;

  return (
    <div className="rc-registrations">
      <h6 className="rc-chat-h">{rcPlural(lang, t.registrations, list.length)}</h6>

      <ul>
        {list.map((entry) => (
          <li key={entry.registrationId} data-withdrawn={entry.withdrawn}>
            {entry.unreadable !== null && entry.unreadable !== undefined ? (
              <span className="rc-reg-sealed">{t.sealedFor}</span>
            ) : (
              <dl className="rc-reg-answers">
                {entry.answers.map((a) => (
                  <div key={a.fieldId}>
                    <dt>
                      {a.label}
                      {/* Die Klasse steht an der SPALTE — beim Ansehen, nicht
                          erst, wenn jemand die Liste exportiert hat. */}
                      {(a.dataClass === 'special' || a.dataClass === 'secret') && (
                        <span className="rc-class-tag" data-class={a.dataClass}>
                          {t.classes[a.dataClass] ?? a.dataClass}
                        </span>
                      )}
                    </dt>
                    <dd>{a.value ?? <em>{t.withdrawn}</em>}</dd>
                  </div>
                ))}
              </dl>
            )}

            <time dateTime={entry.submittedUtc}>
              {new Date(entry.submittedUtc).toLocaleString(lang)}
            </time>

            {!entry.withdrawn && (
              <button
                type="button"
                className="rc-msg-action"
                onClick={async () => {
                  try { await rcWithdrawRegistration(entry.registrationId); await refresh(); }
                  catch (e) { onError(describe(e)); }
                }}
              >
                {t.withdraw}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// -- Bauen --------------------------------------------------------------------

function RcNewPage({
  lang, eventId, onDone, onError
}: {
  lang: RcLang;
  eventId: string;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].events;
  const describe = useRcError(lang);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="rc-new-page"
      onSubmit={async (e) => {
        e.preventDefault();
        if (title.trim().length === 0 || busy) return;
        setBusy(true);
        try {
          const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          await rcAddPage(eventId, slug, title);
          setTitle('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="rc-field">
        <span>{t.newPage}</span>
        <input type="text" value={title} placeholder={t.pageTitle} disabled={busy}
          onChange={(e) => setTitle(e.target.value)} />
      </label>
      <button type="submit" className="rc-btn rc-btn-quiet" disabled={busy || title.trim().length === 0}>
        {t.newPage}
      </button>
    </form>
  );
}

function RcNewPart({
  lang, pageId, onDone, onError
}: {
  lang: RcLang;
  pageId: string;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].events;
  const describe = useRcError(lang);

  const [kind, setKind] = useState<RcPartKind>('text');
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="rc-new-part"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
          await rcAddPart(pageId, kind, { isPublic, title: title.trim() || undefined });
          setTitle('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="rc-poll-opts">
        <label className="rc-inline-field">
          <span>{t.addPart}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as RcPartKind)}>
            {RC_PART_KINDS.map((k) => (
              <option key={k} value={k}>{t.partKinds[k] ?? k}</option>
            ))}
          </select>
        </label>

        <label className="rc-inline-field">
          <span>{t.visibility}</span>
          <select value={isPublic ? 'public' : 'internal'}
            onChange={(e) => setIsPublic(e.target.value === 'public')}>
            <option value="public">{t.isPublic}</option>
            <option value="internal">{t.isInternal}</option>
          </select>
        </label>
      </div>

      <label className="rc-field">
        <span>{rcCopy[lang].events.eventTitle}</span>
        <input type="text" value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
      </label>

      {/* Was die Wahl bedeutet, steht DA — beide Fälle, nicht nur der
          ungewöhnliche. Wer öffentlich wählt, trifft dieselbe Entscheidung. */}
      <p className="rc-note rc-visibility-why">
        {isPublic ? t.publicWhy : t.internalWhy}
      </p>

      <button type="submit" className="rc-btn rc-btn-quiet" disabled={busy}>
        {t.addPart}
      </button>
    </form>
  );
}
