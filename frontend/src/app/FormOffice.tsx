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
  type FieldKind, type IdentityRole, type OpenField, type SealedField, type Submission,
  editField, moveAnswers, sealQuestion, type MovedValue
} from './form';
import { createIntake, loadIntake, loadPublicIntake, openIntakeKey } from './intake';
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
    if ((tab !== 'entries' && tab !== 'people') || autoTried || ring === null
      || lastArea !== null || areasHere.length === 0) return;
    setAutoTried(true);
    void act('Otwieranie zgłoszeń…', () => read(areasHere[0]));
  }, [tab, autoTried, ring, lastArea, areasHere.length]);

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
        areaId: f.areaId
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
      identityRole: change.identityRole,
      moveTo
    });

    /* Die geöffneten Antworten gehören jetzt zu einer anderen Annahme — neu öffnen. */
    if (moveTo !== undefined) { setLastArea(null); setOpened(new Map()); setSubmissions([]); setAutoTried(false); }
  };

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

          <Template
            partId={partId}
            value={conf.sms ?? ''}
            labels={fields.map((f) => f.label)}
            busy={busy !== null}
            onSaved={setSaved}
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
          fileName={module?.name ?? conf.title ?? 'zgloszenia'}
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
          kind, isRequired: required, isHalfWidth: field.isHalfWidth, identityRole: identity, areaId
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

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || label.trim() === ''}>
          {moving ? 'Zapisz i przenieś odpowiedzi' : 'Zapisz'}
        </button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={onCancel}>Anuluj</button>
      </div>
    </form>
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
