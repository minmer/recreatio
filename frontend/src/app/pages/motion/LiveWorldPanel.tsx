/**
 * 2026-10-18 — DIE BEDIENUNG EINER WELT (unter oder neben dem Bild): was
 * gegeben ist („Dane": Dinge, an denen nichts zu ändern ist), was man ändert
 * („Ustawiasz": in einem Rätsel jede Eigenschaft eine Zeile — in einer
 * Werkstatt erst ein Ding wählen), das gewählte Ding (was man an ihm
 * einstellt, was an ihm feststeht, seine Anzeigen, Anhängen, Kopieren,
 * Entfernen) und die Werkzeuge in EINER Reihe: prüfen, eine neue Aufgabe,
 * Cofnij/Ponów/Od nowa, die Kamera.
 *
 * <b>Die Reihenfolge ist für das Telefon gemacht</b>: was man anfasst, steht
 * gleich unter dem Bild (und auf einer Bühne bleibt das Bild oben stehen,
 * während der Rest rollt); die Meldung, die Schalter und das Bauen folgen
 * (`WorldMore`).
 *
 * React baut die Elemente; die Werte schreibt die Schleife (`LiveDrawing.tsx`)
 * über `data-prop` (mit `data-row`: das Ding der Zeile, sonst das gewählte),
 * `data-title` (wie ein Ding heisst — „Ciężarek 2 kg" ändert sich mit der
 * Masse), `data-ro` und `data-w`.
 */

import { useState, type ReactNode } from 'react';

import { useT } from '../../core/i18n';
import { Icon } from '../../ui/icons';
import { toNum } from './expr';
import type { Program } from './liveRun';
import type { PropSpec } from './liveModel';
import type { Thing } from './liveThings';
import { predictLabel, propRange, shotOfText, type WorldAct } from './LivePanel';

/** Eine Eigenschaft zum Einstellen: oben Name und Wert, darunter − Schieber + und, wo Platz ist, die Zahl zum Eintippen — so passt es auch schmal neben ein Bild. */
function PropRow({ program, t: thing, p, row, onAct }: { program: Program; t: Thing; p: PropSpec; row: boolean; onAct: (act: WorldAct) => void }) {
  const t = useT();
  const world = program.world!;
  const name = p.label || p.name;
  const edit = (value: number) => onAct({ type: 'edit', id: thing.id, prop: p.name, value });
  const end = () => onAct({ type: 'endEdit' });
  const nudge = (dir: number) => {
    const r = propRange(p, world.bounds(thing, p.name), toNum(thing.env[p.name]));
    edit(toNum(thing.env[p.name]) + dir * r.step);
    end();
  };
  /* Eine Zeile anfassen wählt ihr Ding: das Bild zeigt, was sich gleich bewegt. */
  const pick = () => { if (row && world.selected !== thing.id) onAct({ type: 'select', id: thing.id }); };
  return (
    <div className="lv-control lv-prop" data-prop={p.name} data-row={row ? thing.id : undefined} onPointerDown={pick} onFocus={pick}>
      <span className="lv-prop-head">
        <span className="lv-name">
          {row && <><span className="lv-row-thing" data-title={thing.id} />{' · '}</>}
          {name}
        </span>
        <output className="lv-value" />
      </span>
      <span className="lv-prop-row">
        <button type="button" className="lv-step" aria-label={t('pageMotion.world.less', { name })} onClick={() => nudge(-1)}>−</button>
        {/* Ein Zug am Schieber (bis zum Loslassen) ist EINE Änderung — React meldet `onChange` schon bei jedem Schritt. */}
        <input type="range" aria-label={name}
          onInput={(e) => edit(e.currentTarget.valueAsNumber)} onPointerUp={end} onKeyUp={end} onBlur={end} />
        <button type="button" className="lv-step" aria-label={t('pageMotion.world.more', { name })} onClick={() => nudge(1)}>+</button>
        <label className="lv-prop-num-row">
          <input type="number" inputMode="decimal" className="lv-prop-num" aria-label={t('pageMotion.world.number', { name })}
            onChange={(e) => { const n = toNum(e.currentTarget.value); if (Number.isFinite(n)) edit(n); }}
            onBlur={end} onKeyDown={(e) => { if (e.key === 'Enter') end(); }} />
          {p.unit !== '' && <span className="lv-unit">{p.unit}</span>}
        </label>
      </span>
    </div>
  );
}

/** Ein Werkzeug als Zeichen (mit Namen für Vorleser und Maus). */
function Tool({ icon, label, w, onClick }: { icon: Parameters<typeof Icon>[0]['name']; label: string; w?: string; onClick: () => void }) {
  return (
    <button type="button" className="lv-tool" data-w={w} aria-label={label} title={label} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}

export function WorldMain({ program, selected, version, locked, cameras, predict, onAct, children }: {
  program: Program;
  selected: string | null;
  /** Ändert sich mit dem Bau — dann wird neu gebaut. */
  version: number;
  locked: boolean;
  cameras: boolean;
  /** Der Knopf zum Vermuten steht hier (nicht, wenn draussen geprüft wird). */
  predict: boolean;
  onAct: (act: WorldAct) => void;
  /** Die Meldung (`LiveDrawing` schreibt sie) — sie steht gleich nach den Werkzeugen, dort, wo „Sprawdź" ist. */
  children?: ReactNode;
}) {
  const t = useT();
  const world = program.world;
  if (world === null) return null;
  void version;
  const camTools = cameras && (
    <span className="lv-tool-group" role="group" aria-label={t('pageMotion.world.view')}>
      <Tool icon="plus" label={t('pageMotion.world.zoomIn')} onClick={() => onAct({ type: 'cam', cmd: 'in' })} />
      <Tool icon="minus" label={t('pageMotion.world.zoomOut')} onClick={() => onAct({ type: 'cam', cmd: 'out' })} />
      <Tool icon="fit" label={t('pageMotion.world.fit')} w="fit" onClick={() => onAct({ type: 'cam', cmd: 'fit' })} />
    </span>
  );
  /* Nur ansehen (eine Antwort, die nachgespielt wird): nichts zu bauen — nur der Blick. */
  if (locked) return <div className="lv-world-panel">{cameras && <div className="lv-actions">{camTools}</div>}{children}</div>;

  const rows = world.rows();
  const thing = selected === null ? undefined : world.get(selected);
  const given = world.ordered().filter((x) => world.fixed(x));
  const listed = new Set(rows?.map((r) => r.t) ?? []);
  /* Am gewählten Ding: was man einstellt (stehen sie schon als Zeilen da, nicht noch einmal), was feststeht, was es anzeigt. */
  const editable = thing === undefined ? [] : world.editable(thing);
  const props = thing === undefined || listed.has(thing) ? [] : editable;
  const still = thing === undefined ? [] : thing.kind.spec.props.filter((p) => p.label !== '' && !p.quiet && world.applies(thing, p.name) && !editable.includes(p));
  const readouts = thing?.kind.spec.readouts ?? [];
  const addKinds = thing === undefined ? [] : world.addable(thing);
  const label = (kind: string) => world.kinds.get(kind)?.spec.label ?? kind;
  const hint = program.hintText();
  return (
    <div className="lv-world-panel">
      {given.length > 0 && given.length < world.ordered().length && (
        <div className="lv-given" role="group" aria-label={t('pageMotion.world.givenGroup')}>
          <span className="lv-group-label"><Icon name="lock" />{t('pageMotion.world.given')}</span>
          {given.map((x) => (
            <button key={x.id} type="button" className="lv-chip" data-title={x.id} aria-pressed={selected === x.id}
              onClick={() => onAct({ type: 'select', id: selected === x.id ? null : x.id })} />
          ))}
        </div>
      )}
      {rows !== null && rows.length > 0 && (
        <div className="lv-rows" role="group" aria-label={t('pageMotion.world.youSet')}>
          <span className="lv-group-label"><Icon name="settings" />{t('pageMotion.world.youSet')}</span>
          {rows.flatMap((r) => r.props.map((p) => <PropRow key={`${r.t.id}.${p.name}`} program={program} t={r.t} p={p} row onAct={onAct} />))}
        </div>
      )}
      <div className="lv-actions" role="toolbar" aria-label={t('pageMotion.world.tools')}>
        {predict && program.predict !== null && (
          <button type="button" className={`wk-btn lv-predict${program.held ? '' : ' wk-btn-line'}`} data-w="predict" aria-pressed={program.held}
            onClick={() => onAct({ type: 'predict' })}>
            {predictLabel(program)}
          </button>
        )}
        {program.redraws() && (
          <button type="button" className="wk-btn wk-btn-line lv-new" data-w="task" onClick={() => onAct({ type: 'task' })}>
            <Icon name="shuffle" />{program.task?.again}
          </button>
        )}
        <span className="lv-tool-group" role="group" aria-label={t('pageMotion.world.changes')}>
          <Tool icon="undo" label={t('pageMotion.world.undo')} w="undo" onClick={() => onAct({ type: 'undo' })} />
          <Tool icon="redo" label={t('pageMotion.world.redo')} w="redo" onClick={() => onAct({ type: 'redo' })} />
          <Tool icon="history" label={t('pageMotion.world.reset')} w="reset" onClick={() => onAct({ type: 'reset' })} />
        </span>
        {/* Wer vermuten soll, hält die Welt mit dem Knopf zum Vermuten an und lässt sie los — ein eigenes „Pauza" bräuchte es dann nicht. */}
        {program.sim !== null && program.predict === null && (
          <button type="button" className="wk-btn wk-btn-line" data-w="toggle" onClick={() => onAct({ type: 'toggle' })}>{t('pageMotion.world.pause')}</button>
        )}
        {camTools}
      </div>
      {children}
      {/* Das gewählte Ding nach den Werkzeugen und der Meldung: wer etwas antippt, schiebt „Sprawdź" nicht weg. */}
      {thing !== undefined && (
        <section className={`lv-inspector${world.fixed(thing) ? ' is-given' : ''}`} aria-label={world.title(thing)}>
          <header className="lv-inspector-head">
            <strong data-title={thing.id} />
            <span className="lv-badge">{world.fixed(thing) ? <><Icon name="lock" />{t('pageMotion.world.givenBadge')}</> : <><Icon name="settings" />{t('pageMotion.world.changeBadge')}</>}</span>
            <button type="button" className="lv-close" aria-label={t('common.close')} onClick={() => onAct({ type: 'select', id: null })}>×</button>
          </header>
          {props.map((p) => <PropRow key={p.name} program={program} t={thing} p={p} row={false} onAct={onAct} />)}
          {(still.length > 0 || readouts.length > 0) && (
            <div className="lv-readouts">
              {still.map((p) => (
                <div key={p.name} className="lv-control lv-readout is-given" data-prop={p.name}>
                  <span className="lv-name"><Icon name="lock" />{p.label}</span>
                  <output className="lv-value" />
                </div>
              ))}
              {readouts.map((r, i) => (
                <div key={i} className="lv-control lv-readout" data-ro={i}>
                  <span className="lv-name">{r.label}</span>
                  <output className="lv-value" />
                </div>
              ))}
            </div>
          )}
          {(addKinds.length > 0 || world.canCopy(thing) || world.canRemove(thing)) && (
            <div className="lv-thing-actions">
              {addKinds.map((k) => (
                <button key={k} type="button" className="wk-btn wk-btn-line" onClick={() => onAct({ type: 'add', kind: k, parent: thing.id })}>+ {label(k)}</button>
              ))}
              {world.canCopy(thing) && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct({ type: 'copy', id: thing.id })}>{t('pageMotion.world.duplicate')}</button>}
              {world.canRemove(thing) && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct({ type: 'remove', id: thing.id })}>{t('common.remove')}</button>}
            </div>
          )}
        </section>
      )}
      {thing === undefined && hint !== '' && <p className="lv-hint">{hint}</p>}
    </div>
  );
}

/** Was nach der Meldung und den Schaltern kommt: neue Dinge ganz oben, Speichern, Laden, der Bau als JSON (die Werkstatt). */
export function WorldMore({ program, version, locked, onAct }: {
  program: Program;
  version: number;
  locked: boolean;
  onAct: (act: WorldAct) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [textBad, setTextBad] = useState(false);
  const t = useT();
  const world = program.world;
  void version;
  if (world === null || locked) return null;
  const roots = world.addable(null);
  const label = (kind: string) => world.kinds.get(kind)?.spec.label ?? kind;
  if (roots.length === 0 && !world.spec.save) return null;
  return (
    <div className="lv-world-more">
      {roots.length > 0 && (
        <div className="lv-add" role="group" aria-label={t('common.add')}>
          {roots.map((k) => (
            <button key={k} type="button" className="wk-btn wk-btn-line" onClick={() => onAct({ type: 'add', kind: k, parent: null })}>+ {label(k)}</button>
          ))}
        </div>
      )}
      {world.spec.save && (
        <div className="lv-add" role="group" aria-label={t('pageMotion.world.layout')}>
          <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct({ type: 'save' })}>{t('common.save')}</button>
          <button type="button" className="wk-btn wk-btn-line" data-w="load" onClick={() => onAct({ type: 'load' })}>{t('pageMotion.world.load')}</button>
          <button type="button" className="wk-btn wk-btn-line" aria-expanded={text !== null}
            onClick={() => { setTextBad(false); setText(text === null ? JSON.stringify(program.worldSnapshot(), null, 1) : null); }}>{'JSON'}</button>
        </div>
      )}
      {text !== null && (
        <div className="lv-json">
          <textarea value={text} rows={6} spellCheck={false} aria-label={t('pageMotion.world.layoutJson')} onChange={(e) => { setText(e.currentTarget.value); setTextBad(false); }} />
          <button type="button" className="wk-btn" onClick={() => {
            const shot = shotOfText(text);
            if (shot === null) { setTextBad(true); return; }
            onAct({ type: 'import', shot });
            setText(null);
          }}>{t('pageMotion.world.loadThis')}</button>
          {textBad && <p className="wk-error">{t('pageMotion.world.notLayout')}</p>}
        </div>
      )}
    </div>
  );
}
