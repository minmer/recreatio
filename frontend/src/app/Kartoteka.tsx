/**
 * KARTOTEKA I KOLĘDA (0071) — die Adressen eines Gebiets, die Familien
 * darin, und der Besuch Jahr für Jahr.
 *
 * <code>
 *   #/workspace/registry                 welches Gebiet (ein Bereich: die Pfarrei)
 *   #/workspace/registry/<bereich>       Adresy · Kolęda · Import i JSON
 * </code>
 *
 * <b>Die Adresse ist offen, die Familie versiegelt.</b> Dass es das Haus
 * Długa 5 gibt, sagt nichts über Menschen; wer dort wohnt, und ob er die
 * Kolęda empfangen hat, liegt unter dem Schlüssel des Bereichs. Gefiltert wird
 * hier, im Browser, der die Kartoteka ganz hält.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { loadAreas, type AreaRow } from './area';
import { JsonPanel } from './JsonPanel';
import { Modal } from './Modal';
import {
  deleteHousehold, deletePlace, EMPTY_ADDRESS, EMPTY_HOUSEHOLD, formatAddress, keyOf, loadRegistry, openHouseholds,
  parseAddress, placeOrder, placesOf, saveHousehold, savePlaces, VISIT_LABEL,
  type Address, type Household, type HouseholdDoc, type Place, type VisitStatus
} from './postal';
import { exportRegistry, planRegistryImport, registryDescription } from './postalJson';
import { PostalInput } from './PostalInput';
import { keysFor } from './ringOf';
import { viewPath } from './routes';
import { WorkspaceError, type Who } from './session';
import type { Ring } from './keys';
import { Unlock } from './Unlock';
import { AreaOptions } from './AreaOptions';
import { TidyEverything } from './TidyEverything';

type Tab = 'addresses' | 'kolenda' | 'import';

/** Die Kolęda eines Winters heisst nach dem Jahr, in dem sie meistens stattfindet: ab September die nächste. */
export const kolendaYear = (now = new Date()): string => String(now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear());

const norm = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

export function Kartoteka({ who, trail }: { who: Who; trail: readonly string[] }) {
  const [areas, setAreas] = useState<readonly AreaRow[] | null>(null);
  const [ring, setRing] = useState<Ring | null | undefined>(undefined);
  const areaId = trail[0] ?? null;

  const look = useCallback(async () => {
    const [found, keys] = await Promise.all([loadAreas().catch(() => ({ areas: [] as readonly AreaRow[] })), keysFor(who).catch(() => ({ ring: null }))]);
    setAreas(found.areas.filter((a) => a.personal !== true && a.myLevel !== null));
    setRing(keys.ring);
  }, [who]);
  useEffect(() => { void look(); }, [look]);

  if (areas === null || ring === undefined) return <p className="wk-lede">Wczytywanie…</p>;
  if (ring === null) return <Unlock who={who} why="Rodziny w kartotece są zaszyfrowane — podaj hasło." onDone={() => void look()} />;

  const area = areaId === null ? null : areas.find((a) => a.areaId === areaId) ?? null;

  return (
    <div className="wk-registry">
      <label className="wk-field wk-registry-area">
        <span>Kartoteka obszaru</span>
        <select value={areaId ?? ''} onChange={(e) => { window.location.hash = e.target.value === '' ? viewPath('registry') : viewPath('registry', e.target.value); }}>
          <option value="">— wybierz obszar (np. parafię) —</option>
          <AreaOptions areas={areas} only={areas} />
        </select>
      </label>
      {area === null ? (
        <p className="wk-lede">
          Kartoteka to adresy jednego obszaru — np. parafii — i rodziny pod nimi. Adresy są wspólne dla wszystkich,
          którzy prowadzą obszar; dane rodzin szyfruje kluczem obszaru Twoja przeglądarka.
        </p>
      ) : <Registry key={area.areaId} area={area} ring={ring} />}

      {/* 0082 — dieselbe eine Form für jede Adresse der Datenbank, nicht nur die der Kartoteka. */}
      <TidyEverything ring={ring} />
    </div>
  );
}

function Registry({ area, ring }: { area: AreaRow; ring: Ring }) {
  const [tab, setTab] = useState<Tab>('addresses');
  const [places, setPlaces] = useState<readonly Place[] | null>(null);
  const [households, setHouseholds] = useState<readonly Household[]>([]);
  const [mayWrite, setMayWrite] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ place: Place | null; household: Household | null } | null>(null);

  const reload = useCallback(async () => {
    try {
      const registry = await loadRegistry(area.areaId);
      setPlaces(placesOf(registry).sort(placeOrder));
      setHouseholds(await openHouseholds(ring, area.areaId, registry.households));
      setMayWrite(registry.mayWrite);
      setFailed(null);
    } catch (e) {
      setPlaces([]);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać kartoteki.');
    }
  }, [area.areaId, ring]);
  useEffect(() => { void reload(); }, [reload]);

  if (places === null) return <p className="wk-hint">Wczytywanie kartoteki…</p>;

  const byPlace = new Map(households.filter((h) => h.placeId !== null).map((h) => [h.placeId!, h]));

  return (
    <>
      <div className="wk-tabs" role="tablist">
        {([['addresses', `Adresy (${places.length})`], ['kolenda', 'Kolęda'], ['import', 'Import i JSON']] as const).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'wk-tab wk-tab-on' : 'wk-tab'}
            onClick={() => setTab(value)}>{label}</button>
        ))}
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}

      {tab === 'addresses' && (
        <Addresses places={places} byPlace={byPlace} mayWrite={mayWrite} areaId={area.areaId}
          onEdit={(place) => setEditing({ place, household: place === null ? null : byPlace.get(place.placeId) ?? null })}
          onChanged={reload} />
      )}
      {tab === 'kolenda' && (
        <Kolenda places={places} byPlace={byPlace} mayWrite={mayWrite} ring={ring} areaId={area.areaId} onChanged={reload}
          onEdit={(place) => setEditing({ place, household: byPlace.get(place.placeId) ?? null })} />
      )}
      {tab === 'import' && (
        <ImportTab area={area} ring={ring} places={places} households={households} mayWrite={mayWrite} onChanged={reload} />
      )}

      {editing !== null && (
        <HouseholdDialog area={area} ring={ring} place={editing.place} household={editing.household} mayWrite={mayWrite}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />
      )}
    </>
  );
}

/* -- Adresy --------------------------------------------------------------------------------------- */

function Addresses({ places, byPlace, mayWrite, areaId, onEdit, onChanged }: {
  places: readonly Place[];
  byPlace: ReadonlyMap<string, Household>;
  mayWrite: boolean;
  areaId: string;
  onEdit: (place: Place | null) => void;
  onChanged: () => Promise<void>;
}) {
  const [locality, setLocality] = useState('');
  const [street, setStreet] = useState('');
  const [district, setDistrict] = useState('');
  const [query, setQuery] = useState('');
  const [empty, setEmpty] = useState(false);
  const [bulk, setBulk] = useState(false);

  const localities = useMemo(() => [...new Set(places.map((p) => p.locality).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [places]);
  const streets = useMemo(() => [...new Set(places.filter((p) => locality === '' || p.locality === locality).map((p) => p.street).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [places, locality]);
  const districts = useMemo(() => [...new Set(places.map((p) => p.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [places]);

  const q = norm(query.trim());
  const shown = places.filter((p) => {
    if (locality !== '' && p.locality !== locality) return false;
    if (street !== '' && p.street !== street) return false;
    if (district !== '' && p.district !== district) return false;
    const h = byPlace.get(p.placeId);
    if (empty && h !== undefined) return false;
    if (q !== '') {
      const hay = norm([formatAddress(p), h?.family ?? '', ...(h?.people.map((x) => x.name) ?? []), ...(h?.tags ?? [])].join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  /* Nach Straße gruppiert — so geht man sie ab. */
  const groups = new Map<string, Place[]>();
  for (const p of shown) {
    const g = [p.locality, p.street].filter(Boolean).join(', ') || 'bez ulicy';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(p);
  }

  return (
    <div className="wk-panel">
      <div className="wk-registry-filters">
        <label className="wk-field"><span>Miejscowość</span>
          <select value={locality} onChange={(e) => { setLocality(e.target.value); setStreet(''); }}>
            <option value="">wszystkie</option>{localities.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="wk-field"><span>Ulica</span>
          <select value={street} onChange={(e) => setStreet(e.target.value)}>
            <option value="">wszystkie</option>{streets.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {districts.length > 0 && (
          <label className="wk-field"><span>Dzielnica</span>
            <select value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">wszystkie</option>{districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        )}
        <label className="wk-field"><span>Szukaj</span>
          <input value={query} placeholder="adres, nazwisko, etykieta" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="wk-check"><input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} /> <span>tylko bez rodziny</span></label>
      </div>

      {mayWrite && (
        <div className="wk-actions">
          <button type="button" className="wk-btn" onClick={() => onEdit(null)}>+ Adres</button>
          <button type="button" className="wk-link-btn" onClick={() => setBulk(true)}>+ Wiele numerów na ulicy…</button>
        </div>
      )}

      <p className="wk-hint">{shown.length} z {places.length} adresów · rodzin: {[...byPlace.keys()].length}</p>

      {[...groups].map(([name, list]) => (
        <section key={name} className="wk-registry-street">
          <h3 className="wk-h3">{name} <span className="wk-hint">({list.length})</span></h3>
          <ul className="wk-registry-list">
            {list.map((p) => {
              const h = byPlace.get(p.placeId);
              return (
                <li key={p.placeId}>
                  <button type="button" className="wk-registry-row" onClick={() => onEdit(p)}>
                    <span className="wk-registry-no">{p.house}{p.unit !== '' ? `/${p.unit}` : ''}</span>
                    <span>{h === undefined ? <em className="wk-hint">bez rodziny</em> : <strong>{h.family || h.people[0]?.name || 'rodzina'}</strong>}
                      {h !== undefined && h.people.length > 0 && <span className="wk-hint"> · {h.people.length} os.</span>}
                      {h?.tags.map((t) => <span key={t} className="wk-tag">{t}</span>)}
                    </span>
                    {p.postcode !== '' && <span className="wk-hint">{p.postcode}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {places.length === 0 && <p className="wk-empty">Kartoteka jest pusta. Dodaj adresy pojedynczo, całą ulicę naraz albo wklej listę w „Import i JSON".</p>}

      {bulk && <BulkNumbers areaId={areaId} onClose={() => setBulk(false)} onDone={() => { setBulk(false); void onChanged(); }} />}
    </div>
  );
}

/** Eine ganze Straße auf einmal: Nummern von–bis, gerade/ungerade, mit Wohnungen. */
function BulkNumbers({ areaId, onClose, onDone }: { areaId: string; onClose: () => void; onDone: () => void }) {
  const [base, setBase] = useState<Address>(EMPTY_ADDRESS);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(20);
  const [step, setStep] = useState<'all' | 'odd' | 'even'>('all');
  const [units, setUnits] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const numbers: string[] = [];
  for (let n = Math.max(1, from); n <= Math.min(to, from + 999); n += 1) {
    if (step === 'odd' && n % 2 === 0) continue;
    if (step === 'even' && n % 2 === 1) continue;
    numbers.push(String(n));
  }
  const all: Address[] = numbers.flatMap((house) => units > 0
    ? Array.from({ length: units }, (_, i) => ({ ...base, house, unit: String(i + 1) }))
    : [{ ...base, house, unit: '' }]);

  return (
    <Modal title="Wiele numerów na jednej ulicy" wide onClose={onClose}>
      <form className="wk-form" onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setFailed(null);
        void savePlaces(areaId, all).then(onDone)
          .catch((err) => setFailed(err instanceof WorkspaceError ? err.message : 'Nie udało się.'))
          .finally(() => setBusy(false));
      }}>
        <PostalInput compact parts={base} onParts={(p) => setBase({ ...p, house: '', unit: '' })} />
        <div className="wk-ev-when-row">
          <label className="wk-field"><span>Od nr</span><input type="number" min={1} value={from} onChange={(e) => setFrom(Number(e.target.value) || 1)} /></label>
          <label className="wk-field"><span>Do nr</span><input type="number" min={1} value={to} onChange={(e) => setTo(Number(e.target.value) || 1)} /></label>
          <label className="wk-field"><span>Numery</span>
            <select value={step} onChange={(e) => setStep(e.target.value as typeof step)}>
              <option value="all">wszystkie</option><option value="odd">nieparzyste</option><option value="even">parzyste</option>
            </select>
          </label>
          <label className="wk-field"><span>Mieszkań w domu</span><input type="number" min={0} max={200} value={units} onChange={(e) => setUnits(Math.max(0, Number(e.target.value) || 0))} /></label>
        </div>
        <p className="wk-hint">Powstanie {all.length} adresów{all.length > 0 ? `, np. ${formatAddress(all[0])}` : ''}. Te, które już są, nie powstaną drugi raz.</p>
        {failed !== null && <p className="wk-error">{failed}</p>}
        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy || all.length === 0 || base.street === '' && base.locality === ''}>{busy ? 'Zapisywanie…' : 'Dodaj'}</button>
          <button type="button" className="wk-link-btn" onClick={onClose}>Anuluj</button>
        </div>
      </form>
    </Modal>
  );
}

/* -- Eine Familie ------------------------------------------------------------------------------------ */

function HouseholdDialog({ area, ring, place, household, mayWrite, onClose, onSaved }: {
  area: AreaRow; ring: Ring; place: Place | null; household: Household | null; mayWrite: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const [address, setAddress] = useState<Address>(place ?? EMPTY_ADDRESS);
  const [doc, setDoc] = useState<HouseholdDoc>(household ?? EMPTY_HOUSEHOLD);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const year = kolendaYear();
  const years = [...new Set([year, ...Object.keys(doc.kolenda)])].sort().reverse();
  const hasFamily = household !== null || doc.family !== '' || doc.people.length > 0;

  const set = (patch: Partial<HouseholdDoc>) => setDoc((was) => ({ ...was, ...patch }));

  const save = async () => {
    setBusy(true);
    setFailed(null);
    try {
      let placeId = place?.placeId ?? null;
      if (place === null || keyOf(address) !== keyOf(place)) {
        const done = await savePlaces(area.areaId, [{ ...address, ...(place === null ? {} : { placeId: place.placeId }) }]);
        placeId = done.places[0]?.placeId ?? placeId;
      }
      if (hasFamily) {
        await saveHousehold(ring, area.areaId, doc, placeId, household === null ? undefined : { householdId: household.householdId, version: household.version });
      }
      onSaved();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={place === null ? 'Nowy adres' : formatAddress(place)} wide onClose={onClose}>
      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); if (mayWrite) void save(); }}>
        <fieldset className="wk-field"><legend>Adres</legend>
          <PostalInput compact parts={address} onParts={setAddress} />
        </fieldset>

        <fieldset className="wk-field"><legend>Rodzina</legend>
          <label className="wk-field"><span>Nazwisko rodziny</span>
            <input value={doc.family} placeholder="np. Kowalscy" disabled={!mayWrite} onChange={(e) => set({ family: e.target.value })} />
          </label>
          <ul className="wk-registry-people">
            {doc.people.map((person, i) => (
              <li key={i} className="wk-ev-when-row">
                <input value={person.name} placeholder="Imię i nazwisko" disabled={!mayWrite}
                  onChange={(e) => set({ people: doc.people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <input type="date" value={person.born ?? ''} disabled={!mayWrite}
                  onChange={(e) => set({ people: doc.people.map((x, j) => (j === i ? { ...x, born: e.target.value } : x)) })} />
                <input value={person.note ?? ''} placeholder="uwaga (np. chory, komunia)" disabled={!mayWrite}
                  onChange={(e) => set({ people: doc.people.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} />
                {mayWrite && <button type="button" className="wk-link-btn" onClick={() => set({ people: doc.people.filter((_, j) => j !== i) })}>Usuń</button>}
              </li>
            ))}
          </ul>
          {mayWrite && <button type="button" className="wk-link-btn" onClick={() => set({ people: [...doc.people, { name: '' }] })}>+ Osoba</button>}
          <div className="wk-ev-when-row">
            <label className="wk-field"><span>Telefon</span><input value={doc.phone} disabled={!mayWrite} onChange={(e) => set({ phone: e.target.value })} /></label>
            <label className="wk-field"><span>E-mail</span><input value={doc.email} disabled={!mayWrite} onChange={(e) => set({ email: e.target.value })} /></label>
          </div>
          <label className="wk-field"><span>Etykiety (po przecinku)</span>
            <input value={doc.tags.join(', ')} placeholder="np. chorzy, rodzina z dziećmi" disabled={!mayWrite}
              onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
          </label>
          <label className="wk-field"><span>Notatki</span><textarea rows={3} value={doc.notes} disabled={!mayWrite} onChange={(e) => set({ notes: e.target.value })} /></label>
        </fieldset>

        <fieldset className="wk-field"><legend>Kolęda</legend>
          {years.map((y) => {
            const visit = doc.kolenda[y];
            return (
              <div key={y} className="wk-ev-when-row">
                <strong>{y}</strong>
                <select value={visit?.status ?? ''} disabled={!mayWrite} onChange={(e) => {
                  const next = { ...doc.kolenda };
                  if (e.target.value === '') delete next[y]; else next[y] = { ...visit, status: e.target.value as VisitStatus };
                  set({ kolenda: next });
                }}>
                  <option value="">—</option>
                  {(Object.keys(VISIT_LABEL) as VisitStatus[]).map((s) => <option key={s} value={s}>{VISIT_LABEL[s]}</option>)}
                </select>
                <input type="date" value={visit?.date ?? ''} disabled={!mayWrite || visit === undefined}
                  onChange={(e) => set({ kolenda: { ...doc.kolenda, [y]: { ...visit!, date: e.target.value } } })} />
                <input value={visit?.priest ?? ''} placeholder="kapłan" disabled={!mayWrite || visit === undefined}
                  onChange={(e) => set({ kolenda: { ...doc.kolenda, [y]: { ...visit!, priest: e.target.value } } })} />
                <input value={visit?.note ?? ''} placeholder="uwaga" disabled={!mayWrite || visit === undefined}
                  onChange={(e) => set({ kolenda: { ...doc.kolenda, [y]: { ...visit!, note: e.target.value } } })} />
              </div>
            );
          })}
        </fieldset>

        {failed !== null && <p className="wk-error">{failed}</p>}
        <div className="wk-actions">
          {mayWrite && <button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>}
          <button type="button" className="wk-link-btn" onClick={onClose}>Zamknij</button>
          {mayWrite && household !== null && (
            <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => {
              if (window.confirm('Usunąć rodzinę spod tego adresu? Adres zostaje.')) void deleteHousehold(household.householdId).then(onSaved);
            }}>Usuń rodzinę</button>
          )}
          {mayWrite && place !== null && household === null && (
            <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => {
              if (window.confirm('Usunąć ten adres z kartoteki?')) void deletePlace(place.placeId).then(onSaved);
            }}>Usuń adres</button>
          )}
        </div>
      </form>
    </Modal>
  );
}

/* -- Kolęda ---------------------------------------------------------------------------------------- */

function Kolenda({ places, byPlace, mayWrite, ring, areaId, onChanged, onEdit }: {
  places: readonly Place[]; byPlace: ReadonlyMap<string, Household>; mayWrite: boolean; ring: Ring; areaId: string;
  onChanged: () => Promise<void>; onEdit: (place: Place) => void;
}) {
  const [year, setYear] = useState(kolendaYear());
  const [status, setStatus] = useState<'' | 'none' | VisitStatus>('');
  const [street, setStreet] = useState('');
  const [date, setDate] = useState('');
  const [priest, setPriest] = useState('');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [planDate, setPlanDate] = useState('');
  const [planPriest, setPlanPriest] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const visitOf = (p: Place) => byPlace.get(p.placeId)?.kolenda[year];
  const streets = [...new Set(places.map((p) => p.street).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));
  const priests = [...new Set([...byPlace.values()].map((h) => h.kolenda[year]?.priest ?? '').filter(Boolean))].sort();
  const dates = [...new Set([...byPlace.values()].map((h) => h.kolenda[year]?.date ?? '').filter(Boolean))].sort();

  const shown = places.filter((p) => {
    const v = visitOf(p);
    if (status === 'none' && v !== undefined) return false;
    if (status !== '' && status !== 'none' && v?.status !== status) return false;
    if (street !== '' && p.street !== street) return false;
    if (date !== '' && v?.date !== date) return false;
    if (priest !== '' && v?.priest !== priest) return false;
    return true;
  }).sort((a, b) => (visitOf(a)?.date ?? '9999').localeCompare(visitOf(b)?.date ?? '9999') || placeOrder(a, b));

  const counts = new Map<string, number>();
  for (const p of places) { const s = visitOf(p)?.status ?? 'none'; counts.set(s, (counts.get(s) ?? 0) + 1); }

  /* Den Besuch vieler Haushalte auf einmal setzen — für Orte ohne Familie entsteht ein leerer Haushalt. */
  const setMany = async (ids: readonly string[], visit: (was: HouseholdDoc['kolenda'][string] | undefined) => HouseholdDoc['kolenda'][string] | null) => {
    setBusy(true);
    setFailed(null);
    try {
      for (const placeId of ids) {
        const h = byPlace.get(placeId);
        const doc: HouseholdDoc = h ?? EMPTY_HOUSEHOLD;
        const next = visit(doc.kolenda[year]);
        const kolenda = { ...doc.kolenda };
        if (next === null) delete kolenda[year]; else kolenda[year] = next;
        await saveHousehold(ring, areaId, { ...doc, kolenda }, placeId, h === undefined ? undefined : { householdId: h.householdId, version: h.version });
      }
      setPicked(new Set());
      await onChanged();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wk-panel wk-kolenda">
      <div className="wk-registry-filters">
        <label className="wk-field"><span>Rok</span>
          <input type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
        <label className="wk-field"><span>Stan</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">wszystkie</option><option value="none">bez wpisu</option>
            {(Object.keys(VISIT_LABEL) as VisitStatus[]).map((s) => <option key={s} value={s}>{VISIT_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="wk-field"><span>Ulica</span>
          <select value={street} onChange={(e) => setStreet(e.target.value)}>
            <option value="">wszystkie</option>{streets.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="wk-field"><span>Dzień</span>
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="">wszystkie</option>{dates.map((d) => <option key={d} value={d}>{new Date(d).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}
          </select>
        </label>
        <label className="wk-field"><span>Kapłan</span>
          <select value={priest} onChange={(e) => setPriest(e.target.value)}>
            <option value="">wszyscy</option>{priests.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <p className="wk-kolenda-sum">
        {[['none', 'bez wpisu'], ...Object.entries(VISIT_LABEL)].map(([s, label]) => (
          <span key={s} className="wk-tag">{label}: {counts.get(s) ?? 0}</span>
        ))}
      </p>

      {mayWrite && picked.size > 0 && (
        <div className="wk-kolenda-bulk">
          <strong>Zaznaczone: {picked.size}</strong>
          <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
          <input value={planPriest} placeholder="kapłan" onChange={(e) => setPlanPriest(e.target.value)} />
          <button type="button" className="wk-btn" disabled={busy || planDate === ''}
            onClick={() => void setMany([...picked], (was) => ({ ...was, status: was?.status === 'visited' ? 'visited' : 'planned', date: planDate, ...(planPriest !== '' ? { priest: planPriest } : {}) }))}>
            Zaplanuj
          </button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void setMany([...picked], () => null)}>Wyczyść wpis</button>
          <button type="button" className="wk-link-btn" onClick={() => setPicked(new Set())}>Odznacz</button>
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="button" className="wk-link-btn" onClick={() => window.print()}>Drukuj listę</button>
        {mayWrite && <button type="button" className="wk-link-btn" onClick={() => setPicked(new Set(shown.map((p) => p.placeId)))}>Zaznacz widoczne ({shown.length})</button>}
      </div>

      <table className="wk-kolenda-table">
        <thead><tr>{mayWrite && <th />}<th>Adres</th><th>Rodzina</th><th>Dzień</th><th>Kapłan</th><th>Stan</th></tr></thead>
        <tbody>
          {shown.map((p) => {
            const h = byPlace.get(p.placeId);
            const v = visitOf(p);
            return (
              <tr key={p.placeId} className={v === undefined ? '' : `is-${v.status}`}>
                {mayWrite && <td><input type="checkbox" checked={picked.has(p.placeId)} aria-label="zaznacz" onChange={(e) => setPicked((was) => {
                  const next = new Set(was); if (e.target.checked) next.add(p.placeId); else next.delete(p.placeId); return next;
                })} /></td>}
                <td><button type="button" className="wk-link-btn" onClick={() => onEdit(p)}>{[p.street || p.locality, `${p.house}${p.unit !== '' ? `/${p.unit}` : ''}`].filter(Boolean).join(' ')}</button></td>
                <td>{h?.family || h?.people[0]?.name || <span className="wk-hint">—</span>}{h?.tags.map((t) => <span key={t} className="wk-tag">{t}</span>)}</td>
                <td>{v?.date === undefined ? '' : new Date(v.date).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                <td>{v?.priest ?? ''}</td>
                <td>
                  {mayWrite ? (
                    <select value={v?.status ?? ''} disabled={busy} onChange={(e) => void setMany([p.placeId], (was) => e.target.value === '' ? null : { ...was, status: e.target.value as VisitStatus })}>
                      <option value="">—</option>
                      {(Object.keys(VISIT_LABEL) as VisitStatus[]).map((s) => <option key={s} value={s}>{VISIT_LABEL[s]}</option>)}
                    </select>
                  ) : v === undefined ? '—' : VISIT_LABEL[v.status]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shown.length === 0 && <p className="wk-empty">Nic nie pasuje do wybranych filtrów.</p>}
    </div>
  );
}

/* -- Import --------------------------------------------------------------------------------------- */

function ImportTab({ area, ring, places, households, mayWrite, onChanged }: {
  area: AreaRow; ring: Ring; places: readonly Place[]; households: readonly Household[]; mayWrite: boolean; onChanged: () => Promise<void>;
}) {
  const [lines, setLines] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const parsed = lines.split('\n').map((l) => l.trim()).filter(Boolean).map(parseAddress);

  return (
    <div className="wk-panel">
      {mayWrite && (
        <section>
          <h3 className="wk-h3">Wklej adresy — jeden w wierszu</h3>
          <textarea rows={8} value={lines} placeholder={'ul. Długa 5/3, 31-147 Kraków\nDługa 7, Kraków\nZawoja 1234, 34-222 Zawoja'} onChange={(e) => setLines(e.target.value)} />
          {parsed.length > 0 && (
            <ul className="wk-registry-preview">
              {parsed.slice(0, 8).map((a, i) => <li key={i}>{formatAddress(a)} <span className="wk-hint">({[a.street && `ulica: ${a.street}`, a.house && `nr ${a.house}${a.unit ? `/${a.unit}` : ''}`, a.locality && `miejsc.: ${a.locality}`, a.postcode].filter(Boolean).join(', ')})</span></li>)}
              {parsed.length > 8 && <li className="wk-hint">… i {parsed.length - 8} więcej</li>}
            </ul>
          )}
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy || parsed.length === 0} onClick={() => {
              setBusy(true);
              void savePlaces(area.areaId, parsed)
                .then((r) => { setNote(`Zapisano: ${r.places.filter((p) => !p.merged).length} nowych, ${r.places.filter((p) => p.merged).length} już było.`); setLines(''); return onChanged(); })
                .catch((e) => setNote(e instanceof WorkspaceError ? e.message : 'Nie udało się.'))
                .finally(() => setBusy(false));
            }}>Dodaj {parsed.length} adresów</button>
          </div>
          {note !== null && <p className="wk-note">{note}</p>}
        </section>
      )}

      <JsonPanel
        summary="Kartoteka jako JSON"
        lead={<>Adresy z rodzinami i kolędą — do kopii, do poprawy ręcznie albo przez AI. Import rozpoznaje adresy po ich częściach; rodziny uzupełnia.</>}
        fileName={`kartoteka-${area.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.json`}
        exportDoc={() => exportRegistry(area.name, places, households)}
        description={registryDescription}
        preview={(doc) => {
          const plan = planRegistryImport(doc, places, households);
          return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
        }}
        importLabel={mayWrite ? 'Importuj do kartoteki' : 'Tylko odczyt'}
        onImport={async (doc, stage) => {
          if (!mayWrite) throw new WorkspaceError('Tę kartotekę możesz tylko czytać.');
          const plan = planRegistryImport(doc, places, households);
          if ('error' in plan) throw new WorkspaceError(plan.error);
          stage('Zapisywanie adresów…');
          const fresh = plan.rows.filter((r) => r.placeId === null).map((r) => r.address);
          const saved = new Map<string, string>();
          for (let i = 0; i < fresh.length; i += 500) {
            const done = await savePlaces(area.areaId, fresh.slice(i, i + 500));
            done.places.forEach((p) => saved.set(p.key, p.placeId));
          }
          stage('Zapisywanie rodzin…');
          for (const row of plan.rows) {
            if (row.household === null) continue;
            const placeId = row.placeId ?? saved.get(keyOf(row.address)) ?? null;
            const base: HouseholdDoc = row.existing ?? EMPTY_HOUSEHOLD;
            await saveHousehold(ring, area.areaId, { ...base, ...row.household }, placeId,
              row.existing === null ? undefined : { householdId: row.existing.householdId, version: row.existing.version });
          }
          await onChanged();
          return { lines: plan.lines, warnings: plan.warnings };
        }}
      />
    </div>
  );
}

export default Kartoteka;
