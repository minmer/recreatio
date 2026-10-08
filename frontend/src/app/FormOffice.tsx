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

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { areaPath, loadAreas, loadPublicKey, myEpochKeys, type AreaRow } from './area';
import { fromBase64Url } from './crypto';
import {
  CHOOSABLE_IDENTITY, FIELD_KINDS, IDENTITY_LABEL, KIND_LABEL, fullNameOf,
  addField, loadFields, loadRegistrations, openFields,
  armCheck, hideSubmission, readAcross, removeField, removeSubmission, reviseAsOffice,
  rewrapToOffice, setLinkCheck, setPartConfig,
  type ValueCheck,
  type FieldKind, type IdentityRole, type OpenField, type SealedField, type Submission,
  editField, moveAnswers, sealQuestion, type MovedValue,
  AUDIENCE_LABEL, consentGiven, consentText,
  addOfficeEntry, asked, restoreField, reviseAcrossAsOffice, takenOff, type Answer
} from './form';
import { applyNeed, dropNeed, lockedOf, NEEDS, readNeeds, type FormNeed } from './formTemplates';
import { ageFields, PAPER_MINOR, parentalConsentOf, SignSheetButton } from './SignSheet';
import { ListJsonPanel } from './ListJsonPanel';
import { ExtensionEntry, ExtensionSheet, OfficeAdd } from './ExtensionSheet';
import { REPEAT_LABEL, REPEATS, repeatOf, roundLabel, roundOf, type Repeat } from './rounds';
import { type ReadForm } from './formRead';
import {
  deskChanged, deskRows, formAreasOf, openStepInfo, PANEL_SECTIONS, readExtensions, seatAreasOf, stepKindsOf, stepMatches,
  numbersOf, STEP_CHOICES, type DeskRow, type EntryDesk, type Numbered, type PanelSection, type StepInfo
} from './entryDesk';
import { newId } from './ids';
import { viewPath } from './routes';
import { loadSteps, progressOf, type ExtensionInfo } from './steps';
import { PersonSteps, StepsEditor, stepsKey } from './StepList';
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
import { loadChats, startSeatChat } from './chat';
import { loadMembers } from './area';
import { meetingAreas } from './audience';

/**
 * 0069 — „NAPISZ DO TEJ OSOBY": die Rozmowa mit dem Menschen hinter diesem
 * Platz. Gibt es sie, öffnet sie sich; sonst entsteht sie — angelegt von einer
 * meiner Rollen, die den Bereich liest. Den Schlüssel gibt mein Browser ihm,
 * sobald er sie das erste Mal öffnet.
 *
 * 0080 — der Zugang „jeden na jeden" (`audience.ts`): AN WELCHEM BEREICH,
 * wählt, wer schreibt — der des Formulars, einer seiner Fragen, der des
 * Platzes, oder einer darüber (`meetingAreas`). Mitlesen alle, die diesen
 * Bereich lesen; die anderen aus dem Formular nicht. Je Bereich eine Rozmowa.
 */
function WriteToSeat({ seatId, near, areas, ring, busy, onError }: {
  seatId: string;

  /** Die Bereiche, mit denen dieser Mensch zu tun hat — der nächste zuerst. */
  near: readonly (string | null)[];
  areas: readonly AreaRow[];
  ring: Ring;
  busy: boolean;
  onError: (message: string | null) => void;
}) {
  const [working, setWorking] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [pick, setPick] = useState('');
  const [had, setHad] = useState<ReadonlyMap<string, string>>(new Map());
  const choices = meetingAreas(areas, near);

  const open = async (areaId: string) => {
    setWorking(true);
    onError(null);
    try {
      const existing = (await loadChats()).chats.find((c) => c.seatId === seatId && c.areaId === areaId);
      if (existing !== undefined) { window.location.hash = viewPath('chat', existing.chatId); return; }
      const { members } = await loadMembers(areaId);
      const as = members.find((m) => ring.has(m.roleId) && m.kind !== 'account'
        && (m.capabilities.includes('read') || m.capabilities.includes('write') || m.capabilities.includes('admin')));
      if (as === undefined) throw new WorkspaceError('Żadna z Twoich ról nie czyta tego obszaru.');
      const chatId = await startSeatChat(areaId, as.roleId, seatId);
      window.location.hash = viewPath('chat', chatId);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć rozmowy.');
    } finally {
      setWorking(false);
    }
  };

  /* Ein Bereich zur Wahl: gleich hinein. Mehrere: wählen — einer, in dem es die Rozmowa schon gibt, steht vorn. */
  const begin = async () => {
    onError(null);
    if (choices.length === 0) { onError('Nie czytasz żadnego obszaru, z którego można napisać do tej osoby.'); return; }
    if (choices.length === 1) { await open(choices[0].areaId); return; }
    try {
      const mine = (await loadChats()).chats.filter((c) => c.seatId === seatId);
      setHad(new Map(mine.map((c) => [c.areaId, c.chatId])));
      setPick(mine.find((c) => choices.some((a) => a.areaId === c.areaId))?.areaId ?? choices[0].areaId);
      setChoosing(true);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć rozmowy.');
    }
  };

  if (choosing) {
    return (
      <span className="wk-seat-meet">
        <label>
          <span>Rozmowa z obszaru</span>{' '}
          <select value={pick} disabled={working} onChange={(e) => setPick(e.target.value)}>
            {choices.map((a) => (
              <option key={a.areaId} value={a.areaId} title={areaPath(areas, a.areaId).full}>
                {areaPath(areas, a.areaId).short}{had.has(a.areaId) ? ' — rozmowa już jest' : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="wk-link-btn" disabled={busy || working || pick === ''} onClick={() => void open(pick)}>
          {working ? 'Otwieranie…' : had.has(pick) ? 'Otwórz' : 'Zacznij'}
        </button>
        <button type="button" className="wk-link-btn" disabled={working} onClick={() => setChoosing(false)}>Anuluj</button>
        <span className="wk-hint">Czytają ją ta osoba i wszyscy, którzy mają dostęp do wybranego obszaru — inni z formularza nie.</span>
      </span>
    );
  }

  return (
    <button type="button" className="wk-link-btn" disabled={busy || working} onClick={() => void begin()}>
      {working ? 'Otwieranie…' : 'Napisz do tej osoby'}
    </button>
  );
}
import { Unlock } from './Unlock';
import { joinPhones, splitPhones, withPhone } from './phone';
import { crookedOf, seatKeyFinder, straighten as straightenAll, tidyKindOf, type Crooked } from './answerTidy';
import { TidyList, toggled } from './TidyList';
import { plural } from './ChatKit';
import { PostalInput } from './PostalInput';
import { LINK, renderSms, smsHref, usesHole, VERIFY } from './sms';
import { AreaOptions } from './AreaOptions';
import { FormTable, type TableChange } from './FormTable';
import { ModuleSettings } from './ModuleSettings';
import { createModule, updateModule, type ModuleRow, type Resealed, type ResealIn } from './module';
import {
  EMPTY_DESIGN, layoutWith, openDesign, saveDesign, sealDesign,
  type FormDesign, type SealedDesign
} from './formDesign';
import { FormLayout } from './FormLayout';
import { FormLogic } from './FormLogic';

/** Die Reiter eines Formulars: einrichten (vier) — lesen — handeln. */
type FormTabName = 'settings' | 'questions' | 'layout' | 'logic' | 'entries' | 'steps' | 'people';

/*
 * Welcher Reiter je Formular zuletzt offen war — solange die Seite lebt. Die
 * Ansicht wird nach jeder Änderung am Baustein neu aufgebaut; ohne das spränge
 * sie dabei auf ihren Anfangsreiter zurück.
 */
const lastTab = new Map<string, FormTabName>();

export function FormOffice({ partId, config, who, standsOn, module, onModuleChanged, onList }: {
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

  /** Gleich auf der Liste aufschlagen — wer von der Seite des Formulars kommt, sucht seine Menschen. */
  onList?: boolean;
}) {
  /*
   * DREI REITER, wie im Altbestand der Veranstaltungen (`events/admin`:
   * Strony · Dostęp · Ustawienia): EINRICHTEN, LESEN, HANDELN. Vorher stand
   * alles untereinander — Fragen, Annahme, Vorlage, Portal, und darunter die
   * Einsendungen —, und wer nur jemanden anrufen wollte, scrollte durch die
   * Einrichtung.
   */
  /*
   * 0077 — eine WIEDERKEHRENDE Erweiterung, die schon Fragen hat, öffnet auf
   * ihrer Liste: wer „Odwiedziny" aufschlägt, will den Monat abhaken, nicht
   * die Einstellungen lesen.
   */
  const [tab, pickTab] = useState<FormTabName>(() => {
    /* Die Adresse verlangt die Liste: das gilt wie eine eigene Wahl, also bleibt es auch nach dem Neuaufbau. */
    if (onList === true) { lastTab.set(partId, 'people'); return 'people'; }

    return lastTab.get(partId) ?? (module === undefined ? 'questions'
      : module.extendsId !== null && repeatOf(module.repeat) !== 'once' && module.fields > 0 ? 'people' : 'settings');
  });
  const setTab = (next: FormTabName) => { lastTab.set(partId, next); pickTab(next); };

  /* Welche Antwortbereiche schon annehmen können (0022) — je Bereich ein Paar. */
  const [intakes, setIntakes] = useState<ReadonlyMap<string, boolean>>(new Map());

  const [ring, setRing] = useState<Ring | null>(null);
  const [person, setPerson] = useState<SealedRole | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  /* 0086 — ALLE Fragen, auch die vom Formular genommenen: ihre Antworten bleiben lesbar. */
  const [allFields, setFields] = useState<readonly OpenField[]>([]);

  /** Was das Formular fragt — daraus wird es gebaut, ausgefüllt, gedruckt. */
  const fields = useMemo(() => asked(allFields), [allFields]);

  /** Was vom Formular genommen ist — es steht nur noch bei den Antworten. */
  const removedFields = useMemo(() => takenOff(allFields), [allFields]);
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

  /**
   * Wie weit das Öffnen ist — `null`: es läuft gerade keins. Auf einem
   * Telefon dauert das erste Öffnen vieler Einsendungen spürbar; ohne Zahl sah
   * es aus, als käme nichts.
   */
  const [reading, setReading] = useState<{ done: number; total: number } | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  /**
   * Die Einstellungen, nachdem HIER etwas gespeichert wurde.
   *
   * Der Baustein gehört der Seite darüber, und die lädt sich nicht neu, bloss
   * weil hier ein Satz getippt wurde. Ohne diesen Schatten stünde nach dem
   * Speichern wieder der alte Text da — als wäre nichts angekommen.
   */
  const [saved, setSaved] = useState<Record<string, string> | null>(null);

  /*
   * DIE ERWEITERUNGEN UND SCHRITTE (0047). `stepInfo`: die von Hand
   * angelegten Schritte (aufgemacht) und die Erweiterungen, aus denen sich die
   * übrigen ergeben. `extData`: was je Erweiterung eingetragen ist — für die
   * Zeile eines Menschen.
   */
  const [stepInfo, setStepInfo] = useState<StepInfo | null>(null);
  const [extData, setExtData] = useState<ReadonlyMap<string, ReadForm>>(new Map());

  /** Eine Erweiterung (0047) — dann ist manches anders: keine eigene Liste, keine Schritte, kein Portal. */
  const isExtension = module !== undefined && module.extendsId !== null;

  /*
   * 0083 — DIE TABELLE AUCH FÜR EINE ERWEITERUNG, die einmal ausgefüllt wird:
   * etwa „Dane do ubezpieczenia" über den Link — ihre CSV ist die Liste für
   * den Versicherer. Eine wiederkehrende hat dafür ihre eigene Liste je Zeitraum.
   */
  const tableToo = isExtension && repeatOf(module?.repeat) === 'once';
  const readsHere = (t: FormTabName) => (t === 'entries' && (!isExtension || tableToo)) || (t === 'people' && !isExtension);
  const conf = saved ?? config;

  /* 0086 — was die eingeschalteten Wymagania sperren: Fragen, Logik. */
  const locks = useMemo(() => lockedOf(readNeeds(conf.needs)), [conf.needs]);

  /** Eine Auskunft über das eben Entfernte („zdjęte z formularza — odpowiedzi zostają"). */
  const [removedNote, setRemovedNote] = useState<string | null>(null);

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
  /**
   * Die Schritte laden und aufmachen — mit dem Epochenschlüssel, mit dem jeder
   * versiegelt wurde (aus der Zuteilung, sonst dem veröffentlichten) — `entryDesk.ts`.
   */
  const loadStepInfo = useCallback(async (bund: Ring) => {
    setStepInfo(await openStepInfo(partId, bund).catch(() => null));
  }, [partId]);

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

    /* Die Schritte (0047) — nur ein Formular, das nicht selbst eine Erweiterung ist, hat welche. */
    await loadStepInfo(bund);
  }, [who, partId, loadStepInfo]);

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

    const { registrations } = await loadRegistrations(partId, hidden);

    /*
     * ERST JETZT GILT DIE LISTE ALS OFFEN. Vorher stand der Bereich schon als
     * gelesen da, bevor die Einsendungen überhaupt angekommen waren — und der
     * Reiter sagte „Nikt się jeszcze nie zapisał", solange das Telefon noch
     * lud. Schlug das Laden fehl, blieb genau dieser Satz stehen.
     */
    setShutAreas(shut);
    setSubmissions(registrations);
    setReadAreas(keys.map((one) => one.areaId));

    const areaOf = new Map(allFields.map((f) => [f.fieldId, f.areaId]));
    const named: { seatId: string; name: string }[] = [];

    const out = new Map<string, Map<string, string>>();
    let sent = 0;
    let got = 0;

    /*
     * IN HAPPEN, UND JEDER HAPPEN ZÄHLT.
     *
     * Was noch im RSA-Umschlag liegt (0037), kostet je Wert eine RSA-Operation
     * — auf einem Telefon das Zehnfache. Deshalb: eine Zahl, die sagt, wie weit
     * es ist; zwischen den Happen darf die Seite zeichnen; und was aufging, wird
     * GLEICH umgestellt, nicht erst am Ende. Wird das Lesen unterbrochen — der
     * Tab verschwindet, während die SMS-App offen ist —, ist das Geschaffte
     * nicht verloren, und das nächste Öffnen geht schneller.
     */
    const CHUNK = 8;
    setReading({ done: 0, total: registrations.length });

    try {
      for (let at = 0; at < registrations.length; at += CHUNK) {
        const pending: { fieldId: string; registrationId: string; officeKeySealed: string }[] = [];

        for (const one of registrations.slice(at, at + CHUNK)) {
          const { values: merged, toRewrap } = await readAcross(one, keys, areaOf);
          sent += one.values.length;

          for (const one2 of toRewrap) pending.push({ ...one2, registrationId: one.registrationId });

          out.set(one.registrationId, merged);

          /* Der volle Name, für den Platz dieser Einsendung — gleich unten ergänzt. */
          const full = one.seatId === null ? null : fullNameOf(fields, (fieldId) => merged.get(fieldId));
          if (full !== null && one.seatId !== null) named.push({ seatId: one.seatId, name: full });
          got += merged.size;
        }

        setReading({ done: Math.min(at + CHUNK, registrations.length), total: registrations.length });

        /*
         * RSA IST DER UMSCHLAG, NICHT DER TRESOR (0037). Was gerade aufging,
         * lag noch unter dem RSA-Umschlag der Annahme. Genau jetzt liegt der
         * Schlüssel offen — also wird er unter dem Schlüssel der Amtsrolle neu
         * versiegelt, und der Umschlag fällt. Still: es ändert nicht, wer lesen
         * darf. Schlägt es fehl, bleibt alles, wie es war — beim nächsten Öffnen
         * wieder.
         */
        if (pending.length > 0) await rewrapToOffice(partId, pending).catch(() => undefined);

        await new Promise((done) => setTimeout(done, 0));
      }
    } finally {
      setOpened(out);
      setReading(null);
    }

    /*
     * WAS DIE ERWEITERUNGEN ÜBER DIESE MENSCHEN WISSEN (0047) — jede in ihrem
     * eigenen Versuch: eine, deren Bereich dieser Browser nicht liest, fehlt
     * nur selbst.
     */
    const exts = await readExtensions((await loadSteps(partId).catch(() => null))?.extensions ?? [], ring);
    setExtData(exts);

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

  /* 0086 — auch die Bereiche der vom Formular genommenen Fragen: ihre Antworten sollen aufgehen. */
  const areasHere = [...new Set(allFields.map((f) => f.areaId))];

  /*
   * 0082 — WAS ANDERS DASTEHT, als es heute gespeichert würde: Telefonnummern
   * und Adressen (`answerTidy.ts`, dieselbe Stelle wie der Durchgang über alle
   * Formulare in der Kartoteka). Gerechnet auf dem, was AUFGEGANGEN ist.
   */
  const tidyFields = fields.filter((f) => tidyKindOf(f) !== null);
  const [crooked, setCrooked] = useState<readonly Crooked[]>([]);
  const [tidyOpen, setTidyOpen] = useState(false);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const crookedKey = (c: Crooked) => `${c.registrationId}|${c.fieldId}`;
  useEffect(() => {
    let alive = true;
    if (tidyFields.length === 0) { setCrooked([]); return undefined; }
    void crookedOf({ fields, registrations: submissions, opened })
      .then((found) => {
        if (!alive) return;
        setCrooked(found);
        /* Was der Zerleger nicht sicher wusste, ist zunächst NICHT angehakt. */
        setSkipped(new Set(found.filter((c) => c.doubt).map(crookedKey)));
      })
      .catch(() => undefined);
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, submissions, opened]);

  /**
   * Die angehakten auf einmal geraderücken — neu versiegelt wie jede
   * Berichtigung der Kanzlei: für das Amt UND für den Menschen (sein
   * Platzschlüssel muss mit, sonst nähme die Korrektur ihm seine Angabe weg).
   */
  const straighten = async () => {
    if (ring === null) throw new WorkspaceError('Bez hasła nie da się poprawić.');
    if (readAreas === null) throw new WorkspaceError('Najpierw otwórz zgłoszenia.');

    const keys = new Set(crooked.filter((c) => !skipped.has(crookedKey(c))).map(crookedKey));

    /*
     * Noch einmal gerechnet, diesmal MIT Eintrag ins gemeinsame Verzeichnis —
     * dann schreibt die nächste Adresse (auch in einem anderen Formular) diese
     * Straße genauso. Übernommen wird, was angehakt war.
     */
    const fresh = await crookedOf({ fields, registrations: submissions, opened }, true);
    const chosen = fresh.filter((c) => keys.has(crookedKey(c)));
    const phones = chosen.filter((c) => c.kind === 'phone').length;

    const areaOf = new Map(fields.map((field) => [field.fieldId, field.areaId]));
    const done = await straightenAll(ring, { registrations: submissions, areaOf }, chosen, seatKeyFinder(ring));
    setTidyOpen(false);

    await read();

    /*
     * ERST NACH `read` — es setzt seine eigene Auskunft und würde diese sonst
     * überschreiben. Eine neu geschriebene Nummer ist für den Dienst eine
     * ANDERE Nummer, ungeprüft (0030) — wer eben ein Häkchen sah, soll wissen, warum es weg ist.
     */
    setNote(`Uporządkowano ${done.values} ${done.values === 1 ? 'odpowiedź' : 'odpowiedzi'} `
      + `(${done.people === 1 ? 'jedna osoba' : done.people + ' osób'}).`
      + (phones > 0 ? ' Potwierdzenia poprawionych numerów wygasły — to już inny zapis numeru.' : ''));
  };

  /*
   * AUFMACHEN, SOBALD MAN HINSIEHT. Wer den Reiter „Zgłoszenia" oder „Osoby"
   * öffnet, will die Einsendungen sehen — ein eigener Knopf davor war ein
   * Klick, der nichts entschied. Einmal — und ALLE Bereiche zugleich, die
   * dieser Browser öffnen kann.
   */
  const [autoTried, setAutoTried] = useState(false);

  /**
   * NUR LESEN — ohne danach alles andere neu zu holen, wie `act` es tut. Am
   * Formular hat sich nichts geändert; auf einem Telefon hiess das zweite
   * Laden ein paar Sekunden mehr „Otwieranie…" für nichts.
   *
   * Und ein Fehler sagt, WAS schiefging: „Nie udało się." allein half
   * niemandem, der es am Telefon sah.
   */
  const openAll = (what: string, hidden?: boolean) => {
    setBusy(what);
    setFailed(null);

    void read(hidden)
      .catch((e: unknown) => setFailed(
        e instanceof WorkspaceError ? e.message
        : `Nie udało się otworzyć zgłoszeń${e instanceof Error && e.message !== '' ? `: ${e.message}` : '.'}`))
      .finally(() => setBusy(null));
  };

  useEffect(() => {
    if (!readsHere(tab) || autoTried || ring === null
      || readAreas !== null || areasHere.length === 0) return;
    setAutoTried(true);
    openAll('Otwieranie zgłoszeń…');
  }, [tab, isExtension, autoTried, ring, readAreas, areasHere.length]);

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
    /* 0086 — auch die vom Formular genommenen: ihre Beschriftung muss lesbar bleiben. */
    const unread = allFields.filter((f) => f.label === null);
    if (unread.length > 0) {
      throw new WorkspaceError('Nie każde pytanie da się teraz odczytać — bez tego nie da się ich przepieczętować.');
    }
    if (designLocked) {
      throw new WorkspaceError('Układu formularza nie da się teraz odczytać — bez tego nie da się go przepieczętować.');
    }

    const out: ResealIn[] = [];
    for (const f of allFields) {
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
  const stale = module?.areaId == null ? [] : allFields.filter((f) => f.labelAreaId !== module.areaId);

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

  /*
   * Ein Formularbereich, der nicht jawny ist: dann liest die Fragen nur, wer
   * den Bereich liest — auf der Seite genauso wie hier (`areaReader`). Das
   * kann gewollt sein (ein Formular nur für die eigenen Leute), also sagt der
   * Satz beides: wer es liest, und was zu tun ist, wenn es alle sollen.
   */
  const hiddenNotice = formArea !== undefined && formArea.publicLevel === 'none' && (
    <p className="wk-warn">
      Obszar formularza „{areaLabel(formArea.areaId)}" nie jest jawny — na stronie pytania przeczyta
      tylko ten, kto czyta ten obszar (zalogowany albo przez link z dostępem); dla pozostałych będą
      nieczytelne. Ma być dla wszystkich? Ustaw w tym obszarze, w zakładce „Dla wszystkich",
      „Każdy czyta" — albo wybierz tu obszar jawny.
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

  /**
   * 0086 — DIE TABELLE SPEICHERN: geänderte Zellen je Einsendung neu versiegelt
   * (für das Amt UND, wo es einen Platz gibt, für den Menschen — sonst nähme
   * ihm die Korrektur seine Angabe weg), neue Zeilen als Einträge der Kanzlei.
   */
  const saveTable = async (changes: readonly TableChange[], added: readonly (readonly Answer[])[]): Promise<string | null> => {
    if (ring === null) throw new WorkspaceError('Bez hasła nie da się zapisać.');

    const intakes = new Map<string, Uint8Array>();
    for (const areaId of new Set(allFields.map((f) => f.areaId))) {
      try { intakes.set(areaId, fromBase64Url((await loadPublicIntake(areaId)).publicKey)); } catch { /* ohne Annahme: diese Fragen nicht */ }
    }
    const areaOf = new Map(allFields.map((f) => [f.fieldId, f.areaId]));
    const seats = seatKeyFinder(ring);
    let blind = 0;

    for (const one of changes) {
      const seatId = submissions.find((r) => r.registrationId === one.registrationId)?.seatId ?? null;
      const seatKey = seatId === null ? null : await seats(seatId).then((r) => r.key).catch(() => null);
      if (seatId !== null && seatKey === null) blind += 1;
      await reviseAcrossAsOffice(one.registrationId, one.answers, { intakes, areaOf, seatKey });
    }

    for (const answers of added) {
      await addOfficeEntry(partId, null, answers, { intakes, areaOf, seatKey: null });
    }

    await read();

    /*
     * ERST NACH `read` — es setzt seine eigene Auskunft, und die Tabelle
     * entsteht dabei neu (ihre eigene Meldung ginge mit ihr). Die Auskunft
     * steht über der Tabelle und bleibt.
     */
    const cells = changes.reduce((n, one) => n + one.answers.length, 0);
    setNote([
      cells > 0 ? `Zapisano zmienione odpowiedzi: ${cells}.` : '',
      added.length > 0 ? `Dopisano osób: ${added.length}.` : '',
      blind === 0 ? '' : `${blind === 1 ? 'Jedna osoba nie zobaczy' : `${blind} osób nie zobaczy`} poprawionych odpowiedzi w swoim linku — do jej miejsca nie ma tu klucza.`
    ].filter((x) => x !== '').join(' '));
    return null;
  };

  return (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint" role="status">{busy}</p>}

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
        {(!isExtension || tableToo) && (
          <FormTab now={tab} mine="entries" onPick={setTab}>
            Zgłoszenia{submissions.length > 0 ? ` (${submissions.length})` : ''}
          </FormTab>
        )}
        {module !== undefined && !isExtension && <FormTab now={tab} mine="steps" onPick={setTab}>Znaczniki</FormTab>}
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

          {/* 0083 — WAS NACH DEM ABSENDEN DASTEHT, und ob unterschrieben werden muss. */}
          <AfterSendSettings
            partId={partId}
            config={conf}
            fields={fields}
            busy={busy !== null}
            onSaved={setSaved}
            onError={setFailed}
          />

          {isExtension ? (
            /*
             * EINE ERWEITERUNG (0047): wessen, und wer sie ausfüllt. Portal und
             * Link gehören dem erweiterten Formular — die Ergänzung kommt über
             * denselben Link.
             */
            <ExtensionOf
              row={module!}
              busy={busy !== null}
              onRepeat={(repeat) => moduleAct('Zapisywanie…', () => updateModule(module!.moduleId, { repeat }))}
            />
          ) : (
            <>
              {/* WAS NACH DEM ABSENDEN KOMMT — und was der Mensch mit seinem Link bekommt. */}
              <Portal
                moduleId={partId}
                standsOn={standsOn ?? []}
                portalUnder={(conf.portalUnder ?? '').trim()}
                portalAt={(conf.portalAt ?? '').trim()}
                ownerRoleId={person?.id ?? null}
                onSet={(where, at) => {
                  const next: Record<string, string> = { ...conf, portalUnder: where };
                  if (at === '') delete next.portalAt;
                  else if (at !== undefined) next.portalAt = at;
                  setSaved(next);
                }}
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

              {/* WAS DIESES FORMULAR ERWEITERT (0047) — für die Kanzlei, und für den Menschen später. */}
              <Extensions
                base={module!}
                extensions={stepInfo?.extensions ?? []}
                busy={busy !== null}
                onCreated={() => act('Zakładanie rozszerzenia…', async () => { await onModuleChanged?.(); })}
                onError={setFailed}
              />
            </>
          )}
        </>
      )}

      {/* == DIE SCHRITTE (0047) =============================================== */}

      {tab === 'steps' && module !== undefined && !isExtension && (
        stepInfo === null ? (
          <p className="wk-empty">Wczytywanie kroków…</p>
        ) : (
          <StepsEditor
            key={stepsKey(stepInfo.steps)}
            partId={partId}
            steps={stepInfo.steps}
            extensions={stepInfo.extensions}
            formKey={module.areaId === null || ring === null ? null : async () => {
              const { key, epoch } = await keyOf(module.areaId!);
              return { areaId: module.areaId!, epoch, key };
            }}
            busy={busy !== null}
            onSaved={async () => { if (ring !== null) await loadStepInfo(ring); }}
            onError={setFailed}
          />
        )
      )}

      {/* == DIE ERWEITERUNG: je Mensch des erweiterten Formulars (0047) ======== */}

      {tab === 'people' && isExtension && (
        <ExtensionSheet
          extensionId={partId}
          baseId={module!.extendsId!}
          audience={module!.audience}
          who={who}
          repeat={module!.repeat}
          name={module!.name}
        />
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

          {/*
            0086 — WYMAGANIA zum Ankreuzen: Niepełnoletni (mit Ausdruck), Zdrowie,
            Ubezpieczenie, Zasady. Ihre Fragen lassen sich nicht löschen, solange
            sie eingeschaltet sind — verschieben schon.
          */}
          {module !== undefined && ring !== null && (
            <NeedsPanel
              module={module}
              who={who}
              config={conf}
              answersTo={areasHere[0] ?? module.areaId}
              areas={areas}
              busy={busy !== null}
              onAct={(what, todo) => act(what, todo)}
              onConfig={setSaved}
            />
          )}

          {removedNote !== null && <p className="wk-done" role="status">{removedNote}</p>}

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
                    {locks.fields.has(f.fieldId) && (
                      <span className="wk-tag wk-tag-need" title="Nie da się go usunąć, dopóki wymaganie jest zaznaczone — można je przesunąć i zmienić jego treść.">
                        wymaganie: {locks.fields.get(f.fieldId)}
                      </span>
                    )}
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
                      type="button" className="wk-link-btn" disabled={busy !== null || locks.fields.has(f.fieldId)}
                      title={locks.fields.has(f.fieldId) ? `Należy do wymagania „${locks.fields.get(f.fieldId)}” — najpierw je odznacz.` : undefined}
                      onClick={() => void act('Usuwanie…', async () => {
                        setRemovedNote(null);
                        const done = await removeField(f.fieldId);
                        /* 0086 — mit Antworten: vom Formular genommen, nicht gelöscht. */
                        if (done.kept === true) {
                          setRemovedNote(`„${f.label ?? 'Pytanie'}” zdjęto z formularza — nikt go już nie dostanie, a dotychczasowe odpowiedzi zostają w zgłoszeniach. Można je przywrócić niżej.`);
                        }
                      })}
                    >
                      Usuń
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* 0086 — VOM FORMULAR GENOMMEN: ihre Antworten bleiben; zurückholen geht. */}
          {removedFields.length > 0 && (
            <details className="wk-fold wk-taken-off">
              <summary>Zdjęte z formularza ({removedFields.length}) — ich odpowiedzi zostają w zgłoszeniach</summary>
              <ul className="wk-list">
                {removedFields.map((f) => (
                  <li className="wk-row wk-row-muted" key={f.fieldId}>
                    <span>
                      <strong>{f.label ?? 'zapieczętowane'}</strong>
                      <span className="wk-row-side">
                        {' · '}{KIND_LABEL[f.kind]}
                        {f.removedAt != null && ` · zdjęte ${new Date(f.removedAt).toLocaleDateString('pl-PL')}`}
                      </span>
                    </span>
                    <span className="wk-row-side">
                      <button
                        type="button" className="wk-link-btn" disabled={busy !== null}
                        onClick={() => void act('Przywracanie…', async () => { setRemovedNote(null); await restoreField(f.fieldId); })}
                      >
                        Przywróć
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {ring !== null && (
            <NewFieldForm
              areas={areas}
              ring={ring}
              partId={partId}
              position={allFields.length}
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
            locked={locks}
            busy={busy !== null}
            onSave={(nodes, edges) => void act('Zapisywanie logiki…',
              () => saveDesignNow({ ...current, layout, nodes, edges }))}
          />
        )
      )}

      {/* == 2 und 3: was dafür aufgemacht werden muss ======================== */}

      {readsHere(tab) && (
        <>
          {areasHere.length === 0 ? (
            <p className="wk-empty">Najpierw pytania — bez nich nie ma zgłoszeń.</p>
          ) : readAreas === null ? (
            <div className="wk-actions">
              <button
                type="button" className="wk-btn"
                disabled={busy !== null || ring === null}
                onClick={() => openAll('Otwieranie zgłoszeń…')}
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

          {reading !== null && (
            <p className="wk-hint" role="status">
              Otwieranie zgłoszeń: {reading.done} z {reading.total}…
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
                    openAll('Wczytywanie…', hidden);
                  }}
                />
                {' '}Pokaż też ukryte
              </span>
            </label>
          )}
        </>
      )}

      {/* == 2. LESEN ======================================================= */}

      {tab === 'entries' && readAreas !== null && reading === null && (
        <FormTable
          fields={fields}
          removed={removedFields}
          submissions={submissions}
          opened={opened}
          fileName={module?.name ?? conf.title ?? 'zgloszenia'}
          onSave={ring === null ? undefined : saveTable}
          canAdd={!isExtension}
        />
      )}

      {/* == 3. HANDELN ===================================================== */}

      {/*
        0077 — JEMANDEN SELBST EINTRAGEN: wer am Telefon zusagt, auf einem
        Zettel steht oder gar nicht selbst handelt, kommt so auf die Liste.
        Ausserhalb des Kastens darunter: der verschwindet, während die Liste neu
        gelesen wird — und nähme das offene Formular mit, mitten beim Eintragen
        mehrerer Menschen.
      */}
      {tab === 'people' && !isExtension && ring !== null && readAreas !== null && (
        <OfficeAdd formId={partId} fields={fields} design={design} onAdded={reread} />
      )}

      {tab === 'people' && readAreas !== null && reading === null && !isExtension && (
        <>
          {/*
            „UPORZĄDKUJ DANE" STEHT IMMER DA, sobald das Formular nach einer
            Nummer oder einer Adresse fragt — und nicht erst, wenn etwas krumm
            ist. Abgeblendet, mit dem Grund darunter. 0082: auch Adressen, mit
            einer Vorschau zum Abhaken.
          */}
          {tidyFields.length > 0 && (
            <div className="wk-actions">
              <button
                type="button" className="wk-link-btn"
                disabled={busy !== null || crooked.length === 0}
                onClick={() => setTidyOpen((was) => !was)}
              >
                {crooked.length === 0 ? 'Uporządkuj dane' : `Uporządkuj dane (${crooked.length})`}
              </button>
              <span className="wk-hint">
                {crooked.length === 0
                  ? 'Numery telefonu i adresy są już zapisane w jednej postaci.'
                  : [
                    [crooked.filter((c) => c.kind === 'phone').length, 'numer', 'numery', 'numerów'] as const,
                    [crooked.filter((c) => c.kind === 'address').length, 'adres', 'adresy', 'adresów'] as const
                  ].filter(([n]) => n > 0).map(([n, one, few, many]) => `${n} ${plural(n, one, few, many)}`).join(' i ')
                    + ' zapisano inaczej, niż zapisuje je reszta bazy.'}
              </span>
            </div>
          )}
          {tidyOpen && crooked.length > 0 && (
            <section className="wk-tidy">
              <p className="wk-hint">
                Numery jako +48 600 700 800, adresy tak, jak w kartotece (ulica i numer, miejscowość, kod i poczta).
                Zaznaczone „sprawdź" nie dało się rozpoznać na pewno — są odznaczone.
              </p>
              <TidyList
                items={crooked.map((c) => ({ key: crookedKey(c), before: c.value, after: c.tidy, doubt: c.doubt }))}
                skipped={skipped} busy={busy !== null} onToggle={(key) => setSkipped((was) => toggled(was, key))} />
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy !== null || crooked.every((c) => skipped.has(crookedKey(c)))}
                  onClick={() => void act('Porządkowanie…', straighten)}>
                  Zapisz zaznaczone ({crooked.filter((c) => !skipped.has(crookedKey(c))).length})
                </button>
                <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => setTidyOpen(false)}>Anuluj</button>
              </div>
            </section>
          )}

          <People
            partId={partId}
            config={conf}
            onConfig={setSaved}
            submissions={submissions}
            opened={opened}
            fields={fields}
            removed={removedFields}
            seatAreas={areasHere}
            formAreas={[module?.areaId ?? null, ...areasHere]}
            areas={areas}
            stepInfo={stepInfo}
            extData={extData}
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

          {/* 0077 — die ganze Liste als JSON: eine vorhandene Liste in einem Zug herein, oder hinaus zum Bearbeiten. */}
          {ring !== null && (
            <ListJsonPanel
              who={who}
              formId={partId}
              formName={module?.name ?? conf.title ?? 'Formularz'}
              extensions={stepInfo?.extensions ?? []}
              onDone={reread}
            />
          )}
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
 * Was in einer Nachricht für DIESEN Menschen eingesetzt wird — nach
 * Beschriftung der Frage, dazu `{imie}` und `{osoba}`.
 *
 * `{imie}` neben `{osoba}` — der Altbestand hatte beide, und aus gutem Grund:
 * „Cześć Anna Kowalska" grüsst niemand.
 */
function holesOf(values: ReadonlyMap<string, string> | undefined, fields: readonly OpenField[]): Map<string, string> {
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
const checkOf = (values: ReadonlyMap<string, string> | undefined, fields: readonly OpenField[]): readonly CheckAnswer[] =>
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
  partId, config, onConfig, submissions, opened, fields, removed = [], seatAreas, formAreas, areas, stepInfo, extData, ring, busy,
  onHide, onRemove, onError, onChanged
}: {
  partId: string;

  /** Die Einstellungen des Bausteins — darin die gespeicherten Szablony. */
  config: Record<string, string>;
  onConfig: (next: Record<string, string>) => void;

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

  /* 0082 — dieselben Zeilen, dieselbe Reihenfolge und derselbe Filter wie auf den Seiten „Lista osób" und „Panel osoby" (`entryDesk.ts`). */
  const everyone = deskRows({ registrations: submissions, opened, fields }, stepInfo);

  /* Welche Schritte es gibt — aus der ersten Zeile, die welche hat (alle haben dieselben, bis auf den Link). */
  const stepKinds = stepKindsOf(everyone);

  const rows = everyone.filter((r) => stepMatches(stepFilter, r.states));

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

  /* Die Vorschau gilt dem ersten Menschen, den die Liste gerade zeigt — ein Filter kann sie leeren. */
  const first = rows.length > 0 ? rows[0] : undefined;

  return (
    <section className="wk-panel">
      <div className="wk-sms-bar">
        <h3 className="wk-h2">Osoby ({rows.length === everyone.length ? rows.length : `${rows.length} z ${everyone.length}`})</h3>

        {stepKinds.length > 0 && (
          <label className="wk-inline">
            <span className="wk-hint">Pokaż:</span>
            <select value={stepFilter} onChange={(e) => setStepFilter(e.target.value)} aria-label="Filtr kroków">
              {STEP_CHOICES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              {stepKinds.map(([key, label]) => (
                <option key={key} value={`todo:${key}`}>brakuje: {label}</option>
              ))}
            </select>
          </label>
        )}

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
                    {repeat !== 'once' && <> · {roundLabel(repeat, round)} · <a className="wk-link" href={viewPath('modules', 'form', ext.moduleId)}>wszystkie okresy</a></>}
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

/**
 * NACH DEM ABSENDEN — eine eigene Überschrift, ein eigener Text, und ob das
 * Ausgefüllte auf Papier unterschrieben werden muss (immer, oder wenn eine
 * bestimmte Zustimmung angekreuzt ist). Gespeichert am Formular; draussen
 * liest es `after` des öffentlichen Formulars.
 */
function AfterSendSettings({ partId, config, fields, busy, onSaved, onError }: {
  partId: string;
  config: Record<string, string>;
  fields: readonly OpenField[];
  busy: boolean;
  onSaved: (next: Record<string, string>) => void;
  onError: (message: string | null) => void;
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
  /* Fragt das Formular nach der Zustimmung eines Elternteils, druckt aber nichts? Dann ein Vorschlag. */
  const parental = paper === '' ? parentalConsentOf(ticks) : null;
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
          Widzi go osoba zaraz po wysłaniu (także po uzupełnieniu przez swój link). Pusta linia zaczyna nowy akapit.
          Link do strony osoby i pokwitowanie pokazują się zawsze — tego nie da się wyłączyć.
        </span>
      </label>
      <label className="wk-field">
        <span>Podpis odręczny na wydruku</span>
        <select value={paper} disabled={busy || saving} onChange={(e) => setPaper(e.target.value)}>
          <option value="">nie trzeba</option>
          <option value="always">zawsze — każdy drukuje i podpisuje</option>
          <option value={PAPER_MINOR} disabled={!knowsAge && paper !== PAPER_MINOR}>
            niepełnoletni — wg daty urodzenia albo PESEL{knowsAge ? '' : ' (formularz o nie nie pyta)'}
          </option>
          {ticks.map((f) => (
            <option key={f.fieldId} value={f.fieldId}>gdy zaznaczono: {f.label ?? 'pytanie'}</option>
          ))}
          {paper !== '' && paper !== 'always' && !ticks.some((f) => f.fieldId === paper) && (
            <option value={paper}>(pytanie, którego już nie ma)</option>
          )}
        </select>
        <span className="wk-hint">
          Zgoda rodzica za niepełnoletnie dziecko musi być podpisana odręcznie — zaznaczenie pola na stronie nie jest
          podpisem. Wtedy po wysłaniu (i później pod linkiem osoby, w „Twoje zgłoszenie”) pojawia się „Drukuj do podpisu”:
          jedna strona A4 z danymi, zgodami w ich brzmieniu i miejscem na podpis.
        </span>
        {paper === PAPER_MINOR && !knowsAge && (
          <span className="wk-warn">Formularz nie pyta o datę urodzenia ani PESEL — nie wiadomo, kto jest niepełnoletni, więc wydruk się nie pokaże.</span>
        )}
      </label>
      {parental !== null && (
        <div className="wk-paper-note" role="note">
          <p>
            <strong>Ten formularz pyta o zgodę rodzica</strong> („{parental.label ?? 'pytanie'}”), ale wydruk do podpisu jest
            wyłączony — osoby nie widzą „Drukuj do podpisu” ani po wysłaniu, ani w „Twoje zgłoszenie”.
          </p>
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || saving}
              onClick={() => { setPaper(parental.fieldId); if (signer.trim() === '') setSigner('czytelny podpis rodzica / opiekuna prawnego'); }}>
              Drukuj, gdy zaznaczono to pytanie
            </button>
            {knowsAge && (
              <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || saving}
                onClick={() => { setPaper(PAPER_MINOR); if (signer.trim() === '') setSigner('czytelny podpis rodzica / opiekuna prawnego'); }}>
                Drukuj dla niepełnoletnich
              </button>
            )}
          </div>
          <p className="wk-hint">Potem „Zapisz” poniżej.</p>
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
 * 0086 — WYMAGANIA FORMULARZA, zum Ankreuzen (`formTemplates.ts`): was ein
 * Wydarzenie verlangt — Minderjährige mit Ausdruck für die Eltern, Zdrowie,
 * Ubezpieczenie, Zasady. Eingeschaltet bringt jedes seine Fragen, Gruppen und
 * Logik mit (was es schon gibt, wird weiterbenutzt) und sperrt sie gegen das
 * Löschen; ausgeschaltet nimmt es sie wieder mit — Antworten bleiben.
 */
function NeedsPanel({ module, who, config, answersTo, areas, busy, onAct, onConfig }: {
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
  const usable = areas.filter((a) => a.heldEpochs > 0);
  const on = readNeeds(config.needs);

  useEffect(() => { if (answersTo !== null) setTarget(answersTo); }, [answersTo]);

  const turnOn = (need: FormNeed) => void onAct(`Włączanie: ${need.label}…`, async () => {
    try {
      setSaid(null);
      const done = await applyNeed(who, module, need, target === '' ? null : target, config, setStage);
      onConfig(done.config);
      setSaid([
        `„${need.label}”: nowych pytań ${done.added}${done.reused > 0 ? `, wykorzystane istniejące: ${done.reused}` : ''}.`,
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
        Zaznacz, czego wymaga to wydarzenie — formularz dostanie potrzebne pytania, grupy i logikę (dane, które już są,
        nie powtórzą się). Dopóki wymaganie jest zaznaczone, jego pytań nie da się usunąć; można je przesuwać (zakładka
        „Układ”) i zmieniać ich treść.
      </p>
      {answersTo === null && (
        <label className="wk-field">
          <span>Odpowiedzi trafiają do obszaru</span>
          <select value={target} disabled={busy} onChange={(e) => setTarget(e.target.value)}>
            <option value="">—</option>
            <AreaOptions areas={areas} only={usable} />
          </select>
        </label>
      )}
      <ul className="wk-need-list">
        {NEEDS.map((need) => {
          const active = on.find((one) => one.id === need.id);
          return (
            <li key={need.id} className={active === undefined ? 'wk-need' : 'wk-need is-on'}>
              <label className="wk-need-pick">
                <input
                  type="checkbox" checked={active !== undefined}
                  disabled={busy || (active === undefined && target === '')}
                  onChange={() => (active === undefined ? turnOn(need) : setLeaving(need.id))}
                />
                <span>
                  <strong>{need.label}</strong>
                  <span className="wk-hint">{need.use}</span>
                  {active !== undefined && (
                    <span className="wk-hint wk-need-holds">
                      Pytania: {active.fields.length}{active.nodes.length > 0 && ` · logika: ${active.nodes.length} węzłów`}
                      {active.paper === true && ' · wydruk do podpisu dla niepełnoletnich'}
                    </span>
                  )}
                </span>
              </label>
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
function Extensions({ base, extensions, busy, onCreated, onError }: {
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
        Formularze, które dopisują się do zgłoszeń z tego: osoba uzupełnia je później przez
        swój link, albo wypełnia je tylko koordynator — dla siebie. Każde ma własne pytania.
        Na mapie logiki strony możesz z nich zrobić krok („Zgłoszenie wysłane").
      </p>
      <p className="wk-hint">
        Rozszerzenie może się <strong>powtarzać</strong> — co dzień, tydzień, miesiąc albo rok: wtedy każda osoba
        z listy dostaje osobny wpis na każdy okres (odwiedziny chorych co miesiąc, obecność na spotkaniach,
        składka). Pytania „tak / nie” zaznacza się w nim jednym dotknięciem.
      </p>

      {extensions.length > 0 && (
        <ul className="wk-list">
          {extensions.map((e) => (
            <li className="wk-row" key={e.moduleId}>
              <span>
                <strong>{e.name}</strong>
                <span className="wk-row-side"> · {AUDIENCE_LABEL[e.audience]}{repeatOf(e.repeat) !== 'once' ? ` · ${REPEAT_LABEL[repeatOf(e.repeat)]}` : ''}{e.closed ? ' · zamknięte' : ''}</span>
              </span>
              <a className="wk-link-btn" href={viewPath('modules', 'form', e.moduleId)}>Otwórz</a>
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
          Założone. <a className="wk-link" href={viewPath('modules', 'form', made)}>Dodaj mu pytania</a>.
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
function ExtensionOf({ row, busy, onRepeat }: { row: ModuleRow; busy: boolean; onRepeat: (repeat: Repeat) => void }) {
  const repeat = repeatOf(row.repeat);

  return (
    <div className="wk-note">
      <p>
        <strong>To jest rozszerzenie formularza</strong>{' '}
        <a className="wk-link" href={viewPath('modules', 'form', row.extendsId ?? '')}>otwórz formularz główny</a>.
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
              : 'Osobny wpis na każdy okres — w zakładce „Osoby” przełączasz okres u góry.'}
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
        selfEdit
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

      <ConsentText kind={kind} value={help} onChange={setHelp} />

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
          disabled={busy || working || label.trim() === '' || areaId === '' || (kind === 'consent' && help.trim() === '')}
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

      {/* 0082 — auch die Adresse des Verantwortlichen in der einen Form der Datenbank. */}
      <div className="wk-field">
        <span>Adres</span>
        <PostalInput value={address} onChange={setAddress} />
      </div>

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

  /** 0069 — in welchem Bereich der Platz steht (für die Rozmowa mit ihm). */
  readonly areaOf: (seatId: string) => string | null;
}

/** Die ganze Adresse eines Links — die Seite, unter der der Platz hängt, mit dem Platz daran. */
const linkUrl = (link: Link, under: string | null, at?: string | null) => `${base()}${seatPath(link, under, at)}`;

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
function useSeatLinks(
  areaIds: readonly string[], ring: Ring | null,
  /** 0086 — die Seite nach dem Absenden und ihr Zusatz (`portalAt`): der Link öffnet dort, wo die Kanzlei es will. */
  portal: { readonly under: string; readonly at: string } | null = null
): SeatLinks {
  const [rows, setRows] = useState<ReadonlyMap<string, SeatRow>>(new Map());

  /* Der Zusatz gilt nur an der Seite, für die er gewählt ist — ein Platz von früher hängt vielleicht anderswo. */
  const portalRef = useRef(portal);
  portalRef.current = portal;
  const urlOf = (link: Link, under: string | null): string => {
    const p = portalRef.current;
    return linkUrl(link, under, p !== null && p.at !== '' && under !== null && under.toLowerCase() === p.under.toLowerCase() ? p.at : null);
  };

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
    if (known !== undefined) return urlOf(known, one?.row.under ?? null);

    if (one === undefined || one.row.linkSealed === null || one.row.revokedAt !== null) return null;

    const link = await openLink(seatId, await key(seatId), one.row.linkSealed);
    if (link === null) return null;

    links.current.set(seatId, link);
    return urlOf(link, one.row.under);
  }, [key]);

  const renew = useCallback(async (seatId: string, check: readonly CheckAnswer[]): Promise<string> => {
    const link = await relinkSeat(seatId, await key(seatId), check);
    links.current.set(seatId, link);
    await reload();
    return urlOf(link, found.current.get(seatId)?.row.under ?? null);
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

  const areaOf = useCallback((seatId: string) => found.current.get(seatId)?.areaId ?? null, []);

  return { rows, peek, forSms, renew, key, warm, reload, areaOf };
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

  values: ReadonlyMap<string, string> | undefined;
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
