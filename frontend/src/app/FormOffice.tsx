/**
 * Das Formular von innen — Fragen stellen, Antworten lesen.
 *
 * <b>Drei Dinge müssen stehen, bevor ein Formular etwas sammeln darf:</b>
 *
 * <code>
 *   ein Bereich          dessen Schlüssel die Fragen versiegelt
 *   ein Annahmepaar      dessen öffentliche Hälfte die Antworten verschliesst
 *   eine Klausel         die sagt, wer für die Daten geradesteht
 * </code>
 *
 * Fehlt das dritte, sammelt die öffentliche Seite nichts — und sagt warum.
 * Das ist keine Vorsicht: Art. 13 verlangt, dass der Mensch VORHER weiss, wer
 * seine Daten verarbeitet.
 *
 * <b>Antworten öffnet nur, wer den Schlüssel des AMTES hat.</b> Der private
 * Annahmeschlüssel liegt darunter — nicht unter der Epoche des Bereichs. Sonst
 * läse jeder Helfer sämtliche Einsendungen, ohne dass ihm jemand etwas gegeben
 * hätte.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadAreas, myEpochKeys, type AreaRow } from './area';
import {
  FIELD_KINDS, KIND_LABEL, addField, loadFields, loadRegistrations, openFields,
  hideSubmission, readSubmission, removeField, removeSubmission,
  type FieldKind, type OpenField, type SealedField, type Submission
} from './form';
import { createIntake, loadIntake, openIntakeKey, setController } from './intake';
import type { Ring, SealedRole } from './keys';
import { keysFor } from './ringOf';
import { WorkspaceError, type Who } from './session';

export function FormOffice({ partId, who }: { partId: string; who: Who }) {
  const [ring, setRing] = useState<Ring | null>(null);
  const [person, setPerson] = useState<SealedRole | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [fields, setFields] = useState<readonly OpenField[]>([]);
  const [submissions, setSubmissions] = useState<readonly Submission[]>([]);
  const [opened, setOpened] = useState<Map<string, Map<string, string>>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /**
   * Warum nichts dasteht, wenn nichts dasteht.
   *
   * Kein Fehler — eine Auskunft. Deshalb neben `failed` und nicht darin: „der
   * Schlüssel passt nicht zu diesen Hüllen" ist etwas anderes als „es ging
   * schief", und die Antwort darauf ist eine andere.
   */
  const [note, setNote] = useState<string | null>(null);

  /**
   * Welcher Bereich zuletzt aufgemacht wurde — damit „ukryj" und „usuń"
   * danach dieselbe Liste neu holen können, ohne dass jemand erneut auf
   * „Otwórz zgłoszenia" klicken muss.
   */
  const [lastArea, setLastArea] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  /**
   * Alles laden — aber NICHT alles oder nichts.
   *
   * <b>Vorher hing die ganze Ansicht an jedem einzelnen Schritt.</b> Der
   * Schlüsselbund wurde geholt, dann ALLE Bereiche dieses Menschen, dann je
   * Bereich sein Epochenschlüssel — und erst ganz am Ende standen die Fragen.
   * Ein Bereich, der seinen Schlüssel nicht hergab (eine fremde Epoche, ein
   * Bereich ohne Zuteilung), warf, und `setFields` kam nie: die Fragenliste
   * blieb leer, obwohl mit DIESEM Formular alles in Ordnung war. Auf dem Bild
   * sah es aus, als seien die Fragen gelöscht.
   *
   * Deshalb jetzt in der Reihenfolge der Wichtigkeit, und jeder Schritt für
   * sich: erst die Fragen (auch unlesbar sind sie besser als keine), dann die
   * Schlüssel, Bereich für Bereich und jeder in seinem eigenen Versuch.
   */
  const look = useCallback(async () => {
    let sealed: readonly SealedField[] = [];

    try {
      sealed = (await loadFields(partId)).fields;

      /* Zunächst ohne Beschriftung — dieselbe Gestalt, die `openFields` einem
         Feld ohne Schlüssel gibt. Gleich darunter werden sie lesbar. */
      setFields(sealed.map((f) => ({ ...f, label: null, help: null, options: [] })));
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać pytań.');
      return;
    }

    let bund: Ring | null = null;

    try {
      const keys = await keysFor(who);
      bund = keys.ring;
      setRing(bund);
      setPerson(keys.graph.roles.find((r) => r.isPersonal) ?? null);
    } catch {
      // Ohne Schlüsselbund bleiben die Fragen zu. Sie stehen trotzdem da.
      setRing(null);
    }

    let mine: readonly AreaRow[] = [];

    try {
      mine = (await loadAreas()).areas;
      setAreas(mine);
    } catch {
      setAreas([]);
    }

    if (bund === null) return;

    /*
     * Die Schlüssel der Bereiche, die ich halte — JEDER in seinem eigenen
     * Versuch. Ein Bereich, der seinen nicht hergibt, lässt nur seine eigenen
     * Fragen zu; er nimmt nicht die der anderen mit.
     */
    const keys = new Map<string, Uint8Array>();

    for (const area of mine) {
      try {
        const held = await myEpochKeys(bund, area.areaId);
        const key = held.get(area.currentEpoch);
        if (key !== undefined) keys.set(area.areaId, key);
      } catch {
        // Eine fremde Epoche, keine Zuteilung. Kein Fehler — eine Auskunft.
      }
    }

    setFields(await openFields(sealed, keys));
  }, [who, partId]);

  useEffect(() => { void look(); }, [look]);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);

    try {
      await todo();
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  /**
   * Die Einsendungen aufmachen.
   *
   * Zwei Schritte je Wert: den Feldschlüssel mit dem privaten Annahmeschlüssel
   * auspacken, damit den Wert öffnen. Genau deshalb kann der Dienst nichts
   * davon lesen — er hat den ersten nie gesehen.
   */
  const read = async (areaId: string) => {
    if (ring === null) throw new WorkspaceError('Bez hasła w tej karcie nie da się otworzyć odpowiedzi.');

    const intake = await loadIntake(areaId);
    const privateKey = await openIntakeKey(intake, ring);

    setLastArea(areaId);

    const { registrations } = await loadRegistrations(partId, showHidden);
    setSubmissions(registrations);

    const out = new Map<string, Map<string, string>>();
    let sent = 0;
    let got = 0;

    for (const one of registrations) {
      const reading = await readSubmission(one, privateKey);
      out.set(one.registrationId, reading.values);
      sent += reading.sent;
      got += reading.opened;
    }

    setOpened(out);

    /*
     * WARUM NICHTS DASTEHT, wenn nichts dasteht. Ein leerer Kasten sieht aus
     * wie „noch keine Zgłoszenia" und ist es nicht — die drei Gründe sehen
     * gleich aus und sind völlig verschieden.
     */
    if (registrations.length === 0) {
      setNote('Jeszcze nikt się nie zapisał.');
    } else if (sent === 0) {
      setNote(
        'Zgłoszenia są, ale usługa nie wydała ich treści: żadne pytanie tego '
        + 'formularza nie należy do obszaru, który czytasz. Poproś o dostęp do '
        + 'obszaru, do którego trafiają odpowiedzi.');
    } else if (got === 0) {
      setNote(
        `Przyszło ${sent} zapieczętowanych odpowiedzi i żadna się nie otworzyła. `
        + 'Ten klucz przyjmowania nie pasuje do tych kopert. Zwykle znaczy to, że '
        + 'wpisy powstały pod inną parą kluczy tego obszaru albo pod wcześniejszą '
        + 'wersją strony — takich wpisów nie da się już odzyskać, trzeba je zebrać '
        + 'ponownie.');
    } else if (got < sent) {
      setNote(`Otwarto ${got} z ${sent} odpowiedzi. Reszta nie pasuje do tego klucza.`);
    } else {
      setNote(null);
    }
  };

  const areasHere = [...new Set(fields.map((f) => f.areaId))];

  return (
    <>
      <h3 className="wk-h2">Formularz</h3>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}

      {ring === null && (
        <p className="wk-note">Bez hasła nie da się ani zapieczętować pytania, ani otworzyć odpowiedzi.</p>
      )}

      {/* -- Die Fragen --------------------------------------------------- */}

      {fields.length === 0 ? (
        <p className="wk-empty">Jeszcze żadnego pytania.</p>
      ) : (
        <ul className="wk-list">
          {fields.map((f) => (
            <li className="wk-row" key={f.fieldId}>
              <span>
                <strong>{f.label ?? 'zapieczętowane'}</strong>
                <span className="wk-row-side">
                  {' · '}{KIND_LABEL[f.kind]}
                  {f.isRequired && ' · wymagane'}
                  {f.identityRole !== 'none' && ` · ${f.identityRole}`}
                </span>
              </span>

              <button
                type="button" className="wk-link-btn" disabled={busy !== null}
                onClick={() => void act('Usuwanie…', () => removeField(f.fieldId))}
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}

      {ring !== null && (
        <NewFieldForm
          areas={areas}
          ring={ring}
          partId={partId}
          position={fields.length}
          busy={busy !== null}
          onAdded={() => void look()}
          onError={setFailed}
        />
      )}

      {/* -- Annahme und Klausel ------------------------------------------ */}

      {ring !== null && person !== null && areasHere.map((areaId) => (
        <IntakeSetup
          key={areaId}
          areaId={areaId}
          areaName={areas.find((a) => a.areaId === areaId)?.name ?? areaId.slice(0, 8)}
          ring={ring}
          officeRoleId={person.id}
          busy={busy !== null}
          onAct={act}
        />
      ))}

      {/* -- Die Antworten ------------------------------------------------ */}

      <h4 className="wk-h2">Zgłoszenia</h4>

      {areasHere.length === 0 ? (
        <p className="wk-empty">Najpierw pytania.</p>
      ) : (
        <div className="wk-actions">
          {areasHere.map((areaId) => (
            <button
              key={areaId} type="button" className="wk-btn" disabled={busy !== null}
              onClick={() => void act('Otwieranie…', () => read(areaId))}
            >
              Otwórz zgłoszenia
            </button>
          ))}
        </div>
      )}

      {submissions.length > 0 && (
        <>
          <p className="wk-hint">
            <strong>„Ukryj" nic nie kasuje</strong> — wiersz znika z listy, a
            zapieczętowane odpowiedzi leżą dalej. <strong>„Usuń bezpowrotnie"</strong> kasuje
            same odpowiedzi: nikt ich potem nie odtworzy, także prowadzący
            usługę, bo nigdy nie mógł ich przeczytać. Miejsce kandydata zostaje —
            zabierasz zgłoszenie, nie dostęp.
          </p>

          <label className="wk-field">
            <span>
              <input
                type="checkbox" checked={showHidden}
                onChange={(e) => {
                  setShowHidden(e.target.checked);
                  if (lastArea !== null) void act('Wczytywanie…', () => read(lastArea));
                }}
              />
              {' '}Pokaż też ukryte
            </span>
          </label>
        </>
      )}

      {note !== null && <p className="wk-note">{note}</p>}

      {submissions.length > 0 && (
        <ul className="wk-list">
          {submissions.map((s) => (
            <li className="wk-row" key={s.registrationId}>
              <span>
                <span className="wk-row-side">
                  {new Date(s.submittedAt).toLocaleString('pl-PL')}
                  {s.seatId !== null && ' · z miejsca'}
                  {s.withdrawnAt !== null && ' · wycofane'}
                  {s.hidden && ' · ukryte'}
                </span>

                {/*
                  ZWEI VERSCHIEDENE DINGE, nebeneinander und verschieden
                  benannt. „Ukryj" räumt die Liste auf und lässt die Hüllen
                  liegen; „Usuń" nimmt die Bytes fort. Ein Knopf für beides
                  wäre der bequeme Weg und eine Unwahrheit gegenüber dem, der
                  um Löschung bittet.
                */}
                <span className="wk-row-side">
                  <button
                    type="button" className="wk-link-btn" disabled={busy !== null}
                    onClick={() => void act(s.hidden ? 'Przywracanie…' : 'Ukrywanie…', async () => {
                      await hideSubmission(s.registrationId, !s.hidden);
                      if (lastArea !== null) await read(lastArea);
                    })}
                  >
                    {s.hidden ? 'Przywróć' : 'Ukryj'}
                  </button>
                  {' · '}
                  <button
                    type="button" className="wk-link-btn" disabled={busy !== null}
                    onClick={() => void act('Usuwanie…', async () => {
                      await removeSubmission(s.registrationId);
                      if (lastArea !== null) await read(lastArea);
                    })}
                  >
                    Usuń bezpowrotnie
                  </button>
                </span>

                {/*
                  ÜBER DAS GEÖFFNETE laufen, nicht über die Fragen.
                  Andersherum verschwand eine Zeile ganz, sobald die Fragenliste
                  leer war oder ein Feld inzwischen gelöscht wurde — der Wert
                  war da, und zu sehen war nichts. Eine Antwort, deren Frage
                  fehlt, steht jetzt mit ihrer Kennung da: unschön und wahr.
                */}
                <Answers
                  values={opened.get(s.registrationId)}
                  fields={fields}
                  sealed={s.values.length}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
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
function Answers({ values, fields, sealed }: {
  values: Map<string, string> | undefined;
  fields: readonly OpenField[];
  sealed: number;
}) {
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
            <li key={id}><strong className="wk-row-side">{id.slice(0, 8)}:</strong> {text}</li>
          ))}
        </ul>
      </>
    );
  }

  /* Erst die bekannten Fragen der Reihe nach, dann alles Übrige. */
  const known = fields.filter((f) => values.has(f.fieldId));
  const rest = [...values.keys()].filter((id) => !fields.some((f) => f.fieldId === id));

  return (
    <ul className="wk-tile-lines">
      {known.map((f) => (
        <li key={f.fieldId}>
          <strong>{f.label ?? 'zapieczętowane pytanie'}:</strong> {values.get(f.fieldId)}
        </li>
      ))}

      {rest.map((id) => (
        <li key={id}>
          <strong className="wk-row-side">pytanie usunięte ({id.slice(0, 8)}):</strong> {values.get(id)}
        </li>
      ))}
    </ul>
  );
}

/* -- Eine Frage stellen ----------------------------------------------------- */

function NewFieldForm({ areas, ring, partId, position, busy, onAdded, onError }: {
  areas: readonly AreaRow[];
  ring: Ring;
  partId: string;
  position: number;
  busy: boolean;
  onAdded: () => void;
  onError: (message: string | null) => void;
}) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<FieldKind>('line');
  const [areaId, setAreaId] = useState('');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');
  const [working, setWorking] = useState(false);

  const usable = areas.filter((a) => a.heldEpochs > 0);

  const go = async () => {
    const area = usable.find((a) => a.areaId === areaId);
    if (area === undefined) return;

    setWorking(true);
    onError(null);

    try {
      const keys = await myEpochKeys(ring, area.areaId);
      const areaKey = keys.get(area.currentEpoch);

      if (areaKey === undefined) throw new WorkspaceError('Nie masz klucza tej epoki.');

      await addField(partId, {
        areaId: area.areaId, areaKey, epoch: area.currentEpoch,
        kind, position, label,
        options: kind === 'choice' ? options.split('\n') : undefined,
        isRequired: required
      });

      setLabel('');
      setOptions('');
      onAdded();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się dodać pytania.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void go(); }}>
      <h4 className="wk-h2">Dodaj pytanie</h4>

      <label className="wk-field">
        <span>Pytanie</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="np. Imię i nazwisko" />
      </label>

      <label className="wk-field">
        <span>Rodzaj</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as FieldKind)}>
          {FIELD_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </label>

      {kind === 'choice' && (
        <label className="wk-field">
          <span>Możliwości — jedna w wierszu</span>
          <textarea rows={3} value={options} onChange={(e) => setOptions(e.target.value)} />
        </label>
      )}

      {/*
        WOHIN die Antwort geht. Je Feld, nicht je Formular — damit ein Bogen
        Fragen stellen kann, deren Antworten an verschiedene Stellen gehören.
      */}
      <label className="wk-field">
        <span>Odpowiedzi trafiają do obszaru</span>
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">—</option>
          {usable.map((a) => <option key={a.areaId} value={a.areaId}>{a.name}</option>)}
        </select>
      </label>

      <label className="wk-field">
        <span>
          <input type="checkbox" checked={required} onChange={() => setRequired(!required)} />
          {' '}Wymagane
        </span>
      </label>

      <p className="wk-hint">
        Pytanie zostanie zapieczętowane kluczem tego obszaru. Publicznie
        czytelne będzie tylko wtedy, gdy epoka obszaru jest ujawniona — inaczej
        nikt z zewnątrz nie odczyta nawet pytania.
      </p>

      <div className="wk-actions">
        <button
          type="submit" className="wk-btn"
          disabled={busy || working || label.trim() === '' || areaId === ''}
        >
          {working ? 'Dodawanie…' : 'Dodaj'}
        </button>
      </div>
    </form>
  );
}

/* -- Annahme und Klausel ---------------------------------------------------- */

function IntakeSetup({ areaId, areaName, ring, officeRoleId, busy, onAct }: {
  areaId: string;
  areaName: string;
  ring: Ring;
  officeRoleId: string;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [has, setHas] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    let alive = true;
    void loadIntake(areaId)
      .then(() => { if (alive) setHas(true); })
      .catch(() => { if (alive) setHas(false); });
    return () => { alive = false; };
  }, [areaId]);

  return (
    <section className="wk-form">
      <h4 className="wk-h2">Przyjmowanie — {areaName}</h4>

      {has === false && (
        <>
          <p className="wk-hint">
            Ten obszar nie ma jeszcze klucza przyjmowania. Bez niego nikt z
            zewnątrz nie zamknie odpowiedzi tak, żeby tylko kancelaria je
            otworzyła.
          </p>
          <div className="wk-actions">
            <button
              type="button" className="wk-btn" disabled={busy}
              onClick={() => void onAct('Tworzenie klucza — to potrwa…',
                () => createIntake(ring, areaId, officeRoleId).then(() => setHas(true)))}
            >
              Utwórz klucz przyjmowania
            </button>
          </div>
          <p className="wk-hint">
            Powstaje RSA-4096 — kilka sekund. Klucz prywatny zostanie
            zapieczętowany kluczem Twojej roli, nie epoką: inaczej każdy członek
            obszaru czytałby wszystkie zgłoszenia.
          </p>
        </>
      )}

      {has === true && (
        <>
          <label className="wk-field">
            <span>Kto odpowiada za dane</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Parafia św. Anny" />
          </label>

          <label className="wk-field">
            <span>Adres</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>

          <p className="wk-hint">
            To jest jawne i musi takie być: klauzula stoi pod formularzem, zanim
            ktokolwiek cokolwiek wpisze. Bez niej formularz nic nie zbiera.
          </p>

          <div className="wk-actions">
            <button
              type="button" className="wk-btn" disabled={busy || name.trim() === ''}
              onClick={() => void onAct('Zapisywanie…',
                () => setController(areaId, { name, address }))}
            >
              Zapisz klauzulę
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default FormOffice;
