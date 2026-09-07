/**
 * Edycja jednej części.
 *
 * <b>Wszystko, co swoiste dla rodzaju, przychodzi z jego modułu</b> — ten plik
 * nigdy nie dowiaduje się, czym jest mapa albo plan. Tak było w starym module i
 * tak zostaje: dodanie rodzaju to jeden plik i wpis w rejestrze.
 *
 * <b>„Niezapisane" stoi w nagłówku.</b> Część zapisuje się przyciskiem, nie przy
 * każdym klawiszu — inaczej z na wpół napisanego słowa robi się wersja, a z
 * pomyłki wersja już opublikowana. Skoro tak, to musi być widać, że coś czeka:
 * edytor zwinięty bez tej informacji zgubiłby zmiany bez słowa.
 *
 * <b>Warstwy są ZWINIĘTE.</b> Tło ustawia się raz i zostawia, a treść nad nim
 * poprawia się bez końca; rozwinięty stos warstw spychał przycisk zapisu poza
 * ekran.
 *
 * <b>Warstwy siedzą w `configJson`, nie w osobnej kolumnie.</b> W starym module
 * miały własną (`layersJson`); tutaj są częścią tego, czym część jest — w
 * dwóch polach rozjeżdżały się przy kopiowaniu: tekst szedł dalej, barwa
 * zostawała. Edytor rozdziela je tylko na czas edycji i skleja przy zapisie.
 */

import { useEffect, useState } from 'react';

import { rcUpdatePart } from '../lib/rcEvents';
import { rcDeletePart } from '../lib/rcEventEditing';
import { CheckRow, TextRow } from './parts/editorKit';
import { LayerEditor } from './parts/LayerEditor';
import { getPartModule, partLabel } from './parts/registry';
import type { EventPart } from './parts/contracts';
import type { ThemeMode } from './shell/layers';

/**
 * Warstwy wyjęte z konfiguracji — i z powrotem.
 *
 * Zepsuty JSON kosztuje warstwy, nie część: bez tła jest skromniej, bez treści
 * nie ma jej wcale.
 */
function splitConfig(configJson: string | null): { rest: Record<string, unknown>; layers: string | null } {
  if (configJson === null || configJson.trim() === '') return { rest: {}, layers: null };

  try {
    const parsed: unknown = JSON.parse(configJson);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { rest: {}, layers: null };
    }

    const { layers, ...rest } = parsed as Record<string, unknown>;
    return { rest, layers: layers === undefined ? null : JSON.stringify(layers, null, 2) };
  } catch {
    return { rest: {}, layers: null };
  }
}

function joinConfig(rest: string, layers: string | null): string {
  let base: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(rest === '' ? '{}' : rest);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      base = parsed as Record<string, unknown>;
    }
  } catch { /* Zepsuta konfiguracja i tak nie przejdzie dalej. */ }

  if (layers !== null && layers.trim() !== '') {
    try { base.layers = JSON.parse(layers) as unknown; } catch { /* zostaw bez tła */ }
  } else {
    delete base.layers;
  }

  return JSON.stringify(base, null, 2);
}

export function RcPartEditor({
  part, mode, isFirst, isLast, pageKind, onMove, onChanged, onError
}: {
  part: EventPart;
  /** Tryb barw wydarzenia, żeby nowe tło zaczynało na właściwym gruncie. */
  mode: ThemeMode;
  isFirst: boolean;
  isLast: boolean;
  pageKind: 'public' | 'internal';
  onMove: (direction: -1 | 1) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const module = getPartModule(part.kind);
  const initial = splitConfig(part.configJson ?? null);

  const [open, setOpen] = useState(false);
  const [menuLabel, setMenuLabel] = useState(part.menuLabel ?? '');
  const [title, setTitle] = useState(part.title ?? '');
  const [intro, setIntro] = useState(part.intro ?? '');
  const [isVisible, setIsVisible] = useState(part.isVisible);
  const [config, setConfig] = useState(JSON.stringify(initial.rest, null, 2));
  const [layers, setLayers] = useState<string | null>(initial.layers);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);

  /*
   * Ponowne wczytanie, gdy kopia z serwera zmieni się pod spodem — po
   * przestawieniu kolejności albo edycji pól. Bez tego następny zapis wysłałby
   * stan sprzed tamtej zmiany i po cichu ją cofnął.
   */
  useEffect(() => {
    const fresh = splitConfig(part.configJson ?? null);
    setMenuLabel(part.menuLabel ?? '');
    setTitle(part.title ?? '');
    setIntro(part.intro ?? '');
    setIsVisible(part.isVisible);
    setConfig(JSON.stringify(fresh.rest, null, 2));
    setLayers(fresh.layers);
    setDirty(false);
  }, [part]);

  /* Część, której czytelnik nie otworzy, nie ma w odpowiedzi ani treści, ani
     ustawień — tylko powód. Edytować ją znaczyłoby nadpisać ją pustką. */
  const locked = (part.unreadable ?? null) !== null;

  const save = async () => {
    setPending(true);
    try {
      await rcUpdatePart(part.partId, {
        menuLabel: menuLabel.trim() || partLabel(part.kind),
        title: title.trim(),
        intro: intro.trim(),
        configJson: joinConfig(config, layers),
        isVisible
      });
      setDirty(false);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Nie udało się zapisać części.');
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Usunąć część „${part.menuLabel ?? part.kind}"? Tej operacji nie można cofnąć.`)) return;
    setPending(true);
    try {
      await rcDeletePart(part.partId);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Nie udało się usunąć części.');
      setPending(false);
    }
  };

  return (
    <article className={`eva-part${isVisible ? '' : ' is-hidden'}`}>
      <header className="eva-part-head">
        <button type="button" className="eva-part-toggle" onClick={() => setOpen(!open)}>
          <span className="eva-kind">{partLabel(part.kind)}</span>
          <strong>{part.menuLabel ?? part.title ?? partLabel(part.kind)}</strong>
          {!part.isPublic && <span className="eva-tag" title="Zapieczętowane kluczem obszaru">🔒</span>}
          {!part.isVisible && <span className="eva-tag">ukryta</span>}
          {dirty && <span className="eva-tag is-dirty">niezapisane</span>}
        </button>

        <div className="eva-part-tools">
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst} aria-label="Wyżej">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast} aria-label="Niżej">↓</button>
        </div>
      </header>

      {open && (locked ? (
        <div className="eva-part-body"><p className="eva-error">{part.unreadable}</p></div>
      ) : (
        <div className="eva-part-body">
          <TextRow label="Etykieta w menu" value={menuLabel}
            onChange={(next) => { setMenuLabel(next); setDirty(true); }} />
          <TextRow label="Tytuł sekcji" value={title}
            onChange={(next) => { setTitle(next); setDirty(true); }} />
          <TextRow label="Wprowadzenie" value={intro}
            onChange={(next) => { setIntro(next); setDirty(true); }} />
          <CheckRow label="Widoczna na stronie" checked={isVisible}
            onChange={(next) => { setIsVisible(next); setDirty(true); }} />

          {module ? (
            <module.Editor
              configJson={config}
              onChange={(next) => { setConfig(next); setDirty(true); }}
              ctx={{
                part,
                siteId: part.partId,
                pageKind,
                onStructureChanged: onChanged
              }}
            />
          ) : (
            <p className="eva-error">Nieznany typ części: {part.kind}.</p>
          )}

          {/* Zwinięte: tło ustawia się raz, treść poprawia bez końca. */}
          <details className="eva-fold">
            <summary>Grafika i tło</summary>
            <div className="eva-fold-body">
              <LayerEditor
                mode={mode}
                layersJson={layers}
                menuLabel={menuLabel}
                onChange={(next) => { setLayers(next); setDirty(true); }}
              />
            </div>
          </details>

          <div className="eva-actions">
            <button type="button" className="eva-cta" disabled={pending} onClick={() => void save()}>
              {pending ? 'Zapisywanie…' : 'Zapisz część'}
            </button>
            <button type="button" className="eva-danger" disabled={pending} onClick={() => void remove()}>
              Usuń część
            </button>
          </div>
        </div>
      ))}
    </article>
  );
}

export default RcPartEditor;
