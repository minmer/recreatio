/**
 * Die Selbstanmeldung zur Firmung — die Seite des Browsers.
 *
 * <b>Was hier geschieht und warum nicht auf dem Server:</b>
 *
 * <code>
 *   1. Sitzungsschlüssel würfeln       — 32 Byte, nur hier
 *   2. jedes Feld damit versiegeln     — der Server sieht Geheimtext
 *   3. Sitzungsschlüssel verpacken     — unter dem öffentlichen Annahme-
 *                                        schlüssel der Gruppe
 *   4. Portalgeheimnis würfeln         — auch nur hier
 *   5. Abdruck + verpackte Fassung     — das Einzige, was hinausgeht
 * </code>
 *
 * <b>Der Server würfelt nichts davon.</b> Täte er es, läge das Geheimnis einen
 * Augenblick lang bei ihm — im Arbeitsspeicher, in einem Absturzabbild, in
 * einer Ablaufspur. Wer sagt „nur der Abdruck wird gespeichert", darf es nicht
 * vorher in der Hand gehabt haben.
 *
 * <b>Der Link trägt den Schlüssel.</b> Er steht hinter der Raute und geht nie
 * an den Server. Das ist der Preis dafür, dass der Anmeldende seine eigenen
 * Daten sieht: wer den Link hat, hat die Daten. Er ist kein Ausweis, sondern
 * ein Schlüssel.
 */

import { rcFetch } from '../lib/rcApi';
import type { RcApi } from '../lib/rcApi';
import { rcAad, RcField, newSymmetricKey, openText, seal, wrapKey } from '../lib/rcCrypto';
import type { RcFieldName } from '../lib/rcCrypto';
import { rcFromBase64Url, rcToBase64Url } from '../lib/rcBase64';
import { rcPath } from '../lib/rcRoute';

export type RcConfirmationForm = RcApi<'RcConfirmationFormResponse'>;
export type RcCandidatePortal = RcApi<'RcCandidatePortalResponse'>;

/** Die Felder einer Anmeldung. Die Namen sind die des Servers. */
export const RC_APPLY_FIELDS = ['given', 'surname', 'born', 'phone', 'address', 'school'] as const;
export type RcApplyField = (typeof RC_APPLY_FIELDS)[number];

/**
 * Welches Etikett ein Feld beim Versiegeln trägt (3.13).
 *
 * Sie stehen HIER und nicht verstreut im Formular: ein Tippfehler wäre ein
 * stillschweigend anderes Etikett, und der Geheimtext ginge nie wieder auf.
 */
const FIELD_LABEL: Record<RcApplyField, RcFieldName> = {
  given: RcField.CandidateGiven,
  surname: RcField.CandidateSurname,
  born: RcField.CandidateBorn,

  // Mehrere Nummern, eine je Zeile — sie gehören derselben Person und werden
  // zusammen gelesen.
  phone: RcField.CandidateContact,

  address: RcField.CandidateAddress,
  school: RcField.CandidateSchool
};

/** Das Formular holen — ohne Konto, weil eine Anmeldung ohne Konto möglich sein muss. */
export const rcConfirmationForm = (slug: string) =>
  rcFetch<RcConfirmationForm>(`/public/confirmation/${encodeURIComponent(slug)}`);

/**
 * Ein Portalgeheimnis.
 *
 * 18 Byte, base64url — dieselbe Länge und Kodierung wie die Zugangslinks des
 * Kernels (`RcToken.SecretBytes`). Nicht, weil es dieselbe Tabelle wäre,
 * sondern damit ein Link überall gleich aussieht und gleich lang ist.
 */
export const rcNewPortalSecret = (): string =>
  rcToBase64Url(crypto.getRandomValues(new Uint8Array(18)));

/**
 * Der Abdruck eines Portalgeheimnisses.
 *
 * <b>SHA-256 über die UTF-8-Bytes der ZEICHENKETTE</b> — nicht über die Bytes,
 * die darin kodiert sind. Der Dienst rechnet dasselbe (`RcToken.HashSecret`),
 * und beide schneiden vorher den Leerraum ab: ein Link aus einer Nachricht
 * bringt gern ein Leerzeichen mit.
 *
 * Ginge eine der beiden Seiten anders vor, käme ein anderer Abdruck heraus und
 * niemand sähe einen Fehler: die Anmeldung ginge durch, und der Link führte
 * danach ins Leere. Ein gemeinsamer Testvektor steht in `rcCandidate.test.ts`
 * und in den reinen Prüfungen des Dienstes.
 */
export async function rcPortalHash(secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(secret.trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

/**
 * Der Link zum Portal.
 *
 * Geheimnis UND Schlüssel, beide hinter der Raute — dort bleiben sie im
 * Browser und gehen nie an den Server.
 */
export const rcPortalLink = (secret: string, sessionKey: Uint8Array): string =>
  `${rcPath('candidate', secret)}/${rcToBase64Url(sessionKey)}`;

/**
 * Eine Anmeldung absenden.
 *
 * Gibt den fertigen Portallink zurück — er entsteht HIER und kommt nicht vom
 * Server, weil der Server das Geheimnis nie hatte.
 */
export async function rcApply(
  slug: string,
  form: RcConfirmationForm,
  values: Partial<Record<RcApplyField, string>>,
  candidateId: string
): Promise<{ link: string; secret: string; sessionKey: Uint8Array }> {
  const publicKeyText = form.intakePublicKey;
  if (publicKeyText === null || publicKeyText === undefined) {
    throw new Error('Ohne Annahmeschlüssel lässt sich nichts verschließen.');
  }

  const sessionKey = newSymmetricKey();

  /*
   * Jedes Feld für sich versiegelt, mit eigenem Etikett.
   *
   * Ein einziger Klumpen wäre einfacher und ließe sich nicht mehr trennen —
   * dann bekäme, wer die Schule sehen darf, auch den Geburtstag.
   */
  const fields: { field: string; sealed: string }[] = [];
  for (const field of RC_APPLY_FIELDS) {
    const value = (values[field] ?? '').trim();
    if (value.length === 0) continue;

    const blob = await seal(
      sessionKey,
      rcAad('confirmation', 'candidate', candidateId, FIELD_LABEL[field], 1),
      new TextEncoder().encode(value)
    );
    fields.push({ field, sealed: rcToBase64Url(blob) });
  }

  const secret = rcNewPortalSecret();
  const spki = rcFromBase64Url(publicKeyText);

  /*
   * ZWEI VERSCHIEDENE PLÄTZE.
   *
   * Der Sitzungsschlüssel und das Portalgeheimnis werden unter DEMSELBEN
   * öffentlichen Schlüssel verpackt, aber an verschiedenen Plätzen: sie
   * gehören derselben Anmeldung und sind zwei verschiedene Dinge.
   *
   * Im Anmeldeweg der Veranstaltungen ist genau das schon einmal
   * auseinandergelaufen — der Browser verpackte an einem Platz, der Server
   * packte an einem anderen aus, beide für sich schlüssig, und nichts ging auf.
   */
  const keyAad = rcAad('confirmation', 'candidate', candidateId, RcField.EventIntakeKey, 1);
  const portalAad = rcAad('confirmation', 'candidate', candidateId, RcField.InvitationRoleKey, 1);

  const [sessionKeyWrapped, portalTokenWrapped, portalTokenHash] = await Promise.all([
    wrapKey(spki, keyAad, sessionKey),
    wrapKey(spki, portalAad, new TextEncoder().encode(secret)),
    rcPortalHash(secret)
  ]);

  await rcFetch<RcApi<'RcCandidateAppliedResponse'>>(
    `/public/confirmation/${encodeURIComponent(slug)}/apply`,
    {
      body: {
        fields,
        sessionKeyWrapped: rcToBase64Url(sessionKeyWrapped),
        rodoAccepted: true,
        portalTokenHash,
        portalTokenWrapped: rcToBase64Url(portalTokenWrapped)
      }
    }
  );

  return { link: rcPortalLink(secret, sessionKey), secret, sessionKey };
}

/**
 * Ein Geburtsdatum in der Form, in der es auf einem Formular steht.
 *
 * Das Datumsfeld des Browsers liefert `2011-04-02`. Auf Papier sieht das nach
 * einer Nummer aus und nicht nach einem Datum — wer es abschreibt, vertauscht
 * Tag und Monat. Umgekehrt gilt: was kein Datum ist, bleibt unverändert. Aus
 * einer Zeile, die jemand von Hand geschrieben hat, wird hier nichts geraten.
 */
export function rcDay(raw: string): string {
  const text = raw.trim();
  const parts = text.split('-');
  if (parts.length !== 3) return text;

  const [year, month, day] = parts;
  if (year.length !== 4 || month.length !== 2 || day.length !== 2) return text;

  const digits = year + month + day;
  for (const ch of digits) if (ch < '0' || ch > '9') return text;

  return day + '.' + month + '.' + year;
}

// -- Das Portal ---------------------------------------------------------------

export const rcCandidatePortal = (secret: string) =>
  rcFetch<RcCandidatePortal>(`/public/candidate/${encodeURIComponent(secret)}`);

export const rcBindCandidate = (secret: string) =>
  rcFetch<RcApi<'RcCandidateBoundResponse'>>(
    `/public/candidate/${encodeURIComponent(secret)}/bind`, { body: {}, withUnlock: true });

export const rcRevokeCandidate = (secret: string) =>
  rcFetch<RcApi<'RcCandidateRevokedResponse'>>(
    `/public/candidate/${encodeURIComponent(secret)}/revoke`, { body: {}, withUnlock: true });

/**
 * Die eigenen Angaben aus dem Portal öffnen.
 *
 * Der Schlüssel kommt aus dem Link. Ein Feld, das nicht aufgeht, wird
 * übersprungen und wirft nicht — ein einzelnes kaputtes Feld darf nicht die
 * ganze Seite verschlucken.
 */
export async function rcOpenCandidate(
  portal: RcCandidatePortal,
  sessionKey: Uint8Array
): Promise<Partial<Record<RcApplyField, string>>> {
  const out: Partial<Record<RcApplyField, string>> = {};

  for (const item of portal.fields ?? []) {
    const field = item.field as RcApplyField;
    if (!(RC_APPLY_FIELDS as readonly string[]).includes(field)) continue;

    try {
      out[field] = await openText(
        sessionKey,
        rcAad('confirmation', 'candidate', portal.candidateId, FIELD_LABEL[field], 1),
        rcFromBase64Url(item.sealed)
      );
    } catch { /* Ein Feld, das nicht aufgeht, fehlt — die anderen bleiben. */ }
  }

  return out;
}

/**
 * Der Portallink aus einem Geheimnis allein — OHNE Schlüssel.
 *
 * <b>Für die Pfarrei, die ihn verschickt.</b> Sie kennt den Sitzungsschlüssel
 * des Kandidaten nicht und soll ihn nicht kennen: sie liest die Daten über
 * ihre eigene Amtsrolle, nicht über diesen Link.
 *
 * Der Kandidat kommt damit an seinen Stand und kann sein Konto verbinden. Die
 * eigenen Angaben sieht er über diesen Weg nicht — dafür braucht es den Link
 * mit Schlüssel, den er nach dem Absenden bekommen hat.
 */
export const rcPortalLinkFromSecret = (secret: string): string => rcPath('candidate', secret);
