/**
 * Das Formular auf einer öffentlichen Seite — der Weg von aussen herein.
 *
 * <b>Der Dienst liest nichts davon.</b> Jeder Wert bekommt hier einen eigenen
 * Schlüssel, wird damit versiegelt, und der Schlüssel wird unter der
 * öffentlichen Annahmehälfte des Bereichs verpackt. Aufmachen kann es nur, wer
 * die private Hälfte hat — und die liegt unter dem Schlüssel des Amtes.
 *
 * <b>Die Fragen sind versiegelt.</b> Lesbar werden sie, wenn der Bereich seine
 * Epoche offengelegt hat. Ein Feld, dessen Bereich das nicht getan hat,
 * verschwindet NICHT — es steht als „zapieczętowane" da. Wer ein Formular
 * ausfüllt, muss sehen, dass darin etwas ist, das er nicht lesen kann.
 *
 * <b>Die Klausel steht darüber, nicht darunter.</b> Wer personenbezogene Daten
 * erhebt, muss sagen, wer sie verarbeitet, BEVOR jemand etwas eingegeben hat.
 * Fehlt sie, sammelt dieses Formular nichts — es sagt, was fehlt.
 *
 * <b>Und wer sich anmeldet, bekommt eine Adresse</b> (0027): der Browser
 * würfelt sich vor dem Absenden einen eigenen Platz, und danach steht der Link
 * genau einmal da. Ohne Schalter — ein Formular, das nach Namen und
 * Geburtsdatum fragt und nichts zurückgibt, wäre die schlechtere
 * Voreinstellung. Die Quittung bleibt für den einen Fall, in dem es keinen
 * Platz geben kann: wenn der Bereich gar keine Annahme hat.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type AccountWay } from './areaRead';
import {
  fullNameOf, submitForm, type Answer, type OpenField, type PublicForm
} from './form';
import type { Ring } from './keys';
import { evaluate, layoutWith, missingIn, type FormDesign } from './formDesign';
import { FormFlow, isRequired } from './FormFlow';
import { ExtensionSheet } from './ExtensionSheet';
import { REPEAT_LABEL, repeatOf, roundLabel, roundOf, type Repeat } from './rounds';
import { PEOPLE_TAB, viewPath } from './routes';
import { filledNow, loadSteps, type ExtensionInfo } from './steps';
import { keysFor } from './ringOf';
import { bindSeat, seatPath, type Link } from './seat';
import { useSeats, type SeatView } from './seatContext';
import { whoIsThere, WorkspaceError, type Who } from './session';
import { usePerson } from './pagePerson';
import { detailsOf, personFieldOf, subjectsFor, type Subject } from './subject';
import { OwnSubmissions } from './Submission';
import { openPublicForm, paperNeeded, SignSheetButton } from './SignSheet';
import { peselBirth, peselValid } from './pesel';

export function FormCard({ partId, title, portalUnder: under, seat: givenSeat }: {
  partId: string;
  title: string;

  /** Unter welcher Seite die Plätze hängen. Leer: eine Ebene höher. */
  portalUnder: string;

  /**
   * FÜR WELCHEN PLATZ eine Ergänzung (0047) ausgefüllt wird — wenn der
   * Aufrufer es weiss (die Schritte eines Menschen). Sonst gilt die Wahl oben
   * auf der Seite.
   */
  seat?: SeatView | null;
}) {
  const [form, setForm] = useState<PublicForm | null | undefined>(undefined);
  const [fields, setFields] = useState<readonly OpenField[]>([]);

  /* Aufbau und Logik (0043) — oder `null`: dann ist das Formular eine Liste wie vorher. */
  const [design, setDesign] = useState<FormDesign | null>(null);

  /** Was der Weg über das Konto ergab, als die Fragen aufgemacht wurden — `null`: er wurde nicht gebraucht. */
  const [account, setAccount] = useState<AccountWay | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [claim, setClaim] = useState<string | null>(null);
  const [link, setLink] = useState<Link | null>(null);

  /** Wohin der Platz gehört — der Dienst hat es entschieden, nicht wir. */
  const [landed, setLanded] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  /** 0083 — wann es abging: steht auf dem Ausdruck zum Unterschreiben. */
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /*
   * FÜR WEN dieser Bogen gerade ausgefüllt wird (0038).
   *
   * <b>Ein Vater meldet drei Kinder an.</b> Jedes Kind ist eine eigene Rolle
   * mit eigenen Angaben; er hält ihre Schlüssel. Die Frage ist deshalb nie
   * „wer bin ich“, sondern „für wen fülle ich das gerade aus“ — und die
   * Antwort muss sich MITTEN IM Ausfüllen ändern lassen.
   *
   * <b>Ohne Anmeldung bleibt das alles leer</b>, und der Bogen ist der, der
   * er vorher war. Niemand muss sich anmelden, um etwas einzureichen.
   */
  const [ring, setRing] = useState<Ring | null>(null);
  const [subjects, setSubjects] = useState<readonly Subject[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  /** Dopisane do istniejącego miejsca (0045) — dann gibt es keinen neuen Link. */
  const [attached, setAttached] = useState<string | null>(null);

  /** Ausgefüllt „za kogoś innego": der Link gehört dann dem anderen, nicht dem, der hier sitzt. */
  const [forOther, setForOther] = useState(false);

  /*
   * DIE WAHL DER SEITE (0045). Handelt der Bogen von einer PERSON, gilt, wer
   * oben auf der Seite gewählt ist — hier wird nicht noch einmal gefragt:
   *
   *   eine eigene Person   füllt die genormten Felder vor, der neue Platz gehört ihr
   *   ein Platz aus Link   die Einsendung kommt an DENSELBEN Platz — kein zweiter Link
   *   niemand              wie immer: selbst eintragen, neuer Link
   */
  const person = usePerson();
  const openSeats = useSeats();
  const pageDecides = person !== null && form != null && form.forKind === 'person';
  const pageRole = pageDecides && person.chosen?.kind === 'role' ? person.chosen : null;
  const pageSeat = pageDecides && person.chosen?.kind === 'seat' ? person.chosen.seat : null;
  const whom = pageDecides ? (pageRole?.id ?? null) : chosen;
  const whomRing = pageDecides ? (pageRole?.ring ?? null) : ring;

  const look = useCallback(async () => {
    try {
      /* 0083 — dasselbe Aufmachen wie für den Ausdruck (`SignSheet.openPublicForm`). */
      const opened = await openPublicForm(partId);
      const found = opened.form;
      setForm(found);

      /*
       * Die Schlüssel der FRAGEN — je Bereich einer, und zwar für die
       * Bereiche, unter denen die Fragen liegen (0042: der des Formulars).
       * Die Bereiche der Antworten brauchen hier keinen: dorthin geht nur,
       * was unter ihrer Annahme verpackt wird.
       *
       * <b>Auf jedem Weg, den dieser Browser hat</b> (`areaReader`):
       * offengelegt, aus einem Link, aus der eigenen Zuteilung. Vorher galt
       * nur der erste — und ein Formular in einem Bereich, der nicht jawny
       * ist, blieb hier auch für den zu, der den Bereich führt. Ein Bereich,
       * den dieser Browser gar nicht liest, fehlt einfach; `openFields` lässt
       * sein Feld dann zu.
       */
      setFields(opened.fields);
      setDesign(opened.design);
      setAccount(opened.account);
      setFailed(null);

      /*
       * WEN wir fragen können. Nur wenn der Bogen überhaupt von jemandem
       * handelt — sonst wäre es eine Auswahl ohne Gegenstand.
       *
       * Jeder Fehlschlag hier ist stumm und gewollt: wer nicht angemeldet
       * ist, füllt den Bogen aus wie immer. Ein „Nicht angemeldet“ an dieser
       * Stelle wäre eine Aufforderung, und dieses Formular fordert nichts.
       */
      if (found.forKind !== 'none') {
        try {
          const who = await whoIsThere();

          if (who !== null) {
            const keyring = await keysFor(who);

            if (keyring.ring !== null) {
              const found2 = await subjectsFor(found.forKind, keyring.graph, keyring.ring);
              setRing(keyring.ring);
              setSubjects(found2);
            }
          }
        } catch {
          // Keine Sitzung, oder kein Schlüssel in diesem Tab. Kein Fehler.
        }
      }
    } catch (e) {
      setForm(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać formularza.');
    }
  }, [partId]);

  useEffect(() => { void look(); }, [look]);

  /*
   * WER DAS FORMULAR FÜHRT, sieht es hier wie jeder andere — und füllte es
   * für SICH aus, wo er eigentlich seine Liste sucht. Deshalb ein Satz mit dem
   * Weg dorthin, und zu dem, was er je Mensch selbst einträgt (0047/0077).
   *
   * Gefragt wird nur, wenn oben auf der Seite eine eigene Person steht: dann
   * ist jemand angemeldet. Ein Besucher bezahlt dafür keine Anfrage.
   */
  const signedIn = person?.options.some((one) => one.kind === 'role') ?? false;
  const [leads, setLeads] = useState<readonly ExtensionInfo[] | null>(null);

  useEffect(() => {
    if (!signedIn) { setLeads(null); return; }

    let alive = true;
    loadSteps(partId)
      .then((found) => { if (alive) setLeads(found.extensions.filter((one) => one.audience === 'office' && !one.closed)); })
      .catch(() => { if (alive) setLeads(null); });   // 403: er führt es nicht. Kein Fehler.
    return () => { alive = false; };
  }, [signedIn, partId]);

  /*
   * DER AUFBAU UND DIE LOGIK (0043) — bei jeder Antwort neu ausgewertet.
   * Ohne Dokument ist der Aufbau die Liste der Fragen, und die Logik leer:
   * alles steht da, wie vorher.
   */
  const byId = useMemo(() => new Map(fields.map((f) => [f.fieldId, f])), [fields]);
  const layout = useMemo(
    () => layoutWith(design?.layout ?? [], fields.map((f) => f.fieldId)), [design, fields]);
  const outcome = useMemo(
    () => evaluate({ version: 1, layout, nodes: design?.nodes ?? [], edges: design?.edges ?? [] }, answers),
    [layout, design, answers]);

  /*
   * DIE GENORMTEN ANGABEN EINTRAGEN — und beim Wechsel WIEDER HERAUS.
   *
   * <b>Das Ersetzen ist der eigentliche Punkt.</b> Wer von einem Kind auf
   * das andere umschaltet, darf nicht den Namen des ersten stehen lassen;
   * das wäre ein Bogen, der auf den Falschen läuft, und niemand sähe es ihm
   * an. Deshalb wird JEDES genormte Feld gesetzt — auch auf leer, wenn der
   * Gewählte dazu nichts hinterlegt hat.
   *
   * <b>Die übrigen Antworten bleiben.</b> „Warum willst du mitmachen“ gehört
   * dem Bogen und nicht dem Menschen; sie zu löschen wäre eine Strafe fürs
   * Umschalten.
   */
  /*
   * Für wen die genormten Felder zuletzt eingetragen wurden. Wechselt die Wahl
   * auf NIEMANDEN („za kogoś innego"), gehen sie wieder heraus — sonst stünde
   * der eigene Name im Bogen eines anderen, und der Platz trüge ihn.
   */
  const filledFor = useRef<string | null>(null);

  useEffect(() => {
    if (whomRing === null || whom === null) {
      if (filledFor.current !== null) {
        filledFor.current = null;
        setAnswers((before) => {
          const next = { ...before };
          for (const field of fields) if (personFieldOf(field.identityRole) !== null) next[field.fieldId] = '';
          return next;
        });
      }
      return;
    }

    let dropped = false;

    void (async () => {
      const details = await detailsOf(whom, whomRing);
      if (dropped) return;

      setAnswers((before) => {
        const next = { ...before };

        for (const field of fields) {
          const which = personFieldOf(field.identityRole);
          if (which === null) continue;

          next[field.fieldId] = details.get(which) ?? '';
        }

        return next;
      });
      filledFor.current = whom;
    })();

    /* Wer schnell zweimal umschaltet, bekommt sonst die erste Antwort
       über die zweite geschrieben. */
    return () => { dropped = true; };
  }, [whom, whomRing, fields]);



  if (form === undefined) return <p className="wk-card-text">Wczytywanie…</p>;

  if (form === null) {
    return <p className="wk-card-muted">{failed ?? 'Tu nie ma formularza.'}</p>;
  }

  /*
   * WAS NUR DER KOORDINATOR AUSFÜLLT (0047) — an dieser Stelle seine Liste,
   * für alle anderen nichts als der Satz, dass es das gibt.
   */
  if (form.audience === 'office' && form.extendsId !== null) {
    return <OfficeOnly partId={partId} baseId={form.extendsId} title={title} repeat={repeatOf(form.repeat)} />;
  }

  /* 0077 — eine WIEDERKEHRENDE Ergänzung: der Mensch füllt sie je Zeitraum aus, hier für den laufenden. */
  const repeat = repeatOf(form.repeat);
  const round = roundOf(repeat);

  /*
   * EINE ERGÄNZUNG, die der Mensch ausfüllt (0047): zu SEINER Einsendung,
   * über SEINEN Platz. Welcher, sagt der Aufrufer oder die Wahl oben.
   */
  const extension = form.audience === 'person' && form.extendsId !== null;
  const extSeat = !extension ? null
    : givenSeat ?? (person?.chosen?.kind === 'seat' ? person.chosen.seat : null)
      ?? (openSeats.length === 1 ? openSeats[0] : null);
  const extBase = extSeat?.forms.find((f) => f.formId === form.extendsId) ?? null;
  const extLatest = extBase?.extensions.find((e) => e.moduleId === partId);
  const extDone = extLatest !== undefined && extLatest.registrationId !== null && filledNow(repeat, extLatest)
    ? extLatest.registrationId : null;

  if (extension) {
    const head = title !== '' && <h2 className="wk-card-title">{title}</h2>;

    if (extSeat === null || extSeat.seatKey === null) {
      return (
        <>
          {head}
          <p className="wk-card-muted">
            To uzupełnia osoba zapisana wcześniej — przez swój link. Otwórz link, który dostałeś
            {person !== null && openSeats.length > 1 ? ', albo wybierz u góry strony, za kogo' : ''}.
          </p>
        </>
      );
    }

    if (extBase === null) {
      return (
        <>
          {head}
          <p className="wk-card-muted">
            To uzupełnia zgłoszenie, którego pod tym linkiem nie ma.
          </p>
        </>
      );
    }

    if (extDone !== null || sent) {
      return (
        <>
          {head}
          <p className="wk-done">
            {form.after?.title ?? (repeat === 'once' ? 'Uzupełnione — dziękujemy.' : `Uzupełnione za ${roundLabel(repeat, round)} — dziękujemy.`)}
          </p>
          {form.after?.text != null && <AfterText text={form.after.text} />}
          <OwnSubmissions seat={extSeat} formId={partId} show={null} />
        </>
      );
    }
  }

  /*
   * OHNE Klausel wird nichts gesammelt. Das ist keine Vorsicht, sondern die
   * Bedingung: Art. 13 verlangt, dass der Mensch VORHER weiss, wer seine Daten
   * verarbeitet. Ein Formular, das das nicht sagen kann, darf nicht fragen.
   */
  const nameless = form.controller === null;

  /*
   * FRAGEN, DIE NIEMAND LESEN KANN — einmal gesagt, nicht bei jeder.
   *
   * Sechsmal „Tego pola nie da się odczytać" untereinander sieht aus wie ein
   * kaputtes Formular, und niemand erfährt, was zu tun ist. Es liegt fast
   * immer daran, dass die Fragen noch unter einem Bereich liegen, der nicht
   * jawny ist — und reparieren kann es nur, wer das Formular führt.
   */
  const unreadable = fields.filter((f) => f.label === null).length;
  const blind = fields.length > 0 && unreadable === fields.length;

  /*
   * DAS PORTAL GIBT ES IMMER, und das ist eine Entscheidung gegen einen
   * Schalter.
   *
   * Ein Formular, das nach Namen und Geburtsdatum fragt und dafür nichts
   * zurückgibt, ist die schlechtere Voreinstellung — und ein Kästchen, das man
   * dafür erst finden müsste, wäre eines, das die meisten nie finden. Die
   * Quittung bleibt für den einen Fall, in dem es keinen Platz geben kann:
   * wenn der Bereich gar keine Annahme hat.
   *
   * <b>Wohin es hängt, entscheidet der Dienst</b> (`Form.Above`): eine Ebene
   * über dem Formular. Der Browser müsste dafür seinen eigenen Pfad kennen, und
   * `PageParts` gibt ihn bewusst nicht weiter.
   */


  /*
   * Woraus der Name auf dem Platz kommt.
   *
   * <b>Das alte `name` zuerst, dann das genormte `surname`</b> (0038). Beide
   * kommen vor: vorhandene Bögen tragen `name`, neue benennen die Angabe.
   * Erst das eine zu suchen und dann das andere ist kein Sonderfall, sondern
   * die Reihenfolge, in der die Bedeutung enger wird.
   */
  const nameField = fields.find((f) => f.identityRole === 'name')
    ?? fields.find((f) => f.identityRole === 'surname')
    ?? fields.find((f) => f.identityRole === 'given_name');

  /** Wer gerade gemeint ist — oder niemand. */
  const forWhom: Subject | null = pageDecides
    ? (pageRole === null ? null : { roleId: pageRole.id, name: pageRole.name, isMine: pageRole.isMine })
    : subjects.find((one) => one.roleId === chosen) ?? null;

  if (sent) {
    return (
      <>
        {title !== '' && <h2 className="wk-card-title">{title}</h2>}
        <p className="wk-done">{form.after?.title ?? 'Zgłoszenie przyjęte.'}</p>
        {form.after?.text != null && <AfterText text={form.after.text} />}

        {/*
          0083 — AUF PAPIER UNTERSCHREIBEN, wenn das Formular es für DIESE
          Antworten verlangt (etwa: die Zustimmung der Eltern ist angekreuzt).
          Gedruckt wird, was eben hinausging.
        */}
        {paperNeeded(form.after, (id) => (outcome.hidden.has(id) ? undefined : answers[id]), { fields }) && (
          <div className="wk-paper-note">
            <p>
              <strong>To trzeba jeszcze podpisać odręcznie.</strong> Wydrukuj zgłoszenie, podpisz je
              {form.after?.signer != null ? ` (${form.after.signer})` : ''} i oddaj organizatorowi — bez tego zgłoszenie nie jest kompletne.
              Wydruk znajdziesz też później pod swoim linkiem.
            </p>
            <SignSheetButton
              formId={partId}
              values={new Map(fields.filter((f) => !outcome.hidden.has(f.fieldId)).map((f) => [f.fieldId, answers[f.fieldId] ?? '']))}
              submittedAt={sentAt}
            />
          </div>
        )}

        {attached !== null && (
          <p className="wk-hint">
            Dopisane do miejsca <strong>{attached}</strong> — zobaczysz je pod tym samym linkiem co dotąd.
          </p>
        )}

        {link !== null ? (
          <>
            {forOther ? (
              <p className="wk-hint">
                <strong>To jest adres osoby, za którą wypełniłeś formularz.</strong> Przekaż go jej —
                pod nim zobaczy swoje zgłoszenie i to, co parafia do niej napisze.{' '}
                <strong>Widzisz go tylko teraz</strong>, bo u nas zapisany jest wyłącznie jego odcisk.
              </p>
            ) : (
              <p className="wk-hint">
                <strong>To jest Twój adres.</strong> Pod nim zobaczysz to, co
                wpisałeś — i to, co parafia do Ciebie napisze. Zapisz go albo dodaj
                do zakładek: <strong>widzisz go tylko teraz</strong>, bo u nas
                zapisany jest wyłącznie jego odcisk. Nikt Ci go nie odtworzy.
              </p>
            )}

            <textarea
              readOnly rows={3} className="wk-mono"
              value={`${window.location.origin}${window.location.pathname}${seatPath(link, landed, form.after?.at)}`}
            />

            <div className="wk-actions">
              <a
                className="wk-btn"
                href={seatPath(link, landed, form.after?.at)}
              >
                {forOther ? 'Otwórz stronę tej osoby' : 'Otwórz moją stronę'}
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="wk-hint">
              Zachowaj to pokwitowanie — to jedyny sposób, żeby później wrócić do
              swojego zgłoszenia. Nikt Ci go nie odtworzy.
            </p>
            {claim !== null && <textarea readOnly rows={2} value={claim} className="wk-mono" />}
          </>
        )}
      </>
    );
  }

  /* Was fehlt — nur, was sichtbar ist; eine verborgene Frage hält niemanden auf. */
  const missing = missingIn(layout, isRequired(byId, outcome), answers, outcome)
    .map((id) => byId.get(id))
    .filter((f): f is OpenField => f !== undefined);

  /* 0083 — ein PESEL mit falscher Prüfziffer geht nicht hinaus: der Versicherer schickte die Liste zurück. */
  const wrong = fields.filter((f) => f.kind === 'pesel' && !outcome.hidden.has(f.fieldId)
    && (answers[f.fieldId] ?? '').trim() !== '' && !peselValid(answers[f.fieldId] ?? ''));

  const send = async () => {
    setBusy(true);
    setFailed(null);

    try {
      /* Nur, was zu sehen war: eine Antwort in einer verborgenen Frage geht nicht hinaus. */
      const given: Answer[] = fields
        .filter((f) => !outcome.hidden.has(f.fieldId))
        .map((f) => ({ fieldId: f.fieldId, value: answers[f.fieldId] ?? '' }))
        .filter((a) => a.value.trim() !== '');

      /*
       * DIE ERGÄNZUNG (0047): an denselben Platz, zu seiner Einsendung — kein
       * neuer Link, keine Quittung. Danach sieht er sie wie seine erste.
       */
      if (extension) {
        if (extSeat === null || extSeat.seatKey === null || extBase === null) return;

        await submitForm(partId, given, {
          areas: form.areas, fields: form.fields,
          seat: { token: extSeat.token, key: extSeat.seatKey },
          baseRegistrationId: extBase.registrationId,
          round
        });

        setSentAt(new Date().toISOString());
        setSent(true);
        extSeat.reload();
        return;
      }

      /*
       * Der Platz gehört dem Bereich, in den dieses Formular schreibt. Fragen
       * mehrerer Bereiche kommen vor (die Anmeldung an die Pfarrei, die
       * Gesundheitsangabe an die Leitung) — das Portal hängt am ERSTEN, und
       * zwar an dem des Namensfeldes, wenn es eines gibt. Sonst hinge es
       * irgendwo.
       */
      const home = nameField?.areaId ?? form.fields[0]?.areaId;

      /*
       * FÜR EINEN PLATZ AUS DEM LINK: an denselben Platz. Sein Schlüssel
       * versiegelt die Werte ein zweites Mal — so liest er sie später dort,
       * wo er seine erste Einsendung liest.
       */
      if (pageSeat !== null && pageSeat.seatKey !== null) {
        await submitForm(partId, given, {
          areas: form.areas, fields: form.fields,
          seat: { token: pageSeat.token, key: pageSeat.seatKey }
        });

        setAttached(person?.chosen?.name ?? 'wybranej osoby');
        setSentAt(new Date().toISOString());
        setSent(true);
        pageSeat.reload();
        return;
      }

      const done = await submitForm(partId, given, {
        areas: form.areas,
        fields: form.fields,
        /*
         * Nur wo es eine Annahme GIBT. `form.areas` führt genau die Bereiche,
         * die eine haben — ein Platz ohne sie wäre einer, den die Kanzlei nie
         * öffnen könnte, und der Dienst lehnte ihn ohnehin ab.
         */
        selfSeat: home !== undefined && form.areas.some((a) => a.areaId === home)
          ? {
              areaId: home,
              epoch: form.fields.find((f) => f.areaId === home)?.epoch ?? 1,
              /*
               * Der Name des Gemeinten geht VOR dem, was im Feld steht:
               * gewählt zu haben ist genauer als getippt zu haben. Er steht
               * offen am Platz, damit die Kanzlei ihn zuordnen kann, BEVOR
               * sie ihn verschickt — deshalb wird er hier nicht versiegelt.
               */
              /*
               * IMIĘ I NAZWISKO, nicht das erste Namensfeld: bei getrennten
               * Feldern stand hier sonst der Nachname allein — im Kalender der
               * Kanzlei, an jeder Bitte um Mitnahme.
               */
              recipientName: forWhom?.name
                ?? fullNameOf(fields, (fieldId) => answers[fieldId])
                ?? undefined,
              underPath: under === '' ? undefined : under
            }
          : undefined
      });

      /*
       * DER PLATZ GEHÖRT DEM, UM DEN ES GEHT (0038).
       *
       * <b>Genau jetzt, oder nie.</b> Der Platzschlüssel liegt im Speicher
       * dieses Tabs; danach käme man nur über den Link wieder heran, und der
       * steht ein einziges Mal da. Verpackt wird unter dem ÖFFENTLICHEN
       * Schlüssel der Rolle — dafür braucht es kein Geheimnis des Gemeinten.
       *
       * <b>Misslingt es, bleibt die Einsendung trotzdem gültig.</b> Sie liegt
       * beim Dienst, und der Link steht gleich da. Hier abzubrechen hiesse,
       * einen angenommenen Bogen als Fehlschlag auszugeben.
       */
      if (forWhom !== null && done.seat !== null && done.link !== null && whomRing !== null) {
        const role = whomRing.roleOf(forWhom.roleId);

        if (role !== undefined) {
          try {
            await bindSeat(done.link.token, done.seat.seatId, done.seat.key, role);
          } catch {
            // Der Link steht gleich da; von dort aus geht es auch später.
          }
        }
      }

      setClaim(done.claim);
      setLink(done.link);
      setLanded(done.under);
      setForOther(forWhom === null && pageDecides && person.options.some((one) => one.kind === 'role'));
      setSentAt(new Date().toISOString());
      setSent(true);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wysłać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}

      {/* EINE Klausel für das ganze Formular (0042), nicht eine je Bereich. */}
      {form.controller !== null && (
        <p className="wk-hint">
          Administratorem danych jest <strong>{form.controller.name}</strong>
          {form.controller.address !== null && `, ${form.controller.address}`}
          {form.controller.email !== null && ` (${form.controller.email})`}.
        </p>
      )}

      {leads !== null && !extension && (
        <p className="wk-hint wk-form-leads">
          Prowadzisz ten formularz:{' '}
          <a className="wk-link" href={viewPath('modules', 'form', partId, PEOPLE_TAB)}>lista osób</a>
          {leads.map((one) => (
            <span key={one.moduleId}>
              {' · '}
              <a className="wk-link" href={viewPath('modules', 'form', one.moduleId)}>
                {one.name}{repeatOf(one.repeat) !== 'once' && ` (${REPEAT_LABEL[repeatOf(one.repeat)]})`}
              </a>
            </span>
          ))}
          . Osobę bez własnego linku (np. zapisaną przez telefon) dopiszesz na liście przyciskiem „Dodaj osobę”.
        </p>
      )}

      {/*
        GESCHLOSSEN (0042): das Formular bleibt stehen und sagt es, statt
        Fragen zu zeigen, deren Antworten niemand mehr annimmt.
      */}
      {form.closed && (
        <p className="wk-note">Zapisy przez ten formularz są zamknięte.</p>
      )}

      {nameless && (
        <p className="wk-error">
          Ten formularz nie mówi, kto odpowiada za dane, więc nic nie zbiera.
          Prowadzący stronę musi to uzupełnić.
        </p>
      )}

      {/*
        FÜR WEN — und zwar VOR den Fragen.

        Wer erst unten sieht, dass er das Falsche ausgefüllt hat, hat es
        schon ausgefüllt. Die Auswahl steht deshalb oben, und der häufigste
        Fall („ich für mich“) steht zuoberst in der Liste.

        Es gibt sie nur für Angemeldete, die überhaupt mehr als nichts
        halten. Alle anderen füllen den Bogen aus wie immer.
      */}
      {/*
        Die Wahl oben gilt — hier nur, WER es ist, und der Weg zu „jemand
        anderes". Er steht HIER und nicht nur oben: die Auswahl oben zeigt
        sich nicht, solange es genau eine Wahl gibt (die eigene Person), und
        „Zmienisz to u góry strony" zeigte dann ins Leere.
      */}
      {!extension && pageDecides && (person.chosen !== null || person.options.length > 0) && !nameless && !form.closed && !blind && (
        <p className="wk-hint wk-form-whom">
          {person.chosen === null ? (
            <>
              Wypełniasz za <strong>kogoś innego</strong> — wpisz poniżej jego dane. Po wysłaniu dostaniesz link
              dla tej osoby: przekaż go jej, żeby mogła sprawdzić swoje zgłoszenie.{' '}
              {(() => {
                const back = person.options.find((one) => one.kind === 'role' && one.isMine) ?? person.options[0];
                return back === undefined ? null : (
                  <button type="button" className="wk-link-btn" onClick={() => person.choose(back.id)}>Wróć do: {back.name}</button>
                );
              })()}
            </>
          ) : (
            <>
              {person.chosen.kind === 'seat'
                ? <>Zgłoszenie zostanie dopisane do miejsca <strong>{person.chosen.name}</strong> (ten sam link).</>
                : <>Zgłoszenie dla: <strong>{person.chosen.name}</strong> — pola wypełnią się Twoimi zapisanymi danymi.</>}
              {' '}
              <button type="button" className="wk-link-btn" onClick={() => person.choose(null)}>Wypełnij za kogoś innego</button>
            </>
          )}
        </p>
      )}

      {extension && extSeat !== null && (
        <p className="wk-hint">
          Uzupełnienie dla: <strong>{extSeat.recipientName ?? 'Twojego zgłoszenia'}</strong> — dołączy do
          zgłoszenia pod tym samym linkiem.
        </p>
      )}

      {!extension && !pageDecides && subjects.length > 0 && !nameless && !form.closed && !blind && (
        <label className="wk-field">
          <span>{form.forKind === 'person' ? 'Kogo dotyczy zgłoszenie'
            : form.forKind === 'group' ? 'Której grupy dotyczy' : 'Której roli dotyczy'}</span>

          <select
            value={chosen ?? ''}
            onChange={(e) => setChosen(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">— wpiszę sam —</option>
            {subjects.map((one) => (
              <option key={one.roleId} value={one.roleId}>
                {one.name ?? 'bez nazwy'}{one.isMine && ' (ja)'}
              </option>
            ))}
          </select>

          <span className="wk-hint">
            Wybranie wypełni pola danymi, które masz już zapisane — raz
            wpisanymi i wspólnymi dla wszystkich formularzy. Zmienisz je u
            siebie, zmienią się wszędzie. Miejsce, które powstanie z tego
            zgłoszenia, będzie należało właśnie do wybranego.
          </span>
        </label>
      )}

      {/*
        WARUM es zu ist — nach dem, was dieser Browser versucht hat. Vorher
        stand hier für jeden derselbe Satz („prowadzący naprawi to…"), auch
        für den, der nur seine Schlüssel nicht im Tab hatte, und auch dort, wo
        das Formular mit Absicht nur für die Menschen seines Bereichs ist.
      */}
      {unreadable > 0 && !form.closed && (
        <p className="wk-warn">
          {blind ? 'Pytań tego formularza nie da się tu odczytać' : `Części pytań (${unreadable}) nie da się tu odczytać`}
          {' '}— są zapieczętowane kluczem obszaru, którego ta przeglądarka nie czyta.{' '}
          {account === 'locked'
            ? 'Jesteś zalogowany, ale w tej karcie nie ma Twoich kluczy — zaloguj się ponownie, żeby je odblokować.'
            : account === 'open'
              ? 'Twoje konto nie ma dostępu do tego obszaru.'
              : 'Jeśli masz do niego dostęp, zaloguj się albo otwórz swój link z dostępem.'}
          {' '}Formularz ma być dla wszystkich? Prowadzący ustawia wtedy jego obszar jako jawny —
          wskazówkę zobaczy, otwierając formularz w Modułach.
        </p>
      )}

      {!nameless && !form.closed && !blind && (
        <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <FormFlow
            items={layout}
            fields={byId}
            answers={answers}
            outcome={outcome}
            onAnswer={(fieldId, value) => setAnswers((before) => {
              const next = { ...before, [fieldId]: value };
              /* 0083 — aus einem gültigen PESEL folgt das Geburtsdatum, wenn es noch leer ist. */
              const born = byId.get(fieldId)?.kind === 'pesel' && peselValid(value) ? peselBirth(value) : null;
              const bornField = born === null ? undefined : fields.find((f) => f.identityRole === 'born' && f.kind === 'date');
              if (bornField !== undefined && born !== null && (next[bornField.fieldId] ?? '').trim() === '') next[bornField.fieldId] = born;
              return next;
            })}
          />

          {failed !== null && <p className="wk-error">{failed}</p>}

          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy || missing.length > 0 || wrong.length > 0}>
              {busy ? 'Wysyłanie…' : 'Wyślij'}
            </button>

            {missing.length > 0 && (
              <span className="wk-blocker">
                Brakuje: {missing.map((f) => outcome.labels.get(f.fieldId) ?? f.label ?? 'zapieczętowane').join(', ')}
              </span>
            )}
            {wrong.length > 0 && (
              <span className="wk-blocker">
                Popraw: {wrong.map((f) => outcome.labels.get(f.fieldId) ?? f.label ?? 'PESEL').join(', ')}
              </span>
            )}
          </div>

          <p className="wk-hint">
            Odpowiedzi są pieczętowane w tej przeglądarce. Usługa zapisuje je,
            nie mogąc ich odczytać — otworzy je dopiero ten, kto prowadzi
            kancelarię.
          </p>
        </form>
      )}
    </>
  );
}

/**
 * Die Stelle eines Formulars, das NUR der Koordinator ausfüllt (0047).
 *
 * Wer angemeldet ist und es führt, bekommt hier seine Liste — alle Menschen
 * des erweiterten Formulars, je mit seinen Notizen. Alle anderen sehen einen
 * Satz: ein leerer Kasten sähe kaputt aus.
 *
 * <b>„Alle anderen" sind auch die Angemeldeten, die es nicht führen.</b> Für
 * sie stand hier die Absage des Dienstes in Rot („Ani tego adresu nie
 * prowadzisz…") — ein Fehler, wo keiner ist: sie haben nichts falsch gemacht,
 * die Stelle ist nur nicht ihre. Gefragt wird deshalb vorher, mit derselben
 * Auskunft, die auch die Kanzlei benutzt (`loadSteps`).
 */
function OfficeOnly({ partId, baseId, title, repeat }: { partId: string; baseId: string; title: string; repeat: Repeat }) {
  const [who, setWho] = useState<Who | null | undefined>(undefined);
  const [leads, setLeads] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const found = await whoIsThere().catch(() => null);
      const may = found === null ? false : await loadSteps(partId).then(() => true, () => false);

      if (alive) { setWho(found); setLeads(may); }
    })();

    return () => { alive = false; };
  }, [partId]);

  return (
    <>
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}
      {who === undefined || leads === undefined ? (
        <p className="wk-card-text">Wczytywanie…</p>
      ) : who === null ? (
        <p className="wk-card-muted">Ten formularz wypełnia koordynator — po zalogowaniu.</p>
      ) : !leads ? (
        <p className="wk-card-muted">Ten formularz wypełnia koordynator.</p>
      ) : (
        <ExtensionSheet extensionId={partId} baseId={baseId} audience="office" who={who} repeat={repeat} name={title} />
      )}
    </>
  );
}

/** 0083 — der eigene Text nach dem Absenden: Zeile für Zeile, wie eingegeben. */
function AfterText({ text }: { text: string }) {
  return (
    <div className="wk-after-text">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>{para.split('\n').map((line, j) => <span key={j}>{j > 0 && <br />}{line}</span>)}</p>
      ))}
    </div>
  );
}

export default FormCard;
