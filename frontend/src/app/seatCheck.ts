/**
 * Der Link eines Menschen — beim ersten Öffnen geprüft, für die Kanzlei
 * wieder lesbar, und neu, sobald sich seine Angaben ändern (0046).
 *
 * <b>Drei Dinge, ein Zweck: ein Link in einer SMS kann bei der falschen Nummer
 * landen.</b>
 *
 * <code>
 *   beim ersten Öffnen   wer den Link hat, nennt einmal, was das Formular
 *                        dafür vorsieht (etwa Imię und Nazwisko)
 *   alles bestätigen     danach sieht er ALLE seine Angaben, vor allem die
 *                        Kontakte, und sagt einmal, dass sie stimmen
 *   neuer Link           ändert er etwas, gilt der alte nicht mehr — er ist
 *                        vielleicht an eine Nummer gegangen, die nicht stimmt
 * </code>
 *
 * <b>Der Nachweis hängt am LINKSCHLÜSSEL.</b> Gerechnet wird ein HMAC über die
 * Antworten, mit einem Schlüssel, der aus dem Linkschlüssel abgeleitet ist —
 * und der geht nie an den Dienst. Der Dienst hält nur den Abdruck des
 * Nachweises und vergleicht; er kann aus ihm NICHTS erraten, auch kein
 * Geburtsdatum mit seinen paar zehntausend Möglichkeiten: ihm fehlt der
 * Schlüssel. Wer den Link hat, kann raten — aber nur beim Dienst, und der
 * zählt mit (zehn Versuche).
 */

import { aad, derive, Field, fromBase64Url, hmacSha256, openText, sealText, sha256Bytes, toBase64Url } from './crypto';
import type { Link } from './seat';
import { call } from './session';

/* -- Der Link, versiegelt unter dem Platzschlüssel --------------------------- */

const linkAad = (seatId: string) => aad('seat', 'access', seatId, Field.SeatLink, 1);

/** Den Link unter dem Platzschlüssel versiegeln — wer den Platz öffnet, liest ihn wieder. */
export const sealLink = async (seatId: string, seatKey: Uint8Array, link: Link): Promise<string> =>
  toBase64Url(await sealText(seatKey, linkAad(seatId), `${link.token}.${link.key}`));

/** Und wieder lesen — `null`, wenn die Hülle nicht aufgeht. */
export async function openLink(seatId: string, seatKey: Uint8Array, sealed: string): Promise<Link | null> {
  try {
    const [token, key] = (await openText(seatKey, linkAad(seatId), fromBase64Url(sealed))).split('.');
    return token === undefined || key === undefined || token === '' || key === '' ? null : { token, key };
  } catch {
    return null;
  }
}

/* -- Die Antworten beim ersten Öffnen ----------------------------------------- */

/**
 * Wie eine Antwort verglichen wird — so, dass „Łukasz Nowak", „lukasz nowak"
 * und „Łukasz  Nowak " dasselbe sind.
 *
 * <b>Grosszügig, weil sich niemand genau erinnert, WIE er etwas getippt
 * hat.</b> Buchstaben ohne Zeichen, klein, nur Buchstaben und Ziffern. Eine
 * Nummer zählt mit ihren letzten neun Ziffern — „+48 600 700 800" und
 * „600700800" sind dieselbe.
 */
export function checkText(kind: string, value: string): string {
  if (kind === 'phone') {
    const digits = value.replace(/\D/g, '');
    return digits.length > 9 ? digits.slice(-9) : digits;
  }

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    /* Das ł zerfällt nicht — es ist ein eigener Buchstabe, kein l mit Zeichen. */
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface CheckAnswer {
  readonly fieldId: string;
  readonly kind: string;
  readonly value: string;
}

/**
 * Der Nachweis: HMAC(Schlüssel aus dem Link, Platz + Antworten). In der
 * Reihenfolge der Fragen, wie der Dienst sie nennt.
 */
export async function seatProof(
  linkKey: Uint8Array, seatId: string, answers: readonly CheckAnswer[]
): Promise<Uint8Array> {
  const key = await derive(linkKey, 'recreatio:v1:seat-check', 32);
  const text = [seatId, ...answers.map((a) => checkText(a.kind, a.value))].join('\u001f');
  return hmacSha256(key, new TextEncoder().encode(text));
}

/**
 * Was beim Ausstellen mitgeht — Abdruck und Fragen. Leere Antworten zählen
 * nicht: wer eine Frage nie beantwortet hat, kann sie auch nicht bestätigen.
 * Bleibt nichts, fragt der Link nichts.
 */
export async function checkFor(
  linkKey: Uint8Array, seatId: string, answers: readonly CheckAnswer[]
): Promise<{ verifySha256: string; verifyFields: string[] } | null> {
  const given = answers.filter((a) => checkText(a.kind, a.value) !== '');
  if (given.length === 0) return null;

  return {
    verifySha256: toBase64Url(await sha256Bytes(await seatProof(linkKey, seatId, given))),
    verifyFields: given.map((a) => a.fieldId)
  };
}

/* -- Beim Dienst ---------------------------------------------------------------- */

/** Eine Frage, die der Link beim ersten Öffnen stellt — ihre Beschriftung liegt unter dem Schlüssel des Formulars. */
export interface CheckQuestion {
  readonly fieldId: string;
  readonly kind: string;
  readonly labelSealed: string;
  readonly labelAreaId: string;
  readonly labelEpoch: number;
}

export interface SeatChallenge {
  readonly seatId: string;
  readonly verify: { readonly fields: readonly CheckQuestion[]; readonly attemptsLeft: number };
}

export const verifySeat = (token: string, proof: Uint8Array): Promise<{ verified: boolean }> =>
  call(`/seat/${encodeURIComponent(token)}/verify`, {
    method: 'POST',
    body: JSON.stringify({ proof: toBase64Url(proof) })
  });

/** „Wszystko się zgadza" — die ganze Einsendung auf einmal. */
export const confirmSubmission = (token: string, registrationId: string): Promise<{ confirmed: boolean }> =>
  call(`/seat/${encodeURIComponent(token)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ registrationId })
  });
