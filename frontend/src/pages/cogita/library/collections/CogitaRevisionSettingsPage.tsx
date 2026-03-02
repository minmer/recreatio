import { useEffect, useMemo, useState } from 'react';
import {
  createCogitaRevision,
  getCogitaCollections,
  getCogitaRevision,
  updateCogitaRevision,
} from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import { getRevisionType, normalizeRevisionSettings, revisionTypes } from '../../../../cogita/revision/registry';
import { useNavigate } from 'react-router-dom';

export function CogitaRevisionSettingsPage({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange,
  libraryId,
  collectionId,
  revisionId
}: {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  libraryId: string;
  collectionId?: string;
  revisionId?: string;
}) {
  const navigate = useNavigate();
  const [availableCollections, setAvailableCollections] = useState<{ collectionId: string; name: string }[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(collectionId ?? '');
  const [revisionName, setRevisionName] = useState('');
  const [limit, setLimit] = useState(20);
  const [mode, setMode] = useState('random');
  const [revisionSettings, setRevisionSettings] = useState<Record<string, number | string>>({});
  const [check] = useState('exact');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showCommonSettings, setShowCommonSettings] = useState(false);
  const [showSpecificSettings, setShowSpecificSettings] = useState(false);

  const isCreateMode = !revisionId;
  const revisionType = useMemo(() => getRevisionType(mode), [mode]);
  const normalizedSettings = useMemo(
    () => normalizeRevisionSettings(revisionType, revisionSettings),
    [revisionType, revisionSettings]
  );
  const hiddenPerRevisionSettingKeys = useMemo(() => new Set(['minCorrectness', 'dependencyThreshold']), []);
  const visibleSettingsFields = useMemo(
    () => revisionType.settingsFields.filter((field) => !hiddenPerRevisionSettingKeys.has(field.key)),
    [hiddenPerRevisionSettingKeys, revisionType.settingsFields]
  );
  const commonSettingKeys = useMemo(() => {
    const keySets = revisionTypes.map(
      (type) => new Set(type.settingsFields.filter((field) => !hiddenPerRevisionSettingKeys.has(field.key)).map((field) => field.key))
    );
    return visibleSettingsFields
      .filter((field) => keySets.every((set) => set.has(field.key)))
      .map((field) => field.key);
  }, [hiddenPerRevisionSettingKeys, visibleSettingsFields]);
  const commonSettingsFields = useMemo(
    () =>
      visibleSettingsFields
        .filter((field) => commonSettingKeys.includes(field.key))
        .sort((a, b) => Number(b.key === 'considerDependencies') - Number(a.key === 'considerDependencies')),
    [commonSettingKeys, visibleSettingsFields]
  );
  const specificSettingsFields = useMemo(
    () =>
      visibleSettingsFields
        .filter((field) => !commonSettingKeys.includes(field.key))
        .sort((a, b) => Number(b.key === 'considerDependencies') - Number(a.key === 'considerDependencies')),
    [commonSettingKeys, visibleSettingsFields]
  );
  const selectedCollectionName = useMemo(
    () => availableCollections.find((item) => item.collectionId === selectedCollectionId)?.name ?? copy.cogita.workspace.selectCollectionOption,
    [availableCollections, copy.cogita.workspace.selectCollectionOption, selectedCollectionId]
  );
  const settingsImpactLines = useMemo(() => {
    const revisionCopy = copy.cogita.library.revision;
    const lines: string[] = [];

    lines.push(revisionCopy.effectCollection.replace('{collection}', selectedCollectionName));

    const triesValue = Number(normalizedSettings.tries ?? 0);
    if (Number.isFinite(triesValue) && triesValue > 0) {
      lines.push(revisionCopy.effectTries.replace('{value}', String(triesValue)));
    }

    const considerDependencies = String(normalizedSettings.considerDependencies ?? 'off') === 'on';
    lines.push(considerDependencies ? revisionCopy.effectConsiderDependenciesOn : revisionCopy.effectConsiderDependenciesOff);

    if (considerDependencies) {
      const dependencyThreshold = Number(normalizedSettings.dependencyThreshold ?? 0);
      if (Number.isFinite(dependencyThreshold) && dependencyThreshold > 0) {
        lines.push(revisionCopy.effectDependencyThreshold.replace('{value}', String(dependencyThreshold)));
      }
    }

    const minCorrectnessValue = Number(normalizedSettings.minCorrectness ?? 0);
    if (Number.isFinite(minCorrectnessValue) && minCorrectnessValue > 0) {
      lines.push(revisionCopy.effectMinCorrectness.replace('{value}', String(minCorrectnessValue)));
    }

    const stackSizeValue = Number(normalizedSettings.stackSize ?? 0);
    if (Number.isFinite(stackSizeValue) && stackSizeValue > 0) {
      lines.push(revisionCopy.effectStackSize.replace('{value}', String(stackSizeValue)));
    }

    const levelsValue = Number(normalizedSettings.levels ?? 0);
    if (Number.isFinite(levelsValue) && levelsValue > 0) {
      lines.push(revisionCopy.effectLevels.replace('{value}', String(levelsValue)));
    }

    if (revisionType.id === 'random') {
      lines.push(revisionCopy.effectCardsPerSession.replace('{value}', String(limit)));
    }

    return lines;
  }, [copy.cogita.library.revision, limit, normalizedSettings, revisionType.id, selectedCollectionName]);
  useEffect(() => {
    setSelectedCollectionId(collectionId ?? '');
  }, [collectionId]);

  useEffect(() => {
    getCogitaCollections({ libraryId, limit: 200 })
      .then((bundle) => {
        setAvailableCollections(bundle.items.map((item) => ({ collectionId: item.collectionId, name: item.name })));
        if (!selectedCollectionId && bundle.items.length > 0) {
          setSelectedCollectionId(bundle.items[0].collectionId);
        }
      })
      .catch(() => setAvailableCollections([]));
  }, [libraryId, selectedCollectionId]);

  useEffect(() => {
    if (!revisionId) {
      setRevisionName('');
      setMode('random');
      setLimit(20);
      setRevisionSettings({});
      return;
    }

    getCogitaRevision({ libraryId, revisionId })
      .then((revision) => {
        setSelectedCollectionId(revision.collectionId);
        setRevisionName(revision.name);
        setMode(revision.mode || 'random');
        setLimit(revision.limit || 20);
        setRevisionSettings((revision.revisionSettings as Record<string, number | string> | null | undefined) ?? {});
      })
      .catch(() => {
        setRevisionName('');
      });
  }, [libraryId, revisionId]);

  const handleSaveRevision = async () => {
    if (!selectedCollectionId) {
      setSaveStatus('error');
      return;
    }
    if (!revisionName.trim()) {
      setSaveStatus('error');
      return;
    }

    setSaveStatus('saving');
    try {
      if (revisionId) {
        await updateCogitaRevision({
          libraryId,
          collectionId: selectedCollectionId,
          revisionId,
          targetCollectionId: selectedCollectionId,
          name: revisionName.trim(),
          revisionType: revisionType.id,
          revisionSettings: normalizedSettings,
          mode,
          check,
          limit
        });
        setSaveStatus('saved');
        return;
      }

      const created = await createCogitaRevision({
        libraryId,
        collectionId: selectedCollectionId,
        name: revisionName.trim(),
        revisionType: revisionType.id,
        revisionSettings: normalizedSettings,
        mode,
        check,
        limit
      });
      setSaveStatus('saved');
      navigate(`/cogita/library/${libraryId}/revisions/${encodeURIComponent(created.revisionId)}`, { replace: true });
    } catch {
      setSaveStatus('error');
    }
  };

  const renderSettingsField = (field: (typeof revisionType.settingsFields)[number]) => {
    return (
      <label key={field.key} className="cogita-field">
        <span>{copy.cogita.library.revision[field.labelKey]}</span>
        {field.type === 'select' ? (
          <select
            value={String(normalizedSettings[field.key] ?? '')}
            onChange={(event) =>
              setRevisionSettings((prev) => {
                const next: Record<string, number | string> = {
                  ...prev,
                  [field.key]: event.target.value
                };
                return next;
              })
            }
          >
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {copy.cogita.library.revision[option.labelKey]}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            value={Number(normalizedSettings[field.key] ?? 0)}
            onChange={(event) =>
              setRevisionSettings((prev) => ({
                ...prev,
                [field.key]: Number(event.target.value || 0)
              }))
            }
          />
        )}
      </label>
    );
  };

  return (
    <CogitaShell
      copy={copy}
      authLabel={authLabel}
      showProfileMenu={showProfileMenu}
      onProfileNavigate={onProfileNavigate}
      onToggleSecureMode={onToggleSecureMode}
      onLogout={onLogout}
      secureMode={secureMode}
      onNavigate={onNavigate}
      language={language}
      onLanguageChange={onLanguageChange}
    >
      <section className="cogita-library-dashboard" data-mode="detail">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-revision-settings-layout">
                <section className="cogita-library-panel cogita-revision-settings-form">
                  <div className="cogita-revision-settings-block">
                    <p className="cogita-user-kicker">{copy.cogita.library.revision.identitySettingsTitle}</p>
                    <div className="cogita-revision-settings-stack">
                      <label className="cogita-field">
                        <span>{copy.cogita.library.actions.collections}</span>
                        <select value={selectedCollectionId} onChange={(event) => setSelectedCollectionId(event.target.value)}>
                          <option value="">{copy.cogita.workspace.selectCollectionOption}</option>
                          {availableCollections.map((collectionOption) => (
                            <option key={collectionOption.collectionId} value={collectionOption.collectionId}>
                              {collectionOption.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="cogita-field">
                        <span>{copy.cogita.workspace.revisionForm.nameLabel}</span>
                        <input
                          value={revisionName}
                          onChange={(event) => setRevisionName(event.target.value)}
                          placeholder={copy.cogita.workspace.revisionForm.namePlaceholder}
                        />
                      </label>
                      <label className="cogita-field">
                        <span>{copy.cogita.library.revision.modeLabel}</span>
                        <select value={mode} onChange={(event) => setMode(event.target.value)}>
                          {revisionTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {copy.cogita.library.revision[type.labelKey]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </section>

                <section className="cogita-library-panel cogita-revision-settings-form">
                  <div className="cogita-form-actions">
                    <button type="button" className="ghost" onClick={() => setShowCommonSettings((prev) => !prev)}>
                      {showCommonSettings ? copy.cogita.library.revision.hideSectionAction : copy.cogita.library.revision.showSectionAction}{' '}
                      {copy.cogita.library.revision.commonSettingsTitle}
                    </button>
                  </div>
                  {showCommonSettings ? (
                    <div className="cogita-revision-settings-block">
                      <p className="cogita-user-kicker">{copy.cogita.library.revision.commonSettingsTitle}</p>
                      <div className="cogita-revision-settings-stack">
                        {commonSettingsFields.map((field) => renderSettingsField(field))}
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className="cogita-library-panel cogita-revision-settings-form">
                  <div className="cogita-form-actions">
                    <button type="button" className="ghost" onClick={() => setShowSpecificSettings((prev) => !prev)}>
                      {showSpecificSettings ? copy.cogita.library.revision.hideSectionAction : copy.cogita.library.revision.showSectionAction}{' '}
                      {copy.cogita.library.revision.specificSettingsTitle}
                    </button>
                  </div>
                  {showSpecificSettings ? (
                    <div className="cogita-revision-settings-block">
                      <div className="cogita-revision-settings-stack">
                        {specificSettingsFields.map((field) => renderSettingsField(field))}
                      </div>
                      {revisionType.id === 'random' ? (
                        <label className="cogita-field">
                          <span>{copy.cogita.library.revision.cardsPerSessionLabel}</span>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={limit}
                            onChange={(event) => setLimit(Number(event.target.value || 1))}
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </section>

                <div className="cogita-form-actions cogita-revision-settings-submit">
                  <button type="button" className="cta" onClick={handleSaveRevision} disabled={saveStatus === 'saving'}>
                    {saveStatus === 'saving'
                      ? '...'
                      : isCreateMode
                        ? copy.cogita.workspace.revisionForm.createAction
                        : copy.cogita.workspace.revisionForm.saveAction}
                  </button>
                </div>
                {saveStatus === 'error' ? <p className="cogita-help">{copy.cogita.library.revision.error}</p> : null}
              </div>

              <div className="cogita-library-panel">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <h3 className="cogita-detail-title">{copy.cogita.library.revision.settingsImpactTitle}</h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    {settingsImpactLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
