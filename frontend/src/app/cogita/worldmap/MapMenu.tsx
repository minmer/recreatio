/**
 * 2026-11-24 (Eigentümer: „das Menü als Hamburger oben links, darin alles") — DAS MENÜ DER KARTE: ein ☰ oben links (daneben, was die
 * Karte gerade zeigt, und „Prowadzę", wenn man leitet). Darin alles, was man an der Karte einstellt: was sie zeigt (die Modi),
 * „Sprawdź, co wiesz", Vollbild oder Seite, und der Teil der Klasse (Textgrösse, „Prowadzę / Uczę się", die Klasse — aus
 * `lesson/MapClassTools.tsx`). Eine Wahl schliesst das Menü; Esc und ein Klick daneben auch.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { T } from '../../core/i18n';

export interface MapMenuMode {
  readonly key: string;
  readonly label: string;
}

export function MapMenu({ modes, shown, onMode, onCheck, checkLabel, onFull, full = null, onExit, classBody, teaching, classes = [], live = null, t }: {
  modes: readonly MapMenuMode[];
  shown: string;
  onMode: (key: string) => void;
  /** „Sprawdź, co wiesz" — nur für einen Lernenden. */
  onCheck: (() => void) | null;
  checkLabel: string;
  /** Vollbild / als Seite (im Vollbild: in die andere Art wechseln). */
  onFull: ((how: 'screen' | 'page') => void) | null;
  /** 2026-11-24 — die Karte steht im Vollbild (`screen`) oder als Seite (`page`): dann auch „Zamknij". */
  full?: 'screen' | 'page' | null;
  onExit?: () => void;
  /** 2026-11-24 — „Widoczne dla klasy…": je Klasse, die ich leite, die Wahl auf der Karte (`ClassSelect.tsx`). */
  classes?: readonly { readonly key: string; readonly label: string; readonly onPick: () => void }[];
  /** 2026-11-24 (Tryb prowadzony) — „Prowadź klasę na żywo" je Klasse, oder, läuft es schon, „Zakończ prowadzenie". */
  live?: { readonly on: boolean; readonly onStop: () => void; readonly classes: readonly { readonly key: string; readonly label: string; readonly onPick: () => void }[] } | null;
  /** Der Teil der Klasse (Textgrösse, Prowadzę / Uczę się, Klasse). */
  classBody: ReactNode;
  teaching: boolean;
  t: T;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e: PointerEvent) => { if (box.current !== null && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc, true); };
  }, [open]);
  const current = modes.find((m) => m.key === shown)?.label ?? '';
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };

  return (
    <div className="cg-wm-menuhost" ref={box}>
      <button type="button" className={`cg-wm-menubtn${teaching ? ' is-teaching' : ''}`} aria-expanded={open} aria-haspopup="dialog"
        aria-label={t('cogitaWorld.menu.open')} title={t('cogitaWorld.menu.open')} onClick={() => setOpen((v) => !v)}
        data-world-menu={open ? 'open' : 'closed'} data-class-menu="" data-world-modes={shown}>
        <span className="cg-wm-burger" aria-hidden="true"><span /><span /><span /></span>
        <span className="cg-wm-menunow">{current}{teaching ? ` · ${t('cogitaLesson.menu.leading')}` : ''}</span>
      </button>
      {open && (
        <div className="cg-wm-menu" role="dialog" aria-label={t('cogitaWorld.menu.title')} data-class-pop="" data-world-menu-panel="">
          <section className="cg-wm-menusec">
            <h3>{t('cogitaWorld.menu.show')}</h3>
            <div role="group" aria-label={t('cogitaWorld.menu.show')} className="cg-wm-menulist">
              {modes.map((m) => (
                <button key={m.key} type="button" className={`cg-wm-menuitem${shown === m.key ? ' is-on' : ''}`} aria-pressed={shown === m.key}
                  onClick={pick(() => onMode(m.key))} data-world-mode={m.key}>{m.label}</button>
              ))}
            </div>
          </section>
          {onCheck !== null && (
            <section className="cg-wm-menusec">
              <button type="button" className="wk-btn cg-wm-menucheck" onClick={pick(onCheck)} data-world-selfcheck="">{checkLabel}</button>
            </section>
          )}
          {onFull !== null && (
            <section className="cg-wm-menusec">
              <h3>{t('cogitaWorld.menu.view')}</h3>
              <div className="cg-wm-menulist">
                {full !== 'screen' && <button type="button" className="cg-wm-menuitem" onClick={pick(() => onFull('screen'))} title={t('cogitaWorld.map.fullSays')} data-world-menu-full="screen">⛶ {t('cogitaWorld.map.fullOn')}</button>}
                {full !== 'page' && <button type="button" className="cg-wm-menuitem" onClick={pick(() => onFull('page'))} title={t('cogitaWorld.map.pageSays')} data-world-menu-full="page">▣ {t('cogitaWorld.map.pageOn')}</button>}
                {full !== null && onExit !== undefined && <button type="button" className="cg-wm-menuitem" onClick={pick(onExit)} title={t('cogitaWorld.map.fullOff')} data-world-menu-full="exit">× {t('cogitaWorld.map.fullOff')}</button>}
              </div>
            </section>
          )}
          {classes.length > 0 && (
            <section className="cg-wm-menusec" data-world-menu-classes={classes.length}>
              <h3>{t('cogitaClassMap.menu')}</h3>
              <div className="cg-wm-menulist">
                {classes.map((c) => <button key={c.key} type="button" className="cg-wm-menuitem" onClick={pick(c.onPick)} data-world-menu-class={c.key}>{c.label}</button>)}
              </div>
            </section>
          )}
          {live !== null && (live.on || live.classes.length > 0) && (
            <section className="cg-wm-menusec" data-world-menu-live={live.on ? 'on' : live.classes.length}>
              <h3>{t('cogitaFollow.menu.title')}</h3>
              <div className="cg-wm-menulist">
                {live.on
                  ? <button type="button" className="cg-wm-menuitem" onClick={pick(live.onStop)} data-follow-menu-stop="">■ {t('cogitaFollow.menu.stop')}</button>
                  : live.classes.map((c) => <button key={c.key} type="button" className="cg-wm-menuitem" onClick={pick(c.onPick)} data-follow-menu-start={c.key}>● {t('cogitaFollow.menu.start', { name: c.label })}</button>)}
              </div>
            </section>
          )}
          {classBody !== null && classBody !== undefined && classBody !== false && <section className="cg-wm-menusec">{classBody}</section>}
        </div>
      )}
    </div>
  );
}
