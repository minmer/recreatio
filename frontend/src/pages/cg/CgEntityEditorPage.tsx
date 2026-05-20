import { useState, useEffect } from 'react';
import {
  getCgTypeDefDetail,
  getCgEntityDetail,
  createCgEntity,
  updateCgEntity,
  CgFieldDefResponse,
  CgEntityDetailResponse,
  CgEntityValueSaveItem,
  ApiError,
} from './cgApi';
import { CgReferenceInput } from './components/CgReferenceInput';

type FieldState = {
  def: CgFieldDefResponse;
  plainValues: string[];
  refEntityIds: number[];
};

type Props = {
  libId: number;
  typeId: number;
  entityId?: number;
  onSaved: (entityId: number) => void;
  onBack: () => void;
};

export function CgEntityEditorPage({ libId, typeId, entityId, onSaved, onBack }: Props) {
  const [fields, setFields] = useState<FieldState[]>([]);
  const [typeName, setTypeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const typeDef = await getCgTypeDefDetail(libId, typeId);
        setTypeName(typeDef.name);

        if (entityId) {
          const entity = await getCgEntityDetail(libId, entityId);
          setFields(buildFieldsFromEntity(typeDef.fields, entity));
        } else {
          setFields(typeDef.fields.map(def => ({
            def,
            plainValues: def.inputType !== 'reference' ? [''] : [],
            refEntityIds: [],
          })));
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [libId, typeId, entityId]);

  const buildFieldsFromEntity = (defs: CgFieldDefResponse[], entity: CgEntityDetailResponse): FieldState[] => {
    return defs.map(def => {
      const ef = entity.fields.find(f => f.fieldDefId === def.id);
      if (!ef) return { def, plainValues: def.inputType !== 'reference' ? [''] : [], refEntityIds: [] };
      if (def.inputType === 'reference') {
        return { def, plainValues: [], refEntityIds: ef.values.map(v => v.refEntityId!).filter(Boolean) };
      }
      return { def, plainValues: ef.values.map(v => v.plainValue ?? ''), refEntityIds: [] };
    });
  };

  const setPlainValue = (fieldIdx: number, valIdx: number, val: string) => {
    setFields(prev => prev.map((f, i) => {
      if (i !== fieldIdx) return f;
      const next = [...f.plainValues];
      next[valIdx] = val;
      return { ...f, plainValues: next };
    }));
  };

  const addPlainValue = (fieldIdx: number) => {
    setFields(prev => prev.map((f, i) =>
      i === fieldIdx ? { ...f, plainValues: [...f.plainValues, ''] } : f
    ));
  };

  const removePlainValue = (fieldIdx: number, valIdx: number) => {
    setFields(prev => prev.map((f, i) =>
      i === fieldIdx ? { ...f, plainValues: f.plainValues.filter((_, vi) => vi !== valIdx) } : f
    ));
  };

  const movePlainValue = (fieldIdx: number, valIdx: number, dir: -1 | 1) => {
    setFields(prev => prev.map((f, i) => {
      if (i !== fieldIdx) return f;
      const next = [...f.plainValues];
      const target = valIdx + dir;
      if (target < 0 || target >= next.length) return f;
      [next[valIdx], next[target]] = [next[target], next[valIdx]];
      return { ...f, plainValues: next };
    }));
  };

  const setRefEntityIds = (fieldIdx: number, ids: number[]) => {
    setFields(prev => prev.map((f, i) =>
      i === fieldIdx ? { ...f, refEntityIds: ids } : f
    ));
  };

  const buildSaveValues = (): CgEntityValueSaveItem[] => {
    const items: CgEntityValueSaveItem[] = [];
    for (const f of fields) {
      if (f.def.inputType === 'reference') {
        f.refEntityIds.forEach((id, idx) => {
          items.push({ fieldDefId: f.def.id, sortOrder: idx, plainValue: null, refEntityId: id });
        });
      } else {
        f.plainValues.forEach((val, idx) => {
          if (val.trim()) {
            items.push({ fieldDefId: f.def.id, sortOrder: idx, plainValue: val, refEntityId: null });
          }
        });
      }
    }
    return items;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const values = buildSaveValues();
      let result;
      if (entityId) {
        result = await updateCgEntity(libId, entityId, values);
      } else {
        result = await createCgEntity(libId, typeId, values);
      }
      onSaved(result.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="cg-page"><p className="cg-muted">Loading…</p></div>;

  return (
    <div className="cg-page">
      <div className="cg-header">
        <button className="cg-btn cg-btn-ghost" onClick={onBack}>← Back</button>
        <h2>{entityId ? 'Edit' : 'New'} — {typeName}</h2>
      </div>

      {error && <p className="cg-error">{error}</p>}

      <div className="cg-entity-form">
        {fields.map((f, fi) => (
          <div key={f.def.id} className="cg-entity-field">
            <label className="cg-entity-field-label">{f.def.label}</label>

            {f.def.inputType === 'reference' ? (
              <CgReferenceInput
                libId={libId}
                targetTypeDefIds={f.def.targetTypeDefIds}
                value={f.refEntityIds}
                onChange={ids => setRefEntityIds(fi, ids)}
                multiple={f.def.multiple}
                isOrdered={f.def.isOrdered}
              />
            ) : (
              <div className="cg-entity-values">
                {f.plainValues.map((val, vi) => (
                  <div key={vi} className="cg-entity-value-row">
                    <input
                      type={f.def.inputType === 'number' ? 'number' : f.def.inputType === 'date' ? 'date' : 'text'}
                      className="cg-input"
                      value={val}
                      onChange={e => setPlainValue(fi, vi, e.target.value)}
                    />
                    {f.def.isOrdered && (
                      <>
                        <button type="button" className="cg-btn cg-btn-sm" onClick={() => movePlainValue(fi, vi, -1)} disabled={vi === 0}>▲</button>
                        <button type="button" className="cg-btn cg-btn-sm" onClick={() => movePlainValue(fi, vi, 1)} disabled={vi === f.plainValues.length - 1}>▼</button>
                      </>
                    )}
                    {f.def.multiple && (
                      <button type="button" className="cg-btn cg-btn-sm cg-btn-danger" onClick={() => removePlainValue(fi, vi)}>×</button>
                    )}
                  </div>
                ))}
                {f.def.multiple && (
                  <button type="button" className="cg-btn cg-btn-sm" onClick={() => addPlainValue(fi)}>+ Add value</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="cg-entity-actions">
        <button className="cg-btn cg-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="cg-btn cg-btn-ghost" onClick={onBack}>Cancel</button>
      </div>
    </div>
  );
}
