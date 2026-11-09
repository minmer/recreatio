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
import { useT } from '../core/i18n';
import { libraryKindOf, settleLibrary, type OpenLibrary } from '../library/library';
import { useLibraries } from '../library/LibraryPick';
import { storeOf } from '../library/libraryStore';
import { viewPath } from '../routes';
import { cogitaPath } from './parts';
import { hasOldCopies, hasOldPublications, oldCopiesLine, withdrawOldCopies } from './oldCopies';
import { BASES_CHANGED, MAX_SOURCES } from './sources';
import { useBusy, useCtx } from './ui';
import { audience, isPublicBase, nameIn, needsOf, wholeBase } from './visibility';
import { Loading } from '../ui/Loading';

const TAB_OF: Record<string, string> = { entity: 'wpisy', revision: 'powtorki', flow: 'przebiegi', template: 'karty' };

/**
 * DER KASTEN „KTO WIDZI" — wer diesen Eintrag (diese Powtórka, diesen
 * Przebieg) liest, und: in eine andere Baza tragen.
 */
export function WhoSees({ id, title }: { id: string; title?: string }) {
  const t = useT();
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
    setSaid(`${t('cogitaViews.who.moved', { count: ids.length, name: chosen.name })}${renamed > 0 ? t('cogitaViews.who.renamed', { count: renamed }) : ''}`);
    const tab = TAB_OF[entry.kind];
    window.location.hash = tab === undefined ? viewPath('knowledge', chosen.libraryId) : cogitaPath(chosen.libraryId, tab, id);
  });

  return (
    <section className="cg-card">
      <h3>{title ?? t('cogitaViews.who.title')}</h3>
      <p>{t('cogitaViews.who.baseAudience', { name, audience: audience(here) })}</p>
      {writes && me !== null && entry !== undefined && others.length > 0 && (
        <details className="wk-fold">
          <summary>{t('cogitaViews.who.moveSummary')}</summary>
          <p className="cg-muted">
            {t('cogitaViews.who.moveHint')}
          </p>
          <select value={target} disabled={busy} aria-label={t('cogitaViews.who.targetBase')} onChange={(e) => { setTarget(e.target.value); setUnderstood(false); }}>
            <option value="">{t('cogitaViews.who.pickBase')}</option>
            {others.map((r) => <option key={r.libraryId} value={r.libraryId}>{isPublicBase(r) ? t('cogitaViews.who.optPublic', { name: r.name }) : r.areaPublic === true ? t('cogitaViews.who.optOpenArea', { name: r.name }) : t('cogitaViews.who.optMembers', { name: r.name })}</option>)}
          </select>
          {chosen !== undefined && (
            <>
              <h4>{t('cogitaViews.who.whatChanges')}</h4>
              <p>{t('cogitaViews.who.afterMove', { audience: audience(chosen) })}</p>
              {opens && <p className="wk-warn">{t('cogitaViews.who.opensWarn', { name: chosen.name, whole: wholeBase() })}</p>}
              {needs.length > 0 && (
                <>
                  <p>{needs.length > 8 ? t('cogitaViews.who.needsMore', { count: needs.length, list: needs.slice(0, 8).map((n) => nameIn(lib, n)).join(', '), more: needs.length - 8 }) : t('cogitaViews.who.needs', { count: needs.length, list: needs.map((n) => nameIn(lib, n)).join(', ') })}</p>
                  <label className="wk-check">
                    <input type="checkbox" checked={along} disabled={busy} onChange={(e) => setAlong(e.target.checked)} />
                    <span>{opens ? t('cogitaViews.who.moveAlongPublic') : t('cogitaViews.who.moveAlong')}</span>
                  </label>
                  {!along && <p className="cg-muted">{t('cogitaViews.who.stayHere', { name: chosen.name })}</p>}
                </>
              )}
              {!sourced && (tooMany
                ? <p className="wk-warn">{t('cogitaViews.who.tooMany', { max: MAX_SOURCES, name: chosen.name })}</p>
                : <p>{t('cogitaViews.who.asSource', { base: name, name: chosen.name })}</p>)}
              {opens && (
                <label className="wk-check">
                  <input type="checkbox" checked={understood} disabled={busy} onChange={(e) => setUnderstood(e.target.checked)} />
                  <span>{t('cogitaViews.who.understoodPublic')}</span>
                </label>
              )}
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy || (opens && !understood)} onClick={() => void move()}>{busy ? t('cogitaViews.who.moving') : t('cogitaViews.who.moveTo', { name: chosen.name })}</button>
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
  const t = useT();
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
  const inside = t('cogitaViews.who.inside', counts);
  const areaName = area?.personal === true ? t('cogitaViews.who.onlyYou') : area?.name ?? t('cogitaViews.who.thisArea');
  /* Eine alte Abschrift kann Inhalt aus einer Quelle tragen, die nicht öffentlich ist — erst zurücknehmen (unten). */
  const copies = hasOldCopies(lib.store);
  const old = hasOldPublications(lib.store);
  const known = (id: string) => lib.store.get(id) !== undefined || lib.sourceList().some((s) => s.store.get(id) !== undefined);

  return (
    <section className="cg-card">
      <h3>{t('cogitaViews.who.readers')}</h3>
      {row === undefined ? <Loading lines={1} />
        : row.areaPublic !== true ? (
          <>
            <p>{t('cogitaViews.who.members', { area: areaName })}</p>
            <p className="cg-muted">{t('cogitaViews.who.ifOpen', { whole: wholeBase() })}</p>
          </>
        ) : row.areaRuleAt != null ? (
          <>
            <p className="wk-warn">{t('cogitaViews.who.openArea', { area: areaName, whole: wholeBase(), inside })}</p>
            <p className="cg-muted">{t('cogitaViews.who.keepForSome')}</p>
          </>
        ) : (
          <>
            <p>{t('cogitaViews.who.notOpened', { area: areaName })}</p>
            {writes && (
              <>
                <h4>{t('cogitaViews.who.whatChanges')}</h4>
                <p className="wk-warn">{t('cogitaViews.who.afterOpen', { whole: wholeBase(), inside })}</p>
                <p className="cg-muted">{t('cogitaViews.who.partOnly')}</p>
                {copies && <p className="wk-warn">{t('cogitaViews.who.copiesFirst')}</p>}
                <label className="wk-check">
                  <input type="checkbox" checked={understood} disabled={busy || copies} onChange={(e) => setUnderstood(e.target.checked)} />
                  <span>{t('cogitaViews.who.understoodWhole')}</span>
                </label>
                <div className="wk-actions">
                  <button type="button" className="wk-btn" disabled={busy || !understood || copies} onClick={() => void run(async () => { await settleLibrary(lib.libraryId); window.dispatchEvent(new Event(BASES_CHANGED)); onChanged(); })}>
                    {t('cogitaViews.who.openForAll')}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      {writes && old && (
        <>
          <h4>{t('cogitaViews.who.oldCopies')}</h4>
          <p className="cg-muted">{t('cogitaViews.who.oldCopiesHint')}</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => { setReport(oldCopiesLine(await withdrawOldCopies(lib.store, known, { libraryId: lib.libraryId }))); onChanged(); })}>
              {t('cogitaViews.who.withdraw')}
            </button>
          </div>
        </>
      )}
      {report !== null && <p className="wk-note">{report}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
