/**
 * KTO WIDZI (2026-10-22, Schritt 8) — an Stelle von „Opublikuj" in Cogita.
 *
 * Wer einen Eintrag einer Baza wiedzy liest, entscheidet allein ihr Bereich:
 * seine Mitglieder, und ist er öffentlich (und die Baza geöffnet), jeder —
 * dann die GANZE Baza, mit den Antworten der Fragen und den Entwürfen. Das
 * steht überall da, wo eine Baza öffentlich wird, in Worten.
 *
 * <b>Veröffentlichen heisst jetzt: in eine öffentliche Baza tragen.</b> Die
 * Kennung bleibt, jeder Verweis zeigt weiter auf ihn. Was er braucht (seine
 * Art, Vorlagen, Einträge, auf die er zeigt), nennt der Plan vorher — es kann
 * mitgehen. Die alte Baza nimmt die neue als Quelle: sie sieht weiter alles,
 * was hinüberging.
 *
 * <code>
 *   WhoSees               der Kasten am Eintrag, an der Powtórka, am Przebieg
 *   BaseVisibility        in den Einstellungen: wer liest, und die Baza öffnen
 * </code>
 *
 * Die Worte und die Rechnung (wer liest, was ein Eintrag braucht) stehen in
 * `visibility.ts` — ohne Oberfläche, geprüft in app-cogita-check.
 */

import { useState } from 'react';

import type { AreaRow } from '../areas/area';
import { libraryKindOf, settleLibrary, type OpenLibrary } from '../library/library';
import { useLibraries } from '../library/LibraryPick';
import { storeOf } from '../library/libraryStore';
import { viewPath } from '../routes';
import { hasOldCopies, hasOldPublications, oldCopiesLine, withdrawOldCopies } from './oldCopies';
import { BASES_CHANGED, MAX_SOURCES } from './sources';
import { useBusy, useCtx } from './ui';
import { audience, isPublicBase, nameIn, needsOf, WHOLE_BASE } from './visibility';
import { Loading } from '../ui/Loading';

const TAB_OF: Record<string, string> = { entity: 'wpisy', revision: 'powtorki', flow: 'przebiegi', template: 'karty' };

/**
 * DER KASTEN „KTO WIDZI" — wer diesen Eintrag (diese Powtórka, diesen
 * Przebieg) liest, und: in eine andere Baza tragen.
 */
export function WhoSees({ id, title = 'Kto widzi' }: { id: string; title?: string }) {
  const { lib, me, writes, name } = useCtx();
  const rows = useLibraries();
  const [target, setTarget] = useState('');
  const [along, setAlong] = useState(true);
  const [understood, setUnderstood] = useState(false);
  const { busy, failed, run } = useBusy();
  const [said, setSaid] = useState<string | null>(null);

  const here = rows?.find((r) => r.libraryId === lib.libraryId);
  const entry = lib.store.get(id);
  const others = (rows ?? []).filter((r) => r.libraryId !== lib.libraryId && r.writes && libraryKindOf(r) === 'knowledge');
  const chosen = others.find((r) => r.libraryId === target);
  const needs = entry === undefined || chosen === undefined ? [] : needsOf(lib, id);
  const sourced = lib.settings().sources.some((s) => s.id === target);
  const tooMany = !sourced && lib.settings().sources.length >= MAX_SOURCES;
  const opens = chosen !== undefined && isPublicBase(chosen) && !isPublicBase(here);

  const move = () => run(async () => {
    if (chosen === undefined || me === null || entry === undefined) return;
    const there = storeOf(me.ring, chosen);
    await there.sync();
    const ids = [id, ...(along ? needs : [])];
    let renamed = 0;
    for (const one of ids) {
      if (lib.store.get(one) === undefined) continue;
      const moved = await lib.store.moveTo(one, there);
      if (moved.keyChanged) renamed += 1;
    }
    /* Die alte Baza sieht weiter, was hinüberging: die neue wird ihre Quelle. */
    if (!sourced && !tooMany) await lib.saveSettings({ sources: [...lib.settings().sources, { id: chosen.libraryId, kind: 'knowledge', name: chosen.name }] });
    window.dispatchEvent(new Event(BASES_CHANGED));
    setSaid(`Przeniesiono ${ids.length === 1 ? 'wpis' : `${ids.length} wpisów`} do „${chosen.name}”.${renamed > 0 ? ` ${renamed} z nich dostało nowy klucz (stary był tam zajęty) — odnośniki idą po identyfikatorze, więc nic się nie zepsuło.` : ''}`);
    const tab = TAB_OF[entry.kind];
    window.location.hash = tab === undefined ? viewPath('learn', chosen.libraryId) : viewPath('learn', chosen.libraryId, tab, id);
  });

  return (
    <section className="cg-card">
      <h3>{title}</h3>
      <p>Baza „{name}”: {audience(here)}.</p>
      {writes && me !== null && entry !== undefined && others.length > 0 && (
        <details className="wk-fold">
          <summary>Przenieś do innej bazy wiedzy</summary>
          <p className="cg-muted">
            Tak teraz się publikuje: żeby coś było publiczne, przenieś to do bazy w obszarze jawnym (żeby było prywatne — do bazy w obszarze zamkniętym).
            Identyfikator zostaje, więc odnośniki dalej działają. Odpowiedzi uczących się zostają przy tej bazie.
          </p>
          <select value={target} disabled={busy} aria-label="Baza docelowa" onChange={(e) => { setTarget(e.target.value); setUnderstood(false); }}>
            <option value="">— wybierz bazę wiedzy —</option>
            {others.map((r) => <option key={r.libraryId} value={r.libraryId}>{r.name} — {isPublicBase(r) ? 'publiczna w całości' : r.areaPublic === true ? 'obszar jawny, baza jeszcze nie otwarta' : 'dla członków obszaru'}</option>)}
          </select>
          {chosen !== undefined && (
            <>
              <h4>Co się zmieni</h4>
              <p>Po przeniesieniu czytają go: {audience(chosen)}.</p>
              {opens && <p className="wk-warn">Baza „{chosen.name}” jest publiczna w całości: każdy zobaczy ten wpis i {WHOLE_BASE} tej bazy.</p>}
              {needs.length > 0 && (
                <>
                  <p>Potrzebuje z tej bazy ({needs.length}): {needs.slice(0, 8).map((n) => nameIn(lib, n)).join(', ')}{needs.length > 8 ? ` i ${needs.length - 8} innych` : ''}.</p>
                  <label className="wk-check">
                    <input type="checkbox" checked={along} disabled={busy} onChange={(e) => setAlong(e.target.checked)} />
                    <span>Przenieś je razem z nim{opens ? ' (też staną się publiczne)' : ''}</span>
                  </label>
                  {!along && <p className="cg-muted">Zostają tutaj — kto czyta tylko „{chosen.name}”, zobaczy w ich miejscu „[odwołanie niedostępne]”.</p>}
                </>
              )}
              {!sourced && (tooMany
                ? <p className="wk-warn">Ta baza ma już {MAX_SOURCES} źródeł — „{chosen.name}” nie zostanie dodana; to, co przeniesiesz, zniknie stąd z widoku.</p>
                : <p>„{name}” dostanie „{chosen.name}” jako źródło — dalej widzi wszystko, co tam przeniesiesz.</p>)}
              {opens && (
                <label className="wk-check">
                  <input type="checkbox" checked={understood} disabled={busy} onChange={(e) => setUnderstood(e.target.checked)} />
                  <span>Rozumiem: to będzie publiczne.</span>
                </label>
              )}
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy || (opens && !understood)} onClick={() => void move()}>{busy ? 'Przenoszenie…' : `Przenieś do „${chosen.name}”`}</button>
              </div>
            </>
          )}
        </details>
      )}
      {said !== null && <p className="wk-note">{said}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/**
 * IN DEN EINSTELLUNGEN: wer diese Baza liest — und, in einem jawnym obszarze,
 * sie für alle öffnen. Vorher steht da, was das heisst; ohne das Häkchen geht
 * es nicht (0123: keine Baza öffnet sich von selbst).
 */
export function BaseVisibility({ libraries, areas, onChanged }: { libraries: readonly OpenLibrary[]; areas: readonly AreaRow[]; onChanged: () => void }) {
  const { lib, writes } = useCtx();
  const [understood, setUnderstood] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const { busy, failed, run } = useBusy();
  const row = libraries.find((l) => l.libraryId === lib.libraryId);
  const area = areas.find((a) => a.areaId === lib.areaId);
  const own = (ids: readonly { id: string }[]) => ids.filter((e) => lib.isOwn(e.id)).length;
  const counts = {
    entries: own(lib.entities()),
    questions: own(lib.ofKind('question')),
    revisions: own(lib.docs('revision')),
    flows: own(lib.docs('flow'))
  };
  const inside = `${counts.entries} wpisów (w tym ${counts.questions} pytań z odpowiedziami), ${counts.revisions} powtórek, ${counts.flows} przebiegów`;
  const areaName = area?.personal === true ? 'tylko Ty' : area?.name ?? 'obszar tej bazy';
  /* Eine alte Abschrift kann Inhalt aus einer Quelle tragen, die nicht öffentlich ist — erst zurücknehmen (unten). */
  const copies = hasOldCopies(lib.store);
  const old = hasOldPublications(lib.store);
  const known = (id: string) => lib.store.get(id) !== undefined || lib.sourceList().some((s) => s.store.get(id) !== undefined);

  return (
    <section className="cg-card">
      <h3>Kto czyta</h3>
      {row === undefined ? <Loading lines={1} />
        : row.areaPublic !== true ? (
          <>
            <p>Czytają ją członkowie obszaru „{areaName}” (i ci, którym dali link albo miejsce).</p>
            <p className="cg-muted">Gdyby ten obszar stał się jawny, każdy przeczytałby {WHOLE_BASE}. Żeby udostępnić tylko część, załóż osobną bazę w obszarze jawnym i przenieś do niej wybrane wpisy (wpis → Kto widzi → Przenieś).</p>
          </>
        ) : row.areaRuleAt != null ? (
          <>
            <p className="wk-warn">Obszar „{areaName}” jest jawny: każdy czyta {WHOLE_BASE} — teraz {inside}.</p>
            <p className="cg-muted">Coś, co ma zostać dla wybranych, przenieś do bazy w obszarze zamkniętym (wpis → Kto widzi → Przenieś).</p>
          </>
        ) : (
          <>
            <p>Obszar „{areaName}” jest jawny, ale ta baza nie jest jeszcze otwarta — dopóki jej nie otworzysz, czytają ją tylko członkowie obszaru.</p>
            {writes && (
              <>
                <h4>Co się zmieni</h4>
                <p className="wk-warn">Po otwarciu każdy — bez konta — przeczyta {WHOLE_BASE}: teraz {inside}. Moduły na stronach pokażą ją wszystkim.</p>
                <p className="cg-muted">Jeśli publiczna ma być tylko część, nie otwieraj tej bazy: załóż osobną w tym obszarze i przenieś do niej wybrane wpisy.</p>
                {copies && <p className="wk-warn">Najpierw wycofaj stare kopie publikacji (niżej): ta baza ma jeszcze kopie zapisane we wpisach.</p>}
                <label className="wk-check">
                  <input type="checkbox" checked={understood} disabled={busy || copies} onChange={(e) => setUnderstood(e.target.checked)} />
                  <span>Rozumiem: cała baza będzie publiczna.</span>
                </label>
                <div className="wk-actions">
                  <button type="button" className="wk-btn" disabled={busy || !understood || copies} onClick={() => void run(async () => { await settleLibrary(lib.libraryId); window.dispatchEvent(new Event(BASES_CHANGED)); onChanged(); })}>
                    Otwórz całą bazę dla wszystkich
                  </button>
                </div>
              </>
            )}
          </>
        )}
      {writes && old && (
        <>
          <h4>Stare kopie publikacji</h4>
          <p className="cg-muted">Z czasów, gdy baza publikowała pojedyncze wpisy, zostały kopie — u serwera i zapisane we wpisach. Nic z nich już nie korzysta. Wycofanie zostawia same wpisy; kopia, która pokazuje wpis, którego już nie ma, zostaje.</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => { setReport(oldCopiesLine(await withdrawOldCopies(lib.store, known, { libraryId: lib.libraryId }))); onChanged(); })}>
              Wycofaj stare kopie
            </button>
          </div>
        </>
      )}
      {report !== null && <p className="wk-note">{report}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
