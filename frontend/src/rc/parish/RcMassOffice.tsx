/**
 * Kancelaria: msze i ich intencje.
 *
 * <b>Kto to widzi.</b> Osoba odpowiedzialna za msze — rola nadana przez
 * administratora, tak samo jak przy bierzmowaniu. Serwer i tak pyta o prawo do
 * obszaru przy każdym wywołaniu; to tutaj jest tylko oprawą.
 *
 * <b>Dlaczego dzień, a nie lista wszystkiego.</b> Intencje przyjmuje się i
 * czyta dniami. Lista „wszystkie intencje parafii" nie odpowiada na żadne
 * pytanie, które ktoś naprawdę zadaje — a pytanie „co jest w czwartek" zadaje
 * się codziennie.
 *
 * <b>Pojedyncza czy zbiorowa — to nie etykieta.</b> Kilka pojedynczych w jednej
 * mszy znaczy: kilku kapłanów koncelebruje, każdy ze swoją. Zbiorowa znaczy:
 * jeden kapłan czyta kilka razem. Dlatego przy pojedynczej pyta się o kapłana, a
 * przy zbiorowej nie — i dlatego dwie pojedyncze z tym samym kapłanem odbija
 * baza danych, a nie dobra wola.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  RC_INTENTION_KINDS, RC_KIND_LABEL, rcAddIntention, rcDayLabel, rcHour,
  rcIntentions, rcPublicMasses, rcUpdateIntention,
  type RcIntention, type RcIntentionKind, type RcPublicMass
} from './rcMass';
import { RcRequestError } from '../lib/rcApi';
import { rcHasUnlockPiece, rcMe } from '../lib/rcAuth';

export function RcMassOffice({ slug }: { slug: string }) {
  /*
   * OB DER SCHLUESSELBUND DA IST, FRAGT DIESE ANSICHT SELBST.
   *
   * Sie haette es sich reichen lassen koennen — aber dann muesste jede
   * Stelle, die sie einbaut, die Frage kennen und richtig beantworten. Eine
   * davon antwortet irgendwann falsch, und dann steht hier „keine Intencje"
   * statt „odblokuj konto": derselbe Bildschirm fuer zwei ganz verschiedene
   * Lagen.
   */
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const me = await rcMe();
        if (alive) setUnlocked(me.canOpen === true || rcHasUnlockPiece());
      } catch { if (alive) setUnlocked(false); }
    })();
    return () => { alive = false; };
  }, []);
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [masses, setMasses] = useState<readonly RcPublicMass[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const from = new Date(`${day}T00:00:00`);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);

      const found = await rcPublicMasses(slug, from, to);
      setMasses((found.masses ?? []).filter((m) => m.status !== 'cancelled'));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [slug, day]);

  useEffect(() => { void load(); }, [load]);

  if (unlocked === false) {
    return <p className="ps-muted">Odblokuj konto, aby zobaczyć i przyjmować intencje.</p>;
  }

  return (
    <div className="ps-stack mo">
      <label className="mo-day">
        <span>Dzień</span>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </label>

      {failed && <p className="ap-error">Nie udało się wczytać planu.</p>}

      {masses !== null && masses.length === 0 && (
        <article className="ps-card ps-card-note">
          <h2>Brak mszy</h2>
          <p>
            Tego dnia nie ma żadnej mszy w planie. Msze zakłada się w kalendarzu
            jako wpisy powtarzające się — jeden wpis „w dni powszednie o 18:00"
            daje msze na wszystkie te dni.
          </p>
        </article>
      )}

      {(masses ?? []).map((mass) => (
        <MassCard key={mass.startsUtc} mass={mass} onChanged={() => void load()} />
      ))}
    </div>
  );
}

/* -- Jedna msza ------------------------------------------------------------ */

function MassCard({ mass, onChanged }: { mass: RcPublicMass; onChanged: () => void }) {
  const [list, setList] = useState<readonly RcIntention[] | null>(null);
  const [sealed, setSealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const found = await rcIntentions(mass.itemId, mass.startsUtc);
      setList(found.intentions ?? []);
      setSealed((found.intentions ?? []).some((i) => (i.unreadable ?? null) !== null));
    } catch {
      setList([]);
    }
  }, [mass.itemId, mass.startsUtc]);

  useEffect(() => { void load(); }, [load]);

  const singles = (list ?? []).filter((i) => i.kind === 'single' && i.status !== 'cancelled');

  return (
    <article className="ps-card mo-mass">
      <header className="mo-head">
        <strong>{rcHour(mass.startsUtc)}</strong>
        {/* Koniec stoi obok początku: msza zajmuje kościół, a kto planuje po
            niej chrzest, musi wiedzieć do której. */}
        <span className="ms-till">do {rcHour(mass.endsUtc)}</span>
        {(mass.title ?? '') !== '' && <span className="ms-title">{mass.title}</span>}
        <span className="mo-day-label">{rcDayLabel(mass.startsUtc)}</span>
      </header>

      {sealed && (
        <p className="ps-muted">
          Część danych jest zapieczętowana — temu kontu brakuje klucza obszaru.
          Treść intencji widać, ofiarodawcę nie.
        </p>
      )}

      {/*
        Ile kapłanów trzeba. To jest pytanie, dla którego w ogóle istnieje
        rozróżnienie na pojedynczą i zbiorową — więc stoi wprost, a nie do
        policzenia z listy.
      */}
      {singles.length > 1 && (
        <p className="mo-need">
          {singles.length} intencje pojedyncze — potrzeba {singles.length} kapłanów,
          każdy ze swoją.
        </p>
      )}

      <ul className="mo-ints">
        {(list ?? []).map((one) => (
          <IntentionRow
            key={one.intentionId}
            intention={one}
            onChanged={() => { void load(); onChanged(); }}
          />
        ))}
      </ul>

      {(list ?? []).length === 0 && <p className="ps-muted">Bez intencji.</p>}

      <AddForm
        itemId={mass.itemId}
        occurrenceAt={mass.startsUtc}
        onAdded={() => { void load(); onChanged(); setError(null); }}
        onError={setError}
      />

      {error !== null && <p className="ap-error">{error}</p>}
    </article>
  );
}

/* -- Jedna intencja -------------------------------------------------------- */

function IntentionRow({
  intention, onChanged
}: {
  intention: RcIntention;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const cancelled = intention.status === 'cancelled';

  const withdraw = async () => {
    setBusy(true);
    try {
      await rcUpdateIntention(intention.intentionId, {
        status: cancelled ? 'accepted' : 'cancelled'
      });
      onChanged();
    } finally { setBusy(false); }
  };

  return (
    <li className="mo-int" data-cancelled={cancelled}>
      <span className="mo-int-text">{intention.text}</span>

      <span className="mo-int-kind">
        {RC_KIND_LABEL[intention.kind as RcIntentionKind] ?? intention.kind}
      </span>

      {/*
        Ofiarodawca i ofiara są zapieczętowane i widzi je tylko kancelaria. Nie
        trafiają na wydruk ani na stronę — dlatego stoją tu, a nigdzie indziej.
      */}
      {(intention.giver ?? '') !== '' && (
        <span className="mo-int-giver">{intention.giver}</span>
      )}
      {(intention.offering ?? '') !== '' && (
        <span className="mo-int-offering">{intention.offering}</span>
      )}

      <button type="button" className="ps-edit" disabled={busy} onClick={() => void withdraw()}>
        {cancelled ? 'Przywróć' : 'Wycofaj'}
      </button>
    </li>
  );
}

/* -- Przyjęcie nowej ------------------------------------------------------- */

function AddForm({
  itemId, occurrenceAt, onAdded, onError
}: {
  itemId: string;
  occurrenceAt: string;
  onAdded: () => void;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<RcIntentionKind>('single');
  const [giver, setGiver] = useState('');
  const [offering, setOffering] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (text.trim() === '') return;
    setBusy(true);
    onError(null);
    try {
      await rcAddIntention(itemId, occurrenceAt, {
        text: text.trim(),
        kind,
        giver: giver.trim(),
        offering: offering.trim()
      });
      setText(''); setGiver(''); setOffering('');
      onAdded();
    } catch (e) {
      /*
        Serwer odpowiada 409, gdy ten sam kapłan miałby dwie pojedyncze w
        jednej mszy. To nie jest usterka, tylko reguła — i tak trzeba ją
        powiedzieć, żeby ktoś nie klikał drugi raz.
      */
      onError(e instanceof RcRequestError && e.status === 409
        ? e.error.message
        : 'Nie udało się przyjąć intencji.');
    } finally { setBusy(false); }
  };

  return (
    <div className="mo-add">
      <label className="mo-field mo-wide">
        <span>Treść — czytana na głos</span>
        <input
          type="text"
          value={text}
          maxLength={400}
          placeholder="Za śp. Jana Kowalskiego"
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      <label className="mo-field">
        <span>Rodzaj</span>
        <select value={kind} disabled={busy} onChange={(e) => setKind(e.target.value as RcIntentionKind)}>
          {RC_INTENTION_KINDS.map((one) => (
            <option key={one} value={one}>{RC_KIND_LABEL[one]}</option>
          ))}
        </select>
      </label>

      <label className="mo-field">
        <span>Ofiarodawca</span>
        <input
          type="text"
          value={giver}
          disabled={busy}
          onChange={(e) => setGiver(e.target.value)}
        />
      </label>

      <label className="mo-field">
        <span>Ofiara</span>
        <input
          type="text"
          value={offering}
          disabled={busy}
          onChange={(e) => setOffering(e.target.value)}
        />
      </label>

      <p className="ps-muted mo-note">
        Treść jest jawna — trafia do gabloty i na stronę. Ofiarodawca i ofiara
        zostają zapieczętowane i widzi je tylko kancelaria.
      </p>

      <button
        type="button"
        className="ps-signin"
        disabled={busy || text.trim() === ''}
        onClick={() => void send()}
      >
        {busy ? 'Przyjmowanie…' : 'Przyjmij intencję'}
      </button>
    </div>
  );
}

export default RcMassOffice;
