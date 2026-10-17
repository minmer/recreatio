/**
 * Die Einstellungen eines Slajds am Rand des Editors: Bewegung, Bühne, Begleiter, Anordnung, Farben.
 */

import type { DraftPart } from '../page';
import { slideLabelOf } from './PageSlides';
import { ALIGNS3, type Align3, COLOR_KEYS, ENTERS, ENTER_LABEL, type Enter, STAGE_FRAME, type SlideColors, type SlideLayout, type SlideLook, type StageFrame, TRANSITIONS, TRANSITION_LABEL, type Transition } from './slides';
import { DEFAULT_THEMES, type Look, type Theme, type ThemeMode } from './slideLook';

/* -- 0084: der Wechsel, die Farben, die Bühne ------------------------------------- */

/** Wie der Slajd den vorigen ablöst, wie sein Inhalt erscheint, und seine eigenen Farben. */
export function MotionEditor({ slide, first, busy, onChange }: {
  slide: SlideLook;
  /** Der erste Slajd hat keinen vorigen — sein Übergang zeigt sich nie. */
  first: boolean;
  busy: boolean;
  onChange: (next: SlideLook) => void;
}) {
  const colors: SlideColors = slide.colors ?? { accent: null, ink: null, ground: null, muted: null };
  const setColor = (key: (typeof COLOR_KEYS)[number], value: string) => {
    const next: SlideColors = { ...colors, [key]: value.trim() === '' ? null : value };
    onChange({ ...slide, colors: COLOR_KEYS.some((k) => next[k] !== null) ? next : null });
  };
  const COLOR_LABEL: Record<(typeof COLOR_KEYS)[number], string> = { accent: 'Akcent', ink: 'Tekst', ground: 'Tło', muted: 'Tekst drugi' };

  return (
    <div className="se-motion">
      <label className="wk-field">
        <span>Jak ten slajd zastępuje poprzedni</span>
        <select value={slide.transition} disabled={busy} onChange={(e) => onChange({ ...slide, transition: e.target.value as Transition })}>
          {TRANSITIONS.map((t) => <option key={t} value={t}>{TRANSITION_LABEL[t]}</option>)}
        </select>
        <span className="wk-hint">
          {first
            ? 'To pierwszy slajd — przejście zobaczysz dopiero na następnych.'
            : 'Przejście idzie za przewijaniem: wolno przeciągnięte — wolno się dzieje, cofnięte — cofa się. Przy ustawieniu „mniej ruchu” w systemie zamienia się w przenikanie.'}
        </span>
      </label>
      <label className="wk-field">
        <span>Jak pojawia się treść</span>
        <select value={slide.enter} disabled={busy} onChange={(e) => onChange({ ...slide, enter: e.target.value as Enter })}>
          {ENTERS.map((t) => <option key={t} value={t}>{ENTER_LABEL[t]}</option>)}
        </select>
      </label>
      <div className="se-colors">
        <span className="wk-hint">Własne kolory tego slajdu (puste — jak strona). Między slajdami kolory przechodzą płynnie, także pasek z nazwami slajdów.</span>
        {COLOR_KEYS.map((key) => (
          <ColorField key={key} label={COLOR_LABEL[key]} value={colors[key] ?? ''} busy={busy} allowEmpty onChange={(v) => setColor(key, v)} />
        ))}
      </div>
    </div>
  );
}

/** Szybkie miejsca na scenie. */
const PLACES: readonly { label: string; frame: Partial<StageFrame> }[] = [
  { label: 'Środek', frame: { x: 50, y: 50 } },
  { label: 'Lewy górny', frame: { x: 18, y: 18 } },
  { label: 'Prawy górny', frame: { x: 82, y: 18 } },
  { label: 'Lewy dolny', frame: { x: 18, y: 82 } },
  { label: 'Prawy dolny', frame: { x: 82, y: 82 } },
  { label: 'Schowany', frame: { opacity: 0, scale: 0.6 } }
];

/**
 * DIE PLÄTZE EINES WANDERNDEN BAUSTEINS — je Slajd einer, oder keiner: dann
 * gleitet er zwischen den Nachbarn hindurch (vor dem ersten und nach dem
 * letzten bleibt er stehen).
 */
export function StageEditor({ slide, deck, busy, onChange, onShow }: {
  slide: SlideLook;
  deck: readonly { key: string; label: string }[];
  busy: boolean;
  onChange: (next: SlideLook) => void;
  onShow: (key: string) => void;
}) {
  const stage = slide.stage!;
  const setFrame = (key: string, frame: StageFrame | null) => {
    const frames = { ...stage.frames };
    if (frame === null) delete frames[key]; else frames[key] = frame;
    onChange({ ...slide, stage: { ...stage, frames } });
  };
  const nearest = (index: number): StageFrame => {
    for (let i = index; i >= 0; i -= 1) { const f = stage.frames[deck[i].key]; if (f !== undefined) return f; }
    return STAGE_FRAME;
  };

  return (
    <div className="se-stage">
      <label className="wk-check">
        <input type="checkbox" checked={stage.bare} disabled={busy}
          onChange={(e) => onChange({ ...slide, stage: { ...stage, bare: e.target.checked } })} />
        <span>Bez ramki (logo, obraz, sam napis)</span>
      </label>
      <p className="wk-hint">
        Miejsce na każdym slajdzie: środek modułu w procentach sceny (x — od lewej, y — od góry), szerokość w procentach
        (na telefonie większa). Slajd bez własnego miejsca — moduł przepływa przez niego między sąsiednimi.
      </p>
      <ol className="se-stage-list">
        {deck.map((one, index) => {
          const frame = stage.frames[one.key];
          return (
            <li key={one.key} className={frame === undefined ? 'se-stage-slide' : 'se-stage-slide is-set'}>
              <div className="se-stage-head">
                <label className="wk-check">
                  <input type="checkbox" checked={frame !== undefined} disabled={busy}
                    onChange={(e) => setFrame(one.key, e.target.checked ? nearest(index) : null)} />
                  <span>{index + 1}. {one.label}</span>
                </label>
                <button type="button" className="wk-link-btn" onClick={() => onShow(one.key)}>pokaż</button>
              </div>
              {frame !== undefined && (
                <>
                  <div className="se-stage-places">
                    {PLACES.map((p) => (
                      <button key={p.label} type="button" className="wk-link-btn" disabled={busy}
                        onClick={() => setFrame(one.key, { ...frame, opacity: 1, scale: frame.scale < 0.7 ? 1 : frame.scale, ...p.frame })}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <StageNumber label="x %" value={frame.x} min={0} max={100} step={1} busy={busy} onChange={(x) => setFrame(one.key, { ...frame, x })} />
                  <StageNumber label="y %" value={frame.y} min={0} max={100} step={1} busy={busy} onChange={(y) => setFrame(one.key, { ...frame, y })} />
                  <StageNumber label="Szerokość %" value={frame.w} min={5} max={100} step={1} busy={busy} onChange={(w) => setFrame(one.key, { ...frame, w })} />
                  <StageNumber label="Skala" value={frame.scale} min={0.2} max={3} step={0.05} busy={busy} onChange={(scale) => setFrame(one.key, { ...frame, scale })} />
                  <StageNumber label="Obrót °" value={frame.rotate} min={-180} max={180} step={1} busy={busy} onChange={(rotate) => setFrame(one.key, { ...frame, rotate })} />
                  <StageNumber label="Krycie" value={frame.opacity} min={0} max={1} step={0.05} busy={busy} onChange={(opacity) => setFrame(one.key, { ...frame, opacity })} />
                  <label className="se-inline">
                    <span>Najwyżej (rem)</span>
                    <input type="number" min={1} max={200} value={frame.max ?? ''} placeholder="bez granicy" disabled={busy}
                      onChange={(e) => {
                        const { max: _max, ...rest } = frame;
                        setFrame(one.key, e.target.value.trim() === '' ? rest : { ...rest, max: Math.min(200, Math.max(1, Number(e.target.value))) });
                      }} />
                  </label>
                  <details className="wk-fold se-stage-tall">
                    <summary>Na telefonie{frame.tall != null ? ' (ustawione)' : ''}</summary>
                    <label className="wk-check">
                      <input type="checkbox" checked={frame.tall != null} disabled={busy}
                        onChange={(e) => {
                          const { tall: _tall, ...rest } = frame;
                          setFrame(one.key, e.target.checked ? { ...rest, tall: { x: frame.x, y: frame.y, w: Math.min(92, frame.w * 1.8), scale: frame.scale } } : rest);
                        }} />
                      <span>Inne miejsce na ekranie wyższym niż szeroki</span>
                    </label>
                    {frame.tall != null && (
                      <>
                        <StageNumber label="x %" value={frame.tall.x ?? frame.x} min={0} max={100} step={1} busy={busy} onChange={(x) => setFrame(one.key, { ...frame, tall: { ...frame.tall, x } })} />
                        <StageNumber label="y %" value={frame.tall.y ?? frame.y} min={0} max={100} step={1} busy={busy} onChange={(y) => setFrame(one.key, { ...frame, tall: { ...frame.tall, y } })} />
                        <StageNumber label="Szerokość %" value={frame.tall.w ?? frame.w} min={5} max={100} step={1} busy={busy} onChange={(w) => setFrame(one.key, { ...frame, tall: { ...frame.tall, w } })} />
                        <StageNumber label="Skala" value={frame.tall.scale ?? frame.scale} min={0.2} max={3} step={0.05} busy={busy} onChange={(scale) => setFrame(one.key, { ...frame, tall: { ...frame.tall, scale } })} />
                        <StageNumber label="Krycie" value={frame.tall.opacity ?? frame.opacity} min={0} max={1} step={0.05} busy={busy} onChange={(opacity) => setFrame(one.key, { ...frame, tall: { ...frame.tall, opacity } })} />
                      </>
                    )}
                  </details>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function StageNumber({ label, value, min, max, step, busy, onChange }: {
  label: string; value: number; min: number; max: number; step: number; busy: boolean; onChange: (value: number) => void;
}) {
  return (
    <label className="se-inline">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={busy} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}</output>
    </label>
  );
}

/** Neben welchem Baustein, auf welcher Seite, wie breit — und auf dem Telefon darüber oder darunter. */
export function CompanionEditor({ slide, mains, busy, onChange }: {
  slide: SlideLook;
  mains: readonly DraftPart[];
  busy: boolean;
  onChange: (next: SlideLook) => void;
}) {
  const now = slide.with!;
  const set = (patch: Partial<typeof now>) => onChange({ ...slide, with: { ...now, ...patch } });
  return (
    <div className="se-companion">
      <label className="se-inline">
        <span>Obok</span>
        <select value={now.slide} disabled={busy} onChange={(e) => set({ slide: e.target.value })}>
          {mains.map((p) => <option key={p.id} value={p.id}>{slideLabelOf(p)}</option>)}
        </select>
      </label>
      <label className="se-inline">
        <span>Z której strony</span>
        <select value={now.side} disabled={busy} onChange={(e) => set({ side: e.target.value === 'start' ? 'start' : 'end' })}>
          <option value="end">Po prawej</option>
          <option value="start">Po lewej</option>
        </select>
      </label>
      <label className="se-inline">
        <span>Szerokość (% rzędu)</span>
        <input type="number" min={10} max={90} value={now.share} disabled={busy} onChange={(e) => set({ share: Math.min(90, Math.max(10, Number(e.target.value) || 45)) })} />
      </label>
      <label className="se-inline">
        <span>Na telefonie</span>
        <select value={now.tallSide} disabled={busy} onChange={(e) => set({ tallSide: e.target.value === 'start' ? 'start' : 'end' })}>
          <option value="start">Nad nim</option>
          <option value="end">Pod nim</option>
        </select>
      </label>
    </div>
  );
}

const ALIGN_LABEL: Record<Align3, string> = { start: 'Z lewej', center: 'Na środku', end: 'Z prawej' };

const VALIGN_LABEL: Record<Align3, string> = { start: 'U góry', center: 'Na środku', end: 'Na dole' };

/** Wo der Inhalt des Slajds steht — und auf einem hohen Schirm (Telefon). */
export function LayoutEditor({ slide, busy, onChange }: { slide: SlideLook; busy: boolean; onChange: (next: SlideLook) => void }) {
  const layout: SlideLayout = slide.layout ?? { align: 'center', valign: 'center', width: null, tall: null };
  const set = (patch: Partial<SlideLayout>) => {
    const next = { ...layout, ...patch };
    const plain = next.align === 'center' && next.valign === 'center' && next.width === null && next.tall === null;
    onChange({ ...slide, layout: plain ? null : next });
  };
  const tall = layout.tall ?? {};
  const setTall = (patch: Record<string, unknown>) => {
    const next = { ...tall, ...patch };
    for (const key of Object.keys(next)) if ((next as Record<string, unknown>)[key] === undefined) delete (next as Record<string, unknown>)[key];
    set({ tall: Object.keys(next).length === 0 ? null : next });
  };
  const width = (value: string): number | null => (value.trim() === '' ? null : Math.min(100, Math.max(10, Number(value))));
  return (
    <div className="se-layout">
      <p className="wk-hint">Gdzie stoi treść slajdu w scenie (szerokość sceny — w „Całość pokazu”). Puste — na środku, wygodna szerokość tekstu.</p>
      <label className="se-inline"><span>W poziomie</span>
        <select value={layout.align} disabled={busy} onChange={(e) => set({ align: e.target.value as Align3 })}>
          {ALIGNS3.map((a) => <option key={a} value={a}>{ALIGN_LABEL[a]}</option>)}
        </select>
      </label>
      <label className="se-inline"><span>W pionie</span>
        <select value={layout.valign} disabled={busy} onChange={(e) => set({ valign: e.target.value as Align3 })}>
          {ALIGNS3.map((a) => <option key={a} value={a}>{VALIGN_LABEL[a]}</option>)}
        </select>
      </label>
      <label className="se-inline"><span>Szerokość (% sceny)</span>
        <input type="number" min={10} max={100} value={layout.width ?? ''} placeholder="zwykła" disabled={busy} onChange={(e) => set({ width: width(e.target.value) })} />
      </label>
      <fieldset className="se-layout-tall">
        <legend>Na telefonie (ekran wyższy niż szeroki)</legend>
        <label className="se-inline"><span>W pionie</span>
          <select value={tall.valign ?? ''} disabled={busy} onChange={(e) => setTall({ valign: e.target.value === '' ? undefined : e.target.value })}>
            <option value="">jak wyżej</option>
            {ALIGNS3.map((a) => <option key={a} value={a}>{VALIGN_LABEL[a]}</option>)}
          </select>
        </label>
        <label className="se-inline"><span>Szerokość (%)</span>
          <input type="number" min={10} max={100} value={tall.width ?? ''} placeholder="jak wyżej" disabled={busy}
            onChange={(e) => setTall({ width: e.target.value.trim() === '' ? undefined : width(e.target.value) })} />
        </label>
      </fieldset>
    </div>
  );
}

/* -- Das Thema ------------------------------------------------------------------ */

type ThemeChoice = 'auto' | ThemeMode;

export function ThemeEditor({ look, busy, onChange, legend = 'Wygląd slajdów' }: { look: Look; busy: boolean; onChange: (next: Look) => void; legend?: string }) {
  const choice: ThemeChoice = look.theme === null ? 'auto' : look.theme.mode;

  const pick = (next: ThemeChoice) => {
    if (next === choice) return;
    /* Wer den Modus wechselt, bekommt dessen Farben — dunkle Schrift auf dunklem Grund hilft niemandem. */
    onChange({ ...look, theme: next === 'auto' ? null : DEFAULT_THEMES[next] });
  };

  const set = (key: keyof Omit<Theme, 'mode'>, value: string) => {
    if (look.theme === null) return;
    onChange({ ...look, theme: { ...look.theme, [key]: value } });
  };

  return (
    <fieldset className="se-theme">
      <legend>{legend}</legend>
      <div className="wk-seg" role="group" aria-label="Motyw">
        {([['auto', 'Jak aplikacja'], ['dark', 'Ciemny'], ['light', 'Jasny']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={choice === value} disabled={busy}
            className={choice === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} onClick={() => pick(value)}>
            {label}
          </button>
        ))}
      </div>
      {look.theme === null ? (
        <p className="wk-hint">Kolory strony — jasne albo ciemne, tak jak urządzenie gościa.</p>
      ) : (
        <div className="se-colors">
          <ColorField label="Akcent" value={look.theme.accent} busy={busy} onChange={(v) => set('accent', v)} />
          <ColorField label="Tekst" value={look.theme.ink} busy={busy} onChange={(v) => set('ink', v)} />
          <ColorField label="Tło" value={look.theme.ground} busy={busy} onChange={(v) => set('ground', v)} />
          <ColorField label="Tekst drugi" value={look.theme.muted} busy={busy} onChange={(v) => set('muted', v)} />
          <button type="button" className="wk-link-btn" disabled={busy}
            onClick={() => onChange({ ...look, theme: DEFAULT_THEMES[look.theme!.mode] })}>
            Przywróć kolory
          </button>
        </div>
      )}
    </fieldset>
  );
}

const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value.trim());

/** Eine Farbe — mit dem Wähler des Systems und als Text, für den, der die Nummer kennt. */
export function ColorField({ label, value, busy, onChange, allowEmpty = false }: {
  label: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <label className="se-color">
      <span>{label}</span>
      <input type="color" value={isHex(value) ? value : '#000000'} disabled={busy} onChange={(e) => onChange(e.target.value)} />
      <input className="se-color-text" value={value} disabled={busy} maxLength={60}
        placeholder={allowEmpty ? 'jak tekst' : '#000000'} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
