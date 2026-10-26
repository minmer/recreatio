/**
 * Eine Frage anlegen und ändern.
 */

import { useId, useState } from 'react';

import { type AreaRow, myEpochKeys } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import type { Ring } from '../core/keys';
import { WorkspaceError } from '../core/session';
import { FIELD_KINDS, IDENTITY_ROLES, type FieldKind, IDENTITY_LABEL, type IdentityRole, KIND_LABEL, type OpenField, addField } from './form';
import { createIntake, loadPublicIntake } from './intake';

/* -- 0083: Zustimmungen, nach dem Absenden, Wzory ------------------------- */

/** Der Wortlaut einer Zustimmung — nur bei der Art „Zgoda / oświadczenie". */
function ConsentText({ kind, value, onChange, edited = false }: {
  kind: FieldKind;
  value: string;
  onChange: (next: string) => void;
  edited?: boolean;
}) {
  if (kind !== 'consent') return null;
  return (
    <label className="wk-field">
      <span>Treść oświadczenia — to, na co osoba się zgadza</span>
      <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="np. Jako rodzic albo opiekun prawny wyrażam zgodę na udział mojego dziecka…" />
      <span className="wk-hint">
        Pokazuje się w całości pod polem do zaznaczenia; „Pytanie” to krótka nazwa (np. „Zgoda na udział”).
        {edited
          ? ' Zmiana dotyczy tylko nowych odpowiedzi — każda udzielona zgoda zachowuje treść, na którą ją wyrażono.'
          : ' Zaznaczona zgoda zapisuje się razem z tą treścią — późniejsza zmiana jej nie podmienia.'}
      </span>
    </label>
  );
}

/* -- Eine Frage stellen ----------------------------------------------------- */

/**
 * Welche Form eine genormte Angabe hat — im Bogen wie in den eigenen Daten.
 *
 * <b>Festgelegt, nicht vorgeschlagen.</b> Ein Geburtsdatum, das als freie
 * Zeile abgefragt wird, kommt als „2 kwietnia" zurück und passt dann nicht in
 * das, was der Mensch einmal angelegt hat. Die Adresse steht dort in einer
 * Zeile, also hier auch.
 */
const KIND_OF: Partial<Record<IdentityRole, FieldKind>> = {
  given_name: 'line',
  surname: 'line',
  nickname: 'line',
  born: 'date',
  phone: 'phone',
  email: 'email',
  address: 'line'
};

/**
 * Eine neue Frage.
 *
 * <b>Zuerst: WORÜBER.</b> Ist es eine genormte Angabe — Imię, Telefon, Data
 * urodzenia —, dann steht damit das meiste schon fest: die Form der Antwort,
 * und meist auch die Frage selbst. Vorher kam diese Wahl als dritte, nach
 * Frage und Rodzaj; wer „Imię" eintippte und „Jedna linia" wählte, musste
 * danach noch einmal „Imię" auswählen, und nichts hinderte ihn, dort etwas
 * anderes zu wählen als das, was er gefragt hatte.
 *
 * <b>Was schon gefragt wird, wird nicht zweimal angeboten.</b> Zwei Fragen
 * nach dem Vornamen füllten sich beide aus derselben Angabe.
 */
export function NewFieldForm({
  areas, ring, partId, position, taken, formAreaId, officeRoleId, busy, onAdded, onError
}: {
  areas: readonly AreaRow[];
  ring: Ring;
  partId: string;
  position: number;
  taken: readonly IdentityRole[];

  /** Der Bereich des FORMULARS — unter seinem Schlüssel liegt die Frage (0042). */
  formAreaId: string | null;

  /** Wer die Annahme eines neuen Antwortbereichs hält — die eigene Person. */
  officeRoleId: string | null;

  busy: boolean;
  onAdded: () => void;
  onError: (message: string | null) => void;
}) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<FieldKind>('line');
  const [areaId, setAreaId] = useState('');
  const [required, setRequired] = useState(false);
  const [selfEdit, setSelfEdit] = useState(true);
  /* 0093 — nur der Mensch schreibt und berichtigt. */
  const [personOnly, setPersonOnly] = useState(false);
  const [identity, setIdentity] = useState<IdentityRole>('none');
  const [options, setOptions] = useState('');
  /* 0083 — der Wortlaut einer Zustimmung (sonst eine Podpowiedź). */
  const [help, setHelp] = useState('');
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  const usable = areas.filter((a) => a.heldEpochs > 0);

  /* Die genormte Angabe gewählt: Form festlegen, Frage vorschlagen — aber
     eine selbst geschriebene Frage nicht überschreiben. */
  const about = (next: IdentityRole) => {
    const shaped = KIND_OF[next];
    if (shaped !== undefined) setKind(shaped);

    const proposed = identity === 'none' ? '' : IDENTITY_LABEL[identity];
    if (label.trim() === '' || label === proposed) setLabel(next === 'none' ? '' : IDENTITY_LABEL[next]);

    setIdentity(next);
  };

  const fixed = KIND_OF[identity] !== undefined;

  const go = async () => {
    const area = usable.find((a) => a.areaId === areaId);
    if (area === undefined) return;

    setWorking(true);
    onError(null);

    try {
      const keys = await myEpochKeys(ring, area.areaId);
      const areaKey = keys.get(area.currentEpoch);

      if (areaKey === undefined) throw new WorkspaceError('Nie masz klucza tej epoki.');

      /*
       * DIE ANNAHME ENTSTEHT MIT DER ERSTEN FRAGE. Vorher stand dafür ein
       * eigener Kasten mit einem eigenen Knopf — und ein Formular, dessen
       * Fragen schon dastanden, nahm trotzdem nichts an, bis jemand ihn fand.
       */
      const takes = await loadPublicIntake(area.areaId).then(() => true, () => false);
      if (!takes) {
        if (officeRoleId === null) throw new WorkspaceError('Konto nie prowadzi jeszcze żadnej osoby — załóż ją w Rolach.');
        setStage('Tworzenie klucza przyjmowania — kilka sekund…');
        await createIntake(ring, area.areaId, officeRoleId);
      }

      /* Die Frage unter dem Schlüssel des FORMULARS (0042), wenn es einen Bereich hat. */
      let labelArea: { areaId: string; key: Uint8Array; epoch: number } | undefined;
      if (formAreaId !== null) {
        const formArea = areas.find((a) => a.areaId === formAreaId);
        const formKey = formArea === undefined
          ? undefined
          : (await myEpochKeys(ring, formAreaId)).get(formArea.currentEpoch);
        if (formArea === undefined || formKey === undefined) {
          throw new WorkspaceError('Nie masz klucza obszaru formularza — pytania nie da się zapieczętować.');
        }
        labelArea = { areaId: formAreaId, key: formKey, epoch: formArea.currentEpoch };
      }

      setStage('Pieczętowanie pytania…');

      await addField(partId, {
        labelArea,
        areaId: area.areaId, areaKey, epoch: area.currentEpoch,
        kind, position, label,
        help: help.trim() === '' ? undefined : help.trim(),
        options: kind === 'choice' ? options.split('\n') : undefined,
        isRequired: required,
        identityRole: identity,
        selfEdit: selfEdit || personOnly,
        personOnly
      });

      setLabel('');
      setOptions('');
      setHelp('');
      setIdentity('none');
      setKind('line');
      onAdded();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się dodać pytania.');
    } finally {
      setWorking(false);
      setStage(null);
    }
  };

  return (
    <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void go(); }}>
      <h4 className="wk-h2">Dodaj pytanie</h4>

      {/*
        WELCHE genormte Angabe das ist (0038) — und zwar ZUERST.

        Ohne sie ist ‚Imię’ für das Programm ein Wort wie jedes andere, und wer
        den Bogen ausfüllt, tippt seinen Vornamen zum vierten Mal. Steht sie
        da, füllt der Bogen sich selbst — aus dem, was der Mensch EINMAL
        angelegt hat, und eine Änderung dort ist eine Änderung überall.
      */}
      <label className="wk-field">
        <span>Czego dotyczy</span>
        <select value={identity} onChange={(e) => about(e.target.value as IdentityRole)}>
          {IDENTITY_ROLES.map((r) => (
            <option key={r} value={r} disabled={r !== 'none' && taken.includes(r)}>
              {IDENTITY_LABEL[r]}{r !== 'none' && taken.includes(r) ? ' — już jest w formularzu' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="wk-field">
        <span>Pytanie</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={identity === 'none' ? 'np. Z której jesteś parafii?' : IDENTITY_LABEL[identity]}
        />
      </label>

      <label className="wk-field">
        <span>Rodzaj</span>
        <select value={kind} disabled={fixed} onChange={(e) => setKind(e.target.value as FieldKind)}>
          {FIELD_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        {fixed && <span className="wk-hint">Wynika z tego, czego dotyczy pytanie.</span>}
      </label>

      {kind === 'choice' && (
        <label className="wk-field">
          <span>Możliwości — jedna w wierszu</span>
          <textarea rows={3} value={options} onChange={(e) => setOptions(e.target.value)} />
        </label>
      )}

      <ConsentText kind={kind} value={help} onChange={setHelp} />

      {/*
        WOHIN die Antwort geht. Je Feld, nicht je Formular — damit ein Bogen
        Fragen stellen kann, deren Antworten an verschiedene Stellen gehören.
      */}
      <label className="wk-field">
        <span>Odpowiedzi trafiają do obszaru</span>
        <AreaPick label="Odpowiedzi trafiają do obszaru" value={areaId} onChange={setAreaId} areas={areas} only={usable} />
      </label>

      <label className="wk-field">
        <span>
          <input type="checkbox" checked={required} onChange={() => setRequired(!required)} />
          {' '}Wymagane
        </span>
      </label>

      <WhoEditsBox selfEdit={selfEdit} personOnly={personOnly} onChange={(next) => { setSelfEdit(next.selfEdit); setPersonOnly(next.personOnly); }} />

      <p className="wk-hint">
        {formAreaId !== null
          ? 'Odpowiedzi trafią do wybranego obszaru — przeczyta je tylko ten, kto ma do niego dostęp. '
            + 'Samo pytanie leży w obszarze pytań formularza.'
          : 'Pytanie zostanie zapieczętowane kluczem tego obszaru — publicznie czytelne tylko, gdy obszar jest jawny.'}
        
      </p>

      {stage !== null && <p className="wk-working">{stage}</p>}

      <div className="wk-actions">
        <button
          type="submit" className="wk-btn"
          disabled={busy || working || label.trim() === '' || areaId === '' || (kind === 'consent' && help.trim() === '')}
        >
          {working ? 'Dodawanie…' : 'Dodaj'}
        </button>
      </div>
    </form>
  );
}

/* -- Eine Frage ändern (0042) ------------------------------------------------ */

/** Was an einer Frage geändert wird — alles, was der Browser neu versiegelt. */
export interface FieldChange {
  readonly label: string;
  readonly help: string | null;
  readonly options: readonly string[];
  readonly kind: FieldKind;
  readonly isRequired: boolean;
  readonly isHalfWidth: boolean;
  readonly identityRole: IdentityRole;

  /** Darf der Mensch die Antwort über seinen Link berichtigen (0044)? */
  readonly selfEdit: boolean;

  /** 0093 — schreibt und berichtigt nur der Mensch (die Kanzlei liest)? */
  readonly personOnly?: boolean;

  /** Wohin die Antworten gehen — ein anderer als bisher heisst: umziehen. */
  readonly areaId: string;
}

/**
 * Eine vorhandene Frage bearbeiten.
 *
 * <b>Fast alles.</b> Der Text, die Hilfe, die Auswahl, Pflicht oder nicht,
 * welche Angabe sie ist. Die FORM nur, solange niemand geantwortet hat — das
 * sagt der Dienst, wenn es so ist. Und wohin die Antworten gehen: dann werden
 * die vorhandenen mitgenommen, im Browser neu verpackt für den neuen Bereich.
 */
export function FieldEditor({ field, areas, taken, busy, onCancel, onSave, optionsOf }: {
  field: OpenField;
  areas: readonly AreaRow[];
  taken: readonly IdentityRole[];
  busy: boolean;
  onCancel: () => void;
  onSave: (change: FieldChange) => void;
  /**
   * 2026-10-24 — eine Wahl, deren Möglichkeiten ein Wymaganie festhält (die
   * Logik erkennt die Antwort an ihrem Wortlaut): sein Name. Dann bleiben
   * Rodzaj und Możliwości, wie sie sind — umstellen geht über das Wymaganie.
   */
  optionsOf?: string;
}) {
  const [label, setLabel] = useState(field.label ?? '');
  const [help, setHelp] = useState(field.help ?? '');
  const [kind, setKind] = useState<FieldKind>(field.kind);
  const [identity, setIdentity] = useState<IdentityRole>(field.identityRole);
  const [required, setRequired] = useState(field.isRequired);
  const [selfEdit, setSelfEdit] = useState(field.selfEdit);
  const [personOnly, setPersonOnly] = useState(field.personOnly === true);
  const [options, setOptions] = useState(field.options.join('\n'));
  const [areaId, setAreaId] = useState(field.areaId);

  const usable = areas.filter((a) => a.heldEpochs > 0);
  const fixed = KIND_OF[identity] !== undefined || optionsOf !== undefined;
  const moving = areaId !== field.areaId;

  const about = (next: IdentityRole) => {
    const shaped = KIND_OF[next];
    if (shaped !== undefined) setKind(shaped);
    setIdentity(next);
  };

  return (
    <form
      className="wk-form wk-field-edit"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          label, help: help.trim() === '' ? null : help,
          options: kind === 'choice' ? options.split('\n') : [],
          kind, isRequired: required, isHalfWidth: field.isHalfWidth, identityRole: identity,
          selfEdit: selfEdit || personOnly, personOnly, areaId
        });
      }}
    >
      <label className="wk-field">
        <span>Czego dotyczy</span>
        <select value={identity} onChange={(e) => about(e.target.value as IdentityRole)}>
          {IDENTITY_ROLES.map((r) => (
            <option key={r} value={r} disabled={r !== 'none' && taken.includes(r)}>
              {IDENTITY_LABEL[r]}{r !== 'none' && taken.includes(r) ? ' — już jest w formularzu' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="wk-field">
        <span>Pytanie</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>

      {kind === 'consent' ? (
        <ConsentText kind={kind} value={help} onChange={setHelp} edited />
      ) : (
        <label className="wk-field">
          <span>Podpowiedź pod pytaniem (opcjonalnie)</span>
          <input value={help} onChange={(e) => setHelp(e.target.value)} />
        </label>
      )}

      <label className="wk-field">
        <span>Rodzaj</span>
        <select value={kind} disabled={fixed} onChange={(e) => setKind(e.target.value as FieldKind)}>
          {FIELD_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <span className="wk-hint">
          {optionsOf !== undefined ? `Ustala wymaganie „${optionsOf}”.`
            : fixed ? 'Wynika z tego, czego dotyczy pytanie.' : 'Rodzaj zmienisz tylko, dopóki nikt nie odpowiedział.'}
        </span>
      </label>

      {kind === 'choice' && (
        <label className="wk-field">
          <span>{optionsOf === undefined ? 'Możliwości — jedna w wierszu' : `Możliwości — ustala je wymaganie „${optionsOf}” (zmienisz je w jego ustawieniach)`}</span>
          <textarea rows={3} value={options} readOnly={optionsOf !== undefined} onChange={(e) => setOptions(e.target.value)} />
        </label>
      )}

      <label className="wk-field">
        <span>Odpowiedzi trafiają do obszaru</span>
        <AreaPick label="Odpowiedzi trafiają do obszaru" value={areaId} onChange={setAreaId} areas={areas} only={usable} />
        {moving && (
          <span className="wk-hint">
            Zebrane odpowiedzi przeniosą się do nowego obszaru.
          </span>
        )}
      </label>

      <label className="wk-field">
        <span>
          <input type="checkbox" checked={required} onChange={() => setRequired(!required)} />
          {' '}Wymagane
        </span>
      </label>

      <WhoEditsBox selfEdit={selfEdit} personOnly={personOnly} onChange={(next) => { setSelfEdit(next.selfEdit); setPersonOnly(next.personOnly); }} />

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || label.trim() === ''}>
          {moving ? 'Zapisz i przenieś odpowiedzi' : 'Zapisz'}
        </button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={onCancel}>Anuluj</button>
      </div>
    </form>
  );
}

/**
 * DARF ER DAS SPÄTER SELBST ÄNDERN? (0044)
 *
 * Eine Eigenschaft der Frage, nicht der Seite, auf der die Antwort erscheint —
 * und der Dienst prüft sie bei jeder Berichtigung über den Link. Die Kanzlei
 * selbst ändert weiter alles.
 */
/**
 * KTO ZMIENIA ODPOWIEDŹ — eine Wahl statt eines Hakens (0044, 0093). Die
 * dritte Möglichkeit ist die für die eigenen Worte eines Menschen (seine
 * Ziele, ein Zeugnis): die Kanzlei liest, ändert aber nie; der Dienst lehnt
 * es ab, nicht nur die Oberfläche.
 */
const WHO_EDITS: readonly { key: 'both' | 'office' | 'person'; label: string; says: string }[] = [
  { key: 'both', label: 'Osoba i kancelaria', says: 'Osoba w swoim portalu zobaczy „Popraw dane"; kancelaria też może poprawić.' },
  { key: 'office', label: 'Tylko kancelaria', says: 'Osoba zobaczy odpowiedź, ale zmienić ją może tylko kancelaria.' },
  { key: 'person', label: 'Tylko osoba', says: 'Wpisuje i poprawia tylko sama osoba (przez swój link). Kancelaria może ją czytać, ale nie zmieni jej ani nie wpisze za nią.' }
];

function WhoEditsBox({ selfEdit, personOnly, onChange }: {
  selfEdit: boolean;
  personOnly: boolean;
  onChange: (next: { selfEdit: boolean; personOnly: boolean }) => void;
}) {
  const now = personOnly ? 'person' : selfEdit ? 'both' : 'office';
  const name = useId();
  return (
    <fieldset className="wk-field wk-who-edits">
      <legend>Kto może zmieniać odpowiedź</legend>
      <div className="wk-seg" role="radiogroup">
        {WHO_EDITS.map((one) => (
          <label key={one.key} className={one.key === now ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}>
            <input type="radio" name={name} value={one.key} checked={one.key === now} data-who-edits={one.key}
              onChange={() => onChange({ selfEdit: one.key !== 'office', personOnly: one.key === 'person' })} />
            {one.label}
          </label>
        ))}
      </div>
      <span className="wk-hint">{WHO_EDITS.find((one) => one.key === now)?.says}</span>
    </fieldset>
  );
}
