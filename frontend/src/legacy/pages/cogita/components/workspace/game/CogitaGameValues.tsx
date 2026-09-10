import type { Dispatch, SetStateAction } from 'react';
import type { CogitaGameValue } from '../../../../../lib/api';

function parseJsonObject<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

export function CogitaGameValues({
  values,
  setValues,
  onAddValue,
  onSaveValues
}: {
  values: CogitaGameValue[];
  setValues: Dispatch<SetStateAction<CogitaGameValue[]>>;
  onAddValue: () => void;
  onSaveValues: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {values.map((item) => (
        <div key={item.valueId} style={{ display: 'grid', gap: '0.45rem', border: '1px solid #e4e4e4', borderRadius: 8, padding: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
            <input
              className="cogita-input"
              value={item.valueKey}
              onChange={(event) =>
                setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, valueKey: event.target.value } : row)))
              }
              placeholder="value key"
            />
            <input
              className="cogita-input"
              value={item.name}
              onChange={(event) =>
                setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, name: event.target.value } : row)))
              }
              placeholder="display name"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
            <select
              className="cogita-input"
              value={item.scopeType}
              onChange={(event) =>
                setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, scopeType: event.target.value } : row)))
              }
            >
              <option value="participant">participant</option>
              <option value="group">group</option>
              <option value="session">session</option>
            </select>
            <select
              className="cogita-input"
              value={item.visibility}
              onChange={(event) =>
                setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, visibility: event.target.value } : row)))
              }
            >
              <option value="public">public</option>
              <option value="group">group</option>
              <option value="private">private</option>
            </select>
            <select
              className="cogita-input"
              value={item.dataType}
              onChange={(event) =>
                setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, dataType: event.target.value } : row)))
              }
            >
              <option value="number">number</option>
              <option value="bool">bool</option>
              <option value="string">string</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={item.isScore}
                onChange={(event) =>
                  setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, isScore: event.target.checked } : row)))
                }
              />
              score
            </label>
          </div>
          <textarea
            className="cogita-input"
            style={{ minHeight: 90, fontFamily: 'monospace' }}
            value={JSON.stringify(item.defaultValue ?? 0, null, 2)}
            onChange={(event) => {
              const next = parseJsonObject<unknown>(event.target.value, item.defaultValue ?? 0);
              setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, defaultValue: next } : row)));
            }}
          />
          <div>
            <button
              type="button"
              className="ghost"
              onClick={() => setValues((current) => current.filter((row) => row.valueId !== item.valueId))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" className="ghost" onClick={onAddValue}>Add Value</button>
        <button type="button" className="cta" onClick={onSaveValues}>Save Values</button>
      </div>
    </div>
  );
}
