import { useEffect, useMemo, useRef, useState } from 'react';
import { checkCogitaWordLanguage, createCogitaConnection, createCogitaInfo, getCogitaInfoDetail, updateCogitaInfo } from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaConnectionType, CogitaGroupType, CogitaInfoOption, CogitaInfoType } from './types';
import { InfoSearchSelect } from './components/InfoSearchSelect';
import { ReferencePanel, type ReferenceSourceForm } from './components/ReferencePanel';
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
    sourceAccessedDate: '',
    referenceEnabled: false,
    referenceSourceKind: 'string' as string,
    referenceLocatorValue: '',
    referenceLocatorAux: '',
    referenceBibleBookDisplay: '',
    referenceSourceUrl: '',
    referenceSourceAccessedDate: '',
    referenceChurchDocument: null as CogitaInfoOption | null,
    referenceBookMedia: null as CogitaInfoOption | null,
    referenceWork: null as CogitaInfoOption | null
  });
  const [computedAnswerTemplate, setComputedAnswerTemplate] = useState('');
  const [computedGraph, setComputedGraph] = useState<ComputedGraphDefinition | null>(null);
  const [computedPreview, setComputedPreview] = useState<{
    prompt: string;
    answers: Record<string, string>;
    answerText?: string;
  } | null>(null);
  const [computedPreviewStatus, setComputedPreviewStatus] = useState<'idle' | 'ready' | 'error'>('idle');
  const [bibleBookFocus, setBibleBookFocus] = useState<'source' | null>(null);
  const [bibleBookIndex, setBibleBookIndex] = useState(-1);
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
    citationTitle: '',
    citationQuoteText: '',
    citationLanguage: null as CogitaInfoOption | null,
    citationReferenceEnabled: false,
    citationSourceKind: 'string' as string,
    citationLocatorValue: '',
    citationLocatorAux: '',
    citationBibleBookDisplay: '',
    citationSourceUrl: '',
    citationSourceAccessedDate: '',
    citationChurchDocument: null as CogitaInfoOption | null,
    citationBookMedia: null as CogitaInfoOption | null,
    citationWork: null as CogitaInfoOption | null,
    bookTitle: '',
    bookPublisher: '',
    bookPublicationPlace: '',
    bookPublicationYear: '',
    bookPages: '',
    bookIsbn: '',
    bookCover: '',
    bookHeight: '',
    bookLength: '',
    bookWidth: '',
    bookWeight: '',
    bookCollection: '',
    bookLocation: '',
    bookWorkTitle: '',
    bookWorkLanguage: null as CogitaInfoOption | null,
    bookWorkOriginalLanguage: null as CogitaInfoOption | null,
    bookWorkDoi: '',
    bookContributors: [
      {
        contributorType: 'person' as CogitaInfoType,
        contributor: null as CogitaInfoOption | null,
        role: ''
      }
    ]
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
  const referenceLabels = useMemo(
    () => ({
      sourceKindLabel: copy.cogita.library.add.group.citationSourceKindLabel,
      bibleBookLabel: copy.cogita.library.add.group.citationBibleBookLabel,
      bibleBookPlaceholder: copy.cogita.library.add.group.citationBibleBookPlaceholder,
      bibleRestLabel: copy.cogita.library.add.group.citationBibleRestLabel,
      bibleRestPlaceholder: copy.cogita.library.add.group.citationBibleRestPlaceholder,
      churchDocumentLabel: copy.cogita.library.add.group.citationChurchDocumentLabel,
      churchDocumentPlaceholder: copy.cogita.library.add.group.citationChurchDocumentPlaceholder,
      workLabel: copy.cogita.library.add.group.citationWorkLabel,
      workPlaceholder: copy.cogita.library.add.group.citationWorkPlaceholder,
      bookLabel: copy.cogita.library.add.group.citationBookLabel,
      bookPlaceholder: copy.cogita.library.add.group.citationBookPlaceholder,
      locatorLabel: copy.cogita.library.add.group.citationLocatorValueLabel,
      locatorPlaceholder: copy.cogita.library.add.group.citationLocatorValuePlaceholder
    }),
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
  const filterBibleBooks = (query: string, includeAllIfEmpty = false) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return includeAllIfEmpty ? bibleBookOptions.slice(0, 8) : [];
    }
    return bibleBookOptions.filter((option) => option.label.toLowerCase().includes(trimmed)).slice(0, 8);
  };
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
    if (infoForm.sourceKind === 'bible' && infoForm.sourceLocatorValue && bibleBookFocus !== 'source') {
      const match = resolveBibleBook(infoForm.sourceLocatorValue, language);
      if (match) {
        const display = `${match.entry.abbr} — ${match.entry.name}`;
        if (display !== infoForm.sourceBibleBookDisplay) {
          setInfoForm((prev) => ({ ...prev, sourceBibleBookDisplay: display }));
        }
      }
    }
  }, [
    language,
    infoForm.sourceKind,
    infoForm.sourceLocatorValue,
    infoForm.sourceBibleBookDisplay
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
        let pendingReference: { payload: Record<string, unknown>; resourceInfoId: string | null } | null = null;
        if (infoForm.referenceEnabled) {
          const referenceForm: ReferenceSourceForm = {
            sourceKind: infoForm.referenceSourceKind,
            locatorValue: infoForm.referenceLocatorValue,
            locatorAux: infoForm.referenceLocatorAux,
            bibleBookDisplay: infoForm.referenceBibleBookDisplay,
            sourceUrl: infoForm.referenceSourceUrl,
            sourceAccessedDate: infoForm.referenceSourceAccessedDate,
            churchDocument: infoForm.referenceChurchDocument,
            bookMedia: infoForm.referenceBookMedia,
            work: infoForm.referenceWork
          };
          const { payload: sourcePayload, resourceInfoId, error } = buildSourcePayload(referenceForm);
          if (error) {
            setFormStatus(copy.cogita.library.add.info.referenceMissingSource);
            return;
          }
          pendingReference = { payload: sourcePayload, resourceInfoId };
        }
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
        if (pendingReference) {
          const createdSource = await createCogitaInfo({
            libraryId,
            infoType: 'source',
            payload: pendingReference.payload
          });
          if (pendingReference.resourceInfoId) {
            await createCogitaConnection({
              libraryId,
              connectionType: 'source-resource',
              infoIds: [createdSource.infoId, pendingReference.resourceInfoId]
            });
          }
          await createCogitaConnection({
            libraryId,
            connectionType: 'reference',
            infoIds: [created.infoId, createdSource.infoId]
          });
        }
        setFormStatus(copy.cogita.library.add.info.saved);
        const keepLanguage = infoForm.infoType === 'word' || infoForm.infoType === 'sentence';
        const keepReference = infoForm.referenceEnabled;
        const keepReferenceKind = infoForm.referenceSourceKind;
        const keepReferenceCommon = {
          referenceEnabled: keepReference,
          referenceSourceKind: keepReference ? keepReferenceKind : 'string',
          referenceSourceUrl: keepReference && keepReferenceKind === 'website' ? infoForm.referenceSourceUrl : '',
          referenceSourceAccessedDate:
            keepReference && keepReferenceKind === 'website' ? infoForm.referenceSourceAccessedDate : '',
          referenceChurchDocument:
            keepReference && keepReferenceKind === 'number_document' ? infoForm.referenceChurchDocument : null,
          referenceBookMedia: keepReference && keepReferenceKind === 'book' ? infoForm.referenceBookMedia : null,
          referenceWork: keepReference && keepReferenceKind === 'work' ? infoForm.referenceWork : null,
          referenceLocatorValue:
            keepReference && keepReferenceKind === 'bible' ? infoForm.referenceLocatorValue : '',
          referenceLocatorAux: '',
          referenceBibleBookDisplay:
            keepReference && keepReferenceKind === 'bible' ? infoForm.referenceBibleBookDisplay : ''
        };
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
          sourceAccessedDate: '',
          ...keepReferenceCommon
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

  const buildSourcePayload = (form: ReferenceSourceForm) => {
    let resourceInfoId: string | null = null;
    if (form.sourceKind === 'number_document') {
      if (!form.churchDocument) {
        return { payload: {}, resourceInfoId, error: true };
      }
      resourceInfoId = form.churchDocument.id;
    }
    if (form.sourceKind === 'book') {
      if (!form.bookMedia) {
        return { payload: {}, resourceInfoId, error: true };
      }
      resourceInfoId = form.bookMedia.id;
    }
    if (form.sourceKind === 'work') {
      if (!form.work) {
        return { payload: {}, resourceInfoId, error: true };
      }
      resourceInfoId = form.work.id;
    }

    const sourcePayload: Record<string, unknown> = {
      sourceKind: form.sourceKind
    };
    if (form.sourceKind === 'website') {
      const url = form.sourceUrl.trim();
      if (!url) {
        return { payload: {}, resourceInfoId, error: true };
      }
      sourcePayload.locator = {
        url,
        date: form.sourceAccessedDate.trim()
      };
      return { payload: sourcePayload, resourceInfoId };
    }
    if (form.sourceKind === 'bible') {
      if (!form.locatorValue.trim() || !form.locatorAux.trim()) {
        return { payload: {}, resourceInfoId, error: true };
      }
      sourcePayload.locator = {
        book: form.locatorValue.trim(),
        rest: form.locatorAux.trim()
      };
      return { payload: sourcePayload, resourceInfoId };
    }
    if (form.sourceKind === 'book') {
      sourcePayload.locator = { page: form.locatorValue.trim() };
    } else if (form.sourceKind === 'number_document') {
      sourcePayload.locator = { number: form.locatorValue.trim() };
    } else if (form.sourceKind !== 'website') {
      sourcePayload.locator = { text: form.locatorValue.trim() };
    }
    if (form.sourceKind !== 'website' && form.sourceKind !== 'bible' && !form.locatorValue.trim()) {
      return { payload: {}, resourceInfoId, error: true };
    }
    return { payload: sourcePayload, resourceInfoId };
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
        const citationTitle = groupForm.citationTitle.trim();
        const quoteText = groupForm.citationQuoteText.trim();
        if (!quoteText) {
          setFormStatus(copy.cogita.library.add.group.citationMissingQuote);
          return;
        }

        let pendingReference: { payload: Record<string, unknown>; resourceInfoId: string | null } | null = null;
        if (groupForm.citationReferenceEnabled) {
          const citationForm: ReferenceSourceForm = {
            sourceKind: groupForm.citationSourceKind,
            locatorValue: groupForm.citationLocatorValue,
            locatorAux: groupForm.citationLocatorAux,
            bibleBookDisplay: groupForm.citationBibleBookDisplay,
            sourceUrl: groupForm.citationSourceUrl,
            sourceAccessedDate: groupForm.citationSourceAccessedDate,
            churchDocument: groupForm.citationChurchDocument,
            bookMedia: groupForm.citationBookMedia,
            work: groupForm.citationWork
          };
          const { payload: sourcePayload, resourceInfoId, error } = buildSourcePayload(citationForm);
          if (error) {
            setFormStatus(copy.cogita.library.add.info.referenceMissingSource);
            return;
          }
          pendingReference = { payload: sourcePayload, resourceInfoId };
        }

        const quotePayload: Record<string, unknown> = {
          text: quoteText
        };
        if (citationTitle) {
          quotePayload.title = citationTitle;
        }
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

        if (pendingReference) {
          const createdSource = await createCogitaInfo({
            libraryId,
            infoType: 'source',
            payload: pendingReference.payload
          });
          if (pendingReference.resourceInfoId) {
            await createCogitaConnection({
              libraryId,
              connectionType: 'source-resource',
              infoIds: [createdSource.infoId, pendingReference.resourceInfoId]
            });
          }
          await createCogitaConnection({
            libraryId,
            connectionType: 'reference',
            infoIds: [createdQuote.infoId, createdSource.infoId]
          });
        }

        setFormStatus(copy.cogita.library.add.group.savedCitation);
        setGroupForm((prev) => ({
          ...prev,
          citationTitle: '',
          citationQuoteText: '',
          citationLanguage: null,
          citationReferenceEnabled: prev.citationReferenceEnabled,
          citationSourceKind: prev.citationReferenceEnabled ? prev.citationSourceKind : 'string',
          citationLocatorValue: '',
          citationLocatorAux: '',
          citationBibleBookDisplay: '',
          citationSourceUrl: '',
          citationSourceAccessedDate: '',
          citationChurchDocument: prev.citationReferenceEnabled ? prev.citationChurchDocument : null,
          citationBookMedia: prev.citationReferenceEnabled ? prev.citationBookMedia : null,
          citationWork: prev.citationReferenceEnabled ? prev.citationWork : null
        }));
        return;
      }

      if (groupForm.groupType === 'book') {
        const bookTitle = groupForm.bookTitle.trim();
        if (!bookTitle) {
          setFormStatus(copy.cogita.library.add.group.bookMissingTitle);
          return;
        }
        const workTitle = groupForm.bookWorkTitle.trim();
        if (!workTitle) {
          setFormStatus(copy.cogita.library.add.group.bookMissingWork);
          return;
        }

        const invalidContributor = groupForm.bookContributors.find(
          (row) => (row.contributor && !row.role.trim()) || (!row.contributor && row.role.trim())
        );
        if (invalidContributor) {
          setFormStatus(copy.cogita.library.add.group.bookMissingContributor);
          return;
        }

        const createdBook = await createCogitaInfo({
          libraryId,
          infoType: 'media',
          payload: {
            label: bookTitle,
            mediaType: 'book',
            publisher: groupForm.bookPublisher.trim(),
            publicationPlace: groupForm.bookPublicationPlace.trim(),
            publicationYear: groupForm.bookPublicationYear.trim(),
            pages: groupForm.bookPages.trim(),
            isbn: groupForm.bookIsbn.trim(),
            cover: groupForm.bookCover.trim(),
            height: groupForm.bookHeight.trim(),
            length: groupForm.bookLength.trim(),
            width: groupForm.bookWidth.trim(),
            weight: groupForm.bookWeight.trim(),
            collection: groupForm.bookCollection.trim(),
            location: groupForm.bookLocation.trim()
          }
        });

        const createdWork = await createCogitaInfo({
          libraryId,
          infoType: 'work',
          payload: {
            label: workTitle,
            languageId: groupForm.bookWorkLanguage?.id ?? null,
            originalLanguageId: groupForm.bookWorkOriginalLanguage?.id ?? null,
            doi: groupForm.bookWorkDoi.trim()
          }
        });

        await createCogitaConnection({
          libraryId,
          connectionType: 'work-medium',
          infoIds: [createdWork.infoId, createdBook.infoId]
        });

        const contributorRows = groupForm.bookContributors.filter((row) => row.contributor && row.role.trim());
        for (const row of contributorRows) {
          await createCogitaConnection({
            libraryId,
            connectionType: 'work-contributor',
            infoIds: [createdWork.infoId, row.contributor!.id],
            payload: { role: row.role.trim() }
          });
        }

        setFormStatus(copy.cogita.library.add.group.savedBook);
        setGroupForm((prev) => ({
          ...prev,
          bookTitle: '',
          bookPublisher: '',
          bookPublicationPlace: '',
          bookPublicationYear: '',
          bookPages: '',
          bookIsbn: '',
          bookCover: '',
          bookHeight: '',
          bookLength: '',
          bookWidth: '',
          bookWeight: '',
          bookCollection: '',
          bookLocation: '',
          bookWorkTitle: '',
          bookWorkLanguage: null,
          bookWorkOriginalLanguage: null,
          bookWorkDoi: '',
          bookContributors: [
            {
              contributorType: 'person' as CogitaInfoType,
              contributor: null as CogitaInfoOption | null,
              role: ''
            }
          ]
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

      setFormStatus(copy.cogita.library.add.group.savedVocab);
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

  const groupSaveLabel =
    groupForm.groupType === 'citation'
      ? copy.cogita.library.add.group.saveCitation
      : groupForm.groupType === 'book'
        ? copy.cogita.library.add.group.saveBook
        : copy.cogita.library.add.group.saveVocab;

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
                          <div className="cogita-lookup full">
                            <label className="cogita-field full">
                              <span>{copy.cogita.library.add.info.sourceBibleBookLabel}</span>
                              <input
                                type="text"
                                value={infoForm.sourceBibleBookDisplay}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setInfoForm((prev) => ({
                                    ...prev,
                                    sourceBibleBookDisplay: value,
                                    sourceLocatorValue: ''
                                  }));
                                  setBibleBookFocus('source');
                                  setBibleBookIndex(-1);
                                }}
                                onKeyDown={(event) => {
                                  const options = filterBibleBooks(infoForm.sourceBibleBookDisplay);
                                  if (!options.length) return;
                                  if (event.key === 'ArrowDown') {
                                    event.preventDefault();
                                    setBibleBookIndex((prev) => Math.min(prev + 1, options.length - 1));
                                  } else if (event.key === 'ArrowUp') {
                                    event.preventDefault();
                                    setBibleBookIndex((prev) => Math.max(prev - 1, 0));
                                  } else if (event.key === 'Enter' || event.key === 'Tab') {
                                    if (bibleBookIndex >= 0 && options[bibleBookIndex]) {
                                      const option = options[bibleBookIndex];
                                      const match = resolveBibleBook(option.label, language);
                                      if (!match) return;
                                      setInfoForm((prev) => ({
                                        ...prev,
                                        sourceBibleBookDisplay: option.label,
                                        sourceLocatorValue: match.la?.abbr ?? prev.sourceLocatorValue
                                      }));
                                      setBibleBookFocus(null);
                                    }
                                  }
                                }}
                                onFocus={() => setBibleBookFocus('source')}
                                onBlur={() => window.setTimeout(() => setBibleBookFocus((prev) => (prev === 'source' ? null : prev)), 100)}
                                placeholder={copy.cogita.library.add.info.sourceBibleBookPlaceholder}
                              />
                            </label>
                            {bibleBookFocus === 'source' &&
                              filterBibleBooks(infoForm.sourceBibleBookDisplay, true).length > 0 && (
                                <div className="cogita-lookup-results">
                                  {filterBibleBooks(infoForm.sourceBibleBookDisplay, true).map((option, index) => (
                                    <button
                                      key={option.latin}
                                      type="button"
                                      className="cogita-lookup-option"
                                    data-active={index === bibleBookIndex}
                                      tabIndex={-1}
                                      onMouseDown={() => {
                                        const match = resolveBibleBook(option.label, language);
                                        if (!match) return;
                                        setInfoForm((prev) => ({
                                          ...prev,
                                          sourceBibleBookDisplay: option.label,
                                          sourceLocatorValue: match.la?.abbr ?? prev.sourceLocatorValue
                                        }));
                                      }}
                                    >
                                      <strong>{option.label}</strong>
                                    </button>
                                  ))}
                                </div>
                              )}
                          </div>
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
                  <label className="cogita-field full">
                    <span>{copy.cogita.library.add.info.referenceTitle}</span>
                    <div className="cogita-checkbox">
                      <input
                        type="checkbox"
                        checked={infoForm.referenceEnabled}
                        onChange={(event) =>
                          setInfoForm((prev) => ({
                            ...prev,
                            referenceEnabled: event.target.checked
                          }))
                        }
                      />
                      <span>{copy.cogita.library.add.info.referenceToggle}</span>
                    </div>
                  </label>
                  {infoForm.referenceEnabled && (
                    <ReferencePanel
                      libraryId={libraryId}
                      copy={copy}
                      language={language}
                      sourceKindOptions={sourceKindOptions}
                      labels={referenceLabels}
                      value={{
                        sourceKind: infoForm.referenceSourceKind,
                        locatorValue: infoForm.referenceLocatorValue,
                        locatorAux: infoForm.referenceLocatorAux,
                        bibleBookDisplay: infoForm.referenceBibleBookDisplay,
                        sourceUrl: infoForm.referenceSourceUrl,
                        sourceAccessedDate: infoForm.referenceSourceAccessedDate,
                        churchDocument: infoForm.referenceChurchDocument,
                        bookMedia: infoForm.referenceBookMedia,
                        work: infoForm.referenceWork
                      }}
                      onChange={(next) =>
                        setInfoForm((prev) => ({
                          ...prev,
                          referenceSourceKind: next.sourceKind,
                          referenceLocatorValue: next.locatorValue,
                          referenceLocatorAux: next.locatorAux,
                          referenceBibleBookDisplay: next.bibleBookDisplay,
                          referenceSourceUrl: next.sourceUrl,
                          referenceSourceAccessedDate: next.sourceAccessedDate,
                          referenceChurchDocument: next.churchDocument,
                          referenceBookMedia: next.bookMedia,
                          referenceWork: next.work
                        }))
                      }
                    />
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
                  {groupForm.groupType === 'citation' && (
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
                        <span>{copy.cogita.library.add.group.citationTitleLabel}</span>
                        <input
                          type="text"
                          value={groupForm.citationTitle}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, citationTitle: event.target.value }))}
                          placeholder={copy.cogita.library.add.group.citationTitlePlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.group.citationQuoteTextLabel}</span>
                        <textarea
                          value={groupForm.citationQuoteText}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, citationQuoteText: event.target.value }))}
                          placeholder={copy.cogita.library.add.group.citationQuoteTextPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.referenceTitle}</span>
                        <div className="cogita-checkbox">
                          <input
                            type="checkbox"
                            checked={groupForm.citationReferenceEnabled}
                            onChange={(event) =>
                              setGroupForm((prev) => ({
                                ...prev,
                                citationReferenceEnabled: event.target.checked
                              }))
                            }
                          />
                          <span>{copy.cogita.library.add.info.referenceToggle}</span>
                        </div>
                      </label>
                      {groupForm.citationReferenceEnabled && (
                        <ReferencePanel
                          libraryId={libraryId}
                          copy={copy}
                          language={language}
                          sourceKindOptions={sourceKindOptions}
                          labels={referenceLabels}
                          value={{
                            sourceKind: groupForm.citationSourceKind,
                            locatorValue: groupForm.citationLocatorValue,
                            locatorAux: groupForm.citationLocatorAux,
                            bibleBookDisplay: groupForm.citationBibleBookDisplay,
                            sourceUrl: groupForm.citationSourceUrl,
                            sourceAccessedDate: groupForm.citationSourceAccessedDate,
                            churchDocument: groupForm.citationChurchDocument,
                            bookMedia: groupForm.citationBookMedia,
                            work: groupForm.citationWork
                          }}
                          onChange={(next) =>
                            setGroupForm((prev) => ({
                              ...prev,
                              citationSourceKind: next.sourceKind,
                              citationLocatorValue: next.locatorValue,
                              citationLocatorAux: next.locatorAux,
                              citationBibleBookDisplay: next.bibleBookDisplay,
                              citationSourceUrl: next.sourceUrl,
                              citationSourceAccessedDate: next.sourceAccessedDate,
                              citationChurchDocument: next.churchDocument,
                              citationBookMedia: next.bookMedia,
                              citationWork: next.work
                            }))
                          }
                        />
                      )}
                    </>
                  )}
                  {groupForm.groupType === 'book' && (
                    <>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.group.bookTitleLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookTitle}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookTitle: event.target.value }))}
                          placeholder={copy.cogita.library.add.group.bookTitlePlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaPublisherLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookPublisher}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookPublisher: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaPublisherPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaPublicationPlaceLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookPublicationPlace}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookPublicationPlace: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaPublicationPlacePlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaPublicationYearLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookPublicationYear}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookPublicationYear: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaPublicationYearPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaPagesLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookPages}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookPages: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaPagesPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaIsbnLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookIsbn}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookIsbn: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaIsbnPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaCoverLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookCover}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookCover: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaCoverPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaHeightLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookHeight}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookHeight: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaHeightPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaLengthLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookLength}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookLength: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaLengthPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaWidthLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookWidth}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookWidth: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaWidthPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaWeightLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookWeight}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookWeight: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaWeightPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaCollectionLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookCollection}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookCollection: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaCollectionPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.mediaLocationLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookLocation}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookLocation: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.mediaLocationPlaceholder}
                        />
                      </label>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.group.workTitleLabel}</span>
                        <input
                          type="text"
                          value={groupForm.bookWorkTitle}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookWorkTitle: event.target.value }))}
                          placeholder={copy.cogita.library.add.group.workTitlePlaceholder}
                        />
                      </label>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.add.info.workLanguageLabel}
                        placeholder={copy.cogita.library.add.info.workLanguagePlaceholder}
                        value={groupForm.bookWorkLanguage}
                        onChange={(value) => setGroupForm((prev) => ({ ...prev, bookWorkLanguage: value }))}
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
                        value={groupForm.bookWorkOriginalLanguage}
                        onChange={(value) => setGroupForm((prev) => ({ ...prev, bookWorkOriginalLanguage: value }))}
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
                          value={groupForm.bookWorkDoi}
                          onChange={(event) => setGroupForm((prev) => ({ ...prev, bookWorkDoi: event.target.value }))}
                          placeholder={copy.cogita.library.add.info.workDoiPlaceholder}
                        />
                      </label>
                      <div className="cogita-contributor-header">
                        <span>{copy.cogita.library.add.group.contributorsLabel}</span>
                        <button
                          type="button"
                          className="cogita-contributor-add"
                          onClick={() =>
                            setGroupForm((prev) => ({
                              ...prev,
                              bookContributors: [
                                ...prev.bookContributors,
                                { contributorType: 'person' as CogitaInfoType, contributor: null, role: '' }
                              ]
                            }))
                          }
                        >
                          {copy.cogita.library.add.group.addContributor}
                        </button>
                      </div>
                      {groupForm.bookContributors.map((row, index) => (
                        <div key={`book-contributor-${index}`} className="cogita-contributor-row">
                          <label className="cogita-field">
                            <span>{copy.cogita.library.add.connection.contributorTypeLabel}</span>
                            <select
                              value={row.contributorType}
                              onChange={(event) =>
                                setGroupForm((prev) => ({
                                  ...prev,
                                  bookContributors: prev.bookContributors.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, contributorType: event.target.value as CogitaInfoType, contributor: null }
                                      : item
                                  )
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
                            infoType={row.contributorType}
                            label={copy.cogita.library.add.connection.contributorLabel}
                            placeholder={copy.cogita.library.add.connection.contributorPlaceholder}
                            value={row.contributor}
                            onChange={(value) =>
                              setGroupForm((prev) => ({
                                ...prev,
                                bookContributors: prev.bookContributors.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, contributor: value } : item
                                )
                              }))
                            }
                            searchFailedText={copy.cogita.library.lookup.searchFailed}
                            createFailedText={copy.cogita.library.lookup.createFailed}
                            createLabel={copy.cogita.library.lookup.createNew.replace(
                              '{type}',
                              getInfoTypeLabel(copy, row.contributorType)
                            )}
                            savingLabel={copy.cogita.library.lookup.saving}
                            loadMoreLabel={copy.cogita.library.lookup.loadMore}
                          />
                          <label className="cogita-field">
                            <span>{copy.cogita.library.add.connection.contributorRoleLabel}</span>
                            <input
                              type="text"
                              value={row.role}
                              onChange={(event) =>
                                setGroupForm((prev) => ({
                                  ...prev,
                                  bookContributors: prev.bookContributors.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, role: event.target.value } : item
                                  )
                                }))
                              }
                              placeholder={copy.cogita.library.add.connection.contributorRolePlaceholder}
                            />
                          </label>
                          <button
                            type="button"
                            className="cogita-contributor-remove"
                            onClick={() =>
                              setGroupForm((prev) => {
                                const next = prev.bookContributors.filter((_, itemIndex) => itemIndex !== index);
                                if (next.length === 0) {
                                  return {
                                    ...prev,
                                    bookContributors: [
                                      { contributorType: 'person' as CogitaInfoType, contributor: null, role: '' }
                                    ]
                                  };
                                }
                                return { ...prev, bookContributors: next };
                              })
                            }
                          >
                            {copy.cogita.library.add.group.removeContributor}
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                  {groupForm.groupType === 'vocab' && (
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
                    {groupSaveLabel}
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
