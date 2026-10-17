/**
 * Der Zustand der Kanzlei eines Formulars: laden, öffnen, neu versiegeln, speichern — alles, was FormOffice zeichnet.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { type AreaRow, areaPath, loadAreas, loadPublicKey, myEpochKeys } from '../areas/area';
import { fromBase64Url } from '../core/crypto';
import type { Ring, SealedRole } from '../core/keys';
import { sealSeatNames } from '../seats/seatNames';
import { keysFor } from '../core/ringOf';
import { type Who, WorkspaceError } from '../core/session';
import type { ModuleRow, ResealIn, Resealed } from '../modules/module';
import { markFormSeen } from '../notify/notify';
import { handOverRoleKeys } from '../roles/memberRole';
import { selfOf } from '../roles/roles';
import { loadSteps } from '../steps/steps';
import { type Crooked, crookedOf, seatKeyFinder, straighten as straightenAll, tidyKindOf } from './answerTidy';
import { type StepInfo, openStepInfo, readExtensions } from './entryDesk';
import type { FieldChange } from './FieldEditors';
import { type MovedValue, type OpenField, type SealedField, asked, editField, fullNameOf, loadFields, moveAnswers, openFields, sealQuestion, takenOff } from './form';
import { EMPTY_DESIGN, type FormDesign, type SealedDesign, layoutWith, openDesign, saveDesign, sealDesign } from './formDesign';
import type { ReadForm } from './formRead';
import type { TableChange } from './FormTable';
import { lockedOf, readNeeds } from './formTemplates';
import { createIntake, loadIntake, loadPublicIntake, openIntakeKey } from './intake';
import { addOfficeEntry, reviseAcrossAsOffice } from './revisions';
import { repeatOf } from './rounds';
import { intakeKeyOf } from './rewrap';
import { type Answer, type IntakeKey, type Submission, loadRegistrations, readAcross, rewrapToOffice } from './submissions';

/** Die Reiter eines Formulars: einrichten (vier) — lesen — handeln. */
export type FormTabName = 'settings' | 'questions' | 'layout' | 'logic' | 'entries' | 'steps' | 'people';

/*
 * Welcher Reiter je Formular zuletzt offen war — solange die Seite lebt. Die
 * Ansicht wird nach jeder Änderung am Baustein neu aufgebaut; ohne das spränge
 * sie dabei auf ihren Anfangsreiter zurück.
 */
const lastTab = new Map<string, FormTabName>();

export type FormOfficeProps = {
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
};

export function useFormOffice(props: FormOfficeProps) {
  const { module, onList, partId, config, who, onModuleChanged } = props;
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
  /*
   * 2026-10-16 — EIN SATZ REITER, OHNE „SPOSÓB WYŚWIETLANIA": Zgłoszenia ·
   * Pytania · Kroki · Ustawienia, rechts leiser die Werkzeuge Układ · Logika ·
   * Tabela. Vorher trugen dieselben Reiter je nach Weg andere Namen — und
   * „Zgłoszenia" war einmal die Liste der Menschen, einmal die Tabelle.
   *
   * Geöffnet wird, wo es Zgłoszenia gibt, die Liste — sonst die Fragen.
   */
  const firstTab: FormTabName = module === undefined ? 'questions'
    : module.entries > 0 || (module.extendsId !== null && module.fields > 0) ? 'people'
    : 'questions';
  const [chosenTab, pickTab] = useState<FormTabName>(() => {
    /* Die Adresse verlangt die Liste: das gilt wie eine eigene Wahl, also bleibt es auch nach dem Neuaufbau. */
    if (onList === true) { lastTab.set(partId, 'people'); return 'people'; }

    return lastTab.get(partId) ?? firstTab;
  });
  const setTab = (next: FormTabName) => { lastTab.set(partId, next); pickTab(next); };
  /*
   * 0103 — DIE MELDUNG FÜHRT AUF DIE LISTE, auch wenn das Formular schon offen
   * ist (dann baut es sich nicht neu auf, und der Anfangswert oben griffe nicht).
   */
  useEffect(() => { if (onList === true) setTab('people'); }, [onList]); // eslint-disable-line react-hooks/exhaustive-deps
  const tab: FormTabName = chosenTab;

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

  /**
   * 0090 — SEIT WANN FÜR DIESES KONTO ETWAS NEU WAR, als die Liste zum ersten
   * Mal aufging. Die Liste aufzumachen heisst: gesehen (die Glocke und das
   * Telefon hören auf, sie als neu zu melden) — die Zeilen von danach tragen
   * hier trotzdem „nowe", bis zum nächsten Öffnen.
   */
  const [newSince, setNewSince] = useState<{ partId: string; at: string | null } | null>(null);
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
  /* 0099 — auch „Zadania": die Lista obecności braucht die Namen. */
  const readsHere = (t: FormTabName) => (t === 'entries' && (!isExtension || tableToo)) || ((t === 'people' || t === 'steps') && !isExtension);
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

    /* 0091 — wer über dieses Formular zur Rolle gehört und noch auf ihren Schlüssel wartet, bekommt ihn jetzt (still). */
    void handOverRoleKeys(bund, partId).catch(() => 0);

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

    /* 0090 — gesehen, für das Konto; „nowe" bleibt an dem, was seit dem vorigen Mal kam. */
    void markFormSeen(partId).then((at) => setNewSince((was) => (was?.partId === partId ? was : { partId, at })));

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

    /*
     * Was mit den Schlüsseln seiner Bereiche nicht aufgeht, wird mit den
     * Annahmen der übrigen Bereiche versucht, die dieser Bund öffnet — frühe
     * Berichtigungen über den Link lagen unter der Annahme des Platzes. Erst
     * geholt, wenn eine Einsendung zu bleibt; was dann aufgeht, wird gleich
     * unter dem Schlüssel der Kanzlei abgelegt (unten, `pending`).
     */
    let spare: Promise<IntakeKey[]> | null = null;
    const spareKeys = () => (spare ??= (async () => {
      const found: IntakeKey[] = [];
      for (const area of (await loadAreas().catch(() => ({ areas: [] as readonly AreaRow[] }))).areas) {
        if (areasHere.includes(area.areaId)) continue;
        const key = await intakeKeyOf(area.areaId, ring);
        if (key !== null) found.push(key);
      }
      return found;
    })());

    try {
      for (let at = 0; at < registrations.length; at += CHUNK) {
        const pending: { fieldId: string; registrationId: string; officeKeySealed: string }[] = [];

        for (const one of registrations.slice(at, at + CHUNK)) {
          let read = await readAcross(one, keys, areaOf);
          if (read.values.size < one.values.length) {
            const others = await spareKeys();
            if (others.length > 0) read = await readAcross(one, keys, areaOf, others);
          }
          const { values: merged, toRewrap } = read;
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
    if (named.length > 0) void sealSeatNames(named, ring, keys.map((one) => one.areaId)).catch(() => undefined);

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
        selfEdit: f.selfEdit, personOnly: f.personOnly === true, areaId: f.areaId
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
      personOnly: change.personOnly,
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

  return {
    act, allFields, areaLabel, areas, areasHere, busy, byId, conf, crooked, crookedKey, current, design, designLocked,
    editing, extData, failed, fields, hiddenNotice, intakes, isExtension, keyOf, layout, loadStepInfo, locks, look,
    moduleAct, newSince, note, openAll, opened, person, readAreas, reading, readsHere, removedFields, removedNote,
    reread, resealFor, ring, saveDesignNow, saveField, saveTable, setEditing, setFailed, setRemovedNote, setSaved,
    setShowHidden, setSkipped, setTab, setTidyOpen, showHidden, shutAreas, skipped, staleNotice, stepInfo, straighten,
    submissions, tab, tableToo, tidyFields, tidyOpen
  };
}
