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
 * <b>Und wer sich anmeldet, bekommt eine Adresse</b>, wenn der Baustein
 * `portal` trägt (0027): der Browser würfelt sich vor dem Absenden einen
 * eigenen Platz, und danach steht der Link genau einmal da. Ohne `portal`
 * bleibt es bei der Quittung — dann ist die Einsendung eine Einbahnstrasse, und
 * das ist für einen blossen Rückruf richtig.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadPublicKey } from './area';
import { fromBase64Url } from './crypto';
import {
  loadForm, openFields, submitForm, type Answer, type OpenField, type PublicForm
} from './form';
import { seatPath, type Link } from './seat';
import { WorkspaceError } from './session';

export function FormCard({ partId, config }: {
  partId: string;
  config: Record<string, string>;
}) {
  const [form, setForm] = useState<PublicForm | null | undefined>(undefined);
  const [fields, setFields] = useState<readonly OpenField[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [claim, setClaim] = useState<string | null>(null);
  const [link, setLink] = useState<Link | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      const found = await loadForm(partId);
      setForm(found);

      /*
       * Die offengelegten Schlüssel — je Bereich einer. Ein Bereich, der
       * nichts offengelegt hat, fehlt hier einfach; `openFields` lässt sein
       * Feld dann zu.
       */
      const keys = new Map<string, Uint8Array>();

      for (const area of found.areas) {
        try {
          const open = await loadPublicKey(area.areaId);
          keys.set(area.areaId, fromBase64Url(open.key));
        } catch {
          // Nicht offengelegt. Kein Fehler — eine Auskunft.
        }
      }

      setFields(await openFields(found.fields, keys));
      setFailed(null);
    } catch (e) {
      setForm(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać formularza.');
    }
  }, [partId]);

  useEffect(() => { void look(); }, [look]);

  const title = (config.title ?? '').trim();

  if (form === undefined) return <p className="wk-card-text">Wczytywanie…</p>;

  if (form === null) {
    return <p className="wk-card-muted">{failed ?? 'Tu nie ma formularza.'}</p>;
  }

  /*
   * OHNE Klausel wird nichts gesammelt. Das ist keine Vorsicht, sondern die
   * Bedingung: Art. 13 verlangt, dass der Mensch VORHER weiss, wer seine Daten
   * verarbeitet. Ein Formular, das das nicht sagen kann, darf nicht fragen.
   */
  const nameless = form.areas.filter((a) => a.controller === null);

  /*
   * DAS PORTAL, wenn der Baustein es trägt. Ohne Anker keine Adresse: der Platz
   * hinge dann an nichts, und `seatPath` fiele auf die allgemeine Form `#/seat/…`
   * zurück — was geht, aber niemandem sagt, wo er ist.
   */
  const wantsPortal = (config.portal ?? '').trim() !== ''
    && ['tak', 'yes', 'true', '1'].includes((config.portal ?? '').trim().toLowerCase());

  /*
   * Die Adresse, unter der das Portal hängen soll — aus dem Baustein und nicht
   * aus dem Ort, an dem er steht: das Formular liegt auf
   * `…/confirmation/signin`, das Portal gehört aber unter `…/confirmation`.
   * Fehlt die Angabe, bleibt die allgemeine Form `#/seat/…` — sie führt ebenso
   * hin, sagt dem Menschen bloss nicht, wo er gelandet ist.
   */
  const under = (config.portalUnder ?? '').trim();

  /* Woraus der Name auf dem Platz kommt — dasselbe Feld, das die Kanzlei dafür kennzeichnet. */
  const nameField = fields.find((f) => f.identityRole === 'name');

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
              value={`${window.location.origin}${window.location.pathname}${seatPath(link, under === '' ? null : under)}`}
            />

            <div className="wk-actions">
              <a
                className="wk-btn"
                href={seatPath(link, under === '' ? null : under)}
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

  const missing = fields.filter((f) => f.isRequired && (answers[f.fieldId] ?? '').trim() === '');

  const send = async () => {
    setBusy(true);
    setFailed(null);

    try {
      const given: Answer[] = fields
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
        selfSeat: wantsPortal && home !== undefined
          ? {
              areaId: home,
              epoch: form.fields.find((f) => f.areaId === home)?.epoch ?? 1,
              recipientName: nameField === undefined
                ? undefined
                : (answers[nameField.fieldId] ?? '').trim(),
              underPath: under === '' ? undefined : under
            }
          : undefined
      });

      setClaim(done.claim);
      setLink(done.link);
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

      {form.areas.map((area) => area.controller === null ? null : (
        <p className="wk-hint" key={area.areaId}>
          Administratorem danych jest <strong>{area.controller.name}</strong>
          {area.controller.address !== null && `, ${area.controller.address}`}
          {area.controller.email !== null && ` (${area.controller.email})`}.
        </p>
      ))}

      {nameless.length > 0 && (
        <p className="wk-error">
          Ten formularz nie mówi, kto odpowiada za dane, więc nic nie zbiera.
          Prowadzący stronę musi to uzupełnić.
        </p>
      )}

      {nameless.length === 0 && (
        <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          {fields.map((f) => (
            <label className="wk-field" key={f.fieldId}>
              <span>
                {f.label ?? 'zapieczętowane'}
                {f.isRequired && ' *'}
              </span>

              {f.label === null ? (
                <p className="wk-card-muted">
                  Tego pola nie da się odczytać — obszar nie ujawnił swojego klucza.
                </p>
              ) : f.kind === 'text' ? (
                <textarea
                  rows={4}
                  value={answers[f.fieldId] ?? ''}
                  onChange={(e) => setAnswers({ ...answers, [f.fieldId]: e.target.value })}
                />
              ) : f.kind === 'choice' ? (
                <select
                  value={answers[f.fieldId] ?? ''}
                  onChange={(e) => setAnswers({ ...answers, [f.fieldId]: e.target.value })}
                >
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.kind === 'date' ? 'date' : f.kind === 'number' ? 'number'
                    : f.kind === 'email' ? 'email' : f.kind === 'phone' ? 'tel' : 'text'}
                  value={answers[f.fieldId] ?? ''}
                  onChange={(e) => setAnswers({ ...answers, [f.fieldId]: e.target.value })}
                />
              )}

              {f.help !== null && <span className="wk-hint">{f.help}</span>}
            </label>
          ))}

          {failed !== null && <p className="wk-error">{failed}</p>}

          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy || missing.length > 0}>
              {busy ? 'Wysyłanie…' : 'Wyślij'}
            </button>

            {missing.length > 0 && (
              <span className="wk-blocker">
                Brakuje: {missing.map((f) => f.label ?? 'zapieczętowane').join(', ')}
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
