/**
 * Die Liste der Menschen eines Formulars und die Tafel eines Menschen (auch auf einer Seite: `EntryDeskPanel`).
 */

import { useState } from 'react';

import type { AreaRow } from '../areas/area';
import type { Ring } from '../core/keys';
import { WorkspaceError } from '../core/session';
import { formPath } from '../routes';
import { checkText } from '../seats/seatCheck';
import { PersonSteps } from '../steps/StepList';
import { bookingTagClass, bookingTags, progressOf } from '../steps/steps';
import { askText } from '../ui/dialogs';
import { type DeskRow, type EntryDesk, type Numbered, PANEL_SECTIONS, type PanelSection, STEP_CHOICES, type StepInfo, deskChanged, deskRows, formAreasOf, seatAreasOf, stepKindsOf, stepMatches } from './entryDesk';
import { ExtensionEntry } from './ExtensionSheet';
import { PersonAreas } from './PersonAreas';
import { type OpenField, consentGiven, consentText } from './form';
import { type Submission, hideSubmission, removeSubmission } from './submissions';
import { type ValueCheck, armCheck } from './valueCheck';
import { type SeatLinks, SendPanel, WriteToSeat, base, checkOf, holesOf, useSeatLinks } from './FormLinks';
import type { ReadForm } from './formRead';
import { SmsPanel } from './FormSms';
import { repeatOf, roundLabel, roundOf } from './rounds';
import { SignSheetButton } from './SignSheet';
import { LINK, VERIFY, renderSms, smsHref, templatesOf, usesHole } from './sms';
import { smsInApp } from '../phone/here';

/**
 * Wer sich eingetragen hat — EINE Zeile je Mensch, alles Weitere auf Abruf.
 *
 * <b>Nach dem Vorbild des Altbestands</b> (`events/parts/RosterPart.tsx`):
 * eine Zeile ist ein Name und seine Nummern — die Dinge, nach denen man am Tag
 * selbst greift —, dazu, woran der Mensch gerade ist. Alles andere liegt
 * hinter „Więcej": die Antworten, der Link, Ukryj und Usuń.
 *
 * <b>„Napisz SMS" schaltet die Liste um</b>, wie dort: die Nachricht wird
 * EINMAL geschrieben (oder aus einem Szablon genommen), und neben jeder Nummer
 * steht ein SMS-Knopf. Ein Tipp öffnet das Nachrichtenfenster mit fertigem
 * Text für genau diesen Menschen, und der Knopf bekommt sein Häkchen — wer
 * vierzig Namen abarbeitet, muss sehen, wo er war.
 *
 * <b>Der Link entsteht von selbst.</b> Jeder Platz trägt seinen Link
 * versiegelt für die Kanzlei (0046); fehlt er, oder soll der Link beim ersten
 * Öffnen fragen und tut es noch nicht, entsteht beim Tipp ein neuer.
 */
export function People({
  partId, config, onConfig, newSince = null, submissions, opened, fields, removed = [], seatAreas, formAreas, areas, stepInfo, extData, ring, busy,
  onHide, onRemove, onError, onChanged
}: {
  partId: string;

  /** Die Einstellungen des Bausteins — darin die gespeicherten Szablony. */
  config: Record<string, string>;
  onConfig: (next: Record<string, string>) => void;

  /** 0090 — was danach kam, war für dieses Konto neu, als die Liste aufging. `null`: weiss niemand. */
  newSince?: string | null;

  submissions: readonly Submission[];
  opened: ReadonlyMap<string, ReadonlyMap<string, string>>;
  fields: readonly OpenField[];

  /** 0086 — die vom Formular genommenen Fragen: ihre Antworten stehen beim Menschen dabei. */
  removed?: readonly OpenField[];

  /** Die Bereiche, in denen die Plätze dieses Formulars liegen. */
  seatAreas: readonly string[];

  /** 0080 — die Bereiche des Formulars selbst (sein eigener, dann die seiner Fragen) — und alle, die ich sehe. */
  formAreas: readonly (string | null)[];
  areas: readonly AreaRow[];

  /** Die Schritte und Erweiterungen (0047) — `null`: noch nicht geladen. */
  stepInfo: StepInfo | null;

  /** Was jede Erweiterung über diese Menschen weiss (0047). */
  extData: ReadonlyMap<string, ReadForm>;

  ring: Ring | null;
  busy: boolean;
  onHide: (s: Submission) => void;
  onRemove: (s: Submission) => void;
  onError: (message: string | null) => void;
  onChanged: () => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  /* „Napisz SMS": `null` heisst aus. Der Text gilt nur für diesen Durchgang. */
  const [smsText, setSmsText] = useState<string | null>(null);

  /** Welche Nummern in diesem Durchgang schon geöffnet wurden — „Zgłoszenie|Nummer". */
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());

  /** Die Bestätigungslinks (`{weryfikacja}`, 0030) — einer je Nummer, und ein zweiter Tipp würfelt nicht neu. */
  const [verifyLinks, setVerifyLinks] = useState<ReadonlyMap<string, string>>(new Map());

  /** Welche Nummer gerade vorbereitet wird. */
  const [working, setWorking] = useState<string | null>(null);

  const links = useSeatLinks(seatAreas, ring, { under: (config.portalUnder ?? '').trim(), at: (config.portalAt ?? '').trim() });

  /*
   * NACH SCHRITTEN FILTERN (0047) — „wer hat die Zustimmung noch nicht
   * gebracht". Die Liste zeigt dann nur sie, und „Napisz SMS" schreibt nur
   * ihnen: das Filtern ist der erste Schritt jeder Erinnerung.
   */
  const [stepFilter, setStepFilter] = useState('');

  /* 0090 — nur die neuen zeigen. */
  const [onlyNew, setOnlyNew] = useState(false);

  /* 0082 — dieselben Zeilen, dieselbe Reihenfolge und derselbe Filter wie auf den Seiten „Lista osób" und „Panel osoby" (`entryDesk.ts`). */
  const everyone = deskRows({ registrations: submissions, opened, fields }, stepInfo);

  /* Welche Schritte es gibt — aus der ersten Zeile, die welche hat (alle haben dieselben, bis auf den Link). */
  const stepKinds = stepKindsOf(everyone);

  /* 0090 — neu: nach der Marke von vorhin eingesandt, von einem Menschen (was die Kanzlei selbst einträgt, ist für sie nichts Neues). */
  const after = newSince === null ? Number.NaN : Date.parse(newSince);
  const isNew = (s: Submission): boolean => !Number.isNaN(after) && Date.parse(s.submittedAt) > after && s.byOffice !== true && !s.hidden && s.withdrawnAt === null;
  const freshCount = everyone.filter((r) => isNew(r.s)).length;

  const rows = everyone.filter((r) => stepMatches(stepFilter, r.states) && (!onlyNew || freshCount === 0 || isNew(r.s)));

  if (everyone.length === 0) return <p className="wk-empty">Nikt się jeszcze nie zapisał.</p>;

  const templates = templatesOf(config);

  /**
   * EIN TIPP AUF „SMS" — und die Nachricht steht fertig im Telefon.
   *
   * <b>Der Link wird dabei geholt oder gemacht</b>, nicht beim Aufschlagen:
   * einen neuen zu würfeln macht den vorigen ungültig, und das darf nur
   * geschehen, wenn er gleich darauf verschickt wird.
   */
  const write = async (s: Submission, one: Numbered) => {
    if (smsText === null) return;

    const key = `${s.registrationId}|${one.dial}`;
    const values = opened.get(s.registrationId);
    const filled = holesOf(values, fields);

    setWorking(key);
    onError(null);

    try {
      let link: string | null = null;

      if (usesHole(smsText, LINK) && s.seatId !== null) {
        link = await links.forSms(s.seatId, checkOf(values, fields));
      }

      if (usesHole(smsText, VERIFY) && !one.orphan) {
        let verify = verifyLinks.get(key) ?? null;

        if (verify === null) {
          const { token } = await armCheck(s.registrationId, one.fieldId);
          verify = `${base()}#/verify/${encodeURIComponent(token)}`;
          const armed = verify;
          setVerifyLinks((was) => new Map(was).set(key, armed));
        }

        filled.set(VERIFY, verify);
      }

      setSent((was) => new Set(was).add(key));
      /* In der Ausgabe „sms" ein Blatt, das gleich sendet — die Liste bleibt stehen. */
      const body = renderSms(smsText, filled, link);
      if (!smsInApp(one.dial, body)) window.location.href = smsHref(one.dial, body);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się przygotować wiadomości.');
    } finally {
      setWorking(null);
    }
  };

  /* Was die Kanzlei VOR dem Abarbeiten wissen muss. */
  const withoutSeat = rows.filter((r) => r.s.seatId === null).length;
  const willRenew = rows.filter((r) => {
    if (r.s.seatId === null) return false;
    const row = links.rows.get(r.s.seatId);
    if (row === undefined || row.revokedAt !== null) return false;

    const wantsQuestion = checkOf(r.values, fields).some((c) => checkText(c.kind, c.value) !== '');
    return row.linkSealed === null || row.locked || (wantsQuestion && !row.asks);
  }).length;

  /* Die Vorschau gilt dem ersten Menschen, den die Liste gerade zeigt — ein Filter kann sie leeren. */
  const first = rows.length > 0 ? rows[0] : undefined;

  return (
    <section className="wk-panel">
      <div className="wk-sms-bar">
        <h3 className="wk-h2">Osoby ({rows.length === everyone.length ? rows.length : `${rows.length} z ${everyone.length}`})</h3>

        <div className="wk-people-filters">
          {freshCount > 0 && (
            <button type="button" className="ui-filter is-new" aria-pressed={onlyNew}
              title="Zgłoszenia, które przyszły od Twojego poprzedniego przeglądania" onClick={() => setOnlyNew((was) => !was)}>
              nowe: {freshCount}
            </button>
          )}

          {stepKinds.length > 0 && (
            <select className="wk-step-filter" value={stepFilter} onChange={(e) => setStepFilter(e.target.value)} aria-label="Pokaż osoby">
              {STEP_CHOICES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              {/* Je Schritt beide Richtungen — bei „Wybierz termin": ma termin / bez terminu / już był … */}
              {stepKinds.map((k) => (
                <optgroup key={k.key} label={k.label}>
                  {k.options.map(([value, short]) => <option key={value} value={value}>{short}</option>)}
                </optgroup>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          className={smsText === null ? 'wk-btn wk-btn-line wk-btn-small' : 'wk-btn wk-btn-small'}
          aria-expanded={smsText !== null}
          onClick={() => {
            const on = smsText === null;
            setSmsText(on ? (templates[0]?.text ?? '') : null);
            setSent(new Set());

            /* Die Links, die schon bereitliegen, gleich aufmachen — dann wartet der Tipp auf nichts. */
            if (on) links.warm(rows.flatMap((r) => (r.s.seatId === null ? [] : [r.s.seatId])));
          }}
        >
          {smsText === null ? 'Napisz SMS' : 'Zakończ pisanie'}
        </button>
      </div>

      {smsText !== null && (
        <SmsPanel
          partId={partId}
          config={config}
          text={smsText}
          onText={setSmsText}
          onConfig={onConfig}
          fields={fields}
          hasPhones={fields.some((f) => f.kind === 'phone')}
          preview={smsText.trim() === '' || first === undefined ? null : renderSms(smsText, holesOf(first.values, fields), '…link…')}
          previewName={first?.name ?? ''}
          withoutSeat={withoutSeat}
          willRenew={willRenew}
          sentCount={sent.size}
          onForget={() => setSent(new Set())}
          onError={onError}
        />
      )}

      {rows.length === 0 && <p className="wk-empty">Nikt nie pasuje do tego filtra.</p>}

      <ul className="wk-entry-list">
        {rows.map(({ s, values, name, phones, states }) => {
          const open = openId === s.registrationId;
          const progress = progressOf(states);
          const bySms = s.checks.some((c) => c.verifiedAt !== null && c.origin === 'sms');
          const seat = s.seatId === null ? undefined : links.rows.get(s.seatId);

          return (
            <li key={s.registrationId} className={s.hidden || s.withdrawnAt !== null ? 'wk-entry is-muted' : 'wk-entry'}>
              <div className="wk-entry-head">
                <strong className="wk-entry-name">{name}</strong>
                {isNew(s) && <span className="wk-tag wk-tag-new">nowe</span>}

                {/*
                  JEDE NUMMER EIN ANRUF — und im SMS-Durchgang daneben ihr
                  Knopf, mit Häkchen, sobald er einmal getippt wurde.
                */}
                <span className="wk-entry-phones">
                  {phones.length === 0 ? (
                    <span className="wk-hint">{values === undefined ? '' : 'brak telefonu'}</span>
                  ) : phones.map((one) => {
                    const key = `${s.registrationId}|${one.dial}`;
                    const done = sent.has(key);

                    return (
                      <span className="wk-entry-phone-one" key={key}>
                        <a className="wk-entry-phone" href={`tel:${one.dial}`}>{one.shown}</a>
                        {smsText !== null && (
                          <button
                            type="button"
                            className={done ? 'wk-sms-go is-sent' : 'wk-sms-go'}
                            disabled={working !== null || smsText.trim() === '' || s.withdrawnAt !== null}
                            aria-label={done ? `SMS na ${one.shown} — już otwarty w tym przejściu` : `SMS na ${one.shown}`}
                            onClick={() => void write(s, one)}
                          >
                            {working === key ? '…' : 'SMS'}{done ? ' ✓' : ''}
                          </button>
                        )}
                      </span>
                    );
                  })}
                </span>

                <span className="wk-tags">
                  {s.hidden && <span className="wk-tag">ukryte</span>}
                  {s.withdrawnAt !== null && <span className="wk-tag">wycofane</span>}
                  {s.seatId === null && <span className="wk-tag">bez linku</span>}
                  {seat !== undefined && seat.revokedAt !== null && <span className="wk-tag">link wycofany</span>}
                  {seat?.locked === true && <span className="wk-tag">link zablokowany</span>}
                  {seat !== undefined && seat.asks && seat.verifiedAt === null && !seat.locked && seat.revokedAt === null && (
                    <span className="wk-tag" title="Link czeka, aż ktoś otworzy go pierwszy raz i odpowie na pytanie">
                      link nieotwarty
                    </span>
                  )}
                  {s.confirmedAt !== null && (
                    <span className="wk-tag wk-tag-open" title={`Potwierdzone ${new Date(s.confirmedAt).toLocaleDateString('pl-PL')}`}>
                      dane potwierdzone
                    </span>
                  )}
                  {bySms && <span className="wk-tag wk-tag-open">numer potwierdzony SMS-em</span>}
                  {progress.total > 0 && (
                    <span
                      className={progress.done === progress.total ? 'wk-tag wk-tag-open' : 'wk-tag'}
                      title={states.filter((st) => st.status !== 'done').map((st) => st.label).join(', ') || 'Wszystko zrobione'}
                    >
                      postęp {progress.done}/{progress.total}{progress.overdue > 0 ? ' · po terminie!' : ''}
                    </span>
                  )}
                  {/* „Wybierz termin": der Termin selbst — oder dass keiner gewählt ist. */}
                  {bookingTags(states).map((tag) => (
                    <span key={tag.key} className={bookingTagClass(tag)} title={tag.title} data-booking-tag={tag.state}>{tag.text}</span>
                  ))}
                </span>

                <button
                  type="button" className="wk-link-btn wk-entry-more" aria-expanded={open}
                  onClick={() => setOpenId(open ? null : s.registrationId)}
                >
                  {open ? 'Mniej' : 'Więcej'}
                </button>
              </div>

              {open && (
                <div className="wk-entry-body">
                  <EntryPanel
                    formId={partId}
                    row={{ s, values, name, phones, states }}
                    fields={fields}
                    removed={removed}
                    stepInfo={stepInfo}
                    extData={extData}
                    links={links}
                    formAreas={formAreas}
                    areas={areas}
                    ring={ring}
                    busy={busy}
                    onHide={onHide}
                    onRemove={onRemove}
                    onError={onError}
                    onChanged={onChanged}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * 0082 — EIN MENSCH, mit allem, was die Kanzlei zu ihm hat: seine Antworten,
 * seine Schritte, was er ergänzt hat, sein Link, die Rozmowa mit ihm.
 *
 * <b>Dasselbe an zwei Stellen.</b> In „Osoby" klappt es unter einer Zeile
 * auf; auf einer Seite mit „Wybór na stronie" steht es als Baustein „Panel
 * osoby" — für den Menschen, der oben gewählt ist. Dort lässt es sich auch in
 * Stücke teilen (`sections`): die Antworten in einer Kachel, die Schritte in
 * einer anderen.
 */
function EntryPanel({
  formId, row, fields, removed = [], stepInfo, extData, links, formAreas, areas, ring, busy, sections = PANEL_SECTIONS,
  onHide, onRemove, onError, onChanged
}: {
  /** 0083 — welches Formular (für den Ausdruck zum Unterschreiben). */
  formId: string;
  row: DeskRow;
  fields: readonly OpenField[];

  /** 0086 — die vom Formular genommenen Fragen, deren Antworten noch dastehen. */
  removed?: readonly OpenField[];
  stepInfo: StepInfo | null;
  extData: ReadonlyMap<string, ReadForm>;
  links: SeatLinks;
  formAreas: readonly (string | null)[];
  areas: readonly AreaRow[];
  ring: Ring | null;
  busy: boolean;
  sections?: readonly PanelSection[];
  onHide: (s: Submission) => void;
  onRemove: (s: Submission) => void;
  onError: (message: string | null) => void;
  onChanged: () => Promise<void>;
}) {
  const { s, values, name, states } = row;
  const on = new Set(sections);

  return (
    <>
      {on.has('answers') && (
        <>
          <p className="wk-hint">
            Wysłano {new Date(s.submittedAt).toLocaleString('pl-PL')}
            {s.confirmedAt !== null && ` · dane potwierdzone przez osobę ${new Date(s.confirmedAt).toLocaleString('pl-PL')}`}
          </p>
          <Answers values={values} fields={removed.length === 0 ? fields : [...fields, ...removed]} sealed={s.values.length} checks={s.checks} />
          {/* 0083 — auch die Kanzlei druckt das Blatt (für den, der seines vergessen hat). */}
          {values !== undefined && values.size > 0 && (
            <div className="wk-actions">
              <SignSheetButton formId={formId} values={values} submittedAt={s.submittedAt} when="ruled" className="wk-link-btn" />
            </div>
          )}
        </>
      )}

      {on.has('steps') && (
        <>
          {/* WAS NOCH ZU TUN IST (0047) — und hier abhaken, was die Kanzlei abhakt. */}
          <PersonSteps registrationId={s.registrationId} states={states} onChanged={onChanged} onError={onError} />
        </>
      )}

      {on.has('extensions') && (
        <>
          {/*
            DIE ERWEITERUNGEN (0047) — was der Mensch ergänzt hat, und
            was der Koordinator zu ihm notiert. Das Zweite schreibt er
            gleich hier.
          */}
          {(stepInfo?.extensions ?? []).map((ext) => {
            const data = extData.get(ext.moduleId);
            const repeat = repeatOf(ext.repeat);
            const round = roundOf(repeat);

            return (
              <section key={ext.moduleId} className="wk-ext-entry">
                <h4 className="wk-h3">
                  {ext.name}
                  <span className="wk-row-side">
                    {ext.audience === 'office' ? ' · tylko koordynator' : ' · uzupełnia osoba'}
                    {/* 0077 — hier steht der LAUFENDE Zeitraum; alle zeigt die Liste der Erweiterung. */}
                    {repeat !== 'once' && <> · {roundLabel(repeat, round)} · <a className="wk-link" href={formPath(ext.moduleId)}>wszystkie okresy</a></>}
                  </span>
                </h4>
                {data === undefined ? (
                  <p className="wk-empty">Tego rozszerzenia nie otworzysz tym kluczem.</p>
                ) : (
                  <ExtensionEntry
                    extensionId={ext.moduleId}
                    ext={data}
                    baseRegistrationId={s.registrationId}
                    entry={data.registrations.find((r) => r.baseId === s.registrationId && (r.round ?? '') === round)}
                    editable={ext.audience === 'office'}
                    round={round}
                    onSaved={() => void onChanged()}
                  />
                )}
              </section>
            );
          })}
        </>
      )}

      {on.has('areas') && (
        /* 0120 — DIE OBSZARY DIESER PERSON: je Regel des Formulars ihr eigener Bereich, mit der Rozmowa darin. */
        <PersonAreas registrationId={s.registrationId} ring={ring} onError={onError} />
      )}

      {on.has('link') && (
        <>
          {/*
            DER LINK — nur, wo es einen Platz gibt. Eine Einsendung ohne
            Platz hat nichts, worauf ein Link zeigen könnte.
          */}
          {s.seatId !== null ? (
            <SendPanel
              seatId={s.seatId}
              registrationId={s.registrationId}
              checks={s.checks}
              values={values}
              fields={fields}
              links={links}
              onError={onError}
              onChanged={onChanged}
            />
          ) : (
            <p className="wk-hint">
              {s.byOffice === true
                ? 'Osoba dopisana przez koordynatora — nie ma własnego linku.'
                : 'To zgłoszenie przyszło bez miejsca — nie ma linku, który można by wysłać.'}
            </p>
          )}
        </>
      )}

      {on.has('actions') && (
        <>
          {/*
            ZWEI VERSCHIEDENE DINGE, verschieden benannt. „Ukryj" räumt
            die Liste auf und lässt die Hüllen liegen; „Usuń" nimmt die
            Bytes fort — und fragt deshalb vorher, wie der Altbestand.
          */}
          <div className="wk-actions">
            {/* 0069 — eine Rozmowa nur mit diesem Menschen; die anderen, die das Formular ausgefüllt haben, sehen sie nicht. */}
            {s.seatId !== null && ring !== null && (
              <WriteToSeat seatId={s.seatId} near={[...formAreas, links.areaOf(s.seatId)]} areas={areas} ring={ring} busy={busy} onError={onError} />
            )}
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onHide(s)}>
              {s.hidden ? 'Przywróć' : 'Ukryj'}
            </button>
            <button
              type="button" className="wk-link-btn wk-danger" disabled={busy}
              onClick={async () => {
                if (await askText(`Usunąć zgłoszenie: ${name}? Odpowiedzi zostaną skasowane bez możliwości odtworzenia — także przez prowadzącego usługę.`)) {
                  onRemove(s);
                }
              }}
            >
              Usuń bezpowrotnie
            </button>
          </div>
          <p className="wk-hint">
            „Ukryj" tylko chowa wiersz. Usunięcie zabiera zgłoszenie, nie dostęp osoby.
          </p>
        </>
      )}
    </>
  );
}

/**
 * 0082 — „PANEL OSOBY" auf einer Seite: ein Mensch aus den gelesenen
 * Einsendungen (`entryDesk.ts`), mit eigenem Zustand für Fehler und Arbeit.
 * Was sich an ihm ändert, sagt es weiter (`deskChanged`) — dann lesen die
 * Auswahl oben und jede andere Kachel neu.
 */
export function EntryDeskPanel({ desk, row, ring, sections }: {
  desk: EntryDesk;
  row: DeskRow;
  ring: Ring;
  sections: readonly PanelSection[];
}) {
  const links = useSeatLinks(seatAreasOf(desk), ring);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);
    try {
      await todo();
      deskChanged(desk.formId);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="wk-entry-body wk-entry-desk">
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint" role="status">{busy}</p>}
      <EntryPanel
        formId={desk.formId}
        row={row}
        fields={desk.form.fields}
        removed={desk.form.removed}
        stepInfo={desk.info}
        extData={desk.extData}
        links={links}
        formAreas={formAreasOf(desk)}
        areas={desk.areas}
        ring={ring}
        busy={busy !== null}
        sections={sections}
        onHide={(s) => void act(s.hidden ? 'Przywracanie…' : 'Ukrywanie…', () => hideSubmission(s.registrationId, !s.hidden))}
        onRemove={(s) => void act('Usuwanie…', () => removeSubmission(s.registrationId))}
        onError={setFailed}
        onChanged={async () => { await links.reload(); deskChanged(desk.formId); }}
      />
    </div>
  );
}

/* -- Eine Einsendung, wie sie dasteht --------------------------------------- */

/**
 * Was in EINER Einsendung steht — und wenn nichts darin steht, warum.
 *
 * <b>Eine Zeile darf nie leer aussehen, während sie etwas enthält.</b> Genau
 * das geschah, solange hier über die Fragenliste gelaufen wurde: fehlte sie,
 * fehlte die ganze Antwort, ohne ein Wort dazu. Jetzt kommt die Reihenfolge von
 * den Fragen und der INHALT von dem, was aufging.
 */
function Answers({ values, fields, sealed, checks }: {
  values: ReadonlyMap<string, string> | undefined;
  fields: readonly OpenField[];
  sealed: number;

  /** Was an einzelnen Werten bestätigt ist (0030/0031). */
  checks: readonly ValueCheck[];
}) {
  /**
   * DAS ZEICHEN STEHT NEBEN DER ANGABE, nicht in einem Abschnitt darunter.
   *
   * „Ist diese Nummer bestätigt?" ist eine Frage über DIESE ZEILE. Die Antwort
   * drei Zeilen tiefer zwingt jeden, sie sich selbst zuzuordnen — und bei zwei
   * Nummern auf einem Bogen (Mutter, Vater) geht das gar nicht mehr auf.
   *
   * Und sie sagt, auf WELCHEM Weg (0031): ein geklickter SMS-Link zeigt, dass
   * unter der Nummer jemand erreichbar war; ein Druck im eigenen Portal zeigt,
   * dass die Angabe noch gilt. Beides als dasselbe anzuzeigen wäre bequem und
   * unwahr.
   */
  const mark = (fieldId: string) => {
    const one = checks.find((c) => c.fieldId === fieldId && c.verifiedAt !== null);
    if (one === undefined) return null;

    const when = new Date(one.verifiedAt!).toLocaleDateString('pl-PL',
      { day: 'numeric', month: 'long', year: 'numeric' });

    return (
      <span
        className="wk-chip-ok"
        title={one.origin === 'sms'
          ? `Otworzył link wysłany SMS-em — ${when}`
          : `Potwierdził w swoim portalu — ${when}`}
      >
        ✓ {one.origin === 'sms' ? 'potwierdzony SMS-em' : 'potwierdzony w portalu'}
      </span>
    );
  };

  if (values === undefined) {
    return <p className="wk-empty">Jeszcze nieotwarte — kliknij „Otwórz zgłoszenia".</p>;
  }

  if (values.size === 0) {
    return (
      <p className="wk-empty">
        {sealed === 0
          ? 'Usługa nie wydała treści tego zgłoszenia — nie czytasz obszaru, do którego trafiło.'
          : `${sealed} zapieczętowanych odpowiedzi, żadna nie pasuje do tego klucza przyjmowania.`}
      </p>
    );
  }

  /*
   * OHNE FRAGENLISTE IST NICHTS GELÖSCHT. Sie stand hier einmal als „pytanie
   * usunięte" da, sobald die Liste leer war — eine Behauptung über die Fragen,
   * die in Wahrheit eine über das Laden war. Die Antworten stehen trotzdem, mit
   * ihrer Kennung.
   */
  if (fields.length === 0) {
    return (
      <>
        <p className="wk-empty">Pytania się nie wczytały — poniżej same odpowiedzi.</p>
        <ul className="wk-tile-lines">
          {[...values.entries()].map(([id, text]) => (
            <li key={id}>
              <strong className="wk-row-side">{id.slice(0, 8)}:</strong> {text}{mark(id)}
            </li>
          ))}
        </ul>
      </>
    );
  }

  /* Erst die bekannten Fragen der Reihe nach, dann alles Übrige. */
  const known = fields.filter((f) => values.has(f.fieldId));

  /*
   * EIN GELEERTER VERWAISTER WERT IST NICHTS MEHR. Nach dem Umschreiben auf
   * die heutige Frage bleibt die alte Zeile als leere Hülle liegen — sie hier
   * zu zeigen hiesse „pytanie usunięte (01a0ae09):" und dahinter nichts. Bei
   * einer BEKANNTEN Frage bleibt die leere Antwort dagegen stehen: dass jemand
   * ein Feld freigelassen hat, ist eine Auskunft.
   */
  const rest = [...values.keys()].filter(
    (id) => !fields.some((f) => f.fieldId === id) && (values.get(id) ?? '').trim() !== '');

  return (
    <ul className="wk-tile-lines">
      {known.map((f) => (
        <li key={f.fieldId} className={f.removedAt != null ? 'wk-answer-off' : undefined}>
          <strong>{f.label ?? 'zapieczętowane pytanie'}{f.removedAt != null && <span className="wk-row-side"> (zdjęte z formularza)</span>}:</strong>{' '}
          {f.kind === 'consent' ? (
            /* 0083 — tak oder nein; und der Wortlaut, dem zugestimmt wurde (nicht der heutige der Frage). */
            consentGiven(values.get(f.fieldId))
              ? <>✓ tak <span className="wk-consent-text">{consentText(values.get(f.fieldId))}</span></>
              : '— nie'
          ) : values.get(f.fieldId)}{mark(f.fieldId)}
        </li>
      ))}

      {rest.map((id) => (
        <li key={id}>
          <strong className="wk-row-side">pytanie usunięte ({id.slice(0, 8)}):</strong>{' '}
          {values.get(id)}{mark(id)}
        </li>
      ))}
    </ul>
  );
}
