/**
 * Die Einstellungen eines Formulars: nach dem Absenden, Bedarf, Erweiterungen, Überschrift.
 */

import { useEffect, useId, useState } from 'react';

import type { AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { newId } from '../core/ids';
import type { Ring } from '../core/keys';
import { type Who, WorkspaceError } from '../core/session';
import { type ModuleRow, createModule } from '../modules/module';
import { formPath } from '../routes';
import type { ExtensionInfo } from '../steps/steps';
import { AUDIENCE_LABEL, type OpenField, setPartConfig } from './form';
import { applyNeed, dropNeed, reshapeNeed } from './formTemplates';
import { NEEDS, choiceOf, needOf, sameChoice, type FormNeed, type NeedChoice, type NeedSetting } from './needs';
import { choiceOfOn, readNeeds, type NeedOn } from './needPlan';
import { createIntake } from './intake';
import { REPEATS, REPEAT_LABEL, type Repeat, repeatOf } from './rounds';
import { PAPER_MINOR, PAPER_SIGN, ageFields, parentalConsentOf } from './SignSheet';

/**
 * NACH DEM ABSENDEN — eine eigene Überschrift, ein eigener Text, und ob das
 * Ausgefüllte auf Papier unterschrieben werden muss (immer, oder wenn eine
 * bestimmte Zustimmung angekreuzt ist). Gespeichert am Formular; draussen
 * liest es `after` des öffentlichen Formulars.
 */
export function AfterSendSettings({ partId, config, fields, busy, onSaved, onError, onNeeds }: {
  partId: string;
  config: Record<string, string>;
  fields: readonly OpenField[];
  busy: boolean;
  onSaved: (next: Record<string, string>) => void;
  onError: (message: string | null) => void;
  /** 0087 — zu den Wymagania (Reiter „Pytania"): dort wird „Niepełnoletni…" eingeschaltet. */
  onNeeds?: () => void;
}) {
  const [title, setTitle] = useState(config.sentTitle ?? '');
  const [text, setText] = useState(config.sentText ?? '');
  const [paper, setPaper] = useState(config.paper ?? '');
  const [signer, setSigner] = useState(config.paperSigner ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(config.sentTitle ?? '');
    setText(config.sentText ?? '');
    setPaper(config.paper ?? '');
    setSigner(config.paperSigner ?? '');
  }, [config.sentTitle, config.sentText, config.paper, config.paperSigner]);

  const ticks = fields.filter((f) => f.kind === 'consent' || f.kind === 'checkbox');
  /* Woraus das Alter folgt — ohne Geburtsdatum oder PESEL weiss das Formular nicht, wer minderjährig ist. */
  const knowsAge = ageFields(fields).length > 0;
  /*
   * Fragt das Formular nach der Zustimmung eines Elternteils als KÄSTCHEN? Dann
   * ein Vorschlag (0087): ein Häkchen setzt das Kind, nicht der Elternteil —
   * und als Pflichtfeld hält es jeden auf. Der Weg ist das Wymaganie
   * „Niepełnoletni…": die Zustimmung als Erklärung, gedruckt am Ende.
   */
  const consentTick = parentalConsentOf(ticks);
  const parental = consentTick !== null && (paper === '' || consentTick.isRequired) ? consentTick : null;
  const dirty = title !== (config.sentTitle ?? '') || text !== (config.sentText ?? '')
    || paper !== (config.paper ?? '') || signer !== (config.paperSigner ?? '');

  const save = async () => {
    setSaving(true);
    onError(null);
    try {
      const done = await setPartConfig(partId, { sentTitle: title.trim(), sentText: text.trim(), paper, paperSigner: signer.trim() });
      onSaved(done.config);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <fieldset className="wk-fieldset wk-after-settings">
      <legend>Po wysłaniu</legend>
      <label className="wk-field">
        <span>Nagłówek po wysłaniu</span>
        <input value={title} disabled={busy || saving} placeholder="Zgłoszenie przyjęte." onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="wk-field">
        <span>Tekst po wysłaniu (nieobowiązkowo)</span>
        <textarea rows={4} value={text} disabled={busy || saving} onChange={(e) => setText(e.target.value)}
          placeholder="np. Dziękujemy! Zbiórka w sobotę o 8:00 przed kościołem. Zabierz legitymację." />
        <span className="wk-hint">
          Osoba widzi go zaraz po wysłaniu. Pusta linia zaczyna nowy akapit.
        </span>
      </label>
      <label className="wk-field">
        <span>Podpis odręczny na wydruku</span>
        <select value={paper} disabled={busy || saving} onChange={(e) => setPaper(e.target.value)}>
          <option value="">nie trzeba</option>
          <option value="always">zawsze — każdy drukuje i podpisuje</option>
          <option value={PAPER_SIGN}>gdy formularz pokazuje oświadczenie do podpisu (np. zgodę rodzica)</option>
          <option value={PAPER_MINOR} disabled={!knowsAge && paper !== PAPER_MINOR}>
            niepełnoletni — wg daty urodzenia albo PESEL{knowsAge ? '' : ' (formularz o nie nie pyta)'}
          </option>
          {ticks.map((f) => (
            <option key={f.fieldId} value={f.fieldId}>gdy zaznaczono: {f.label ?? 'pytanie'}</option>
          ))}
          {paper !== '' && paper !== 'always' && paper !== PAPER_MINOR && paper !== PAPER_SIGN && !ticks.some((f) => f.fieldId === paper) && (
            <option value={paper}>(pytanie, którego już nie ma)</option>
          )}
        </select>
        <span className="wk-hint">
          Zgoda rodzica musi być podpisana odręcznie: po wysłaniu pojawi się „Drukuj do podpisu” (strona A4 z danymi i zgodami).
        </span>
        {paper === PAPER_MINOR && !knowsAge && (
          <span className="wk-warn">Formularz nie pyta o datę urodzenia ani PESEL — nie wiadomo, kto jest niepełnoletni, więc wydruk się nie pokaże.</span>
        )}
      </label>
      {parental !== null && (
        <div className="wk-paper-note" role="note">
          <p>
            <strong>Ten formularz każe zaznaczyć zgodę rodzica</strong> („{parental.label ?? 'pytanie'}”)
            {parental.isRequired ? ' — bez zaznaczenia nikt go nie wyśle' : ''}
            {paper === '' ? ', a wydruku do podpisu nie ma' : ''}. Zaznaczenie nie jest podpisem rodzica — zaznacza je dziecko.
          </p>
          <p>
            Lepiej: w zakładce „Pytania” zaznacz wymaganie <strong>„{needOf('minor')?.label}”</strong>.
            Formularz rozpozna niepełnoletnich (po dacie urodzenia albo polu do zaznaczenia), a kto przychodzi z pisemną
            zgodą rodzica, zobaczy jej treść bez pola do zaznaczenia i na końcu formularza (oraz po wysłaniu) wydrukuje ją
            do podpisu. Potem to pole usuń — dotychczasowe odpowiedzi zostaną w zgłoszeniach.
          </p>
          <div className="wk-actions">
            {onNeeds !== undefined && (
              <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || saving} onClick={onNeeds}>
                Przejdź do wymagań
              </button>
            )}
            {knowsAge && paper !== PAPER_MINOR && (
              <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || saving}
                onClick={() => { setPaper(PAPER_MINOR); if (signer.trim() === '') setSigner('czytelny podpis rodzica / opiekuna prawnego'); }}>
                Drukuj dla niepełnoletnich
              </button>
            )}
          </div>
        </div>
      )}
      {paper !== '' && (
        <label className="wk-field">
          <span>Kto podpisuje (pod linią na wydruku)</span>
          <input value={signer} disabled={busy || saving} placeholder="czytelny podpis" onChange={(e) => setSigner(e.target.value)} />
        </label>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={busy || saving || !dirty} onClick={() => void save()}>
          {saving ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </div>
    </fieldset>
  );
}

/**
 * 0086 — WYMAGANIA FORMULARZA, zum Ankreuzen (`needs.ts`, `formTemplates.ts`):
 * was ein Wydarzenie verlangt — Minderjährige, Zdrowie, Ubezpieczenie, Zasady.
 * Eingeschaltet bringt jedes seine Fragen, Gruppen und Logik mit (was es schon
 * gibt, wird weiterbenutzt) und sperrt sie gegen das Löschen; ausgeschaltet
 * nimmt es sie wieder mit — Antworten bleiben.
 *
 * <b>2026-10-24 — Einstellungen.</b> Ein Wymaganie mit Einstellungen (die
 * Minderjährigen: woran man sie erkennt, wie sie teilnehmen dürfen) zeigt sie
 * unter seinem Namen. Ausgeschaltet sind sie der Entwurf fürs Einschalten;
 * eingeschaltet stellt „Zastosuj ustawienia" das Formular um.
 */
export function NeedsPanel({ module, who, config, answersTo, areas, busy, onAct, onConfig }: {
  module: ModuleRow;
  who: Who;
  config: Record<string, string>;
  answersTo: string | null;
  areas: readonly AreaRow[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  /** Die Einstellungen danach — sonst schriebe „Po wysłaniu" den alten Stand zurück. */
  onConfig: (next: Record<string, string>) => void;
}) {
  const [target, setTarget] = useState(answersTo ?? '');
  const [stage, setStage] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  /** Welches Wymaganie gerade ausgeschaltet werden soll — erst nach „Wyłącz" geschieht es. */
  const [leaving, setLeaving] = useState<string | null>(null);
  /** Die Einstellungen im Entwurf, je Wymaganie — angewandt beim Einschalten oder mit „Zastosuj ustawienia". */
  const [drafts, setDrafts] = useState<Readonly<Record<string, NeedChoice>>>({});
  const usable = areas.filter((a) => a.heldEpochs > 0);
  const on = readNeeds(config.needs);

  useEffect(() => { if (answersTo !== null) setTarget(answersTo); }, [answersTo]);

  const choiceFor = (need: FormNeed, active: NeedOn | undefined): NeedChoice =>
    drafts[need.id] ?? (active === undefined ? choiceOf(need, undefined) : choiceOfOn(active));
  const forget = (needId: string) => setDrafts((was) => Object.fromEntries(Object.entries(was).filter(([id]) => id !== needId)));

  const turnOn = (need: FormNeed) => void onAct(`Włączanie: ${need.label}…`, async () => {
    try {
      setSaid(null);
      const done = await applyNeed(who, module, need, choiceFor(need, undefined), target === '' ? null : target, config, setStage);
      onConfig(done.config);
      forget(need.id);
      setSaid([
        `„${need.label}”: nowych pytań ${done.added}${done.reused > 0 ? `, wykorzystane istniejące: ${done.reused}` : ''}.`,
        ...done.warnings
      ].join(' '));
    } finally {
      setStage(null);
    }
  });

  const reshape = (need: FormNeed, choice: NeedChoice) => void onAct(`Zmiana ustawień: ${need.label}…`, async () => {
    try {
      setSaid(null);
      const done = await reshapeNeed(who, module, need.id, choice, target === '' ? null : target, config, setStage);
      onConfig(done.config);
      forget(need.id);
      setSaid([
        `„${need.label}”: ustawienia zmienione — nowych pytań ${done.added}`
          + (done.removed > 0 ? `, usunięte ${done.removed}` : '')
          + (done.kept > 0 ? `, zdjęte z formularza (mają odpowiedzi — zostają w zgłoszeniach) ${done.kept}` : '') + '.',
        ...done.warnings
      ].join(' '));
    } finally {
      setStage(null);
    }
  });

  const turnOff = (need: FormNeed) => void onAct(`Wyłączanie: ${need.label}…`, async () => {
    try {
      setSaid(null);
      setLeaving(null);
      const done = await dropNeed(who, module, need.id, config, setStage);
      onConfig(done.config);
      setSaid([
        `„${need.label}” wyłączone: usunięte pytania ${done.removed}`
          + (done.kept > 0 ? `, zdjęte z formularza (mają odpowiedzi — zostają w zgłoszeniach) ${done.kept}` : '') + '.',
        ...done.warnings
      ].join(' '));
    } finally {
      setStage(null);
    }
  });

  return (
    <section className="wk-needs" aria-label="Wymagania formularza">
      <h3 className="wk-h3">Wymagania formularza</h3>
      <p className="wk-hint">
        Zaznacz, czego wymaga wydarzenie — formularz dostanie potrzebne pytania. Dopóki wymaganie jest zaznaczone, tych pytań nie da się usunąć.
      </p>
      {answersTo === null && (
        <label className="wk-field">
          <span>Odpowiedzi trafiają do obszaru</span>
          <AreaPick label="Odpowiedzi trafiają do obszaru" value={target} disabled={busy} onChange={setTarget} areas={areas} only={usable} />
        </label>
      )}
      <ul className="wk-need-list">
        {NEEDS.map((need) => {
          const active = on.find((one) => one.id === need.id);
          const choice = choiceFor(need, active);
          const changed = active !== undefined && !sameChoice(need, choice, choiceOfOn(active));
          return (
            <li key={need.id} className={active === undefined ? 'wk-need' : 'wk-need is-on'} data-need={need.id}>
              <label className="wk-need-pick">
                <input
                  type="checkbox" checked={active !== undefined}
                  disabled={busy || (active === undefined && target === '')}
                  onChange={() => (active === undefined ? turnOn(need) : setLeaving(need.id))}
                />
                <span>
                  <strong>{need.label}</strong>
                  {/* Mit Einstellungen sagen die Einstellungen darunter, was es gibt — der Satz stünde zweimal da. */}
                  {need.settings.length === 0 && <span className="wk-need-use">{need.use(choice)}</span>}
                  {active !== undefined && (
                    <span className="wk-need-holds">
                      Pytania: {active.fields.length}{active.nodes.length > 0 && ` · logika: ${active.nodes.length} węzłów`}
                      {active.paper === true && ' · wydruk zgody do podpisu'}
                    </span>
                  )}
                </span>
              </label>
              {need.settings.length > 0 && (
                <NeedSettings need={need} choice={choice} disabled={busy} onChange={(next) => setDrafts((was) => ({ ...was, [need.id]: next }))} />
              )}
              {changed && (
                <div className="wk-need-leave" role="group" aria-label={`Nowe ustawienia: ${need.label}`}>
                  <span className="wk-hint">
                    Formularz dostanie pytania nowych ustawień. Pytania, których nowe ustawienia nie potrzebują, znikną; te, na które
                    ktoś już odpowiedział, zostaną tylko zdjęte — ich odpowiedzi zostają w zgłoszeniach.
                  </span>
                  <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => reshape(need, choice)}>Zastosuj ustawienia</button>
                  <button type="button" className="wk-link-btn" disabled={busy} onClick={() => forget(need.id)}>Anuluj</button>
                </div>
              )}
              {leaving === need.id && active !== undefined && (
                <div className="wk-need-leave" role="group" aria-label={`Wyłączyć: ${need.label}`}>
                  <span className="wk-hint">
                    Pytania dodane przez to wymaganie znikną z formularza ({active.added.length}); te, na które ktoś już
                    odpowiedział, zostaną tylko zdjęte — ich odpowiedzi zostają w zgłoszeniach.
                    {active.paper === true && ' Wydruk do podpisu też się wyłączy.'}
                  </span>
                  <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => turnOff(need)}>Wyłącz i usuń pytania</button>
                  <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setLeaving(null)}>Anuluj</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {stage !== null && <p className="wk-working">{stage}</p>}
      {said !== null && <p className="wk-done" role="status">{said}</p>}
    </section>
  );
}

/**
 * 2026-10-24 — DIE EINSTELLUNGEN EINES WYMAGANIE: je Einstellung Knöpfe (eine
 * von mehreren) oder Kästchen (mehrere — die letzte lässt sich nicht
 * abwählen: eine Möglichkeit muss offen bleiben).
 */
function NeedSettings({ need, choice, disabled, onChange }: {
  need: FormNeed;
  choice: NeedChoice;
  disabled: boolean;
  onChange: (next: NeedChoice) => void;
}) {
  const name = useId();
  const pick = (s: NeedSetting, value: string, chosen: boolean): readonly string[] => {
    if (!s.many) return [value];
    const now = choice[s.key] ?? [];
    const next = chosen ? now.filter((v) => v !== value) : [...now, value];
    return s.choices.map((c) => c.value).filter((v) => next.includes(v));
  };

  return (
    <div className="wk-need-settings">
      {need.settings.map((s) => (
        <fieldset key={s.key} className="wk-need-setting" disabled={disabled}>
          <legend>{s.label}</legend>
          {s.choices.map((c) => {
            const chosen = (choice[s.key] ?? []).includes(c.value);
            const last = s.many && chosen && (choice[s.key] ?? []).length === 1;
            return (
              <label key={c.value} className="wk-need-option" title={last ? 'Jedna możliwość musi zostać.' : undefined}>
                <input
                  type={s.many ? 'checkbox' : 'radio'} name={`${name}-${s.key}`} checked={chosen} disabled={last}
                  data-need-setting={`${need.id}.${s.key}.${c.value}`}
                  onChange={() => onChange({ ...choice, [s.key]: pick(s, c.value, chosen) })}
                />
                <span>{c.label} <span className="wk-need-says">— {c.says}</span></span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}

/* -- Die Erweiterungen eines Formulars (0047) ------------------------------- */

/**
 * WAS DIESES FORMULAR ERWEITERT — und eine neue Erweiterung anlegen.
 *
 * <b>Zwei Arten, nach dem, wer ausfüllt:</b> der Mensch selbst (eine
 * Ergänzung, die er über seinen Link bekommt — „Uzupełnij" steht dann von
 * selbst unter seinen Schritten), oder nur der Koordinator (Notizen je
 * Mensch, die der Mensch nie sieht). Beide sind gewöhnliche Formulare mit
 * eigenen Fragen, Aufbau und Logik.
 */
export function Extensions({ base, extensions, busy, onCreated, onError }: {
  base: ModuleRow;
  extensions: readonly ExtensionInfo[];
  busy: boolean;
  onCreated: () => Promise<void> | void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [audience, setAudience] = useState<'person' | 'office'>('person');
  const [repeat, setRepeat] = useState<Repeat>('once');
  const [saving, setSaving] = useState(false);
  const [made, setMade] = useState<string | null>(null);

  const create = async () => {
    setSaving(true);
    onError(null);

    try {
      const moduleId = newId();
      await createModule(moduleId, 'form', name.trim(), base.areaId, base.forKind, '{}',
        { extendsId: base.moduleId, audience, repeat });
      setMade(moduleId);
      setName('');
      await onCreated();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się założyć rozszerzenia.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wk-field">
      <span>Rozszerzenia formularza</span>
      <p className="wk-hint">
        Podformularze: osoba uzupełnia je później przez swój link albo wypełnia je tylko koordynator.
      </p>
      <p className="wk-hint">
        Podformularz może się <strong>powtarzać</strong> (co dzień, tydzień, miesiąc, rok) — wtedy każda osoba ma osobny wpis na każdy okres.
      </p>

      {extensions.length > 0 && (
        <ul className="wk-list">
          {extensions.map((e) => (
            <li className="wk-row" key={e.moduleId}>
              <span>
                <strong>{e.name}</strong>
                <span className="wk-row-side"> · {AUDIENCE_LABEL[e.audience]}{repeatOf(e.repeat) !== 'once' ? ` · ${REPEAT_LABEL[repeatOf(e.repeat)]}` : ''}{e.closed ? ' · zamknięte' : ''}</span>
              </span>
              <a className="wk-link-btn" href={formPath(e.moduleId)}>Otwórz</a>
            </li>
          ))}
        </ul>
      )}

      <form className="wk-inline" onSubmit={(e) => { e.preventDefault(); if (name.trim() !== '') void create(); }}>
        <input
          value={name}
          placeholder="np. Dane do bierzmowania albo Notatki koordynatora"
          aria-label="Nazwa rozszerzenia"
          disabled={busy || saving}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          value={audience}
          aria-label="Kto wypełnia"
          disabled={busy || saving}
          onChange={(e) => setAudience(e.target.value === 'office' ? 'office' : 'person')}
        >
          <option value="person">wypełnia osoba</option>
          <option value="office">tylko koordynator</option>
        </select>
        <select
          value={repeat}
          aria-label="Jak często"
          disabled={busy || saving}
          onChange={(e) => setRepeat(repeatOf(e.target.value))}
        >
          {REPEATS.map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
        </select>
        <button type="submit" className="wk-btn" disabled={busy || saving || name.trim() === ''}>
          {saving ? 'Zakładanie…' : 'Dodaj rozszerzenie'}
        </button>
      </form>

      {made !== null && (
        <p className="wk-done">
          Założone. <a className="wk-link" href={formPath(made)}>Dodaj mu pytania</a>.
        </p>
      )}
    </div>
  );
}

/**
 * Eine Erweiterung sagt, wessen sie ist, wer sie ausfüllt — und wie oft (0077).
 * Wie oft lässt sich ändern, solange nichts eingetragen ist: jede Einsendung
 * trägt den Zeitraum IHRER Art.
 */
export function ExtensionOf({ row, busy, onRepeat }: { row: ModuleRow; busy: boolean; onRepeat: (repeat: Repeat) => void }) {
  const repeat = repeatOf(row.repeat);

  return (
    <div className="wk-note">
      <p>
        <strong>To jest rozszerzenie formularza</strong>{' '}
        <a className="wk-link" href={formPath(row.extendsId ?? '')}>otwórz formularz główny</a>.
        {' '}Wypełnia: <strong>{row.audience === 'public' ? AUDIENCE_LABEL.public : AUDIENCE_LABEL[row.audience]}</strong>.
      </p>
      <label className="wk-inline">
        <span>Powtarza się:</span>
        <select value={repeat} disabled={busy || row.entries > 0} onChange={(e) => onRepeat(repeatOf(e.target.value))}>
          {REPEATS.map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
        </select>
        <span className="wk-hint">
          {row.entries > 0
            ? 'Są już wpisy — powtarzania nie da się zmienić.'
            : repeat === 'once'
              ? 'Jeden wpis na osobę.'
              : 'Osobny wpis na każdy okres — w zakładce „Zgłoszenia” przełączasz okres u góry.'}
        </span>
      </label>
      <p className="wk-hint">
        {row.audience === 'office'
          ? 'Odpowiedzi widzi tylko kancelaria. W zakładce „Osoby" wpisujesz je przy każdej osobie; możesz też postawić ten formularz na swojej stronie koordynatora — pokaże tam tę samą listę.'
          : 'Osoba zobaczy to w swoich krokach jako „Uzupełnij" i wypełni przez swój link. Klauzula i link są te same co w formularzu głównym.'}
      </p>
    </div>
  );
}

/* -- Eine Annahme, die fehlt ------------------------------------------------ */

/**
 * Ein Antwortbereich ohne Annahme — dort nimmt eine Frage nichts an.
 *
 * <b>Nur noch als Hinweis</b>, wo es fehlt. Die Annahme entsteht sonst mit der
 * ersten Frage für einen Bereich (`NewFieldForm`); hier landen Formulare, die
 * ihre Fragen bekamen, bevor es so war. Die Klausel steht nicht mehr hier: sie
 * gehört dem Formular, nicht dem Bereich (0042).
 */
export function IntakeMissing({ areaId, areaName, ring, officeRoleId, busy, onAct }: {
  areaId: string;
  areaName: string;
  ring: Ring;
  officeRoleId: string;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <div className="wk-warn">
      <p>
        Obszar „{areaName}" nie przyjmuje jeszcze odpowiedzi — brakuje mu klucza,
        którym odpowiedzi zamyka się tak, żeby otworzył je tylko ten, kto prowadzi zgłoszenia.
      </p>
      <button
        type="button" className="wk-link-btn" disabled={busy}
        onClick={() => void onAct('Tworzenie klucza przyjmowania — kilka sekund…',
          () => createIntake(ring, areaId, officeRoleId))}
      >
        Utwórz klucz przyjmowania
      </button>
    </div>
  );
}

/* -- Die Überschrift ------------------------------------------------------- */

/**
 * Wie der Bogen auf der Seite überschrieben ist.
 *
 * <b>Eine Einstellung des Bausteins</b> wie die Vorlage daneben — sie braucht
 * keinen Schlüssel und keine einzige Einsendung, und wer die Seite führt,
 * darf sie schreiben.
 */
export function Naming({ partId, value, busy, onSaved, onError }: {
  partId: string;
  value: string;
  busy: boolean;
  onSaved: (next: Record<string, string>) => void;
  onError: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(value); }, [value]);

  const save = async () => {
    setSaving(true);
    onError(null);

    try {
      const done = await setPartConfig(partId, { title: draft.trim() });
      onSaved(done.config);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="wk-field">
      <span>Nagłówek na stronie</span>
      <input
        value={draft}
        placeholder="np. Zgłoszenie"
        disabled={busy || saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft.trim() !== value.trim()) void save(); }}
      />
    </label>
  );
}
