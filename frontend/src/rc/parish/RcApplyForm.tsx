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
import { rcPhones, RC_DEFAULT_DIAL } from './rcPhone';
import { rcPrintApply, type RcPrintParish } from './rcPrintApply';

/**
 * Co pyta formularz.
 *
 * <b>Każda rzecz w swoim polu.</b> Wcześniej imię i nazwisko dzieliły jedno, a
 * telefon i adres drugie. Dwie rzeczy w jednym polu to jedna rzecz: nie da się
 * ułożyć listy po nazwiskach ani wziąć adresu na kopertę.
 *
 * `kind` mówi, jak wygląda pole. `phones` przyjmuje kilka numerów, po jednym
 * w wierszu — bo tak wygląda kontakt do nastolatka: jego własny i do rodzica.
 */
const LABELS: Record<RcApplyField, {
  label: string;
  hint: string;
  kind: 'text' | 'date' | 'phones' | 'lines';
  required?: boolean;
}> = {
  given: { label: 'Imię', hint: 'np. Jan', kind: 'text', required: true },
  surname: { label: 'Nazwisko', hint: 'np. Kowalski', kind: 'text', required: true },
  born: { label: 'Data urodzenia', hint: '', kind: 'date' },
  phone: { label: 'Telefony', hint: ['501 234 567', '(rodzic) 601 111 222'].join('\n'), kind: 'phones' },
  address: { label: 'Adres zamieszkania', hint: 'ul. …, 00-000 Miasto', kind: 'lines' },
  school: { label: 'Szkoła i klasa', hint: 'np. SP nr 5, klasa 8a', kind: 'text' }
};

type Made = { link: string };

export function RcApplyForm({
  slug, signedIn, prefill, parish
}: {
  slug: string;
  signedIn: boolean;
  /** Co już wiadomo o zalogowanym — imię, nazwisko, telefon. */
  prefill: Partial<Record<RcApplyField, string>>;
  /** Kogo wydruk nazywa po imieniu. Puste pola zostają kropkowaną linią. */
  parish: RcPrintParish;
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

  if (made !== null) {
    return (
      <Done
        link={made.link}
        copied={copied}
        onCopy={() => {
          void navigator.clipboard?.writeText(made.link)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
        /*
          Wydruk składa się z tego, co jest jeszcze w pamięci tej strony.
          Serwer tych danych nie ma i nigdy nie miał — po odświeżeniu zostaje
          droga przez portal, do którego prowadzi link obok.
        */
        onPrint={() => {
          const ok = rcPrintApply(values, parish, form.groupName ?? '');
          if (!ok) setError('Przeglądarka zablokowała nowe okno. Zezwól na nie i spróbuj jeszcze raz.');
        }}
        error={error}
      />
    );
  }

  // Wystarczy jedna część nazwiska — są ludzie z jednym imieniem, a formularz,
  // który ich odrzuca, odrzuca ich.
  const named = (values.given ?? '').trim() !== '' || (values.surname ?? '').trim() !== '';
  const ready = named && rodo && !busy;

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
        {RC_APPLY_FIELDS.map((field) => {
          const def = LABELS[field];
          const value = values[field] ?? '';
          const set = (v: string) => setValues({ ...values, [field]: v });

          return (
            <label className={`ap-field${def.kind === 'text' || def.kind === 'date' ? '' : ' ap-field-wide'}`} key={field}>
              <span>
                {def.label}
                {def.required === true && <em> — wymagane</em>}
              </span>

              {def.kind === 'phones' || def.kind === 'lines' ? (
                <textarea
                  rows={def.kind === 'phones' ? 3 : 2}
                  value={value}
                  placeholder={def.hint}
                  disabled={busy}
                  onChange={(e) => set(e.target.value)}
                  /*
                    Numery porządkują się przy WYJŚCIU z pola, nie przy każdym
                    znaku: poprawianie w trakcie pisania przestawia kursor i
                    człowiek walczy z własnym polem.
                  */
                  onBlur={def.kind === 'phones' ? (e) => set(rcPhones(e.target.value).join('\n')) : undefined}
                />
              ) : (
                <input
                  type={def.kind}
                  value={value}
                  placeholder={def.hint}
                  disabled={busy}
                  autoComplete="off"
                  onChange={(e) => set(e.target.value)}
                />
              )}

              {def.kind === 'phones' && (
                <small className="ps-muted">
                  Jeden numer w wierszu. Brakujący kierunkowy {RC_DEFAULT_DIAL} dopiszemy sami.
                </small>
              )}
            </label>
          );
        })}
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
function Done({ link, copied, onCopy, onPrint, error }: {
  link: string;
  copied: boolean;
  onCopy: () => void;
  onPrint: () => void;
  error: string | null;
}) {
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

      {/*
        Zgoda rodzica musi trafić na papier — haczyk zaznaczony przez
        nastolatka nie jest zgodą opiekuna. Dlatego wydruk stoi tu, a nie
        dopiero gdzieś w portalu: teraz jest moment, w którym ktoś to zrobi.
      */}
      <div className="ap-after">
        <button type="button" className="ps-signin" onClick={onPrint}>
          Drukuj zgłoszenie i zgodę rodzica
        </button>
        <a className="ps-more" href={link}>Otwórz portal kandydata</a>
      </div>

      <p className="ps-muted">
        Wydruk to trzy strony A5: zgłoszenie, oświadczenie rodzica do podpisu
        i klauzula informacyjna. Podpisaną zgodę trzeba oddać w parafii.
      </p>

      {error !== null && <p className="ap-error">{error}</p>}
    </article>
  );
}

export default RcApplyForm;
