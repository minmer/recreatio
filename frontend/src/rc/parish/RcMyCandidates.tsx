/**
 * Moje zgłoszenia — portal kandydata od strony konta.
 *
 * <b>Po co, skoro jest link.</b> Link jest jedyną drogą tylko dopóki nie ma
 * konta. Kto połączył zgłoszenie z kontem, powinien do niego trafiać przez
 * konto — inaczej „połącz z kontem" niczego nie daje, a przycisk „wyłącz link"
 * obok zamyka ostatnie wejście.
 *
 * <b>Skąd dane.</b> Klucz sesji leży zapakowany przy roli osoby tego konta
 * (`candidate_key`, rc_0019). Serwer otwiera go rolą, którą konto trzyma —
 * dokładnie tak, jak otwiera swoje dane osobowe. Bez zalogowania i bez linku
 * nie otworzy go nikt.
 *
 * <b>Czego tu nie ma.</b> Linku. Konto go nie zna i nie ma jak odtworzyć —
 * sekret widziała tylko przeglądarka, która wysyłała zgłoszenie, i parafia,
 * która dostała go zapakowanego. To nie jest brak, tylko cena za to, że
 * serwer nie trzyma sekretu.
 */

import { useEffect, useState } from 'react';

import { rcMyCandidates, type RcMyCandidate } from './rcCandidate';
import { rcPrintApply, type RcPrintParish } from './rcPrintApply';
import { rcPublicParish } from './rcPublicParish';
import { rcReadSite } from './rcSite';
import { rcDay } from './rcCandidate';
import { rcPhones } from './rcPhone';

const STATUS: Record<string, string> = {
  enrolled: 'przyjęty',
  withdrawn: 'wycofany',
  confirmed: 'bierzmowany'
};

export function RcMyCandidates({ unlocked }: { unlocked: boolean }) {
  const [list, setList] = useState<readonly RcMyCandidate[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    void (async () => {
      try {
        const found = await rcMyCandidates();
        if (alive) setList(found.candidates ?? []);
      } catch {
        // Brak zgłoszeń to nie błąd; błąd to brak odpowiedzi.
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [unlocked]);

  if (!unlocked) {
    return <p className="rc-note">Odblokuj konto, aby zobaczyć swoje zgłoszenia.</p>;
  }

  if (failed) return <p className="rc-note">Nie udało się wczytać zgłoszeń.</p>;
  if (list === null) return <p className="rc-note">Wczytywanie…</p>;

  if (list.length === 0) {
    return (
      <p className="rc-note">
        Nie masz tu żadnego zgłoszenia. Jeśli wysłałeś je z linku, otwórz ten
        link i połącz zgłoszenie z kontem — wtedy pojawi się w tym miejscu.
      </p>
    );
  }

  return (
    <ul className="rc-mine">
      {list.map((one) => <Row key={one.candidateId} candidate={one} />)}
    </ul>
  );
}

function Row({ candidate }: { candidate: RcMyCandidate }) {
  const [parish, setParish] = useState<RcPrintParish | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slug = candidate.parishSlug ?? '';

  useEffect(() => {
    if (slug === '') return;
    let alive = true;
    void (async () => {
      try {
        const found = await rcPublicParish(slug);
        const site = rcReadSite(found.modules);
        if (!alive) return;
        setParish({
          name: found.name,
          address: site.content['contact.address'] ?? '',
          email: site.content['contact.email'] ?? '',
          leader: site.content['sacrament.confirmation.who'] ?? ''
        });
      } catch { if (alive) setParish(null); }
    })();
    return () => { alive = false; };
  }, [slug]);

  /*
   * Zapieczętowanego zgłoszenia nie ukrywamy. To, że jest, jest informacją —
   * a to, że nie da się go otworzyć, informacją tym bardziej.
   */
  if (candidate.unreadable !== null && candidate.unreadable !== undefined) {
    return (
      <li className="rc-mine-row" data-sealed="true">
        <span className="rc-mine-name"><em>zapieczętowane — brak klucza</em></span>
        <span className="rc-mine-group">{candidate.groupName}</span>
      </li>
    );
  }

  const name = [candidate.given, candidate.surname]
    .filter((part) => (part ?? '') !== '')
    .join(' ');

  const phones = rcPhones(candidate.contact ?? '');

  const fields = {
    given: candidate.given ?? '',
    surname: candidate.surname ?? '',
    born: candidate.born ?? '',
    phone: candidate.contact ?? '',
    address: candidate.address ?? '',
    school: candidate.school ?? ''
  };

  return (
    <li className="rc-mine-row">
      <span className="rc-mine-name">{name === '' ? '—' : name}</span>
      <span className="rc-mine-group">{candidate.groupName}</span>

      <ul className="rc-mine-facts">
        <li><span>Zgłoszenie</span><em>{STATUS[candidate.status ?? ''] ?? candidate.status}</em></li>
        <li>
          <span>Zgoda rodzica</span>
          <em>{candidate.paperReceived === true ? 'dostarczona' : 'czekamy na papier'}</em>
        </li>
        {(candidate.born ?? '') !== '' && (
          <li><span>Data urodzenia</span><em>{rcDay(candidate.born ?? '')}</em></li>
        )}
        {phones.map((one, index) => (
          <li key={one}><span>{index === 0 ? 'Telefon' : ''}</span><em>{one}</em></li>
        ))}
        {(candidate.address ?? '') !== '' && (
          <li><span>Adres</span><em className="rc-mine-lines">{candidate.address}</em></li>
        )}
        {(candidate.school ?? '') !== '' && (
          <li><span>Szkoła</span><em>{candidate.school}</em></li>
        )}
      </ul>

      <button
        type="button"
        className="rc-btn"
        onClick={() => {
          const ok = rcPrintApply(
            fields,
            parish ?? { name: '', address: '', email: '', leader: '' },
            candidate.groupName ?? ''
          );
          setError(ok ? null : 'Przeglądarka zablokowała nowe okno.');
        }}
      >
        Drukuj zgłoszenie i zgodę rodzica
      </button>

      {error !== null && <p className="rc-note">{error}</p>}
    </li>
  );
}

export default RcMyCandidates;
