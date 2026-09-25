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

import { useCallback, useEffect, useMemo, useState } from 'react';

import { loadPublicKey } from './area';
import { fromBase64Url } from './crypto';
import {
  loadForm, openFields, submitForm, type Answer, type OpenField, type PublicForm
} from './form';
import type { Ring } from './keys';
import { evaluate, layoutWith, missingIn, openDesign, type FormDesign } from './formDesign';
import { FormFlow, isRequired } from './FormFlow';
import { keysFor } from './ringOf';
import { bindSeat, seatPath, type Link } from './seat';
import { whoIsThere, WorkspaceError } from './session';
import { detailsOf, personFieldOf, subjectsFor, type Subject } from './subject';

export function FormCard({ partId, title, portalUnder: under }: {
  partId: string;
  title: string;

  /** Unter welcher Seite die Plätze hängen. Leer: eine Ebene höher. */
  portalUnder: string;
}) {
  const [form, setForm] = useState<PublicForm | null | undefined>(undefined);
  const [fields, setFields] = useState<readonly OpenField[]>([]);

  /* Aufbau und Logik (0043) — oder `null`: dann ist das Formular eine Liste wie vorher. */
  const [design, setDesign] = useState<FormDesign | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [claim, setClaim] = useState<string | null>(null);
  const [link, setLink] = useState<Link | null>(null);

  /** Wohin der Platz gehört — der Dienst hat es entschieden, nicht wir. */
  const [landed, setLanded] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
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

  const look = useCallback(async () => {
    try {
      const found = await loadForm(partId);
      setForm(found);

      /*
       * Die offengelegten Schlüssel — je Bereich einer, und zwar für die
       * Bereiche, unter denen die FRAGEN liegen (0042: der des Formulars).
       * Die Bereiche der Antworten brauchen hier keinen: dorthin geht nur,
       * was unter ihrer Annahme verpackt wird. Ein Bereich, der nichts
       * offengelegt hat, fehlt einfach; `openFields` lässt sein Feld dann zu.
       */
      const keys = new Map<string, Uint8Array>();

      const needed = [...found.fields.map((f) => f.labelAreaId ?? f.areaId),
        ...(found.design === null ? [] : [found.design.areaId])];

      for (const areaId of new Set(needed)) {
        try {
          const open = await loadPublicKey(areaId);
          keys.set(areaId, fromBase64Url(open.key));
        } catch {
          // Nicht offengelegt. Kein Fehler — eine Auskunft.
        }
      }

      setFields(await openFields(found.fields, keys));
      setDesign(await openDesign(found.design ?? null, found.design === null ? undefined : keys.get(found.design.areaId), partId));
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
  useEffect(() => {
    if (ring === null || chosen === null) return;

    let dropped = false;

    void (async () => {
      const details = await detailsOf(chosen, ring);
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
    })();

    /* Wer schnell zweimal umschaltet, bekommt sonst die erste Antwort
       über die zweite geschrieben. */
    return () => { dropped = true; };
  }, [chosen, ring, fields]);



  if (form === undefined) return <p className="wk-card-text">Wczytywanie…</p>;

  if (form === null) {
    return <p className="wk-card-muted">{failed ?? 'Tu nie ma formularza.'}</p>;
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
  const forWhom = subjects.find((one) => one.roleId === chosen) ?? null;

  if (sent) {
    return (
      <>
        {title !== '' && <h2 className="wk-card-title">{title}</h2>}
        <p className="wk-done">Zgłoszenie przyjęte.</p>

        {link !== null ? (
          <>
            <p className="wk-hint">
              <strong>To jest Twój adres.</strong> Pod nim zobaczysz to, co
              wpisałeś — i to, co parafia do Ciebie napisze. Zapisz go albo dodaj
              do zakładek: <strong>widzisz go tylko teraz</strong>, bo u nas
              zapisany jest wyłącznie jego odcisk. Nikt Ci go nie odtworzy.
            </p>

            <textarea
              readOnly rows={3} className="wk-mono"
              value={`${window.location.origin}${window.location.pathname}${seatPath(link, landed)}`}
            />

            <div className="wk-actions">
              <a
                className="wk-btn"
                href={seatPath(link, landed)}
              >
                Otwórz moją stronę
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
       * Der Platz gehört dem Bereich, in den dieses Formular schreibt. Fragen
       * mehrerer Bereiche kommen vor (die Anmeldung an die Pfarrei, die
       * Gesundheitsangabe an die Leitung) — das Portal hängt am ERSTEN, und
       * zwar an dem des Namensfeldes, wenn es eines gibt. Sonst hinge es
       * irgendwo.
       */
      const home = nameField?.areaId ?? form.fields[0]?.areaId;

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
              recipientName: forWhom?.name
                ?? (nameField === undefined
                  ? undefined
                  : (answers[nameField.fieldId] ?? '').trim()),
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
      if (forWhom !== null && done.seat !== null && done.link !== null && ring !== null) {
        const role = ring.roleOf(forWhom.roleId);

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
      {subjects.length > 0 && !nameless && !form.closed && (
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

      {unreadable > 0 && !form.closed && (
        <p className="wk-warn">
          {blind ? 'Pytań tego formularza nie da się odczytać' : `Części pytań (${unreadable}) nie da się odczytać`}
          {' '}— są zapieczętowane kluczem obszaru, który nie jest jawny. Prowadzący formularz
          naprawi to, otwierając go u siebie: pytania zostaną przepieczętowane kluczem obszaru formularza.
        </p>
      )}

      {!nameless && !form.closed && !blind && (
        <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <FormFlow
            items={layout}
            fields={byId}
            answers={answers}
            outcome={outcome}
            onAnswer={(fieldId, value) => setAnswers((before) => ({ ...before, [fieldId]: value }))}
          />

          {failed !== null && <p className="wk-error">{failed}</p>}

          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy || missing.length > 0}>
              {busy ? 'Wysyłanie…' : 'Wyślij'}
            </button>

            {missing.length > 0 && (
              <span className="wk-blocker">
                Brakuje: {missing.map((f) => outcome.labels.get(f.fieldId) ?? f.label ?? 'zapieczętowane').join(', ')}
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

export default FormCard;
