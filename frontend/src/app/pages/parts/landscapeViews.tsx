/**
 * 2026-11-05 — DIE ANSICHT DES BAUSTEINS „KRAJOBRAZ WIEDZY" (`cogita.tsx`, `cogita-landscape`) — erst geladen, wenn
 * eine Seite ihn zeigt. Derselbe Krajobraz wie im Widok (`viewViews.tsx`) und in „Wpisy", aber ohne Umweg über
 * einen gespeicherten Widok: ohne Widok die ganze Baza (dieselben Plätze wie in „Wpisy", Schlüssel `wpisy`).
 *
 * Darüber die kurze Wahl „Jak często pytać" (`SpacingChoice`) — nur wenn der Lernende sie ändern darf (der Bereich
 * hat sie nicht festgelegt); gespeichert in seinen Werten für diese Baza, und der Krajobraz rechnet sofort neu.
 *
 * <b>Je Grösse:</b> im Streifen Überschrift und Knopf (zugeklappt, `strip`); als Block der kleine Krajobraz (höchstens
 * 24 Felder) und „cały krajobraz"; hoch und im Vollbild der ganze, mit Suche. Der Zustand (Zoom, Wahl, Suche) steht
 * unter dem Zakres des Bausteins in der Adresse.
 */

import { useMemo } from 'react';

import type { PartContext } from '../part';
import { scopeOf, useScope } from '../partQuery';
import { answersArea } from '../../cogita/answersTo';
import { useEntitySubject } from '../../cogita/entitySubject';
import { LearnerLine, usePageLearner } from '../../cogita/pageLearner';
import { usePageBase } from '../../cogita/pageBase';
import { usePageRewards } from '../../cogita/pageRewards';
import { rewardsFor } from '../../cogita/rewards';
import { SpacingChoice, SpacingLine } from '../../cogita/SpacingSettings';
import { CogitaContext, useAsyncKeep } from '../../cogita/ui';
import { readView } from '../../cogita/views';
import { later } from '../../ui/later';
import { Loading } from '../../ui/Loading';
import type { LandscapeConfig, LearnSettingsConfig } from './cogita';
import { EntryCard } from './viewViews';

const LandscapeView = later(() => import('../../cogita/LandscapeView').then((m) => m.LandscapeView));

const isTall = (ctx: PartContext): boolean => ctx.whole === true || ctx.size.height === 'tall';

export function LandscapeModuleView({ config, ctx }: { config: LandscapeConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  const scope = scopeOf(ctx.moduleId);
  const [state, setState] = useScope(scope);
  /* Wählt die Seite oben einen Eintrag dieser Baza, wählt ein Klick dort — sonst öffnet er sich hier. */
  const subject = useEntitySubject();
  const doc = lib == null || config.view === '' ? undefined : lib.docs('view').find((e) => e.id === config.view);
  const saved = useMemo(() => readView(doc?.data), [doc]);
  /* Gelernt wird als die Person der Seite (angemeldet man selbst, ein Platz, sonst dieser Browser); Antworten wie „Powtórka". */
  const visitor = usePageLearner(lib, answersArea(config.answers));
  const pageRules = usePageRewards(lib?.libraryId ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const namedRules = useMemo(() => (lib == null || config.rewards === '' ? null : rewardsFor(lib.docs('reward'), config.rewards, null).rules), [lib, lib?.revision, config.rewards]);
  const rules = namedRules ?? pageRules;
  /* Die Karten bleiben stehen, solange neue gerechnet werden (sonst verliert der Krajobraz Zoom, Wahl und Bildlauf). */
  const [cards, busy] = useAsyncKeep(lib != null ? () => lib.cards('page').then((r) => r.cards) : null, [lib, lib?.revision], () => lib?.cardsReady('page'));
  const title = config.title || (doc !== undefined ? saved.name : '') || 'Krajobraz wiedzy';

  if (lib === undefined) return <><h2 className="wk-card-title">{title}</h2><Loading /></>;
  if (lib === null || cg === null) return <><h2 className="wk-card-title">{title}</h2><p className="wk-card-muted">Tej bazy wiedzy nie możesz tu czytać — nie jest publiczna albo nie masz do niej dostępu.</p></>;
  if (config.view !== '' && doc === undefined) return <><h2 className="wk-card-title">{title}</h2><p className="wk-card-muted">Tego widoku nie ma w bazie wiedzy.</p></>;

  const viewKey = config.view === '' ? 'wpisy' : config.view;
  const tall = isTall(ctx);
  const open = (id: string) => {
    if (subject !== null && subject.library === config.library) { subject.choose(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else setState({ e: state.e === id ? null : id, d: null });
  };
  const showSearch = tall && !config.hidden.has('search');

  return (
    <CogitaContext.Provider value={cg}>
      <h2 className="wk-card-title">{title}</h2>
      {!config.hidden.has('spacing') && <SpacingChoice lib={lib} learner={visitor.learner} />}
      {showSearch && (
        <div className="cg-row">
          <input type="search" className="cg-search" value={state.q ?? ''} onChange={(e) => setState({ q: e.target.value })} placeholder="Szukaj w krajobrazie…" aria-label={`Szukaj: ${title}`} />
        </div>
      )}
      {cards == null ? <Loading /> : tall ? (
        <LandscapeView view={saved} cards={cards} learner={visitor.learner} onOpen={open} query={showSearch ? state.q ?? '' : ''} viewKey={viewKey} rewards={rules} urlScope={`${scope}.`} busy={busy} />
      ) : (
        <LandscapeView view={saved} cards={cards} learner={visitor.learner} onOpen={open} compact viewKey={viewKey} rewards={rules}
          {...(ctx.openWhole === undefined ? {} : { more: <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>cały krajobraz</button> })} />
      )}
      {!config.hidden.has('learner') && <LearnerLine learner={visitor} lib={lib} />}
      {state.e !== undefined && <EntryCard lib={lib} id={state.e} ctx={ctx} scope={scope} delivery={state.d ?? null} onDelivery={(d) => setState({ d })} />}
    </CogitaContext.Provider>
  );
}

/**
 * 2026-11-05 — BAUSTEIN „USTAWIENIA NAUKI" (`cogita-settings`): die eigene Wahl „Jak często pytać" für sich, irgendwo
 * auf der Seite. Derselbe Lernende wie im Lernbaustein (dieselbe Person, derselbe Bereich der Antworten), also wirkt
 * eine Wahl hier sofort im Krajobraz, in der Powtórka und überall, wo diese Baza gelernt wird. Im Streifen nur die Zeile.
 */
export function LearnSettingsView({ config, ctx }: { config: LearnSettingsConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  const visitor = usePageLearner(lib, answersArea(config.answers));
  const title = config.title || 'Ustawienia nauki';
  if (lib === undefined) return <><h2 className="wk-card-title">{title}</h2><Loading /></>;
  if (lib === null || cg === null) return <><h2 className="wk-card-title">{title}</h2><p className="wk-card-muted">Tej bazy wiedzy nie możesz tu czytać — nie jest publiczna albo nie masz do niej dostępu.</p></>;
  return (
    <CogitaContext.Provider value={cg}>
      {ctx.size.height === 'strip' && ctx.whole !== true ? <SpacingLine lib={lib} learner={visitor.learner} /> : (
        <>
          <h2 className="wk-card-title">{title}</h2>
          {visitor.learner === null ? <Loading /> : <SpacingChoice lib={lib} learner={visitor.learner} />}
          {!config.hidden.has('learner') && <LearnerLine learner={visitor} lib={lib} />}
        </>
      )}
    </CogitaContext.Provider>
  );
}
