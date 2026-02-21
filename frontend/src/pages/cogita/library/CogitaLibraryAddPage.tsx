import { useEffect, useMemo, useState } from 'react';
import {
  createCogitaInfo,
  getCogitaInfoDetail,
  getCogitaInfoTypeSpecification,
  updateCogitaInfo,
  type CogitaInfoLinkFieldSpec,
  type CogitaInfoPayloadFieldSpec,
  type CogitaInfoTypeSpecification
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaInfoOption, CogitaInfoType } from './types';
import { InfoSearchSelect } from './components/InfoSearchSelect';
import { getInfoTypeLabel } from './libraryOptions';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';

type LinkTypeSelectionState = Record<string, CogitaInfoType>;

function normalizePayloadValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function resolveInfoLabel(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const data = payload as Record<string, unknown>;
  const candidates = [data.label, data.name, data.title, data.text, data.orcid, data.email, data.number];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return fallback;
}

export function CogitaLibraryAddPage({
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
  editInfoId
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
  editInfoId?: string;
}) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const isEditMode = Boolean(editInfoId);
  const [specifications, setSpecifications] = useState<CogitaInfoTypeSpecification[]>([]);
  const [selectedInfoType, setSelectedInfoType] = useState<CogitaInfoType>('word');
  const [payloadValues, setPayloadValues] = useState<Record<string, string>>({});
  const [singleLinks, setSingleLinks] = useState<Record<string, CogitaInfoOption | null>>({});
  const [multiLinks, setMultiLinks] = useState<Record<string, CogitaInfoOption[]>>({});
  const [linkTypeSelections, setLinkTypeSelections] = useState<LinkTypeSelectionState>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<'idle' | 'loading' | 'saving'>('idle');

  const currentSpec = useMemo(
    () => specifications.find((spec) => spec.infoType === selectedInfoType),
    [selectedInfoType, specifications]
  );
  const infoTypeOptions = useMemo(
    () =>
      specifications.map((spec) => ({
        value: spec.infoType as CogitaInfoType,
        label: getInfoTypeLabel(copy, spec.infoType as CogitaInfoType)
      })),
    [copy, specifications]
  );

  useEffect(() => {
    let cancelled = false;
    getCogitaInfoTypeSpecification({ libraryId })
      .then((items) => {
        if (cancelled) return;
        setSpecifications(items);
        if (!isEditMode) {
          const first = items[0]?.infoType as CogitaInfoType | undefined;
          if (first) setSelectedInfoType(first);
        }
      })
      .catch(() => {
        if (!cancelled) setSpecifications([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditMode, libraryId]);

  useEffect(() => {
    if (!currentSpec) return;
    const payload: Record<string, string> = {};
    const single: Record<string, CogitaInfoOption | null> = {};
    const multi: Record<string, CogitaInfoOption[]> = {};
    const linkTypes: LinkTypeSelectionState = {};

    for (const field of currentSpec.payloadFields) {
      payload[field.key] = '';
    }
    for (const link of currentSpec.linkFields) {
      if (link.multiple) {
        multi[link.key] = [];
      } else {
        single[link.key] = null;
      }
      if (link.targetTypes.length > 0) {
        linkTypes[link.key] = link.targetTypes[0] as CogitaInfoType;
      }
    }

    setPayloadValues(payload);
    setSingleLinks(single);
    setMultiLinks(multi);
    setLinkTypeSelections(linkTypes);
  }, [currentSpec?.infoType]);

  useEffect(() => {
    if (!isEditMode || !editInfoId || specifications.length === 0) return;
    let cancelled = false;
    setLoading('loading');
    setStatus(null);

    const load = async () => {
      const detail = await getCogitaInfoDetail({ libraryId, infoId: editInfoId });
      if (cancelled) return;

      const type = detail.infoType as CogitaInfoType;
      setSelectedInfoType(type);
      const spec = specifications.find((item) => item.infoType === type);
      if (!spec) {
        setLoading('idle');
        return;
      }

      const payloadRecord = (detail.payload ?? {}) as Record<string, unknown>;
      const nextPayloadValues: Record<string, string> = {};
      for (const field of spec.payloadFields) {
        nextPayloadValues[field.key] = normalizePayloadValue(payloadRecord[field.key]);
      }
      setPayloadValues(nextPayloadValues);

      const linksRecord = ((detail.links ?? {}) as Record<string, unknown>) ?? {};
      const nextSingle: Record<string, CogitaInfoOption | null> = {};
      const nextMulti: Record<string, CogitaInfoOption[]> = {};
      const nextLinkTypes: LinkTypeSelectionState = {};

      const optionPromises: Array<Promise<void>> = [];
      for (const linkField of spec.linkFields) {
        if (linkField.targetTypes.length > 0) {
          nextLinkTypes[linkField.key] = linkField.targetTypes[0] as CogitaInfoType;
        }

        const rawValue = linksRecord[linkField.key];
        if (linkField.multiple) {
          const ids = Array.isArray(rawValue) ? rawValue.filter((value) => typeof value === 'string') as string[] : [];
          nextMulti[linkField.key] = [];
          for (const id of ids) {
            optionPromises.push(
              getCogitaInfoDetail({ libraryId, infoId: id })
                .then((linked) => {
                  if (cancelled) return;
                  const option: CogitaInfoOption = {
                    id,
                    infoType: linked.infoType as CogitaInfoType,
                    label: resolveInfoLabel(linked.payload, id)
                  };
                  nextMulti[linkField.key] = [...nextMulti[linkField.key], option];
                })
                .catch(() => undefined)
            );
          }
        } else {
          const id = typeof rawValue === 'string' ? rawValue : null;
          nextSingle[linkField.key] = null;
          if (id) {
            optionPromises.push(
              getCogitaInfoDetail({ libraryId, infoId: id })
                .then((linked) => {
                  if (cancelled) return;
                  nextSingle[linkField.key] = {
                    id,
                    infoType: linked.infoType as CogitaInfoType,
                    label: resolveInfoLabel(linked.payload, id)
                  };
                })
                .catch(() => undefined)
            );
          }
        }
      }

      await Promise.all(optionPromises);
      if (cancelled) return;
      setSingleLinks(nextSingle);
      setMultiLinks(nextMulti);
      setLinkTypeSelections((prev) => ({ ...prev, ...nextLinkTypes }));
      setLoading('idle');
    };

    load().catch(() => {
      if (!cancelled) {
        setStatus('Failed to load info details.');
        setLoading('idle');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [editInfoId, isEditMode, libraryId, specifications]);

  const handleSave = async () => {
    if (!currentSpec) return;

    const payload: Record<string, unknown> = {};
    for (const field of currentSpec.payloadFields) {
      const raw = (payloadValues[field.key] ?? '').trim();
      if (!raw) {
        if (field.required) {
          setStatus(`Field '${field.label}' is required.`);
          return;
        }
        continue;
      }

      if (field.inputType === 'json') {
        try {
          payload[field.key] = JSON.parse(raw);
        } catch {
          setStatus(`Field '${field.label}' must be valid JSON.`);
          return;
        }
      } else {
        payload[field.key] = raw;
      }
    }

    const links: Record<string, string | string[] | null> = {};
    for (const linkField of currentSpec.linkFields) {
      if (linkField.multiple) {
        const values = (multiLinks[linkField.key] ?? []).map((item) => item.id);
        if (linkField.required && values.length === 0) {
          setStatus(`Link '${linkField.label}' is required.`);
          return;
        }
        links[linkField.key] = values;
      } else {
        const value = singleLinks[linkField.key]?.id ?? null;
        if (linkField.required && !value) {
          setStatus(`Link '${linkField.label}' is required.`);
          return;
        }
        links[linkField.key] = value;
      }
    }

    setLoading('saving');
    setStatus(null);
    try {
      if (isEditMode && editInfoId) {
        await updateCogitaInfo({
          libraryId,
          infoId: editInfoId,
          payload,
          links
        });
        setStatus('Info updated.');
      } else {
        await createCogitaInfo({
          libraryId,
          infoType: selectedInfoType,
          payload,
          links
        });
        setStatus('Info saved.');

        const nextPayload: Record<string, string> = {};
        for (const field of currentSpec.payloadFields) nextPayload[field.key] = '';
        setPayloadValues(nextPayload);

        const nextSingle: Record<string, CogitaInfoOption | null> = {};
        const nextMulti: Record<string, CogitaInfoOption[]> = {};
        for (const link of currentSpec.linkFields) {
          if (link.multiple) nextMulti[link.key] = [];
          else nextSingle[link.key] = null;
        }
        setSingleLinks((prev) => ({ ...prev, ...nextSingle }));
        setMultiLinks((prev) => ({ ...prev, ...nextMulti }));
      }
    } catch {
      setStatus('Failed to save info.');
    } finally {
      setLoading('idle');
    }
  };

  const renderPayloadField = (field: CogitaInfoPayloadFieldSpec) => {
    const value = payloadValues[field.key] ?? '';
    const isLong = field.inputType === 'textarea' || field.inputType === 'json';
    return (
      <label key={`payload:${field.key}`} className="cogita-field full">
        <span>{field.label}</span>
        {isLong ? (
          <textarea
            rows={field.inputType === 'json' ? 8 : 4}
            value={value}
            onChange={(event) => setPayloadValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
            placeholder={field.key}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(event) => setPayloadValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
            placeholder={field.key}
          />
        )}
      </label>
    );
  };

  const renderLinkField = (field: CogitaInfoLinkFieldSpec) => {
    const targetType = (linkTypeSelections[field.key] ?? field.targetTypes[0]) as CogitaInfoType;
    return (
      <div key={`link:${field.key}`} className="cogita-field full">
        <span>{field.label}</span>
        {field.targetTypes.length > 1 ? (
          <select
            value={targetType}
            onChange={(event) => setLinkTypeSelections((prev) => ({ ...prev, [field.key]: event.target.value as CogitaInfoType }))}
          >
            {field.targetTypes.map((type) => (
              <option key={`${field.key}:${type}`} value={type}>
                {getInfoTypeLabel(copy, type as CogitaInfoType | 'any' | 'vocab')}
              </option>
            ))}
          </select>
        ) : null}
        {field.multiple ? (
          <InfoSearchSelect
            libraryId={libraryId}
            infoType={targetType}
            label={field.label}
            placeholder={field.key}
            multiple
            values={multiLinks[field.key] ?? []}
            onChangeMultiple={(values) => setMultiLinks((prev) => ({ ...prev, [field.key]: values }))}
            searchFailedText="Search failed"
            createFailedText="Create failed"
          />
        ) : (
          <InfoSearchSelect
            libraryId={libraryId}
            infoType={targetType}
            label={field.label}
            placeholder={field.key}
            value={singleLinks[field.key] ?? null}
            onChange={(value) => setSingleLinks((prev) => ({ ...prev, [field.key]: value }))}
            searchFailedText="Search failed"
            createFailedText="Create failed"
          />
        )}
      </div>
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
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">{isEditMode ? 'Edit info' : 'Create info'}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">Specification-driven editor</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href={`/#/cogita/library/${libraryId}/list`}>
              Back to list
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <article className="cogita-library-panel">
              {!isEditMode ? (
                <label className="cogita-field full">
                  <span>Info type</span>
                  <select value={selectedInfoType} onChange={(event) => setSelectedInfoType(event.target.value as CogitaInfoType)}>
                    {infoTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {loading === 'loading' ? <p>Loading...</p> : null}

              {currentSpec ? (
                <div className="cogita-form-grid">
                  {currentSpec.payloadFields.map(renderPayloadField)}
                  {currentSpec.linkFields.map(renderLinkField)}
                </div>
              ) : (
                <p>No specification found for this info type.</p>
              )}

              <div className="cogita-form-actions">
                <button type="button" className="cta" onClick={handleSave} disabled={loading === 'saving' || !currentSpec}>
                  {loading === 'saving' ? 'Saving...' : isEditMode ? 'Update info' : 'Create info'}
                </button>
              </div>

              {status ? <p className="cogita-library-subtitle">{status}</p> : null}
            </article>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
