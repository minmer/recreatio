/**
 * Was das Formular auf einer Seite lädt und behält: Fragen, Aufbau, Antworten, für wen, wohin der Link geht.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AccountWay } from '../areas/areaRead';
import type { Ring } from '../core/keys';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, whoIsThere } from '../core/session';
import { usePerson } from '../pages/pagePerson';
import type { Link } from '../seats/seat';
import { type SeatView, useSeats } from '../seats/seatContext';
import { type ExtensionInfo, loadSteps } from '../steps/steps';
import { useEntrySubject, useOfficeSubject } from './entrySubject';
import type { OpenField, PublicForm } from './form';
import { type FormDesign, evaluate, layoutWith } from './formDesign';
import { keepOpenedForm, openPublicForm } from './SignSheet';
import { type Subject, detailsOf, personFieldOf, subjectsFor } from './subject';

export type FormCardProps = {
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
};

export function useFormCard(props: FormCardProps) {
  const { partId } = props;
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
  /* 0104 — die Seite handelt von EINEM Menschen (oben gewählt): ein Unterformular zeigt seinen Eintrag. */
  const subject = useOfficeSubject(useEntrySubject());
  const openSeats = useSeats();
  const pageDecides = person !== null && form != null && form.forKind === 'person';
  const pageRole = pageDecides && person.chosen?.kind === 'role' ? person.chosen : null;
  const pageSeat = pageDecides && person.chosen?.kind === 'seat' ? person.chosen.seat : null;
  const whom = pageDecides ? (pageRole?.id ?? null) : chosen;
  const whomRing = pageDecides ? (pageRole?.ring ?? null) : ring;

  const look = useCallback(async () => {
    try {
      /* 0083 — dasselbe Aufmachen wie für den Ausdruck (`SignSheet.openPublicForm`) — und der Ausdruck nimmt genau dieses (2026-10-24). */
      const opened = await openPublicForm(partId);
      keepOpenedForm(partId, opened);
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

  return {
    account, answers, attached, busy, byId, chosen, claim, failed, fields, forOther, form, landed, layout, leads, link,
    openSeats, outcome, pageDecides, pageRole, pageSeat, person, sent, sentAt, setAnswers, setAttached, setBusy,
    setChosen, setClaim, setFailed, setForOther, setLanded, setLink, setSent, setSentAt, subject, subjects, whomRing
  };
}
