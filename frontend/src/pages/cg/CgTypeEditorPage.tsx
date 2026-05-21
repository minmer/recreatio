import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCgTypeDefDetail,
  getCgTypeDefs,
  saveCgFields,
  type CgFieldDefResponse,
  type CgFieldDefSaveItem,
  type CgTypeDefResponse
} from './cgApi';

type FieldDraft = {
  id?: number;
  label: string;
  inputType: string;
  multiple: boolean;
  isOrdered: boolean;
  targetTypeDefIds: number[];
};

function fieldToSaveItem(f: FieldDraft): CgFieldDefSaveItem {
  return {
    id: f.id,
    label: f.label,
    inputType: f.inputType,
    multiple: f.multiple,
    isOrdered: f.isOrdered,
    targetTypeDefIds: f.inputType === 'reference' ? f.targetTypeDefIds : []
  };
}

function responseToFieldDraft(f: CgFieldDefResponse): FieldDraft {
  return {
    id: f.id,
    label: f.label,
    inputType: f.inputType,
    multiple: f.multiple,
    isOrdered: f.isOrdered,
    targetTypeDefIds: f.targetTypeDefIds
  };
}

const INPUT_TYPES = ['text', 'number', 'date', 'reference'] as const;

export function CgTypeEditorPage({ libId, typeId }: { libId: number; typeId: number }) {
  const navigate = useNavigate();
  const [typeName, setTypeName] = useState('');
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [allTypes, setAllTypes] = useState<CgTypeDefResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([getCgTypeDefDetail(libId, typeId), getCgTypeDefs(libId)])
      .then(([detail, types]) => {
        setTypeName(detail.name);
        setFields(detail.fields.map(responseToFieldDraft));
        setAllTypes(types);
      })
      .catch(() => setError('Failed to load type.'))
      .finally(() => setLoading(false));
  }, [libId, typeId]);

  function updateField(idx: number, patch: Partial<FieldDraft>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    setDirty(true);
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      { label: '', inputType: 'text', multiple: false, isOrdered: false, targetTypeDefIds: [] }
    ]);
    setDirty(true);
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function moveField(idx: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setDirty(true);
  }

  async function handleSave() {
    const items = fields.map(fieldToSaveItem);
    setSaving(true);
    setError(null);
    try {
      const saved = await saveCgFields(libId, typeId, items);
      setFields(saved.fields.map(responseToFieldDraft));
      setDirty(false);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setSavedMsg(true);
      savedTimer.current = setTimeout(() => setSavedMsg(false), 2000);
    } catch {
      setError('Failed to save fields.');
    } finally {
      setSaving(false);
    }
  }

  function toggleTarget(idx: number, targetId: number) {
    const current = fields[idx].targetTypeDefIds;
    const next = current.includes(targetId)
      ? current.filter((id) => id !== targetId)
      : [...current, targetId];
    updateField(idx, { targetTypeDefIds: next });
  }

  if (loading) {
    return (
      <div className="cg-page">
        <div className="cg-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="cg-page">
      <div className="cg-header">
        <button className="cg-back" onClick={() => navigate(`/cg/libraries/${libId}`)}>
          ← {typeName || 'Back'}
        </button>
        <h1 className="cg-title">{typeName}</h1>
        <div className="cg-header-actions">
          {savedMsg && <span className="cg-saved-msg">Saved</span>}
          <button
            className="cg-btn"
            onClick={() => navigate(`/cg/libraries/${libId}/types/${typeId}/templates`)}
          >
            Templates
          </button>
          <button className="cg-btn" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="cg-error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="cg-section">
        <h2 className="cg-section-title">Fields</h2>

        {fields.length === 0 ? (
          <p className="cg-empty">No fields yet. Add one below.</p>
        ) : (
          <div className="cg-fields">
            {fields.map((field, idx) => (
              <div key={field.id ?? `new-${idx}`} className="cg-field-card">
                <div className="cg-field-row">
                  <div className="cg-field-order">
                    <button
                      className="cg-order-btn"
                      onClick={() => moveField(idx, -1)}
                      disabled={idx === 0}
                      title="Move up"
                    >
                      ▲
                    </button>
                    <span className="cg-order-num">{idx + 1}</span>
                    <button
                      className="cg-order-btn"
                      onClick={() => moveField(idx, 1)}
                      disabled={idx === fields.length - 1}
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>

                  <div className="cg-field-body">
                    <input
                      className="cg-input cg-field-label"
                      placeholder="Label…"
                      value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                    />

                    <select
                      className="cg-select"
                      value={field.inputType}
                      onChange={(e) => updateField(idx, { inputType: e.target.value })}
                    >
                      {INPUT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>

                    <label className="cg-checkbox-label">
                      <input
                        type="checkbox"
                        checked={field.multiple}
                        onChange={(e) => updateField(idx, { multiple: e.target.checked })}
                      />
                      multiple
                    </label>

                    <label className="cg-checkbox-label">
                      <input
                        type="checkbox"
                        checked={field.isOrdered}
                        onChange={(e) => updateField(idx, { isOrdered: e.target.checked })}
                      />
                      ordered
                    </label>
                  </div>

                  <button
                    className="cg-btn cg-btn-sm cg-btn-danger"
                    onClick={() => removeField(idx)}
                    title="Remove field"
                  >
                    ✕
                  </button>
                </div>

                {field.inputType === 'reference' && (
                  <div className="cg-field-targets">
                    <span className="cg-targets-label">Target types</span>
                    <span className="cg-targets-hint">(empty = any type)</span>
                    <div className="cg-targets-list">
                      {allTypes
                        .filter((t) => t.id !== typeId)
                        .map((t) => (
                          <label key={t.id} className="cg-target-chip">
                            <input
                              type="checkbox"
                              checked={field.targetTypeDefIds.includes(t.id)}
                              onChange={() => toggleTarget(idx, t.id)}
                            />
                            {t.name}
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button className="cg-btn cg-btn-add" onClick={addField}>
          + Add Field
        </button>
      </div>
    </div>
  );
}
