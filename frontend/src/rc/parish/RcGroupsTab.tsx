/**
 * „Wspólnoty" — die Gruppen einer Pfarrei, als Liste und als Gruendungsstelle.
 *
 * <b>Diese Seite hat zwei Leser, und sie sind sich nicht aehnlich.</b>
 *
 *   * Jemand, der eine Gruppe SUCHT. Er ist meist nicht angemeldet, hat den
 *     Aushang im Schaukasten gelesen und will wissen, wann sich die Schola
 *     trifft. Fuer ihn ist die Seite ein Zettel.
 *
 *   * Jemand, der DAZUGEHOERT. Fuer ihn ist sie eine Tuer: Gespraech,
 *     Termine, Aufgaben.
 *
 * Beide bekommen dieselbe Liste, und der Unterschied steht in der Zeile —
 * nicht in zwei Seiten. Zwei Seiten fuer dieselbe Sache laufen auseinander,
 * und dann steht im Schaukasten etwas anderes als drinnen.
 *
 * <b>Was NICHT sichtbar ist, steht auch nicht als Andeutung da.</b> Eine
 * nicht oeffentliche Gruppe faellt fuer Aussenstehende ganz aus der Liste —
 * der Dienst schickt sie gar nicht erst. „Hier gibt es eine Gruppe fuer
 * Suchtkranke, aber du darfst sie nicht sehen" waere bereits die Auskunft,
 * die niemanden ausserhalb angeht.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { RcRequestError } from '../lib/rcApi';
import { rcRoles } from '../lib/rcChat';
import { rcMayAdminArea } from './rcParishRights';
import {
  rcCreateGroup, rcGroupBlocker, rcGroups, rcGroupSlug, rcMemberCount, rcPublicGroups,
  rcSortGroups, type RcGroup, type RcPublicGroup
} from './rcGroups';

export function RcGroupsTab({
  parishId, parishSlug, parishAreaId, signedIn, at
}: {
  parishId: string;
  parishSlug: string;
  /**
   * Der Bereich der PFARREI — nicht der einer Gruppe.
   *
   * Er beantwortet die eine Frage, die aus den Gruppen selbst nicht
   * folgt: darf dieser Mensch hier ueberhaupt eine gruenden? Bei einer
   * Pfarrei ohne Gruppen gibt es niemanden, den man das fragen koennte.
   */
  parishAreaId: string;
  signedIn: boolean;
  /** Die Adresse einer Unterseite — dieselbe Funktion wie im Rest der Pfarrseite. */
  at: (pageId: string) => string;
}) {
  const [groups, setGroups] = useState<readonly RcGroup[] | null>(null);
  const [aushang, setAushang] = useState<readonly RcPublicGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mayFound, setMayFound] = useState(false);
  const [making, setMaking] = useState(false);

  const load = useCallback(async () => {
    /*
     * OHNE KONTO DER AUSHANG, MIT KONTO DIE LISTE.
     *
     * Nicht „dieselbe Anfrage, die dann leer zurueckkommt": die oeffentliche
     * geht ohne Anmeldung durch, und genau darum geht es. Wer eine Gruppe
     * sucht, hat noch kein Konto — er soll nicht erst eines anlegen muessen,
     * um zu erfahren, wann sich die Schola trifft.
     */
    if (!signedIn) {
      try { setAushang((await rcPublicGroups(parishSlug)).groups ?? []); }
      catch { setError('Nie udało się wczytać wspólnot.'); }
      return;
    }

    try {
      const found = await rcGroups(parishId);
      setGroups(found.groups ?? []);

      /*
       * Ob hier jemand gruenden darf, steht NICHT in der Liste: eine leere
       * Pfarrei hat keine Gruppe, aus deren `mayAdmin` es folgen koennte.
       * Also wird gefragt — und die Antwort ist die des Dienstes, nicht eine
       * Vermutung der Oberflaeche.
       */
      setMayFound((found.groups ?? []).some((g) => g.mayAdmin));
      setError(null);
    } catch (e) {
      setError(e instanceof RcRequestError
        ? 'Nie udało się wczytać wspólnot — sprawdź, czy konto jest odblokowane.'
        : 'Nie udało się wczytać wspólnot.');
    }
  }, [parishId, parishSlug, signedIn]);

  useEffect(() => { void load(); }, [load]);

  /*
   * DER GRUENDUNGSKNOPF FUER DIE ERSTE GRUPPE.
   *
   * Solange es keine Gruppe gibt, sagt keine Zeile, ob jemand gruenden darf —
   * `mayAdmin` steht an den Gruppen, und es gibt keine. Die Frage geht deshalb
   * einmal eigens an den Dienst, aber NUR dann: bei einer gefuellten Liste
   * steht die Auskunft schon da, und eine zweite Anfrage waere eine Anfrage
   * fuer nichts.
   *
   * Ein Fehlschlag heisst „nein". Nicht angemeldet, keine Schluessel, kein
   * Netz — in jedem dieser Faelle bleibt der Knopf weg. Dieselbe Regel wie in
   * `rcParishRights`: eine Berechtigung, die aus einem Netzfehler entsteht,
   * fuehrt zu einem Klick und einer Fehlermeldung.
   */
  const empty = groups !== null && groups.length === 0;
  useEffect(() => {
    if (!empty || !signedIn) return;
    let alive = true;
    void (async () => {
      const may = await rcMayAdminArea(parishAreaId);
      if (alive) setMayFound(may);
    })();
    return () => { alive = false; };
  }, [empty, signedIn, parishAreaId]);

  const sorted = useMemo(() => rcSortGroups(groups ?? []), [groups]);

  // -- Ohne Konto: der Aushang ------------------------------------------------

  if (!signedIn) {
    return (
      <section className="wg">
        <h1 className="ps-title">Wspólnoty</h1>

        {error !== null && <p className="ap-error">{error}</p>}
        {aushang === null && error === null && <p className="ps-muted">Wczytywanie…</p>}

        {aushang !== null && aushang.length === 0 && (
          <p className="ps-muted">Ta parafia nie ogłosiła jeszcze żadnej wspólnoty.</p>
        )}

        <ul className="wg-list">
          {(aushang ?? []).map((group) => (
            <li key={group.slug} className="wg-card">
              <h2 className="wg-name">{group.name}</h2>
              {(group.summary ?? '') !== '' && <p className="wg-summary">{group.summary}</p>}
              {(group.meets ?? '') !== '' && <p className="wg-meets">{group.meets}</p>}
            </li>
          ))}
        </ul>

        {aushang !== null && aushang.length > 0 && (
          <p className="ps-muted wg-foot">
            Chcesz dołączyć? Napisz do kancelarii — dostaniesz link, który
            połączy wspólnotę z Twoim kontem.
          </p>
        )}
      </section>
    );
  }

  // -- Mit Konto: die Liste ---------------------------------------------------

  return (
    <section className="wg">
      <header className="wg-head">
        <h1 className="ps-title">Wspólnoty</h1>
        {mayFound && !making && (
          <button type="button" className="rc-btn" onClick={() => setMaking(true)}>
            Nowa wspólnota
          </button>
        )}
      </header>

      {error !== null && <p className="ap-error">{error}</p>}

      {making && (
        <RcNewGroupForm
          parishId={parishId}
          taken={(groups ?? []).map((g) => g.slug)}
          onCancel={() => setMaking(false)}
          onDone={() => { setMaking(false); void load(); }}
        />
      )}

      {groups === null && error === null && <p className="ps-muted">Wczytywanie…</p>}

      {groups !== null && groups.length === 0 && !making && (
        <p className="ps-muted">
          {mayFound
            ? 'Nie ma jeszcze żadnej wspólnoty. Załóż pierwszą — dostanie własny kalendarz, czat i link do zapraszania.'
            : 'Ta parafia nie ogłosiła jeszcze żadnej wspólnoty.'}
        </p>
      )}

      <Block title="Moje wspólnoty" groups={sorted.mine} at={at} />
      <Block title="Pozostałe" groups={sorted.others} at={at} />
      <Block title="Archiwalne" groups={sorted.archived} at={at} />
    </section>
  );
}

function Block({
  title, groups, at
}: {
  title: string;
  groups: readonly RcGroup[];
  at: (pageId: string) => string;
}) {
  if (groups.length === 0) return null;

  return (
    <>
      <h2 className="wg-block">{title}</h2>
      <ul className="wg-list">
        {groups.map((group) => (
          <li key={group.groupId} className={`wg-card${group.mine ? ' is-mine' : ''}`}>
            <h3 className="wg-name">
              {/*
                Der Name der Gruppe steht im ZWEITEN Segment, so wie der Reiter
                des Messplans — `at` setzt eines, angehaengt wird das andere.
                Beides in `at` zu geben ginge nicht: es kodiert jedes Segment
                einzeln, und der Schraegstrich waere ein `%2F` mitten in der
                Adresse.
              */}
              <a href={`${at('community')}/${group.slug}`}>{group.name}</a>
            </h3>

            {(group.summary ?? '') !== '' && <p className="wg-summary">{group.summary}</p>}
            {(group.meets ?? '') !== '' && <p className="wg-meets">{group.meets}</p>}

            <p className="wg-meta">
              <span>{rcMemberCount(group.members)}</span>

              {/*
                „Nie na stronie" ist eine Auskunft an den Verwalter, keine
                Warnung: manche Gruppen suchen niemanden. Sie steht nur da,
                wenn sie zutrifft — ein Etikett an jeder Zeile waere Rauschen.
              */}
              {!group.isPublic && <span className="wg-hidden">nie na stronie</span>}
              {group.mine && <span className="wg-mine">należysz</span>}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Eine Gruppe gruenden.
 *
 * <b>Die beiden Textfelder stehen nebeneinander und beschriftet</b> — dieselbe
 * Entscheidung wie bei der Messintention. „Opis" haengt im Schaukasten, „notatka
 * wewnętrzna" liegt versiegelt. Zwei gleich aussehende Felder, deren
 * Unterschied nur im Kopf dessen steht, der gerade tippt, sind eine Falle: der
 * erste Satz, der in das falsche wandert, ist der, den man nicht mehr
 * einsammeln kann.
 */
function RcNewGroupForm({
  parishId, taken, onCancel, onDone
}: {
  parishId: string;
  taken: readonly string[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  /** Ob die Adresse von Hand geaendert wurde — danach folgt sie dem Namen nicht mehr. */
  const [ownSlug, setOwnSlug] = useState(false);

  const [summary, setSummary] = useState('');
  const [meets, setMeets] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [note, setNote] = useState('');

  const [personRoleId, setPersonRoleId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = (await rcRoles()).roles ?? [];
        if (alive) setPersonRoleId(list.find((r) => r.kind === 'person')?.roleId ?? null);
      } catch { /* Ohne persoenliche Rolle sagt der Knopf unten, was fehlt. */ }
    })();
    return () => { alive = false; };
  }, []);

  const blocker = personRoleId === null
    ? 'Temu kontu brakuje roli osobistej — odblokuj konto.'
    : rcGroupBlocker(name, slug, taken);

  const create = async () => {
    if (personRoleId === null) return;
    setBusy('Zakładanie…');
    setError(null);
    try {
      await rcCreateGroup(parishId, {
        personRoleId, slug, name,
        summary: summary.trim() === '' ? null : summary,
        meets: meets.trim() === '' ? null : meets,
        isPublic,
        note: note.trim() === '' ? null : note
      });
      onDone();
    } catch (e) {
      setError(e instanceof RcRequestError
        ? 'Nie udało się założyć wspólnoty. Ten adres może być już zajęty.'
        : 'Nie udało się założyć wspólnoty.');
      setBusy(null);
    }
  };

  return (
    <form
      className="wg-new"
      onSubmit={(e) => { e.preventDefault(); if (blocker === null) void create(); }}
    >
      <h2>Nowa wspólnota</h2>

      <label className="wg-field">
        <span>Nazwa</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            // Die Adresse folgt dem Namen, bis jemand sie selbst anfasst.
            if (!ownSlug) setSlug(rcGroupSlug(e.target.value));
          }}
          placeholder="Ministranci"
        />
      </label>

      <label className="wg-field">
        <span>Adres</span>
        <input
          value={slug}
          onChange={(e) => { setOwnSlug(true); setSlug(rcGroupSlug(e.target.value)); }}
          placeholder="ministranci"
        />
        <em className="wg-hint">Zostaje na stałe — wisi w odnośnikach, które ktoś przepisze.</em>
      </label>

      {/* -- Der Aushang -------------------------------------------------- */}

      <label className="wg-field wg-wide">
        <span>Opis</span>
        <textarea
          rows={2}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Dla chłopców od 8 roku życia."
        />
        <em className="wg-hint wg-hint-open">
          Widoczne dla każdego, także bez konta — jak kartka w gablocie.
        </em>
      </label>

      <label className="wg-field">
        <span>Kiedy się spotykacie</span>
        <input value={meets} onChange={(e) => setMeets(e.target.value)} placeholder="soboty 10:00" />
        <em className="wg-hint wg-hint-open">Też w gablocie.</em>
      </label>

      <label className="wg-check">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        <span>Pokaż na stronie parafii</span>
        <em className="wg-hint">
          Wyłączone: wspólnota istnieje i działa, ale nie ogłasza się. Treść jest
          zapieczętowana tak samo w obu przypadkach.
        </em>
      </label>

      {/* -- Das Innere --------------------------------------------------- */}

      <label className="wg-field wg-wide">
        <span>Notatka wewnętrzna</span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Klucz do zakrystii ma pani K."
        />
        <em className="wg-hint wg-hint-sealed">
          Zapieczętowana kluczem tej wspólnoty. Nie widzi jej ani kancelaria,
          ani nikt spoza wspólnoty.
        </em>
      </label>

      {error !== null && <p className="ap-error">{error}</p>}

      <div className="wg-actions">
        <button type="submit" className="rc-btn" disabled={blocker !== null || busy !== null}>
          {busy ?? 'Załóż wspólnotę'}
        </button>
        <button type="button" className="rc-btn rc-btn-quiet" onClick={onCancel}>
          Anuluj
        </button>

        {/*
          EIN GRAUER KNOPF MUSS SAGEN, WARUM.

          Er sieht sonst aus wie ein kaputtes Programm — und beim
          Veranstaltungskreator war er genau das, aus Sicht dessen, der davor
          sass: die Vorschau meldete „3 Seiten, 14 Teile", und der Knopf ging
          trotzdem nicht, weil die Adresse fehlte.
        */}
        {blocker !== null && busy === null && <span className="wg-blocker">{blocker}</span>}
      </div>
    </form>
  );
}

export default RcGroupsTab;
