import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCogitaLibraries,
  getRoles,
  updateRoleField,
  deleteRoleField,
  getCogitaPublicStoryboardShare,
  getCogitaPublicRevisionShare,
  type CogitaLibrary
} from '../../../lib/api';
import type { Copy } from '../../../content/types';

export type CogitaLibraryStatus = 'open' | 'hidden' | 'removed';
export type CogitaLibrarySource = 'own' | 'linked';

export type CogitaLibraryEntry = {
  libraryId: string;
  source: CogitaLibrarySource;
  status: CogitaLibraryStatus;
  name: string;
  shareCode?: string;
};

export type CogitaPersonPrefs = {
  version: 1;
  libraries: CogitaLibraryEntry[];
};

export const PREFS_FIELD_TYPE = 'cogita.preferences';

export function parsePersonPrefs(plainValue: string | null | undefined): CogitaPersonPrefs {
  if (!plainValue) return { version: 1, libraries: [] };
  try {
    const parsed = JSON.parse(plainValue);
    if (parsed?.version === 1 && Array.isArray(parsed.libraries)) return parsed as CogitaPersonPrefs;
  } catch {}
  return { version: 1, libraries: [] };
}

async function resolveLibraryLink(raw: string): Promise<CogitaLibraryEntry | null> {
  const revisionMatch = raw.match(/\/shared\/([A-Za-z0-9_-]+)/i);
  if (revisionMatch) {
    try {
      const share = await getCogitaPublicRevisionShare({ shareId: revisionMatch[1] });
      return { libraryId: share.libraryId, name: share.libraryName, source: 'linked', status: 'open', shareCode: revisionMatch[1] };
    } catch {}
  }
  const storyMatch = raw.match(/storyboard\/([A-Za-z0-9_-]+)/i);
  const code = storyMatch?.[1] ?? (/^[A-Za-z0-9_-]{4,64}$/.test(raw.trim()) ? raw.trim() : null);
  if (code) {
    const share = await getCogitaPublicStoryboardShare({ shareCode: code });
    return { libraryId: share.libraryId, name: share.libraryName, source: 'linked', status: 'open', shareCode: code };
  }
  return null;
}

type Tab = 'own' | 'public' | 'linked';

function LibraryItem({
  name,
  status,
  source,
  copy,
  onChange
}: {
  name: string;
  status: CogitaLibraryStatus;
  source: CogitaLibrarySource;
  copy: Copy['cogita']['libraryPicker'];
  onChange: (s: CogitaLibraryStatus) => void;
}) {
  const allStatuses: CogitaLibraryStatus[] = ['open', 'hidden', 'removed'];
  const consequence =
    source === 'own'
      ? { open: copy.consequences.ownOpen, hidden: copy.consequences.ownHidden, removed: copy.consequences.ownRemoved }[status]
      : { open: copy.consequences.ownOpen, hidden: copy.consequences.ownHidden, removed: copy.consequences.otherRemoved }[status];

  return (
    <div className="cogita-lib-picker-item">
      <div className="cogita-lib-picker-item-body">
        <span className="cogita-lib-picker-item-name">{name}</span>
        <span className="cogita-lib-picker-consequence">{consequence}</span>
      </div>
      <div className="cogita-lib-picker-status" role="group">
        {allStatuses.map((s) => (
          <button
            key={s}
            type="button"
            className={`cogita-lib-picker-status-btn${status === s ? (s === 'removed' ? ' is-removed' : ' is-active') : ''}`}
            onClick={() => onChange(s)}
          >
            {copy.status[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CogitaLibraryPicker({
  personRoleId,
  copy,
  onDone
}: {
  personRoleId: string;
  copy: Copy['cogita']['libraryPicker'];
  onDone: () => void;
}) {
  const [active, setActive] = useState(false);
  const [tab, setTab] = useState<Tab>('own');
  const [ownLibraries, setOwnLibraries] = useState<CogitaLibrary[]>([]);
  const [statuses, setStatuses] = useState<Record<string, CogitaLibraryStatus>>({});
  const [linkedLibraries, setLinkedLibraries] = useState<CogitaLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingRemovals, setPendingRemovals] = useState<{ name: string; source: CogitaLibrarySource }[] | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const savedFieldId = useRef<string | null>(null);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setActive(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRoles(), getCogitaLibraries()])
      .then(([roles, libraries]) => {
        if (cancelled) return;
        const personRole = roles.find((r) => r.roleId === personRoleId);
        const prefsField = personRole?.fields.find((f) => f.fieldType === PREFS_FIELD_TYPE);
        savedFieldId.current = prefsField?.fieldId ?? null;

        const prefs = parsePersonPrefs(prefsField?.plainValue);
        const statusMap: Record<string, CogitaLibraryStatus> = {};
        for (const entry of prefs.libraries) statusMap[entry.libraryId] = entry.status;

        setStatuses(statusMap);
        setLinkedLibraries(prefs.libraries.filter((e) => e.source === 'linked'));
        setOwnLibraries(libraries);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personRoleId]);

  const handleStatus = useCallback((libraryId: string, status: CogitaLibraryStatus) => {
    setStatuses((prev) => ({ ...prev, [libraryId]: status }));
  }, []);

  const handleLinkAdd = useCallback(async () => {
    const raw = linkInput.trim();
    if (!raw || linkLoading) return;
    setLinkLoading(true);
    setLinkError(null);
    try {
      const entry = await resolveLibraryLink(raw);
      if (!entry) {
        setLinkError(copy.link.error);
        return;
      }
      if (linkedLibraries.some((l) => l.libraryId === entry.libraryId) || ownLibraries.some((l) => l.libraryId === entry.libraryId)) {
        setLinkError(copy.link.alreadyAdded);
        return;
      }
      setLinkedLibraries((prev) => [...prev, entry]);
      setLinkInput('');
    } catch {
      setLinkError(copy.link.notFound);
    } finally {
      setLinkLoading(false);
    }
  }, [linkInput, linkLoading, linkedLibraries, ownLibraries, copy]);

  const buildLibraries = (removeRemoved: boolean): CogitaLibraryEntry[] => [
    ...ownLibraries
      .map((lib) => ({ libraryId: lib.libraryId, name: lib.name, source: 'own' as const, status: statuses[lib.libraryId] ?? 'open' }))
      .filter((e) => !removeRemoved || e.status !== 'removed'),
    ...linkedLibraries
      .map((lib) => ({ ...lib, status: statuses[lib.libraryId] ?? lib.status }))
      .filter((e) => !removeRemoved || e.status !== 'removed')
  ];

  const handleDone = () => {
    const removals = [
      ...ownLibraries
        .filter((lib) => (statuses[lib.libraryId] ?? 'open') === 'removed')
        .map((lib) => ({ name: lib.name, source: 'own' as const })),
      ...linkedLibraries
        .filter((lib) => (statuses[lib.libraryId] ?? lib.status) === 'removed')
        .map((lib) => ({ name: lib.name, source: 'linked' as const }))
    ];
    if (removals.length > 0) {
      setPendingRemovals(removals);
    } else {
      commitSave();
    }
  };

  const commitSave = async () => {
    setSaving(true);
    try {
      const prefs: CogitaPersonPrefs = { version: 1, libraries: buildLibraries(true) };
      if (savedFieldId.current) {
        try { await deleteRoleField(personRoleId, savedFieldId.current); } catch {}
      }
      const result = await updateRoleField(personRoleId, {
        fieldType: PREFS_FIELD_TYPE,
        plainValue: JSON.stringify(prefs)
      });
      savedFieldId.current = result.fieldId;
      onDone();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className={`cogita-lib-picker${active ? ' is-active' : ''}`}>
      <div className="cogita-lib-picker-inner">
        <p className="cogita-lib-picker-kicker">{copy.kicker}</p>
        <h2 className="cogita-lib-picker-title">{copy.title}</h2>
        <div className="cogita-lib-picker-tabs" role="tablist">
          {(['own', 'public', 'linked'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`cogita-lib-picker-tab${tab === t ? ' is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {copy.tabs[t]}
            </button>
          ))}
        </div>

        <div className="cogita-lib-picker-list">
          {loading ? null : tab === 'own' ? (
            ownLibraries.length === 0 ? (
              <p className="cogita-lib-picker-empty">{copy.empty.own}</p>
            ) : (
              ownLibraries.map((lib) => (
                <LibraryItem
                  key={lib.libraryId}
                  name={lib.name}
                  status={statuses[lib.libraryId] ?? 'open'}
                  source="own"
                  copy={copy}
                  onChange={(s) => handleStatus(lib.libraryId, s)}
                />
              ))
            )
          ) : tab === 'public' ? (
            <p className="cogita-lib-picker-note">{copy.publicNote}</p>
          ) : (
            <>
              <div className="cogita-lib-picker-link-row">
                <input
                  className="cogita-lib-picker-link-input"
                  type="text"
                  placeholder={copy.link.placeholder}
                  value={linkInput}
                  onChange={(e) => { setLinkInput(e.target.value); setLinkError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLinkAdd(); }}
                  disabled={linkLoading}
                />
                <button
                  type="button"
                  className="cogita-lib-picker-link-btn"
                  onClick={handleLinkAdd}
                  disabled={!linkInput.trim() || linkLoading}
                >
                  {linkLoading ? copy.link.loading : copy.link.add}
                </button>
              </div>
              {linkError ? <p className="cogita-lib-picker-link-error">{linkError}</p> : null}
              {linkedLibraries.length === 0 ? (
                <p className="cogita-lib-picker-empty">{copy.empty.linked}</p>
              ) : (
                linkedLibraries.map((lib) => (
                  <LibraryItem
                    key={lib.libraryId}
                    name={lib.name}
                    status={statuses[lib.libraryId] ?? lib.status}
                    source="linked"
                    copy={copy}
                    onChange={(s) => handleStatus(lib.libraryId, s)}
                  />
                ))
              )}
            </>
          )}
        </div>

        {pendingRemovals ? (
          <div className="cogita-lib-picker-confirm">
            <p className="cogita-lib-picker-confirm-title">{copy.confirm.title}</p>
            <p className="cogita-lib-picker-confirm-body">{copy.confirm.body}</p>
            <ul className="cogita-lib-picker-confirm-list">
              {pendingRemovals.map((r) => (
                <li key={r.name} className="cogita-lib-picker-confirm-item">
                  <span className="cogita-lib-picker-confirm-name">{r.name}</span>
                  <span className="cogita-lib-picker-confirm-note">
                    {r.source === 'own' ? copy.confirm.ownNote : copy.confirm.linkedNote}
                  </span>
                </li>
              ))}
            </ul>
            <div className="cogita-lib-picker-actions">
              <button type="button" className="cogita-lib-picker-actions-skip" onClick={() => setPendingRemovals(null)}>
                {copy.confirm.cancel}
              </button>
              <button
                type="button"
                className="cogita-lib-picker-actions-done cogita-lib-picker-actions-danger"
                onClick={commitSave}
                disabled={saving}
              >
                {copy.confirm.action}
              </button>
            </div>
          </div>
        ) : (
          <div className="cogita-lib-picker-actions">
            <button type="button" className="cogita-lib-picker-actions-skip" onClick={onDone}>
              {copy.skip}
            </button>
            <button
              type="button"
              className="cogita-lib-picker-actions-done"
              onClick={handleDone}
              disabled={saving}
            >
              {copy.done}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
