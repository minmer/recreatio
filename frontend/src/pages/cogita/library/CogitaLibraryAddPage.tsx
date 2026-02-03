import { useEffect, useMemo, useRef, useState } from 'react';
import { checkCogitaWordLanguage, createCogitaConnection, createCogitaInfo, getCogitaInfoDetail, updateCogitaInfo } from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaConnectionType, CogitaGroupType, CogitaInfoOption, CogitaInfoType } from './types';
import { InfoSearchSelect } from './components/InfoSearchSelect';
import { ComputedGraphEditor, type ComputedGraphDefinition } from './components/ComputedGraphEditor';
import { buildComputedSampleFromGraph } from './utils/computedGraph';
import { LatexBlock, LatexInline } from '../../../components/LatexText';
import { getConnectionTypeOptions, getGroupTypeOptions, getInfoTypeLabel, getInfoTypeOptions } from './libraryOptions';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';
import { CogitaLibrarySidebar } from './components/CogitaLibrarySidebar';
import bibleBooks from '../../../content/bibleBooks.json';

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
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [activeTab, setActiveTab] = useState<'info' | 'connection' | 'group'>('info');
  const [infoForm, setInfoForm] = useState({
    infoType: 'word' as CogitaInfoType,
    label: '',
    language: null as CogitaInfoOption | null,
    notes: '',
    sourceKind: 'string' as string,
    sourceLocatorValue: '',
    sourceLocatorAux: '',
    sourceBibleBookDisplay: '',
    sourceResourceType: 'work' as CogitaInfoType,
    sourceResource: null as CogitaInfoOption | null,
    quoteText: '',
    workLanguage: null as CogitaInfoOption | null,
    workOriginalLanguage: null as CogitaInfoOption | null,
    workDoi: '',
    mediaType: 'book' as string,
    mediaPublisher: '',
    mediaPublicationPlace: '',
    mediaPublicationYear: '',
    mediaPages: '',
    mediaIsbn: '',
    mediaCover: '',
    mediaHeight: '',
    mediaLength: '',
    mediaWidth: '',
    mediaWeight: '',
    mediaCollection: '',
    mediaLocation: '',
    sourceUrl: '',
    sourceAccessedDate: ''
  });
  const [computedAnswerTemplate, setComputedAnswerTemplate] = useState('');
  const [computedGraph, setComputedGraph] = useState<ComputedGraphDefinition | null>(null);
  const [computedPreview, setComputedPreview] = useState<{
    prompt: string;
    answers: Record<string, string>;
    answerText?: string;
  } | null>(null);
  const [computedPreviewStatus, setComputedPreviewStatus] = useState<'idle' | 'ready' | 'error'>('idle');
  const [connectionForm, setConnectionForm] = useState({
    connectionType: 'translation' as CogitaConnectionType,
    language: null as CogitaInfoOption | null,
    word: null as CogitaInfoOption | null,
    wordA: null as CogitaInfoOption | null,
    wordB: null as CogitaInfoOption | null,
    sentence: null as CogitaInfoOption | null,
    topic: null as CogitaInfoOption | null,
    quote: null as CogitaInfoOption | null,
    source: null as CogitaInfoOption | null,
    referencedInfoType: 'word' as CogitaInfoType,
    referencedInfo: null as CogitaInfoOption | null,
    work: null as CogitaInfoOption | null,
    contributorType: 'person' as CogitaInfoType,
    contributor: null as CogitaInfoOption | null,
    contributorRole: '',
    medium: null as CogitaInfoOption | null,
    orcidEntityType: 'person' as CogitaInfoType,
    orcidEntity: null as CogitaInfoOption | null,
    orcid: null as CogitaInfoOption | null,
    sourceResourceType: 'work' as CogitaInfoType,
    sourceResource: null as CogitaInfoOption | null,
    note: ''
  });
  const [groupForm, setGroupForm] = useState({
    groupType: 'vocab' as CogitaGroupType,
    languageA: null as CogitaInfoOption | null,
    wordA: null as CogitaInfoOption | null,
    languageB: null as CogitaInfoOption | null,
    wordB: null as CogitaInfoOption | null,
    wordATags: [] as CogitaInfoOption[],
    wordBTags: [] as CogitaInfoOption[],
    translationTags: [] as CogitaInfoOption[],
    citationQuoteText: '',
    citationLanguage: null as CogitaInfoOption | null,
    citationSourceKind: 'string' as string,
    citationLocatorValue: '',
    citationLocatorAux: '',
    citationBibleBookDisplay: '',
    citationSourceUrl: '',
    citationSourceAccessedDate: '',
    citationChurchDocument: null as CogitaInfoOption | null,
    citationBookMedia: null as CogitaInfoOption | null,
    citationWork: null as CogitaInfoOption | null
  });
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'idle' | 'loading' | 'saving'>('idle');
  const [pairStatus, setPairStatus] = useState<string | null>(null);
  const [groupPairStatusA, setGroupPairStatusA] = useState<string | null>(null);
  const [groupPairStatusB, setGroupPairStatusB] = useState<string | null>(null);
  const wordARef = useRef<HTMLInputElement | null>(null);
  const wordBRef = useRef<HTMLInputElement | null>(null);
  const groupConfirmRef = useRef<HTMLButtonElement | null>(null);
  const infoTypeOptions = useMemo(() => getInfoTypeOptions(copy), [copy]);
  const connectionTypeOptions = useMemo(() => getConnectionTypeOptions(copy), [copy]);
  const groupTypeOptions = useMemo(() => getGroupTypeOptions(copy), [copy]);
  const sourceKindOptions = useMemo(
    () => [
      { value: 'string', label: 'String' },
      { value: 'book', label: 'Book' },
      { value: 'website', label: 'Website' },
      { value: 'bible', label: 'Bible' },
      { value: 'number_document', label: 'Numbered document' },
      { value: 'work', label: copy.cogita.library.infoTypes.work },
      { value: 'other', label: 'Other' }
    ],
    [copy]
  );
  const sourceResourceTypeOptions = useMemo(
    () =>
      infoTypeOptions.filter(
        (option) =>
          option.value !== 'any' &&
          option.value !== 'computed' &&
          option.value !== 'source' &&
          option.value !== 'quote'
      ),
    [infoTypeOptions]
  );
  const bibleBookOptions = useMemo(() => {
    const lang = language;
    return (bibleBooks as Array<any>).map((book) => {
      const entry = book?.[lang] ?? book?.en ?? book?.la;
      const label = `${entry.abbr} — ${entry.name}`;
      return { label, latin: book?.la?.abbr ?? entry.abbr };
    });
  }, [language]);
  const resolveBibleBook = (input: string, lang: 'pl' | 'en' | 'de') => {
    const normalized = input.trim().toLowerCase();
    if (!normalized) return null;
    const books = bibleBooks as Array<any>;
    for (const book of books) {
      const la = book?.la;
      const entry = book?.[lang] ?? book?.en ?? la;
      const candidates = [
        entry?.abbr,
        entry?.name,
        la?.abbr,
        la?.name,
        `${entry?.abbr} — ${entry?.name}`
      ]
        .filter(Boolean)
        .map((value: string) => value.toLowerCase());
      if (candidates.some((value) => value === normalized)) {
        return { book, entry, la };
      }
    }
    return null;
  };

  useEffect(() => {
    if (!connectionForm.language || !connectionForm.word) {
      setPairStatus(null);
      return;
    }
    const handle = window.setTimeout(() => {
      checkCogitaWordLanguage({
        libraryId,
        languageId: connectionForm.language!.id,
        wordId: connectionForm.word!.id
        })
        .then((result) => {
          setPairStatus(result.exists ? copy.cogita.library.add.connection.pairExists : null);
        })
        .catch(() => {
          setPairStatus(null);
        });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [libraryId, connectionForm.language, connectionForm.word]);

  useEffect(() => {
    if (!groupForm.languageA || !groupForm.wordA) {
      setGroupPairStatusA(null);
      return;
    }
    const handle = window.setTimeout(() => {
      checkCogitaWordLanguage({
        libraryId,
        languageId: groupForm.languageA!.id,
        wordId: groupForm.wordA!.id
        })
        .then((result) => {
          setGroupPairStatusA(result.exists ? copy.cogita.library.add.group.pairExistsA : null);
        })
        .catch(() => {
          setGroupPairStatusA(null);
        });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [libraryId, groupForm.languageA, groupForm.wordA]);

  useEffect(() => {
    if (!groupForm.languageB || !groupForm.wordB) {
      setGroupPairStatusB(null);
      return;
    }
    const handle = window.setTimeout(() => {
      checkCogitaWordLanguage({
        libraryId,
        languageId: groupForm.languageB!.id,
        wordId: groupForm.wordB!.id
        })
        .then((result) => {
          setGroupPairStatusB(result.exists ? copy.cogita.library.add.group.pairExistsB : null);
        })
        .catch(() => {
          setGroupPairStatusB(null);
        });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [libraryId, groupForm.languageB, groupForm.wordB]);

  useEffect(() => {
    if (!isEditMode || !editInfoId) return;
    let cancelled = false;
    setEditStatus('loading');
    setFormStatus(null);
    getCogitaInfoDetail({ libraryId, infoId: editInfoId })
      .then(async (detail) => {
        if (cancelled) return;
        const payload = (detail.payload ?? {}) as {
          label?: string;
          notes?: string;
          languageId?: string;
          definition?: { promptTemplate?: string; answerTemplate?: string; graph?: ComputedGraphDefinition | null };
          sourceKind?: string;
          locator?: Record<string, unknown>;
          text?: string;
          originalLanguageId?: string;
          doi?: string;
          orcidId?: string;
          publisher?: string;
          publicationPlace?: string;
          publicationYear?: string;
          pages?: string;
          isbn?: string;
          cover?: string;
          height?: string;
          length?: string;
          width?: string;
          weight?: string;
          collection?: string;
          location?: string;
          mediaType?: string;
        };
        setInfoForm((prev) => ({
          ...prev,
          infoType: detail.infoType as CogitaInfoType,
          label: payload.label ?? '',
          notes: payload.notes ?? '',
          language: payload.languageId
            ? { id: payload.languageId, label: payload.languageId, infoType: 'language' }
            : null,
          sourceKind: payload.sourceKind ?? 'string',
          sourceResourceType: prev.sourceResourceType ?? 'work',
          sourceResource: null,
          sourceLocatorValue: '',
          sourceLocatorAux: '',
          quoteText: payload.text ?? '',
          workLanguage: payload.languageId
            ? { id: payload.languageId, label: payload.languageId, infoType: 'language' }
            : null,
          workOriginalLanguage: payload.originalLanguageId
            ? { id: payload.originalLanguageId, label: payload.originalLanguageId, infoType: 'language' }
            : null,
          workDoi: payload.doi ?? '',
          mediaType: payload.mediaType ?? 'book',
          mediaPublisher: payload.publisher ?? '',
          mediaPublicationPlace: payload.publicationPlace ?? '',
          mediaPublicationYear: payload.publicationYear ?? '',
          mediaPages: payload.pages ?? '',
          mediaIsbn: payload.isbn ?? '',
          mediaCover: payload.cover ?? '',
          mediaHeight: payload.height ?? '',
          mediaLength: payload.length ?? '',
          mediaWidth: payload.width ?? '',
          mediaWeight: payload.weight ?? '',
          mediaCollection: payload.collection ?? '',
          mediaLocation: payload.location ?? '',
          sourceUrl: '',
          sourceAccessedDate: ''
        }));
        if (detail.infoType === 'source' && payload.locator && typeof payload.locator === 'object') {
          const locator = payload.locator as Record<string, unknown>;
          if (payload.sourceKind === 'website') {
            setInfoForm((prev) => ({
              ...prev,
              sourceUrl: typeof locator.url === 'string' ? locator.url : '',
              sourceAccessedDate: typeof locator.date === 'string' ? locator.date : ''
            }));
          } else if (payload.sourceKind === 'bible') {
            const latinBook = typeof locator.book === 'string' ? locator.book : '';
            const match = latinBook ? resolveBibleBook(latinBook, language) : null;
            const display = match ? `${match.entry.abbr} — ${match.entry.name}` : latinBook;
            setInfoForm((prev) => ({
              ...prev,
              sourceLocatorValue: latinBook,
              sourceLocatorAux: typeof locator.rest === 'string' ? locator.rest : '',
              sourceBibleBookDisplay: display
            }));
          } else if (payload.sourceKind === 'book') {
            setInfoForm((prev) => ({
              ...prev,
              sourceLocatorValue: typeof locator.page === 'string' ? locator.page : ''
            }));
          } else if (payload.sourceKind === 'number_document') {
            setInfoForm((prev) => ({
              ...prev,
              sourceLocatorValue: typeof locator.number === 'string' ? locator.number : ''
            }));
          } else if (typeof locator.text === 'string') {
            setInfoForm((prev) => ({
              ...prev,
              sourceLocatorValue: locator.text
            }));
          }
        }
        if (payload.languageId && detail.infoType !== 'work') {
          try {
            const languageDetail = await getCogitaInfoDetail({ libraryId, infoId: payload.languageId });
            if (cancelled) return;
            setInfoForm((prev) => ({
              ...prev,
              language: {
                id: payload.languageId!,
                label: (languageDetail.payload as { label?: string })?.label ?? payload.languageId!,
                infoType: 'language'
              }
            }));
          } catch {
            // Ignore language label lookup failure
          }
        }
        if (payload.languageId && detail.infoType === 'work') {
          try {
            const languageDetail = await getCogitaInfoDetail({ libraryId, infoId: payload.languageId });
            if (cancelled) return;
            setInfoForm((prev) => ({
              ...prev,
              workLanguage: {
                id: payload.languageId!,
                label: (languageDetail.payload as { label?: string })?.label ?? payload.languageId!,
                infoType: 'language'
              }
            }));
          } catch {
            // Ignore work language label lookup failure
          }
        }
        if (payload.originalLanguageId) {
          try {
            const languageDetail = await getCogitaInfoDetail({ libraryId, infoId: payload.originalLanguageId });
            if (cancelled) return;
            setInfoForm((prev) => ({
              ...prev,
              workOriginalLanguage: {
                id: payload.originalLanguageId!,
                label: (languageDetail.payload as { label?: string })?.label ?? payload.originalLanguageId!,
                infoType: 'language'
              }
            }));
          } catch {
            // Ignore original language label lookup failure
          }
        }
        if (detail.infoType === 'computed') {
          setComputedAnswerTemplate(payload.definition?.answerTemplate ?? '');
          setComputedGraph(payload.definition?.graph ?? null);
          setComputedPreview(null);
          setComputedPreviewStatus('idle');
        } else {
          setComputedAnswerTemplate('');
          setComputedGraph(null);
          setComputedPreview(null);
          setComputedPreviewStatus('idle');
        }
        setActiveTab('info');
      })
      .catch(() => {
        if (cancelled) return;
        setFormStatus(copy.cogita.library.add.info.failed);
      })
      .finally(() => {
        if (!cancelled) setEditStatus('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [copy, editInfoId, isEditMode, libraryId]);

  useEffect(() => {
    if (infoForm.sourceKind === 'bible' && infoForm.sourceLocatorValue) {
      const match = resolveBibleBook(infoForm.sourceLocatorValue, language);
      if (match) {
        const display = `${match.entry.abbr} — ${match.entry.name}`;
        if (display !== infoForm.sourceBibleBookDisplay) {
          setInfoForm((prev) => ({ ...prev, sourceBibleBookDisplay: display }));
        }
      }
    }
    if (groupForm.citationSourceKind === 'bible' && groupForm.citationLocatorValue) {
      const match = resolveBibleBook(groupForm.citationLocatorValue, language);
      if (match) {
        const display = `${match.entry.abbr} — ${match.entry.name}`;
        if (display !== groupForm.citationBibleBookDisplay) {
          setGroupForm((prev) => ({ ...prev, citationBibleBookDisplay: display }));
        }
      }
    }
  }, [
    language,
    infoForm.sourceKind,
    infoForm.sourceLocatorValue,
    infoForm.sourceBibleBookDisplay,
    groupForm.citationSourceKind,
    groupForm.citationLocatorValue,
    groupForm.citationBibleBookDisplay
  ]);

  const handleSaveInfo = async () => {
    setFormStatus(null);
    try {
      const payload: Record<string, unknown> = {
        label: infoForm.infoType === 'quote' || infoForm.infoType === 'source' ? '' : infoForm.label,
        notes: infoForm.infoType === 'computed' ? '' : infoForm.notes
      };
      if (infoForm.language && (infoForm.infoType === 'word' || infoForm.infoType === 'sentence')) {
        payload.languageId = infoForm.language.id;
      }
      if (infoForm.infoType === 'source') {
        payload.sourceKind = infoForm.sourceKind;
        if (infoForm.sourceKind === 'website') {
          payload.locator = {
            url: infoForm.sourceUrl.trim(),
            date: infoForm.sourceAccessedDate.trim()
          };
        } else if (infoForm.sourceKind === 'bible') {
          payload.locator = {
            book: infoForm.sourceLocatorValue.trim(),
            rest: infoForm.sourceLocatorAux.trim()
          };
        } else if (infoForm.sourceKind === 'book') {
          payload.locator = { page: infoForm.sourceLocatorValue.trim() };
        } else if (infoForm.sourceKind === 'number_document') {
          payload.locator = { number: infoForm.sourceLocatorValue.trim() };
        } else {
          payload.locator = { text: infoForm.sourceLocatorValue.trim() };
        }
      }
      if (infoForm.infoType === 'quote') {
        payload.text = infoForm.quoteText;
      }
      if (infoForm.infoType === 'work') {
        payload.languageId = infoForm.workLanguage?.id ?? null;
        payload.originalLanguageId = infoForm.workOriginalLanguage?.id ?? null;
        payload.doi = infoForm.workDoi.trim();
      }
      if (infoForm.infoType === 'media') {
        payload.mediaType = infoForm.mediaType;
        payload.publisher = infoForm.mediaPublisher.trim();
        payload.publicationPlace = infoForm.mediaPublicationPlace.trim();
        payload.publicationYear = infoForm.mediaPublicationYear.trim();
        payload.pages = infoForm.mediaPages.trim();
        payload.isbn = infoForm.mediaIsbn.trim();
        payload.cover = infoForm.mediaCover.trim();
        payload.height = infoForm.mediaHeight.trim();
        payload.length = infoForm.mediaLength.trim();
        payload.width = infoForm.mediaWidth.trim();
        payload.weight = infoForm.mediaWeight.trim();
        payload.collection = infoForm.mediaCollection.trim();
        payload.location = infoForm.mediaLocation.trim();
      }
        if (infoForm.infoType === 'computed') {
          if (!computedGraph) {
            setFormStatus(copy.cogita.library.add.info.computedRequired);
            return;
          }
        if (!computedAnswerTemplate.trim()) {
          setFormStatus(copy.cogita.library.add.info.computedAnswerRequired);
          return;
        }
          const invalidName = computedGraph.nodes.find((node) => node.name && !/^[A-Za-z][A-Za-z0-9_]*$/.test(node.name));
          if (invalidName) {
            setFormStatus(copy.cogita.library.add.info.computedInvalidName);
            return;
          }
        const names = computedGraph.nodes.map((node) => node.name?.trim()).filter(Boolean) as string[];
        const nameSet = new Set<string>();
          for (const name of names) {
            const key = name.toLowerCase();
            if (nameSet.has(key)) {
              setFormStatus(copy.cogita.library.add.info.computedDuplicateName);
              return;
            }
            nameSet.add(key);
          }
          const outputNodes = computedGraph.nodes.filter((node) => node.type === 'output');
          const outputNames = outputNodes.map((node) => node.name?.trim()).filter(Boolean) as string[];
          if (outputNames.length !== outputNodes.length) {
            setFormStatus(copy.cogita.library.add.info.computedAnswerMissingOutput);
            return;
          }
          const allOutputsPresent = outputNames.every((name) =>
            new RegExp(`\\{\\s*${name}\\s*\\}`, 'i').test(computedAnswerTemplate)
          );
          if (!allOutputsPresent) {
            setFormStatus(copy.cogita.library.add.info.computedAnswerMissingOutput);
            return;
          }
        payload.definition = {
          answerTemplate: computedAnswerTemplate,
          graph: computedGraph
        };
      }
      if (isEditMode && editInfoId) {
        setEditStatus('saving');
        await updateCogitaInfo({
          libraryId,
          infoId: editInfoId,
          payload
        });
        setFormStatus(copy.cogita.library.add.info.updated);
        setEditStatus('idle');
      } else {
        const created = await createCogitaInfo({
          libraryId,
          infoType: infoForm.infoType,
          payload
        });
        if (infoForm.infoType === 'source' && infoForm.sourceResource) {
          await createCogitaConnection({
            libraryId,
            connectionType: 'source-resource',
            infoIds: [created.infoId, infoForm.sourceResource.id]
          });
        }
        if (infoForm.infoType === 'quote' && infoForm.language) {
          await createCogitaConnection({
            libraryId,
            connectionType: 'quote-language',
            infoIds: [created.infoId, infoForm.language.id]
          });
        }
        setFormStatus(copy.cogita.library.add.info.saved);
        const keepLanguage = infoForm.infoType === 'word' || infoForm.infoType === 'sentence';
        setInfoForm({
          infoType: infoForm.infoType,
          label: '',
          language: keepLanguage ? infoForm.language : null,
          notes: '',
          sourceKind: 'string',
          sourceLocatorValue: '',
          sourceLocatorAux: '',
          sourceBibleBookDisplay: '',
          sourceResourceType: infoForm.sourceResourceType,
          sourceResource: null,
          quoteText: '',
          workLanguage: null,
          workOriginalLanguage: null,
          workDoi: '',
          mediaType: 'book',
          mediaPublisher: '',
          mediaPublicationPlace: '',
          mediaPublicationYear: '',
          mediaPages: '',
          mediaIsbn: '',
          mediaCover: '',
          mediaHeight: '',
          mediaLength: '',
          mediaWidth: '',
          mediaWeight: '',
          mediaCollection: '',
          mediaLocation: '',
          sourceUrl: '',
          sourceAccessedDate: ''
        });
        if (infoForm.infoType === 'computed') {
          setComputedAnswerTemplate('');
          setComputedGraph(null);
          setComputedPreview(null);
          setComputedPreviewStatus('idle');
        }
      }
    } catch {
      setFormStatus(copy.cogita.library.add.info.failed);
    }
  };

  const handleComputedPreview = () => {
    setComputedPreviewStatus('idle');
    if (!computedGraph) {
      setComputedPreview(null);
      setComputedPreviewStatus('error');
      return;
    }
    const preview = buildComputedSampleFromGraph(computedGraph, '', computedAnswerTemplate);
    if (!preview) {
      setComputedPreview(null);
      setComputedPreviewStatus('error');
      return;
    }
    setComputedPreview({ prompt: preview.prompt, answers: preview.answers, answerText: preview.answerText });
    setComputedPreviewStatus('ready');
  };

  const handleCreateConnection = async () => {
    setFormStatus(null);
    try {
      if (connectionForm.connectionType === 'reference') {
        if (!connectionForm.referencedInfo || !connectionForm.source) {
          setFormStatus(copy.cogita.library.add.connection.selectReference);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.referencedInfo.id, connectionForm.source.id]
        });
      } else if (connectionForm.connectionType === 'source-resource') {
        if (!connectionForm.source || !connectionForm.sourceResource) {
          setFormStatus(copy.cogita.library.add.connection.selectSourceResource);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.source.id, connectionForm.sourceResource.id]
        });
      } else if (connectionForm.connectionType === 'quote-language') {
        if (!connectionForm.quote || !connectionForm.language) {
          setFormStatus(copy.cogita.library.add.connection.selectQuoteLanguage);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.quote.id, connectionForm.language.id]
        });
      } else if (connectionForm.connectionType === 'work-contributor') {
        if (!connectionForm.work || !connectionForm.contributor || !connectionForm.contributorRole.trim()) {
          setFormStatus(copy.cogita.library.add.connection.selectWorkContributor);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.work.id, connectionForm.contributor.id],
          payload: { role: connectionForm.contributorRole.trim() }
        });
      } else if (connectionForm.connectionType === 'work-medium') {
        if (!connectionForm.work || !connectionForm.medium) {
          setFormStatus(copy.cogita.library.add.connection.selectWorkMedium);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.work.id, connectionForm.medium.id]
        });
      } else if (connectionForm.connectionType === 'orcid-link') {
        if (!connectionForm.orcidEntity || !connectionForm.orcid) {
          setFormStatus(copy.cogita.library.add.connection.selectOrcidLink);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.orcidEntity.id, connectionForm.orcid.id]
        });
      } else if (connectionForm.connectionType === 'word-language') {
        if (!connectionForm.language || !connectionForm.word) {
          setFormStatus(copy.cogita.library.add.connection.selectWordLanguage);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.language.id, connectionForm.word.id],
          payload: { note: connectionForm.note }
        });
      } else if (connectionForm.connectionType === 'word-topic') {
        if (!connectionForm.word || !connectionForm.topic) {
          setFormStatus(copy.cogita.library.add.connection.selectWordTopic);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.word.id, connectionForm.topic.id],
          payload: { note: connectionForm.note }
        });
      } else if (connectionForm.connectionType === 'translation') {
        if (!connectionForm.wordA || !connectionForm.wordB) {
          setFormStatus(copy.cogita.library.add.connection.selectTwoWords);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.wordA.id, connectionForm.wordB.id],
          payload: { note: connectionForm.note }
        });
      } else if (connectionForm.connectionType === 'language-sentence') {
        if (!connectionForm.language || !connectionForm.sentence) {
          setFormStatus(copy.cogita.library.add.connection.selectLanguageSentence);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.language.id, connectionForm.sentence.id],
          payload: { note: connectionForm.note }
        });
      }
      setFormStatus(copy.cogita.library.add.connection.saved);
      setConnectionForm((prev) => ({
        connectionType: prev.connectionType,
        language: prev.connectionType === 'word-language' || prev.connectionType === 'language-sentence' ? prev.language : null,
        word: null,
        wordA: null,
        wordB: null,
        sentence: null,
        topic: prev.connectionType === 'word-topic' ? prev.topic : null,
        source: prev.connectionType === 'reference' || prev.connectionType === 'source-resource' ? prev.source : null,
        referencedInfoType: prev.referencedInfoType,
        referencedInfo: null,
        sourceResourceType: prev.sourceResourceType,
        sourceResource: null,
        work: null,
        contributorType: prev.contributorType,
        contributor: null,
        contributorRole: '',
        medium: null,
        orcidEntityType: prev.orcidEntityType,
        orcidEntity: null,
        orcid: null,
        note: ''
      }));
    } catch {
      setFormStatus(copy.cogita.library.add.connection.failed);
    }
  };

  const handleCreateGroup = async () => {
    setFormStatus(null);
    try {
      if (groupForm.groupType === 'citation') {
        const quoteText = groupForm.citationQuoteText.trim();
        if (!quoteText) {
          setFormStatus(copy.cogita.library.add.group.citationMissingQuote);
          return;
        }

        let resourceInfoId: string | null = null;
        if (groupForm.citationSourceKind === 'number_document') {
          if (!groupForm.citationChurchDocument) {
            setFormStatus(copy.cogita.library.add.group.citationMissingSource);
            return;
          }
          resourceInfoId = groupForm.citationChurchDocument.id;
        }

        if (groupForm.citationSourceKind === 'book') {
          if (!groupForm.citationBookMedia) {
            setFormStatus(copy.cogita.library.add.group.citationMissingSource);
            return;
          }
          resourceInfoId = groupForm.citationBookMedia.id;
        }

        if (groupForm.citationSourceKind === 'work') {
          if (!groupForm.citationWork) {
            setFormStatus(copy.cogita.library.add.group.citationMissingSource);
            return;
          }
          resourceInfoId = groupForm.citationWork.id;
        }

        const sourcePayload: Record<string, unknown> = {
          sourceKind: groupForm.citationSourceKind
        };
        if (groupForm.citationSourceKind === 'website') {
          const url = groupForm.citationSourceUrl.trim();
          if (!url) {
            setFormStatus(copy.cogita.library.add.group.citationMissingSource);
            return;
          }
          sourcePayload.locator = {
            url,
            date: groupForm.citationSourceAccessedDate.trim()
          };
        }
        if (groupForm.citationSourceKind === 'bible') {
          if (!groupForm.citationLocatorValue.trim() || !groupForm.citationLocatorAux.trim()) {
            setFormStatus(copy.cogita.library.add.group.citationMissingSource);
            return;
          }
          sourcePayload.locator = {
            book: groupForm.citationLocatorValue.trim(),
            rest: groupForm.citationLocatorAux.trim()
          };
        } else if (groupForm.citationSourceKind === 'book') {
          sourcePayload.locator = { page: groupForm.citationLocatorValue.trim() };
        } else if (groupForm.citationSourceKind === 'number_document') {
          sourcePayload.locator = { number: groupForm.citationLocatorValue.trim() };
        } else if (groupForm.citationSourceKind !== 'website') {
          sourcePayload.locator = { text: groupForm.citationLocatorValue.trim() };
        }
        if (
          groupForm.citationSourceKind !== 'website' &&
          groupForm.citationSourceKind !== 'bible' &&
          !groupForm.citationLocatorValue.trim()
        ) {
          setFormStatus(copy.cogita.library.add.group.citationMissingSource);
          return;
        }
        const createdSource = await createCogitaInfo({
          libraryId,
          infoType: 'source',
          payload: sourcePayload
        });
        if (resourceInfoId) {
          await createCogitaConnection({
            libraryId,
            connectionType: 'source-resource',
            infoIds: [createdSource.infoId, resourceInfoId]
          });
        }

        const quotePayload: Record<string, unknown> = {
          text: quoteText
        };
        const createdQuote = await createCogitaInfo({
          libraryId,
          infoType: 'quote',
          payload: quotePayload
        });
        if (groupForm.citationLanguage) {
          await createCogitaConnection({
            libraryId,
            connectionType: 'quote-language',
            infoIds: [createdQuote.infoId, groupForm.citationLanguage.id]
          });
        }

        await createCogitaConnection({
          libraryId,
          connectionType: 'reference',
          infoIds: [createdQuote.infoId, createdSource.infoId]
        });

        setFormStatus(copy.cogita.library.add.group.saved);
        setGroupForm((prev) => ({
          ...prev,
          citationQuoteText: '',
          citationLanguage: null,
          citationSourceKind: 'string',
          citationLocatorValue: '',
          citationLocatorAux: '',
          citationBibleBookDisplay: '',
          citationSourceUrl: '',
          citationSourceAccessedDate: '',
          citationChurchDocument: null,
          citationBookMedia: null,
          citationWork: null
        }));
        return;
      }

      if (!groupForm.languageA || !groupForm.wordA || !groupForm.languageB || !groupForm.wordB) {
        setFormStatus(copy.cogita.library.add.group.selectBoth);
        return;
      }
      const uniqueTagIds = (tags: CogitaInfoOption[]) =>
        Array.from(new Map(tags.map((tag) => [tag.id, tag])).values());

      if (!groupPairStatusA) {
        await createCogitaConnection({
          libraryId,
          connectionType: 'word-language',
          infoIds: [groupForm.languageA.id, groupForm.wordA.id]
        });
      }

      if (!groupPairStatusB) {
        await createCogitaConnection({
          libraryId,
          connectionType: 'word-language',
          infoIds: [groupForm.languageB.id, groupForm.wordB.id]
        });
      }

      for (const tag of uniqueTagIds(groupForm.wordATags)) {
        await createCogitaConnection({
          libraryId,
          connectionType: 'word-topic',
          infoIds: [groupForm.wordA.id, tag.id]
        });
      }

      for (const tag of uniqueTagIds(groupForm.wordBTags)) {
        await createCogitaConnection({
          libraryId,
          connectionType: 'word-topic',
          infoIds: [groupForm.wordB.id, tag.id]
        });
      }

      await createCogitaConnection({
        libraryId,
        connectionType: 'translation',
        infoIds: [groupForm.wordA.id, groupForm.wordB.id],
        payload: { tagIds: uniqueTagIds(groupForm.translationTags).map((tag) => tag.id) }
      });

      setFormStatus(copy.cogita.library.add.group.saved);
      setGroupForm((prev) => ({
        ...prev,
        groupType: groupForm.groupType,
        languageA: groupForm.languageA,
        wordA: null,
        languageB: groupForm.languageB,
        wordB: null,
        wordATags: groupForm.wordATags,
        wordBTags: groupForm.wordBTags,
        translationTags: groupForm.translationTags
      }));
      requestAnimationFrame(() => wordARef.current?.focus());
    } catch {
      setFormStatus(copy.cogita.library.add.group.failed);
    }
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
            <p className="cogita-user-kicker">{copy.cogita.library.add.kicker}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">{copy.cogita.library.add.subtitle}</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              {copy.cogita.library.actions.backToCogita}
            </a>
            <a className="cta ghost" href={baseHref}>
              {copy.cogita.library.actions.libraryOverview}
            </a>
            <a className="cta ghost" href={`${baseHref}/list`}>
              {copy.cogita.library.actions.openList}
            </a>
          </div>
        </header>

        <div className="cogita-add-tabs">
          {(['info', 'connection', 'group'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className="cogita-type-card"
              data-active={activeTab === tab}
              onClick={() => {
                if (isEditMode) return;
                setActiveTab(tab);
              }}
              disabled={isEditMode && tab !== 'info'}
            >
              <span className="cogita-type-label">{copy.cogita.library.add.tabs[tab]}</span>
              <span className="cogita-type-desc">
                {tab === 'info' && copy.cogita.library.add.tabDesc.info}
                {tab === 'connection' && copy.cogita.library.add.tabDesc.connection}
                {tab === 'group' && copy.cogita.library.add.tabDesc.group}
              </span>
            </button>
          ))}
        </div>

        <div className="cogita-library-layout">
          <CogitaLibrarySidebar libraryId={libraryId} labels={copy.cogita.library.sidebar} />
          <div className="cogita-library-content">
            <div className="cogita-add-center">
              <div className="cogita-library-panel">
                <section className="cogita-library-create">
                  {activeTab === 'info' ? (
                <div className="cogita-form-grid">
                  <label className="cogita-field full">
                    <span>{copy.cogita.library.add.info.typeLabel}</span>
                    <select
                      value={infoForm.infoType}
                      onChange={(event) => {
                        if (isEditMode) return;
                        setInfoForm((prev) => ({ ...prev, infoType: event.target.value as CogitaInfoType }));
                      }}
                      disabled={isEditMode}
                    >
                      {infoTypeOptions
                        .filter((option) => option.value !== 'any')
                        .map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  {infoForm.infoType !== 'quote' && infoForm.infoType !== 'source' && (
                    <label className="cogita-field full">
                      <span>{copy.cogita.library.add.info.labelLabel}</span>
                      <input
                        type="text"
                        value={infoForm.label}
                        onChange={(event) => setInfoForm((prev) => ({ ...prev, label: event.target.value }))}
                        placeholder={copy.cogita.library.add.info.labelPlaceholder}
                      />
                    </label>
                  )}
                  {(infoForm.infoType === 'word' || infoForm.infoType === 'sentence' || infoForm.infoType === 'quote') && (
                    <InfoSearchSelect
                      libraryId={libraryId}
                      infoType="language"
                      label={copy.cogita.library.add.info.languageLabel}
                      placeholder={copy.cogita.library.add.info.languagePlaceholder}
                      value={infoForm.language}
                      onChange={(value) => setInfoForm((prev) => ({ ...prev, language: value }))}
                      searchFailedText={copy.cogita.library.lookup.searchFailed}
                      createFailedText={copy.cogita.library.lookup.createFailed}
                      createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                      savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                    />
                  )}
                  {infoForm.infoType === 'work' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.add.info.workLanguageLabel}
                        placeholder={copy.cogita.library.add.info.workLanguagePlaceholder}
                        value={infoForm.workLanguage}
                        onChange={(value) => setInfoForm((prev) => ({ ...prev, workLanguage: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.add.info.workOriginalLanguageLabel}
                        placeholder={copy.cogita.library.add.info.workOriginalLanguagePlaceholder}
                        value={infoForm.workOriginalLanguage}
                        onChange={(value) => setInfoForm((prev) => ({ ...prev, workOriginalLanguage: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.workDoiLabel}</span>
                        <input
                          type="text"
                          value={infoForm.workDoi}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, workDoi: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.workDoiPlaceholder}
                        />
                      </label>
                    </>
                  )}
                  {infoForm.infoType === 'media' && (
                    <>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaTypeLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaType}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaType: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaTypePlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaPublisherLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaPublisher}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaPublisher: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaPublisherPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaPublicationPlaceLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaPublicationPlace}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaPublicationPlace: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaPublicationPlacePlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaPublicationYearLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaPublicationYear}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaPublicationYear: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaPublicationYearPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaPagesLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaPages}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaPages: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaPagesPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaIsbnLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaIsbn}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaIsbn: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaIsbnPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaCoverLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaCover}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaCover: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaCoverPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaHeightLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaHeight}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaHeight: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaHeightPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaLengthLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaLength}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaLength: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaLengthPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaWidthLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaWidth}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaWidth: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaWidthPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaWeightLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaWeight}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaWeight: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaWeightPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaCollectionLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaCollection}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaCollection: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaCollectionPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaLocationLabel}</span>
                        <input
                          type="text"
                          value={infoForm.mediaLocation}
                          onChange={(event) => setInfoForm((prev) => ({ ...prev, mediaLocation: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaLocationPlaceholder}
                        />
                      </label>
                    </>
                  )}
                  {infoForm.infoType === 'quote' && (
                    <label className="cogita-field full">
                      <span>{copy.cogita.library.add.info.quoteTextLabel}</span>
                      <textarea
                        value={infoForm.quoteText}
                        onChange={(event) => setInfoForm((prev) => ({ ...prev, quoteText: event.target.value }))}
                        placeholder={copy.cogita.library.add.info.quoteTextPlaceholder}
                      />
                    </label>
                  )}
                  {infoForm.infoType === 'source' && (
                    <>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.sourceKindLabel}</span>
                        <select
                          value={infoForm.sourceKind}
                          onChange={(event) => {
                            const nextKind = event.target.value;
                            const forcedResource =
                              nextKind === 'book' || nextKind === 'media'
                                ? 'media'
                                : nextKind === 'bible' || nextKind === 'number_document' || nextKind === 'work'
                                ? 'work'
                                : infoForm.sourceResourceType;
                            setInfoForm((prev) => ({
                              ...prev,
                              sourceKind: nextKind,
                              sourceResourceType: forcedResource as CogitaInfoType,
                              sourceResource: null,
                              sourceLocatorValue: nextKind === 'bible' ? '' : prev.sourceLocatorValue,
                              sourceLocatorAux: nextKind === 'bible' ? '' : prev.sourceLocatorAux,
                              sourceBibleBookDisplay: nextKind === 'bible' ? prev.sourceBibleBookDisplay : ''
                            }));
                          }}
                        >
                          {sourceKindOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {infoForm.sourceKind === 'bible' && (
                        <>
                          <label className="cogita-field full">
                            <span>{copy.cogita.library.add.info.sourceBibleBookLabel}</span>
                            <input
                              type="text"
                              list="bible-book-options"
                              value={infoForm.sourceBibleBookDisplay}
                              onChange={(event) => {
                                const value = event.target.value;
                                const match = resolveBibleBook(value, language);
                                setInfoForm((prev) => ({
                                  ...prev,
                                  sourceBibleBookDisplay: value,
                                  sourceLocatorValue: match?.la?.abbr ?? prev.sourceLocatorValue
                                }));
                              }}
                              onBlur={(event) => {
                                const value = event.target.value;
                                const match = resolveBibleBook(value, language);
                                if (match) {
                                  setInfoForm((prev) => ({
                                    ...prev,
                                    sourceBibleBookDisplay: `${match.entry.abbr} — ${match.entry.name}`,
                                    sourceLocatorValue: match.la?.abbr ?? prev.sourceLocatorValue
                                  }));
                                } else {
                                  setInfoForm((prev) => ({ ...prev, sourceLocatorValue: value }));
                                }
                              }}
                              placeholder={copy.cogita.library.add.info.sourceBibleBookPlaceholder}
                            />
                          </label>
                          <label className="cogita-field full">
                            <span>{copy.cogita.library.add.info.sourceBibleRestLabel}</span>
                            <input
                              type="text"
                              value={infoForm.sourceLocatorAux}
                              onChange={(event) => setInfoForm((prev) => ({ ...prev, sourceLocatorAux: event.target.value }))}
                              placeholder={copy.cogita.library.add.info.sourceBibleRestPlaceholder}
                            />
                          </label>
                        </>
                      )}
                      {infoForm.sourceKind === 'website' && (
                        <>
                          <label className="cogita-field full">
                            <span>{copy.cogita.library.add.info.sourceUrlLabel}</span>
                            <input
                              type="text"
                              value={infoForm.sourceUrl}
                              onChange={(event) => setInfoForm((prev) => ({ ...prev, sourceUrl: event.target.value }))}
                              placeholder={copy.cogita.library.add.info.sourceUrlPlaceholder}
                            />
                          </label>
                          <label className="cogita-field full">
                            <span>{copy.cogita.library.add.info.sourceAccessedDateLabel}</span>
                            <input
                              type="text"
                              value={infoForm.sourceAccessedDate}
                              onChange={(event) => setInfoForm((prev) => ({ ...prev, sourceAccessedDate: event.target.value }))}
                              placeholder={copy.cogita.library.add.info.sourceAccessedDatePlaceholder}
                            />
                          </label>
                        </>
                      )}
                      {infoForm.sourceKind !== 'website' && infoForm.sourceKind !== 'bible' && (
                        <label className="cogita-field full">
                          <span>{copy.cogita.library.add.group.citationLocatorValueLabel}</span>
                          <input
                            type="text"
                            value={infoForm.sourceLocatorValue}
                            onChange={(event) => setInfoForm((prev) => ({ ...prev, sourceLocatorValue: event.target.value }))}
                            placeholder={copy.cogita.library.add.group.citationLocatorValuePlaceholder}
                          />
                        </label>
                      )}
                      {infoForm.sourceKind !== 'string' && infoForm.sourceKind !== 'website' && infoForm.sourceKind !== 'bible' && (
                        <>
                          <label className="cogita-field full">
                            <span>{copy.cogita.library.add.info.sourceResourceTypeLabel}</span>
                            <select
                              value={infoForm.sourceResourceType}
                              disabled={['book', 'media', 'bible', 'number_document', 'work'].includes(infoForm.sourceKind)}
                              onChange={(event) =>
                                setInfoForm((prev) => ({
                                  ...prev,
                                  sourceResourceType: event.target.value as CogitaInfoType,
                                  sourceResource: null
                                }))
                              }
                            >
                              {sourceResourceTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <InfoSearchSelect
                            libraryId={libraryId}
                            infoType={infoForm.sourceResourceType}
                            label={copy.cogita.library.add.info.sourceResourceLabel}
                            placeholder={copy.cogita.library.add.info.sourceResourcePlaceholder}
                            value={infoForm.sourceResource}
                            onChange={(value) => setInfoForm((prev) => ({ ...prev, sourceResource: value }))}
                            searchFailedText={copy.cogita.library.lookup.searchFailed}
                            createFailedText={copy.cogita.library.lookup.createFailed}
                            createLabel={copy.cogita.library.lookup.createNew.replace(
                              '{type}',
                              getInfoTypeLabel(copy, infoForm.sourceResourceType)
                            )}
                            savingLabel={copy.cogita.library.lookup.saving}
                            loadMoreLabel={copy.cogita.library.lookup.loadMore}
                          />
                        </>
                      )}
                    </>
                  )}
                  <datalist id="bible-book-options">
                    {bibleBookOptions.map((option) => (
                      <option key={option.latin} value={option.label} />
                    ))}
                  </datalist>
                  {infoForm.infoType !== 'computed' ? (
                    <label className="cogita-field full">
                      <span>{copy.cogita.library.add.info.notesLabel}</span>
                      <textarea
                        value={infoForm.notes}
                        onChange={(event) => setInfoForm((prev) => ({ ...prev, notes: event.target.value }))}
                        placeholder={copy.cogita.library.add.info.notesPlaceholder}
                      />
                    </label>
                  ) : null}
                  {infoForm.infoType === 'computed' && (
                    <>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.computedAnswerLabel}</span>
                        <textarea
                          value={computedAnswerTemplate}
                          onChange={(event) => setComputedAnswerTemplate(event.target.value)}
                          placeholder={copy.cogita.library.add.info.computedAnswerPlaceholder}
                        />
                      </label>
                      <div className="cogita-field full">
                        <ComputedGraphEditor
                          copy={copy}
                          value={computedGraph}
                          onChange={(definition) => setComputedGraph(definition)}
                        />
                      </div>
                      <div className="cogita-form-actions full">
                        <button type="button" className="cta ghost" onClick={handleComputedPreview}>
                          {copy.cogita.library.add.info.computedPreview}
                        </button>
                      </div>
                      {computedPreview && computedPreviewStatus === 'ready' ? (
                        <div className="cogita-detail-sample">
                          <p className="cogita-user-kicker">{copy.cogita.library.add.info.computedPreviewTitle}</p>
                          <LatexBlock value={computedPreview.prompt} mode="auto" />
                          <div className="cogita-detail-sample-grid">
                            {Object.entries(computedPreview.answers).map(([key, value]) => (
                              <div key={key} className="cogita-detail-sample-item">
                                <span>{key}</span>
                                <LatexInline value={value} mode="auto" />
                              </div>
                            ))}
                          </div>
                          {computedPreview.answerText ? (
                            <div className="cogita-detail-sample-item">
                              <span>{copy.cogita.library.add.info.computedAnswerLabel}</span>
                              <LatexBlock value={computedPreview.answerText} mode="auto" />
                            </div>
                          ) : null}
                        </div>
                      ) : computedPreviewStatus === 'error' ? (
                        <p className="cogita-help">{copy.cogita.library.add.info.computedPreviewFail}</p>
                      ) : null}
                    </>
                  )}
                <div className="cogita-form-actions full">
                  <button
                    type="button"
                    className="cta"
                    onClick={handleSaveInfo}
                    disabled={editStatus === 'saving' || editStatus === 'loading'}
                  >
                    {isEditMode ? copy.cogita.library.add.info.update : copy.cogita.library.add.info.save}
                  </button>
                </div>
              </div>
              ) : null}

              {activeTab === 'connection' ? (
                <div className="cogita-form-grid">
                  <label className="cogita-field full">
                    <span>{copy.cogita.library.add.connection.typeLabel}</span>
                    <select
                      value={connectionForm.connectionType}
                      onChange={(event) =>
                        setConnectionForm((prev) => ({
                          ...prev,
                          connectionType: event.target.value as CogitaConnectionType
                        }))
                      }
                    >
                      {connectionTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {connectionForm.connectionType === 'word-language' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.add.connection.languageLabel}
                        placeholder={copy.cogita.library.add.connection.languagePlaceholder}
                        value={connectionForm.language}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, language: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="word"
                        label={copy.cogita.library.add.connection.wordLabel}
                        placeholder={copy.cogita.library.add.connection.wordPlaceholder}
                        value={connectionForm.word}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, word: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      {pairStatus && <p className="cogita-help">{pairStatus}</p>}
                    </>
                  )}
                  {connectionForm.connectionType === 'word-topic' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="word"
                        label={copy.cogita.library.add.connection.wordLabel}
                        placeholder={copy.cogita.library.add.connection.wordPlaceholder}
                        value={connectionForm.word}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, word: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="topic"
                        label={copy.cogita.library.add.connection.topicLabel}
                        placeholder={copy.cogita.library.add.connection.topicPlaceholder}
                        value={connectionForm.topic}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, topic: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.topic)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </>
                  )}
                  {connectionForm.connectionType === 'translation' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="word"
                        label={copy.cogita.library.add.connection.wordALabel}
                        placeholder={copy.cogita.library.add.connection.wordAPlaceholder}
                        value={connectionForm.wordA}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, wordA: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="word"
                        label={copy.cogita.library.add.connection.wordBLabel}
                        placeholder={copy.cogita.library.add.connection.wordBPlaceholder}
                        value={connectionForm.wordB}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, wordB: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </>
                  )}
                  {connectionForm.connectionType === 'quote-language' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="quote"
                        label={copy.cogita.library.add.connection.quoteLabel}
                        placeholder={copy.cogita.library.add.connection.quotePlaceholder}
                        value={connectionForm.quote}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, quote: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.quote)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.add.connection.languageLabel}
                        placeholder={copy.cogita.library.add.connection.languagePlaceholder}
                        value={connectionForm.language}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, language: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </>
                  )}
                  {connectionForm.connectionType === 'language-sentence' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.add.connection.languageLabel}
                        placeholder={copy.cogita.library.add.connection.languagePlaceholder}
                        value={connectionForm.language}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, language: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="sentence"
                        label={copy.cogita.library.add.connection.sentenceLabel}
                        placeholder={copy.cogita.library.add.connection.sentencePlaceholder}
                        value={connectionForm.sentence}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, sentence: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.sentence)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </>
                  )}
                  {connectionForm.connectionType === 'reference' && (
                    <>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.connection.referencedInfoTypeLabel}</span>
                        <select
                          value={connectionForm.referencedInfoType}
                          onChange={(event) =>
                            setConnectionForm((prev) => ({
                              ...prev,
                              referencedInfoType: event.target.value as CogitaInfoType,
                              referencedInfo: null
                            }))
                          }
                        >
                          {infoTypeOptions
                            .filter((option) => option.value !== 'any')
                            .map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                        </select>
                      </label>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType={connectionForm.referencedInfoType}
                        label={copy.cogita.library.add.connection.referencedInfoLabel}
                        placeholder={copy.cogita.library.add.connection.referencedInfoPlaceholder}
                        value={connectionForm.referencedInfo}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, referencedInfo: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace(
                          '{type}',
                          getInfoTypeLabel(copy, connectionForm.referencedInfoType)
                        )}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="source"
                        label={copy.cogita.library.add.connection.sourceLabel}
                        placeholder={copy.cogita.library.add.connection.sourcePlaceholder}
                        value={connectionForm.source}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, source: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.source)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </>
                  )}
                  {connectionForm.connectionType === 'source-resource' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="source"
                        label={copy.cogita.library.add.connection.sourceLabel}
                        placeholder={copy.cogita.library.add.connection.sourcePlaceholder}
                        value={connectionForm.source}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, source: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.source)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.connection.sourceResourceTypeLabel}</span>
                        <select
                          value={connectionForm.sourceResourceType}
                          onChange={(event) =>
                            setConnectionForm((prev) => ({
                              ...prev,
                              sourceResourceType: event.target.value as CogitaInfoType,
                              sourceResource: null
                            }))
                          }
                        >
                          {sourceResourceTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType={connectionForm.sourceResourceType}
                        label={copy.cogita.library.add.connection.sourceResourceLabel}
                        placeholder={copy.cogita.library.add.connection.sourceResourcePlaceholder}
                        value={connectionForm.sourceResource}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, sourceResource: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace(
                          '{type}',
                          getInfoTypeLabel(copy, connectionForm.sourceResourceType)
                        )}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </>
                  )}
                  {connectionForm.connectionType === 'work-contributor' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="work"
                        label={copy.cogita.library.add.connection.workLabel}
                        placeholder={copy.cogita.library.add.connection.workPlaceholder}
                        value={connectionForm.work}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, work: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.work)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.connection.contributorTypeLabel}</span>
                        <select
                          value={connectionForm.contributorType}
                          onChange={(event) =>
                            setConnectionForm((prev) => ({
                              ...prev,
                              contributorType: event.target.value as CogitaInfoType,
                              contributor: null
                            }))
                          }
                        >
                          {(['person', 'institution', 'collective'] as const).map((option) => (
                            <option key={option} value={option}>
                              {getInfoTypeLabel(copy, option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType={connectionForm.contributorType}
                        label={copy.cogita.library.add.connection.contributorLabel}
                        placeholder={copy.cogita.library.add.connection.contributorPlaceholder}
                        value={connectionForm.contributor}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, contributor: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace(
                          '{type}',
                          getInfoTypeLabel(copy, connectionForm.contributorType)
                        )}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.connection.contributorRoleLabel}</span>
                        <input
                          type="text"
                          value={connectionForm.contributorRole}
                          onChange={(event) => setConnectionForm((prev) => ({ ...prev, contributorRole: event.target.value }))}
                          placeholder={copy.cogita.library.add.connection.contributorRolePlaceholder}
                        />
                      </label>
                    </>
                  )}
                  {connectionForm.connectionType === 'work-medium' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="work"
                        label={copy.cogita.library.add.connection.workLabel}
                        placeholder={copy.cogita.library.add.connection.workPlaceholder}
                        value={connectionForm.work}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, work: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.work)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="media"
                        label={copy.cogita.library.add.connection.mediumLabel}
                        placeholder={copy.cogita.library.add.connection.mediumPlaceholder}
                        value={connectionForm.medium}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, medium: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.media)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </>
                  )}
                  {connectionForm.connectionType === 'orcid-link' && (
                    <>
                      <div className="cogita-orcid-table">
                        <table>
                          <thead>
                            <tr>
                              <th>{copy.cogita.library.add.connection.orcidEntityHeader}</th>
                              <th>{copy.cogita.library.add.connection.orcidHeader}</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>
                                <label className="cogita-field">
                                  <span>{copy.cogita.library.add.connection.contributorTypeLabel}</span>
                                  <select
                                    value={connectionForm.orcidEntityType}
                                    onChange={(event) =>
                                      setConnectionForm((prev) => ({
                                        ...prev,
                                        orcidEntityType: event.target.value as CogitaInfoType,
                                        orcidEntity: null
                                      }))
                                    }
                                  >
                                    {(['person', 'institution', 'collective'] as const).map((option) => (
                                      <option key={option} value={option}>
                                        {getInfoTypeLabel(copy, option)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <InfoSearchSelect
                                  libraryId={libraryId}
                                  infoType={connectionForm.orcidEntityType}
                                  label={copy.cogita.library.add.connection.contributorLabel}
                                  placeholder={copy.cogita.library.add.connection.contributorPlaceholder}
                                  value={connectionForm.orcidEntity}
                                  onChange={(value) => setConnectionForm((prev) => ({ ...prev, orcidEntity: value }))}
                                  searchFailedText={copy.cogita.library.lookup.searchFailed}
                                  createFailedText={copy.cogita.library.lookup.createFailed}
                                  createLabel={copy.cogita.library.lookup.createNew.replace(
                                    '{type}',
                                    getInfoTypeLabel(copy, connectionForm.orcidEntityType)
                                  )}
                                  savingLabel={copy.cogita.library.lookup.saving}
                                  loadMoreLabel={copy.cogita.library.lookup.loadMore}
                                />
                              </td>
                              <td>
                                <InfoSearchSelect
                                  libraryId={libraryId}
                                  infoType="orcid"
                                  label={copy.cogita.library.infoTypes.orcid}
                                  placeholder={copy.cogita.library.infoTypes.orcid}
                                  value={connectionForm.orcid}
                                  onChange={(value) => setConnectionForm((prev) => ({ ...prev, orcid: value }))}
                                  searchFailedText={copy.cogita.library.lookup.searchFailed}
                                  createFailedText={copy.cogita.library.lookup.createFailed}
                                  createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.orcid)}
                                  savingLabel={copy.cogita.library.lookup.saving}
                                  loadMoreLabel={copy.cogita.library.lookup.loadMore}
                                />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  <label className="cogita-field full">
                    <span>{copy.cogita.library.add.connection.noteLabel}</span>
                    <textarea
                      value={connectionForm.note}
                      onChange={(event) => setConnectionForm((prev) => ({ ...prev, note: event.target.value }))}
                      placeholder={copy.cogita.library.add.connection.notePlaceholder}
                    />
                  </label>
                <div className="cogita-form-actions full">
                  <button type="button" className="cta" onClick={handleCreateConnection}>
                    {copy.cogita.library.add.connection.save}
                  </button>
                </div>
              </div>
              ) : null}

              {activeTab === 'group' ? (
                <div className="cogita-form-grid">
                  <label className="cogita-field full">
                    <span>{copy.cogita.library.add.group.typeLabel}</span>
                    <select
                      value={groupForm.groupType}
                      onChange={(event) =>
                        setGroupForm((prev) => ({ ...prev, groupType: event.target.value as CogitaGroupType }))
                      }
                    >
                      {groupTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {groupForm.groupType === 'citation' ? (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.add.group.citationLanguageLabel}
                        placeholder={copy.cogita.library.add.group.citationLanguagePlaceholder}
                        value={groupForm.citationLanguage}
                        onChange={(value) => setGroupForm((prev) => ({ ...prev, citationLanguage: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.group.citationQuoteTextLabel}</span>
                        <textarea
                          value={groupForm.citationQuoteText}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, citationQuoteText: event.target.value }))}
                          placeholder={copy.cogita.library.add.group.citationQuoteTextPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.group.citationSourceKindLabel}</span>
                        <select
                          value={groupForm.citationSourceKind}
                          onChange={(event) =>
                            setGroupForm((prev) => ({
                              ...prev,
                              citationSourceKind: event.target.value,
                              citationChurchDocument: null,
                              citationBookMedia: null,
                              citationWork: null,
                              citationLocatorValue: '',
                              citationLocatorAux: '',
                              citationBibleBookDisplay: ''
                            }))
                          }
                        >
                          {sourceKindOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {groupForm.citationSourceKind === 'bible' && (
                        <>
                          <label className="cogita-field full">
                            <span>{copy.cogita.library.add.group.citationBibleBookLabel}</span>
                            <input
                              type="text"
                              list="bible-book-options"
                              value={groupForm.citationBibleBookDisplay}
                              onChange={(event) => {
                                const value = event.target.value;
                                const match = resolveBibleBook(value, language);
                                setGroupForm((prev) => ({
                                  ...prev,
                                  citationBibleBookDisplay: value,
                                  citationLocatorValue: match?.la?.abbr ?? prev.citationLocatorValue
                                }));
                              }}
                              onBlur={(event) => {
                                const value = event.target.value;
                                const match = resolveBibleBook(value, language);
                                if (match) {
                                  setGroupForm((prev) => ({
                                    ...prev,
                                    citationBibleBookDisplay: `${match.entry.abbr} — ${match.entry.name}`,
                                    citationLocatorValue: match.la?.abbr ?? prev.citationLocatorValue
                                  }));
                                } else {
                                  setGroupForm((prev) => ({ ...prev, citationLocatorValue: value }));
                                }
                              }}
                              placeholder={copy.cogita.library.add.group.citationBibleBookPlaceholder}
                            />
                          </label>
                          <label className="cogita-field full">
                            <span>{copy.cogita.library.add.group.citationBibleRestLabel}</span>
                            <input
                              type="text"
                              value={groupForm.citationLocatorAux}
                              onChange={(event) => setGroupForm((prev) => ({ ...prev, citationLocatorAux: event.target.value }))}
                              placeholder={copy.cogita.library.add.group.citationBibleRestPlaceholder}
                            />
                          </label>
                        </>
                      )}
                      {groupForm.citationSourceKind === 'website' && (
                        <>
                          <label className="cogita-field full">
                            <span>{copy.cogita.library.add.info.sourceUrlLabel}</span>
                            <input
                              type="text"
                              value={groupForm.citationSourceUrl}
                              onChange={(event) => setGroupForm((prev) => ({ ...prev, citationSourceUrl: event.target.value }))}
                              placeholder={copy.cogita.library.add.info.sourceUrlPlaceholder}
                            />
                          </label>
                          <label className="cogita-field full">
                            <span>{copy.cogita.library.add.info.sourceAccessedDateLabel}</span>
                            <input
                              type="text"
                              value={groupForm.citationSourceAccessedDate}
                              onChange={(event) => setGroupForm((prev) => ({ ...prev, citationSourceAccessedDate: event.target.value }))}
                              placeholder={copy.cogita.library.add.info.sourceAccessedDatePlaceholder}
                            />
                          </label>
                        </>
                      )}
                      {groupForm.citationSourceKind === 'number_document' && (
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="work"
                          label={copy.cogita.library.add.group.citationChurchDocumentLabel}
                          placeholder={copy.cogita.library.add.group.citationChurchDocumentPlaceholder}
                          value={groupForm.citationChurchDocument}
                          onChange={(value) => setGroupForm((prev) => ({ ...prev, citationChurchDocument: value }))}
                          searchFailedText={copy.cogita.library.lookup.searchFailed}
                          createFailedText={copy.cogita.library.lookup.createFailed}
                          createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.work)}
                          savingLabel={copy.cogita.library.lookup.saving}
                          loadMoreLabel={copy.cogita.library.lookup.loadMore}
                        />
                      )}
                      {groupForm.citationSourceKind === 'work' && (
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="work"
                          label={copy.cogita.library.add.group.citationWorkLabel}
                          placeholder={copy.cogita.library.add.group.citationWorkPlaceholder}
                          value={groupForm.citationWork}
                          onChange={(value) => setGroupForm((prev) => ({ ...prev, citationWork: value }))}
                          searchFailedText={copy.cogita.library.lookup.searchFailed}
                          createFailedText={copy.cogita.library.lookup.createFailed}
                          createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.work)}
                          savingLabel={copy.cogita.library.lookup.saving}
                          loadMoreLabel={copy.cogita.library.lookup.loadMore}
                        />
                      )}
                      {groupForm.citationSourceKind === 'book' && (
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="media"
                          label={copy.cogita.library.add.group.citationBookLabel}
                          placeholder={copy.cogita.library.add.group.citationBookPlaceholder}
                          value={groupForm.citationBookMedia}
                          onChange={(value) => setGroupForm((prev) => ({ ...prev, citationBookMedia: value }))}
                          searchFailedText={copy.cogita.library.lookup.searchFailed}
                          createFailedText={copy.cogita.library.lookup.createFailed}
                          createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.media)}
                          savingLabel={copy.cogita.library.lookup.saving}
                          loadMoreLabel={copy.cogita.library.lookup.loadMore}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.add.group.languageALabel}
                        placeholder={copy.cogita.library.add.group.languageAPlaceholder}
                        value={groupForm.languageA}
                        onChange={(value) => setGroupForm((prev) => ({ ...prev, languageA: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.add.group.languageBLabel}
                        placeholder={copy.cogita.library.add.group.languageBPlaceholder}
                        value={groupForm.languageB}
                        onChange={(value) => setGroupForm((prev) => ({ ...prev, languageB: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="word"
                        label={copy.cogita.library.add.group.wordALabel}
                        placeholder={copy.cogita.library.add.group.wordAPlaceholder}
                        value={groupForm.wordA}
                        onChange={(value) => setGroupForm((prev) => ({ ...prev, wordA: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                        inputRef={wordARef}
                        autoAdvance
                        onCommit={() => wordBRef.current?.focus()}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="word"
                        label={copy.cogita.library.add.group.wordBLabel}
                        placeholder={copy.cogita.library.add.group.wordBPlaceholder}
                        value={groupForm.wordB}
                        onChange={(value) => setGroupForm((prev) => ({ ...prev, wordB: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                        inputRef={wordBRef}
                        autoAdvance
                        onCommit={() => groupConfirmRef.current?.focus()}
                      />
                      <div className="cogita-lookup full">
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="topic"
                          label={copy.cogita.library.add.group.translationTagsLabel}
                          placeholder={copy.cogita.library.add.group.translationTagsPlaceholder}
                          multiple
                          values={groupForm.translationTags}
                          onChangeMultiple={(values) => setGroupForm((prev) => ({ ...prev, translationTags: values }))}
                          searchFailedText={copy.cogita.library.lookup.searchFailed}
                          createFailedText={copy.cogita.library.lookup.createFailed}
                          createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.topic)}
                          savingLabel={copy.cogita.library.lookup.saving}
                          loadMoreLabel={copy.cogita.library.lookup.loadMore}
                        />
                      </div>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="topic"
                        label={copy.cogita.library.add.group.wordATagsLabel}
                        placeholder={copy.cogita.library.add.group.wordATagsPlaceholder}
                        multiple
                        values={groupForm.wordATags}
                        onChangeMultiple={(values) => setGroupForm((prev) => ({ ...prev, wordATags: values }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.topic)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="topic"
                        label={copy.cogita.library.add.group.wordBTagsLabel}
                        placeholder={copy.cogita.library.add.group.wordBTagsPlaceholder}
                        multiple
                        values={groupForm.wordBTags}
                        onChangeMultiple={(values) => setGroupForm((prev) => ({ ...prev, wordBTags: values }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.topic)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </>
                  )}
                  {groupForm.groupType === 'vocab' && groupPairStatusA && <p className="cogita-help">{groupPairStatusA}</p>}
                  {groupForm.groupType === 'vocab' && groupPairStatusB && <p className="cogita-help">{groupPairStatusB}</p>}
                <div className="cogita-form-actions full">
                  <button type="button" className="cta" onClick={handleCreateGroup} ref={groupConfirmRef}>
                    {copy.cogita.library.add.group.save}
                  </button>
                </div>
              </div>
              ) : null}

                  {formStatus ? <p className="cogita-form-error">{formStatus}</p> : null}
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
