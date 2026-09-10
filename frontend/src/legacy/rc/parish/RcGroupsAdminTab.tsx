/**
 * Karta „Wspólnoty" w trybie edycji parafii.
 *
 * <b>Dlaczego wspólnoty stoją tu, obok mszy i intencji.</b> Bo to ta sama
 * praca: kancelaria siada raz i ustawia, co parafia ma. Msze, spowiedź,
 * bierzmowanie — i wspólnoty. Kto szuka ich gdzie indziej, nie znajdzie, bo
 * tutaj właśnie zagląda, gdy coś zakłada.
 *
 * <b>Ta karta zakłada, ale NIE prowadzi.</b> Zakładanie należy do parafii;
 * prowadzenie — do wspólnoty. Dlatego każdy wiersz jest odnośnikiem do strony
 * wspólnoty, gdzie jej urząd (rc_0037) zmienia opis, godziny i całą resztę.
 * Wciągnięcie tego wszystkiego tutaj znaczyłoby, że wspólnotę prowadzi
 * kancelaria — a wtedy urząd byłby ozdobą.
 *
 * <b>Czego brakuje w gablocie, stoi przy wierszu.</b> Wspólnota zakłada się w
 * pół minuty: nazwa, adres, gotowe. Opis i godziny są nieobowiązkowe i właśnie
 * dlatego zostają puste — a w gablocie wisi wtedy sama nazwa, która nikomu nic
 * nie mówi. Liczy to `rcPublicInfoMissing`, sprawdzalnie.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { RcRequestError } from '../lib/rcApi';
import { rcPath } from '../lib/rcRoute';
import { RcNewGroupForm } from './RcGroupsTab';
import {
  rcGroups, rcMemberCount, rcPublicInfoMissing, rcSortGroups, type RcGroup
} from './rcGroups';
import { rcMayAdminArea } from './rcParishRights';

export function RcGroupsAdminTab({
  parishId, parishAreaId, slug
}: {
  parishId: string;
  /** Bereich der PFARREI — er beantwortet „darfst du hier gruenden". */
  parishAreaId: string;
  slug: string;
}) {
  const [groups, setGroups] = useState<readonly RcGroup[] | null>(null);
  const [mayFound, setMayFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [making, setMaking] = useState(false);

  const load = useCallback(async () => {
    try {
      const found = await rcGroups(parishId);
      setGroups(found.groups ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof RcRequestError
        ? 'Nie udało się wczytać wspólnot — sprawdź, czy konto jest odblokowane.'
        : 'Nie udało się wczytać wspólnot.');
    }
  }, [parishId]);

  useEffect(() => { void load(); }, [load]);

  /*
   * Ob hier jemand gruenden darf, geht an den DIENST und wird nicht geraten —
   * dieselbe Regel wie in `rcParishRights`. Ein Knopf, der erscheint, weil die
   * Oberflaeche vermutet, fuehrt zu einem Klick und einer Fehlermeldung.
   *
   * Anders als auf der oeffentlichen Seite wird hier IMMER gefragt: diese Karte
   * sieht ohnehin nur, wer die Pfarrei bearbeitet, und die Antwort entscheidet
   * ueber den einzigen Knopf darauf.
   */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const may = await rcMayAdminArea(parishAreaId);
      if (alive) setMayFound(may);
    })();
    return () => { alive = false; };
  }, [parishAreaId]);

  const sorted = useMemo(() => rcSortGroups(groups ?? []), [groups]);
  const all = [...sorted.mine, ...sorted.others, ...sorted.archived];

  /** Wie viele Gruppen im Schaukasten unvollstaendig sind — fuer die Karte. */
  const incomplete = all.filter((g) => rcPublicInfoMissing(g).length > 0).length;

  return (
    <div className="pb-view wg-manage">
      <p className="pb-hint">
        Wspólnota dostaje własny kalendarz, rozmowę, zadania i link do
        zapraszania — a do tego urząd, który nią kieruje. Urząd można przekazać
        osobie prowadzącej: będzie zmieniać opis swojej wspólnoty, nie stając
        się zarządcą parafii.
      </p>

      {error !== null && <p className="ap-error">{error}</p>}

      {mayFound && !making && (
        <button type="button" className="rc-btn" onClick={() => setMaking(true)}>
          Nowa wspólnota
        </button>
      )}

      {!mayFound && groups !== null && (
        <p className="pb-hint">Zakładać wspólnoty może zarządca tej parafii.</p>
      )}

      {making && (
        <RcNewGroupForm
          parishId={parishId}
          taken={all.map((g) => g.slug)}
          onCancel={() => setMaking(false)}
          onDone={() => { setMaking(false); void load(); }}
        />
      )}

      {groups === null && error === null && <p className="pb-hint">Wczytywanie…</p>}

      {groups !== null && all.length === 0 && !making && (
        <p className="pb-hint">
          Nie ma jeszcze żadnej wspólnoty.
        </p>
      )}

      {/*
        DIE SAMMELMELDUNG STEHT OBEN, nicht nur an den Zeilen. Bei zwoelf
        Gruppen sieht man einzelne Luecken nicht — man sieht eine Liste.
      */}
      {incomplete > 0 && (
        <p className="wg-manage-warn">
          {incomplete === 1
            ? 'Jedna wspólnota nie ma jeszcze pełnych danych do gabloty.'
            : `Wspólnot bez pełnych danych do gabloty: ${incomplete}.`}
        </p>
      )}

      {all.length > 0 && (
        <ul className="wg-manage-list">
          {all.map((group) => {
            const missing = rcPublicInfoMissing(group);

            return (
              <li key={group.groupId} className="wg-manage-row">
                <span className="wg-manage-name">
                  {/*
                    Ein VERWEIS und kein Knopf: mit der mittleren Maustaste in
                    einem neuen Reiter, als Lesezeichen, zum Weitergeben an
                    den, der die Gruppe fuehren soll.
                  */}
                  <a href={`${rcPath('parish', slug, 'community')}/${group.slug}`}>
                    {group.name}
                  </a>
                  <em className="wg-manage-slug">/{group.slug}</em>
                </span>

                <span className="wg-manage-meta">
                  <span>{rcMemberCount(group.members)}</span>
                  {!group.isPublic && <span className="wg-hidden">nie na stronie</span>}
                  {group.lifecycle === 'archived' && <span className="wg-archived">archiwalna</span>}
                  {group.leading && <span className="wg-mine">prowadzisz</span>}
                </span>

                {/*
                  CO DOKŁADNIE UZUPEŁNIĆ — nie „uzupełnij dane".

                  „Brakuje 2 rzeczy" każe szukać; „brakuje opisu i godzin
                  spotkań" mówi, co zrobić, i prowadzi tam odnośnikiem.
                */}
                {missing.length > 0 && (
                  <span className="wg-manage-todo">
                    Do gabloty brakuje: {missing.join(', ')} —{' '}
                    <a href={`${rcPath('parish', slug, 'community')}/${group.slug}`}>uzupełnij</a>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default RcGroupsAdminTab;
