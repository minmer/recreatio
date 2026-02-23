import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
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
import { ReferencePanel, type ReferenceSourceForm } from './components/ReferencePanel';
import { getInfoTypeLabel } from './libraryOptions';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';

type LinkTypeSelectionState = Record<string, CogitaInfoType>;

const SOURCE_KIND_OPTIONS = [
  { value: 'string', label: 'string' },
  { value: 'book', label: 'book' },
  { value: 'website', label: 'website' },
  { value: 'bible', label: 'bible' },
  { value: 'number_document', label: 'number_document' },
  { value: 'work', label: 'work' },
  { value: 'other', label: 'other' }
] as const;

function createEmptyReferenceSourceForm(): ReferenceSourceForm {
  return {
    sourceKind: 'string',
    locatorValue: '',
    locatorAux: '',
    bibleBookDisplay: '',
    sourceUrl: '',
    sourceAccessedDate: '',
    churchDocument: null,
    bookMedia: null,
    work: null
  };
}

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

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }

  const raw = error.message?.trim();
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // Keep raw message fallback.
  }

  return raw;
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stringValue(node: Record<string, unknown> | null, key: string): string {
  const value = node?.[key];
  return typeof value === 'string' ? value : '';
}

function resourceOptionForKind(sourceKind: string, resource: CogitaInfoOption | null): Partial<ReferenceSourceForm> {
  if (!resource) return {};
  if (sourceKind === 'book' && resource.infoType === 'media') return { bookMedia: resource };
  if (sourceKind === 'work' && resource.infoType === 'work') return { work: resource };
  if (sourceKind === 'number_document' && resource.infoType === 'work') return { churchDocument: resource };
  return {};
}

function parseReferenceFormFromSourceValues(
  payloadValues: Record<string, string>,
  resource: CogitaInfoOption | null
): ReferenceSourceForm {
  const base = createEmptyReferenceSourceForm();
  const sourceKind = (payloadValues.sourceKind ?? '').trim() || base.sourceKind;
  const locatorRaw = payloadValues.locator ?? '';
  const locatorObject = tryParseJsonObject(locatorRaw);
  let locatorValue = '';
  let locatorAux = '';
  let bibleBookDisplay = '';
  let sourceUrl = '';
  let sourceAccessedDate = '';

  if (sourceKind === 'website') {
    sourceUrl = stringValue(locatorObject, 'url');
    sourceAccessedDate = stringValue(locatorObject, 'accessedDate');
    locatorValue = stringValue(locatorObject, 'value');
  } else if (sourceKind === 'bible') {
    locatorValue = stringValue(locatorObject, 'book') || locatorRaw.trim();
    locatorAux = stringValue(locatorObject, 'passage') || stringValue(locatorObject, 'rest');
    bibleBookDisplay = stringValue(locatorObject, 'bookDisplay');
  } else if (locatorObject) {
    locatorValue = stringValue(locatorObject, 'value') || stringValue(locatorObject, 'locator');
    locatorAux = stringValue(locatorObject, 'aux');
  } else {
    locatorValue = locatorRaw;
  }

  return {
    ...base,
    sourceKind,
    locatorValue,
    locatorAux,
    bibleBookDisplay,
    sourceUrl,
    sourceAccessedDate,
    ...resourceOptionForKind(sourceKind, resource)
  };
}

function getReferenceResource(form: ReferenceSourceForm): CogitaInfoOption | null {
  if (form.sourceKind === 'book') return form.bookMedia;
  if (form.sourceKind === 'work') return form.work;
  if (form.sourceKind === 'number_document') return form.churchDocument;
  return null;
}

function buildSourceLocatorPayload(form: ReferenceSourceForm): unknown {
  const locatorValue = form.locatorValue.trim();
  const locatorAux = form.locatorAux.trim();
  const sourceUrl = form.sourceUrl.trim();
  const sourceAccessedDate = form.sourceAccessedDate.trim();

  switch (form.sourceKind) {
    case 'website':
      return {
        url: sourceUrl,
        accessedDate: sourceAccessedDate
      };
    case 'bible':
      return {
        book: locatorValue,
        bookDisplay: form.bibleBookDisplay.trim(),
        passage: locatorAux
      };
    case 'book':
    case 'work':
    case 'number_document':
      return locatorAux ? { value: locatorValue, aux: locatorAux } : locatorValue;
    default:
      return locatorAux ? { value: locatorValue, aux: locatorAux } : locatorValue;
  }
}

function buildReferenceSourceLabel(form: ReferenceSourceForm): string {
  const locatorValue = form.locatorValue.trim();
  const locatorAux = form.locatorAux.trim();
  const locatorTail = [locatorValue, locatorAux].filter(Boolean).join(' ');
  switch (form.sourceKind) {
    case 'website':
      return form.sourceUrl.trim() || 'website';
    case 'bible':
      return locatorTail || 'bible';
    case 'book':
      return [form.bookMedia?.label, locatorTail].filter(Boolean).join(' · ') || 'book';
    case 'work':
      return [form.work?.label, locatorTail].filter(Boolean).join(' · ') || 'work';
    case 'number_document':
      return [form.churchDocument?.label, locatorTail].filter(Boolean).join(' · ') || 'number_document';
    default:
      return locatorTail || form.sourceKind || 'source';
  }
}

function validateReferenceSourceForm(form: ReferenceSourceForm): boolean {
  if (!form.sourceKind.trim()) return false;
  if (form.sourceKind === 'website') return Boolean(form.sourceUrl.trim());
  if (form.sourceKind === 'bible') return Boolean(form.locatorValue.trim() && form.locatorAux.trim());
  if (form.sourceKind === 'book') return Boolean(form.bookMedia);
  if (form.sourceKind === 'work') return Boolean(form.work);
  if (form.sourceKind === 'number_document') return Boolean(form.churchDocument && form.locatorValue.trim());
  return Boolean(form.locatorValue.trim());
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
  const [sourceReferenceForm, setSourceReferenceForm] = useState<ReferenceSourceForm>(createEmptyReferenceSourceForm);
  const [inlineReferenceEnabled, setInlineReferenceEnabled] = useState<Record<string, boolean>>({});
  const [inlineReferenceForms, setInlineReferenceForms] = useState<Record<string, ReferenceSourceForm>>({});
  const [inlineReferenceStatus, setInlineReferenceStatus] = useState<Record<string, string | null>>({});
  const [inlineReferenceSavingField, setInlineReferenceSavingField] = useState<string | null>(null);

  const currentSpec = useMemo(
    () => specifications.find((spec) => spec.infoType === selectedInfoType),
    [selectedInfoType, specifications]
  );
  const sourceSpec = useMemo(
    () => specifications.find((spec) => spec.infoType === 'source'),
    [specifications]
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
    if (isEditMode) return;
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
  }, [currentSpec?.infoType, isEditMode]);

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
                  nextLinkTypes[linkField.key] = option.infoType;
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
                  const option: CogitaInfoOption = {
                    id,
                    infoType: linked.infoType as CogitaInfoType,
                    label: resolveInfoLabel(linked.payload, id)
                  };
                  nextLinkTypes[linkField.key] = option.infoType;
                  nextSingle[linkField.key] = option;
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
      setLinkTypeSelections(nextLinkTypes);
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

  useEffect(() => {
    if (selectedInfoType !== 'source') return;
    setSourceReferenceForm(parseReferenceFormFromSourceValues(payloadValues, singleLinks.resource ?? null));
  }, [
    selectedInfoType,
    payloadValues.sourceKind,
    payloadValues.locator,
    singleLinks.resource?.id,
    singleLinks.resource?.infoType,
    singleLinks.resource?.label
  ]);

  const resetReferenceFormAfterCreate = (form: ReferenceSourceForm) => {
    const keepSourceKind = sourceSpec?.payloadFields.find((field) => field.key === 'sourceKind')?.keepOnCreate ?? false;
    const keepResource = sourceSpec?.linkFields.find((field) => field.key === 'resource')?.keepOnCreate ?? false;
    const next = createEmptyReferenceSourceForm();
    next.sourceKind = keepSourceKind ? form.sourceKind : next.sourceKind;
    if (keepResource) {
      next.work = form.work;
      next.bookMedia = form.bookMedia;
      next.churchDocument = form.churchDocument;
    }
    if (keepSourceKind && form.sourceKind === 'bible') {
      next.locatorValue = form.locatorValue;
      next.bibleBookDisplay = form.bibleBookDisplay;
    }
    if (keepSourceKind && form.sourceKind === 'website') {
      next.sourceUrl = form.sourceUrl;
      next.sourceAccessedDate = form.sourceAccessedDate;
    }
    return next;
  };

  const referencePanelLabels = useMemo(
    () => ({
      sourceKindLabel: copy.cogita.library.add.info.sourceKindLabel,
      bibleBookLabel: copy.cogita.library.add.info.sourceBibleBookLabel,
      bibleBookPlaceholder: copy.cogita.library.add.info.sourceBibleBookPlaceholder,
      bibleRestLabel: copy.cogita.library.add.info.sourceBibleRestLabel,
      bibleRestPlaceholder: copy.cogita.library.add.info.sourceBibleRestPlaceholder,
      churchDocumentLabel: copy.cogita.library.add.info.sourceResourceLabel,
      churchDocumentPlaceholder: copy.cogita.library.add.info.sourceResourcePlaceholder,
      workLabel: copy.cogita.library.add.info.sourceResourceLabel,
      workPlaceholder: copy.cogita.library.add.info.sourceResourcePlaceholder,
      bookLabel: copy.cogita.library.add.info.sourceResourceLabel,
      bookPlaceholder: copy.cogita.library.add.info.sourceResourcePlaceholder,
      locatorLabel: copy.cogita.library.list.typeFilterLocator,
      locatorPlaceholder: copy.cogita.library.list.typeFilterLocator
    }),
    [copy]
  );

  const handleInlineReferenceCreate = async (fieldKey: string) => {
    const form = inlineReferenceForms[fieldKey] ?? createEmptyReferenceSourceForm();
    if (!validateReferenceSourceForm(form)) {
      setInlineReferenceStatus((prev) => ({ ...prev, [fieldKey]: copy.cogita.library.add.info.referenceMissingSource }));
      return;
    }

    setInlineReferenceSavingField(fieldKey);
    setInlineReferenceStatus((prev) => ({ ...prev, [fieldKey]: null }));
    try {
      const resource = getReferenceResource(form);
      const links = resource ? { resource: resource.id } : {};
      const payload = {
        label: buildReferenceSourceLabel(form),
        sourceKind: form.sourceKind.trim(),
        locator: buildSourceLocatorPayload(form)
      };
      const created = await createCogitaInfo({
        libraryId,
        infoType: 'source',
        payload,
        links
      });
      const option: CogitaInfoOption = {
        id: created.infoId,
        infoType: 'source',
        label: payload.label
      };
      setMultiLinks((prev) => {
        const current = prev[fieldKey] ?? [];
        if (current.some((item) => item.id === option.id)) return prev;
        return { ...prev, [fieldKey]: [...current, option] };
      });
      setInlineReferenceForms((prev) => ({ ...prev, [fieldKey]: resetReferenceFormAfterCreate(form) }));
      setInlineReferenceStatus((prev) => ({ ...prev, [fieldKey]: null }));
    } catch (error) {
      setInlineReferenceStatus((prev) => ({
        ...prev,
        [fieldKey]: extractApiErrorMessage(error, copy.cogita.library.lookup.createFailed)
      }));
    } finally {
      setInlineReferenceSavingField((current) => (current === fieldKey ? null : current));
    }
  };

  const handleSave = async () => {
    if (!currentSpec) return;

    const payload: Record<string, unknown> = {};
    for (const field of currentSpec.payloadFields) {
      if (selectedInfoType === 'source' && (field.key === 'sourceKind' || field.key === 'locator')) {
        continue;
      }
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
      if (selectedInfoType === 'source' && linkField.key === 'resource') {
        continue;
      }
      if (linkField.multiple) {
        const values = (multiLinks[linkField.key] ?? []).map((item) => item.id);
        if (linkField.required && values.length === 0) {
          setStatus(`Link '${linkField.label}' is required.`);
          return;
        }
        if (values.length > 0) {
          links[linkField.key] = values;
        }
      } else {
        const value = singleLinks[linkField.key]?.id ?? null;
        if (linkField.required && !value) {
          setStatus(`Link '${linkField.label}' is required.`);
          return;
        }
        if (value) {
          links[linkField.key] = value;
        }
      }
    }

    if (selectedInfoType === 'source') {
      if (!validateReferenceSourceForm(sourceReferenceForm)) {
        setStatus(copy.cogita.library.add.info.referenceMissingSource);
        return;
      }

      const sourceKind = sourceReferenceForm.sourceKind.trim();
      payload.sourceKind = sourceKind;
      payload.locator = buildSourceLocatorPayload(sourceReferenceForm);
      if (typeof payload.label !== 'string' || !payload.label.trim()) {
        payload.label = buildReferenceSourceLabel(sourceReferenceForm);
      }

      const resource = getReferenceResource(sourceReferenceForm);
      if (resource) {
        links.resource = resource.id;
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
        for (const field of currentSpec.payloadFields) {
          nextPayload[field.key] = field.keepOnCreate ? (payloadValues[field.key] ?? '') : '';
        }
        setPayloadValues(nextPayload);

        const nextSingle: Record<string, CogitaInfoOption | null> = {};
        const nextMulti: Record<string, CogitaInfoOption[]> = {};
        for (const link of currentSpec.linkFields) {
          if (link.multiple) nextMulti[link.key] = link.keepOnCreate ? (multiLinks[link.key] ?? []) : [];
          else nextSingle[link.key] = link.keepOnCreate ? (singleLinks[link.key] ?? null) : null;
        }
        setSingleLinks((prev) => ({ ...prev, ...nextSingle }));
        setMultiLinks((prev) => ({ ...prev, ...nextMulti }));
        if (selectedInfoType === 'source') {
          setSourceReferenceForm((prev) => {
            const next = resetReferenceFormAfterCreate(prev);
            const nextResource = getReferenceResource(next);
            setPayloadValues((current) => ({
              ...current,
              sourceKind: next.sourceKind,
              locator: normalizePayloadValue(buildSourceLocatorPayload(next))
            }));
            setSingleLinks((current) => ({ ...current, resource: nextResource }));
            if (nextResource) {
              setLinkTypeSelections((current) => ({ ...current, resource: nextResource.infoType }));
            }
            return next;
          });
        }
      }
    } catch (error) {
      setStatus(extractApiErrorMessage(error, 'Failed to save info.'));
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
    const isReferenceAttachmentField = field.key === 'references' && field.multiple && field.targetTypes.includes('source');
    const inlineReferenceForm = inlineReferenceForms[field.key] ?? createEmptyReferenceSourceForm();
    const inlineReferenceOpen = inlineReferenceEnabled[field.key] ?? false;
    const inlineStatus = inlineReferenceStatus[field.key];
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
        {isReferenceAttachmentField ? (
          <div>
            <label className="cogita-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={inlineReferenceOpen}
                onChange={(event) =>
                  setInlineReferenceEnabled((prev) => ({ ...prev, [field.key]: event.target.checked }))
                }
              />
              <span>{copy.cogita.library.add.info.referenceToggle}</span>
            </label>
            {inlineReferenceOpen ? (
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">{copy.cogita.library.add.info.referenceTitle}</p>
                <ReferencePanel
                  libraryId={libraryId}
                  copy={copy}
                  language={language}
                  sourceKindOptions={[...SOURCE_KIND_OPTIONS]}
                  value={inlineReferenceForm}
                  onChange={(next) => setInlineReferenceForms((prev) => ({ ...prev, [field.key]: next }))}
                  labels={referencePanelLabels}
                />
                <div className="cogita-form-actions">
                  <button
                    type="button"
                    className="cta ghost"
                    onClick={() => handleInlineReferenceCreate(field.key)}
                    disabled={inlineReferenceSavingField === field.key}
                  >
                    {inlineReferenceSavingField === field.key
                      ? copy.cogita.library.lookup.saving
                      : copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.source)}
                  </button>
                </div>
                {inlineStatus ? <p className="cogita-library-subtitle">{inlineStatus}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderSourceReferenceEditor = () => (
    <div className="cogita-library-panel">
      <p className="cogita-user-kicker">{copy.cogita.library.add.info.referenceTitle}</p>
      <ReferencePanel
        libraryId={libraryId}
        copy={copy}
        language={language}
        sourceKindOptions={[...SOURCE_KIND_OPTIONS]}
        value={sourceReferenceForm}
        onChange={setSourceReferenceForm}
        labels={referencePanelLabels}
      />
    </div>
  );

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

              {loading === 'loading' && isEditMode ? <p>Loading...</p> : null}

              {currentSpec && !(loading === 'loading' && isEditMode) ? (
                <div className="cogita-form-grid">
                  {currentSpec.payloadFields
                    .filter((field) => !(selectedInfoType === 'source' && (field.key === 'sourceKind' || field.key === 'locator')))
                    .map(renderPayloadField)}
                  {selectedInfoType === 'source' ? renderSourceReferenceEditor() : null}
                  {currentSpec.linkFields
                    .filter((field) => !(selectedInfoType === 'source' && field.key === 'resource'))
                    .map(renderLinkField)}
                </div>
              ) : (
                loading === 'loading' && isEditMode ? null : <p>No specification found for this info type.</p>
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
