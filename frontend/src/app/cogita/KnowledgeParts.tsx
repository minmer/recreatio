/**
 * 2026-10-24 — WIEDZA: „Dodaj" und „Schematy" (`parts.ts`).
 *
 * <b>Dodaj</b> — ein einzelner Eintrag eines Rodzaj (ohne dass dafür etwas gebaut sein muss)
 * oder ein Sposób dodawania: ein Formular, das mehrere verbundene Einträge auf einmal anlegt
 * (ein Komentarz biblijny mit seinem Komentarz). Man füllt aus; wie das Formular gebaut ist,
 * sieht man hier nicht.
 *
 * <b>Schematy</b> — drei Kategorien, jede für sich: Rodzaje wpisów (die Struktur), Sposoby
 * dodawania (wie Wissen hineinkommt), Sposoby wyświetlania (was gezeigt wird und wie, auch
 * über Verweise). Keine gehört einem Rodzaj: ein Formular legt Einträge mehrerer Rodzaje an,
 * ein Widok zeigt mehrere zusammen, und kein Rodzaj braucht eines von beiden.
 */

import { useMemo } from 'react';

import { tOr, useT, type T } from '../core/i18n';
import { Icon } from '../ui/icons';
import { nodeLabel, readAddForm } from './addForm';
import { AddFormEditor, NewFormMenu } from './AddFormEditor';
import { EntityList } from './EntityList';
import { learn } from './viewActions';
import { readView, type ViewDoc } from './views';
import { SchemaEditor } from './SchemaEditor';
import { SCHEMA_PARTS, type SchemaPart } from './parts';
import { STEP_WORDS } from './selection';
import { OriginTag, useBusy, useCtx } from './ui';
import { TexText } from '../ui/tex/Tex';

type Go = (...tail: string[]) => void;

/* -- Dodaj ----------------------------------------------------------------------------------------- */

/** Was ein Sposób dodawania anlegt und was man oben einmal wählt — in Worten, ohne den Graphen. */
function formWords(id: string, data: unknown, look: Parameters<typeof nodeLabel>[1]): { name: string; makes: string[]; picks: string[] } {
  const form = readAddForm(id, data);
  return {
    name: form.name,
    makes: form.graph.nodes.filter((n) => n.type === 'entry').map((n) => nodeLabel(n, look, form.graph)),
    picks: form.graph.nodes.filter((n) => n.type === 'pick').map((n) => nodeLabel(n, look, form.graph))
  };
}

export function AddHub({ go }: { go: Go }) {
  const t = useT();
  const { lib } = useCtx();
  const forms = lib.docs('addform');
  /* Einzelne Einträge: die eigenen Rodzaje (Tekst, Cytat entstehen in ihren Teilen) und die eingebaute Pytanie. */
  const kinds = lib.kinds.filter((k) => !lib.isForeignKind(k.id));
  const single = kinds.some((k) => k.id === 'question') ? kinds : [...kinds, { id: 'question', name: t('cogitaViews.parts.question') }];
  return (
    <div className="cg cg-add" data-add-hub="">
      <section className="cg-card">
        <h3>{t('cogitaViews.parts.addMethods')}</h3>
        {forms.length === 0 ? (
          <p className="cg-muted">{t('cogitaViews.parts.addMethodsHint')} <button type="button" className="wk-link-btn" onClick={() => go('schematy', 'dodawanie')}>{t('cogitaViews.parts.buildInSchemes')}</button></p>
        ) : (
          <ul className="cg-add-list">
            {forms.map((e) => {
              const w = formWords(e.id, e.data, lib.look);
              return (
                <li key={e.id}>
                  <button type="button" className="lib-row cg-card cg-add-item" onClick={() => go('dodaj', e.id)}>
                    <span className="lib-row-title">{w.name} <OriginTag id={e.id} /></span>
                    <span className="lib-row-meta">{w.picks.length > 0 ? t('cogitaViews.parts.makesPicks', { list: w.makes.join(' · ') || '—', picks: w.picks.join(', ') }) : t('cogitaViews.parts.makes', { list: w.makes.join(' · ') || '—' })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="cg-card">
        <h3>{t('cogitaViews.parts.single')}</h3>
        {kinds.length === 0 && <p className="cg-muted">{t('cogitaViews.parts.noKinds')} <button type="button" className="wk-link-btn" onClick={() => go('schematy', 'rodzaje')}>{t('cogitaViews.parts.addKind')}</button></p>}
        <div className="cg-row">
          {single.map((k) => <button key={k.id} type="button" className="wk-btn wk-btn-line" onClick={() => go('dodaj', 'nowy', k.id)}><Icon name="plus" />{k.name}</button>)}
        </div>
      </section>
    </div>
  );
}

/* -- Schematy ---------------------------------------------------------------------------------------- */

export function SchemaHub({ trail, go }: { trail: readonly string[]; go: Go }) {
  const t = useT();
  const sub: SchemaPart = SCHEMA_PARTS.find((p) => p.slug === trail[0])?.slug ?? 'rodzaje';
  const rest = trail[0] === sub ? trail.slice(1) : [];
  const at = (...tail: string[]) => go('schematy', sub, ...tail);
  return (
    <div className="cg" data-schema-hub={sub}>
      <nav className="cg-schema-nav" aria-label={t('cogitaViews.parts.schemes')}>
        {SCHEMA_PARTS.map((p) => (
          <button key={p.slug} type="button" className={p.slug === sub ? 'cg-schema-tab is-on' : 'cg-schema-tab'} aria-current={p.slug === sub ? 'page' : undefined} onClick={() => go('schematy', p.slug)}>
            <span className="cg-schema-name">{t(p.labelKey)}</span>
            <span className="cg-schema-says">{t(p.saysKey)}</span>
          </button>
        ))}
      </nav>
      {sub === 'rodzaje' && <SchemaEditor chosenId={rest[0] ?? null} onChoose={(id) => at(...(id === null ? [] : [id]))} />}
      {sub === 'dodawanie' && (rest[0] === undefined
        ? <AddMethods go={go} />
        : <AddFormEditor formId={rest[0]} onChoose={(id) => at(...(id === null ? [] : [id]))} onBack={() => at()} onRun={(id) => go('dodaj', id)} />)}
      {sub === 'wyswietlanie' && (rest[0] === undefined
        ? <ViewMethods go={go} />
        : <EntityList key={rest[0]} design viewId={rest[0] === 'nowy' ? null : rest[0]} onOpen={(id) => go('wpisy', id)} onView={() => undefined}
          onSaved={(id) => at(id)} onRemoved={() => at()} />)}
    </div>
  );
}

function AddMethods({ go }: { go: Go }) {
  const t = useT();
  const { lib, writes } = useCtx();
  const forms = lib.docs('addform');
  return (
    <div className="cg">
      <div className="cg-row-between">
        <p className="cg-muted">{t('cogitaViews.parts.methodsHint')}</p>
        {writes && <NewFormMenu onMade={(id) => go('schematy', 'dodawanie', id)} />}
      </div>
      {forms.length === 0 ? <p className="wk-empty">{t('cogitaViews.parts.noMethods')}</p> : (
        <ul className="lib-list">
          {forms.map((e) => {
            const w = formWords(e.id, e.data, lib.look);
            return (
              <li key={e.id} className="cg-method">
                <button type="button" className="lib-row" onClick={() => go('schematy', 'dodawanie', e.id)}>
                  <span className="lib-row-title">{w.name} <OriginTag id={e.id} /></span>
                  <span className="lib-row-meta">{w.picks.length > 0 ? t('cogitaViews.parts.makesPicksShort', { list: w.makes.join(' · ') || '—', picks: w.picks.join(', ') }) : t('cogitaViews.parts.makes', { list: w.makes.join(' · ') || '—' })}</span>
                </button>
                <button type="button" className="wk-link-btn" onClick={() => go('dodaj', e.id)}>{t('cogitaViews.parts.fill')}</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


/** Was ein Sposób wyświetlania zeigt — die Rodzaje am Anfang, ob er Verweisen folgt, die Gestalt. */
function viewWords(view: ViewDoc, kindName: (id: string) => string | undefined, t: T): string {
  const kinds = view.steps.filter((s) => s.type === 'source.kind').map((s) => kindName(String((s.config as { kind?: unknown }).kind ?? '')) ?? t('cogitaViews.parts.kind'));
  const follows = view.steps.filter((s) => s.type === 'follow').length;
  const others = view.steps.filter((s) => s.type !== 'source.kind' && s.type !== 'follow' && s.type !== 'filter.rule').map((s) => STEP_WORDS[s.type]?.label.toLowerCase() ?? s.type);
  const from = kinds.length === 0 && others.length === 0 ? t('cogitaViews.parts.allEntries') : [...kinds, ...others].join(' + ');
  const mode = tOr(`cogitaViews.parts.mode.${view.mode}`, view.mode, undefined, t.lang);
  return follows > 0 ? t('cogitaViews.parts.viewWordsFollow', { from, count: follows, mode }) : t('cogitaViews.parts.viewWords', { from, mode });
}

function ViewMethods({ go }: { go: Go }) {
  const t = useT();
  const { lib, writes } = useCtx();
  const views = lib.docs('view');
  const read = useMemo(() => views.map((e) => ({ e, v: readView(e.data) })), [views]);
  return (
    <div className="cg">
      <div className="cg-row-between">
        <p className="cg-muted">{t('cogitaViews.parts.viewsHint')}</p>
        {writes && <button type="button" className="wk-btn" onClick={() => go('schematy', 'wyswietlanie', 'nowy')}><Icon name="plus" />{t('cogitaViews.parts.newView')}</button>}
      </div>
      {read.length === 0 ? <p className="wk-empty">{t('cogitaViews.parts.noViews')}</p> : (
        <ul className="lib-list">
          {read.map(({ e, v }) => (
            <li key={e.id} className="cg-method">
              <button type="button" className="lib-row" onClick={() => go('schematy', 'wyswietlanie', e.id)}>
                <span className="lib-row-title"><TexText text={v.name} /> <OriginTag id={e.id} /></span>
                <span className="lib-row-meta">{viewWords(v, (id) => lib.kind(id)?.name, t)}</span>
              </button>
              <button type="button" className="wk-link-btn" onClick={() => go('wpisy', 'widok', e.id)}>{t('cogitaViews.parts.show')}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -- Vom Eintrag zur Nauka ------------------------------------------------------------------------------ */

/** Unter einem Eintrag der Wiedza: aus ihm lernen — eine Powtórka mit seinen Karten, in der Nauka. */
export function LearnFrom({ id, go }: { id: string; go: Go }) {
  const t = useT();
  const { lib, writes } = useCtx();
  const { busy, failed, run } = useBusy();
  const entity = lib.entity(id);
  if (!writes || entity === undefined) return null;
  return (
    <section className="cg-card cg-learn-from">
      <div className="cg-row-between">
        <span className="cg-muted">{t('cogitaViews.parts.learnFrom')}</span>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(async () => {
          const made = await learn(lib, readView({ mode: 'table', name: lib.label(entity) }), [id], t('cogitaViews.parts.revisionName', { name: lib.label(entity) }));
          go('powtorki', made);
        })}><Icon name="cap" />{t('cogitaViews.parts.learnThis')}</button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
