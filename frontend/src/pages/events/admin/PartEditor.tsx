import { useEffect, useState } from 'react';
import { deleteEvent2Part, updateEvent2Part, type Event2AdminPart, type Event2Part } from '../../../../lib/api';
import { CheckRow, TextRow } from '../parts/editorKit';
import { getPartModule, partLabel } from '../parts/registry';
import { LayerEditor } from './LayerEditor';

/**
 * Edits one part. Everything specific to the part's kind comes from its module,
 * so this file never learns what a map or a plan is.
 */
export function PartEditor({
  part,
  isFirst,
  isLast,
  onMove,
  onChanged
}: {
  part: Event2AdminPart;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onChanged: () => void;
}) {
  const module = getPartModule(part.kind);

  const [open, setOpen] = useState(false);
  const [menuLabel, setMenuLabel] = useState(part.menuLabel);
  const [title, setTitle] = useState(part.title ?? '');
  const [intro, setIntro] = useState(part.intro ?? '');
  const [isVisible, setIsVisible] = useState(part.isVisible);
  const [configJson, setConfigJson] = useState(part.configJson ?? module?.defaultConfigJson() ?? '{}');
  const [layersJson, setLayersJson] = useState(part.layersJson);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync when the server copy changes underneath (reorder, field edits).
  useEffect(() => {
    setMenuLabel(part.menuLabel);
    setTitle(part.title ?? '');
    setIntro(part.intro ?? '');
    setIsVisible(part.isVisible);
    setConfigJson(part.configJson ?? module?.defaultConfigJson() ?? '{}');
    setLayersJson(part.layersJson);
    setDirty(false);
  }, [module, part]);

  const save = async () => {
    setPending(true);
    setError(null);
    try {
      await updateEvent2Part(part.id, {
        kind: part.kind,
        menuLabel: menuLabel.trim() || partLabel(part.kind),
        title: title.trim() || null,
        intro: intro.trim() || null,
        configJson,
        layersJson,
        isVisible
      });
      setDirty(false);
      onChanged();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Nie udało się zapisać części.');
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Usunąć część „${part.menuLabel}”? Tej operacji nie można cofnąć.`)) return;
    setPending(true);
    try {
      await deleteEvent2Part(part.id);
      onChanged();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć części.');
      setPending(false);
    }
  };

  // The form part edits its fields through the API, outside ConfigJson, so it
  // needs a way to tell the page to refetch.
  const editorPart: Event2Part = {
    id: part.id,
    sortOrder: part.sortOrder,
    kind: part.kind,
    menuLabel: part.menuLabel,
    title: part.title,
    intro: part.intro,
    configJson: part.configJson,
    layersJson: part.layersJson,
    fields: part.fields
  };

  return (
    <article className={`e2a-part ${isVisible ? '' : 'is-hidden'}`}>
      <header className="e2a-part-head">
        <button type="button" className="e2a-part-toggle" onClick={() => setOpen((current) => !current)}>
          <span className="e2a-kind">{partLabel(part.kind)}</span>
          <strong>{part.menuLabel}</strong>
          {!part.isVisible ? <span className="e2a-tag">ukryta</span> : null}
          {dirty ? <span className="e2a-tag is-dirty">niezapisane</span> : null}
        </button>
        <div className="e2a-part-tools">
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst} aria-label="Wyżej">
            ↑
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast} aria-label="Niżej">
            ↓
          </button>
        </div>
      </header>

      {open ? (
        <div className="e2a-part-body">
          <TextRow
            label="Etykieta w menu"
            value={menuLabel}
            onChange={(next) => {
              setMenuLabel(next);
              setDirty(true);
            }}
          />
          <TextRow
            label="Tytuł sekcji"
            value={title}
            onChange={(next) => {
              setTitle(next);
              setDirty(true);
            }}
          />
          <TextRow
            label="Wprowadzenie"
            value={intro}
            onChange={(next) => {
              setIntro(next);
              setDirty(true);
            }}
          />
          <CheckRow
            label="Widoczna na stronie"
            checked={isVisible}
            onChange={(next) => {
              setIsVisible(next);
              setDirty(true);
            }}
          />

          {module ? (
            <module.Editor
              configJson={configJson}
              onChange={(next) => {
                setConfigJson(next);
                setDirty(true);
              }}
              ctx={{ part: editorPart, onStructureChanged: onChanged }}
            />
          ) : (
            <p className="e2a-error">Nieznany typ części: {part.kind}.</p>
          )}

          <LayerEditor
            layersJson={layersJson}
            menuLabel={menuLabel}
            onChange={(next) => {
              setLayersJson(next);
              setDirty(true);
            }}
          />

          {error ? <p className="e2a-error">{error}</p> : null}

          <div className="e2a-actions">
            <button type="button" className="e2a-cta" onClick={() => void save()} disabled={pending}>
              {pending ? 'Zapisywanie…' : 'Zapisz część'}
            </button>
            <button type="button" className="e2a-danger" onClick={() => void remove()} disabled={pending}>
              Usuń część
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
