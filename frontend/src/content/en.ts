import type { Copy } from './types';

export const en: Copy = {
  nav: {
    home: 'Home ',
    parish: 'Parish',
    cogita: 'Cogita',
    faq: 'FAQ',
    legal: 'Privacy & Terms',
    login: 'Sign in',
    account: 'Profile'
  },
  accountMenu: {
    profile: 'User settings',
    secureModeOn: 'Enable secure mode',
    secureModeOff: 'Disable secure mode',
    logout: 'Sign out'
  },
  hero: {
    headline: 'REcreatio — trust and knowledge infrastructure for communities.',
    subtitle:
      'We connect education, parishes, and communities in one ecosystem where access is enforced cryptographically, not just by passwords.',
    ctaPrimary: 'Access the system',
    ctaSecondary: 'Explore portals'
  },
  modules: {
    title: 'Public portals and upcoming modules',
    items: [
      {
        title: 'Parish',
        desc: 'Intentions, announcements, calendar, and offerings — public and secure.',
        tag: 'public',
        route: 'parish'
      },
      {
        title: 'Cogita',
        desc: 'Knowledge space for quizzes and co-created learning content.',
        tag: 'public',
        route: 'cogita'
      },
      {
        title: 'User area',
        desc: 'Profile settings, roles, access keys, and activity history.',
        tag: 'soon',
        route: 'account'
      }
    ]
  },
  access: {
    title: 'Access REcreatio',
    subtitle: 'Login unlocks management features. Public portals remain available without an account.',
    login: 'Sign in',
    register: 'Register',
    loginId: 'Login ID (username or email)',
    password: 'Password',
    confirm: 'Confirm password',
    displayName: 'Public nickname (optional)',
    secureMode: 'Secure mode (no key cache)',
    create: 'Create account',
    signIn: 'Sign in',
    statusTitle: 'Status',
    statusReady: 'Ready.',
    loginRequired: 'Login ID and password are required.',
    loginError: 'Login failed.',
    registerError: 'Registration failed.',
    loginTaken: 'Login ID is already in use.',
    passwordMismatch: 'Passwords do not match.',
    passwordTooShort: 'Use at least 8 characters.',
    passwordCommon: 'That password is too common.',
    passwordWeak: 'Use a mix of upper, lower, number, and symbol.',
    passwordStrong: 'Strong password.',
    loadingLogin: 'Signing in…',
    loadingRegister: 'Registering…',
    sessionLabel: 'Session',
    checkSession: 'Check session',
    toggleMode: 'Toggle mode',
    logout: 'Logout'
  },
  dashboard: {
    title: 'Post-login dashboard',
    subtitle: 'This will become the control center with shortcuts, guidance, and security info.',
    cards: [
      {
        title: 'Profile settings',
        desc: 'Coming soon: personal data, roles, and account security.',
        action: 'Open (soon)',
        route: 'account'
      },
      {
        title: 'Parish',
        desc: 'Enter intentions, announcements, and administration tools.',
        action: 'Open portal',
        route: 'parish'
      },
      {
        title: 'Cogita',
        desc: 'Go to knowledge, quizzes, and educational content.',
        action: 'Open portal',
        route: 'cogita'
      }
    ]
  },
  parish: {
    title: 'Parish portal',
    subtitle:
      'Public information is available without login. Accounts are required for editing, finance, and role management.',
    items: [
      'Intentions and offerings with audit trails.',
      'Announcements and parish calendar.',
      'Public summaries with private financial details protected.'
    ],
    note: 'You can browse public content now. Admin features appear after login.',
    loginCta: 'Sign in via REcreatio'
  },
  cogita: {
    title: 'Cogita portal',
    subtitle:
      'Knowledge and collaboration space. Public access to resources; account required for creation and editing.',
    items: [
      'Live quizzes and interactive sessions.',
      'Knowledge library and teaching tools.',
      'Controlled sharing of resources.'
    ],
    note: 'Cogita can also run under a separate domain, e.g. cogita.pl, while still using REcreatio backend.',
    loginCta: 'Sign in via REcreatio',
    shell: {
      back: 'Back',
      up: 'Up'
    },
    user: {
      librariesKicker: 'Libraries',
      librariesTitle: 'Your knowledge libraries',
      librariesSubtitle: 'Create a library role, then enter it to manage encrypted infos and connections.',
      createLibraryTitle: 'Create new library',
      libraryNameLabel: 'Library name',
      libraryNamePlaceholder: 'e.g. Medieval theology',
      createLibraryAction: 'Create library',
      availableLibraries: 'Available libraries',
      loadingLibraries: 'Loading libraries...',
      noLibraries: 'No libraries yet. Create one to begin.',
      libraryRoleLabel: 'Library role',
      openOverview: 'Open overview',
      openCards: 'Open infos',
      libraryNameRequired: 'Library name is required.',
      libraryCreateFailed: 'Could not create the library yet.'
    },
    workspace: {
      navigationAria: 'Cogita browser navigation',
      layers: {
        library: 'Library',
        target: 'Target',
        collection: 'Collection',
        revision: 'Revision'
      },
      noLibraryOption: 'No library',
      selectCollectionOption: 'Collection',
      targets: {
        libraryOverview: 'Library overview',
        allCards: 'Infos',
        newCard: 'New info',
        allCollections: 'Collections',
        allRevisions: 'Revisions',
        newCollection: 'New collection',
        transfer: 'Export & import',
        storyboards: 'Storyboards',
        newStoryboard: 'New storyboard',
        texts: 'Texts',
        newText: 'New text',
        collectionRevision: 'Collection revision',
        sharedRevisions: 'Shared revisions',
        dependencies: 'Dependencies graph'
      },
      revisions: {
        detail: 'Detail',
        graph: 'Graph',
        settings: 'Settings',
        run: 'Run'
      },
      status: {
        loadFailed: 'Failed to load Cogita workspace.',
        savePrefsFailed: 'Could not save Cogita preferences.',
        selectLibraryFirst: 'Select a library first.',
        loadingCollections: 'Loading collections...',
        noCollections: 'No collections in this library yet.',
        loadingRevisions: 'Loading revisions...',
        noRevisions: 'Revision'
      },
      panels: {
        currentPosition: 'Current position',
        quickCreate: 'Quick create',
        collections: 'Collections'
      },
      path: {
        noLibrarySelected: 'No library selected',
        noCollectionSelected: 'Collection',
        noCollectionLayer: 'No collection layer',
        currentRoute: 'Current route:'
      },
      links: {
        libraryOverview: 'Library overview',
        allCards: 'Infos',
        sharedRevisions: 'Shared revisions'
      },
      cards: {
        collectionType: 'Collection',
        itemsSuffix: 'items'
      },
      revisionForm: {
        nameLabel: 'Revision name',
        namePlaceholder: 'Enter revision name',
        createAction: 'Create revision'
      },
      infoActions: {
        overview: 'Overview',
        edit: 'Edit',
        seeCards: 'See cards'
      },
      infoMode: {
        search: 'Search',
        create: 'Create'
      },
      sidebar: {
        title: 'Navigation',
        openMenu: 'Open menu',
        closeMenu: 'Close menu',
        currentPath: 'Current path',
        explore: 'Explore',
        context: 'Context',
        contextEmpty: 'Select a collection to see collection actions.',
        alwaysAvailable: 'Overall',
        libraryActionsHint: 'Library actions',
        infoActionsHint: 'Info actions',
        selectedInfoActionsHint: 'Selected info actions',
        collectionActionsHint: 'Collection actions',
        accountSettings: 'Account settings',
        cogitaHome: 'Cogita home'
      }
    },
    introSlides: [
      {
        id: 'entry',
        title: 'Cogita.',
        subtitle: 'A live knowledge stage for learning and dialogue.',
        micro: 'Step in and see how the knowledge map guides you.',
        cta: 'Start the tour'
      },
      {
        id: 'workspace',
        title: 'You don’t get the next step before you’re ready.',
        body:
          'New knowledge opens only when the previous piece is understood.\nIf basics are missing, Cogita rebuilds them — then moves forward.',
        micro: 'A learning tree that guides you.',
        cta: 'Next: How it guides'
      },
      {
        id: 'library',
        title: 'Knowledge you can reuse — not just read.',
        body:
          'Save ideas as structured index cards: summary, quote, source, tags.\nReuse them to build arguments and notes without losing context.',
        micro: 'Your personal knowledge box.',
        cta: 'Next: Live collaboration'
      },
      {
        id: 'live',
        title: 'Knowledge lives in conversation.',
        body:
          'You learn faster when you think together with others.\nA shared Q&A round turns learning into dialogue.',
        micro: 'Ask, answer, explain.',
        cta: 'Next: The shared game'
      },
      {
        id: 'quiz',
        title: 'See your progress — and what to train next.',
        body:
          'Track your growth and compare with your group.\nFind gaps and connect with people at a similar level.',
        micro: 'Clear feedback, not guessing.',
        cta: 'Next: Trust & privacy'
      },
      {
        id: 'protection',
        title: 'Open, but protected.',
        body: 'What is private stays private — access is controlled and data is protected.',
        micro: 'Trust is the foundation.',
        cta: 'Next: Join'
      },
      {
        id: 'register',
        title: 'Enter Cogita.',
        body: 'Create an account and start your first knowledge scene.',
        micro: 'It only takes a moment.',
        cta: 'Register',
        secondary: 'Back to start'
      }
    ],
    page: {
      nav: [
        { id: 'home', label: 'Home' },
        { id: 'library', label: 'Library' },
        { id: 'live', label: 'Live' },
        { id: 'participation', label: 'Participation' },
        { id: 'results', label: 'Results' },
        { id: 'security', label: 'Security' },
        { id: 'join', label: 'Join' }
      ],
      hero: {
        tag: 'Cogita',
        title: 'A live knowledge space for quizzes, dialogue, and shared memory.',
        subtitle:
          'Design quizzes, run live sessions, and give every participant a personal result view. Cogita keeps content open and access keys private.',
        primaryCta: 'Start with REcreatio',
        secondaryCta: 'Explore the subpages'
      },
      homeSlides: [
        {
          id: 'overview',
          title: 'Cogita. A live knowledge stage for learning and dialogue.',
          text:
            'A presentation space where quizzes, sessions, and resources stay open while access stays cryptographic.',
          ctaLabel: 'Begin the tour'
        },
        {
          id: 'library',
          title: 'Knowledge library with reusable quiz stacks.',
          text: 'Compose lessons, attach resources, and publish curated collections.',
          ctaLabel: 'Next: live sessions'
        },
        {
          id: 'live',
          title: 'Live sessions with controlled tempo.',
          text: 'Start a session, broadcast a code, and guide everyone through each round.',
          ctaLabel: 'Next: participation'
        },
        {
          id: 'results',
          title: 'Participation, results, and SharedViews.',
          text: 'Every participant gets a personal result view, even without an account.',
          ctaLabel: 'Next: security'
        },
        {
          id: 'security',
          title: 'Security baked into every step.',
          text: 'Role-based keys, audit trails, and optional separate domains such as cogita.pl.',
          ctaLabel: 'Next: login',
          variant: 'secondary'
        },
        {
          id: 'login',
          title: 'Ready to create in Cogita?',
          text: 'Sign in with REcreatio to build quizzes, host sessions, and manage your knowledge space.',
          ctaLabel: 'Sign in via REcreatio'
        }
      ],
      stats: [
        { value: '3 modes', label: 'Teacher, student, guest' },
        { value: '1 link', label: 'QR or session code' },
        { value: '0 trust', label: 'Keys enforce access' }
      ],
      highlights: [
        {
          title: 'Live session control',
          desc: 'Start, pause, and close sessions with a single command. Keep the tempo together.'
        },
        {
          title: 'Anonymous ready',
          desc: 'Participants can join without accounts, yet still keep a private result view.'
        },
        {
          title: 'Audit-first',
          desc: 'Every change is logged and scoped by roles, so your knowledge stays accountable.'
        }
      ],
      sections: [
        {
          id: 'library',
          tag: 'Knowledge Library',
          title: 'Compose lessons, reuse quiz stacks, keep context.',
          subtitle: 'Build quizzes and resources with templates, versioning, and co-authorship.',
          cards: [
            {
              title: 'Quiz builder',
              desc: 'Create question banks, templates, and randomized variants for assessments.',
              meta: 'Templates + generator'
            },
            {
              title: 'Knowledge boards',
              desc: 'Cluster topics, attach materials, and keep curriculum context visible.',
              meta: 'Collections + tags'
            },
            {
              title: 'Co-editing',
              desc: 'Invite collaborators with role-based access to draft, review, and publish.',
              meta: 'Role-scoped access'
            }
          ],
          bullets: [
            'Reusable question templates with random parameters.',
            'Attach readings, media, and links to each block.',
            'Publish public previews without exposing answer keys.'
          ]
        },
        {
          id: 'live',
          tag: 'Live Sessions',
          title: 'Orchestrate live participation without losing focus.',
          subtitle: 'Launch a session, broadcast a code, and guide the group in real time.',
          cards: [
            {
              title: 'Session desk',
              desc: 'Start sessions, lock questions, and keep a live timer for each round.',
              meta: 'Teacher control'
            },
            {
              title: 'Instant feedback',
              desc: 'Collect answers, show trends, and decide when to reveal results.',
              meta: 'Live dashboard'
            },
            {
              title: 'Group scope',
              desc: 'Limit sessions to a class or open them to guests with controlled access.',
              meta: 'Class-aware'
            }
          ],
          bullets: [
            'Run quizzes with immediate feedback and moderated reveals.',
            'Support both logged-in and anonymous participants.',
            'Deliver shared views for personal results via QR.'
          ]
        },
        {
          id: 'participation',
          tag: 'Participation',
          title: 'Meet participants where they are.',
          subtitle: 'Cogita supports three ways to join, each with a tailored data view.',
          cards: [
            {
              title: 'Logged-in learners',
              desc: 'Results follow the student account and can be revisited later.',
              meta: 'Account-linked'
            },
            {
              title: 'Anonymous guests',
              desc: 'Join instantly with a QR code and keep a private results link.',
              meta: 'No account needed'
            },
            {
              title: 'Claim later',
              desc: 'Guests can attach their results to an account after the session.',
              meta: 'SharedView join'
            }
          ],
          bullets: [
            'QR-based join flows with per-participant SharedViews.',
            'Personal results links stay private and revocable.',
            'Account upgrades keep the same history.'
          ]
        },
        {
          id: 'results',
          tag: 'Results',
          title: 'See learning signals, not just scores.',
          subtitle: 'Track time, correctness, and group dynamics without exposing raw data.',
          cards: [
            {
              title: 'Time vs accuracy',
              desc: 'Spot where learners hesitate and where they feel confident.',
              meta: 'Analytics'
            },
            {
              title: 'Session replay',
              desc: 'Revisit each question with aggregated insight and anonymised patterns.',
              meta: 'After-action'
            },
            {
              title: 'Export views',
              desc: 'Share summaries with stakeholders while keeping raw answers private.',
              meta: 'Controlled reports'
            }
          ],
          bullets: [
            'Aggregate insights without exposing individual answers.',
            'QR-based views let participants revisit their own results.',
            'Build trust with audit-ready summaries.'
          ]
        },
        {
          id: 'security',
          tag: 'Security',
          title: 'Access is enforced by keys, not just passwords.',
          subtitle: 'Cogita inherits REcreatio cryptography so content stays controlled end-to-end.',
          cards: [
            {
              title: 'Role-based keys',
              desc: 'Teachers, admins, and classes each control distinct data keys.',
              meta: 'Key ledger'
            },
            {
              title: 'SharedViews',
              desc: 'Anonymous results are scoped to a single participant by design.',
              meta: 'QR security'
            },
            {
              title: 'Audit trail',
              desc: 'Changes to quizzes and sessions are recorded with accountability.',
              meta: 'Auth ledger'
            }
          ],
          bullets: [
            'Encrypted quiz configuration and answer storage.',
            'No data access without the right role keys.',
            'Secure mode disables key caching entirely.'
          ]
        }
      ],
      join: {
        title: 'Step into Cogita',
        subtitle: 'Use REcreatio login for authoring, or explore public content right away.',
        cards: [
          {
            title: 'Sign in for authoring',
            desc: 'Create quizzes, manage sessions, and invite collaborators.',
            action: 'Sign in'
          },
          {
            title: 'Preview public spaces',
            desc: 'Browse open knowledge boards and demo sessions.',
            action: 'Explore'
          },
          {
            title: 'Talk to the team',
            desc: 'Plan a pilot with your school or community.',
            action: 'Contact'
          }
        ]
      }
    },
    library: {
      nav: {
        overview: 'Overview',
        list: 'Infos',
        add: 'Add info',
        collections: 'Collections'
      },
      navLabel: 'Library navigation',
      actions: {
        backToCogita: 'Back to Cogita',
        libraryOverview: 'Library overview',
        openList: 'Open infos',
        collections: 'Collections',
        addInfo: 'Add new info',
        createCollection: 'Create collection',
        saveCollection: 'Save collection',
        startRevision: 'Start revision',
        collectionDetail: 'Collection detail'
      },
      infoTypes: {
        any: 'All infos',
        vocab: 'Vocabulary card',
        language: 'Language',
        word: 'Word',
        sentence: 'Sentence / citation',
        topic: 'Topic',
        collection: 'Collection',
        person: 'Person',
        institution: 'Institution',
        collective: 'Collective',
        orcid: 'ORCID',
        address: 'Address',
        email: 'Email',
        phone: 'Phone',
        media: 'Media',
        work: 'Work',
        geo: 'Geo',
        musicPiece: 'Music piece',
        musicFragment: 'Music fragment',
        source: 'Source',
        question: 'Question',
        quote: 'Quote',
        computed: 'Computed'
      },
      connectionTypes: {
        wordLanguage: 'Word - language',
        citationLanguage: 'Citation - language',
        wordTopic: 'Word - topic',
        languageSentence: 'Language - sentence',
        translation: 'Translation link',
        reference: 'Info - source',
        sourceResource: 'Source - resource',
        workContributor: 'Work - contributor',
        workMedium: 'Work - medium',
        orcidLink: 'ORCID link'
      },
      groupTypes: {
        vocab: 'Vocabulary card',
        citation: 'Citation',
        book: 'Book'
      },
      overview: {
        kicker: 'Library',
        subtitle: 'Overview of your encrypted info library.',
        stats: {
          totalInfos: 'Total infos',
          connections: 'Connections',
          words: 'Words',
          sentences: 'Sentences',
          languages: 'Languages',
          collections: 'Collections',
          revisions: 'Revisions',
          storyboards: 'Storyboards',
          texts: 'Texts'
        },
        statsCardTitle: 'Library statistics',
        statsCardHint: 'Select a counter to focus this panel.',
        knownChartTitle: 'Knowness status',
        checksChartTitle: 'Available checks',
        known: 'Known',
        unknown: 'Not known',
        excluded: 'Excluded',
        availableChecks: 'Available',
        unavailableChecks: 'Unavailable',
        quickActionsTitle: 'Quick actions',
        quickActionsText: 'Jump into infos to browse or add a new entry.',
        browseList: 'Browse list',
        viewCollections: 'View collections',
        addInfo: 'Add info',
        seedMock: 'Seed mock data',
        seedSuccess: 'Mock data ready: {languages} languages, {translations} vocab cards.',
        seedFail: 'Failed to create mock data.',
        focusTitle: 'What is inside?',
        focusBody1: 'Every info is encrypted and linked through relationships.',
        focusBody2: 'Use the list to explore, then add or connect new knowledge nodes.',
        transferTitle: 'Export & import',
        transferBody: 'Export decrypts your library into a JSON bundle. Import rebuilds it with new keys.',
        export: 'Export library',
        import: 'Import bundle',
        exporting: 'Exporting library…',
        importing: 'Importing bundle…',
        exportProgress: 'Export progress: {loaded} / {total}',
        importProgress: 'Import progress: {loaded} / {total}',
        progressUnknown: 'unknown',
        exportReady: 'Export ready.',
        exportFail: 'Export failed.',
        importDone: 'Import finished.',
        importStageInfos: 'Infos',
        importStageConnections: 'Connections',
        importStageCollections: 'Collections',
        importLiveProgress: '{stage}: {done}/{total} (infos {infos}, connections {connections}, collections {collections})',
        importSummary: 'Imported {infos} infos, {connections} connections, {collections} collections.',
        importFail: 'Import failed.'
      },
      modules: {
        storyboardsTitle: 'Storyboards',
        storyboardsSubtitle: 'Draft storyboard workspace for this library.',
        storyboardsNewLabel: 'New storyboard',
        storyboardsNewPlaceholder: 'Storyboard name',
        storyboardsCreate: 'Create storyboard',
        storyboardsExisting: 'Existing storyboards',
        storyboardsEmpty: 'No storyboards yet.',
        textsTitle: 'Texts',
        textsSubtitle: 'Draft writing workspace for this library.',
        textsNewLabel: 'New text',
        textsNewPlaceholder: 'Text title',
        textsCreate: 'Create text',
        textsExisting: 'Existing texts',
        textsEmpty: 'No texts yet.',
        draftInfo: 'Draft module only. Persistence will be added next.'
      },
      list: {
        kicker: 'Library list',
        subtitle: 'Browse all encrypted infos.',
        searchTitle: 'Search',
        searchPlaceholder: 'Search text, name, or label',
        cardCount: '{shown} of {total} entries',
        cardTypeInfo: 'Info',
        cardTypeConnection: 'Connection',
        cardTypeVocab: 'Vocabulary',
        modes: {
          detail: 'Detail',
          collection: 'Collection',
          list: 'List'
        },
        selectedTitle: 'Selected info',
        selectedEmpty: 'Pick an info',
        selectedHint: 'Use the add page to create connections or vocabulary links.',
        noMatch: 'No matching info found.',
        addInfo: 'Add information',
        loadMore: 'Load more',
        loading: 'Loading...',
        ready: 'Ready',
        progressUnlimited: 'Unlimited',
        computedSampleTitle: 'Computed example',
        computedPromptLabel: 'Prompt:',
        computedAnswerLabel: 'Answer:',
        computedLoading: 'Generating example…',
        computedEmpty: 'No example available.',
        editInfo: 'Edit info',
        deleteConnection: 'Delete connection',
        deleteConnectionConfirm: 'Delete this connection? This cannot be undone.',
        deleteConnectionFailed: 'Failed to delete connection.',
        searchOnlyHint: 'This page is only for searching and selecting infos.',
        typeLabel: 'Info type',
        sortLabel: 'Sorting',
        sortRelevance: 'Relevance',
        sortLabelAsc: 'Name A-Z',
        sortLabelDesc: 'Name Z-A',
        sortTypeAsc: 'Type A-Z',
        sortTypeDesc: 'Type Z-A',
        selectionCount: 'Selected: {count}',
        selectAllVisible: 'Select visible',
        clearSelection: 'Clear selection',
        openSelected: 'Open selected',
        openSelectedDisabled: 'Select one info to open',
        constraintLabel: 'Type filter',
        constraintPlaceholder: 'Additional type constraint',
        viewLabel: 'Result view',
        viewDetails: 'Details',
        viewWide: 'Wide cards',
        viewGrid: 'Grid',
        selectedStackTitle: 'Selection stack',
        selectedStackHint: 'Selected infos remain when search conditions change.',
        removeFromStack: 'Remove from stack',
        detailColumnName: 'Name',
        detailColumnType: 'Type',
        detailColumnId: 'Id',
        showFilters: 'Show filters',
        hideFilters: 'Hide filters',
        filtersOptionalHint: 'Filters are optional and depend on selected info type.',
        filtersLoading: 'Loading filter data...',
        typeFilterLanguage: 'Language',
        typeFilterLanguageA: 'Language A',
        typeFilterLanguageB: 'Language B',
        typeFilterOriginalLanguage: 'Original language',
        typeFilterDoi: 'DOI',
        typeFilterSourceKind: 'Source type',
        typeFilterLocator: 'Locator / reference',
        typeFilterCitationText: 'Citation text'
      },
      filters: {
        title: 'Filters',
        clear: 'Clear filters',
        languageA: 'Language A',
        languageB: 'Language B',
        topic: 'Topic',
        level: 'Translation tag',
        placeholderLanguageA: 'Filter by language A',
        placeholderLanguageB: 'Filter by language B',
        placeholderTopic: 'Filter by topic',
        placeholderLevel: 'Filter by translation tag'
      },
      add: {
        kicker: 'Add info',
        subtitle: 'Create new infos, connections, or vocabulary links.',
        tabs: {
          info: 'info',
          connection: 'connection',
          group: 'group'
        },
        tabDesc: {
          info: 'Add a language, word, sentence, topic, person, or data item.',
          connection: 'Connect two or more infos with a typed relation.',
          group: 'Create vocab links using words, languages, and translations.'
        },
        info: {
          typeLabel: 'Info type',
          labelLabel: 'Label',
          labelPlaceholder: 'Title, name, or main text',
          languageLabel: 'Language',
          languagePlaceholder: 'Search or create a language',
          notesLabel: 'Notes',
          notesPlaceholder: 'Description, citation source, or extra metadata',
          sourceKindLabel: 'Source kind',
          sourceKindPlaceholder: 'Select a source kind',
          sourceResourceTypeLabel: 'Resource type',
          sourceResourceLabel: 'Resource',
          sourceResourcePlaceholder: 'Search or create a resource',
          sourceBibleBookLabel: 'Bible book (Latin)',
          sourceBibleBookPlaceholder: 'e.g. Genesis',
          sourceBibleRestLabel: 'Chapter / verse',
          sourceBibleRestPlaceholder: 'e.g. 1:1',
          quoteTextLabel: 'Citation text',
          quoteTextPlaceholder: 'Paste the quoted text',
          workLanguageLabel: 'Work language',
          workLanguagePlaceholder: 'Search or create a language',
          workOriginalLanguageLabel: 'Original language',
          workOriginalLanguagePlaceholder: 'Search or create a language',
          workDoiLabel: 'DOI',
          workDoiPlaceholder: 'e.g. 10.xxxx/xxxxx',
          mediaTypeLabel: 'Media type',
          mediaTypePlaceholder: 'Select a media type',
          mediaPublisherLabel: 'Publisher',
          mediaPublisherPlaceholder: 'Publisher name',
          mediaPublicationPlaceLabel: 'Publication place',
          mediaPublicationPlacePlaceholder: 'City',
          mediaPublicationYearLabel: 'Publication year',
          mediaPublicationYearPlaceholder: 'YYYY',
          mediaPagesLabel: 'Pages',
          mediaPagesPlaceholder: 'Total pages',
          mediaIsbnLabel: 'ISBN',
          mediaIsbnPlaceholder: 'ISBN',
          mediaCoverLabel: 'Cover',
          mediaCoverPlaceholder: 'Cover description',
          mediaHeightLabel: 'Height',
          mediaHeightPlaceholder: 'cm',
          mediaLengthLabel: 'Length',
          mediaLengthPlaceholder: 'cm',
          mediaWidthLabel: 'Width',
          mediaWidthPlaceholder: 'cm',
          mediaWeightLabel: 'Weight',
          mediaWeightPlaceholder: 'g',
          mediaCollectionLabel: 'Collection',
          mediaCollectionPlaceholder: 'Collection name',
          mediaLocationLabel: 'Location',
          mediaLocationPlaceholder: 'Shelf or archive',
          sourceUrlLabel: 'Source URL',
          sourceUrlPlaceholder: 'https://…',
          sourceAccessedDateLabel: 'Accessed date',
          sourceAccessedDatePlaceholder: 'YYYY-MM-DD',
          referenceTitle: 'Reference',
          referenceToggle: 'Add reference',
          referenceMissingSource: 'Provide the required source details.',
          computedLabel: 'Prompt template',
          computedPlaceholder: 'Example: {a} + {b} = ?',
          computedAnswerLabel: 'Answer sentence',
          computedAnswerPlaceholder: 'The {entry} is of type {entry}',
          computedAnswerRequired: 'An answer sentence is required.',
          computedAnswerMissingOutput: 'Answer sentence must reference all output variables.',
          computedRequired: 'A computed graph is required.',
          computedInvalid: 'Computed definition must be valid JSON.',
          computedInvalidName: 'Invalid variable names in the graph.',
          computedDuplicateName: 'Duplicate variable names in the graph.',
          computedPreview: 'Show example',
          computedPreviewTitle: 'Computed example',
          computedPreviewFail: 'Unable to generate example.',
          save: 'Save info',
          update: 'Save changes',
          saved: 'Info saved.',
          updated: 'Info updated.',
          failed: 'Failed to save info.'
        },
        connection: {
          typeLabel: 'Connection type',
          languageLabel: 'Language',
          languagePlaceholder: 'Search or create a language',
          wordLabel: 'Word',
          wordPlaceholder: 'Search or create a word',
          wordALabel: 'Word A',
          wordAPlaceholder: 'Search or create word A',
          wordBLabel: 'Word B',
          wordBPlaceholder: 'Search or create word B',
          sentenceLabel: 'Sentence',
          sentencePlaceholder: 'Search or create a sentence',
          topicLabel: 'Topic',
          topicPlaceholder: 'Search or create a topic',
          quoteLabel: 'Quote',
          quotePlaceholder: 'Search or create a quote',
          sourceLabel: 'Source',
          sourcePlaceholder: 'Search or create a source',
          referencedInfoTypeLabel: 'Referenced info type',
          referencedInfoLabel: 'Referenced info',
          referencedInfoPlaceholder: 'Search or create info',
          workLabel: 'Work',
          workPlaceholder: 'Search or create a work',
          contributorTypeLabel: 'Contributor type',
          contributorLabel: 'Contributor',
          contributorPlaceholder: 'Search or create a contributor',
          contributorRoleLabel: 'Contributor role',
          contributorRolePlaceholder: 'Author, translator, redactor, etc.',
          mediumLabel: 'Medium',
          mediumPlaceholder: 'Search or create a medium',
          orcidEntityHeader: 'Entity',
          orcidHeader: 'ORCID',
          sourceResourceTypeLabel: 'Resource type',
          sourceResourceLabel: 'Resource',
          sourceResourcePlaceholder: 'Search or create a resource',
          noteLabel: 'Note',
          notePlaceholder: 'Optional context for the connection',
          save: 'Save connection',
          saved: 'Connection saved.',
          failed: 'Failed to save connection.',
          pairExists: 'This word already belongs to that language.',
          selectWordLanguage: 'Select a language and a word.',
          selectWordTopic: 'Select a word and a topic.',
          selectTwoWords: 'Select two words to link.',
          selectLanguageSentence: 'Select a language and a sentence.',
          selectReference: 'Select an info and a source.',
          selectSourceResource: 'Select a source and a resource.',
          selectQuoteLanguage: 'Select a quote and a language.',
          selectWorkContributor: 'Select a work, a contributor, and a role.',
          selectWorkMedium: 'Select a work and a medium.',
          selectOrcidLink: 'Select an entity and an ORCID.'
        },
        group: {
          typeLabel: 'Group type',
          languageALabel: 'Language A',
          languageAPlaceholder: 'Search or create Language A',
          wordATagsLabel: 'Tags for word A',
          wordATagsPlaceholder: 'Search or create tags for word A',
          wordBTagsLabel: 'Tags for word B',
          wordBTagsPlaceholder: 'Search or create tags for word B',
          translationTagsLabel: 'Tags for translation',
          translationTagsPlaceholder: 'Search or create translation tags',
          wordALabel: 'Word A',
          wordAPlaceholder: 'Search or create Word A',
          languageBLabel: 'Language B',
          languageBPlaceholder: 'Search or create Language B',
          wordBLabel: 'Word B',
          wordBPlaceholder: 'Search or create Word B',
        citationQuoteTextLabel: 'Citation text',
        citationQuoteTextPlaceholder: 'Paste the quoted text',
        citationTitleLabel: 'Citation title',
          citationTitlePlaceholder: 'Optional title for the citation entry',
        citationLanguageLabel: 'Citation language',
        citationLanguagePlaceholder: 'Search or create a language',
          citationSourceKindLabel: 'Source kind',
          citationBibleBookLabel: 'Bible book (Latin)',
          citationBibleBookPlaceholder: 'e.g. Genesis',
          citationBibleRestLabel: 'Chapter / verse',
          citationBibleRestPlaceholder: 'e.g. 1:1',
          citationChurchDocumentLabel: 'Numbered document',
          citationChurchDocumentPlaceholder: 'Search or create a numbered document',
          citationWorkLabel: 'Work',
          citationWorkPlaceholder: 'Search or create a work',
          citationBookLabel: 'Book',
          citationBookPlaceholder: 'Search or create a book',
          citationLocatorValueLabel: 'Locator',
          citationLocatorValuePlaceholder: 'Page or document number',
          bookTitleLabel: 'Book title',
          bookTitlePlaceholder: 'e.g. The City of God',
          workTitleLabel: 'Work title',
          workTitlePlaceholder: 'e.g. De civitate Dei',
          contributorsLabel: 'Contributors',
          addContributor: 'Add contributor',
          removeContributor: 'Remove',
          bookMissingTitle: 'Book title is required.',
          bookMissingWork: 'Work title is required.',
          bookMissingContributor: 'Every contributor needs a role and a person/institution.',
          citationMissingQuote: 'Citation text is required.',
          citationMissingSource: 'Provide the required source details.',
          saveVocab: 'Save vocabulary links',
          saveCitation: 'Save citation',
          saveBook: 'Save book info',
          savedVocab: 'Vocabulary connections saved.',
          savedCitation: 'Citation saved.',
          savedBook: 'Book info saved.',
          failed: 'Failed to save group.',
          pairExistsA: 'Word A already belongs to Language A.',
          pairExistsB: 'Word B already belongs to Language B.',
          selectBoth: 'Select both languages and both words.'
        }
      },
      collections: {
        listKicker: 'Collections',
        listSubtitle: 'Curated sets of infos for revision.',
        searchPlaceholder: 'Search collection name',
        emptyTitle: 'No collections yet.',
        emptyAction: 'Create the first collection',
        countLabel: '{shown} of {total} collections',
        collectionLabel: 'Collection',
        noNotes: 'No notes yet',
        defaultName: 'Collection',
        itemCountLabel: '{count} entries',
        detailKicker: 'Collection detail',
        detailSubtitle: 'Curated sets of infos for revision.',
        noCards: 'No entries stored in this collection yet.',
        detailFocusTitle: 'Prepare revision sets',
        detailFocusBody: 'Create collections from words, translations, or any infos.',
        createKicker: 'New collection',
        createSubtitle: 'Bundle infos for focused revision.',
        collectionInfoTitle: 'Collection info',
        nameLabel: 'Name',
        namePlaceholder: 'e.g. German basics',
        notesLabel: 'Notes',
        notesPlaceholder: 'Focus, schedule, or notes',
        saveRequiredName: 'Collection name is required.',
        saveSuccess: 'Collection saved.',
        saveFail: 'Failed to save collection.',
        findCardsTitle: 'Find infos',
        searchCardsPlaceholder: 'Search infos',
        addToCollection: 'Add to collection',
        added: 'Added',
        selectedCardsTitle: 'Selected infos',
        selectedCountLabel: '{count} items',
        noSelected: 'No infos selected yet.',
        remove: 'Remove',
        loading: 'Loading...',
        ready: 'Ready'
      },
      revision: {
        settingsKicker: 'Revision settings',
        settingsSubtitle: 'Revision settings',
        runKicker: 'Revision',
        shareRunKicker: 'Shared revision',
        modeSummary: 'Mode: {mode} · Check: {check}',
        modeLabel: 'Mode',
        modeValue: 'Random',
        modeValueLevels: 'Levels',
        modeValueTemporal: 'Temporal',
        levelsLabel: 'Levels',
        stackLabel: 'Stack size',
        levelsCurrentLabel: 'Card level',
        levelsCountsLabel: 'Cards per level',
        levelsStackLabel: 'Active stack',
        triesLabel: 'Attempts before reveal',
        dependencyThresholdLabel: 'Dependency threshold (%)',
        minCorrectnessLabel: 'Min correctness (%)',
        compareLabel: 'Comparison',
        compareBidirectional: 'Bidirectional',
        comparePrefix: 'Prefix only',
        compareAnchors: 'Anchors',
        considerDependenciesLabel: 'Consider dependencies',
        considerDependenciesOn: 'Yes (small to large)',
        considerDependenciesOff: 'No (all fragments)',
        temporalUnknownLabel: 'Unknown',
        temporalKnownLabel: 'Known > 1',
        checkLabel: 'Check',
        checkValue: 'Exact match',
        cardsPerSessionLabel: 'Cards per session',
        reviewerLabel: 'Reviewer',
        shareKicker: 'Public link',
        shareTitle: 'Share this revision',
        shareBody: 'Create a public link that opens this revision in read-only mode.',
        shareAction: 'Create public link',
        shareWorking: 'Creating link...',
        shareLinkLabel: 'Share link',
        shareCopyAction: 'Copy link',
        shareCopied: 'Link copied.',
        shareCopyError: 'Unable to copy link.',
        shareError: 'Failed to create share link.',
        shareListTitle: 'Active links',
        shareListLoading: 'Loading links...',
        shareListEmpty: 'No active links yet.',
        shareRevokeAction: 'Revoke',
        shareRevoked: 'Revoked',
        shareInvalid: 'This shared revision link is invalid or expired.',
        shareLoading: 'Loading shared revision...',
        previewTitle: 'Random order, strict answers',
        previewBody1: 'Vocabulary cards will prompt a translation.',
        previewBody2: 'Word cards will ask you to select the correct language.',
        start: 'Start revision',
        progressTitle: 'Progress',
        loading: 'Loading revision cards...',
        loadingComputed: 'Generating computed card...',
        error: 'Failed to load cards.',
        empty: 'No cards available for revision.',
        completed: 'Revision completed. Great job!',
        vocabLabel: 'Vocabulary',
        infoLabel: 'Info',
        answerLabel: 'Your answer',
        answerPlaceholder: 'Type the translation',
        answerPlaceholderComputed: 'Enter the result',
        quoteMissingPlaceholder: 'Type the missing part',
        quoteProgress: 'Dependencies checked: {done} / {total}',
        answerSentenceLabel: 'Answer sentence',
        answerSentencePlaceholder: 'Type the full answer sentence',
        checkAnswer: 'Check answer',
        skip: 'Skip',
        nextQuestion: 'Next question',
        hintSelectLanguage: 'Select the language for this word.',
        hintReview: 'Review this card and mark as done.',
        markDone: 'Mark reviewed',
        correct: 'Correct',
        tryAgain: 'Try again',
        noLanguages: 'No languages found.',
        matchLabel: 'Match the translations',
        knownessTitle: 'Knowness',
        knownessEmpty: 'No data yet',
        knownessStats: '{correct} / {total} correct',
        knownessLast: 'Last reviewed: {date}',
        knownessHint: 'Start a revision to see your knowness stats.',
        dependenciesBlocked: 'Dependencies not yet satisfied. Review prerequisite cards to continue.',
        revealModeLabel: 'Answer reveal:',
        revealModeAfterIncorrect: 'after incorrect (manual)',
        showAnswer: 'Show correct answer',
        correctAnswerLabel: 'Correct answer',
        live: {
          hostKicker: 'Live revision host',
          hostTitle: 'Host session',
          joinKicker: 'Live revision',
          joinTitle: 'Join session',
          joinCodeLabel: 'Join code',
          joinUrlLabel: 'Join URL',
          qrLabel: 'QR',
          statusLabel: 'Status',
          statusLobby: 'Lobby',
          statusRunning: 'Running',
          statusRevealed: 'Revealed',
          statusFinished: 'Finished',
          roundsLabel: 'Rounds: {count}',
          participantsTitle: 'Participants',
          scoreboardTitle: 'Scoreboard',
          pointsTitle: 'Points',
          finalScoreTitle: 'Final score',
          currentRoundTitle: 'Current round',
          questionTitle: 'Question',
          waitingForHostQuestion: 'Waiting for host to publish a question.',
          waitingForPublishedRound: 'Waiting for published round',
          sessionNotStarted: 'Session not started',
          hiddenBeforeStart: 'No question is shown before the host starts the session.',
          noParticipants: 'No participants yet.',
          participantNameLabel: 'Name',
          joinAction: 'Join',
          joiningAction: 'Joining...',
          joinedWaiting: 'Joined. Waiting for host.',
          connectionError: 'Connection error or invalid session.',
          submitAnswer: 'Submit answer',
          submitted: 'Submitted',
          publishCurrentRound: 'Publish current round',
          checkAndReveal: 'Check answer',
          nextQuestionAction: 'Next question',
          loading: 'Loading...',
          unsupportedPromptType: 'Unsupported prompt type.',
          addPathAction: 'Add path',
          fragmentLabel: 'Fragment',
          correctFragmentLabel: 'Correct fragment',
          participantAnswerPlaceholder: 'Participant answer here',
          selectMatchingPairPrompt: 'Select the matching pair',
          wordLanguagePromptPrefix: 'Language of',
          loadRoundsError: 'Failed to load revision cards for live session.',
          createSessionError: 'Failed to create live session.',
          answerStatusAnswered: 'answered',
          answerStatusWaiting: 'waiting',
          answerStatusCorrect: 'correct',
          answerStatusIncorrect: 'incorrect',
          trueLabel: 'True',
          falseLabel: 'False',
          scoreUnit: 'pt'
        },
      },
      lookup: {
        searchFailed: 'Search failed.',
        createFailed: 'Create failed.',
        createNew: 'Create new {type}',
        saving: 'Saving...',
        loadMore: 'Load more'
      },
      graph: {
        kicker: 'Collection graph',
        subtitle: 'Build filter logic with nodes and connect to the output.',
        palette: 'Add nodes',
        inspector: 'Node inspector',
        typeLabel: 'Type:',
        save: 'Save graph',
        saveSuccess: 'Graph saved.',
        saveFail: 'Failed to save graph.',
        preview: 'Preview',
        previewLabel: '{total} cards matched',
        previewBreakdown: '{connections} connections · {infos} infos',
        emptyInspector: 'Select a node to edit its parameters.',
        nameLabel: 'Variable name',
        namePlaceholder: 'e.g. result',
        outputLabel: 'Output display name',
        outputPlaceholder: 'e.g. value',
        duplicateName: 'Name already used. Choose a unique variable.',
        invalidName: 'Use letters, numbers, and underscores only. Start with a letter.',
        nameHint: 'Use only a–z, 0–9, _ so the name works in LaTeX placeholders like {x_1}.',
        regenerateRandom: 'New random value',
        deleteNode: 'Delete node',
        noParams: 'No parameters for this node.',
        listLabel: 'List entries',
        listPlaceholder: 'One item per line',
        nodeTypes: {
          inputRandom: 'Random input',
          inputConst: 'Constant',
          inputList: 'List entry',
          add: 'Add',
          sub: 'Subtract',
          mul: 'Multiply',
          div: 'Divide',
          pow: 'Power',
          exp: 'Exponent',
          log: 'Logarithm',
          abs: 'Absolute',
          min: 'Minimum',
          max: 'Maximum',
          floor: 'Floor',
          ceil: 'Ceil',
          round: 'Round',
          mod: 'Modulo',
          concat: 'Concat',
          trim: 'Trim',
          output: 'Output'
        },
        handleLabels: {
          input: 'Input',
          add: 'Add',
          sub: 'Subtract',
          numerator: 'Numerator',
          denominator: 'Denominator',
          base: 'Base',
          exponent: 'Exponent',
          value: 'Value',
          index: 'Index',
          name: 'Name',
          text: 'Text',
          start: 'Start trim',
          end: 'End trim'
        },
        tagLabel: 'Tag',
        tagPlaceholder: 'Search tag',
        languageLabel: 'Language',
        languagePlaceholder: 'Search language',
        scopeLabel: 'Scope',
        scopeAny: 'Any',
        scopeTranslation: 'Translation tags',
        scopeWordA: 'Word A',
        scopeWordB: 'Word B',
        infoTypeLabel: 'Info type',
        specificInfoLabel: 'Specific info',
        specificInfoPlaceholder: 'Search info',
        connectionTypeLabel: 'Connection type',
        connectionIdLabel: 'Specific connection',
        connectionIdPlaceholder: 'Paste connection GUID'
      }
    }
  },
  faq: {
    title: 'FAQ and security',
    items: [
      {
        q: 'Is my data encrypted?',
        a: 'Yes. Data is encrypted with keys derived from user roles.\nWithout keys, there is no access, even for administrators.'
      },
      {
        q: 'Does the server know my password?',
        a: 'No. The password is transformed locally and the server stores only a verifier.\nThe database never stores H1/H2/H3, only the H4 verifier.'
      },
      {
        q: 'Can I use it without an account?',
        a: 'Yes. Public portals (Parish and Cogita) provide open information without login.'
      },
      {
        q: 'What is secure mode?',
        a: 'Secure mode disables the session secret cache.\nKeys are reconstructed per request and discarded immediately.'
      },
      {
        q: 'Is there a classic password reset?',
        a: 'No. Account recovery requires a multi-party procedure and audit trail.\nThis prevents silent resets by third parties.'
      },
      {
        q: 'What are account states?',
        a: 'Accounts can be Pending, Active, Locked, Disabled, or Deleted.\nState transitions are recorded in the Auth Ledger.'
      },
      {
        q: 'What happens after login?',
        a: 'A SessionId and access token are issued.\nTokens never contain encryption keys or sensitive payloads.'
      },
      {
        q: 'Are changes audited?',
        a: 'Yes. Key events are recorded in the Auth Ledger.\nThis provides traceability and accountability.'
      }
    ]
  },
  legal: {
    title: 'Privacy, terms, and transparency',
    items: [
      {
        title: 'Privacy (GDPR)',
        desc:
          'Data controller: Parafia Rzymskokatolicka pw. św. Jana Chrzciciela w Krakowie.\nAddress: ul. Dobrego Pasterza 117, 31-416 Kraków, Poland.\nNIP 9451520798, REGON 040098025.\nContact: parafia@janchrzciciel.eu, phone +48 12 412 58 50.'
      },
      {
        title: 'Purposes and legal basis',
        desc:
          'Purposes: account management, public portals, communication, security, and audits.\nLegal basis: consent, service delivery, legitimate interests, and legal obligations.'
      },
      {
        title: 'Data categories',
        desc:
          'Identification: login, email, name (if provided).\nTechnical: session identifiers, device info, security logs.\nPortal content: data shared voluntarily by users.'
      },
      {
        title: 'Recipients and processors',
        desc:
          'Hosting and infrastructure: Webio (Hosting Webio).\nIT support only as necessary for service delivery.\nData is not sold.'
      },
      {
        title: 'Security measures',
        desc:
          'Encryption at rest, role-based access control, audit logs, and restricted admin access.\nContinuous monitoring and security event logging.'
      },
      {
        title: 'Terms of use',
        desc: 'Rules for using the platform, administrator roles, and user responsibilities.\nProhibition of abuse and unlawful activity.'
      },
      {
        title: 'Imprint',
        desc:
          'Technical contact: ks. Michael Mleczek, mleczek_pradnik@outlook.com.\nHosting: Webio (Hosting Webio), ul. Gwiaździsta 8/52, 66-400 Gorzów Wielkopolski, Poland.\nNIP 5992688099, REGON 080265578, email: sprzedaz@webio.pl.'
      },
      {
        title: 'Retention',
        desc:
          'Account data is stored for the lifetime of the account and as required by law.\nSecurity and audit logs may be retained longer for compliance and safety.'
      },
      {
        title: 'Data transfers',
        desc:
          'Data is not transferred outside the European Economic Area.\nNo automated decision-making or profiling is used.'
      },
      {
        title: 'Data Protection Officer',
        desc:
          'DPO: rodo@diecezja.krakow.pl, phone +48 12 628 81 00.\nAddress: ul. Franciszkańska 3, 31-004 Kraków, Poland.'
      },
      {
        title: 'Supervisory authority',
        desc:
          'Kościelny Inspektor Ochrony Danych (KIOD).\nAddress: Skwer kard. Stefana Wyszyńskiego 6, 01–015 Warszawa.\nEmail: kiod@episkopat.pl.'
      },
      {
        title: 'Your rights',
        desc:
          'Right of access, rectification, erasure, restriction, and data portability.\nRight to object and lodge a complaint with the supervisory authority.'
      }
    ]
  },
  account: {
    title: 'User settings',
    subtitle: 'Manage your public profile and security.',
    overviewTitle: 'Overview',
    overviewLead: 'Your login does not have to be an email. The nickname is public.',
    sections: {
      overview: 'Overview',
      profile: 'Public profile',
      roles: 'Role graph',
      security: 'Security'
    },
    menuLabel: 'Sections',
    loginIdLabel: 'Login ID',
    loginIdHint: 'This identifier can be a username or email and cannot be changed.',
    nicknameLabel: 'Public nickname',
    nicknameHint: 'Visible to other users. Avoid private data.',
    nicknamePlaceholder: 'Choose a public nickname',
    nicknameToggle: 'Edit nickname',
    nicknameAction: 'Save nickname',
    nicknameWorking: 'Saving nickname…',
    nicknameSuccess: 'Nickname updated.',
    nicknameError: 'Nickname update failed.',
    passwordTitle: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    passwordToggle: 'Change password',
    passwordAction: 'Update password',
    passwordWorking: 'Updating password…',
    passwordSuccess: 'Password updated.',
    passwordError: 'Password update failed.',
    secureModeTitle: 'Secure mode',
    secureModeNote: 'Secure mode disables key cache on the server.',
    secureModeEnable: 'Enable secure mode',
    secureModeDisable: 'Disable secure mode',
    logoutAction: 'Sign out',
    roles: {
      lead: 'Visualize roles, data nodes, and key relations. Select nodes or edges for details.',
      searchPlaceholder: 'Search by nick or role ID',
      reachableToggle: 'Show only reachable from selected',
      fullscreenEnter: 'Fullscreen',
      fullscreenExit: 'Exit fullscreen',
      noFilters: 'No relation types yet.',
      loading: 'Loading graph…',
      noNodes: 'No roles to display.',
      panelTitle: 'Details',
      panelEmpty: 'Select a role or relation.',
      legendTitle: 'Legend',
      edgeTitle: 'Relation',
      edgeDeleteAction: 'Delete relation',
      edgeDeleteWorking: 'Removing relation…',
      edgeDeleteSuccess: 'Relation removed.',
      edgeDeleteError: 'Unable to remove relation.',
      linkDraftTitle: 'Latest link',
      linkDraftHint: 'Most recent relation created in the graph.',
      linkWorking: 'Linking roles…',
      linkSuccess: 'Relation saved.',
      linkError: 'Unable to link roles.',
      createOwnedRole: 'Create owned role',
      createOwnedRoleHint: 'Owner will be the selected role.',
      createRoleTitle: 'New role',
      createRoleNickLabel: 'Role nick',
      createRoleKindLabel: 'Role type',
      createRoleRelationLabel: 'Relation',
      createRoleAction: 'Create role',
      createRoleWorking: 'Creating role…',
      createRoleSuccess: 'Role created.',
      createRoleError: 'Role creation failed.',
      dataAddTitle: 'Add data field',
      dataFieldLabel: 'Field type',
      dataKindLabel: 'Data type',
      dataKindData: 'Data',
      dataKindKey: 'Key only',
      dataValueLabel: 'Value',
      dataAddAction: 'Add field',
      dataAddWorking: 'Saving data…',
      dataAddSuccess: 'Data saved.',
      dataAddError: 'Unable to add data.',
      dataEditTitle: 'Edit data',
      dataEditAction: 'Save data',
      dataEditWorking: 'Saving changes…',
      dataEditSuccess: 'Data updated.',
      dataEditError: 'Unable to update data.',
      dataDeleteAction: 'Delete field',
      dataDeleteWorking: 'Removing data…',
      dataDeleteSuccess: 'Data removed.',
      dataDeleteError: 'Unable to remove data.',
      dataOwnerLabel: 'Owner role',
      dataShareTitle: 'Share data',
      dataShareTargetLabel: 'Target role ID',
      dataSharePermissionLabel: 'Access type',
      dataShareAction: 'Share data',
      dataShareWorking: 'Sharing data…',
      dataShareSuccess: 'Data shared.',
      dataShareError: 'Unable to share data.',
      shareRoleTitle: 'Share role',
      shareRoleTargetLabel: 'Target role ID',
      shareRoleRelationLabel: 'Access type',
      shareRoleAction: 'Share role',
      shareRoleWorking: 'Sharing role…',
      shareRoleSuccess: 'Role shared.',
      shareRoleError: 'Role share failed.',
      shareRoleHint: 'Creates a pending invitation for the target role.',
      recoveryPrepareAction: 'Prepare recovery key',
      recoveryPrepareWorking: 'Preparing recovery key…',
      recoveryPrepareSuccess: 'Recovery key prepared.',
      recoveryPrepareError: 'Unable to prepare recovery key.',
      recoveryPlanTitle: 'Recovery key (draft)',
      recoveryPlanHint: 'Connect owner roles, then activate the recovery key.',
      recoveryPlanNeedsShares: 'Missing: add at least one owner connection.',
      recoveryPlanLabel: 'Recovery key',
      recoveryPlanError: 'Select the recovery draft to continue.',
      recoveryShareWorking: 'Adding recovery share…',
      recoveryShareSuccess: 'Recovery share added.',
      recoveryShareError: 'Unable to add recovery share.',
      recoveryActivateAction: 'Create recovery key',
      recoveryActivateWorking: 'Activating recovery key…',
      recoveryActivateSuccess: 'Recovery key activated.',
      recoveryActivateError: 'Unable to activate recovery key.',
      contextAddRoleTitle: 'Add role to graph',
      contextAddRolePlaceholder: 'Role ID',
      contextAddRoleAction: 'Focus role',
      contextAddRoleWorking: 'Loading role…',
      contextAddRoleSuccess: 'Role loaded.',
      contextAddRoleError: 'Role is not available in this graph.',
      linkPermissionNeeded: 'Permission required to create this connection.',
      contextAddData: 'Add data',
      contextPrepareRecovery: 'Prepare recovery key',
      contextClose: 'Close',
      pendingTitle: 'Pending invitations',
      pendingAction: 'Load invitations',
      pendingWorking: 'Loading invitations…',
      pendingError: 'Unable to load invitations.',
      pendingEmpty: 'No pending invitations.',
      pendingAccept: 'Accept',
      pendingDataTitle: 'Pending data shares',
      pendingDataAction: 'Load data shares',
      pendingDataWorking: 'Loading data shares…',
      pendingDataError: 'Unable to load data shares.',
      pendingDataEmpty: 'No data shares.',
      parentsTitle: 'Parent roles',
      parentsAction: 'Load parents',
      parentsWorking: 'Loading parents…',
      parentsError: 'Unable to load parents.',
      parentsRemoved: 'Parent relation removed.',
      parentsRemoveAction: 'Remove',
      verifyTitle: 'Ledger verification',
      verifyAction: 'Check signatures',
      verifyWorking: 'Verifying ledger…',
      verifyError: 'Verification failed.',
      verifyHashOk: 'Hash chain OK',
      verifyHashIssue: 'Hash mismatch',
      verifySigOk: 'Signatures OK',
      verifySigIssue: 'Signature issue',
      verifyRoleSigned: 'Signed by role: {count}',
      relationNotesTitle: 'Relationship meaning',
      relationOwner: 'Owner — full control, can create/remove relations.',
      relationWrite: 'Write — can edit data, no membership control.',
      relationRead: 'Read — view only.',
      viewGraph: 'Graph',
      viewDetails: 'Details',
      cancelAction: 'Cancel',
      incomingTitle: 'Incoming',
      outgoingTitle: 'Outgoing',
      none: 'None'
    }
  },
  footer: {
    headline: 'REcreatio — shared ecosystem of trust and knowledge',
    contact: 'Contact: kontakt@recreatio.pl',
    imprint: 'Imprint & privacy',
    security: 'Security documentation'
  },
  loginCard: {
    title: 'REcreatio',
    contextDefault: 'Access via REcreatio'
  }
};
