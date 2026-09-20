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

import { loadAreas, loadPublicKey, myEpochKeys, type AreaRow } from './area';
import { fromBase64Url } from './crypto';
import {
  FIELD_KINDS, KIND_LABEL, addField, loadFields, loadRegistrations, openFields,
  armCheck, hideSubmission, readSubmission, removeField, removeSubmission, reviseAsOffice,
  setPartConfig,
  type ValueCheck,
  type FieldKind, type OpenField, type SealedField, type Submission
} from './form';
import { createIntake, loadIntake, loadPublicIntake, openIntakeKey, setController } from './intake';
import type { Ring, SealedRole } from './keys';
import { keysFor } from './ringOf';
import { officeSeatKey, loadSeats, relinkSeat, seatPath, type SeatRow } from './seat';
import { WorkspaceError, type Who } from './session';
import { firstPhone, joinPhones, normalisePhone, splitPhones } from './phone';
import { holesFor, missingIn, renderSms } from './sms';

export function FormOffice({ partId, config, who }: {
  partId: string;

  /** Der Baustein selbst — daraus kommt die Vorlage der Nachricht. */
  config: Record<string, string>;

  who: Who;
}) {
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
   * Die Einstellungen, nachdem HIER etwas gespeichert wurde.
   *
   * Der Baustein gehört der Seite darüber, und die lädt sich nicht neu, bloss
   * weil hier ein Satz getippt wurde. Ohne diesen Schatten stünde nach dem
   * Speichern wieder der alte Text da — als wäre nichts angekommen.
   */
  const [saved, setSaved] = useState<Record<string, string> | null>(null);
  const conf = saved ?? config;

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

    /*
     * DIE KANZLEI DARF NICHT WENIGER SEHEN ALS EIN FREMDER.
     *
     * Die Beschriftungen liegen unter dem Epochenschlüssel. Oben kommt er aus
     * der ZUTEILUNG — dem Weg des Amtes. Ein öffentliches Formular setzt aber
     * voraus, dass derselbe Schlüssel VERÖFFENTLICHT ist (sonst hätte niemand
     * das Formular lesen können), und die beiden Wege können auseinanderfallen:
     * eine Zuteilung aus einer anderen Epoche, eine Rolle, deren Zuteilung
     * fehlt, ein Bereich, den `loadAreas` nicht führt.
     *
     * Dann stand in der Kanzlei „zapieczętowane", während draussen jeder die
     * Frage lesen konnte — die absurde Richtung. Also wird der veröffentlichte
     * Schlüssel nachgeschlagen, und zwar nur für die Bereiche, die oben nichts
     * hergegeben haben: die Zuteilung bleibt der erste Weg.
     */
    for (const areaId of new Set(sealed.map((f) => f.areaId))) {
      if (keys.has(areaId)) continue;

      try {
        keys.set(areaId, fromBase64Url((await loadPublicKey(areaId)).key));
      } catch {
        // Nicht offengelegt und keine Zuteilung: die Frage bleibt zu, zu Recht.
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

  /*
   * Welche Nummern anders dastehen, als sie heute gespeichert würden. Gerechnet
   * wird auf dem, was AUFGEGANGEN ist — eine Hülle, die niemand öffnen kann,
   * lässt sich auch nicht geraderücken.
   */
  const phoneFields = fields.filter((f) => f.kind === 'phone');

  const crooked = submissions.flatMap((s) => {
    const opened_ = opened.get(s.registrationId);
    if (opened_ === undefined) return [];

    return phoneFields.flatMap((f) => {
      const raw = opened_.get(f.fieldId);
      if (raw === undefined || raw.trim() === '') return [];

      const tidy = joinPhones(splitPhones(raw)
        .map((one) => normalisePhone(one) ?? one));

      return tidy === raw ? [] : [{ registrationId: s.registrationId, fieldId: f.fieldId, tidy }];
    });
  });

  /**
   * Sie alle auf einmal geraderücken.
   *
   * <b>Der Platzschlüssel muss mit.</b> Eine Korrektur, die den Wert nur für
   * das Amt neu versiegelt, nähme dem Menschen seine eigene Angabe weg — in
   * seinem Portal stünde danach nichts mehr. Deshalb wird er für jede
   * Einsendung mit Platz geholt (über die Epoche oder die Annahme, 0027).
   */
  const straighten = async () => {
    if (ring === null) throw new WorkspaceError('Bez hasła nie da się poprawić.');
    if (lastArea === null) throw new WorkspaceError('Najpierw otwórz zgłoszenia.');

    const intake = await loadPublicIntake(lastArea);
    const byRegistration = new Map<string, { fieldId: string; value: string }[]>();

    for (const one of crooked) {
      const list = byRegistration.get(one.registrationId) ?? [];
      list.push({ fieldId: one.fieldId, value: one.tidy });
      byRegistration.set(one.registrationId, list);
    }

    for (const [registrationId, answers] of byRegistration) {
      const seatId = submissions.find((s) => s.registrationId === registrationId)?.seatId ?? null;

      const seatKey = seatId === null
        ? null
        : await seatRowOf(seatId, ring).then((r) => r.key).catch(() => null);

      await reviseAsOffice(registrationId, answers, {
        intakePublic: fromBase64Url(intake.publicKey),
        seatKey
      });
    }

    if (lastArea !== null) await read(lastArea);
  };

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

      {/*
        DIE NACHRICHTENVORLAGE STEHT HIER, nicht in den Rastereinstellungen.
        Sie wird gedacht, wenn jemand vor den Einsendungen sitzt — und dafür
        die Seite zu verlassen ist der Umweg, der dazu führt, dass niemand sie
        je schreibt.

        SIE HÄNGT AN KEINER BEDINGUNG. Zuerst stand sie hinter `areasHere`,
        und das war derselbe Fehler zweimal: `areasHere` kommt aus den Fragen,
        die Fragen kommen aus den Schlüsseln — also verschwand der Kasten genau
        dann, wenn beim Aufschliessen etwas schiefging. Eine Vorlage ist aber
        blosser Text am Baustein. Sie braucht keinen Schlüssel, keinen Bereich
        und keine einzige Einsendung, und wer die Seite führen darf, darf sie
        schreiben.
      */}
      <Template
        partId={partId}
        value={conf.sms ?? ''}
        labels={fields.map((f) => f.label)}
        busy={busy !== null}
        onSaved={setSaved}
        onError={setFailed}
      />

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

      {/*
        DIE ALTEN NUMMERN GERADEZIEHEN.

        Was vor den Plättchen eingetragen wurde, steht da, wie es getippt wurde:
        „600700800", „600-700-800". Der Dienst kann das nicht richten — er liest
        die Werte nicht. Also tut es die Kanzlei, die den Annahmeschlüssel hat,
        und zwar einmal für alle.

        Sie erscheint nur, wenn es wirklich etwas zu richten GIBT: ein Knopf,
        der nichts tut, ist ein Knopf, den man beim nächsten Mal wieder drückt.
      */}
      {crooked.length > 0 && (
        <p className="wk-note">
          {crooked.length === 1
            ? 'Jeden numer telefonu jest zapisany w innej postaci niż reszta.'
            : `${crooked.length} numerów telefonu jest zapisanych w innej postaci niż reszta.`}
          {' '}
          <button
            type="button" className="wk-link-btn" disabled={busy !== null}
            onClick={() => void act('Poprawianie numerów…', straighten)}
          >
            Popraw je na +48 …
          </button>
        </p>
      )}

      {/*
        WARUM DER KNOPF FEHLT, wenn er fehlt.

        Er erschien nur, wenn es etwas zu richten gab — und sah damit in drei
        ganz verschiedenen Lagen gleich aus: alles in Ordnung, nichts
        aufgemacht, oder die Antworten gehören zu gelöschten Fragen. Die dritte
        ist die, die hier wirklich vorkam, und sie ist nicht zu erraten: ohne
        die Frage weiss niemand, dass „123456789" eine Nummer sein sollte, und
        ein Geburtsdatum liesse sich genauso gut für eine halten.
      */}
      {submissions.length > 0 && crooked.length === 0 && (
        <p className="wk-hint">
          {opened.size === 0
            ? 'Numery telefonów można poprawić po otwarciu zgłoszeń.'
            : fields.length === 0
              ? 'Póki pytania się nie otworzyły, nie wiadomo, które odpowiedzi są '
                + 'numerami — i nie ma czego poprawiać.'
              : phoneFields.length === 0
                ? 'Ten formularz nie ma dziś pytania o telefon, więc nie ma czego '
                  + 'poprawiać. Odpowiedzi przy usuniętych pytaniach zostają tak, jak '
                  + 'je wpisano — bez pytania nie wiadomo, że to numer.'
                : 'Wszystkie numery są już w jednej postaci.'}
        </p>
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

                {/*
                  DER LINK UND DIE NACHRICHT — nur, wo es einen Platz gibt.
                  Eine Einsendung ohne Platz (nur mit Quittung) hat nichts, worauf
                  ein Link zeigen könnte; dort wäre der Knopf ein Versprechen.
                */}
                {s.seatId !== null && (
                  <SendPanel
                    seatId={s.seatId}
                    registrationId={s.registrationId}
                    checks={s.checks}
                    values={opened.get(s.registrationId)}
                    fieldsByLabel={fields}
                    template={conf.sms ?? ''}
                    ring={ring}
                    onError={setFailed}
                  />
                )}
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

/* -- Der Link und die Nachricht (0027/0029) -------------------------------- */

/**
 * Was die Kanzlei einem Menschen schickt.
 *
 * <b>Den alten Link gibt es nicht zurück.</b> Gespeichert ist nur sein
 * Abdruck — niemand kann ihn nachschlagen, auch der Betreiber nicht. „Wystaw
 * link" stellt deshalb einen NEUEN auf DENSELBEN Platz aus: der Platzschlüssel
 * bleibt, also behält der Mensch alles, was er schon eingetragen hat, und nur
 * die Hülle darum ist neu. Der vorige hört auf zu gelten — das ist der Zweck.
 *
 * <b>Die Nachricht steht daneben, fertig zum Kopieren.</b> Die Vorlage schreibt
 * die Kanzlei einmal am Baustein; hier wird eingesetzt, was dieser Mensch
 * eingetragen hat. Ein Platzhalter ohne Antwort bleibt sichtbar und wird oben
 * benannt — eine Nachricht mit einer stillen Lücke ginge sonst hinaus, ohne
 * dass jemand es merkt.
 */
function SendPanel({
  seatId, registrationId, values, fieldsByLabel, checks, template, ring, onError
}: {
  seatId: string;

  /** Welche Einsendung — eine Bestätigung hängt am WERT, nicht am Menschen. */
  readonly registrationId: string;

  values: Map<string, string> | undefined;
  fieldsByLabel: readonly OpenField[];

  /** Was an einzelnen Werten schon bestätigt ist (0030). */
  checks: readonly ValueCheck[];

  template: string;
  ring: Ring | null;
  onError: (message: string | null) => void;
}) {
  const [link, setLink] = useState<string | null>(null);

  /** Der Bestätigungslink — er entsteht auf Knopfdruck und steht dann einmal da. */
  const [checkLink, setCheckLink] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const byLabel = new Map<string, string>();

  if (values !== undefined) {
    for (const f of fieldsByLabel) {
      const v = values.get(f.fieldId);
      if (f.label !== null && v !== undefined) byLabel.set(f.label, v);
    }
  }

  /*
   * `{imie}` neben `{Imię i nazwisko}` — der Altbestand hatte beide, und aus
   * gutem Grund: „Cześć Anna Kowalska" grüsst niemand. Alles bis zum ersten
   * Leerzeichen; ein einwortiger Name ist sein eigener Vorname.
   */
  const nameField = fieldsByLabel.find((f) => f.identityRole === 'name');
  const fullName = nameField === undefined ? undefined : values?.get(nameField.fieldId);

  if (fullName !== undefined && fullName.trim() !== '') {
    byLabel.set('imie', fullName.trim().split(/\s+/)[0]);
    byLabel.set('osoba', fullName.trim());
  }

  /* Die Nummer, die das Telefon wählt — die erste des Telefonfeldes. */
  const phoneField = fieldsByLabel.find((f) => f.kind === 'phone');
  const number = phoneField === undefined
    ? null
    : firstPhone(values?.get(phoneField.fieldId) ?? '');

  /*
   * `{weryfikacja}` — der Link, mit dem der Mensch seine Nummer bestätigt
   * (0030). Er entsteht erst auf Knopfdruck: ein Geheimnis, das bei jedem
   * Aufschlagen der Liste neu gewürfelt würde, wäre bei jedem Aufschlagen ein
   * neues, und der zuletzt verschickte gälte nicht mehr.
   */
  if (checkLink !== null) byLabel.set('weryfikacja', checkLink);

  const text = template.trim() === '' ? '' : renderSms(template, byLabel, link);
  const gaps = template.trim() === '' ? [] : missingIn(template, byLabel, link);

  /** Was an DIESER Nummer schon bestätigt ist — oder aussteht. */
  const mark = phoneField === undefined
    ? undefined
    : checks.find((c) => c.fieldId === phoneField.fieldId);

  const verified = mark?.verifiedAt ?? null;

  const arm = async () => {
    if (phoneField === undefined) return;

    setBusy(true);
    onError(null);

    try {
      const { token } = await armCheck(registrationId, phoneField.fieldId);

      setCheckLink(
        `${window.location.origin}${window.location.pathname}#/verify/${encodeURIComponent(token)}`);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się przygotować linku.');
    } finally {
      setBusy(false);
    }
  };

  const issue = async () => {
    if (ring === null) { onError('Bez hasła nie da się wystawić linku.'); return; }

    setBusy(true);
    onError(null);

    try {
      const row = await seatRowOf(seatId, ring);
      const fresh = await relinkSeat(seatId, row.key);

      setLink(`${window.location.origin}${window.location.pathname}${seatPath(fresh, row.under)}`);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się wystawić linku.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wk-form">
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void issue()}>
          {busy ? 'Wystawianie…' : link === null ? 'Wystaw link' : 'Wystaw nowy link'}
        </button>

        {/*
          DER KLICK, DER DAS TELEFON ÖFFNET — wie im Altbestand
          (`AccessPanel.tsx`): `sms:<numer>?body=<treść>`. Auf einem Telefon
          steht danach die fertige Nachricht im Nachrichtenfenster, und es
          bleibt genau ein Handgriff: absenden.

          Ohne Nummer gibt es den Knopf nicht. Ein `sms:` ohne Ziel öffnet ein
          leeres Fenster, und das sieht aus, als sei etwas verlorengegangen.
        */}
        {number !== null && text !== '' && (
          <a className="wk-btn" href={`sms:${number}?body=${encodeURIComponent(text)}`}>
            Wyślij SMS
          </a>
        )}

        {number !== null && (
          <a className="wk-link-btn" href={`tel:${number}`}>Zadzwoń</a>
        )}

        {/*
          DEN BESTÄTIGUNGSLINK SCHARFSTELLEN (0030). Er ersetzt einen früheren,
          noch offenen — wer zweimal schickt, hat nicht zwei gültige Links,
          sondern einen neuen.
        */}
        {phoneField !== undefined && verified === null && (
          <button
            type="button" className="wk-link-btn" disabled={busy}
            onClick={() => void arm()}
          >
            {checkLink === null ? 'Dodaj link potwierdzający' : 'Nowy link potwierdzający'}
          </button>
        )}

        {text !== '' && (
          <button
            type="button" className="wk-link-btn"
            onClick={() => {
              void navigator.clipboard?.writeText(text)
                .then(() => setCopied(true)).catch(() => setCopied(false));
            }}
          >
            {copied ? 'Skopiowano' : 'Kopiuj wiadomość'}
          </button>
        )}
      </div>

      {number === null && text !== '' && (
        <p className="wk-hint">
          Ta osoba nie podała numeru — zostaje skopiowanie wiadomości.
        </p>
      )}

      {/*
        DER ZUSTAND DER NUMMER — drei, und sie sind verschieden: bestätigt,
        „Link ist draussen und wartet", nichts davon. Der mittlere ist der, den
        eine Kanzlei wirklich braucht: sie hat geschickt, es kam nichts zurück.
      */}
      {phoneField !== undefined && verified !== null && (
        <p className="wk-hint">
          <strong>Numer potwierdzony</strong>{' '}
          {new Date(verified).toLocaleDateString('pl-PL',
            { day: 'numeric', month: 'long', year: 'numeric' })}
          {' '}— ta osoba kliknęła link, który tam wysłaliście.
        </p>
      )}

      {phoneField !== undefined && verified === null && mark !== undefined && (
        <p className="wk-hint">
          Link potwierdzający wysłany{' '}
          {new Date(mark.sentAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })},
          {' '}bez odpowiedzi. Ważny do{' '}
          {new Date(mark.expiresAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}.
        </p>
      )}

      {checkLink !== null && (
        <>
          <p className="wk-hint">
            <strong>Ten link potwierdza numer</strong> — wstaw go do wiadomości
            przez <code>{'{weryfikacja}'}</code> albo wyślij osobno. Poprzedni,
            jeśli był, przestał działać.
          </p>
          <textarea readOnly rows={2} className="wk-mono" value={checkLink} />
        </>
      )}

      {link !== null && (
        <>
          <p className="wk-hint">
            <strong>Ten link widzisz tylko teraz</strong> — zapisany jest wyłącznie
            jego odcisk. Poprzedni przestał działać; wszystko, co ta osoba już
            wpisała, zostaje.
          </p>
          <textarea readOnly rows={2} className="wk-mono" value={link} />
        </>
      )}

      {template.trim() === '' ? (
        <p className="wk-hint">
          Napisz szablon wiadomości w ustawieniach tego bloku — np.{' '}
          <code>Cześć {'{Imię i nazwisko}'}! Twoja strona: {'{link}'}</code>
        </p>
      ) : (
        <>
          {gaps.length > 0 && (
            <p className="wk-blocker">
              Bez treści: {gaps.map((g) => `{${g}}`).join(', ')}
              {gaps.includes('link') && ' — najpierw wystaw link.'}
            </p>
          )}
          <textarea readOnly rows={4} value={text} />
        </>
      )}
    </div>
  );
}

/**
 * Den Platz eines Menschen aufmachen — über die Epoche oder über die Annahme.
 *
 * <b>Beide Wege, weil es beide gibt</b> (0027): ein Platz, den das Amt
 * ausgestellt hat, hängt an der Epoche; einer aus einer Selbstanmeldung an der
 * Annahme. Welcher, sagt die Zeile selbst.
 */
async function seatRowOf(seatId: string, ring: Ring): Promise<{ key: Uint8Array; under: string | null }> {
  const mine = (await loadAreas()).areas;

  for (const area of mine) {
    const { seats } = await loadSeats(area.areaId).catch(() => ({ seats: [] as readonly SeatRow[] }));
    const row = seats.find((s) => s.seatId === seatId);
    if (row === undefined) continue;

    const areaKey = (await myEpochKeys(ring, area.areaId)).get(area.currentEpoch);

    let intake: Uint8Array | undefined;
    if (row.origin === 'self') {
      intake = await openIntakeKey(await loadIntake(area.areaId), ring);
    }

    const key = await officeSeatKey(row, areaKey ?? new Uint8Array(32), intake);
    if (key === null) throw new WorkspaceError('Do tego miejsca nie ma klucza.');

    return { key, under: row.under };
  }

  throw new WorkspaceError('Tego miejsca nie ma wśród Twoich obszarów.');
}

/* -- Die Nachricht, einmal geschrieben ------------------------------------- */

/**
 * Die Vorlage der SMS — dort, wo die Einsendungen stehen.
 *
 * <b>Sie liegt im `config` des Bausteins</b> wie jede andere Einstellung, und
 * sie ist auch im Rasterentwurf zu sehen. Gespeichert wird sie hier aber
 * EINZELN (`setPartConfig`): der Entwurf schreibt beim Speichern die ganze
 * Seite, und wer nur einen Satz tippt, will nicht die Anordnung mitspeichern,
 * die er gar nicht angefasst hat.
 *
 * <b>Die Platzhalter stehen darunter, mit den Namen dieses Formulars.</b> Sie
 * zu erraten ist der Unterschied zwischen „geht nicht" und „geht" — eine Frage
 * heisst genau so, wie sie im Bogen steht, samt Grossschreibung und Leerzeichen.
 */
function Template({ partId, value, labels, busy, onSaved, onError }: {
  partId: string;
  value: string;
  labels: readonly (string | null)[];
  busy: boolean;
  onSaved: (next: Record<string, string>) => void;
  onError: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(value.trim() === '');

  const holes = holesFor(labels);
  const changed = draft !== value;

  const save = async () => {
    setSaving(true);
    onError(null);

    try {
      const done = await setPartConfig(partId, { sms: draft });
      onSaved(done.config);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać szablonu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h4 className="wk-h2">
        Szablon wiadomości
        {' '}
        <button type="button" className="wk-link-btn" onClick={() => setOpen(!open)}>
          {open ? 'Zwiń' : value.trim() === '' ? 'Napisz' : 'Zmień'}
        </button>
      </h4>

      {!open && value.trim() !== '' && (
        <p className="wk-card-muted" style={{ whiteSpace: 'pre-wrap' }}>{value}</p>
      )}

      {open && (
        <div className="wk-form">
          <label className="wk-field">
            <span>Treść — w nawiasach wstaw odpowiedź z formularza</span>
            <textarea
              rows={3}
              value={draft}
              disabled={busy || saving}
              placeholder={'Cześć {imie}! Twoja strona: {link}'}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>

          {/*
            Ein Klick setzt den Platzhalter ein — abgetippt wird er sonst falsch,
            und eine Frage heisst genau so, wie sie im Bogen steht.
          */}
          <p className="wk-hint">
            Wstaw:{' '}
            {holes.map((one) => (
              <button
                key={one} type="button" className="wk-link-btn"
                style={{ marginRight: '0.5rem' }}
                onClick={() => setDraft(`${draft}{${one}}`)}
              >
                {`{${one}}`}
              </button>
            ))}
          </p>

          <p className="wk-hint">
            <code>{'{link}'}</code> to strona osoby, <code>{'{weryfikacja}'}</code> — link
            potwierdzający numer, <code>{'{imie}'}</code> — samo imię.
            Czego nie da się wypełnić, zostaje widoczne w nawiasach.
          </p>

          <div className="wk-actions">
            <button
              type="button" className="wk-btn"
              disabled={busy || saving || !changed}
              onClick={() => void save()}
            >
              {saving ? 'Zapisywanie…' : 'Zapisz szablon'}
            </button>

            {changed && (
              <button
                type="button" className="wk-link-btn" disabled={saving}
                onClick={() => setDraft(value)}
              >
                Cofnij
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
