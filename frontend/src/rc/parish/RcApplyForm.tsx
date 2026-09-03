/**
 * Zgłoszenie kandydata do bierzmowania — formularz publiczny.
 *
 * <b>Wszystko szyfruje przeglądarka.</b> Serwer dostaje sam szyfrogram i klucz
 * sesji zapakowany kluczem publicznym grupy — nie może otworzyć żadnego z nich.
 * To nie jest ostrożność ponad miarę: kandydaci są nieletni, a operator nie ma
 * powodu widzieć ich danych.
 *
 * <b>Link zwrotny powstaje tutaj i nigdzie indziej.</b> Sekret losuje ta
 * strona, serwer dostaje tylko odcisk. Kto go zgubi, nie podłączywszy konta,
 * traci dostęp — i strona mówi to, zanim ktokolwiek ją zamknie.
 *
 * <b>Zgoda rodzica zostaje na papierze.</b> Zaznaczenie klauzuli przez
 * nastolatka nie zastępuje zgody opiekuna; parafia widzi w swojej liście, od
 * kogo jeszcze czeka.
 */

import { useEffect, useState } from 'react';

import {
  rcApply, rcConfirmationForm, RC_APPLY_FIELDS,
  type RcApplyField, type RcConfirmationForm
} from './rcCandidate';
import { RcRequestError } from '../lib/rcApi';

/** Co pyta formularz — i jak to podpisać. */
const LABELS: Record<RcApplyField, { label: string; hint: string; type: string }> = {
  name: { label: 'Imię i nazwisko', hint: 'np. Jan Kowalski', type: 'text' },
  born: { label: 'Data urodzenia', hint: '', type: 'date' },
  contact: { label: 'Telefon i adres', hint: 'telefon, adres zamieszkania', type: 'text' },
  school: { label: 'Szkoła i klasa', hint: 'np. SP nr 5, klasa 8a', type: 'text' }
};

type Made = { link: string };

export function RcApplyForm({
  slug, signedIn, prefill
}: {
  slug: string;
  signedIn: boolean;
  /** Co już wiadomo o zalogowanym — imię, nazwisko, telefon. */
  prefill: Partial<Record<RcApplyField, string>>;
}) {
  const [form, setForm] = useState<RcConfirmationForm | null>(null);
  const [values, setValues] = useState<Partial<Record<RcApplyField, string>>>({});
  const [rodo, setRodo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<Made | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const found = await rcConfirmationForm(slug);
        if (alive) setForm(found);
      } catch { if (alive) setForm(null); }
    })();
    return () => { alive = false; };
  }, [slug]);

  /*
   * Co już wiadomo, wpisuje się samo — ale tylko w puste pola.
   *
   * Nadpisywanie tego, co ktoś przed chwilą wpisał, jest gorsze niż brak
   * uzupełnienia: człowiek nie widzi, że jego wpis zniknął.
   */
  useEffect(() => {
    if (!signedIn) return;
    setValues((current) => {
      const next = { ...current };
      for (const field of RC_APPLY_FIELDS) {
        if ((next[field] ?? '') === '' && (prefill[field] ?? '') !== '') next[field] = prefill[field];
      }
      return next;
    });
  }, [signedIn, prefill]);

  if (form === null) return null;

  if (form.open !== true) {
    return (
      <article className="ps-card ps-card-note">
        <h2>Zgłoszenia</h2>
        <p>W tej chwili nie przyjmujemy zgłoszeń. Zapytaj w kancelarii.</p>
      </article>
    );
  }

  if (made !== null) return <Done link={made.link} copied={copied} onCopy={() => {
    void navigator.clipboard?.writeText(made.link).then(() => setCopied(true)).catch(() => setCopied(false));
  }} />;

  const ready = (values.name ?? '').trim().length > 0 && rodo && !busy;

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      /*
       * Kennung des Kandidaten wird HIER gewürfelt: sie geht in jede AAD ein,
       * und der Browser muss sie kennen, BEVOR er versiegelt. Vom Server sie
       * zu holen hieße: erst eine leere Zeile anlegen, dann füllen — und bei
       * einem Abbruch bliebe sie stehen.
       */
      const candidateId = crypto.randomUUID();
      const result = await rcApply(slug, form, values, candidateId);
      setMade({ link: `${window.location.origin}/${result.link}` });
    } catch (e) {
      setError(e instanceof RcRequestError
        ? 'Nie udało się wysłać zgłoszenia. Spróbuj jeszcze raz.'
        : 'Coś poszło nie tak przy szyfrowaniu. Zgłoszenie nie zostało wysłane.');
    } finally { setBusy(false); }
  };

  return (
    <article className="ps-card ap">
      <h2>Zgłoszenie kandydata</h2>
      <p className="ps-muted">{form.groupName}</p>

      {signedIn && (
        <p className="ap-note">
          Jesteś zalogowany — część danych została wpisana z twojego profilu.
          Po wysłaniu zobaczą je osoby odpowiedzialne za przygotowanie do
          bierzmowania.
        </p>
      )}

      <div className="ap-fields">
        {RC_APPLY_FIELDS.map((field) => (
          <label className="ap-field" key={field}>
            <span>{LABELS[field].label}{field === 'name' && <em> — wymagane</em>}</span>
            <input
              type={LABELS[field].type}
              value={values[field] ?? ''}
              placeholder={LABELS[field].hint}
              disabled={busy}
              autoComplete="off"
              onChange={(e) => setValues({ ...values, [field]: e.target.value })}
            />
          </label>
        ))}
      </div>

      {/*
        Zgoda jest sprawdzana także na serwerze. Haczyk, którego wymaga tylko
        strona, nie jest haczykiem.
      */}
      <label className="ap-rodo">
        <input type="checkbox" checked={rodo} disabled={busy} onChange={(e) => setRodo(e.target.checked)} />
        <span>
          Wyrażam zgodę na przetwarzanie powyższych danych w celu przygotowania
          do sakramentu bierzmowania, zgodnie z Dekretem KEP o ochronie danych
          osobowych w Kościele katolickim.
          <em>
            Zgodę rodzica lub opiekuna prawnego trzeba dostarczyć osobno,
            na piśmie.
          </em>
        </span>
      </label>

      {error !== null && <p className="ap-error">{error}</p>}

      <button type="button" className="ps-signin" disabled={!ready} onClick={() => void send()}>
        {busy ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
      </button>
    </article>
  );
}

/**
 * Co widać po wysłaniu.
 *
 * <b>Link stoi tu raz i nigdy więcej.</b> Serwer go nie zna — zna tylko odcisk.
 * Dlatego ostrzeżenie jest ostre: zamknięcie tej strony bez zapisania linku i
 * bez podłączenia konta oznacza utratę dostępu do własnego zgłoszenia.
 */
function Done({ link, copied, onCopy }: { link: string; copied: boolean; onCopy: () => void }) {
  return (
    <article className="ps-card ap ap-done">
      <h2>Zgłoszenie przyjęte</h2>

      <p className="ap-warn">
        <strong>Zapisz ten link.</strong> To jedyna droga do twojego zgłoszenia,
        dopóki nie podłączysz konta. Nikt — także parafia — nie może go
        odtworzyć, jeśli go zgubisz.
      </p>

      <div className="ap-link">
        <input type="text" value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={onCopy}>{copied ? 'Skopiowano' : 'Kopiuj'}</button>
      </div>

      <p className="ps-muted">
        Otwórz go teraz i dodaj do zakładek — albo zaloguj się w portalu i
        połącz zgłoszenie z kontem, wtedy link przestanie być potrzebny.
      </p>

      <a className="ps-more" href={link}>Otwórz portal kandydata</a>
    </article>
  );
}

export default RcApplyForm;
