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

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { areaPath, loadAreas, loadPublicKey, myEpochKeys, type AreaRow } from './area';
import { fromBase64Url } from './crypto';
import {
  CHOOSABLE_IDENTITY, FIELD_KINDS, IDENTITY_LABEL, KIND_LABEL,
  addField, loadFields, loadRegistrations, openFields,
  armCheck, hideSubmission, readSubmission, removeField, removeSubmission, reviseAsOffice,
  rewrapToOffice, setPartConfig,
  type ValueCheck,
  type FieldKind, type IdentityRole, type OpenField, type SealedField, type Submission
} from './form';
import { createIntake, loadIntake, loadPublicIntake, openIntakeKey, setController } from './intake';
import type { Ring, SealedRole } from './keys';
import { Portal } from './Portal';
import { keysFor } from './ringOf';
import { selfOf } from './roles';
import {
  officeSeatKey, loadSeats, relinkSeat, revokeSeat, seatPath, type SeatRow
} from './seat';
import { WorkspaceError, type Who } from './session';
import { Unlock } from './Unlock';
import { dialable, joinPhones, normalisePhone, splitPhones, tidyPhones, withPhone } from './phone';
import { holesFor, missingIn, renderSms, smsHref, usesHole, VERIFY } from './sms';
import { AreaOptions } from './AreaOptions';
import { FormTable } from './FormTable';

/** Die drei Reiter eines Formulars. */
type FormTabName = 'edit' | 'entries' | 'people';

export function FormOffice({ partId, config, who, standsOn, settings, title }: {
  partId: string;

  /** Der Baustein selbst — daraus kommt die Vorlage der Nachricht. */
  config: Record<string, string>;

  who: Who;

  /**
   * Auf welchen Seiten dieser Bogen steht.
   *
   * <b>Aus den Daten, nicht aus dem Weg hierher.</b> Vorher stand hier die
   * eine Seite, über die jemand hereinkam — und wer denselben Baustein über
   * die Bausteinliste aufschlug, bekam `null` und damit eine Ansicht, in der
   * sich nichts einstellen liess.
   */
  standsOn?: readonly string[];

  /**
   * Was der Baustein selbst einstellt — Name, Bereich, wessen Formular. Es
   * steht im ersten Reiter, zusammen mit allem anderen, was man EINRICHTET.
   */
  settings?: ReactNode;

  /** Wie das Formular heisst — für den Namen der CSV-Datei. */
  title?: string;
}) {
  /*
   * DREI REITER, wie im Altbestand der Veranstaltungen (`events/admin`:
   * Strony · Dostęp · Ustawienia): EINRICHTEN, LESEN, HANDELN. Vorher stand
   * alles untereinander — Fragen, Annahme, Vorlage, Portal, und darunter die
   * Einsendungen —, und wer nur jemanden anrufen wollte, scrollte durch die
   * Einrichtung.
   */
  const [tab, setTab] = useState<FormTabName>('edit');

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
      // Die eigene PERSON — das Konto bekommt kein Postfach und keinen Termin (0040).
      setPerson(selfOf(keys.graph));
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

    /*
     * Der Schlüssel der AMTSROLLE — nicht der Epochenschlüssel. 0005 nennt den
     * Grund: läge die Annahme unter der Epoche, könnte jeder Helfer sämtliche
     * Anmeldungen lesen, ohne dass ihm jemand etwas gegeben hätte. Der Umbau
     * auf AES darf diese Trennung nicht nebenbei aufheben.
     */
    const officeKey = ring.has(intake.sealedForRoleId) ? ring.keyOf(intake.sealedForRoleId) : null;
    const pending: { fieldId: string; registrationId: string; officeKeySealed: string }[] = [];

    setLastArea(areaId);

    const { registrations } = await loadRegistrations(partId, showHidden);
    setSubmissions(registrations);

    const out = new Map<string, Map<string, string>>();
    let sent = 0;
    let got = 0;

    for (const one of registrations) {
      const reading = await readSubmission(one, privateKey, officeKey ?? undefined);
      out.set(one.registrationId, reading.values);
      sent += reading.sent;
      got += reading.opened;

      for (const one2 of reading.toRewrap) {
        pending.push({ ...one2, registrationId: one.registrationId });
      }
    }

    setOpened(out);

    /*
     * RSA IST DER UMSCHLAG, NICHT DER TRESOR (0037).
     *
     * Was gerade aufging, lag noch unter dem RSA-Umschlag der Annahme. Genau
     * jetzt liegt der Schlüssel offen — also wird er unter dem Schlüssel der
     * Amtsrolle neu versiegelt, und der Umschlag fällt.
     *
     * <b>Still und ohne Rückfrage</b>, weil nichts daran eine Entscheidung
     * ist: es ändert nicht, wer lesen darf, sondern nur, wogegen das
     * Gespeicherte auf Jahre standhalten muss. Schlägt es fehl, bleibt alles,
     * wie es war — gelesen wurde ohnehin schon.
     */
    if (pending.length > 0) {
      try {
        await rewrapToOffice(partId, pending);
      } catch {
        // Der alte Weg steht noch; beim nächsten Öffnen wieder.
      }
    }

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

      const tidy = tidyPhones(raw);

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

    /*
     * WIE VIELE ES WAREN, bevor es keine mehr sind. Nach dem Neulesen ist
     * `crooked` leer — dann liesse sich nicht mehr sagen, ob der Knopf zehn
     * Nummern gerichtet hat oder gar nichts tat.
     */
    const howMany = crooked.length;
    const people = new Set(crooked.map((one) => one.registrationId)).size;

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

    await read(lastArea);

    /*
     * ERST NACH `read` — es setzt seine eigene Auskunft und würde diese sonst
     * überschreiben.
     *
     * Und die Bestätigungen: wer eine Nummer neu schreibt, hat für den Dienst
     * eine ANDERE Nummer, und die ist ungeprüft (0030). Das geschieht
     * serverseitig, ohne dass jemand daran denken müsste — aber wer eben noch
     * ein Häkchen gesehen hat, soll erfahren, warum es weg ist.
     */
    setNote(
      howMany === 1
        ? 'Poprawiono numer telefonu w jednej odpowiedzi. Jeśli był potwierdzony, '
          + 'potwierdzenie wygasło — to już inny zapis numeru.'
        : `Poprawiono numery telefonu w ${howMany} odpowiedziach `
          + `(${people === 1 ? 'jedna osoba' : people + ' osób'}). `
          + 'Potwierdzenia tych numerów wygasły — to już inny zapis numeru.');
  };

  /*
   * AUFMACHEN, SOBALD MAN HINSIEHT. Wer den Reiter „Zgłoszenia" oder „Osoby"
   * öffnet, will die Einsendungen sehen — ein eigener Knopf davor war ein
   * Klick, der nichts entschied. Einmal, mit dem ersten Bereich; hat das
   * Formular mehrere, stehen ihre Knöpfe darüber.
   */
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    if (tab === 'edit' || autoTried || ring === null || lastArea !== null || areasHere.length === 0) return;
    setAutoTried(true);
    void act('Otwieranie zgłoszeń…', () => read(areasHere[0]));
  }, [tab, autoTried, ring, lastArea, areasHere.length]);

  const areaLabel = (areaId: string) =>
    areaPath(areas, areaId).short || areas.find((a) => a.areaId === areaId)?.name || areaId.slice(0, 8);

  const reread = async () => { if (lastArea !== null) await read(lastArea); };

  return (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}

      {/*
        NICHT NUR SAGEN, SONDERN ÖFFNEN. Hier stand bloss der Satz — und wer
        ihn las, hatte keinen Ort, das Passwort einzugeben, ausser in einer
        anderen Ansicht.
      */}
      {ring === null && (
        <Unlock
          who={who}
          why="Bez hasła nie da się ani zapieczętować pytania, ani otworzyć odpowiedzi."
          onDone={() => void look()}
        />
      )}

      <div className="wk-tabs" role="tablist">
        <FormTab now={tab} mine="edit" onPick={setTab}>Formularz</FormTab>
        <FormTab now={tab} mine="entries" onPick={setTab}>
          Zgłoszenia{submissions.length > 0 ? ` (${submissions.length})` : ''}
        </FormTab>
        <FormTab now={tab} mine="people" onPick={setTab}>Osoby</FormTab>
      </div>

      {/* == 1. EINRICHTEN ================================================== */}

      {tab === 'edit' && (
        <>
          {settings}

          {/*
            DIE ÜBERSCHRIFT DES BOGENS. Sie stand im Rastereditor, solange ein
            Bogen dort seine Felder hatte — seit er dort nur noch ausgewählt
            wird, gehört sie hierher, zu allem anderen, was ihm gehört.
          */}
          <Naming
            partId={partId}
            value={conf.title ?? ''}
            busy={busy !== null}
            onSaved={setSaved}
            onError={setFailed}
          />

          <h3 className="wk-h2">Pytania</h3>

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
                      {f.identityRole !== 'none' && ` · ${IDENTITY_LABEL[f.identityRole]}`}
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
              taken={fields.map((f) => f.identityRole).filter((r) => r !== 'none')}
              busy={busy !== null}
              onAdded={() => void look()}
              onError={setFailed}
            />
          )}

          {/* -- Annahme und Klausel -------------------------------------- */}

          {ring !== null && person !== null && areasHere.map((areaId) => (
            <IntakeSetup
              key={areaId}
              areaId={areaId}
              areaName={areaLabel(areaId)}
              ring={ring}
              officeRoleId={person.id}
              busy={busy !== null}
              onAct={act}
            />
          ))}

          {/*
            DIE NACHRICHT UND DAS PORTAL — was der Mensch bekommt, wenn ihm ein
            Link geschickt wird, und wohin der Link führt. Beides wird EINMAL
            eingerichtet; benutzt wird es drüben, bei den Osoby.
          */}
          <Template
            partId={partId}
            value={conf.sms ?? ''}
            labels={fields.map((f) => f.label)}
            busy={busy !== null}
            onSaved={setSaved}
            onError={setFailed}
          />

          <Portal
            moduleId={partId}
            standsOn={standsOn ?? []}
            portalUnder={(conf.portalUnder ?? '').trim()}
            ownerRoleId={person?.id ?? null}
            onSet={(where) => setSaved({ ...conf, portalUnder: where })}
          />
        </>
      )}

      {/* == 2 und 3: was dafür aufgemacht werden muss ======================== */}

      {tab !== 'edit' && (
        <>
          {areasHere.length === 0 ? (
            <p className="wk-empty">Najpierw pytania — bez nich nie ma zgłoszeń.</p>
          ) : (lastArea === null || areasHere.length > 1) && (
            <div className="wk-actions">
              {areasHere.map((areaId) => (
                <button
                  key={areaId} type="button"
                  className={areaId === lastArea ? 'wk-btn' : 'wk-link-btn'}
                  disabled={busy !== null || ring === null}
                  onClick={() => void act('Otwieranie…', () => read(areaId))}
                >
                  {areasHere.length > 1 ? `Otwórz: ${areaLabel(areaId)}` : 'Otwórz zgłoszenia'}
                </button>
              ))}
            </div>
          )}

          {note !== null && <p className="wk-note">{note}</p>}

          {lastArea !== null && (
            <label className="wk-field">
              <span>
                <input
                  type="checkbox" checked={showHidden}
                  onChange={(e) => {
                    setShowHidden(e.target.checked);
                    void act('Wczytywanie…', reread);
                  }}
                />
                {' '}Pokaż też ukryte
              </span>
            </label>
          )}
        </>
      )}

      {/* == 2. LESEN ======================================================= */}

      {tab === 'entries' && lastArea !== null && (
        <FormTable
          fields={fields}
          submissions={submissions}
          opened={opened}
          fileName={title ?? conf.title ?? 'zgloszenia'}
        />
      )}

      {/* == 3. HANDELN ===================================================== */}

      {tab === 'people' && lastArea !== null && (
        <>
          {/*
            „NORMALIZUJ NUMERY" STEHT IMMER DA, sobald das Formular überhaupt
            nach einer Nummer fragt — und nicht erst, wenn etwas krumm ist.
            Abgeblendet, mit dem Grund darunter.
          */}
          {phoneFields.length > 0 && (
            <div className="wk-actions">
              <button
                type="button" className="wk-link-btn"
                disabled={busy !== null || crooked.length === 0}
                onClick={() => void act('Poprawianie numerów…', straighten)}
              >
                {crooked.length === 0 ? 'Normalizuj numery' : `Normalizuj numery (${crooked.length})`}
              </button>
              <span className="wk-hint">
                {crooked.length === 0
                  ? 'Wszystkie numery są już w jednej postaci.'
                  : crooked.length === 1
                    ? 'Jeden numer jest zapisany inaczej niż reszta — zostanie zapisany jako +48 600 700 800.'
                    : `${crooked.length} numerów jest zapisanych inaczej niż reszta — zostaną zapisane jako +48 600 700 800.`}
              </span>
            </div>
          )}

          <People
            submissions={submissions}
            opened={opened}
            fields={fields}
            template={conf.sms ?? ''}
            areaId={lastArea}
            ring={ring}
            busy={busy !== null}
            onHide={(s) => void act(s.hidden ? 'Przywracanie…' : 'Ukrywanie…', async () => {
              await hideSubmission(s.registrationId, !s.hidden);
              await reread();
            })}
            onRemove={(s) => void act('Usuwanie…', async () => {
              await removeSubmission(s.registrationId);
              await reread();
            })}
            onError={setFailed}
            onChanged={reread}
          />
        </>
      )}
    </>
  );
}

/** Ein Reiter — dieselbe Gestalt wie in den Obszary. */
function FormTab({ now, mine, onPick, children }: {
  now: FormTabName;
  mine: FormTabName;
  onPick: (tab: FormTabName) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={now === mine}
      className={now === mine ? 'wk-tab wk-tab-on' : 'wk-tab'}
      onClick={() => onPick(mine)}
    >
      {children}
    </button>
  );
}

/* -- Die Menschen, die sich eingetragen haben ------------------------------- */

/**
 * Wer ein Mensch in dieser Liste ist: sein Name und die Nummer, die man wählt.
 *
 * <b>Aus den GENORMTEN Fragen zuerst</b> (0038): Imię und Nazwisko, sonst
 * das alte „name". Fehlt beides, die erste ausgefüllte einzeilige Antwort —
 * irgendetwas muss in der Zeile stehen, woran man den Menschen erkennt.
 */
function whoIn(
  values: Map<string, string> | undefined, fields: readonly OpenField[]
): { name: string; dial: string | null; shown: string | null } {
  if (values === undefined) return { name: '— zapieczętowane —', dial: null, shown: null };

  const of = (role: IdentityRole) => {
    const field = fields.find((f) => f.identityRole === role);
    return field === undefined ? null : values.get(field.fieldId)?.trim() || null;
  };

  const nick = of('nickname');
  const full = [of('given_name'), of('surname')].filter((part) => part !== null).join(' ') || of('name');
  const first = fields.find((f) => f.kind === 'line' && (values.get(f.fieldId)?.trim() ?? '') !== '');

  const name = full !== null
    ? (nick !== null ? `${full} („${nick}")` : full)
    : nick ?? (first === undefined ? null : values.get(first.fieldId)!.trim()) ?? '— bez imienia —';

  const phone = numbersOf(values, fields)[0];

  return { name, dial: phone?.dial ?? null, shown: phone?.shown ?? null };
}

/**
 * Wer sich eingetragen hat — EINE Zeile je Mensch, alles Weitere auf Abruf.
 *
 * <b>Nach dem Vorbild des Altbestands</b> (`events/admin/AccessPanel.tsx`):
 * eine Zeile ist ein Name und eine Nummer — die zwei Dinge, nach denen man am
 * Tag selbst greift —, dazu, woran der Mensch gerade ist. Alles andere liegt
 * hinter „Więcej": die Antworten, der Link mit der Nachricht, die
 * Bestätigung der Nummer, Ukryj und Usuń.
 *
 * <b>Die Nummer ist ein Anruf</b>, ein Tipp auf dem Telefon.
 */
function People({
  submissions, opened, fields, template, areaId, ring, busy, onHide, onRemove, onError, onChanged
}: {
  submissions: readonly Submission[];
  opened: Map<string, Map<string, string>>;
  fields: readonly OpenField[];
  template: string;
  areaId: string | null;
  ring: Ring | null;
  busy: boolean;
  onHide: (s: Submission) => void;
  onRemove: (s: Submission) => void;
  onError: (message: string | null) => void;
  onChanged: () => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = submissions
    .map((s) => ({ s, values: opened.get(s.registrationId), ...whoIn(opened.get(s.registrationId), fields) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  if (rows.length === 0) return <p className="wk-empty">Nikt się jeszcze nie zapisał.</p>;

  return (
    <section className="wk-panel">
      <h3 className="wk-h2">Osoby ({rows.length})</h3>

      <ul className="wk-entry-list">
        {rows.map(({ s, values, name, dial, shown }) => {
          const open = openId === s.registrationId;
          const verified = s.checks.some((c) => c.verifiedAt !== null);

          return (
            <li key={s.registrationId} className={s.hidden || s.withdrawnAt !== null ? 'wk-entry is-muted' : 'wk-entry'}>
              <div className="wk-entry-head">
                <strong className="wk-entry-name">{name}</strong>

                {dial !== null
                  ? <a className="wk-entry-phone" href={`tel:${dial}`}>{shown}</a>
                  : <span className="wk-hint">brak telefonu</span>}

                <span className="wk-tags">
                  {s.hidden && <span className="wk-tag">ukryte</span>}
                  {s.withdrawnAt !== null && <span className="wk-tag">wycofane</span>}
                  {s.seatId !== null
                    ? <span className="wk-tag wk-tag-open">link</span>
                    : <span className="wk-tag">bez linku</span>}
                  {verified && <span className="wk-tag wk-tag-open">numer potwierdzony</span>}
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
                  <p className="wk-hint">Wysłano {new Date(s.submittedAt).toLocaleString('pl-PL')}</p>

                  <Answers values={values} fields={fields} sealed={s.values.length} checks={s.checks} />

                  {/*
                    DER LINK UND DIE NACHRICHT — nur, wo es einen Platz gibt.
                    Eine Einsendung ohne Platz hat nichts, worauf ein Link
                    zeigen könnte; dort wäre der Knopf ein Versprechen.
                  */}
                  {s.seatId !== null ? (
                    <SendPanel
                      seatId={s.seatId}
                      registrationId={s.registrationId}
                      checks={s.checks}
                      values={values}
                      fieldsByLabel={fields}
                      template={template}
                      areaId={areaId}
                      ring={ring}
                      onError={onError}
                      onChanged={onChanged}
                    />
                  ) : (
                    <p className="wk-hint">To zgłoszenie przyszło bez miejsca — nie ma linku, który można by wysłać.</p>
                  )}

                  {/*
                    ZWEI VERSCHIEDENE DINGE, verschieden benannt. „Ukryj" räumt
                    die Liste auf und lässt die Hüllen liegen; „Usuń" nimmt die
                    Bytes fort — und fragt deshalb vorher, wie der Altbestand.
                  */}
                  <div className="wk-actions">
                    <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onHide(s)}>
                      {s.hidden ? 'Przywróć' : 'Ukryj'}
                    </button>
                    <button
                      type="button" className="wk-link-btn wk-danger" disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Usunąć zgłoszenie: ${name}? Odpowiedzi zostaną skasowane bez możliwości odtworzenia — także przez prowadzącego usługę.`)) {
                          onRemove(s);
                        }
                      }}
                    >
                      Usuń bezpowrotnie
                    </button>
                  </div>
                  <p className="wk-hint">
                    „Ukryj" nic nie kasuje — wiersz znika z listy, a zapieczętowane
                    odpowiedzi zostają. Miejsce osoby zostaje też po usunięciu:
                    zabierasz zgłoszenie, nie dostęp.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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
  values: Map<string, string> | undefined;
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
        <li key={f.fieldId}>
          <strong>{f.label ?? 'zapieczętowane pytanie'}:</strong>{' '}
          {values.get(f.fieldId)}{mark(f.fieldId)}
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
function NewFieldForm({ areas, ring, partId, position, taken, busy, onAdded, onError }: {
  areas: readonly AreaRow[];
  ring: Ring;
  partId: string;
  position: number;
  taken: readonly IdentityRole[];
  busy: boolean;
  onAdded: () => void;
  onError: (message: string | null) => void;
}) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<FieldKind>('line');
  const [areaId, setAreaId] = useState('');
  const [required, setRequired] = useState(false);
  const [identity, setIdentity] = useState<IdentityRole>('none');
  const [options, setOptions] = useState('');
  const [working, setWorking] = useState(false);

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

      await addField(partId, {
        areaId: area.areaId, areaKey, epoch: area.currentEpoch,
        kind, position, label,
        options: kind === 'choice' ? options.split('\n') : undefined,
        isRequired: required,
        identityRole: identity
      });

      setLabel('');
      setOptions('');
      setIdentity('none');
      setKind('line');
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
          {CHOOSABLE_IDENTITY.map((r) => (
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

      {/*
        WOHIN die Antwort geht. Je Feld, nicht je Formular — damit ein Bogen
        Fragen stellen kann, deren Antworten an verschiedene Stellen gehören.
      */}
      <label className="wk-field">
        <span>Odpowiedzi trafiają do obszaru</span>
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">—</option>
          <AreaOptions areas={areas} only={usable} />
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
/* -- Welche Werte Nummern sind --------------------------------------------- */

/** Eine Nummer dieser Einsendung — und woher wir wissen, dass es eine ist. */
type Numbered = {
  readonly fieldId: string;

  /** Wählbar, ohne Leerzeichen — das Ziel von `sms:` und `tel:`. */
  readonly dial: string;

  /** Lesbar, wie sie in der Liste steht. */
  readonly shown: string;

  /**
   * Die Frage dazu gibt es nicht mehr. Dass dies eine Nummer ist, schliessen
   * wir aus ihrer GESTALT — und deshalb entscheidet der Mensch, nicht wir.
   */
  readonly orphan: boolean;
};

/**
 * Die Nummern einer Einsendung.
 *
 * <b>Eine bekannte Frage sagt es selbst.</b> Steht dort „Telefon", sind es
 * Nummern; steht dort etwas anderes, sind es keine — auch dann nicht, wenn
 * neun Ziffern dastehen. `1993-07-16` ergibt `+4819930716`, und ein
 * Geburtsdatum als Handynummer zu führen ist schlimmer als gar nichts zu
 * erkennen.
 *
 * <b>Eine Frage, die es nicht mehr gibt, ist der andere Fall.</b> Dort steht
 * niemand mehr, der sagen könnte, was der Wert ist — aber die Kanzlei SIEHT
 * ihn. Sie bekommt den Knopf angeboten und entscheidet; geraten wird nur, wem
 * er angeboten wird, nie was damit geschieht.
 */
function numbersOf(
  values: Map<string, string> | undefined, fields: readonly OpenField[]
): readonly Numbered[] {
  if (values === undefined) return [];

  const out: Numbered[] = [];

  for (const [fieldId, text] of values) {
    const field = fields.find((f) => f.fieldId === fieldId);
    if (field !== undefined && field.kind !== 'phone') continue;

    for (const one of splitPhones(text)) {
      const dial = dialable(one);
      if (dial === null) continue;

      out.push({ fieldId, dial, shown: normalisePhone(one) ?? one, orphan: field === undefined });
    }
  }

  return out;
}

function SendPanel({
  seatId, registrationId, areaId, values, fieldsByLabel, checks, template, ring,
  onError, onChanged
}: {
  seatId: string;

  /** Welche Einsendung — eine Bestätigung hängt am WERT, nicht am Menschen. */
  readonly registrationId: string;

  /** Wohin die Antworten gehen — für den Annahmeschlüssel beim Umschreiben. */
  areaId: string | null;

  values: Map<string, string> | undefined;
  fieldsByLabel: readonly OpenField[];

  /** Was an einzelnen Werten schon bestätigt ist (0030). */
  checks: readonly ValueCheck[];

  template: string;
  ring: Ring | null;
  onError: (message: string | null) => void;

  /** Nach dem Umschreiben ist die Liste veraltet. */
  onChanged: () => Promise<void>;
}) {
  const [link, setLink] = useState<string | null>(null);

  /*
   * JEDE NUMMER IHREN EIGENEN LINK. Vorher stand hier ein einzelner
   * `checkLink` für die ganze Einsendung — und das war falsch, sobald ein
   * Bogen zwei Nummern trug: bestätigt wurde dann die eine mit dem Link der
   * anderen. Geschlüsselt wird nach der wählbaren Nummer, nicht nach dem Feld;
   * ein Feld kann mehrere tragen.
   */
  const [links, setLinks] = useState<ReadonlyMap<string, string>>(new Map());

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

  const numbers = numbersOf(values, fieldsByLabel);
  const orphans = numbers.filter((n) => n.orphan);

  /** Wohin ein umgeschriebener Wert gehört — die Frage von heute. */
  const livePhone = fieldsByLabel.find((f) => f.kind === 'phone');

  /** Die Nachricht, wie sie mit DIESEM Bestätigungslink dasteht. */
  const textFor = (verify: string | null): string => {
    if (template.trim() === '') return '';

    const filled = new Map(byLabel);
    if (verify !== null) filled.set(VERIFY, verify);

    return renderSms(template, filled, link);
  };

  const gapsFor = (verify: string | null): readonly string[] => {
    if (template.trim() === '') return [];

    const filled = new Map(byLabel);
    if (verify !== null) filled.set(VERIFY, verify);

    return missingIn(template, filled, link);
  };

  /*
   * Was ohne jede Nummer dasteht — die Vorschau unten. Ein Bestätigungslink
   * gehört dort NICHT hinein: welcher es wäre, entscheidet sich erst an der
   * Nummer, die angeklickt wird.
   */
  const preview = textFor(null);
  const gaps = gapsFor(null).filter((g) => g !== VERIFY || numbers.length === 0);

  const wantsVerify = usesHole(template, VERIFY);

  const base = () => `${window.location.origin}${window.location.pathname}`;

  /**
   * EIN KLICK AUF DIE NUMMER — und die Nachricht steht fertig im Telefon.
   *
   * <b>Der Bestätigungslink entsteht dabei</b>, für genau diese Nummer, und
   * nur wenn die Vorlage ihn einsetzt. Ihn bei jedem Aufschlagen der Liste zu
   * würfeln wäre das Gegenteil von Bestätigen: der zuletzt verschickte gälte
   * dann nicht mehr, ohne dass jemand etwas getan hätte.
   *
   * <b>Ein zweiter Klick würfelt nicht neu.</b> Wer dieselbe Nachricht noch
   * einmal öffnet, will sie noch einmal schicken — nicht den Link ungültig
   * machen, den er eben verschickt hat.
   */
  const write = async (one: Numbered) => {
    let verify = links.get(one.dial) ?? null;

    if (verify === null && wantsVerify && !one.orphan) {
      setBusy(true);
      onError(null);

      try {
        const { token } = await armCheck(registrationId, one.fieldId);

        verify = `${base()}#/verify/${encodeURIComponent(token)}`;
        setLinks(new Map(links).set(one.dial, verify));
      } catch (e) {
        onError(e instanceof WorkspaceError ? e.message : 'Nie udało się przygotować linku.');
        return;
      } finally {
        setBusy(false);
      }
    }

    window.location.href = smsHref(one.dial, textFor(verify));
  };

  /**
   * Einen verwaisten Wert auf die HEUTIGE Frage umschreiben.
   *
   * <b>Warum es das überhaupt braucht.</b> `value_check.field_id` zeigt auf
   * `slug_field` — eine Bestätigung ohne Frage kann es nicht geben, und das
   * ist richtig so. Wer sein Formular neu gebaut hat, trägt aber Antworten,
   * die auf die Fragen von gestern zeigen: lesbar, und trotzdem nicht zu
   * bestätigen. Hier werden sie an die Frage von heute gehängt.
   *
   * <b>Der Platzschlüssel muss mit</b> — wie bei jeder Korrektur der Kanzlei.
   * Ohne ihn stünde im Portal des Menschen hinterher nichts mehr.
   */
  const rebind = async () => {
    if (livePhone === undefined) return;
    if (ring === null) { onError('Bez hasła nie da się przepisać.'); return; }
    if (areaId === null) { onError('Najpierw otwórz zgłoszenia.'); return; }

    setBusy(true);
    onError(null);

    try {
      const intake = await loadPublicIntake(areaId);
      const seatKey = await seatRowOf(seatId, ring).then((r) => r.key).catch(() => null);

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

  const issue = async () => {
    if (ring === null) { onError('Bez hasła nie da się wystawić linku.'); return; }

    setBusy(true);
    onError(null);

    try {
      const row = await seatRowOf(seatId, ring);
      const fresh = await relinkSeat(seatId, row.key);

      setLink(`${base()}${seatPath(fresh, row.under)}`);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się wystawić linku.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Den Link ZURÜCKNEHMEN.
   *
   * <b>Er stand bei den Plätzen, und die Plätze sind fort</b> — sie waren
   * dieselbe Sache zweimal. Das Zurücknehmen war es nicht: es ist der einzige
   * Handgriff gegen einen Link, der in die falschen Hände geraten ist, und er
   * gehört an dieselbe Zeile wie das Ausstellen.
   *
   * <b>Es löscht nichts.</b> Die Einsendung bleibt, wo sie ist; was aufhört,
   * ist der Zugang über diesen Link. Wer ihn wieder braucht, bekommt mit
   * „Wystaw nowy link" einen neuen — der alte wird davon nicht wieder gültig.
   */
  const withdraw = async () => {
    setBusy(true);
    onError(null);

    try {
      await revokeSeat(seatId);
      setLink(null);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się wycofać linku.');
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

        <button
          type="button"
          className="wk-link-btn"
          disabled={busy}
          title="Link przestaje działać. Zgłoszenie zostaje."
          onClick={() => void withdraw()}
        >
          Wycofaj link
        </button>

        {/*
          DIE NUMMER IST DER KNOPF — wie im Altbestand (`AccessPanel.tsx`).
          Ein Klick stellt den Bestätigungslink für GENAU DIESE Nummer scharf,
          setzt ihn in die Vorlage und öffnet das Nachrichtenfenster mit
          fertigem Text. Es bleibt ein Handgriff: absenden.

          Vorher stand hier „Kopiuj wiadomość", und das war zwei Fehler in
          einem: die Kanzlei musste den Text von Hand in ein Fenster tragen,
          das sie selbst suchen musste — und dabei lag für alle Nummern
          derselbe Text im Zwischenspeicher, obwohl jede ihren eigenen Link
          braucht.
        */}
        {numbers.map((one) => (
          <button
            key={`${one.fieldId}|${one.dial}`}
            type="button"
            className="wk-btn"
            disabled={busy || template.trim() === ''}
            title={one.orphan
              ? 'Pytanie do tego numeru usunięte — bez potwierdzenia'
              : 'Napisz SMS z tym numerem'}
            onClick={() => void write(one)}
          >
            {busy ? 'Przygotowywanie…' : `SMS: ${one.shown}`}
            {checks.some((c) => c.fieldId === one.fieldId && c.verifiedAt !== null) ? ' ✓' : ''}
          </button>
        ))}

        {numbers.map((one) => (
          <a key={`tel|${one.dial}`} className="wk-link-btn" href={`tel:${one.dial}`}>
            Zadzwoń {one.shown}
          </a>
        ))}

        {/*
          KOPIEREN BLEIBT NUR, WO ES NICHTS ANZUKLICKEN GIBT. Wo eine Nummer
          steht, ist der Zwischenspeicher der Umweg — und ein gefährlicher:
          derselbe Text für zwei Menschen trüge denselben Bestätigungslink.
        */}
        {numbers.length === 0 && preview !== '' && (
          <button
            type="button" className="wk-link-btn"
            onClick={() => {
              void navigator.clipboard?.writeText(preview)
                .then(() => setCopied(true)).catch(() => setCopied(false));
            }}
          >
            {copied ? 'Skopiowano' : 'Kopiuj wiadomość'}
          </button>
        )}
      </div>

      {numbers.length === 0 && preview !== '' && (
        <p className="wk-hint">
          {values === undefined
            ? 'Otwórz zgłoszenie, żeby zobaczyć numer.'
            : 'W tym zgłoszeniu nie ma numeru do kliknięcia — zostaje skopiowanie wiadomości.'}
        </p>
      )}

      {template.trim() === '' && numbers.length > 0 && (
        <p className="wk-hint">
          Napisz najpierw szablon wiadomości — bez niego nie ma czego wysłać.
        </p>
      )}

      {/*
        DER VERWAISTE WERT — und was dagegen zu tun ist.

        Er lässt sich lesen und anwählen, aber NICHT bestätigen: eine
        Bestätigung zeigt auf eine Frage, und diese gibt es nicht mehr. Das ist
        keine Lücke, die sich wegargumentieren lässt — also steht hier, woran
        es liegt, und daneben der eine Handgriff, der es behebt.
      */}
      {orphans.length > 0 && (
        <p className="wk-note">
          {orphans.length === 1
            ? 'Ten numer należy do pytania, którego już nie ma — '
            : 'Te numery należą do pytań, których już nie ma — '}
          SMS wyślesz, ale linku potwierdzającego do nich nie da się wystawić.
          {livePhone === undefined ? (
            <> Najpierw dodaj do formularza pytanie o telefon.</>
          ) : (
            <>
              {' '}
              <button
                type="button" className="wk-link-btn" disabled={busy}
                onClick={() => void rebind()}
              >
                Przepisz na „{livePhone.label ?? 'telefon'}"
              </button>
            </>
          )}
        </p>
      )}

      {/*
        DER ZUSTAND JEDER EINZELNEN NUMMER — bestätigt, „Link ist draussen und
        wartet", oder nichts davon. Der mittlere ist der, den eine Kanzlei
        wirklich braucht: sie hat geschickt, es kam nichts zurück.
      */}
      {[...new Set(numbers.filter((n) => !n.orphan).map((n) => n.fieldId))].map((fieldId) => {
        const mark = checks.find((c) => c.fieldId === fieldId);
        if (mark === undefined) return null;

        const label = fieldsByLabel.find((f) => f.fieldId === fieldId)?.label ?? 'Numer';

        return mark.verifiedAt !== null ? (
          <p className="wk-hint" key={fieldId}>
            <strong>{label} — potwierdzony</strong>{' '}
            {new Date(mark.verifiedAt).toLocaleDateString('pl-PL',
              { day: 'numeric', month: 'long', year: 'numeric' })}
            {/*
              WELCHER WEG, wörtlich (0031). Hier stand „ta osoba kliknęła link,
              który tam wysłaliście" für JEDE Bestätigung — und das wurde in dem
              Augenblick unwahr, in dem es den Knopf im Portal gab. Die beiden
              sagen nicht dasselbe: der geklickte Link zeigt, dass unter DIESER
              Nummer jemand erreichbar war; der Knopf zeigt, dass die Angabe
              noch gilt. Wer sie zusammenwirft, hält eine Erreichbarkeit für
              belegt, die niemand belegt hat.
            */}
            {mark.origin === 'sms'
              ? ' — ta osoba kliknęła link, który tam wysłaliście.'
              : ' — ta osoba potwierdziła to w swoim portalu. '
                + 'To nie dowód, że telefon działa — jeśli tego potrzebujecie, wyślijcie link.'}
          </p>
        ) : (
          <p className="wk-hint" key={fieldId}>
            Link potwierdzający wysłany{' '}
            {new Date(mark.sentAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })},
            {' '}bez odpowiedzi. Ważny do{' '}
            {new Date(mark.expiresAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}.
          </p>
        );
      })}

      {links.size > 0 && (
        <p className="wk-hint">
          <strong>
            {links.size === 1
              ? 'Link potwierdzający poszedł w wiadomości'
              : `Linki potwierdzające (${links.size}) poszły w wiadomościach`}
          </strong>
          {' '}— każdy numer dostał własny. Poprzednie, jeśli były, przestały działać.
        </p>
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
          Napisz szablon wiadomości powyżej — np.{' '}
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

          {/*
            DIE VORSCHAU OHNE BESTÄTIGUNGSLINK. `{weryfikacja}` steht hier
            absichtlich noch in Klammern: welcher Link es wird, entscheidet
            sich an der Nummer, die angeklickt wird — einer je Nummer.
          */}
          <textarea readOnly rows={4} value={preview} />

          {wantsVerify && numbers.some((n) => !n.orphan) && (
            <p className="wk-hint">
              <code>{`{${VERIFY}}`}</code> wypełni się przy kliknięciu w numer —
              każdy numer dostaje własny link.
            </p>
          )}
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
/**
 * Wie der Bogen auf der Seite überschrieben ist.
 *
 * <b>Eine Einstellung des Bausteins</b> wie die Vorlage daneben — sie braucht
 * keinen Schlüssel und keine einzige Einsendung, und wer die Seite führt,
 * darf sie schreiben.
 */
function Naming({ partId, value, busy, onSaved, onError }: {
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
