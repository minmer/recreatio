/**
 * Założenie wydarzenia — jeden formularz, jedno wywołanie.
 *
 * <b>Wszystko powstaje razem albo nic.</b> Obszar (klucze, epoki, łańcuch), rola
 * administracyjna i sam wpis idą w JEDNEJ transakcji po stronie serwera.
 * Przeglądarka robiła to kiedyś przy parafiach w trzech krokach — i między
 * dwoma żądaniami nie ma odwrotu: gdy drugie padło, pierwsze zostawało. Widać
 * to było jako listę jednakowo nazwanych obszarów, które do niczego nie
 * należały.
 *
 * <b>Adres administratora danych jest wymagany, nie „miły".</b> Wydarzenie
 * zbiera zgłoszenia; formularz przyjmujący dane osobowe musi powiedzieć, KTO je
 * przetwarza i pod jakim adresem. Dopisanie tego później znaczyłoby: formularz,
 * który już przyjmuje, zanim ktokolwiek może powiedzieć, kto odpowiada.
 *
 * <b>Osobny obszar, nawet gdy organizuje parafia.</b> Inaczej pomocnicy przy
 * wydarzeniu dostaliby klucz epoki parafii — a z nim kandydatów do bierzmowania
 * i listę chorych. Kto zbiera zapisy na festyn, nie ma tam czego szukać.
 */

import { useEffect, useState } from 'react';

import { rcFoundEvent } from '../lib/rcEvents';
import { rcRoles } from '../lib/rcChat';
import { rcIsSlug, rcAllowedSlugs } from '../lib/rcSlugs';
import { rcPath } from '../lib/rcRoute';
import { RcRequestError } from '../lib/rcApi';

/** Jak nazwać rodzaj roli organizatora — to, co niesie sama rola. */
const KIND_LABEL: Record<string, string> = {
  person: 'osoba',
  office: 'urząd — np. parafia',
  group: 'wspólnota',
  service: 'służba'
};

type Role = { readonly roleId: string; readonly kind: string; readonly name: string };

export function RcFoundEvent({ onFounded }: { onFounded?: (slug: string) => void }) {
  const [roles, setRoles] = useState<readonly Role[]>([]);
  const [founder, setFounder] = useState('');
  const [organizer, setOrganizer] = useState('');

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const found = await rcRoles();
        if (!alive) return;

        const mine = (found.roles ?? [])
          .filter((r) => r.hasKey)
          .map((r) => ({
            roleId: r.roleId,
            kind: r.kind,
            name: (r.displayName ?? '').trim() === '' ? r.roleId : (r.displayName ?? '')
          }));

        setRoles(mine);

        /*
         * Rola osobista jako zakładająca — to ona zwykle ma prawo zakładać, i
         * ona zostaje przy koncie, gdy urząd przejdzie na kogoś innego.
         */
        const person = mine.find((r) => r.kind === 'person');
        if (person !== undefined) {
          setFounder(person.roleId);
          setOrganizer(person.roleId);
        }
      } catch { if (alive) setRoles([]); }
    })();
    return () => { alive = false; };
  }, []);

  const allowed = rcAllowedSlugs('event');
  const slugOk = slug === '' || rcIsSlug(slug);

  const ready = founder !== '' && slugOk && slug !== ''
    && title.trim() !== '' && name.trim() !== '' && address.trim() !== '' && !busy;

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const done = await rcFoundEvent({
        founderRoleId: founder,
        organizerRoleId: organizer === '' ? null : organizer,
        slug,
        title: title.trim(),
        organizerName: name.trim(),
        organizerAddress: address.trim(),
        organizerEmail: email.trim()
      });

      setMade(done.slug);
      onFounded?.(done.slug);
    } catch (e) {
      setError(e instanceof RcRequestError
        ? e.error.message
        : 'Nie udało się założyć wydarzenia.');
    } finally { setBusy(false); }
  };

  if (made !== null) {
    return (
      <div className="fe-done">
        <p className="rc-note">
          Wydarzenie założone. Powstał osobny obszar z własnymi kluczami i rola
          administracyjna — przekazywalna, bez oddawania komukolwiek konta.
        </p>
        <a className="rc-btn" href={`${rcPath('event', made)}`}>Otwórz wydarzenie</a>
      </div>
    );
  }

  return (
    <div className="fe">
      <p className="rc-note">
        Obszar, klucze i rola administracyjna powstają same, razem z wydarzeniem.
        Nic z tego nie trzeba zakładać osobno.
      </p>

      <div className="fe-form">
        <label className="mo-field">
          <span>Zakładam jako</span>
          <select value={founder} onChange={(e) => setFounder(e.target.value)}>
            <option value="">—</option>
            {roles.map((r) => (
              <option key={r.roleId} value={r.roleId}>
                {r.name} ({KIND_LABEL[r.kind] ?? r.kind})
              </option>
            ))}
          </select>
        </label>

        {/*
          Organizator bywa kimś innym niż zakładający: sekretarka zakłada
          wydarzenie parafii. Rodzaj — osoba, parafia, wspólnota — niesie sama
          rola, więc nie pyta się o niego drugi raz.
        */}
        <label className="mo-field">
          <span>Organizuje</span>
          <select value={organizer} onChange={(e) => setOrganizer(e.target.value)}>
            {roles.map((r) => (
              <option key={r.roleId} value={r.roleId}>
                {r.name} ({KIND_LABEL[r.kind] ?? r.kind})
              </option>
            ))}
          </select>
        </label>

        <label className="mo-field">
          <span>Tytuł</span>
          <input
            type="text"
            value={title}
            maxLength={200}
            placeholder="Festyn parafialny 2026"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="mo-field">
          <span>Adres w sieci</span>
          <input
            type="text"
            value={slug}
            maxLength={80}
            placeholder="festyn-2026"
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
        </label>

        {/*
          Adres jest publiczny i zostaje na zawsze: trafia na plakat, do SMS-a,
          na drzwi. Zmiana zrywa każdy z tych odnośników.
        */}
        {!slugOk && (
          <p className="ap-error fe-wide">
            Małe litery, cyfry i myślniki — myślnik tylko w środku.
          </p>
        )}

        {allowed.length > 0 && (
          <p className="ps-muted fe-wide">
            Przewidziane adresy: {allowed.join(', ')}. Adres jest publiczny i
            zostaje — trafia na plakat i do wiadomości, a zmiana zrywa każdy taki
            odnośnik.
          </p>
        )}
      </div>

      <fieldset className="fe-rodo">
        <legend>Administrator danych</legend>

        <p className="ps-muted">
          Wydarzenie przyjmuje zgłoszenia, więc musi powiedzieć, kto odpowiada za
          dane i pod jakim adresem. Bez tego klauzula jest niepełna — a zgoda
          zebrana pod niepełną klauzulą też.
        </p>

        <label className="mo-field fe-wide">
          <span>Nazwa — tak, jak ma stać w klauzuli</span>
          <input
            type="text"
            value={name}
            maxLength={200}
            placeholder="Parafia św. Kazimierza Królewicza w Krakowie"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="mo-field fe-wide">
          <span>Adres</span>
          <input
            type="text"
            value={address}
            maxLength={400}
            placeholder="ul. …, 00-000 Miasto"
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>

        <label className="mo-field fe-wide">
          <span>E-mail do spraw danych — wgląd, sprostowanie, usunięcie</span>
          <input
            type="email"
            value={email}
            maxLength={200}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </fieldset>

      {error !== null && <p className="ap-error">{error}</p>}

      <button type="button" className="rc-btn" disabled={!ready} onClick={() => void send()}>
        {busy ? 'Zakładanie…' : 'Załóż wydarzenie'}
      </button>
    </div>
  );
}

export default RcFoundEvent;
