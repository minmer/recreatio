import { useState } from 'react';
import { createCogitaLibrary, updateRoleField, type CogitaLibrary } from '../../../lib/api';
import type { Copy } from '../../../content/types';

export type CogitaTemplateId = 'vocabulary' | 'knowledgeMap' | 'course' | 'research' | 'flashcards' | 'custom';

export const TEMPLATE_FIELD_TYPE = 'cogita.template';

const TEMPLATE_META: Record<CogitaTemplateId, { icon: string; color: string }> = {
  vocabulary:   { icon: 'Aa', color: '#3a9bd5' },
  knowledgeMap: { icon: '◉',  color: '#8b5cf6' },
  course:       { icon: '▸',  color: '#f59e0b' },
  research:     { icon: '◎',  color: '#10b981' },
  flashcards:   { icon: '⚡', color: '#f97316' },
  custom:       { icon: '✦',  color: '#6b7280' }
};

const TEMPLATE_IDS: CogitaTemplateId[] = ['vocabulary', 'knowledgeMap', 'course', 'research', 'flashcards', 'custom'];

export function CogitaLibraryTemplates({
  copy,
  onCreated,
  onCancel
}: {
  copy: Copy['cogita']['libraryTemplates'];
  onCreated: (library: CogitaLibrary) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<CogitaTemplateId | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError(copy.nameRequired); return; }
    if (!selected) return;
    setCreating(true);
    setError(null);
    try {
      const library = await createCogitaLibrary({ name: trimmedName });
      await updateRoleField(library.roleId, {
        fieldType: TEMPLATE_FIELD_TYPE,
        plainValue: selected
      });
      onCreated(library);
    } catch {
      setError(copy.createFailed);
      setCreating(false);
    }
  };

  return (
    <div className="cogita-lib-templates">
      <div className="cogita-lib-templates-header">
        <button type="button" className="cogita-lib-templates-back ghost" onClick={onCancel}>
          ← {copy.back}
        </button>
        <h3 className="cogita-lib-templates-title">{copy.title}</h3>
        <p className="cogita-lib-templates-subtitle">{copy.subtitle}</p>
      </div>

      <div className="cogita-lib-templates-grid">
        {TEMPLATE_IDS.map((id) => {
          const tmpl = copy.templates[id];
          const { icon, color } = TEMPLATE_META[id];
          return (
            <button
              key={id}
              type="button"
              className={`cogita-lib-template-card${selected === id ? ' is-selected' : ''}`}
              style={{ '--tmpl-color': color } as React.CSSProperties}
              onClick={() => { setSelected(id); setError(null); }}
            >
              <div className="cogita-lib-template-icon">{icon}</div>
              <span className="cogita-lib-template-name">{tmpl.title}</span>
              <span className="cogita-lib-template-desc">{tmpl.desc}</span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="cogita-lib-templates-create">
          <label className="cogita-lib-templates-label">{copy.nameLabel}</label>
          <div className="cogita-lib-templates-name-row">
            <input
              className="cogita-lib-picker-link-input"
              type="text"
              placeholder={copy.namePlaceholder}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              disabled={creating}
              autoFocus
            />
            <button
              type="button"
              className="cogita-lib-picker-link-btn"
              onClick={handleCreate}
              disabled={!name.trim() || creating}
            >
              {creating ? copy.creating : copy.create}
            </button>
          </div>
          {error ? <p className="cogita-lib-picker-link-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
