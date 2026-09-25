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

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { areaPath, loadAreas, loadPublicKey, myEpochKeys, type AreaRow } from './area';
import { fromBase64Url } from './crypto';
import {
  CHOOSABLE_IDENTITY, FIELD_KINDS, IDENTITY_LABEL, KIND_LABEL, fullNameOf,
  addField, loadFields, loadRegistrations, openFields,
  armCheck, hideSubmission, readAcross, removeField, removeSubmission, reviseAsOffice,
  rewrapToOffice, setLinkCheck, setPartConfig,
  type ValueCheck,
  type FieldKind, type IdentityRole, type OpenField, type SealedField, type Submission,
  editField, moveAnswers, sealQuestion, type MovedValue
} from './form';
import { createIntake, loadIntake, loadPublicIntake, openIntakeKey } from './intake';
import type { Ring, SealedRole } from './keys';
import { Portal } from './Portal';
import { keysFor } from './ringOf';
import { selfOf } from './roles';
import {
  nameSeats, officeSeatKey, loadSeats, relinkSeat, revokeSeat, seatPath, type Link, type SeatRow
} from './seat';
import { checkText, openLink, type CheckAnswer } from './seatCheck';
import { WorkspaceError, type Who } from './session';
import { Unlock } from './Unlock';
import { dialable, joinPhones, normalisePhone, splitPhones, tidyPhones, withPhone } from './phone';
import { LINK, renderSms, smsHref, usesHole, VERIFY } from './sms';
import { AreaOptions } from './AreaOptions';
import { FormTable } from './FormTable';
import { ModuleSettings } from './ModuleSettings';
import { updateModule, type ModuleRow, type Resealed, type ResealIn } from './module';
import {
  EMPTY_DESIGN, layoutWith, openDesign, saveDesign, sealDesign,
  type FormDesign, type SealedDesign
} from './formDesign';
import { FormLayout } from './FormLayout';
import { FormLogic } from './FormLogic';

/** Die Reiter eines Formulars: einrichten (vier) — lesen — handeln. */
type FormTabName = 'settings' | 'questions' | 'layout' | 'logic' | 'entries' | 'people';

export function FormOffice({ partId, config, who, standsOn, module, onModuleChanged }: {
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
   * Der Baustein selbst — sein Bereich, seine Klausel, ob er offen ist. Sein
   * Name, Bereich und „wessen Formular" stehen im ersten Reiter, zusammen mit
   * allem anderen, was das Formular als GANZES betrifft.
   */
  module?: ModuleRow;

  /** Nach einer Änderung am Baustein — der Aufrufer holt ihn neu. */
  onModuleChanged?: () => Promise<void> | void;
}) {
  /*
   * DREI REITER, wie im Altbestand der Veranstaltungen (`events/admin`:
   * Strony · Dostęp · Ustawienia): EINRICHTEN, LESEN, HANDELN. Vorher stand
   * alles untereinander — Fragen, Annahme, Vorlage, Portal, und darunter die
   * Einsendungen —, und wer nur jemanden anrufen wollte, scrollte durch die
   * Einrichtung.
   */
  const [tab, setTab] = useState<FormTabName>(module !== undefined ? 'settings' : 'questions');

  /* Welche Antwortbereiche schon annehmen können (0022) — je Bereich ein Paar. */
  const [intakes, setIntakes] = useState<ReadonlyMap<string, boolean>>(new Map());

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
   * Welche Antwortbereiche aufgemacht sind — `null`: noch keiner. ALLE auf
   * einmal (`read`), nicht einer nach dem anderen: vorher stand je Bereich
   * ein Knopf „Otwórz: …", und die Tabelle zeigte nur die Antworten des
   * zuletzt gewählten — die Hälfte eines Menschen.
   */
  const [readAreas, setReadAreas] = useState<readonly string[] | null>(null);

  /** Bereiche, deren Annahme dieser Browser nicht öffnen kann — gesagt, nicht verschwiegen. */
  const [shutAreas, setShutAreas] = useState<readonly string[]>([]);
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

  /*
   * AUFBAU UND LOGIK (0043) — ein versiegeltes Dokument je Formular.
   * `sealedDesign` ist, was der Dienst hat; `design`, was davon aufging. Steht
   * das eine ohne das andere da, darf niemand darüberschreiben: er würde
   * einen Aufbau löschen, den er nicht sehen kann.
   */
  const [sealedDesign, setSealedDesign] = useState<SealedDesign | null>(null);
  const [design, setDesign] = useState<FormDesign | null>(null);
  const designLocked = sealedDesign !== null && design === null;

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
    let shut: SealedDesign | null = null;

    try {
      const loaded = await loadFields(partId);
      sealed = loaded.fields;
      shut = loaded.design;
      setSealedDesign(shut);
      if (shut === null) setDesign(null);

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
    for (const areaId of new Set(sealed.flatMap((f) => [f.labelAreaId ?? f.areaId, f.areaId]))) {
      if (keys.has(areaId)) continue;

      try {
        keys.set(areaId, fromBase64Url((await loadPublicKey(areaId)).key));
      } catch {
        // Nicht offengelegt und keine Zuteilung: die Frage bleibt zu, zu Recht.
      }
    }

    setFields(await openFields(sealed, keys));

    /*
     * DER AUFBAU UND DIE LOGIK (0043) — unter dem Schlüssel des
     * Formularbereichs, und zwar der EPOCHE, mit der sie versiegelt wurden.
     * Erst die Zuteilung, dann der veröffentlichte Schlüssel, falls er dieselbe
     * Epoche hat.
     */
    if (shut !== null) {
      let key: Uint8Array | undefined;
      try { key = (await myEpochKeys(bund, shut.areaId)).get(shut.epoch); } catch { key = undefined; }

      if (key === undefined) {
        try {
          const open = await loadPublicKey(shut.areaId);
          if (open.epoch === shut.epoch) key = fromBase64Url(open.key);
        } catch {
          // Nicht offengelegt: der Aufbau bleibt zu, und das wird gesagt.
        }
      }

      setDesign(await openDesign(shut, key, partId));
    }

    /* Welche Antwortbereiche schon eine Annahme haben — ohne sie nimmt eine Frage nichts an. */
    const taking = new Map<string, boolean>();
    for (const areaId of new Set(sealed.map((f) => f.areaId))) {
      taking.set(areaId, await loadPublicIntake(areaId).then(() => true, () => false));
    }
    setIntakes(taking);
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
  const read = async (hidden: boolean = showHidden) => {
    if (ring === null) throw new WorkspaceError('Bez hasła w tej karcie nie da się otworzyć odpowiedzi.');

    /*
     * JEDER ANTWORTBEREICH MIT SEINEM EIGENEN SCHLÜSSEL — alle, die dieser
     * Browser öffnen kann, und jeder in seinem eigenen Versuch: ein Bereich
     * ohne Zuteilung lässt nur seine eigenen Antworten zu.
     *
     * Der Schlüssel der AMTSROLLE — nicht der Epochenschlüssel. 0005 nennt den
     * Grund: läge die Annahme unter der Epoche, könnte jeder Helfer sämtliche
     * Anmeldungen lesen, ohne dass ihm jemand etwas gegeben hätte. Der Umbau
     * auf AES darf diese Trennung nicht nebenbei aufheben.
     */
    const keys: { areaId: string; privateKey: Uint8Array; officeKey: Uint8Array | undefined }[] = [];
    const shut: string[] = [];

    for (const areaId of areasHere) {
      try {
        const intake = await loadIntake(areaId);
        keys.push({
          areaId,
          privateKey: await openIntakeKey(intake, ring),
          officeKey: ring.has(intake.sealedForRoleId) ? ring.keyOf(intake.sealedForRoleId) : undefined
        });
      } catch {
        shut.push(areaId);
      }
    }

    setReadAreas(keys.map((one) => one.areaId));
    setShutAreas(shut);

    const pending: { fieldId: string; registrationId: string; officeKeySealed: string }[] = [];

    const { registrations } = await loadRegistrations(partId, hidden);
    setSubmissions(registrations);

    const areaOf = new Map(fields.map((f) => [f.fieldId, f.areaId]));
    const named: { seatId: string; name: string }[] = [];

    const out = new Map<string, Map<string, string>>();
    let sent = 0;
    let got = 0;

    for (const one of registrations) {
      const { values: merged, toRewrap } = await readAcross(one, keys, areaOf);
      sent += one.values.length;

      for (const one2 of toRewrap) pending.push({ ...one2, registrationId: one.registrationId });

      out.set(one.registrationId, merged);

      /* Der volle Name, für den Platz dieser Einsendung — gleich unten ergänzt. */
      const full = one.seatId === null ? null : fullNameOf(fields, (fieldId) => merged.get(fieldId));
      if (full !== null && one.seatId !== null) named.push({ seatId: one.seatId, name: full });
      got += merged.size;
    }

    setOpened(out);

    /*
     * IMIĘ I NAZWISKO AN DEN PLATZ. Der Name am Platz stand bisher oft nur als
     * Nachname da (das erste Namensfeld des Formulars) — und so erschien er im
     * Kalender, an Bitten um Mitnahme, in der Auswahl „Za kogo". Hier liegen
     * die vollen Antworten offen; der Dienst ergänzt, was fehlt, und lässt
     * einen von Hand gesetzten Namen stehen. Still: es ändert nichts daran,
     * wer was lesen darf.
     */
    if (named.length > 0) void nameSeats(named).catch(() => undefined);

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
      setNote(`Otwarto ${got} z ${sent} odpowiedzi.${shut.length > 0
        ? ` Nie masz klucza przyjmowania obszaru ${shut.map((id) => `„${areaLabel(id)}"`).join(', ')} — jego odpowiedzi zostają zamknięte.`
        : ' Reszta nie pasuje do tych kluczy.'}`);
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
    if (readAreas === null) throw new WorkspaceError('Najpierw otwórz zgłoszenia.');

    /*
     * WIE VIELE ES WAREN, bevor es keine mehr sind. Nach dem Neulesen ist
     * `crooked` leer — dann liesse sich nicht mehr sagen, ob der Knopf zehn
     * Nummern gerichtet hat oder gar nichts tat.
     */
    const howMany = crooked.length;
    const people = new Set(crooked.map((one) => one.registrationId)).size;

    /*
     * Je Einsendung UND Bereich: eine Nummer wird unter der Annahme IHRES
     * Bereichs neu verpackt — bei mehreren Bereichen nicht unter irgendeiner.
     */
    const areaOf = new Map(fields.map((f) => [f.fieldId, f.areaId]));
    const groups = new Map<string, { registrationId: string; areaId: string; answers: { fieldId: string; value: string }[] }>();

    for (const one of crooked) {
      const areaId = areaOf.get(one.fieldId);
      if (areaId === undefined) continue;

      const slot = `${one.registrationId}|${areaId}`;
      const entry = groups.get(slot) ?? { registrationId: one.registrationId, areaId, answers: [] };
      entry.answers.push({ fieldId: one.fieldId, value: one.tidy });
      groups.set(slot, entry);
    }

    const intakes = new Map<string, Uint8Array>();

    for (const { registrationId, areaId, answers } of groups.values()) {
      const seatId = submissions.find((s) => s.registrationId === registrationId)?.seatId ?? null;

      const seatKey = seatId === null
        ? null
        : await seatRowOf(seatId, ring).then((r) => r.key).catch(() => null);

      if (!intakes.has(areaId)) intakes.set(areaId, fromBase64Url((await loadPublicIntake(areaId)).publicKey));

      await reviseAsOffice(registrationId, answers, { intakePublic: intakes.get(areaId)!, seatKey });
    }

    await read();

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
   * Klick, der nichts entschied. Einmal — und ALLE Bereiche zugleich, die
   * dieser Browser öffnen kann.
   */
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    if ((tab !== 'entries' && tab !== 'people') || autoTried || ring === null
      || readAreas !== null || areasHere.length === 0) return;
    setAutoTried(true);
    void act('Otwieranie zgłoszeń…', read);
  }, [tab, autoTried, ring, readAreas, areasHere.length]);

  const [editing, setEditing] = useState<string | null>(null);

  /*
   * Eine Änderung am Baustein — hier ausgeführt (damit ein Fehler hier steht,
   * wo er passiert ist), und danach holt der Aufrufer den Baustein neu.
   */
  const moduleAct = (what: string, todo: () => Promise<unknown>) =>
    act(what, async () => { await todo(); await onModuleChanged?.(); });

  const formArea = module?.areaId == null ? undefined : areas.find((a) => a.areaId === module.areaId);

  /* Vor allem, was beim Zeichnen einen Bereich beim Namen nennt — auch den Warnungen. */
  const areaLabel = (areaId: string) =>
    areaPath(areas, areaId).short || areas.find((a) => a.areaId === areaId)?.name || areaId.slice(0, 8);

  /** Der Epochenschlüssel eines Bereichs, den ich halte — oder eine klare Absage. */
  const keyOf = async (areaId: string): Promise<{ key: Uint8Array; epoch: number }> => {
    if (ring === null) throw new WorkspaceError('Bez hasła nie da się zapieczętować pytania.');
    const area = areas.find((a) => a.areaId === areaId);
    const key = area === undefined ? undefined : (await myEpochKeys(ring, areaId)).get(area.currentEpoch);
    if (area === undefined || key === undefined) {
      throw new WorkspaceError(`Nie masz klucza obszaru „${areaLabel(areaId)}".`);
    }
    return { key, epoch: area.currentEpoch };
  };

  /**
   * ALLE Fragen unter dem Schlüssel eines neuen Formularbereichs (0042) — für
   * den Umzug des Formulars. Eine Frage, die hier nicht aufging, kann nicht
   * mit: dann lieber gar nicht umziehen.
   */
  const resealFor = async (target: string): Promise<Resealed> => {
    const { key, epoch } = await keyOf(target);
    const unread = fields.filter((f) => f.label === null);
    if (unread.length > 0) {
      throw new WorkspaceError('Nie każde pytanie da się teraz odczytać — bez tego nie da się ich przepieczętować.');
    }
    if (designLocked) {
      throw new WorkspaceError('Układu formularza nie da się teraz odczytać — bez tego nie da się go przepieczętować.');
    }

    const out: ResealIn[] = [];
    for (const f of fields) {
      out.push({
        fieldId: f.fieldId,
        ...(await sealQuestion(key, f.fieldId, { label: f.label!, help: f.help, options: f.options })),
        labelEpoch: epoch
      });
    }

    /* Der Aufbau zieht mit, unter demselben neuen Schlüssel (0043). */
    return design === null || sealedDesign === null
      ? { fields: out }
      : { fields: out, design: { sealed: await sealDesign(design, key, partId), epoch } };
  };

  /**
   * Aufbau und Logik speichern — ein Dokument, unter dem Schlüssel des
   * Formularbereichs. Wer nur die Logik ändert, schickt den Aufbau mit, wie
   * er ist, und umgekehrt.
   */
  const saveDesignNow = async (next: FormDesign) => {
    if (module?.areaId == null) throw new WorkspaceError('Formularz potrzebuje najpierw własnego obszaru.');
    if (designLocked) throw new WorkspaceError('Zapisany układ jest zapieczętowany kluczem, którego nie masz.');
    const { key, epoch } = await keyOf(module.areaId);
    await saveDesign(partId, module.areaId, epoch, await sealDesign(next, key, partId));
  };

  /* Der vollständige Aufbau: jede Frage genau einmal, neue am Ende. */
  const current = design ?? EMPTY_DESIGN;
  const fieldIds = fields.map((f) => f.fieldId);
  const layout = layoutWith(current.layout, fieldIds);
  const byId = new Map(fields.map((f) => [f.fieldId, f]));

  /* Fragen, die noch unter dem Schlüssel ihrer Antworten liegen, nicht des Formulars. */
  const stale = module?.areaId == null ? [] : fields.filter((f) => f.labelAreaId !== module.areaId);

  const resealStale = async () => {
    for (const f of stale) {
      if (f.label === null) throw new WorkspaceError('Nie każde pytanie da się teraz odczytać.');
      await saveField(f, {
        label: f.label, help: f.help, options: f.options, kind: f.kind,
        isRequired: f.isRequired, isHalfWidth: f.isHalfWidth, identityRole: f.identityRole,
        selfEdit: f.selfEdit, areaId: f.areaId
      });
    }
  };

  /*
   * ALTE FRAGEN ZIEHEN VON SELBST UM.
   *
   * Vor 0042 lag eine Frage unter dem Schlüssel ihres ANTWORTbereichs — und
   * der ist meist nicht jawny. Draussen stand dann „zapieczętowane" bei jeder
   * Frage, obwohl das Formular in einem offenen Bereich steht. Ein Knopf im
   * zweiten Reiter reichte nicht: wer das Formular einrichtet, steht im
   * ersten und sieht ihn nie.
   *
   * Wer die Fragen lesen UND den Schlüssel des Formularbereichs hat, tut es
   * darum beim Öffnen, einmal. Es ist derselbe Text unter einem anderen
   * Schlüssel — nichts, was man bestätigen müsste. Geht es nicht (eine Frage
   * bleibt zu), steht die Warnung da und sagt warum.
   */
  const [resealTried, setResealTried] = useState(false);
  const canReseal = ring !== null && formArea !== undefined && stale.length > 0
    && stale.every((f) => f.label !== null);

  useEffect(() => {
    if (resealTried || busy !== null || !canReseal) return;
    setResealTried(true);
    void act('Przepieczętowywanie pytań kluczem formularza…', resealStale);
  }, [resealTried, busy, canReseal]);

  /* Ein Formularbereich, der nicht jawny ist: dann liest draussen niemand die Fragen. */
  const hiddenNotice = formArea !== undefined && formArea.publicLevel === 'none' && (
    <p className="wk-warn">
      Obszar formularza „{areaLabel(formArea.areaId)}" nie jest jawny — pytania przeczyta tylko ten,
      kto ma jego klucz. Na stronie publicznej będą nieczytelne. Ustaw w tym obszarze, w zakładce
      „Dla wszystkich", „Każdy czyta" — albo wybierz tu obszar jawny.
    </p>
  );

  /* Welche Bereiche die alten Fragen noch verschliessen — beim Namen. */
  const staleUnder = [...new Set(stale.map((f) => f.labelAreaId ?? f.areaId))].map((id) => `„${areaLabel(id)}"`).join(', ');

  const staleNotice = stale.length > 0 && ring !== null && (
    <div className="wk-warn">
      <p>
        {stale.length === 1 ? 'Jedno pytanie jest zapieczętowane' : `${stale.length} pytań jest zapieczętowanych`}{' '}
        kluczem obszaru odpowiedzi ({staleUnder}), a nie formularza — na stronie publicznej
        {stale.length === 1 ? ' jest nieczytelne' : ' są nieczytelne'}.
        {!stale.every((f) => f.label !== null) && ' Nie wszystkie da się teraz odczytać — potrzebny jest klucz tamtego obszaru.'}
        {formArea === undefined && ' Nie masz klucza obszaru formularza.'}
      </p>
      <button
        type="button" className="wk-link-btn" disabled={busy !== null || !canReseal}
        onClick={() => void act('Przepieczętowywanie pytań…', resealStale)}
      >
        Przepieczętuj kluczem formularza
      </button>
    </div>
  );

  /**
   * Eine Frage speichern — neu versiegelt unter dem Schlüssel des Formulars,
   * und wenn ihre Antworten woandershin sollen, mit JEDER Antwort neu verpackt.
   */
  const saveField = async (f: OpenField, change: FieldChange) => {
    const place = module?.areaId ?? change.areaId;
    const { key, epoch } = await keyOf(place);
    let moveTo: { areaId: string; moved: readonly MovedValue[] } | undefined;

    if (change.areaId !== f.areaId) {
      if (ring === null) throw new WorkspaceError('Bez hasła nie da się przenieść odpowiedzi.');
      if (person === null) throw new WorkspaceError('Konto nie prowadzi jeszcze żadnej osoby.');

      /* Der neue Bereich braucht eine Annahme — sonst gäbe es nichts, wofür zu verpacken wäre. */
      const target = await loadPublicIntake(change.areaId).catch(async () => {
        await createIntake(ring, change.areaId, person.id);
        return loadPublicIntake(change.areaId);
      });

      /* Alle Einsendungen, auch die ausgeblendeten — keine Antwort darf zurückbleiben. */
      const { registrations } = await loadRegistrations(partId, true);
      const answered = registrations.filter((r) => r.values.some((v) => v.fieldId === f.fieldId));
      let moved: readonly MovedValue[] = [];

      if (answered.length > 0) {
        const intake = await loadIntake(f.areaId);
        moved = await moveAnswers(f.fieldId, answered, {
          intakePrivate: await openIntakeKey(intake, ring),
          officeKey: ring.has(intake.sealedForRoleId) ? ring.keyOf(intake.sealedForRoleId) : undefined
        }, { intakePublic: fromBase64Url(target.publicKey) });
      }

      moveTo = { areaId: change.areaId, moved };
    }

    await editField(f.fieldId, {
      key,
      labelArea: module?.areaId == null ? null : { areaId: module.areaId, epoch },
      label: change.label, help: change.help, options: change.options,
      kind: change.kind, isRequired: change.isRequired, isHalfWidth: change.isHalfWidth,
      selfEdit: change.selfEdit,
      identityRole: change.identityRole,
      moveTo
    });

    /* Die geöffneten Antworten gehören jetzt zu einer anderen Annahme — neu öffnen. */
    if (moveTo !== undefined) { setReadAreas(null); setOpened(new Map()); setSubmissions([]); setAutoTried(false); }
  };

  const reread = async () => { if (readAreas !== null) await read(); };

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
        {module !== undefined && <FormTab now={tab} mine="settings" onPick={setTab}>Ustawienia</FormTab>}
        <FormTab now={tab} mine="questions" onPick={setTab}>Pytania</FormTab>
        {module !== undefined && <FormTab now={tab} mine="layout" onPick={setTab}>Układ</FormTab>}
        {module !== undefined && <FormTab now={tab} mine="logic" onPick={setTab}>Logika</FormTab>}
        <FormTab now={tab} mine="entries" onPick={setTab}>
          Zgłoszenia{submissions.length > 0 ? ` (${submissions.length})` : ''}
        </FormTab>
        <FormTab now={tab} mine="people" onPick={setTab}>Osoby</FormTab>
      </div>

      {/* == 1. DAS FORMULAR ALS GANZES ======================================= */}

      {tab === 'settings' && module !== undefined && (
        <>
          {/* Wer „czy formularz jest czytelny dla wszystkich" fragt, steht HIER. */}
          {staleNotice}
          {hiddenNotice}

          <ModuleSettings
            row={module}
            areas={areas}
            busy={busy !== null}
            onAct={moduleAct}
            reseal={resealFor}
          />

          {/*
            OFFEN ODER GESCHLOSSEN (0042). Geschlossen nimmt das Formular
            nichts mehr an — es bleibt stehen, mit allem, was eingegangen ist.
          */}
          <div className="wk-field">
            <span>Przyjmowanie zgłoszeń</span>
            <div className="wk-seg" role="group" aria-label="Przyjmowanie zgłoszeń">
              {([false, true] as const).map((closed) => (
                <button
                  key={String(closed)}
                  type="button"
                  aria-pressed={module.closed === closed}
                  className={module.closed === closed ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
                  disabled={busy !== null || module.closed === closed}
                  onClick={() => void moduleAct(closed ? 'Zamykanie…' : 'Otwieranie…',
                    () => updateModule(module.moduleId, { closed }))}
                >
                  {closed ? 'Zamknięte' : 'Otwarte'}
                </button>
              ))}
            </div>
            {module.closed && (
              <span className="wk-hint">Formularz stoi na stronie, ale nie przyjmuje nowych zgłoszeń.</span>
            )}
          </div>

          <ControllerForm
            value={module.controller}
            busy={busy !== null}
            onSave={(controller) => moduleAct('Zapisywanie klauzuli…',
              () => updateModule(module.moduleId, { controller }))}
          />

          {/*
            DIE ÜBERSCHRIFT DES BOGENS — wie er auf der Seite heisst. Der Name
            oben ist der, unter dem man ihn in der Liste wiederfindet.
          */}
          <Naming
            partId={partId}
            value={conf.title ?? ''}
            busy={busy !== null}
            onSaved={setSaved}
            onError={setFailed}
          />

          {/* WAS NACH DEM ABSENDEN KOMMT — und was der Mensch mit seinem Link bekommt. */}
          <Portal
            moduleId={partId}
            standsOn={standsOn ?? []}
            portalUnder={(conf.portalUnder ?? '').trim()}
            ownerRoleId={person?.id ?? null}
            onSet={(where) => setSaved({ ...conf, portalUnder: where })}
          />

          {/*
            DAS ERSTE ÖFFNEN EINES LINKS (0046) — was gefragt wird. Die
            Nachricht selbst schreibt die Kanzlei dort, wo sie sie verschickt:
            unter „Osoby", mit „Napisz SMS".
          */}
          <LinkCheckBox
            partId={partId}
            fields={fields}
            busy={busy !== null}
            onSaved={() => void look()}
            onError={setFailed}
          />
        </>
      )}

      {/* == 2. DIE FRAGEN ================================================= */}

      {tab === 'questions' && (
        <>
          {/*
            WO DIE FRAGEN LIEGEN (0042). Unter dem Schlüssel des Formulars —
            lesen kann sie, wer diesen Bereich liest. Ist er nicht jawny, sieht
            draussen niemand die Fragen, und das muss man VOR dem Veröffentlichen
            erfahren, nicht danach.
          */}
          {module !== undefined && module.areaId === null && (
            <p className="wk-warn">
              Formularz nie ma własnego obszaru — pytania trafiają pod klucz obszaru odpowiedzi.
              Ustaw obszar formularza w zakładce „Ustawienia".
            </p>
          )}

          {hiddenNotice}

          {staleNotice}

          {/* Antwortbereiche ohne Annahme — dort nimmt eine Frage nichts an. */}
          {ring !== null && person !== null && areasHere
            .filter((areaId) => intakes.get(areaId) === false)
            .map((areaId) => (
              <IntakeMissing
                key={areaId}
                areaId={areaId}
                areaName={areaLabel(areaId)}
                ring={ring}
                officeRoleId={person.id}
                busy={busy !== null}
                onAct={act}
              />
            ))}

          {fields.length === 0 ? (
            <p className="wk-empty">Jeszcze żadnego pytania.</p>
          ) : (
            <ul className="wk-list">
              {fields.map((f) => editing === f.fieldId && ring !== null ? (
                <li className="wk-row wk-row-open" key={f.fieldId}>
                  <FieldEditor
                    field={f}
                    areas={areas}
                    taken={fields.filter((o) => o.fieldId !== f.fieldId)
                      .map((o) => o.identityRole).filter((r) => r !== 'none')}
                    busy={busy !== null}
                    onCancel={() => setEditing(null)}
                    onSave={(change) => void act('Zapisywanie pytania…', async () => {
                      await saveField(f, change);
                      setEditing(null);
                    })}
                  />
                </li>
              ) : (
                <li className="wk-row" key={f.fieldId}>
                  <span>
                    <strong>{f.label ?? 'zapieczętowane'}</strong>
                    <span className="wk-row-side">
                      {' · '}{KIND_LABEL[f.kind]}
                      {f.isRequired && ' · wymagane'}
                      {!f.selfEdit && ' · po wysłaniu tylko do odczytu'}
                      {f.identityRole !== 'none' && ` · ${IDENTITY_LABEL[f.identityRole]}`}
                      {' · → '}{areaLabel(f.areaId)}
                    </span>
                  </span>

                  <span className="wk-row-side">
                    <button
                      type="button" className="wk-link-btn" disabled={busy !== null || ring === null || f.label === null}
                      onClick={() => setEditing(f.fieldId)}
                    >
                      Edytuj
                    </button>
                    {' · '}
                    <button
                      type="button" className="wk-link-btn" disabled={busy !== null}
                      onClick={() => void act('Usuwanie…', () => removeField(f.fieldId))}
                    >
                      Usuń
                    </button>
                  </span>
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
              formAreaId={module?.areaId ?? null}
              officeRoleId={person?.id ?? null}
              busy={busy !== null}
              onAdded={() => void look()}
              onError={setFailed}
            />
          )}
        </>
      )}

      {/* == 3. AUFBAU UND LOGIK (0043) ======================================= */}

      {(tab === 'layout' || tab === 'logic') && module !== undefined && (
        module.areaId === null ? (
          <p className="wk-warn">
            Układ i logika są zapieczętowane kluczem obszaru formularza — ustaw go najpierw
            w zakładce „Ustawienia".
          </p>
        ) : ring === null ? (
          <p className="wk-empty">Bez hasła nie da się ani odczytać, ani zapieczętować układu.</p>
        ) : designLocked ? (
          <p className="wk-warn">
            Ten formularz ma zapisany układ, ale nie masz klucza, którym go zapieczętowano
            — nie da się go ani odczytać, ani nadpisać.
          </p>
        ) : fields.length === 0 ? (
          <p className="wk-empty">Najpierw pytania — układ i logika na nich się opierają.</p>
        ) : tab === 'layout' ? (
          <FormLayout
            layout={layout}
            fields={byId}
            busy={busy !== null}
            onSave={(next) => void act('Zapisywanie układu…',
              () => saveDesignNow({ ...current, layout: next }))}
          />
        ) : (
          <FormLogic
            design={current}
            layout={layout}
            fields={fields}
            busy={busy !== null}
            onSave={(nodes, edges) => void act('Zapisywanie logiki…',
              () => saveDesignNow({ ...current, layout, nodes, edges }))}
          />
        )
      )}

      {/* == 2 und 3: was dafür aufgemacht werden muss ======================== */}

      {(tab === 'entries' || tab === 'people') && (
        <>
          {areasHere.length === 0 ? (
            <p className="wk-empty">Najpierw pytania — bez nich nie ma zgłoszeń.</p>
          ) : readAreas === null ? (
            <div className="wk-actions">
              <button
                type="button" className="wk-btn"
                disabled={busy !== null || ring === null}
                onClick={() => void act('Otwieranie…', read)}
              >
                Otwórz zgłoszenia
              </button>
            </div>
          ) : areasHere.length > 1 && (
            /* Welche Bereiche offen sind — ALLE zugleich — und welche nicht. */
            <p className="wk-hint">
              Otwarte razem: {readAreas.map((id) => areaLabel(id)).join(' · ') || 'żaden'}
              {shutAreas.length > 0 && <> · bez klucza: {shutAreas.map((id) => areaLabel(id)).join(' · ')}</>}
            </p>
          )}

          {note !== null && <p className="wk-note">{note}</p>}

          {readAreas !== null && (
            <label className="wk-field">
              <span>
                <input
                  type="checkbox" checked={showHidden}
                  onChange={(e) => {
                    /* Mit dem NEUEN Wert lesen — der Zustand ist beim Aufruf noch der alte. */
                    const hidden = e.target.checked;
                    setShowHidden(hidden);
                    void act('Wczytywanie…', () => read(hidden));
                  }}
                />
                {' '}Pokaż też ukryte
              </span>
            </label>
          )}
        </>
      )}

      {/* == 2. LESEN ======================================================= */}

      {tab === 'entries' && readAreas !== null && (
        <FormTable
          fields={fields}
          submissions={submissions}
          opened={opened}
          fileName={module?.name ?? conf.title ?? 'zgloszenia'}
        />
      )}

      {/* == 3. HANDELN ===================================================== */}

      {tab === 'people' && readAreas !== null && (
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
            partId={partId}
            config={conf}
            onConfig={setSaved}
            submissions={submissions}
            opened={opened}
            fields={fields}
            seatAreas={areasHere}
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
 * Wer ein Mensch in dieser Liste ist: sein Name und ALLE seine Nummern.
 *
 * <b>Aus den GENORMTEN Fragen zuerst</b> (0038): Imię und Nazwisko, sonst
 * das alte „name". Fehlt beides, die erste ausgefüllte einzeilige Antwort —
 * irgendetwas muss in der Zeile stehen, woran man den Menschen erkennt.
 *
 * <b>Alle Nummern, nicht die erste.</b> Ein Bogen fragt oft nach Mutter UND
 * Vater; wer nur die erste sah, rief immer dieselbe an. Dieselbe Nummer in
 * zwei Fragen steht einmal da.
 */
function whoIn(
  values: Map<string, string> | undefined, fields: readonly OpenField[]
): { name: string; phones: readonly Numbered[] } {
  if (values === undefined) return { name: '— zapieczętowane —', phones: [] };

  const of = (role: IdentityRole) => {
    const field = fields.find((f) => f.identityRole === role);
    return field === undefined ? null : values.get(field.fieldId)?.trim() || null;
  };

  const nick = of('nickname');
  /* Derselbe volle Name wie am Platz und im Kalender (`fullNameOf`) — ohne den Spitznamen, der steht daneben. */
  const full = fullNameOf(fields.filter((f) => f.identityRole !== 'nickname'), (fieldId) => values.get(fieldId));
  const first = fields.find((f) => f.kind === 'line' && (values.get(f.fieldId)?.trim() ?? '') !== '');

  const name = full !== null
    ? (nick !== null ? `${full} („${nick}")` : full)
    : nick ?? (first === undefined ? null : values.get(first.fieldId)!.trim()) ?? '— bez imienia —';

  const seen = new Set<string>();
  const phones = numbersOf(values, fields).filter((one) => {
    if (seen.has(one.dial)) return false;
    seen.add(one.dial);
    return true;
  });

  return { name, phones };
}

/**
 * Was in einer Nachricht für DIESEN Menschen eingesetzt wird — nach
 * Beschriftung der Frage, dazu `{imie}` und `{osoba}`.
 *
 * `{imie}` neben `{osoba}` — der Altbestand hatte beide, und aus gutem Grund:
 * „Cześć Anna Kowalska" grüsst niemand.
 */
function holesOf(values: Map<string, string> | undefined, fields: readonly OpenField[]): Map<string, string> {
  const out = new Map<string, string>();
  if (values === undefined) return out;

  for (const f of fields) {
    const v = values.get(f.fieldId);
    if (f.label !== null && v !== undefined) out.set(f.label, v);
  }

  const full = fullNameOf(fields.filter((f) => f.identityRole !== 'nickname'), (fieldId) => values.get(fieldId));
  const given = fields.find((f) => f.identityRole === 'given_name');
  const givenValue = given === undefined ? '' : (values.get(given.fieldId) ?? '').trim();

  if (full !== null) {
    out.set('osoba', full);
    out.set('imie', givenValue !== '' ? givenValue : full.split(/\s+/)[0]);
  }

  return out;
}

/** Was ein neuer Link dieses Menschen beim ersten Öffnen fragt — seine Antworten auf die gewählten Fragen. */
const checkOf = (values: Map<string, string> | undefined, fields: readonly OpenField[]): readonly CheckAnswer[] =>
  fields.filter((f) => f.linkCheck)
    .map((f) => ({ fieldId: f.fieldId, kind: f.kind, value: values?.get(f.fieldId) ?? '' }));

/** Die Adresse, vor die ein Link gehängt wird. */
const base = () => `${window.location.origin}${window.location.pathname}`;

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
function People({
  partId, config, onConfig, submissions, opened, fields, seatAreas, ring, busy,
  onHide, onRemove, onError, onChanged
}: {
  partId: string;

  /** Die Einstellungen des Bausteins — darin die gespeicherten Szablony. */
  config: Record<string, string>;
  onConfig: (next: Record<string, string>) => void;

  submissions: readonly Submission[];
  opened: Map<string, Map<string, string>>;
  fields: readonly OpenField[];

  /** Die Bereiche, in denen die Plätze dieses Formulars liegen. */
  seatAreas: readonly string[];

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

  const links = useSeatLinks(seatAreas, ring);

  const rows = submissions
    .map((s) => ({ s, values: opened.get(s.registrationId), ...whoIn(opened.get(s.registrationId), fields) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  if (rows.length === 0) return <p className="wk-empty">Nikt się jeszcze nie zapisał.</p>;

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
      window.location.href = smsHref(one.dial, renderSms(smsText, filled, link));
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

  const first = rows[0];

  return (
    <section className="wk-panel">
      <div className="wk-sms-bar">
        <h3 className="wk-h2">Osoby ({rows.length})</h3>

        <button
          type="button"
          className={smsText === null ? 'wk-btn wk-btn-quiet' : 'wk-btn'}
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
          preview={smsText.trim() === '' ? null : renderSms(smsText, holesOf(first.values, fields), '…link…')}
          previewName={first.name}
          withoutSeat={withoutSeat}
          willRenew={willRenew}
          sentCount={sent.size}
          onForget={() => setSent(new Set())}
          onError={onError}
        />
      )}

      <ul className="wk-entry-list">
        {rows.map(({ s, values, name, phones }) => {
          const open = openId === s.registrationId;
          const bySms = s.checks.some((c) => c.verifiedAt !== null && c.origin === 'sms');
          const seat = s.seatId === null ? undefined : links.rows.get(s.seatId);

          return (
            <li key={s.registrationId} className={s.hidden || s.withdrawnAt !== null ? 'wk-entry is-muted' : 'wk-entry'}>
              <div className="wk-entry-head">
                <strong className="wk-entry-name">{name}</strong>

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
                  <p className="wk-hint">
                    Wysłano {new Date(s.submittedAt).toLocaleString('pl-PL')}
                    {s.confirmedAt !== null && ` · dane potwierdzone przez osobę ${new Date(s.confirmedAt).toLocaleString('pl-PL')}`}
                  </p>

                  <Answers values={values} fields={fields} sealed={s.values.length} checks={s.checks} />

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
function NewFieldForm({
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
  const [identity, setIdentity] = useState<IdentityRole>('none');
  const [options, setOptions] = useState('');
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
        options: kind === 'choice' ? options.split('\n') : undefined,
        isRequired: required,
        identityRole: identity,
        selfEdit
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

      <SelfEditBox value={selfEdit} onChange={setSelfEdit} />

      <p className="wk-hint">
        {formAreaId !== null
          ? 'Odpowiedzi trafią do wybranego obszaru — przeczyta je tylko ten, kto ma do niego dostęp. '
            + 'Samo pytanie leży w obszarze formularza.'
          : 'Pytanie zostanie zapieczętowane kluczem tego obszaru — publicznie czytelne tylko, gdy obszar jest jawny.'}
        {' '}Jeśli obszar nie przyjmuje jeszcze odpowiedzi, klucz przyjmowania powstanie przy dodaniu pytania.
      </p>

      {stage !== null && <p className="wk-working">{stage}</p>}

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

/* -- Eine Annahme, die fehlt ------------------------------------------------ */

/**
 * Ein Antwortbereich ohne Annahme — dort nimmt eine Frage nichts an.
 *
 * <b>Nur noch als Hinweis</b>, wo es fehlt. Die Annahme entsteht sonst mit der
 * ersten Frage für einen Bereich (`NewFieldForm`); hier landen Formulare, die
 * ihre Fragen bekamen, bevor es so war. Die Klausel steht nicht mehr hier: sie
 * gehört dem Formular, nicht dem Bereich (0042).
 */
function IntakeMissing({ areaId, areaName, ring, officeRoleId, busy, onAct }: {
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

/* -- Die Klausel — EINE je Formular (0042) ---------------------------------- */

/**
 * Wer für die Daten steht.
 *
 * <b>Einmal, für das ganze Formular.</b> Sie stand je Bereich der Antworten —
 * ein Formular mit Fragen in zwei Bereichen fragte zweimal nach derselben
 * Pfarrei. Klartext, und das muss sie sein: sie steht unter dem Formular,
 * bevor jemand etwas eingetragen hat. Ohne sie sammelt das Formular nichts.
 */
function ControllerForm({ value, busy, onSave }: {
  value: ModuleRow['controller'];
  busy: boolean;
  onSave: (controller: { name: string; address?: string; email?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(value?.name ?? '');
  const [address, setAddress] = useState(value?.address ?? '');
  const [email, setEmail] = useState(value?.email ?? '');

  useEffect(() => {
    setName(value?.name ?? '');
    setAddress(value?.address ?? '');
    setEmail(value?.email ?? '');
  }, [value?.name, value?.address, value?.email]);

  const changed = name.trim() !== (value?.name ?? '')
    || address.trim() !== (value?.address ?? '')
    || email.trim() !== (value?.email ?? '');

  return (
    <section className="wk-form">
      <h4 className="wk-h2">Kto odpowiada za dane</h4>

      <label className="wk-field">
        <span>Nazwa</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Parafia św. Kazimierza" />
      </label>

      <label className="wk-field">
        <span>Adres</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>

      <label className="wk-field">
        <span>E-mail (opcjonalnie)</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>

      <p className="wk-hint">
        {value === null
          ? 'Bez tego formularz nic nie zbiera. '
          : ''}
        To jest jawne i musi takie być: klauzula stoi pod formularzem, zanim ktokolwiek cokolwiek wpisze.
      </p>

      {changed && (
        <div className="wk-actions">
          <button
            type="button" className="wk-btn" disabled={busy || name.trim() === ''}
            onClick={() => void onSave({ name, address, email })}
          >
            Zapisz klauzulę
          </button>
        </div>
      )}
    </section>
  );
}

/* -- Eine Frage ändern (0042) ------------------------------------------------ */

/** Was an einer Frage geändert wird — alles, was der Browser neu versiegelt. */
interface FieldChange {
  readonly label: string;
  readonly help: string | null;
  readonly options: readonly string[];
  readonly kind: FieldKind;
  readonly isRequired: boolean;
  readonly isHalfWidth: boolean;
  readonly identityRole: IdentityRole;

  /** Darf der Mensch die Antwort über seinen Link berichtigen (0044)? */
  readonly selfEdit: boolean;

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
function FieldEditor({ field, areas, taken, busy, onCancel, onSave }: {
  field: OpenField;
  areas: readonly AreaRow[];
  taken: readonly IdentityRole[];
  busy: boolean;
  onCancel: () => void;
  onSave: (change: FieldChange) => void;
}) {
  const [label, setLabel] = useState(field.label ?? '');
  const [help, setHelp] = useState(field.help ?? '');
  const [kind, setKind] = useState<FieldKind>(field.kind);
  const [identity, setIdentity] = useState<IdentityRole>(field.identityRole);
  const [required, setRequired] = useState(field.isRequired);
  const [selfEdit, setSelfEdit] = useState(field.selfEdit);
  const [options, setOptions] = useState(field.options.join('\n'));
  const [areaId, setAreaId] = useState(field.areaId);

  const usable = areas.filter((a) => a.heldEpochs > 0);
  const fixed = KIND_OF[identity] !== undefined;
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
          kind, isRequired: required, isHalfWidth: field.isHalfWidth, identityRole: identity, selfEdit, areaId
        });
      }}
    >
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
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>

      <label className="wk-field">
        <span>Podpowiedź pod pytaniem (opcjonalnie)</span>
        <input value={help} onChange={(e) => setHelp(e.target.value)} />
      </label>

      <label className="wk-field">
        <span>Rodzaj</span>
        <select value={kind} disabled={fixed} onChange={(e) => setKind(e.target.value as FieldKind)}>
          {FIELD_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <span className="wk-hint">
          {fixed ? 'Wynika z tego, czego dotyczy pytanie.' : 'Rodzaj zmienisz tylko, dopóki nikt nie odpowiedział.'}
        </span>
      </label>

      {kind === 'choice' && (
        <label className="wk-field">
          <span>Możliwości — jedna w wierszu</span>
          <textarea rows={3} value={options} onChange={(e) => setOptions(e.target.value)} />
        </label>
      )}

      <label className="wk-field">
        <span>Odpowiedzi trafiają do obszaru</span>
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <AreaOptions areas={areas} only={usable} />
        </select>
        {moving && (
          <span className="wk-hint">
            Zebrane odpowiedzi zostaną przeniesione: każda zostanie przepakowana w tej przeglądarce
            kluczem przyjmowania nowego obszaru. Treść odpowiedzi się nie zmienia.
          </span>
        )}
      </label>

      <label className="wk-field">
        <span>
          <input type="checkbox" checked={required} onChange={() => setRequired(!required)} />
          {' '}Wymagane
        </span>
      </label>

      <SelfEditBox value={selfEdit} onChange={setSelfEdit} />

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
function SelfEditBox({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="wk-field">
      <span>
        <input type="checkbox" checked={value} onChange={() => onChange(!value)} />
        {' '}Osoba może później sama poprawić tę odpowiedź
      </span>
      <span className="wk-hint">
        {value
          ? 'W swoim portalu (link po wysłaniu) zobaczy przycisk „Popraw dane".'
          : 'Odpowiedź zobaczy, ale zmienić ją może tylko kancelaria.'}
      </span>
    </label>
  );
}

export default FormOffice;

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

/* -- Die Links der Menschen, für die Kanzlei (0046) ------------------------ */

/**
 * Was die Kanzlei über die Links ihrer Menschen weiss — und wie sie an einen
 * kommt.
 */
interface SeatLinks {
  /** Die Plätze dieses Formulars, wie die Kanzlei sie sieht. */
  readonly rows: ReadonlyMap<string, SeatRow>;

  /** Der Link, OHNE etwas zu ändern — `null`, wenn die Kanzlei ihn nicht lesen kann. */
  readonly peek: (seatId: string) => Promise<string | null>;

  /**
   * Der Link zum VERSCHICKEN. Der vorhandene, wenn er taugt; sonst ein neuer,
   * der beim ersten Öffnen fragt, was das Formular dafür vorsieht.
   */
  readonly forSms: (seatId: string, check: readonly CheckAnswer[]) => Promise<string>;

  /** Ein NEUER Link — der bisherige hört auf zu gelten. */
  readonly renew: (seatId: string, check: readonly CheckAnswer[]) => Promise<string>;

  /** Der Platzschlüssel — für eine Berichtigung durch die Kanzlei. */
  readonly key: (seatId: string) => Promise<Uint8Array>;

  /** Die vorhandenen Links im Hintergrund aufmachen, damit ein Tipp auf nichts wartet. */
  readonly warm: (seatIds: readonly string[]) => void;

  readonly reload: () => Promise<void>;
}

/** Die ganze Adresse eines Links — die Seite, unter der der Platz hängt, mit dem Platz daran. */
const linkUrl = (link: Link, under: string | null) => `${base()}${seatPath(link, under)}`;

/**
 * DIE LINKS DER MENSCHEN — gelesen, nicht neu gewürfelt.
 *
 * <b>Vorher gab es nur „Wystaw link"</b>: gespeichert war vom Link nur sein
 * Abdruck, also stellte jeder Klick einen NEUEN aus, und der alte starb. Jetzt
 * liegt der Link versiegelt unter dem Platzschlüssel (0046), und die Kanzlei,
 * die den Platz öffnen kann, liest ihn — für jeden Menschen, ohne etwas zu
 * tun.
 *
 * <b>Neu gewürfelt wird nur, wenn es sein muss:</b> ein Platz von vor 0046
 * (sein Link ist nirgends lesbar), ein gesperrter, oder einer, der beim ersten
 * Öffnen fragen soll und es noch nicht tut — etwa der Link aus der eigenen
 * Anmeldung, der nie verschickt wurde. Dann entsteht der neue beim
 * Verschicken, und nur dann.
 */
function useSeatLinks(areaIds: readonly string[], ring: Ring | null): SeatLinks {
  const [rows, setRows] = useState<ReadonlyMap<string, SeatRow>>(new Map());

  /* Stabil über das Zeichnen hinweg — die Funktionen unten lesen immer den neuesten Stand. */
  const found = useRef(new Map<string, { row: SeatRow; areaId: string }>());
  const links = useRef(new Map<string, Link>());
  const seatKeys = useRef(new Map<string, Uint8Array>());
  const areaKeys = useRef(new Map<string, { epochs: Map<number, Uint8Array>; intake: Uint8Array | undefined }>());

  const areaList = areaIds.join(',');

  const reload = useCallback(async () => {
    const out = new Map<string, { row: SeatRow; areaId: string }>();

    for (const areaId of areaList === '' ? [] : areaList.split(',')) {
      try {
        for (const row of (await loadSeats(areaId)).seats) out.set(row.seatId, { row, areaId });
      } catch {
        // Ein Bereich, dessen Plätze ich nicht sehe — seine Menschen bleiben ohne Link.
      }
    }

    found.current = out;

    /* Ein Link kann sich inzwischen geändert haben — ein Mensch hat seine Angaben berichtigt. */
    links.current = new Map();
    setRows(new Map([...out].map(([id, one]) => [id, one.row])));
  }, [areaList]);

  useEffect(() => { void reload(); }, [reload]);

  const key = useCallback(async (seatId: string): Promise<Uint8Array> => {
    const known = seatKeys.current.get(seatId);
    if (known !== undefined) return known;

    const one = found.current.get(seatId);
    if (one === undefined) throw new WorkspaceError('Tego miejsca nie ma wśród Twoich obszarów.');
    if (ring === null) throw new WorkspaceError('Bez hasła nie da się otworzyć linku.');

    let area = areaKeys.current.get(one.areaId);

    if (area === undefined) {
      const epochs = await myEpochKeys(ring, one.areaId).catch(() => new Map<number, Uint8Array>());
      const intake = await loadIntake(one.areaId).then((i) => openIntakeKey(i, ring)).catch(() => undefined);
      area = { epochs, intake };
      areaKeys.current.set(one.areaId, area);
    }

    const areaKey = area.epochs.get(one.row.epoch) ?? [...area.epochs.values()].pop() ?? new Uint8Array(32);
    const opened = await officeSeatKey(one.row, areaKey, area.intake);
    if (opened === null) throw new WorkspaceError('Do tego miejsca nie ma klucza.');

    seatKeys.current.set(seatId, opened);
    return opened;
  }, [ring]);

  const peek = useCallback(async (seatId: string): Promise<string | null> => {
    const one = found.current.get(seatId);
    const known = links.current.get(seatId);
    if (known !== undefined) return linkUrl(known, one?.row.under ?? null);

    if (one === undefined || one.row.linkSealed === null || one.row.revokedAt !== null) return null;

    const link = await openLink(seatId, await key(seatId), one.row.linkSealed);
    if (link === null) return null;

    links.current.set(seatId, link);
    return linkUrl(link, one.row.under);
  }, [key]);

  const renew = useCallback(async (seatId: string, check: readonly CheckAnswer[]): Promise<string> => {
    const link = await relinkSeat(seatId, await key(seatId), check);
    links.current.set(seatId, link);
    await reload();
    return linkUrl(link, found.current.get(seatId)?.row.under ?? null);
  }, [key, reload]);

  const forSms = useCallback(async (seatId: string, check: readonly CheckAnswer[]): Promise<string> => {
    const one = found.current.get(seatId);
    if (one === undefined) throw new WorkspaceError('Tego miejsca nie ma wśród Twoich obszarów.');
    if (one.row.revokedAt !== null) throw new WorkspaceError('Link tej osoby jest wycofany — nie ma czego wysłać.');

    /*
     * DER VORHANDENE TAUGT, wenn er lesbar und nicht gesperrt ist — und wenn
     * er beim ersten Öffnen fragt, sobald das Formular es verlangt. Der Link
     * aus der eigenen Anmeldung fragt nicht (wer sich anmeldet, hat die Daten
     * eben getippt); verschickt wird deshalb ein neuer, der es tut.
     */
    const wantsQuestion = check.some((c) => checkText(c.kind, c.value) !== '');
    const reusable = one.row.linkSealed !== null && !one.row.locked && (one.row.asks || !wantsQuestion);

    if (reusable) {
      const url = await peek(seatId);
      if (url !== null) return url;
    }

    return renew(seatId, check);
  }, [peek, renew]);

  const warm = useCallback((seatIds: readonly string[]) => {
    void (async () => {
      for (const seatId of seatIds) await peek(seatId).catch(() => null);
    })();
  }, [peek]);

  return { rows, peek, forSms, renew, key, warm, reload };
}

/* -- Der Link eines Menschen (0027/0046) ----------------------------------- */

/**
 * Der Link eines Menschen — wie er gerade ist, und was man mit ihm tun kann.
 *
 * <b>Er steht einfach da</b> (0046). Vorher stand hier „Wystaw link", und jeder
 * Klick machte den vorigen ungültig — weil der alte nirgends lesbar lag. Jetzt
 * liest die Kanzlei ihn; einen neuen gibt es nur, wenn sie ihn ausdrücklich
 * will („Wystaw nowy link") oder wenn beim Verschicken einer fällig ist.
 *
 * <b>Die SMS steht nicht mehr hier</b>, sondern an der Zeile — im Durchgang
 * „Napisz SMS", mit EINER Nachricht für alle.
 */
function SendPanel({
  seatId, registrationId, values, fields, checks, links, onError, onChanged
}: {
  seatId: string;

  /** Welche Einsendung — eine Bestätigung hängt am WERT, nicht am Menschen. */
  readonly registrationId: string;

  values: Map<string, string> | undefined;
  fields: readonly OpenField[];

  /** Was an einzelnen Werten schon bestätigt ist (0030). */
  checks: readonly ValueCheck[];

  links: SeatLinks;
  onError: (message: string | null) => void;

  /** Nach dem Umschreiben ist die Liste veraltet. */
  onChanged: () => Promise<void>;
}) {
  /** `undefined`: wird gerade gelesen. `null`: die Kanzlei kennt ihn nicht. */
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const row = links.rows.get(seatId);
  const { peek } = links;

  useEffect(() => {
    let alive = true;
    void peek(seatId)
      .then((found) => { if (alive) setUrl(found); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [peek, seatId, row?.linkSealed]);

  const numbers = numbersOf(values, fields);
  const orphans = numbers.filter((n) => n.orphan);

  /** Wohin ein umgeschriebener Wert gehört — die Frage von heute. */
  const livePhone = fields.find((f) => f.kind === 'phone');

  /** Wonach der Link beim ersten Öffnen fragt — lesbar. */
  const asked = (row?.verifyFields ?? '').split(',').filter((id) => id !== '')
    .map((id) => fields.find((f) => f.fieldId === id)?.label ?? 'pytanie usunięte');

  const renew = async () => {
    if (url !== null && !window.confirm(
      'Wystawić nowy link? Obecny przestanie działać — także ten, który ta osoba już ma.')) return;

    setBusy(true);
    onError(null);

    try {
      setUrl(await links.renew(seatId, checkOf(values, fields)));
      setCopied(false);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się wystawić linku.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Einen verwaisten Wert auf die HEUTIGE Frage umschreiben.
   *
   * <b>Warum es das überhaupt braucht.</b> `value_check.field_id` zeigt auf
   * `slug_field` — eine Bestätigung ohne Frage kann es nicht geben. Wer sein
   * Formular neu gebaut hat, trägt aber Antworten, die auf die Fragen von
   * gestern zeigen: lesbar, und trotzdem nicht zu bestätigen.
   *
   * <b>Der Platzschlüssel muss mit</b> — wie bei jeder Korrektur der Kanzlei.
   * Ohne ihn stünde im Portal des Menschen hinterher nichts mehr.
   */
  const rebind = async () => {
    if (livePhone === undefined) return;
    setBusy(true);
    onError(null);

    try {
      /* Die Annahme des Bereichs, in den DIESE Frage schreibt — bei mehreren nicht irgendeine. */
      const intake = await loadPublicIntake(livePhone.areaId);
      const seatKey = await links.key(seatId).catch(() => null);

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

  /**
   * Den Link ZURÜCKNEHMEN — der einzige Handgriff gegen einen Link, der in
   * die falschen Hände geraten ist. Es löscht nichts: die Einsendung bleibt,
   * was aufhört, ist der Zugang über diesen Platz.
   */
  const withdraw = async () => {
    if (!window.confirm('Wycofać link? Ta osoba straci dostęp przez link; zgłoszenie zostaje.')) return;

    setBusy(true);
    onError(null);

    try {
      await revokeSeat(seatId);
      await links.reload();
      setUrl(null);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się wycofać linku.');
    } finally {
      setBusy(false);
    }
  };

  const when = (at: string) =>
    new Date(at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

  if (row !== undefined && row.revokedAt !== null) {
    return (
      <p className="wk-hint">
        Link tej osoby wycofano {when(row.revokedAt)} — przez link nie ma już dostępu.
        Zgłoszenie zostaje.
      </p>
    );
  }

  return (
    <div className="wk-form">
      <h4 className="wk-h3">Link osoby</h4>

      {url === undefined ? (
        <p className="wk-hint">Otwieranie linku…</p>
      ) : url === null ? (
        <p className="wk-hint">
          Tego linku kancelaria nie odczyta — powstał, zanim linki zaczęły być
          zapisywane także dla niej. Przy pierwszym SMS-ie powstanie nowy
          (stary przestanie działać); możesz go też wystawić od razu.
        </p>
      ) : (
        <div className="wk-link-row">
          <input readOnly className="wk-mono" value={url} aria-label="Link osoby" onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button" className="wk-link-btn"
            onClick={() => {
              void navigator.clipboard?.writeText(url)
                .then(() => setCopied(true)).catch(() => setCopied(false));
            }}
          >
            {copied ? 'Skopiowano' : 'Kopiuj'}
          </button>
        </div>
      )}

      {row !== undefined && (
        <p className="wk-hint">
          {row.locked
            ? 'Link zablokowany — ktoś kilka razy źle odpowiedział przy pierwszym otwarciu. Wystaw nowy.'
            : row.asks && row.verifiedAt === null
              ? `Jeszcze nieotwarty. Przy pierwszym otwarciu zapyta o: ${asked.join(', ') || '—'}.`
              : row.asks
                ? `Otwarty i potwierdzony ${when(row.verifiedAt!)} — więcej nie pyta.`
                : 'Ten link nie pyta o nic przy otwarciu.'}
          {row.viewCount > 0 && ` Otwierany ${row.viewCount}×.`}
        </p>
      )}

      <div className="wk-actions">
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void renew()}>
          {busy ? 'Wystawianie…' : url === null ? 'Wystaw link' : 'Wystaw nowy link'}
        </button>
        <button
          type="button" className="wk-link-btn wk-danger" disabled={busy}
          title="Link przestaje działać. Zgłoszenie zostaje."
          onClick={() => void withdraw()}
        >
          Wycofaj link
        </button>
      </div>

      {/*
        DER VERWAISTE WERT — und was dagegen zu tun ist. Er lässt sich lesen
        und anwählen, aber NICHT bestätigen: eine Bestätigung zeigt auf eine
        Frage, und diese gibt es nicht mehr.
      */}
      {orphans.length > 0 && (
        <p className="wk-note">
          {orphans.length === 1
            ? 'Ten numer należy do pytania, którego już nie ma — '
            : 'Te numery należą do pytań, których już nie ma — '}
          SMS wyślesz, ale linku potwierdzającego numer do nich nie da się wystawić.
          {livePhone === undefined ? (
            <> Najpierw dodaj do formularza pytanie o telefon.</>
          ) : (
            <>
              {' '}
              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void rebind()}>
                Przepisz na „{livePhone.label ?? 'telefon'}"
              </button>
            </>
          )}
        </p>
      )}

      {/*
        DER ZUSTAND JEDER NUMMER, die einen Bestätigungslink (`{weryfikacja}`)
        bekommen hat — bestätigt, oder „ist draussen und wartet".
      */}
      {[...new Set(numbers.filter((n) => !n.orphan).map((n) => n.fieldId))].map((fieldId) => {
        const mark = checks.find((c) => c.fieldId === fieldId);
        if (mark === undefined) return null;

        const label = fields.find((f) => f.fieldId === fieldId)?.label ?? 'Numer';

        return mark.verifiedAt !== null ? (
          <p className="wk-hint" key={fieldId}>
            <strong>{label} — potwierdzony</strong> {when(mark.verifiedAt)}
            {mark.origin === 'sms'
              ? ' — ta osoba kliknęła link, który tam wysłaliście.'
              : ' — ta osoba potwierdziła to w swoim portalu. '
                + 'To nie dowód, że telefon działa — jeśli tego potrzebujecie, wyślijcie link.'}
          </p>
        ) : (
          <p className="wk-hint" key={fieldId}>
            Link potwierdzający numer wysłany{' '}
            {new Date(mark.sentAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })},
            {' '}bez odpowiedzi. Ważny do{' '}
            {new Date(mark.expiresAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}.
          </p>
        );
      })}
    </div>
  );
}

/* -- Die Nachricht: einmal geschrieben, als Szablon behalten ---------------- */

/** Eine gespeicherte Nachricht — wie im Altbestand der Veranstaltungen. */
interface SmsTemplate {
  readonly label: string;
  readonly text: string;
}

/**
 * Die Szablony dieses Formulars — aus `config.smsTemplates` (JSON).
 *
 * <b>Die eine Vorlage von vorher</b> (`config.sms`) steht als erster Szablon
 * da, bis die Liste zum ersten Mal gespeichert wird; dann geht sie in ihr auf.
 */
function templatesOf(config: Record<string, string>): readonly SmsTemplate[] {
  let list: SmsTemplate[] = [];

  try {
    const parsed: unknown = JSON.parse(config.smsTemplates ?? '[]');
    if (Array.isArray(parsed)) {
      list = parsed.filter((one): one is SmsTemplate =>
        typeof one === 'object' && one !== null
        && typeof (one as SmsTemplate).label === 'string'
        && typeof (one as SmsTemplate).text === 'string');
    }
  } catch {
    list = [];
  }

  const legacy = (config.sms ?? '').trim();
  return legacy !== '' && !list.some((one) => one.text === legacy)
    ? [{ label: 'Szablon', text: legacy }, ...list]
    : list;
}

/**
 * „Napisz SMS" — die Nachricht für den ganzen Durchgang.
 *
 * <b>Nach dem Altbestand</b> (`RosterPart.SmsPanel`): oben die gespeicherten
 * Szablony, darunter der Text, darunter die Platzhalter zum Einsetzen, und
 * die Nachricht so, wie sie beim ersten Menschen der Liste ankommt.
 *
 * <b>Die Szablony gehören dem Formular</b>, der Text dem Durchgang: wer ihn
 * für heute umschreibt, ändert keinen Szablon, bis er ihn ausdrücklich
 * speichert.
 */
function SmsPanel({
  partId, config, text, onText, onConfig, fields, hasPhones, preview, previewName,
  withoutSeat, willRenew, sentCount, onForget, onError
}: {
  partId: string;
  config: Record<string, string>;
  text: string;
  onText: (next: string) => void;
  onConfig: (next: Record<string, string>) => void;
  fields: readonly OpenField[];
  hasPhones: boolean;
  preview: string | null;
  previewName: string;

  /** Wie viele Menschen keinen Platz haben — bei ihnen bleibt `{link}` leer. */
  withoutSeat: number;

  /** Wie viele beim Verschicken einen NEUEN Link bekommen — ihr alter hört dann auf. */
  willRenew: number;

  sentCount: number;
  onForget: () => void;
  onError: (message: string | null) => void;
}) {
  const templates = templatesOf(config);
  const [naming, setNaming] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveList = async (list: readonly SmsTemplate[]) => {
    setSaving(true);
    onError(null);

    try {
      const done = await setPartConfig(partId, {
        smsTemplates: list.length === 0 ? '' : JSON.stringify(list),
        /* Die eine Vorlage von vorher ist jetzt Teil der Liste — oder bewusst fort. */
        ...((config.sms ?? '') !== '' ? { sms: '' } : {})
      });
      onConfig(done.config);
      setNaming(null);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać szablonu.');
    } finally {
      setSaving(false);
    }
  };

  const saveAs = (label: string) => {
    const name = label.trim();
    if (name === '' || text.trim() === '') return;

    const at = templates.findIndex((one) => one.label === name);
    void saveList(at < 0
      ? [...templates, { label: name, text }]
      : templates.map((one, i) => (i === at ? { label: name, text } : one)));
  };

  const labels = fields.map((f) => f.label).filter((l): l is string => l !== null && l.trim() !== '');
  const holes = ['imie', 'osoba', LINK, ...(hasPhones ? [VERIFY] : []), ...labels];

  /*
   * WAS DER LINK FRAGT, GEHÖRT NICHT IN DIE NACHRICHT. Wer eine SMS
   * pomyłkowo dostaje, liest die Antwort sonst gleich mit — und die Frage beim
   * ersten Öffnen schützt nichts mehr.
   */
  const asked = fields.filter((f) => f.linkCheck);
  const nameAsked = asked.some((f) => f.identityRole === 'given_name' || f.identityRole === 'surname' || f.identityRole === 'name');
  const leaks = [
    ...asked.filter((f) => f.label !== null && usesHole(text, f.label)).map((f) => f.label!),
    ...(nameAsked && usesHole(text, 'osoba') ? ['osoba'] : []),
    ...(asked.some((f) => f.identityRole === 'name') && usesHole(text, 'imie') ? ['imie'] : [])
  ];

  return (
    <div className="wk-sms">
      {templates.length > 0 && (
        <ul className="wk-chips" aria-label="Zapisane szablony">
          {templates.map((one, i) => (
            <li key={`${one.label}-${i}`} className={one.text === text ? 'wk-chip is-on' : 'wk-chip'}>
              <button type="button" className="wk-chip-pick" onClick={() => onText(one.text)}>{one.label}</button>
              <button
                type="button" className="wk-chip-x" disabled={saving}
                aria-label={`Usuń szablon ${one.label}`}
                onClick={() => {
                  if (window.confirm(`Usunąć szablon „${one.label}"?`)) {
                    void saveList(templates.filter((_, j) => j !== i));
                  }
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        rows={3}
        value={text}
        aria-label="Treść wiadomości"
        placeholder="Napisz wiadomość albo wybierz gotową…"
        onChange={(e) => onText(e.target.value)}
      />

      {/*
        Ein Klick setzt den Platzhalter ein — abgetippt wird er sonst falsch,
        und eine Frage heisst genau so, wie sie im Bogen steht.
      */}
      <div className="wk-chips">
        {holes.map((one) => (
          <button key={one} type="button" className="wk-chip wk-chip-add" onClick={() => onText(`${text}{${one}}`)}>
            + {`{${one}}`}
          </button>
        ))}
      </div>

      <p className="wk-hint">
        <code>{'{link}'}</code> — strona osoby (powstaje sama), <code>{'{imie}'}</code> — samo
        imię, <code>{'{osoba}'}</code> — imię i nazwisko
        {hasPhones && <>, <code>{`{${VERIFY}}`}</code> — link potwierdzający ten numer</>}.
        Czego nie da się wypełnić, zostaje widoczne w nawiasach.
      </p>

      {preview !== null && (
        <p className="wk-sms-preview">
          <span className="wk-row-side">Dla: {previewName}</span>
          {preview}
        </p>
      )}

      {leaks.length > 0 && (
        <p className="wk-warn">
          Wiadomość zawiera {leaks.map((l) => `{${l}}`).join(', ')} — o to link pyta przy pierwszym
          otwarciu. Kto dostanie SMS pomyłkowo, przeczyta odpowiedź razem z pytaniem. Usuń to z treści.
        </p>
      )}

      {usesHole(text, LINK) && withoutSeat > 0 && (
        <p className="wk-hint">
          {withoutSeat === 1 ? '1 osoba nie ma' : `${withoutSeat} osób nie ma`} miejsca — u nich{' '}
          <code>{'{link}'}</code> zostanie w nawiasach.
        </p>
      )}

      {usesHole(text, LINK) && willRenew > 0 && (
        <p className="wk-hint">
          {willRenew === 1 ? '1 osoba dostanie' : `${willRenew} osób dostanie`} przy wysyłce <strong>nowy link</strong>
          {asked.length > 0 && <>, który przy pierwszym otwarciu zapyta o: {asked.map((f) => f.label ?? '—').join(', ')}</>}
          . Ich dotychczasowy link przestanie działać.
        </p>
      )}

      <div className="wk-actions">
        {naming === null ? (
          <button
            type="button" className="wk-link-btn" disabled={saving || text.trim() === ''}
            onClick={() => setNaming(templates.find((one) => one.text === text)?.label ?? '')}
          >
            Zapisz jako szablon
          </button>
        ) : (
          <form className="wk-inline" onSubmit={(e) => { e.preventDefault(); saveAs(naming); }}>
            <input
              value={naming}
              placeholder="Nazwa, np. Przypomnienie"
              aria-label="Nazwa szablonu"
              disabled={saving}
              onChange={(e) => setNaming(e.target.value)}
            />
            <button type="submit" className="wk-btn" disabled={saving || naming.trim() === ''}>
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </button>
            <button type="button" className="wk-link-btn" disabled={saving} onClick={() => setNaming(null)}>
              Anuluj
            </button>
          </form>
        )}

        {sentCount > 0 && (
          <span className="wk-hint">
            Otwarto {sentCount} {sentCount === 1 ? 'wiadomość' : 'wiadomości'} w tym przejściu ·{' '}
            <button type="button" className="wk-link-btn" onClick={onForget}>Wyczyść znaczniki</button>
          </span>
        )}
      </div>
    </div>
  );
}

/* -- Das erste Öffnen eines Links (0046) ----------------------------------- */

/**
 * „O CO ZAPYTAĆ PRZY PIERWSZYM OTWARCIU LINKU" — eine Einstellung des
 * ganzen Formulars.
 *
 * <b>Wozu.</b> Ein Link in einer SMS kann bei der falschen Nummer landen. Wer
 * ihn zum ersten Mal öffnet, nennt einmal, was hier gewählt ist — etwa Imię
 * und Nazwisko —, so wie es im Zgłoszenie steht. Einmal richtig: der Link
 * fragt nie wieder. Nichts gewählt: er fragt nichts.
 */
function LinkCheckBox({ partId, fields, busy, onSaved, onError }: {
  partId: string;
  fields: readonly OpenField[];
  busy: boolean;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const current = fields.filter((f) => f.linkCheck).map((f) => f.fieldId).join(',');
  const [draft, setDraft] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(new Set(current === '' ? [] : current.split(',')));
  }, [current]);

  /* Was sich zum Wiedererkennen eignet — keine langen Texte, keine Auswahl aus einer Liste. */
  const askable = fields.filter((f) => f.kind === 'line' || f.kind === 'date' || f.kind === 'phone'
    || f.kind === 'email' || f.kind === 'number');

  const changed = [...draft].sort().join(',') !== current.split(',').filter((id) => id !== '').sort().join(',');

  const save = async () => {
    setSaving(true);
    onError(null);

    try {
      await setLinkCheck(partId, askable.filter((f) => draft.has(f.fieldId)).map((f) => f.fieldId));
      onSaved();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wk-field">
      <span>Pierwsze otwarcie linku — o co zapytać</span>

      <p className="wk-hint">
        Link wysłany SMS-em może trafić pod zły numer. Kto otworzy go pierwszy raz,
        musi podać zaznaczone dane tak jak w zgłoszeniu (wielkość liter i polskie znaki
        nie mają znaczenia). Raz poprawnie — link więcej nie pyta. Nic nie zaznaczone —
        link nie pyta.
      </p>

      {askable.length === 0 ? (
        <p className="wk-empty">W formularzu nie ma pytania, o które dałoby się zapytać.</p>
      ) : (
        <ul className="wk-checks">
          {askable.map((f) => (
            <li key={f.fieldId}>
              <label>
                <input
                  type="checkbox"
                  checked={draft.has(f.fieldId)}
                  disabled={busy || saving || (!draft.has(f.fieldId) && draft.size >= 10)}
                  onChange={(e) => {
                    const next = new Set(draft);
                    if (e.target.checked) next.add(f.fieldId); else next.delete(f.fieldId);
                    setDraft(next);
                  }}
                />
                {' '}{f.label ?? 'zapieczętowane pytanie'}
                <span className="wk-row-side"> · {KIND_LABEL[f.kind]}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <p className="wk-hint">
        Dotyczy linków, które kancelaria wyśle od teraz. Link z samodzielnego zapisu nie
        pyta — zapisujący właśnie te dane wpisał; przy pierwszym SMS-ie dostanie nowy,
        pytający link.
      </p>

      {changed && (
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy || saving} onClick={() => void save()}>
            {saving ? 'Zapisywanie…' : 'Zapisz'}
          </button>
          <button
            type="button" className="wk-link-btn" disabled={saving}
            onClick={() => setDraft(new Set(current === '' ? [] : current.split(',')))}
          >
            Cofnij
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Den Platz eines Menschen aufmachen — über die Epoche oder über die Annahme.
 *
 * <b>Beide Wege, weil es beide gibt</b> (0027): ein Platz, den das Amt
 * ausgestellt hat, hängt an der Epoche; einer aus einer Selbstanmeldung an der
 * Annahme. Welcher, sagt die Zeile selbst. Für Korrekturen vieler Zeilen auf
 * einmal (`straighten`); die Liste der Menschen hat ihren eigenen Weg
 * (`useSeatLinks`).
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

/* -- Die Überschrift ------------------------------------------------------- */

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
