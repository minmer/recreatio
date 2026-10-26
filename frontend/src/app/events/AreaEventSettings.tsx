/**
 * 0131 — IN FREMDEN LISTEN: worauf ein Bereich mit einer Art (Wydarzenie, Grupa …)
 * ausser seinen eigenen Listen noch stehen möchte — „Pokaż też na…", und der
 * Katalog recreatio.pl/events (dort entscheidet der Betreiber).
 *
 * 0133 — Hauptseite, Haupttermin, Bild und Rodzaj stehen jetzt im Profil
 * (`areas/AreaKindPanel.tsx`); hier blieb, was dorthin nicht gehört.
 */

import { useEffect, useState } from 'react';

import { WorkspaceError } from '../core/session';
import { pagePath } from '../routes';
import { toast } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import { askListing, CATALOGUE_PATH, loadListings, LISTING_WORDS, type Listing } from './events';

const failure = (e: unknown, fallback: string): string => (e instanceof WorkspaceError ? e.message : fallback);

/** Eine Adresse, wie man sie kopiert („recreatio.pl/#/parafia/wydarzenia?x"), als Pfad. */
export const listPathOf = (address: string): string => {
  const raw = address.trim();
  const at = raw.indexOf('#/');
  return (at >= 0 ? raw.slice(at + 2) : raw).split(/[?#]/)[0].replace(/^\/+|\/+$/g, '').toLowerCase();
};

/** Auf welchen fremden Listen der Bereich steht oder stehen möchte — und die Bitte um einen Platz. */
export function Listings({ areaId, editable }: { areaId: string; editable: boolean }) {
  const [list, setList] = useState<readonly Listing[] | 'failed' | null>(null);
  const [round, setRound] = useState(0);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadListings(areaId).then((out) => { if (alive) setList(out.listings); }, () => { if (alive) setList('failed'); });
    return () => { alive = false; };
  }, [areaId, round]);

  const askFor = async (path: string) => {
    if (path === '') { setFailed('Podaj adres strony z listą.'); return; }
    setBusy(true);
    setFailed(null);
    try {
      const out = await askListing(areaId, { path });
      toast(out.state === 'shown' ? 'Już jest na tej liście.'
        : out.catalogue ? 'Prośba wysłana — zdecyduje operator serwisu.'
        : 'Prośba wysłana — zdecyduje ten, kto prowadzi tę listę.', { kind: 'ok' });
      setAddress('');
      setRound((n) => n + 1);
    } catch (e) {
      setFailed(failure(e, 'Nie udało się wysłać prośby.'));
    } finally {
      setBusy(false);
    }
  };

  const inCatalogue = list !== null && list !== 'failed' && list.some((one) => one.path === CATALOGUE_PATH && one.state !== 'refused');

  return (
    <section className="wk-event-listings" aria-labelledby={`event-listings-${areaId}`}>
      <h2 className="wk-h2" id={`event-listings-${areaId}`}>Na innych listach</h2>
      {list === null ? <Loading lines={1} /> : list === 'failed' ? <p className="wk-error">Nie udało się wczytać list.</p> : list.length === 0 ? (
        <p className="wk-card-muted">Nie stoi jeszcze na żadnej obcej liście.</p>
      ) : (
        <ul className="wk-event-listing-rows">
          {list.map((one) => (
            <li key={one.moduleId} data-listing={one.state}>
              {one.path === null ? <span>lista bez strony</span> : <a className="wk-link" href={pagePath(one.path)}>recreatio.pl/{one.path}</a>}
              <span className={one.state === 'shown' ? 'wk-tag wk-tag-open' : 'wk-tag'}>{LISTING_WORDS[one.state]}</span>
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form className="wk-event-ask" onSubmit={(e) => { e.preventDefault(); void askFor(listPathOf(address)); }}>
          <label className="wk-field">
            <span>Pokaż też na…</span>
            <input value={address} disabled={busy} placeholder="adres strony z listą, np. recreatio.pl/#/parafia/wydarzenia" onChange={(e) => setAddress(e.target.value)} />
          </label>
          <div className="wk-actions">
            <button type="submit" className="wk-btn wk-btn-line wk-btn-small" disabled={busy || address.trim() === ''}>Poproś</button>
            {!inCatalogue && (
              <button type="button" className="wk-link-btn" disabled={busy} data-event-catalogue="" onClick={() => void askFor(CATALOGUE_PATH)}>
                Poproś o miejsce w katalogu recreatio.pl/{CATALOGUE_PATH} — decyduje operator serwisu
              </button>
            )}
          </div>
          {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
        </form>
      )}
    </section>
  );
}
