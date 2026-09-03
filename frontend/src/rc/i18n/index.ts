/**
 * 0.4 / 15.13 — Oberflächentexte.
 *
 * Englisch ist die technische Basissprache und der Rückfallwert. Polnisch ist
 * die erste Nutzersprache, Deutsch die zweite. Im Code stehen KEINE polnischen
 * oder deutschen Zeichenketten.
 *
 * Die Auflage, die aus dem Polnischen folgt (15.13): Zeichenketten werden
 * NIEMALS zusammengesetzt. Kein `"Es gibt " + n + " neue Nachrichten"`. Jeder
 * Satz liegt vollständig vor, mit Platzhaltern und Pluralformen — Polnisch hat
 * drei, nicht zwei. Wer das erst später einführt, schreibt die halbe
 * Oberfläche noch einmal.
 */

export type RcLang = 'en' | 'pl' | 'de';

/** Eine Form je Kategorie. Welche Kategorien es gibt, sagt die Sprache. */
export interface RcPlural {
  readonly one: string;
  readonly few?: string;   // Polnisch: 2–4, 22–24, …
  readonly many?: string;  // Polnisch: 0, 5–21, …
  readonly other: string;
}

export interface RcCopy {
  readonly shell: {
    readonly title: string;
    readonly subtitle: string;
    readonly stage: string;
    readonly legacyHint: string;
    readonly openLegacy: string;
  };
  /**
   * Die Adresse und der Eintritt. `stray*` ist der Fall, in dem einer Adresse
   * der Teil vor dem Namen fehlt (`#/new/jan`) — sie wird nicht verschwiegen,
   * sondern erklärt, weil der Link sonst als kaputt gilt.
   */
  readonly route: {
    readonly strayHeading: string;
    readonly strayBody: string;
    readonly strayHome: string;
    readonly checking: string;
    readonly unreachable: string;
    readonly backToStart: string;
  };
  readonly selfTest: {
    readonly heading: string;
    readonly intro: string;
    readonly run: string;
    readonly running: string;
    readonly passed: RcPlural;
    readonly failed: RcPlural;
    readonly allGreen: string;
    readonly duration: string;
    readonly expected: string;
    readonly actual: string;
  };
  readonly unlock: {
    readonly heading: string;
    readonly body: string;
    readonly action: string;
    readonly whyHeading: string;
    readonly why: string;
  };
  readonly auth: {
    readonly heading: string;
    readonly username: string;
    readonly password: string;
    readonly signIn: string;
    readonly createAccount: string;
    readonly working: string;
    /** Während Argon2id läuft. Eine Sekunde ohne Rückmeldung sieht kaputt aus. */
    readonly deriving: string;
    readonly derivingWhy: string;
    /** Der Name der PERSON, die mit dem Konto entsteht — nicht der Anmeldename. */
    readonly personName: string;
    readonly personNameWhy: string;
    /** Der Rueckweg aus dem Anlegen ins Anmelden. */
    readonly haveAccount: string;
    /** „Angemeldet bleiben" — und was es wirklich bedeutet. */
    /** Der Schliessknopf der Anmeldeschublade. */
    readonly close: string;
    readonly keepSignedIn: string;
    readonly keepSignedInWhy: string;
    readonly signedInAs: string;
    readonly keysHeld: string;
    readonly keysMissing: string;
    readonly lock: string;
    readonly signOut: string;
    readonly signUpHint: string;
    readonly errors: Readonly<Record<string, string>>;
    readonly unknownError: string;
  };
  readonly chat: {
    readonly areas: string;
    readonly noAreas: string;
    readonly newArea: string;
    readonly areaName: string;
    readonly create: string;
    readonly writingAs: string;
    readonly placeholder: string;
    readonly send: string;
    readonly sending: string;
    readonly toRecord: string;
    readonly toRecordWhy: string;
    readonly recorded: string;
    readonly withdraw: string;
    readonly withdrawn: string;
    readonly epochBreak: string;
    readonly beforeYou: string;
    readonly damaged: string;
    readonly hiddenByModerator: string;
    readonly partialHistory: string;
    readonly readOnly: string;
    readonly locked: string;
    readonly members: RcPlural;
    readonly empty: string;
    readonly loading: string;
  };
  readonly threads: {
    readonly tabChat: string;
    readonly tabTopics: string;
    readonly tabPolls: string;

    readonly topics: string;
    readonly noTopics: string;
    readonly newTopic: string;
    readonly topicTitle: string;
    readonly topicFrom: RcPlural;
    readonly inTopic: RcPlural;
    readonly close: string;
    readonly reopen: string;
    readonly closed: string;
    readonly pickFirst: string;

    readonly polls: string;
    readonly noPolls: string;
    readonly newPoll: string;
    readonly question: string;
    readonly ask: string;
    readonly mode: string;
    readonly modeSingle: string;
    readonly modeMulti: string;
    readonly modeQuiz: string;
    readonly reveal: string;
    readonly revealImmediate: string;
    readonly revealOnClose: string;
    readonly revealWhy: string;
    readonly yourAnswer: string;
    readonly vote: string;
    readonly voted: string;
    readonly changeVote: string;
    readonly votes: RcPlural;
    readonly tallySealed: string;
    readonly closePoll: string;
    readonly pollClosed: string;

    readonly attach: string;
    readonly attachments: RcPlural;
    readonly open: string;
    readonly remove: string;
    readonly uploading: string;

    readonly react: string;
    readonly agree: string;
    readonly noted: string;
    readonly object: string;
    readonly reactWhy: string;
  };
  readonly ledger: {
    readonly tabLedger: string;
    readonly tabDecisions: string;

    readonly heading: string;
    readonly intro: string;
    readonly check: string;
    readonly checking: string;
    readonly intact: string;
    readonly intactWhy: string;
    readonly broken: string;
    readonly brokenAt: string;
    readonly disagree: string;
    readonly disagreeWhy: string;
    readonly limits: string;
    readonly entries: RcPlural;
    readonly head: string;
    readonly sequence: string;
    readonly previous: string;
    readonly hash: string;
    readonly module: string;
    readonly when: string;
    readonly payload: string;
    readonly reasons: Readonly<Record<string, string>>;
    readonly empty: string;

    readonly decisions: string;
    readonly noDecisions: string;
    readonly newDecision: string;
    readonly decisionBody: string;
    readonly propose: string;
    readonly reason: string;
    readonly reasonWhy: string;
    readonly move: string;
    readonly history: string;
    readonly finalState: string;
    readonly states: Readonly<Record<string, string>>;
  };
  readonly invite: {
    readonly tabMembers: string;

    readonly members: string;
    readonly noMembers: string;
    readonly capability: string;
    readonly caps: Readonly<Record<string, string>>;
    readonly remove: string;
    readonly removeWhy: string;
    readonly epochGrants: RcPlural;

    readonly invitations: string;
    readonly noInvitations: string;
    readonly create: string;
    readonly label: string;
    readonly labelHint: string;
    readonly daysValid: string;
    readonly maxUses: string;
    readonly unlimited: string;
    readonly forSms: string;
    readonly forSmsWhy: string;
    readonly personalWarning: string;
    readonly newGroup: string;
    readonly groupName: string;
    readonly issue: string;
    readonly issuing: string;

    readonly linkReady: string;
    readonly linkOnce: string;
    readonly copy: string;
    readonly copied: string;
    readonly done: string;
    readonly expires: string;
    readonly used: string;
    readonly spent: string;
    readonly opened: string;
    readonly openedWhy: string;
    readonly revoke: string;

    readonly grantHistory: string;
    readonly grantHistoryWhy: string;

    readonly youWereInvited: string;
    readonly leadsTo: string;
    readonly needAccount: string;
    readonly accept: string;
    readonly accepting: string;
    readonly accepted: string;
    readonly alreadyIn: string;
    readonly invalid: string;
    readonly dismiss: string;
  };
  readonly events: {
    readonly heading: string;
    readonly none: string;
    readonly create: string;
    readonly eventTitle: string;
    readonly address: string;
    readonly addressHint: string;
    readonly make: string;
    readonly states: Readonly<Record<string, string>>;
    readonly publish: string;
    readonly archive: string;
    readonly draftWarning: string;

    readonly pages: RcPlural;
    readonly newPage: string;
    readonly pageTitle: string;
    readonly addPart: string;
    readonly partKinds: Readonly<Record<string, string>>;
    readonly visibility: string;
    readonly isPublic: string;
    readonly isInternal: string;
    readonly publicWhy: string;
    readonly internalWhy: string;
    readonly sealedHere: string;
    readonly onlyPublic: string;

    readonly register: string;
    readonly registering: string;
    readonly registered: string;
    readonly keepClaim: string;
    readonly claimWhy: string;
    readonly notYet: string;
    readonly missing: string;
    readonly registrations: RcPlural;
    readonly withdrawn: string;
    readonly withdraw: string;
    readonly classes: Readonly<Record<string, string>>;
    readonly sealedFor: string;
  };
  readonly parish: {
    readonly heading: string;
    readonly none: string;
    readonly create: string;
    readonly name: string;
    readonly location: string;
    readonly make: string;

    /** Der Name in der Adresse — und was gilt, wenn er nicht vorgesehen ist. */
    readonly slug: string;
    /**
     * Der Name des Amtes, das mit der Pfarrei entsteht.
     *
     * Es traegt den Namen der Pfarrei, weil ein Konto mehrere verwalten kann
     * und „Administrator" allein dann viermal untereinander staende.
     */
    readonly officeName: string;
    /** Das Amt einer Pfarrei: vorhanden, fehlend, nachholen. */
    readonly officeIs: string;
    readonly officeMissing: string;
    readonly officeAdd: string;
    readonly slugUnknown: string;
    readonly slugAvailable: string;
    readonly slugShape: string;
    /** Der zweistufige Weg: erst wer sie ist, dann wie ihre Seite aussieht. */
    /** Wer die Pfarrei verwaltet — mit Namen, nicht nur „jemand". */
    readonly adminIs: string;
    readonly stepOne: string;
    readonly stepTwo: string;
    readonly nameLead: string;
    readonly lookTitle: string;
    readonly lookLead: string;
    readonly finish: string;
    readonly later: string;

    readonly theme: string;
    readonly themes: Readonly<Record<string, string>>;
    readonly modules: string;
    readonly modulesLead: string;
    readonly moduleNames: Readonly<Record<string, string>>;



    readonly plan: string;
    readonly noMasses: string;
    readonly addMass: string;
    readonly church: string;
    readonly when: string;
    readonly massTitle: string;
    readonly duration: string;
    readonly collective: string;
    readonly collectiveWhy: string;

    readonly intentions: RcPlural;
    readonly addIntention: string;
    readonly publicText: string;
    readonly publicWhy: string;
    readonly internalText: string;
    readonly internalWhy: string;
    readonly donor: string;
    readonly forMass: string;
    readonly unassigned: string;
    readonly sealedPart: string;

    readonly offerings: string;
    readonly addOffering: string;
    readonly amount: string;
    readonly amountWhy: string;
    readonly currency: string;
    readonly received: string;
    readonly booked: string;
  };
  readonly graph: {
    readonly heading: string;
    readonly none: string;
    readonly create: string;
    readonly title: string;
    readonly public: string;
    readonly publicWhy: string;
    readonly privateWhy: string;
    readonly locked: string;
    readonly make: string;

    readonly nodes: RcPlural;
    readonly edges: RcPlural;
    readonly addNode: string;
    readonly kind: string;
    readonly value: string;
    readonly ofKind: string;
    readonly needsKind: string;
    readonly emptyNode: string;
    readonly unreadable: string;

    readonly addEdge: string;
    readonly from: string;
    readonly to: string;
    readonly relation: string;
    readonly state: string;
    readonly states: Readonly<Record<string, string>>;
    readonly stateWhy: string;
    readonly note: string;

    readonly search: string;
    readonly searchHint: string;
    readonly foundServer: string;
    readonly foundBrowser: string;
    readonly browserWhy: string;
    readonly nothing: string;
    readonly kinds: Readonly<Record<string, string>>;
  };
  readonly cal: {
    readonly heading: string;
    readonly none: string;
    readonly create: string;
    readonly title: string;
    readonly zone: string;
    readonly zoneWhy: string;
    readonly make: string;

    readonly nothing: string;
    readonly busy: string;
    readonly sealedItem: string;
    readonly moved: string;
    readonly clashes: RcPlural;
    readonly clashWhy: string;

    readonly add: string;
    readonly when: string;
    readonly until: string;
    readonly allDay: string;
    readonly publicTitle: string;
    readonly publicWhy: string;
    readonly privateTitle: string;
    readonly privateWhy: string;
    readonly where: string;
    readonly notes: string;
    readonly visibility: string;
    readonly visibilities: Readonly<Record<string, string>>;
    readonly repeat: string;
    readonly repeats: Readonly<Record<string, string>>;
    readonly every: string;
    readonly times: string;
    readonly repeatWhy: string;
    readonly weekdays: readonly string[];

    readonly cancelOne: string;
    readonly moveOne: string;
    readonly seriesKept: string;
  };
  readonly conf: {
    readonly heading: string;
    readonly none: string;
    readonly create: string;
    readonly name: string;
    readonly ownArea: string;
    readonly ownAreaWhy: string;
    readonly make: string;

    readonly candidates: RcPlural;
    readonly outstanding: RcPlural;
    readonly outstandingWhy: string;
    readonly noCandidates: string;
    readonly add: string;
    readonly born: string;
    readonly contact: string;
    readonly school: string;
    readonly baptism: string;
    readonly sealedWhy: string;
    readonly sealedCandidate: string;
    readonly withdrawn: string;
    readonly withdraw: string;
    readonly withdrawWhy: string;

    readonly steps: Readonly<Record<string, string>>;
    readonly stepsDone: string;

    readonly notes: RcPlural;
    readonly addNote: string;
    readonly noteText: string;
    readonly forFamily: string;
    readonly forFamilyWhy: string;
    readonly internalOnly: string;

    readonly slots: string;
    readonly noSlots: string;
    readonly addSlot: string;
    readonly when: string;
    readonly capacity: string;
    readonly label: string;
    readonly free: RcPlural;
    readonly full: string;
    readonly book: string;
    readonly booked: string;
    readonly pick: string;
  };
  /** Die Übersicht über das eigene Konto: Rollen, Kanten, Personen. */
  readonly account: {
    readonly heading: string;
    readonly lead: string;
    readonly locked: string;
    readonly loading: string;
    readonly accountNode: string;
    /** Die Beschriftung eines Bereichskastens in der Zeichnung. */
    readonly areaNode: string;
    readonly accountYou: string;
    readonly unnamed: string;
    readonly noKey: string;
    readonly personsHeading: string;
    /** Die Liste unter der Zeichnung: Personen UND Aemter. */
    readonly rolesHeading: string;
    readonly noPersons: string;
    readonly signInFirst: string;
    readonly signInDo: string;
  };

  /** Die Vokabeln des Rollengraphen: Arten und Kantenarten. */
  readonly roles: {
    readonly kinds: {
      readonly person: string;
      readonly group: string;
      readonly office: string;
      readonly service: string;
    };
    readonly relations: {
      readonly holds: string;
      readonly inherits: string;
      readonly supervises: string;
    };

    /** Das Umbenennen einer Rolle — samt Titel davor. */
    readonly rename: string;
    readonly titles: string;
    readonly noTitles: string;
    readonly titleHint: string;
    readonly addTitle: string;
    readonly removeTitle: string;
    readonly moveLeft: string;
    readonly moveRight: string;
    readonly alias: string;
    readonly preview: string;
    readonly save: string;
    readonly cancel: string;
    readonly renameWarns: string;
  };

  /** Der Steckbrief einer Person — jede Angabe einzeln. */
  readonly person: {
    readonly heading: string;
    readonly lead: string;
    readonly locked: string;
    readonly loading: string;
    readonly unnamed: string;
    readonly noRole: string;
    readonly toAccount: string;
    readonly fields: {
      readonly PersonGivenName: string;
      readonly PersonSurname: string;
      readonly PersonPhone: string;
      readonly PersonBorn: string;
    };
    /** Die leere Zeile unter einem Feld, das sich wiederholen darf. */
    readonly addAnother: string;
    readonly add: string;
    readonly change: string;
    readonly save: string;
    readonly cancel: string;
    readonly sealed: string;
    readonly share: string;
    readonly shareWhat: string;
    readonly shareTo: string;
    readonly shareToHint: string;
    readonly shareDo: string;
    readonly destroy: string;
    readonly destroyReason: string;
    readonly showLog: string;
    readonly logHeading: string;
    readonly logEmpty: string;
    readonly logHide: string;
    readonly logNote: string;
  };

  readonly status: {
    readonly heading: string;
    readonly done: string;
    readonly building: string;
    readonly planned: string;
  };
  readonly lang: Record<RcLang, string>;
}

const en: RcCopy = {
  shell: {
    title: 'REcreatio',
    subtitle: 'The rebuilt platform. Encrypted by construction, provable by chain.',
    stage: 'Phase 0 — foundation',
    legacyHint: 'The current platform keeps running unchanged alongside this.',
    openLegacy: 'Open the current platform'
  },
  route: {
    strayHeading: 'This address is missing its part',
    strayBody:
      'Nothing here is called “{word}” on its own. Every address names the part first, then the thing: {example}. The link you followed left the part out.',
    strayHome: 'Go to the start page',
    checking: 'Checking…',
    unreachable: 'The service did not answer. That is not the same as being signed out — nothing was changed.',
    backToStart: 'All parts'
  },
  selfTest: {
    heading: 'Cryptographic self-check',
    intro:
      'The same test vectors the server recomputes. Client and server must agree bit for bit; if they drift apart, data is written that nobody can open again.',
    run: 'Run the check',
    running: 'Checking…',
    passed: { one: '{n} check passed', other: '{n} checks passed' },
    failed: { one: '{n} check failed', other: '{n} checks failed' },
    allGreen: 'This browser computes exactly what the server computes.',
    duration: 'in {ms} ms',
    expected: 'expected',
    actual: 'computed'
  },
  unlock: {
    heading: 'Unlock needed',
    body: 'Your key is not in memory. Nothing can be read without it — not by you, and not by the operator.',
    action: 'Unlock',
    whyHeading: 'Why this appears',
    why:
      'The server keeps your key bundle encrypted and never holds the piece that opens it. That piece travels with your request, from this browser.'
  },
  auth: {
    heading: 'Sign in',
    username: 'Username',
    password: 'Password',
    signIn: 'Sign in',
    createAccount: 'Create an account',
    working: 'Working…',
    deriving: 'Deriving your key…',
    derivingWhy:
      'This takes about a second on purpose. Anyone guessing your password pays the same second, every guess.',
    personName: "Your name",
    personNameWhy: "This is the name you appear under — on a parish page, in a calendar, next to anything you administer. It is not the name you sign in with, and you can change it later.",
    haveAccount: "I already have an account",
    close: "Close",
    keepSignedIn: "Stay signed in",
    keepSignedInWhy: "On this device, for 30 days. Anyone who can use this browser can then open your account without the password. Leave it off on a shared computer.",
    signedInAs: 'Signed in as {name}',
    keysHeld: 'Your key bundle is ready.',
    keysMissing: 'Locked — your key bundle is not in memory.',
    lock: 'Lock',
    signOut: 'Sign out',
    signUpHint:
      'Anyone can sign up. An account gets you your own space — nothing more. Closed areas are reached through an invitation link, which you connect to your account once you are signed in.',
    errors: {
      'auth.credentials_invalid': 'That username and password do not match.',
      'auth.rate_limited': 'Too many attempts. Please wait a while.',
      'auth.account_disabled': 'This account has been closed.',
      'auth.username_taken': 'That username is taken.',
      'auth.password_weak': 'That password cannot be used.',
      'auth.token_invalid': 'That link is no longer valid. Ask for a new one.',
      'permission.denied': 'You are not allowed to do that here.',
      'parish.slug_not_allowed':
        'That address is not on the list of parishes and cannot be created. Addresses '
        + 'are settled in advance, because they are given out and printed.',
      'role.cycle': 'That would make two roles unlock each other.',
      'role.unreachable': 'That role is not available to you.',
      'session.revoked': 'That session has ended. Please sign in again.',
      'session.expired': 'That session has expired. Please sign in again.',
      'session.unlock_required': 'Your key is not in memory. Please unlock.'
    },
    unknownError: 'Something went wrong. Please try again.'
  },
  chat: {
    areas: 'Areas',
    noAreas: 'No areas yet. Create one, or wait for an invitation.',
    newArea: 'New area',
    areaName: 'What is this area for?',
    create: 'Create',
    writingAs: 'Writing as',
    placeholder: 'Say something…',
    send: 'Send',
    sending: 'Sending…',
    toRecord: 'On the record',
    toRecordWhy:
      'Adds this post to the chain, so its order and authorship can be proven later. Not every message needs this — a chain full of small talk proves nothing.',
    recorded: 'on the record',
    withdraw: 'Withdraw',
    withdrawn: 'Withdrawn by its author.',
    epochBreak: 'From here on you were part of this area.',
    beforeYou: 'From before you joined. Nobody can open this for you.',
    damaged: 'This did not open, and it should have. Nothing has been lost — but please report it.',
    hiddenByModerator: 'Hidden by a moderator.',
    partialHistory: 'part of this history is closed to you',
    readOnly: 'You can read here, but not write.',
    locked: 'Unlock to read this area.',
    members: { one: '{n} member', other: '{n} members' },
    empty: 'Nothing said here yet.',
    loading: 'Loading…'
  },
  threads: {
    tabChat: 'Conversation',
    tabTopics: 'Topics',
    tabPolls: 'Questions',

    topics: 'Topics',
    noTopics: 'No topics yet. Select messages that belong together and name them.',
    newTopic: 'New topic',
    topicTitle: 'What holds these together?',
    topicFrom: { one: 'from {n} selected message', other: 'from {n} selected messages' },
    inTopic: { one: '{n} message', other: '{n} messages' },
    close: 'Close',
    reopen: 'Reopen',
    closed: 'closed',
    pickFirst: 'Select messages in the conversation first.',

    polls: 'Questions',
    noPolls: 'Nothing has been asked here yet.',
    newPoll: 'Ask something',
    question: 'Your question',
    ask: 'Ask',
    mode: 'Answers',
    modeSingle: 'One each',
    modeMulti: 'Several each',
    modeQuiz: 'One right answer',
    reveal: 'Show the count',
    revealImmediate: 'Straight away',
    revealOnClose: 'Only once closed',
    revealWhy:
      'Whoever answers tenth sees nine answers and follows them. Hiding the count until the end is how you find out what people think, rather than what they think others think.',
    yourAnswer: 'Your answer',
    vote: 'Answer',
    voted: 'You answered',
    changeVote: 'Change your answer',
    votes: { one: '{n} answer', other: '{n} answers' },
    tallySealed: 'The count stays hidden until this closes. That was the point of asking this way.',
    closePoll: 'Close and show the count',
    pollClosed: 'Closed',

    attach: 'Attach a file',
    attachments: { one: '{n} file', other: '{n} files' },
    open: 'Open',
    remove: 'Remove',
    uploading: 'Uploading…',

    react: 'Say where you stand',
    agree: 'I agree',
    noted: 'I have read it',
    object: 'I object',
    reactWhy:
      'One of three, and only one. “I have read it” and “I agree” are not the same thing, and in a meeting that difference is the whole point.'
  },
  ledger: {
    tabLedger: 'Record',
    tabDecisions: 'Decisions',

    heading: 'The chain',
    intro:
      'Every decision is written into a chain, each link naming the hash of the one before it. Remove a line, reorder two, insert one later — the chain stops adding up, and it says where.',
    check: 'Recompute it here',
    checking: 'Recomputing…',
    intact: 'The chain adds up.',
    intactWhy:
      'Recomputed in this browser, from the entries as delivered — not taken from the server’s word for it. The operator saying “I checked, it’s fine” is the one claim a record like this exists to do without.',
    broken: 'The chain does not add up.',
    brokenAt: 'It first breaks at entry {n}.',
    disagree: 'The server says something different about its own chain.',
    disagreeWhy:
      'This is the finding, not a detail: what the service claims about its record does not follow from the entries it handed over. Keep this page and say so.',
    limits:
      'What this checks: that the links join up and no number is missing. What it does not check: whether each entry’s content matches its own hash — that needs the canonical bytes, which arrive here already assembled.',
    entries: { one: '{n} entry', other: '{n} entries' },
    head: 'Head',
    sequence: 'No.',
    previous: 'follows',
    hash: 'hash',
    module: 'from',
    when: 'recorded',
    payload: 'what was written',
    reasons: {
      'chain.gap': 'A number is missing — something was taken out.',
      'chain.broken_link': 'An entry does not follow the one before it.'
    },
    empty: 'Nothing has been written to the chain here yet.',

    decisions: 'Decisions',
    noDecisions: 'Nothing has been decided here yet.',
    newDecision: 'Propose something',
    decisionBody: 'What is being decided?',
    propose: 'Propose',
    reason: 'Why',
    reasonWhy:
      'Required, and not as a formality. A decision without a reason cannot be understood a year from now — and then it stands there as a resolution nobody can explain.',
    move: 'Move to {state}',
    history: 'How it got here',
    finalState: 'Nothing follows from here.',
    states: {
      proposed: 'proposed',
      open: 'under discussion',
      accepted: 'accepted',
      rejected: 'rejected',
      reopened: 'reopened'
    }
  },
  invite: {
    tabMembers: 'People',

    members: 'Who is here',
    noMembers: 'Nobody else is in this area yet.',
    capability: 'may',
    caps: { read: 'read', write: 'write', admin: 'administer', certify: 'invite others' },
    remove: 'Remove',
    removeWhy:
      'From then on they cannot read what is written. What was said before they left stays readable to them — locking that away would mean re-encrypting everything, and the old copy would still be out in the world.',
    epochGrants: { one: 'holds {n} key', other: 'holds {n} keys' },

    invitations: 'Invitations',
    noInvitations: 'No invitations outstanding.',
    create: 'Invite someone',
    label: 'What is this for',
    labelHint: 'Only you see this. It tells the invitations apart later.',
    daysValid: 'Valid for (days)',
    maxUses: 'Times it can be used',
    unlimited: 'no limit',
    forSms: 'Going out by text message',
    forSmsWhy:
      'Text messages arrive late, get forwarded, and sit in inboxes. A link sent that way is given at least a week, and its first opening is recorded.',
    personalWarning:
      'This is your personal role. Sharing it hands over everything attached to it — every area, every key, the whole history. Make a group for this instead and invite people to that.',
    newGroup: 'Make a group',
    groupName: 'What is the group called?',
    issue: 'Create the link',
    issuing: 'Creating…',

    linkReady: 'Here is the link.',
    linkOnce:
      'This is the only time it can be shown. The key travels inside the link, not in the database — so nobody, including whoever runs this service, can produce it again. Lose it and you issue a new one.',
    copy: 'Copy',
    copied: 'Copied',
    done: 'I have it',
    expires: 'until {when}',
    used: 'used {n}×',
    spent: 'no longer usable',
    opened: 'opened {when}',
    openedWhy:
      'If this was opened before it reached the person you sent it to, somebody read it on the way.',
    revoke: 'Revoke',

    grantHistory: 'Also give access to everything said before',
    grantHistoryWhy:
      'Off by default, and deliberately so: whoever joins today was not here yesterday. Handing over the past cannot be undone — keys given out are given out.',

    youWereInvited: 'You have been invited.',
    leadsTo: 'This link leads to: {label}',
    needAccount: 'Sign in first, then this link can be joined to your account.',
    accept: 'Join it to my account',
    accepting: 'Joining…',
    accepted: 'Done — you are in.',
    alreadyIn: 'You were already in. Nothing to do.',
    invalid: 'This link is no longer valid. Ask for a new one.',
    dismiss: 'Close'
  },
  events: {
    heading: 'Events',
    none: 'No events yet. An event hangs on an area — make one there.',
    create: 'New event',
    eventTitle: 'What is it called?',
    address: 'Address',
    addressHint: 'This is what goes in the link. Letters, digits and dashes.',
    make: 'Create',
    states: { draft: 'draft', published: 'published', archived: 'archived' },
    publish: 'Publish',
    archive: 'Archive',
    draftWarning: 'A draft is not public. Nobody outside can reach it, and it takes no sign-ups.',

    pages: { one: '{n} page', other: '{n} pages' },
    newPage: 'Add a page',
    pageTitle: 'What is on it?',
    addPart: 'Add a section',
    partKinds: {
      title: 'Title', shortinfos: 'Facts at a glance', text: 'Text', plan: 'Schedule',
      map: 'Map', faq: 'Questions', form: 'Sign-up form', costs: 'Costs',
      contact: 'Contact', gallery: 'Pictures', files: 'Files', people: 'People'
    },
    visibility: 'Who sees this',
    isPublic: 'Everyone',
    isInternal: 'Only the people preparing this',
    publicWhy:
      'Public means readable by anyone with the link, and it is stored as plain text. Encrypting something and handing out the key would only look like protection.',
    internalWhy:
      'Sealed under this area\u2019s key. Whoever joins later will not see it — same rule as for messages, and for the same reason.',
    sealedHere: 'Sealed. You joined after this was written.',
    onlyPublic: 'You are seeing the public part. There may be more.',

    register: 'Sign up',
    registering: 'Sending…',
    registered: 'Thank you — you are signed up.',
    keepClaim: 'Keep this. It is your receipt.',
    claimWhy:
      'It is the only way to withdraw your sign-up later. It is shown once and stored only as a fingerprint — nobody can produce it again, not even whoever runs this service.',
    notYet: 'This event is not taking sign-ups yet.',
    missing: 'Still missing: {what}',
    registrations: { one: '{n} sign-up', other: '{n} sign-ups' },
    withdrawn: 'withdrawn',
    withdraw: 'Withdraw',
    classes: {
      normal: 'ordinary', sensitive: 'sensitive',
      special: 'special category', secret: 'secret'
    },
    sealedFor: 'From before you joined — nobody can open this for you.'
  },
  parish: {
    heading: 'Parish',
    none: "No parish yet.",
    create: 'New parish',
    name: 'Name',
    location: 'Where',
    make: 'Create',

    slug: 'Address name',
    officeName: "{name} — administrator",
    officeIs: "Administered by {name}",
    officeMissing: "This parish has no office. It hangs on the person who created it, and can only be handed on by handing on the account.",
    officeAdd: "Create the office",
    slugUnknown:
      'This address is not on the list and cannot be created. Addresses are settled in '
      + 'advance, because they are given out and printed — a parish cannot be renamed '
      + 'without breaking every link to it.',
    slugAvailable: 'Available',
    slugShape: 'Lowercase letters, digits and hyphens between them.',

    adminIs: "{name} will administer this parish.",
    stepOne: "Step 1 of 2",
    stepTwo: "Step 2 of 2",
    nameLead: "The name can be changed later. The address cannot — it gets handed out, printed and linked to.",
    lookTitle: "How the page looks",
    lookLead: "All of this can be changed at any time.",
    finish: "Save and finish",
    later: "Decide later",

    theme: "Colour",
    themes: {"classic":"Classic","warm":"Warm","stone":"Stone","night":"Night"},
    modules: "Blocks on the front page",
    modulesLead: "Pick what belongs there. The order follows the order you pick.",
    moduleNames: {"masses":"Mass times","announcements":"Announcements","intentions":"Intentions","calendar":"Calendar","news":"News","groups":"Groups","events":"Events","sacraments":"Sacraments","hours":"Office hours","contact":"Contact","gallery":"Gallery","sticky":"Notice"},

    plan: 'Mass schedule',
    noMasses: 'Nothing scheduled.',
    addMass: 'Add a mass',
    church: 'Church',
    when: 'When',
    massTitle: 'What kind',
    duration: 'Minutes',
    collective: 'Several intentions at once',
    collectiveWhy:
      'A collective mass carries several intentions on one date. The difference is not cosmetic: with a single mass the intention belongs to it, with a collective one several share the slot.',

    intentions: { one: '{n} intention', other: '{n} intentions' },
    addIntention: 'Add an intention',
    publicText: 'What goes on the noticeboard',
    publicWhy:
      'This is read aloud and printed. It is stored as plain text, because it is public — encrypting it and handing out the key would only look like protection.',
    internalText: 'What is actually meant',
    internalWhy:
      'Sealed under this area\u2019s key. Nobody outside the parish can read it — not even whoever runs this service.',
    donor: 'Who gave it',
    forMass: 'For which mass',
    unassigned: 'no date yet',
    sealedPart: 'There is a note here you cannot open.',

    offerings: 'Offerings',
    addOffering: 'Record an offering',
    amount: 'Amount',
    amountWhy:
      'Kept sealed, always. That means no total can be computed in the database — whoever needs one fetches the rows and adds them up with the key in hand.',
    currency: 'Currency',
    received: 'Received',
    booked: 'Recorded'
  },
  graph: {
    heading: 'Knowledge',
    none: 'No library yet. A library hangs on an area — make one there.',
    create: 'New library',
    title: 'Title',
    public: 'Open library',
    publicWhy:
      'Contents are stored as plain text and the server can search them. Right for vocabulary, periodic tables, timelines — knowledge that is in every textbook anyway.',
    privateWhy:
      'Contents are sealed. The server sees ciphertext and cannot search it — this browser searches instead, through what it has already loaded. That scales worse. It is the price for the operator not being able to read your notes.',
    locked: 'This choice is made once and cannot be changed later.',
    make: 'Create',

    nodes: { one: '{n} node', other: '{n} nodes' },
    edges: { one: '{n} edge', other: '{n} edges' },
    addNode: 'Add a node',
    kind: 'Kind',
    value: 'Value',
    ofKind: 'Of kind',
    needsKind: 'An entity needs the kind that describes it.',
    emptyNode: 'Nothing filled in yet',
    unreadable: 'You cannot open this one.',

    addEdge: 'Connect two nodes',
    from: 'From',
    to: 'To',
    relation: 'Relation',
    state: 'How sure',
    states: {
      known: 'known',
      approximate: 'approximately',
      disputed: 'disputed',
      unknown: 'not known',
      not_applicable: 'does not apply',
      pending: 'still open'
    },
    stateWhy:
      '“Not known” is a statement, not a missing value. Saying it is different from saying nothing — that difference is what this model is for.',
    note: 'Note',

    search: 'Search',
    searchHint: 'Type to search this library.',
    foundServer: 'Searched on the server.',
    foundBrowser: 'Searched here in your browser.',
    browserWhy:
      'The contents are sealed, so the server cannot search them. This searches what is loaded — which is not necessarily everything.',
    nothing: 'Nothing matched.',
    kinds: {
      text: 'text', number: 'number', date: 'date', boolean: 'yes/no', media: 'file',
      entity: 'entity', entity_kind: 'kind of entity', edge_kind: 'kind of relation',
      range: 'range', knowledge: 'knowledge', topic: 'topic', question: 'question'
    }
  },
  cal: {
    heading: 'Calendar',
    none: 'No calendar yet. A calendar hangs on an area — make one there.',
    create: 'New calendar',
    title: 'Title',
    zone: 'Time zone',
    zoneWhy:
      'Repeats are computed in this zone. “Every Monday at nine” stays at nine across the clock change — in UTC it would not.',
    make: 'Create',

    nothing: 'Nothing in this period.',
    busy: 'Busy',
    sealedItem: 'Something is here that you cannot open.',
    moved: 'moved',
    clashes: { one: '{n} clash', other: '{n} clashes' },
    clashWhy:
      'Two appointments overlap. This can be checked because the times are stored in the clear — that is what pays for it.',

    add: 'Add an entry',
    when: 'From',
    until: 'Until',
    allDay: 'All day',
    publicTitle: 'What others see',
    publicWhy:
      'Stored in the clear. Leave it empty and others only see “busy” — which is often the right answer.',
    privateTitle: 'What it actually is',
    privateWhy:
      'Sealed under this area’s key. Nobody outside can read it — not even whoever runs this service.',
    where: 'Where',
    notes: 'Notes',
    visibility: 'Who sees it',
    visibilities: { private: 'only me', area: 'the area', public: 'anyone' },
    repeat: 'Repeats',
    repeats: { none: 'once', daily: 'daily', weekly: 'weekly', monthly: 'monthly', yearly: 'yearly' },
    every: 'every',
    times: 'times',
    repeatWhy:
      'A repeat needs an end — a count. Without one it cannot be computed, only cut off, and every view cuts somewhere else.',
    weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],

    cancelOne: 'Cancel this one',
    moveOne: 'Move this one',
    seriesKept:
      'The series stays a rule. Cancelling one date writes an exception — it does not turn “every Monday” into fifty separate entries.'
  },
  conf: {
    heading: 'Confirmation',
    none: 'No year group yet.',
    create: 'New year group',
    name: 'Name',
    ownArea: 'Area for the records',
    ownAreaWhy:
      'A separate area, not the parish one. Whoever maintains the mass schedule should not thereby reach the children’s records — that is what an area is for.',
    make: 'Create',

    candidates: { one: '{n} candidate', other: '{n} candidates' },
    outstanding: { one: '{n} still owes something', other: '{n} still owe something' },
    outstandingWhy:
      'Counted from the process markers, without opening a single record. That is why those markers are kept in the clear — they say nothing about the person.',
    noCandidates: 'Nobody enrolled yet.',
    add: 'Enrol someone',
    born: 'Born',
    contact: 'Contact (parents)',
    school: 'School',
    baptism: 'Baptised at',
    sealedWhy:
      'All of this is sealed under this area’s key. Nobody outside can read it — not even whoever runs this service.',
    sealedCandidate: 'Someone is here that you cannot open.',
    withdrawn: 'withdrawn',
    withdraw: 'Withdraw',
    withdrawWhy:
      'The fields are destroyed, the row stays. “Was it forty or forty-one” is exactly what a list like this has to answer.',

    steps: { consent: 'consent', paper: 'paper', quiz: 'quiz' },
    stepsDone: 'everything in',

    notes: { one: '{n} note', other: '{n} notes' },
    addNote: 'Add a note',
    noteText: 'Note',
    forFamily: 'The family may read this',
    forFamilyWhy:
      'Both kinds are sealed. This one is not public — it is only visible to a wider circle. A child has no “public”.',
    internalOnly: 'internal',

    slots: 'Meetings',
    noSlots: 'Nothing scheduled.',
    addSlot: 'Schedule a meeting',
    when: 'When',
    capacity: 'Seats',
    label: 'What for',
    free: { one: '{n} seat free', other: '{n} seats free' },
    full: 'full',
    book: 'Book a seat',
    booked: 'booked',
    pick: 'Who for'
  },
  account: {
    heading: "Your account",
    lead: "This account reaches {roles} roles. The drawing shows what hangs on what — a role is reachable because of the path, not on its own.",
    locked: "Unlock your keys to see your roles.",
    loading: "Reading the graph…",
    areaNode: "Area",
    accountNode: "Account",
    accountYou: "You",
    unnamed: "Unnamed",
    noKey: "no key",
    rolesHeading: "Roles you hold",
    personsHeading: "People",
    noPersons: "No person on this account yet.",
    signInFirst: "The tools need an account. Nothing below opens without one.",
    signInDo: "Sign in",
  },
  roles: {
    kinds: {
      person: "Person",
      group: "Group",
      office: "Office",
      service: "Service",
    },
    relations: {
      holds: "holds",
      inherits: "inherits from",
      supervises: "supervises",
    },
    rename: "Rename",
    titles: "Titles",
    noTitles: "none yet",
    titleHint: "e.g. ks., dr",
    addTitle: "Add",
    removeTitle: "Remove this title",
    moveLeft: "Move left",
    moveRight: "Move right",
    alias: "Name",
    preview: "Will read:",
    save: "Save",
    cancel: "Cancel",
    renameWarns: "The name lives on the role, not in a copy inside everything it ever wrote. Changing it changes it everywhere, over old entries too.",
  },
  person: {
    heading: "Person",
    lead: "Each entry is encrypted on its own and can be shared on its own. Sharing a phone number shares the phone number — nothing beside it.",
    locked: "Unlock your keys to see these entries.",
    loading: "Opening the entries…",
    unnamed: "Unnamed",
    noRole: "This address names no person.",
    toAccount: "To your account",
    fields: {
      PersonGivenName: "First name",
      PersonSurname: "Surname",
      PersonPhone: "Phone",
      PersonBorn: "Date of birth",
    },
    addAnother: "Another number",
    add: "Add",
    change: "Change",
    save: "Save",
    cancel: "Cancel",
    sealed: "Stored, but not yours to read.",
    share: "Share",
    shareWhat: "The other role gets the key to this one entry. Not to the others, and not to the person.",
    shareTo: "Role",
    shareToHint: "Role id",
    shareDo: "Give the key",
    destroy: "Destroy",
    destroyReason: "Removed by the owner",
    showLog: "Who read this",
    logHeading: "Reads",
    logEmpty: "Not read yet.",
    logHide: "Hide",
    logNote: "Every read of these entries is recorded — including your own. A log that skips the common case answers nothing later.",
  },
  status: {
    heading: 'What stands so far',
    done: 'built and verified',
    building: 'under construction',
    planned: 'planned'
  },
  lang: { en: 'English', pl: 'Polski', de: 'Deutsch' }
};

const pl: RcCopy = {
  shell: {
    title: 'REcreatio',
    subtitle: 'Platforma zbudowana od nowa. Szyfrowana z założenia, dowodliwa przez łańcuch.',
    stage: 'Faza 0 — fundament',
    legacyHint: 'Obecna platforma działa dalej bez zmian, obok tej.',
    openLegacy: 'Otwórz obecną platformę'
  },
  route: {
    strayHeading: 'Temu adresowi brakuje części',
    strayBody:
      'Nic tutaj nie nazywa się samo „{word}”. Każdy adres podaje najpierw część, potem rzecz: {example}. W linku, którym przyszedłeś, części zabrakło.',
    strayHome: 'Przejdź na stronę główną',
    checking: 'Sprawdzanie…',
    unreachable: 'Usługa nie odpowiedziała. To co innego niż wylogowanie — nic nie zostało zmienione.',
    backToStart: 'Wszystkie części'
  },
  selfTest: {
    heading: 'Sprawdzenie kryptografii',
    intro:
      'Te same wektory testowe, które przelicza serwer. Klient i serwer muszą zgadzać się co do bitu; jeśli się rozejdą, powstaną dane, których nikt już nie otworzy.',
    run: 'Uruchom sprawdzenie',
    running: 'Sprawdzanie…',
    passed: {
      one: '{n} sprawdzenie zaliczone',
      few: '{n} sprawdzenia zaliczone',
      many: '{n} sprawdzeń zaliczonych',
      other: '{n} sprawdzeń zaliczonych'
    },
    failed: {
      one: '{n} sprawdzenie nieudane',
      few: '{n} sprawdzenia nieudane',
      many: '{n} sprawdzeń nieudanych',
      other: '{n} sprawdzeń nieudanych'
    },
    allGreen: 'Ta przeglądarka liczy dokładnie to samo, co serwer.',
    duration: 'w {ms} ms',
    expected: 'oczekiwano',
    actual: 'obliczono'
  },
  unlock: {
    heading: 'Potrzebne odblokowanie',
    body: 'Twojego klucza nie ma w pamięci. Bez niego nic nie da się odczytać — ani Tobie, ani operatorowi.',
    action: 'Odblokuj',
    whyHeading: 'Dlaczego to widzisz',
    why:
      'Serwer przechowuje Twój pęk kluczy wyłącznie w postaci zaszyfrowanej i nigdy nie trzyma części, która go otwiera. Ta część podróżuje z Twoim żądaniem, z tej przeglądarki.'
  },
  auth: {
    heading: 'Logowanie',
    username: 'Nazwa użytkownika',
    password: 'Hasło',
    signIn: 'Zaloguj się',
    createAccount: 'Załóż konto',
    working: 'Chwileczkę…',
    deriving: 'Wyliczanie Twojego klucza…',
    derivingWhy:
      'To celowo trwa około sekundy. Ktoś, kto zgaduje Twoje hasło, płaci tę samą sekundę przy każdej próbie.',
    personName: "Twoje imię i nazwisko",
    personNameWhy: "Pod tą nazwą będziesz widoczny — na stronie parafii, w kalendarzu, przy wszystkim, czym zarządzasz. To nie jest login, i można ją później zmienić.",
    haveAccount: "Mam już konto",
    close: "Zamknij",
    keepSignedIn: "Pozostań zalogowany",
    keepSignedInWhy: "Na tym urządzeniu, przez 30 dni. Każdy, kto ma dostęp do tej przeglądarki, otworzy wtedy twoje konto bez hasła. Na wspólnym komputerze zostaw wyłączone.",
    signedInAs: 'Zalogowano jako {name}',
    keysHeld: 'Twój pęk kluczy jest gotowy.',
    keysMissing: 'Zablokowane — pęku kluczy nie ma w pamięci.',
    lock: 'Zablokuj',
    signOut: 'Wyloguj się',
    signUpHint:
      'Konto może założyć każdy. Daje ono własną przestrzeń — i nic ponadto. Do części zamkniętych prowadzi link z zaproszeniem, który łączysz ze swoim kontem już po zalogowaniu.',
    errors: {
      'auth.credentials_invalid': 'Nazwa użytkownika i hasło do siebie nie pasują.',
      'auth.rate_limited': 'Zbyt wiele prób. Poczekaj chwilę.',
      'auth.account_disabled': 'To konto zostało zamknięte.',
      'auth.username_taken': 'Ta nazwa użytkownika jest zajęta.',
      'auth.password_weak': 'Tego hasła nie można użyć.',
      'auth.token_invalid': 'Ten link już nie działa. Poproś o nowy.',
      'permission.denied': 'Nie masz tu takich uprawnień.',
      'parish.slug_not_allowed':
        'Tego adresu nie ma na liście parafii i nie można go utworzyć. Adresy '
        + 'ustalane są z góry, bo są rozdawane i drukowane.',
      'role.cycle': 'To sprawiłoby, że dwie role otwierałyby się nawzajem.',
      'role.unreachable': 'Ta rola nie jest dla Ciebie dostępna.',
      'session.revoked': 'Ta sesja została zakończona. Zaloguj się ponownie.',
      'session.expired': 'Ta sesja wygasła. Zaloguj się ponownie.',
      'session.unlock_required': 'Twojego klucza nie ma w pamięci. Odblokuj.'
    },
    unknownError: 'Coś poszło nie tak. Spróbuj ponownie.'
  },
  chat: {
    areas: 'Obszary',
    noAreas: 'Nie ma jeszcze obszarów. Załóż jeden albo poczekaj na zaproszenie.',
    newArea: 'Nowy obszar',
    areaName: 'Do czego służy ten obszar?',
    create: 'Załóż',
    writingAs: 'Piszesz jako',
    placeholder: 'Powiedz coś…',
    send: 'Wyślij',
    sending: 'Wysyłanie…',
    toRecord: 'Do protokołu',
    toRecordWhy:
      'Dopisuje ten wpis do łańcucha, więc jego kolejność i autorstwo da się później udowodnić. Nie każda wiadomość tego potrzebuje — łańcuch pełen pogawędek niczego nie dowodzi.',
    recorded: 'w protokole',
    withdraw: 'Wycofaj',
    withdrawn: 'Wycofane przez autora.',
    epochBreak: 'Od tego miejsca należysz do tego obszaru.',
    beforeYou: 'Sprzed Twojego dołączenia. Nikt nie może tego dla Ciebie otworzyć.',
    damaged: 'To się nie otworzyło, a powinno. Nic nie zginęło — ale proszę, zgłoś to.',
    hiddenByModerator: 'Ukryte przez moderatora.',
    partialHistory: 'część tej historii jest dla Ciebie zamknięta',
    readOnly: 'Możesz tu czytać, ale nie pisać.',
    locked: 'Odblokuj, aby czytać ten obszar.',
    members: {
      one: '{n} osoba',
      few: '{n} osoby',
      many: '{n} osób',
      other: '{n} osób'
    },
    empty: 'Nikt tu jeszcze nic nie powiedział.',
    loading: 'Wczytywanie…'
  },
  threads: {
    tabChat: 'Rozmowa',
    tabTopics: 'Wątki',
    tabPolls: 'Pytania',

    topics: 'Wątki',
    noTopics: 'Nie ma jeszcze wątków. Zaznacz wiadomości, które do siebie należą, i nazwij je.',
    newTopic: 'Nowy wątek',
    topicTitle: 'Co je łączy?',
    topicFrom: {
      one: 'z {n} zaznaczonej wiadomości',
      few: 'z {n} zaznaczonych wiadomości',
      many: 'z {n} zaznaczonych wiadomości',
      other: 'z {n} zaznaczonych wiadomości'
    },
    inTopic: {
      one: '{n} wiadomość',
      few: '{n} wiadomości',
      many: '{n} wiadomości',
      other: '{n} wiadomości'
    },
    close: 'Zamknij',
    reopen: 'Otwórz ponownie',
    closed: 'zamknięty',
    pickFirst: 'Najpierw zaznacz wiadomości w rozmowie.',

    polls: 'Pytania',
    noPolls: 'Nikt tu jeszcze o nic nie zapytał.',
    newPoll: 'Zapytaj o coś',
    question: 'Twoje pytanie',
    ask: 'Zapytaj',
    mode: 'Odpowiedzi',
    modeSingle: 'Po jednej',
    modeMulti: 'Po kilka',
    modeQuiz: 'Jedna poprawna',
    reveal: 'Pokaż wynik',
    revealImmediate: 'Od razu',
    revealOnClose: 'Dopiero po zamknięciu',
    revealWhy:
      'Kto odpowiada jako dziesiąty, widzi dziewięć odpowiedzi i się do nich przyłącza. Ukrycie wyniku do końca to sposób, żeby dowiedzieć się, co ludzie myślą, a nie co myślą, że myślą inni.',
    yourAnswer: 'Twoja odpowiedź',
    vote: 'Odpowiedz',
    voted: 'Odpowiedziano',
    changeVote: 'Zmień odpowiedź',
    votes: {
      one: '{n} odpowiedź',
      few: '{n} odpowiedzi',
      many: '{n} odpowiedzi',
      other: '{n} odpowiedzi'
    },
    tallySealed: 'Wynik pozostaje ukryty do zamknięcia. Po to właśnie tak zapytano.',
    closePoll: 'Zamknij i pokaż wynik',
    pollClosed: 'Zamknięte',

    attach: 'Dołącz plik',
    attachments: {
      one: '{n} plik',
      few: '{n} pliki',
      many: '{n} plików',
      other: '{n} plików'
    },
    open: 'Otwórz',
    remove: 'Usuń',
    uploading: 'Wysyłanie…',

    react: 'Zajmij stanowisko',
    agree: 'Zgadzam się',
    noted: 'Przeczytałem',
    object: 'Sprzeciwiam się',
    reactWhy:
      'Jedno z trzech, i tylko jedno. „Przeczytałem" i „zgadzam się" to nie to samo, a na posiedzeniu ta różnica jest sednem sprawy.'
  },
  ledger: {
    tabLedger: 'Rejestr',
    tabDecisions: 'Decyzje',

    heading: 'Łańcuch',
    intro:
      'Każda decyzja trafia do łańcucha, a każde ogniwo wskazuje skrót poprzedniego. Usuń wiersz, zamień dwa miejscami, dopisz jeden później — łańcuch przestaje się zgadzać i wskazuje gdzie.',
    check: 'Przelicz tutaj',
    checking: 'Przeliczanie…',
    intact: 'Łańcuch się zgadza.',
    intactWhy:
      'Przeliczone w tej przeglądarce, z wpisów tak, jak przyszły — a nie przyjęte na słowo serwera. „Sprawdziłem, wszystko gra" z ust operatora to właśnie to zapewnienie, bez którego taki rejestr ma się obyć.',
    broken: 'Łańcuch się nie zgadza.',
    brokenAt: 'Pierwsze pęknięcie przy wpisie {n}.',
    disagree: 'Serwer mówi co innego o własnym łańcuchu.',
    disagreeWhy:
      'To jest właśnie znalezisko, nie szczegół: to, co usługa twierdzi o swoim rejestrze, nie wynika z wpisów, które sama wydała. Zachowaj tę stronę i powiedz o tym.',
    limits:
      'Co jest sprawdzane: czy ogniwa do siebie pasują i czy nie brakuje numeru. Czego nie: czy treść każdego wpisu odpowiada jego własnemu skrótowi — do tego potrzebne są bajty w postaci kanonicznej, a te przychodzą tu już złożone.',
    entries: {
      one: '{n} wpis',
      few: '{n} wpisy',
      many: '{n} wpisów',
      other: '{n} wpisów'
    },
    head: 'Czoło',
    sequence: 'Nr',
    previous: 'następuje po',
    hash: 'skrót',
    module: 'z',
    when: 'zapisano',
    payload: 'co zapisano',
    reasons: {
      'chain.gap': 'Brakuje numeru — coś wyjęto.',
      'chain.broken_link': 'Wpis nie następuje po poprzednim.'
    },
    empty: 'Nic tu jeszcze nie trafiło do łańcucha.',

    decisions: 'Decyzje',
    noDecisions: 'Nic tu jeszcze nie postanowiono.',
    newDecision: 'Zaproponuj coś',
    decisionBody: 'O czym się rozstrzyga?',
    propose: 'Zaproponuj',
    reason: 'Dlaczego',
    reasonWhy:
      'Wymagane, i nie dla formalności. Decyzji bez uzasadnienia nie da się zrozumieć za rok — a wtedy stoi tam uchwała, której nikt nie umie wyjaśnić.',
    move: 'Przenieś do: {state}',
    history: 'Jak do tego doszło',
    finalState: 'Stąd nic już nie wynika.',
    states: {
      proposed: 'zaproponowana',
      open: 'w dyskusji',
      accepted: 'przyjęta',
      rejected: 'odrzucona',
      reopened: 'otwarta ponownie'
    }
  },
  invite: {
    tabMembers: 'Osoby',

    members: 'Kto tu jest',
    noMembers: 'Nikogo innego jeszcze tu nie ma.',
    capability: 'może',
    caps: { read: 'czytać', write: 'pisać', admin: 'zarządzać', certify: 'zapraszać innych' },
    remove: 'Usuń',
    removeWhy:
      'Od tej chwili nie odczyta tego, co zostanie napisane. To, co powiedziano wcześniej, pozostanie dla tej osoby czytelne — zamknięcie tego wymagałoby zaszyfrowania wszystkiego od nowa, a stara kopia i tak byłaby już w świecie.',
    epochGrants: {
      one: 'ma {n} klucz',
      few: 'ma {n} klucze',
      many: 'ma {n} kluczy',
      other: 'ma {n} kluczy'
    },

    invitations: 'Zaproszenia',
    noInvitations: 'Brak wystawionych zaproszeń.',
    create: 'Zaproś kogoś',
    label: 'Do czego to',
    labelHint: 'Widzisz to tylko Ty. Pozwala później odróżnić zaproszenia.',
    daysValid: 'Ważne przez (dni)',
    maxUses: 'Ile razy można użyć',
    unlimited: 'bez ograniczeń',
    forSms: 'Wysyłane SMS-em',
    forSmsWhy:
      'SMS-y przychodzą z opóźnieniem, są przekazywane dalej i leżą w skrzynkach. Link wysłany tą drogą dostaje co najmniej tydzień, a jego pierwsze otwarcie zostaje odnotowane.',
    personalWarning:
      'To Twoja rola osobista. Udostępniając ją, przekazujesz wszystko, co do niej należy — każdy obszar, każdy klucz, całą historię. Zamiast tego załóż grupę i zapraszaj do niej.',
    newGroup: 'Załóż grupę',
    groupName: 'Jak nazywa się grupa?',
    issue: 'Utwórz link',
    issuing: 'Tworzenie…',

    linkReady: 'Oto link.',
    linkOnce:
      'To jedyny raz, kiedy można go pokazać. Klucz podróżuje w linku, a nie w bazie — więc nikt, łącznie z tym, kto prowadzi tę usługę, nie odtworzy go ponownie. Zgubisz — wystawiasz nowy.',
    copy: 'Kopiuj',
    copied: 'Skopiowano',
    done: 'Mam go',
    expires: 'do {when}',
    used: 'użyto {n}×',
    spent: 'już nieużywalne',
    opened: 'otwarto {when}',
    openedWhy:
      'Jeśli otwarto go, zanim dotarł do adresata, ktoś przeczytał go po drodze.',
    revoke: 'Unieważnij',

    grantHistory: 'Daj też dostęp do tego, co powiedziano wcześniej',
    grantHistoryWhy:
      'Domyślnie wyłączone, i to celowo: kto dołącza dziś, wczoraj go tu nie było. Przekazania przeszłości nie da się cofnąć — wydane klucze są wydane.',

    youWereInvited: 'Zostałeś zaproszony.',
    leadsTo: 'Ten link prowadzi do: {label}',
    needAccount: 'Najpierw się zaloguj, wtedy link da się połączyć z Twoim kontem.',
    accept: 'Połącz z moim kontem',
    accepting: 'Łączenie…',
    accepted: 'Gotowe — jesteś w środku.',
    alreadyIn: 'Już tam byłeś. Nic do zrobienia.',
    invalid: 'Ten link jest już nieważny. Poproś o nowy.',
    dismiss: 'Zamknij'
  },
  events: {
    heading: 'Wydarzenia',
    none: 'Nie ma jeszcze wydarzeń. Wydarzenie wisi przy obszarze — załóż je tam.',
    create: 'Nowe wydarzenie',
    eventTitle: 'Jak się nazywa?',
    address: 'Adres',
    addressHint: 'To trafia do linku. Litery, cyfry i myślniki.',
    make: 'Utwórz',
    states: { draft: 'szkic', published: 'opublikowane', archived: 'zarchiwizowane' },
    publish: 'Opublikuj',
    archive: 'Zarchiwizuj',
    draftWarning: 'Szkic nie jest publiczny. Nikt z zewnątrz go nie otworzy i nie przyjmuje zapisów.',

    pages: { one: '{n} strona', few: '{n} strony', many: '{n} stron', other: '{n} stron' },
    newPage: 'Dodaj stronę',
    pageTitle: 'Co na niej będzie?',
    addPart: 'Dodaj sekcję',
    partKinds: {
      title: 'Tytuł', shortinfos: 'Najważniejsze', text: 'Tekst', plan: 'Program',
      map: 'Mapa', faq: 'Pytania', form: 'Formularz zapisu', costs: 'Koszty',
      contact: 'Kontakt', gallery: 'Zdjęcia', files: 'Pliki', people: 'Osoby'
    },
    visibility: 'Kto to widzi',
    isPublic: 'Wszyscy',
    isInternal: 'Tylko przygotowujący',
    publicWhy:
      'Publiczne znaczy czytelne dla każdego, kto ma link, i zapisane jawnym tekstem. Szyfrowanie czegoś i rozdawanie klucza tylko wyglądałoby na ochronę.',
    internalWhy:
      'Zapieczętowane kluczem tego obszaru. Kto dołączy później, tego nie zobaczy — ta sama zasada co przy wiadomościach i z tego samego powodu.',
    sealedHere: 'Zapieczętowane. Dołączyłeś po tym, jak to powstało.',
    onlyPublic: 'Widzisz część publiczną. Może być tego więcej.',

    register: 'Zapisz się',
    registering: 'Wysyłanie…',
    registered: 'Dziękujemy — jesteś zapisany.',
    keepClaim: 'Zachowaj to. To Twój dowód.',
    claimWhy:
      'To jedyny sposób, żeby później wycofać zapis. Pokazujemy go raz i przechowujemy tylko odcisk — nikt go nie odtworzy, nawet ten, kto prowadzi tę usługę.',
    notYet: 'To wydarzenie nie przyjmuje jeszcze zapisów.',
    missing: 'Wciąż brakuje: {what}',
    registrations: { one: '{n} zapis', few: '{n} zapisy', many: '{n} zapisów', other: '{n} zapisów' },
    withdrawn: 'wycofane',
    withdraw: 'Wycofaj',
    classes: {
      normal: 'zwykłe', sensitive: 'wrażliwe',
      special: 'kategoria szczególna', secret: 'tajne'
    },
    sealedFor: 'Sprzed Twojego dołączenia — nikt nie może tego dla Ciebie otworzyć.'
  },
  parish: {
    heading: 'Parafia',
    none: "Nie ma jeszcze parafii.",
    create: 'Nowa parafia',
    name: 'Nazwa',
    location: 'Gdzie',
    make: 'Utwórz',

    slug: 'Nazwa w adresie',
    officeName: "{name} — administrator",
    officeIs: "Zarządza: {name}",
    officeMissing: "Ta parafia nie ma urzędu. Wisi przy osobie, która ją założyła, i można ją przekazać tylko przekazując konto.",
    officeAdd: "Utwórz urząd",
    slugUnknown:
      'Tej nazwy nie ma na liście i nie można jej utworzyć. Adresy ustalane są '
      + 'z góry, bo są rozdawane i drukowane — zmiana adresu parafii zepsułaby '
      + 'każdy link do niej.',
    slugAvailable: 'Dostępne',
    slugShape: 'Małe litery, cyfry i myślniki pomiędzy nimi.',

    adminIs: "Parafią będzie zarządzać: {name}.",
    stepOne: "Krok 1 z 2",
    stepTwo: "Krok 2 z 2",
    nameLead: "Nazwę można później zmienić. Adresu nie — jest rozdawany, drukowany i linkowany.",
    lookTitle: "Jak wygląda strona",
    lookLead: "To wszystko można zmienić w każdej chwili.",
    finish: "Zapisz i zakończ",
    later: "Zdecyduj później",

    theme: "Kolor",
    themes: {"classic":"Klasyczny","warm":"Ciepły","stone":"Kamień","night":"Noc"},
    modules: "Elementy strony głównej",
    modulesLead: "Wybierz, co ma tam być. Kolejność wynika z kolejności wyboru.",
    moduleNames: {"masses":"Msze","announcements":"Ogłoszenia","intentions":"Intencje","calendar":"Kalendarz","news":"Aktualności","groups":"Grupy","events":"Wydarzenia","sacraments":"Sakramenty","hours":"Godziny kancelarii","contact":"Kontakt","gallery":"Galeria","sticky":"Komunikat"},

    plan: 'Plan mszy',
    noMasses: 'Nic nie zaplanowano.',
    addMass: 'Dodaj mszę',
    church: 'Kościół',
    when: 'Kiedy',
    massTitle: 'Jaka',
    duration: 'Minut',
    collective: 'Kilka intencji naraz',
    collectiveWhy:
      'Msza zbiorowa niesie kilka intencji w jednym terminie. Różnica nie jest kosmetyczna: przy mszy pojedynczej intencja należy do niej, przy zbiorowej kilka dzieli termin.',

    intentions: {
      one: '{n} intencja', few: '{n} intencje', many: '{n} intencji', other: '{n} intencji'
    },
    addIntention: 'Dodaj intencję',
    publicText: 'Co trafia do ogłoszeń',
    publicWhy:
      'To jest odczytywane i drukowane. Zapisane jawnym tekstem, bo jest publiczne — szyfrowanie tego i rozdawanie klucza tylko wyglądałoby na ochronę.',
    internalText: 'O co naprawdę chodzi',
    internalWhy:
      'Zapieczętowane kluczem tego obszaru. Nikt spoza parafii tego nie przeczyta — nawet ten, kto prowadzi tę usługę.',
    donor: 'Kto ofiarował',
    forMass: 'Do której mszy',
    unassigned: 'bez terminu',
    sealedPart: 'Jest tu notatka, której nie możesz otworzyć.',

    offerings: 'Ofiary',
    addOffering: 'Zapisz ofiarę',
    amount: 'Kwota',
    amountWhy:
      'Zawsze zapieczętowana. To znaczy, że sumy nie da się policzyć w bazie — kto jej potrzebuje, pobiera wiersze i dodaje z kluczem w ręku.',
    currency: 'Waluta',
    received: 'Otrzymano',
    booked: 'Zapisano'
  },
  graph: {
    heading: 'Wiedza',
    none: 'Nie ma jeszcze biblioteki. Biblioteka wisi przy obszarze — załóż ją tam.',
    create: 'Nowa biblioteka',
    title: 'Tytuł',
    public: 'Biblioteka otwarta',
    publicWhy:
      'Treść zapisana jawnym tekstem, serwer może ją przeszukiwać. Dobre dla słówek, układu okresowego, osi czasu — wiedzy, która i tak jest w każdym podręczniku.',
    privateWhy:
      'Treść zapieczętowana. Serwer widzi szyfrogram i nie umie w nim szukać — szuka ta przeglądarka, w tym, co już wczytała. To gorzej się skaluje. To cena za to, że operator nie przeczyta Twoich notatek.',
    locked: 'Ten wybór zapada raz i nie da się go później zmienić.',
    make: 'Utwórz',

    nodes: { one: '{n} węzeł', few: '{n} węzły', many: '{n} węzłów', other: '{n} węzłów' },
    edges: { one: '{n} krawędź', few: '{n} krawędzie', many: '{n} krawędzi', other: '{n} krawędzi' },
    addNode: 'Dodaj węzeł',
    kind: 'Rodzaj',
    value: 'Wartość',
    ofKind: 'Rodzaju',
    needsKind: 'Encja potrzebuje rodzaju, który ją opisuje.',
    emptyNode: 'Nic jeszcze nie wypełniono',
    unreadable: 'Tego nie możesz otworzyć.',

    addEdge: 'Połącz dwa węzły',
    from: 'Od',
    to: 'Do',
    relation: 'Relacja',
    state: 'Na ile pewne',
    states: {
      known: 'znane',
      approximate: 'w przybliżeniu',
      disputed: 'sporne',
      unknown: 'nieznane',
      not_applicable: 'nie dotyczy',
      pending: 'wciąż otwarte'
    },
    stateWhy:
      '„Nieznane" to stwierdzenie, a nie brak wartości. Powiedzieć to znaczy co innego niż nie powiedzieć nic — po to właśnie jest ten model.',
    note: 'Notatka',

    search: 'Szukaj',
    searchHint: 'Pisz, aby przeszukać tę bibliotekę.',
    foundServer: 'Szukano na serwerze.',
    foundBrowser: 'Szukano tutaj, w Twojej przeglądarce.',
    browserWhy:
      'Treść jest zapieczętowana, więc serwer nie może w niej szukać. Szuka się w tym, co wczytano — a to niekoniecznie wszystko.',
    nothing: 'Nic nie pasuje.',
    kinds: {
      text: 'tekst', number: 'liczba', date: 'data', boolean: 'tak/nie', media: 'plik',
      entity: 'encja', entity_kind: 'rodzaj encji', edge_kind: 'rodzaj relacji',
      range: 'zakres', knowledge: 'wiedza', topic: 'temat', question: 'pytanie'
    }
  },
  cal: {
    heading: 'Kalendarz',
    none: 'Nie ma jeszcze kalendarza. Kalendarz wisi przy obszarze — załóż go tam.',
    create: 'Nowy kalendarz',
    title: 'Tytuł',
    zone: 'Strefa czasowa',
    zoneWhy:
      'Powtórzenia liczone są w tej strefie. „W każdy poniedziałek o dziewiątej" zostaje o dziewiątej mimo zmiany czasu — w UTC by nie zostało.',
    make: 'Utwórz',

    nothing: 'Nic w tym okresie.',
    busy: 'Zajęte',
    sealedItem: 'Jest tu coś, czego nie możesz otworzyć.',
    moved: 'przeniesione',
    clashes: { one: '{n} kolizja', few: '{n} kolizje', many: '{n} kolizji', other: '{n} kolizji' },
    clashWhy:
      'Dwa terminy nachodzą na siebie. Da się to sprawdzić, bo czasy leżą jawnym tekstem — i to jest za to zapłata.',

    add: 'Dodaj wpis',
    when: 'Od',
    until: 'Do',
    allDay: 'Cały dzień',
    publicTitle: 'Co widzą inni',
    publicWhy:
      'Zapisane jawnym tekstem. Zostaw puste, a inni zobaczą tylko „zajęte" — co często jest właściwą odpowiedzią.',
    privateTitle: 'Co to naprawdę jest',
    privateWhy:
      'Zapieczętowane kluczem tego obszaru. Nikt z zewnątrz tego nie przeczyta — nawet ten, kto prowadzi tę usługę.',
    where: 'Gdzie',
    notes: 'Notatki',
    visibility: 'Kto widzi',
    visibilities: { private: 'tylko ja', area: 'obszar', public: 'każdy' },
    repeat: 'Powtarza się',
    repeats: { none: 'raz', daily: 'codziennie', weekly: 'co tydzień', monthly: 'co miesiąc', yearly: 'co rok' },
    every: 'co',
    times: 'razy',
    repeatWhy:
      'Powtórzenie potrzebuje końca — liczby. Bez niego nie da się go policzyć, tylko uciąć, a każdy widok utnie gdzie indziej.',
    weekdays: ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'],

    cancelOne: 'Odwołaj ten',
    moveOne: 'Przenieś ten',
    seriesKept:
      'Seria pozostaje regułą. Odwołanie jednego terminu zapisuje wyjątek — nie zamienia „w każdy poniedziałek" w pięćdziesiąt osobnych wpisów.'
  },
  conf: {
    heading: 'Bierzmowanie',
    none: 'Nie ma jeszcze rocznika.',
    create: 'Nowy rocznik',
    name: 'Nazwa',
    ownArea: 'Obszar dla akt',
    ownAreaWhy:
      'Osobny obszar, nie ten parafialny. Kto prowadzi plan mszy, nie powinien przez to sięgać do akt dzieci — po to właśnie jest obszar.',
    make: 'Utwórz',

    candidates: { one: '{n} kandydat', few: '{n} kandydatów', many: '{n} kandydatów', other: '{n} kandydatów' },
    outstanding: {
      one: '{n} ma jeszcze zaległości',
      few: '{n} mają jeszcze zaległości',
      many: '{n} ma jeszcze zaległości',
      other: '{n} ma jeszcze zaległości'
    },
    outstandingWhy:
      'Policzone ze znaczników procesu, bez otwierania ani jednego rekordu. Po to właśnie leżą one jawnym tekstem — nie mówią nic o osobie.',
    noCandidates: 'Nikt jeszcze nie zapisany.',
    add: 'Zapisz kogoś',
    born: 'Urodzony(a)',
    contact: 'Kontakt (rodzice)',
    school: 'Szkoła',
    baptism: 'Chrzest w',
    sealedWhy:
      'Wszystko to jest zapieczętowane kluczem tego obszaru. Nikt z zewnątrz tego nie przeczyta — nawet ten, kto prowadzi tę usługę.',
    sealedCandidate: 'Jest tu ktoś, kogo nie możesz otworzyć.',
    withdrawn: 'wypisany(a)',
    withdraw: 'Wypisz',
    withdrawWhy:
      'Pola zostają zniszczone, wiersz zostaje. „Było ich czterdziestu czy czterdziestu jeden" to dokładnie to, na co taka lista ma odpowiadać.',

    steps: { consent: 'zgoda', paper: 'papiery', quiz: 'test' },
    stepsDone: 'wszystko jest',

    notes: { one: '{n} notatka', few: '{n} notatki', many: '{n} notatek', other: '{n} notatek' },
    addNote: 'Dodaj notatkę',
    noteText: 'Notatka',
    forFamily: 'Rodzina może to przeczytać',
    forFamilyWhy:
      'Obie są zapieczętowane. Ta nie jest publiczna — jest tylko widoczna dla szerszego kręgu. Dziecko nie ma „publicznego".',
    internalOnly: 'wewnętrzna',

    slots: 'Spotkania',
    noSlots: 'Nic nie zaplanowano.',
    addSlot: 'Zaplanuj spotkanie',
    when: 'Kiedy',
    capacity: 'Miejsc',
    label: 'Na co',
    free: { one: '{n} wolne miejsce', few: '{n} wolne miejsca', many: '{n} wolnych miejsc', other: '{n} wolnych miejsc' },
    full: 'pełne',
    book: 'Zajmij miejsce',
    booked: 'zajęte',
    pick: 'Dla kogo'
  },
  account: {
    heading: "Twoje konto",
    lead: "To konto sięga {roles} ról. Rysunek pokazuje, co przy czym wisi — rola jest dostępna dzięki drodze, nie sama z siebie.",
    locked: "Odblokuj klucze, aby zobaczyć swoje role.",
    loading: "Wczytywanie grafu…",
    areaNode: "Obszar",
    accountNode: "Konto",
    accountYou: "Ty",
    unnamed: "Bez nazwy",
    noKey: "brak klucza",
    rolesHeading: "Twoje role",
    personsHeading: "Osoby",
    noPersons: "Na tym koncie nie ma jeszcze osoby.",
    signInFirst: "Narzędzia wymagają konta. Bez niego nic poniżej się nie otworzy.",
    signInDo: "Zaloguj się",
  },
  roles: {
    kinds: {
      person: "Osoba",
      group: "Grupa",
      office: "Urząd",
      service: "Usługa",
    },
    relations: {
      holds: "trzyma",
      inherits: "dziedziczy po",
      supervises: "nadzoruje",
    },
    rename: "Zmień nazwę",
    titles: "Tytuły",
    noTitles: "jeszcze żadnego",
    titleHint: "np. ks., dr",
    addTitle: "Dodaj",
    removeTitle: "Usuń ten tytuł",
    moveLeft: "Przesuń w lewo",
    moveRight: "Przesuń w prawo",
    alias: "Nazwa",
    preview: "Będzie widoczne:",
    save: "Zapisz",
    cancel: "Anuluj",
    renameWarns: "Nazwa jest przy roli, a nie kopiowana do wszystkiego, co ta rola kiedykolwiek napisała. Zmiana działa wszędzie — także nad starymi wpisami.",
  },
  person: {
    heading: "Osoba",
    lead: "Każdy wpis jest szyfrowany osobno i osobno udostępniany. Udostępnienie numeru telefonu udostępnia numer telefonu — i nic obok.",
    locked: "Odblokuj klucze, aby zobaczyć te wpisy.",
    loading: "Otwieranie wpisów…",
    unnamed: "Bez nazwy",
    noRole: "Ten adres nie wskazuje żadnej osoby.",
    toAccount: "Do konta",
    fields: {
      PersonGivenName: "Imię",
      PersonSurname: "Nazwisko",
      PersonPhone: "Telefon",
      PersonBorn: "Data urodzenia",
    },
    addAnother: "Kolejny numer",
    add: "Dodaj",
    change: "Zmień",
    save: "Zapisz",
    cancel: "Anuluj",
    sealed: "Zapisane, ale nie do odczytu przez ciebie.",
    share: "Udostępnij",
    shareWhat: "Druga rola dostaje klucz do tego jednego wpisu. Nie do pozostałych i nie do osoby.",
    shareTo: "Rola",
    shareToHint: "Identyfikator roli",
    shareDo: "Przekaż klucz",
    destroy: "Zniszcz",
    destroyReason: "Usunięte przez właściciela",
    showLog: "Kto to czytał",
    logHeading: "Odczyty",
    logEmpty: "Jeszcze nie czytane.",
    logHide: "Ukryj",
    logNote: "Każdy odczyt tych wpisów jest zapisywany — także twój. Rejestr, który pomija najczęstszy przypadek, nie odpowiada później na nic.",
  },
  status: {
    heading: 'Co już stoi',
    done: 'zbudowane i sprawdzone',
    building: 'w budowie',
    planned: 'zaplanowane'
  },
  lang: { en: 'English', pl: 'Polski', de: 'Deutsch' }
};

const de: RcCopy = {
  shell: {
    title: 'REcreatio',
    subtitle: 'Die neu gebaute Plattform. Verschlüsselt von Bauart, beweisbar durch die Kette.',
    stage: 'Phase 0 — Fundament',
    legacyHint: 'Die bisherige Plattform läuft unverändert daneben weiter.',
    openLegacy: 'Bisherige Plattform öffnen'
  },
  route: {
    strayHeading: 'Dieser Adresse fehlt ihr Teil',
    strayBody:
      'Es heisst hier nichts für sich allein „{word}“. Jede Adresse nennt erst den Teil und dann die Sache: {example}. Im Link, über den Sie gekommen sind, fehlt der Teil.',
    strayHome: 'Zur Startseite',
    checking: 'Wird geprüft …',
    unreachable: 'Der Dienst hat nicht geantwortet. Das ist nicht dasselbe wie abgemeldet — es wurde nichts geändert.',
    backToStart: 'Alle Teile'
  },
  selfTest: {
    heading: 'Kryptografische Selbstprüfung',
    intro:
      'Dieselben Testvektoren, die der Server nachrechnet. Client und Server müssen bitgenau übereinstimmen; laufen sie auseinander, entstehen Daten, die niemand mehr öffnet.',
    run: 'Prüfung starten',
    running: 'Prüfe…',
    passed: { one: '{n} Prüfung bestanden', other: '{n} Prüfungen bestanden' },
    failed: { one: '{n} Prüfung fehlgeschlagen', other: '{n} Prüfungen fehlgeschlagen' },
    allGreen: 'Dieser Browser rechnet genau das, was der Server rechnet.',
    duration: 'in {ms} ms',
    expected: 'erwartet',
    actual: 'gerechnet'
  },
  unlock: {
    heading: 'Entsperren nötig',
    body: 'Dein Schlüssel liegt nicht im Speicher. Ohne ihn lässt sich nichts lesen — von dir nicht und vom Betreiber auch nicht.',
    action: 'Entsperren',
    whyHeading: 'Warum das erscheint',
    why:
      'Der Server hält deinen Schlüsselbund nur verschlüsselt und niemals das Stück, das ihn öffnet. Dieses Stück reist mit deiner Anfrage, aus diesem Browser.'
  },
  auth: {
    heading: 'Anmelden',
    username: 'Benutzername',
    password: 'Passwort',
    signIn: 'Anmelden',
    createAccount: 'Konto anlegen',
    working: 'Einen Moment…',
    deriving: 'Dein Schlüssel wird berechnet…',
    derivingWhy:
      'Das dauert absichtlich etwa eine Sekunde. Wer dein Passwort errät, zahlt dieselbe Sekunde — bei jedem Versuch.',
    personName: "Dein Name",
    personNameWhy: "Unter diesem Namen erscheinst du — auf einer Pfarrseite, in einem Kalender, neben allem, was du verwaltest. Es ist nicht der Anmeldename, und er laesst sich spaeter aendern.",
    haveAccount: "Ich habe schon ein Konto",
    close: "Schliessen",
    keepSignedIn: "Angemeldet bleiben",
    keepSignedInWhy: "Auf diesem Geraet, dreissig Tage lang. Wer diesen Browser benutzen kann, oeffnet dein Konto dann ohne Passwort. Auf einem geteilten Rechner besser aus.",
    signedInAs: 'Angemeldet als {name}',
    keysHeld: 'Dein Schlüsselbund liegt bereit.',
    keysMissing: 'Gesperrt — der Schlüsselbund liegt nicht im Speicher.',
    lock: 'Sperren',
    signOut: 'Abmelden',
    signUpHint:
      'Anmelden kann sich jeder. Ein Konto gibt dir deinen eigenen Bereich — mehr nicht. In geschlossene Bereiche führt ein Einladungslink, den du mit deinem Konto verbindest, sobald du angemeldet bist.',
    errors: {
      'auth.credentials_invalid': 'Benutzername und Passwort passen nicht zusammen.',
      'auth.rate_limited': 'Zu viele Versuche. Bitte etwas warten.',
      'auth.account_disabled': 'Dieses Konto ist stillgelegt.',
      'auth.username_taken': 'Dieser Benutzername ist vergeben.',
      'auth.password_weak': 'Dieses Passwort lässt sich nicht verwenden.',
      'auth.token_invalid': 'Dieser Link gilt nicht mehr. Bitte um einen neuen.',
      'permission.denied': 'Das darfst du hier nicht.',
      'parish.slug_not_allowed':
        'Diese Adresse steht nicht auf der Liste der Pfarreien und kann nicht angelegt '
        + 'werden. Adressen werden vorher festgelegt, weil sie weitergegeben und '
        + 'gedruckt werden.',
      'role.cycle': 'Dabei würden zwei Rollen einander gegenseitig aufschließen.',
      'role.unreachable': 'Diese Rolle steht dir nicht zur Verfügung.',
      'session.revoked': 'Diese Sitzung wurde beendet. Bitte neu anmelden.',
      'session.expired': 'Diese Sitzung ist abgelaufen. Bitte neu anmelden.',
      'session.unlock_required': 'Dein Schlüssel liegt nicht im Speicher. Bitte entsperren.'
    },
    unknownError: 'Da ist etwas schiefgegangen. Bitte erneut versuchen.'
  },
  chat: {
    areas: 'Bereiche',
    noAreas: 'Noch keine Bereiche. Leg einen an oder warte auf eine Einladung.',
    newArea: 'Neuer Bereich',
    areaName: 'Wofür ist dieser Bereich?',
    create: 'Anlegen',
    writingAs: 'Du schreibst als',
    placeholder: 'Sag etwas…',
    send: 'Senden',
    sending: 'Wird gesendet…',
    toRecord: 'Zu Protokoll',
    toRecordWhy:
      'Nimmt diesen Beitrag in die Kette auf, damit sich Reihenfolge und Urheberschaft später beweisen lassen. Nicht jede Nachricht braucht das — eine Kette voller Nebensätze beweist nichts.',
    recorded: 'zu Protokoll',
    withdraw: 'Zurücknehmen',
    withdrawn: 'Vom Urheber zurückgenommen.',
    epochBreak: 'Ab hier gehörst du zu diesem Bereich.',
    beforeYou: 'Aus der Zeit vor deinem Beitritt. Niemand kann das für dich öffnen.',
    damaged: 'Das liess sich nicht öffnen, obwohl es sollte. Verloren ist nichts — aber bitte melde es.',
    hiddenByModerator: 'Von der Moderation ausgeblendet.',
    partialHistory: 'ein Teil dieser Geschichte ist dir verschlossen',
    readOnly: 'Du kannst hier lesen, aber nicht schreiben.',
    locked: 'Zum Lesen dieses Bereichs entsperren.',
    members: { one: '{n} Mitglied', other: '{n} Mitglieder' },
    empty: 'Hier wurde noch nichts gesagt.',
    loading: 'Wird geladen…'
  },
  threads: {
    tabChat: 'Gespräch',
    tabTopics: 'Themen',
    tabPolls: 'Fragen',

    topics: 'Themen',
    noTopics: 'Noch keine Themen. Markiere, was zusammengehört, und gib ihm einen Namen.',
    newTopic: 'Neues Thema',
    topicTitle: 'Was hält das zusammen?',
    topicFrom: { one: 'aus {n} markierten Beitrag', other: 'aus {n} markierten Beiträgen' },
    inTopic: { one: '{n} Beitrag', other: '{n} Beiträge' },
    close: 'Schliessen',
    reopen: 'Wieder öffnen',
    closed: 'geschlossen',
    pickFirst: 'Markiere zuerst Beiträge im Gespräch.',

    polls: 'Fragen',
    noPolls: 'Hier wurde noch nichts gefragt.',
    newPoll: 'Etwas fragen',
    question: 'Deine Frage',
    ask: 'Fragen',
    mode: 'Antworten',
    modeSingle: 'Je eine',
    modeMulti: 'Je mehrere',
    modeQuiz: 'Eine richtige',
    reveal: 'Auszählung zeigen',
    revealImmediate: 'Sofort',
    revealOnClose: 'Erst beim Schliessen',
    revealWhy:
      'Wer als Zehnter antwortet, sieht neun Antworten und schliesst sich an. Die Auszählung bis zum Schluss zurückzuhalten ist der Weg, zu erfahren, was die Leute denken — und nicht, was sie glauben, dass die anderen denken.',
    yourAnswer: 'Deine Antwort',
    vote: 'Antworten',
    voted: 'Du hast geantwortet',
    changeVote: 'Antwort ändern',
    votes: { one: '{n} Antwort', other: '{n} Antworten' },
    tallySealed: 'Die Auszählung bleibt bis zum Schliessen verborgen. Genau dafür wurde so gefragt.',
    closePoll: 'Schliessen und auszählen',
    pollClosed: 'Geschlossen',

    attach: 'Datei anhängen',
    attachments: { one: '{n} Datei', other: '{n} Dateien' },
    open: 'Öffnen',
    remove: 'Entfernen',
    uploading: 'Wird hochgeladen…',

    react: 'Stellung nehmen',
    agree: 'Ich stimme zu',
    noted: 'Ich habe es gelesen',
    object: 'Ich widerspreche',
    reactWhy:
      'Eines von dreien, und nur eines. „Ich habe es gelesen" und „ich stimme zu" sind nicht dasselbe, und in einer Sitzung ist genau dieser Unterschied der ganze Punkt.'
  },
  ledger: {
    tabLedger: 'Protokoll',
    tabDecisions: 'Beschlüsse',

    heading: 'Die Kette',
    intro:
      'Jeder Beschluss wird in eine Kette geschrieben, und jedes Glied nennt den Hash des vorigen. Eine Zeile entfernen, zwei vertauschen, eine nachträglich einfügen — die Kette geht nicht mehr auf, und sie sagt wo.',
    check: 'Hier nachrechnen',
    checking: 'Wird nachgerechnet…',
    intact: 'Die Kette geht auf.',
    intactWhy:
      'In diesem Browser nachgerechnet, aus den Einträgen so, wie sie kamen — nicht dem Server geglaubt. „Ich habe nachgesehen, es stimmt" aus dem Mund des Betreibers ist genau die Zusicherung, ohne die ein solches Protokoll auskommen soll.',
    broken: 'Die Kette geht nicht auf.',
    brokenAt: 'Die erste Bruchstelle ist Eintrag {n}.',
    disagree: 'Der Dienst sagt etwas anderes über seine eigene Kette.',
    disagreeWhy:
      'Das ist der Fund und keine Nebensache: was der Dienst über sein Protokoll behauptet, folgt nicht aus den Einträgen, die er selbst herausgegeben hat. Diese Seite aufheben und es sagen.',
    limits:
      'Geprüft wird: dass die Glieder aneinanderpassen und keine Nummer fehlt. Nicht geprüft wird: ob der Inhalt jedes Eintrags zu seinem eigenen Hash passt — dafür braucht es die kanonischen Bytes, und die kommen hier bereits zusammengesetzt an.',
    entries: { one: '{n} Eintrag', other: '{n} Einträge' },
    head: 'Kopf',
    sequence: 'Nr.',
    previous: 'folgt auf',
    hash: 'Hash',
    module: 'aus',
    when: 'festgehalten',
    payload: 'was geschrieben wurde',
    reasons: {
      'chain.gap': 'Eine Nummer fehlt — es wurde etwas herausgenommen.',
      'chain.broken_link': 'Ein Eintrag folgt nicht auf den vorigen.'
    },
    empty: 'Hier wurde noch nichts in die Kette geschrieben.',

    decisions: 'Beschlüsse',
    noDecisions: 'Hier wurde noch nichts beschlossen.',
    newDecision: 'Etwas vorschlagen',
    decisionBody: 'Worüber wird entschieden?',
    propose: 'Vorschlagen',
    reason: 'Warum',
    reasonWhy:
      'Pflicht, und nicht als Formalie. Ein Beschluss ohne Begründung ist in einem Jahr nicht mehr nachvollziehbar — dann steht da etwas, das niemand mehr erklären kann.',
    move: 'Weiter zu {state}',
    history: 'Wie es dahin kam',
    finalState: 'Von hier aus folgt nichts mehr.',
    states: {
      proposed: 'vorgeschlagen',
      open: 'in Beratung',
      accepted: 'angenommen',
      rejected: 'abgelehnt',
      reopened: 'wieder geöffnet'
    }
  },
  invite: {
    tabMembers: 'Personen',

    members: 'Wer hier ist',
    noMembers: 'Ausser dir ist noch niemand in diesem Bereich.',
    capability: 'darf',
    caps: { read: 'lesen', write: 'schreiben', admin: 'verwalten', certify: 'andere einladen' },
    remove: 'Entfernen',
    removeWhy:
      'Von da an liest er nicht mehr, was geschrieben wird. Was vorher gesagt wurde, bleibt für ihn lesbar — das wegzuschliessen hiesse, alles neu zu verschlüsseln, und die alte Fassung wäre trotzdem in der Welt.',
    epochGrants: { one: 'hält {n} Schlüssel', other: 'hält {n} Schlüssel' },

    invitations: 'Einladungen',
    noInvitations: 'Keine offenen Einladungen.',
    create: 'Jemanden einladen',
    label: 'Wofür',
    labelHint: 'Sieht nur du. Damit lassen sich die Einladungen später auseinanderhalten.',
    daysValid: 'Gültig für (Tage)',
    maxUses: 'Wie oft einlösbar',
    unlimited: 'unbegrenzt',
    forSms: 'Geht per SMS raus',
    forSmsWhy:
      'SMS kommen verspätet an, werden weitergeleitet und bleiben in Postfächern liegen. Ein so verschickter Link bekommt mindestens eine Woche, und sein erstes Öffnen wird festgehalten.',
    personalWarning:
      'Das ist deine persönliche Rolle. Wer sie bekommt, bekommt alles, was an ihr hängt — jeden Bereich, jeden Schlüssel, die ganze Geschichte. Leg dafür lieber eine Gruppe an und lade zu dieser ein.',
    newGroup: 'Gruppe anlegen',
    groupName: 'Wie heisst die Gruppe?',
    issue: 'Link erzeugen',
    issuing: 'Wird erzeugt…',

    linkReady: 'Hier ist der Link.',
    linkOnce:
      'Das ist das einzige Mal, dass er gezeigt werden kann. Der Schlüssel reist IM Link und nicht in der Datenbank — niemand kann ihn wiederherstellen, auch nicht, wer diesen Dienst betreibt. Weg ist weg; dann stellt man einen neuen aus.',
    copy: 'Kopieren',
    copied: 'Kopiert',
    done: 'Habe ihn',
    expires: 'bis {when}',
    used: '{n}× eingelöst',
    spent: 'nicht mehr einlösbar',
    opened: 'geöffnet {when}',
    openedWhy:
      'Wurde er geöffnet, bevor er beim Empfänger ankam, hat ihn unterwegs jemand gelesen.',
    revoke: 'Zurückziehen',

    grantHistory: 'Auch Zugang zu allem geben, was vorher gesagt wurde',
    grantHistoryWhy:
      'Aus, und zwar mit Absicht: wer heute dazukommt, war gestern nicht dabei. Die Vergangenheit mitzugeben lässt sich nicht zurücknehmen — ausgehändigte Schlüssel sind ausgehändigt.',

    youWereInvited: 'Du wurdest eingeladen.',
    leadsTo: 'Dieser Link führt zu: {label}',
    needAccount: 'Melde dich zuerst an, dann lässt sich der Link mit deinem Konto verbinden.',
    accept: 'Mit meinem Konto verbinden',
    accepting: 'Wird verbunden…',
    accepted: 'Fertig — du bist drin.',
    alreadyIn: 'Du warst schon drin. Nichts zu tun.',
    invalid: 'Dieser Link gilt nicht mehr. Bitte um einen neuen.',
    dismiss: 'Schliessen'
  },
  events: {
    heading: 'Veranstaltungen',
    none: 'Noch keine Veranstaltungen. Eine haengt an einem Bereich — leg sie dort an.',
    create: 'Neue Veranstaltung',
    eventTitle: 'Wie heisst sie?',
    address: 'Adresse',
    addressHint: 'Das steht im Link. Buchstaben, Ziffern und Striche.',
    make: 'Anlegen',
    states: { draft: 'Entwurf', published: 'veröffentlicht', archived: 'archiviert' },
    publish: 'Veröffentlichen',
    archive: 'Archivieren',
    draftWarning: 'Ein Entwurf ist nicht öffentlich. Von aussen erreicht ihn niemand, und er nimmt keine Anmeldungen an.',

    pages: { one: '{n} Seite', other: '{n} Seiten' },
    newPage: 'Seite hinzufügen',
    pageTitle: 'Was steht darauf?',
    addPart: 'Abschnitt hinzufügen',
    partKinds: {
      title: 'Titel', shortinfos: 'Das Wichtigste', text: 'Text', plan: 'Ablauf',
      map: 'Karte', faq: 'Fragen', form: 'Anmeldeformular', costs: 'Kosten',
      contact: 'Kontakt', gallery: 'Bilder', files: 'Dateien', people: 'Personen'
    },
    visibility: 'Wer sieht das',
    isPublic: 'Alle',
    isInternal: 'Nur die Vorbereitenden',
    publicWhy:
      'Öffentlich heisst: für jeden lesbar, der den Link hat — und im Klartext gespeichert. Etwas zu verschlüsseln und den Schlüssel mitzuliefern sähe nur nach Schutz aus.',
    internalWhy:
      'Versiegelt unter dem Schlüssel dieses Bereichs. Wer später dazukommt, sieht es nicht — dieselbe Regel wie bei Nachrichten, und aus demselben Grund.',
    sealedHere: 'Versiegelt. Du bist dazugekommen, nachdem das geschrieben wurde.',
    onlyPublic: 'Du siehst den öffentlichen Teil. Es kann mehr geben.',

    register: 'Anmelden',
    registering: 'Wird gesendet…',
    registered: 'Danke — du bist angemeldet.',
    keepClaim: 'Heb das auf. Es ist dein Beleg.',
    claimWhy:
      'Nur damit lässt sich die Anmeldung später zurücknehmen. Er wird einmal gezeigt und nur als Abdruck gespeichert — niemand kann ihn wiederherstellen, auch nicht, wer diesen Dienst betreibt.',
    notYet: 'Diese Veranstaltung nimmt noch keine Anmeldungen entgegen.',
    missing: 'Es fehlt noch: {what}',
    registrations: { one: '{n} Anmeldung', other: '{n} Anmeldungen' },
    withdrawn: 'zurückgenommen',
    withdraw: 'Zurücknehmen',
    classes: {
      normal: 'gewöhnlich', sensitive: 'sensibel',
      special: 'besondere Kategorie', secret: 'geheim'
    },
    sealedFor: 'Aus der Zeit vor deinem Beitritt — niemand kann das für dich öffnen.'
  },
  parish: {
    heading: 'Pfarrei',
    none: "Noch keine Pfarrei.",
    create: 'Neue Pfarrei',
    name: 'Name',
    location: 'Wo',
    make: 'Anlegen',

    slug: 'Name in der Adresse',
    officeName: "{name} — Verwaltung",
    officeIs: "Verwaltet von {name}",
    officeMissing: "Diese Pfarrei hat kein Amt. Sie haengt an der Person, die sie angelegt hat, und laesst sich nur weitergeben, indem man das Konto weitergibt.",
    officeAdd: "Amt anlegen",
    slugUnknown:
      'Dieser Name steht nicht auf der Liste und kann nicht angelegt werden. Adressen '
      + 'werden vorher festgelegt, weil sie weitergegeben und gedruckt werden — eine '
      + 'Pfarrei umzubenennen zerbraeche jeden Verweis auf sie.',
    slugAvailable: 'Vorgesehen',
    slugShape: 'Kleine Buchstaben, Ziffern und Bindestriche dazwischen.',

    adminIs: "{name} verwaltet diese Pfarrei.",
    stepOne: "Schritt 1 von 2",
    stepTwo: "Schritt 2 von 2",
    nameLead: "Der Name laesst sich spaeter aendern. Die Adresse nicht — sie wird weitergegeben, gedruckt und verlinkt.",
    lookTitle: "Wie die Seite aussieht",
    lookLead: "All das ist jederzeit anders zu haben.",
    finish: "Speichern und fertig",
    later: "Spaeter entscheiden",

    theme: "Farbe",
    themes: {"classic":"Klassisch","warm":"Warm","stone":"Stein","night":"Nacht"},
    modules: "Bausteine der Startseite",
    modulesLead: "Waehle, was dorthin gehoert. Die Reihenfolge folgt der Wahl.",
    moduleNames: {"masses":"Messplan","announcements":"Ankuendigungen","intentions":"Intentionen","calendar":"Kalender","news":"Neues","groups":"Gruppen","events":"Veranstaltungen","sacraments":"Sakramente","hours":"Kanzlei","contact":"Kontakt","gallery":"Bilder","sticky":"Aushang"},

    plan: 'Messplan',
    noMasses: 'Nichts angesetzt.',
    addMass: 'Messe ansetzen',
    church: 'Kirche',
    when: 'Wann',
    massTitle: 'Welche',
    duration: 'Minuten',
    collective: 'Mehrere Intentionen zugleich',
    collectiveWhy:
      'Eine Sammelmesse traegt mehrere Intentionen an einem Termin. Der Unterschied ist nicht kosmetisch: bei einer Einzelmesse gehoert die Intention dieser Messe, bei einer Sammelmesse teilen sich mehrere den Termin.',

    intentions: { one: '{n} Intention', other: '{n} Intentionen' },
    addIntention: 'Intention hinzufügen',
    publicText: 'Was im Schaukasten steht',
    publicWhy:
      'Das wird verlesen und gedruckt. Es liegt im Klartext, weil es öffentlich ist — es zu verschlüsseln und den Schlüssel mitzuliefern sähe nur nach Schutz aus.',
    internalText: 'Was wirklich gemeint ist',
    internalWhy:
      'Versiegelt unter dem Schlüssel dieses Bereichs. Niemand ausserhalb der Pfarrei liest es — auch nicht, wer diesen Dienst betreibt.',
    donor: 'Von wem',
    forMass: 'Zu welcher Messe',
    unassigned: 'noch ohne Termin',
    sealedPart: 'Hier steht ein Vermerk, den du nicht öffnen kannst.',

    offerings: 'Gaben',
    addOffering: 'Gabe eintragen',
    amount: 'Betrag',
    amountWhy:
      'Liegt immer versiegelt. Das heisst: eine Summe lässt sich nicht in der Datenbank bilden — wer eine braucht, holt die Zeilen und rechnet mit dem Schlüssel in der Hand.',
    currency: 'Währung',
    received: 'Erhalten',
    booked: 'Eingetragen'
  },
  graph: {
    heading: 'Wissen',
    none: 'Noch keine Bibliothek. Eine haengt an einem Bereich — leg sie dort an.',
    create: 'Neue Bibliothek',
    title: 'Titel',
    public: 'Offene Bibliothek',
    publicWhy:
      'Die Inhalte liegen im Klartext, der Server kann sie durchsuchen. Richtig für Vokabeln, Periodensysteme, Zeitleisten — Wissen, das ohnehin in jedem Lehrbuch steht.',
    privateWhy:
      'Die Inhalte liegen versiegelt. Der Server sieht Geheimtext und kann nicht darin suchen — dieser Browser sucht stattdessen, in dem, was er ohnehin geladen hat. Das skaliert schlechter. Es ist der Preis dafür, dass der Betreiber deine Notizen nicht lesen kann.',
    locked: 'Diese Wahl fällt einmal und lässt sich später nicht umlegen.',
    make: 'Anlegen',

    nodes: { one: '{n} Knoten', other: '{n} Knoten' },
    edges: { one: '{n} Kante', other: '{n} Kanten' },
    addNode: 'Knoten anlegen',
    kind: 'Art',
    value: 'Wert',
    ofKind: 'Von der Art',
    needsKind: 'Eine Entität braucht die Art, die sie beschreibt.',
    emptyNode: 'Noch nichts ausgefüllt',
    unreadable: 'Diesen kannst du nicht öffnen.',

    addEdge: 'Zwei Knoten verbinden',
    from: 'Von',
    to: 'Nach',
    relation: 'Beziehung',
    state: 'Wie sicher',
    states: {
      known: 'bekannt',
      approximate: 'ungefähr',
      disputed: 'umstritten',
      unknown: 'nicht bekannt',
      not_applicable: 'trifft nicht zu',
      pending: 'noch offen'
    },
    stateWhy:
      '„Nicht bekannt" ist eine Aussage und kein fehlender Wert. Das zu sagen ist etwas anderes, als nichts zu sagen — genau dafür gibt es dieses Modell.',
    note: 'Notiz',

    search: 'Suchen',
    searchHint: 'Tippen, um diese Bibliothek zu durchsuchen.',
    foundServer: 'Auf dem Server gesucht.',
    foundBrowser: 'Hier im Browser gesucht.',
    browserWhy:
      'Die Inhalte liegen versiegelt, der Server kann nicht darin suchen. Gesucht wird in dem, was geladen ist — und das ist nicht zwingend alles.',
    nothing: 'Nichts gefunden.',
    kinds: {
      text: 'Text', number: 'Zahl', date: 'Datum', boolean: 'ja/nein', media: 'Datei',
      entity: 'Entität', entity_kind: 'Art von Entität', edge_kind: 'Art von Beziehung',
      range: 'Bereich', knowledge: 'Wissen', topic: 'Thema', question: 'Frage'
    }
  },
  cal: {
    heading: 'Kalender',
    none: 'Noch kein Kalender. Einer hängt an einem Bereich — leg ihn dort an.',
    create: 'Neuer Kalender',
    title: 'Titel',
    zone: 'Zeitzone',
    zoneWhy:
      'Wiederholungen werden darin gerechnet. „Jeden Montag um neun" bleibt über die Zeitumstellung hinweg um neun — in UTC bliebe es das nicht.',
    make: 'Anlegen',

    nothing: 'Nichts in diesem Zeitraum.',
    busy: 'Belegt',
    sealedItem: 'Hier steht etwas, das du nicht öffnen kannst.',
    moved: 'verschoben',
    clashes: { one: '{n} Überschneidung', other: '{n} Überschneidungen' },
    clashWhy:
      'Zwei Termine überlappen sich. Das lässt sich prüfen, weil die Zeiten im Klartext liegen — dafür wird bezahlt.',

    add: 'Eintrag hinzufügen',
    when: 'Von',
    until: 'Bis',
    allDay: 'Ganztägig',
    publicTitle: 'Was andere sehen',
    publicWhy:
      'Liegt im Klartext. Lass es leer, dann sehen andere nur „belegt" — und das ist oft die richtige Antwort.',
    privateTitle: 'Was es wirklich ist',
    privateWhy:
      'Versiegelt unter dem Schlüssel dieses Bereichs. Niemand von aussen liest es — auch nicht, wer diesen Dienst betreibt.',
    where: 'Wo',
    notes: 'Notizen',
    visibility: 'Wer es sieht',
    visibilities: { private: 'nur ich', area: 'der Bereich', public: 'alle' },
    repeat: 'Wiederholt sich',
    repeats: { none: 'einmalig', daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich', yearly: 'jährlich' },
    every: 'alle',
    times: 'mal',
    repeatWhy:
      'Eine Wiederholung braucht ein Ende — eine Anzahl. Ohne eines lässt sie sich nicht ausrechnen, nur abschneiden, und jede Ansicht schneidet woanders ab.',
    weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],

    cancelOne: 'Diesen absagen',
    moveOne: 'Diesen verschieben',
    seriesKept:
      'Die Reihe bleibt eine Regel. Einen Termin abzusagen schreibt eine Ausnahme — es macht aus „jeden Montag" nicht fünfzig Einzeleinträge.'
  },
  conf: {
    heading: 'Firmung',
    none: 'Noch kein Jahrgang.',
    create: 'Neuer Jahrgang',
    name: 'Name',
    ownArea: 'Bereich für die Akten',
    ownAreaWhy:
      'Ein eigener Bereich, nicht der der Pfarrei. Wer den Messplan pflegt, soll damit nicht auch an die Akten der Kinder kommen — dafür ist ein Bereich da.',
    make: 'Anlegen',

    candidates: { one: '{n} Kandidat', other: '{n} Kandidaten' },
    outstanding: { one: '{n} hat noch etwas offen', other: '{n} haben noch etwas offen' },
    outstandingWhy:
      'Aus den Ablaufmerkern gerechnet, ohne einen einzigen Datensatz zu öffnen. Genau dafür liegen sie im Klartext — sie sagen nichts über die Person.',
    noCandidates: 'Noch niemand aufgenommen.',
    add: 'Jemanden aufnehmen',
    born: 'Geboren',
    contact: 'Kontakt (Eltern)',
    school: 'Schule',
    baptism: 'Getauft in',
    sealedWhy:
      'All das liegt versiegelt unter dem Schlüssel dieses Bereichs. Niemand von aussen liest es — auch nicht, wer diesen Dienst betreibt.',
    sealedCandidate: 'Hier ist jemand, den du nicht öffnen kannst.',
    withdrawn: 'ausgetreten',
    withdraw: 'Austragen',
    withdrawWhy:
      'Die Felder werden vernichtet, die Zeile bleibt. „Waren es nun vierzig oder einundvierzig" ist genau die Frage, die eine solche Liste beantworten soll.',

    steps: { consent: 'Einwilligung', paper: 'Papier', quiz: 'Quiz' },
    stepsDone: 'alles da',

    notes: { one: '{n} Notiz', other: '{n} Notizen' },
    addNote: 'Notiz hinzufügen',
    noteText: 'Notiz',
    forFamily: 'Die Familie darf das lesen',
    forFamilyWhy:
      'Beide liegen versiegelt. Diese ist nicht öffentlich — sie ist nur für einen weiteren Kreis sichtbar. Ein Kind hat kein „öffentlich".',
    internalOnly: 'intern',

    slots: 'Treffen',
    noSlots: 'Nichts angesetzt.',
    addSlot: 'Treffen ansetzen',
    when: 'Wann',
    capacity: 'Plätze',
    label: 'Wofür',
    free: { one: '{n} Platz frei', other: '{n} Plätze frei' },
    full: 'voll',
    book: 'Platz belegen',
    booked: 'belegt',
    pick: 'Für wen'
  },
  account: {
    heading: "Dein Konto",
    lead: "Dieses Konto erreicht {roles} Rollen. Die Zeichnung zeigt, was woran haengt — eine Rolle ist erreichbar wegen des Weges, nicht von sich aus.",
    locked: "Schliess deine Schluessel auf, um deine Rollen zu sehen.",
    loading: "Der Graph wird gelesen…",
    areaNode: "Bereich",
    accountNode: "Konto",
    accountYou: "Du",
    unnamed: "Ohne Namen",
    noKey: "kein Schluessel",
    rolesHeading: "Deine Rollen",
    personsHeading: "Personen",
    noPersons: "An diesem Konto haengt noch keine Person.",
    signInFirst: "Die Werkzeuge brauchen ein Konto. Ohne eines geht unten nichts auf.",
    signInDo: "Anmelden",
  },
  roles: {
    kinds: {
      person: "Person",
      group: "Gruppe",
      office: "Amt",
      service: "Dienst",
    },
    relations: {
      holds: "haelt",
      inherits: "erbt von",
      supervises: "beaufsichtigt",
    },
    rename: "Umbenennen",
    titles: "Titel",
    noTitles: "noch keiner",
    titleHint: "z. B. ks., dr",
    addTitle: "Anfuegen",
    removeTitle: "Diesen Titel entfernen",
    moveLeft: "Nach links",
    moveRight: "Nach rechts",
    alias: "Name",
    preview: "Steht dann da:",
    save: "Sichern",
    cancel: "Abbrechen",
    renameWarns: "Der Name liegt an der Rolle und nicht als Kopie in allem, was sie je geschrieben hat. Eine Aenderung wirkt ueberall — auch ueber alten Eintraegen.",
  },
  person: {
    heading: "Person",
    lead: "Jede Angabe ist einzeln verschluesselt und einzeln freigebbar. Wer eine Telefonnummer bekommt, bekommt die Telefonnummer — und nichts daneben.",
    locked: "Schliess deine Schluessel auf, um diese Angaben zu sehen.",
    loading: "Die Angaben werden geoeffnet…",
    unnamed: "Ohne Namen",
    noRole: "Diese Adresse nennt keine Person.",
    toAccount: "Zum Konto",
    fields: {
      PersonGivenName: "Vorname",
      PersonSurname: "Nachname",
      PersonPhone: "Telefon",
      PersonBorn: "Geburtsdatum",
    },
    addAnother: "Noch eine Nummer",
    add: "Eintragen",
    change: "Aendern",
    save: "Sichern",
    cancel: "Abbrechen",
    sealed: "Hinterlegt, aber nicht fuer dich lesbar.",
    share: "Freigeben",
    shareWhat: "Die andere Rolle bekommt den Schluessel zu DIESER einen Angabe. Nicht zu den anderen und nicht zur Person.",
    shareTo: "Rolle",
    shareToHint: "Rollenkennung",
    shareDo: "Schluessel geben",
    destroy: "Vernichten",
    destroyReason: "Vom Eigentuemer entfernt",
    showLog: "Wer hat gelesen",
    logHeading: "Zugriffe",
    logEmpty: "Noch nicht gelesen.",
    logHide: "Zuklappen",
    logNote: "Jeder Blick auf diese Angaben wird eingetragen — auch dein eigener. Ein Protokoll, das den haeufigsten Fall auslaesst, beantwortet spaeter nichts.",
  },
  status: {
    heading: 'Was bisher steht',
    done: 'gebaut und geprüft',
    building: 'im Bau',
    planned: 'geplant'
  },
  lang: { en: 'English', pl: 'Polski', de: 'Deutsch' }
};

export const rcCopy: Record<RcLang, RcCopy> = { en, pl, de };

/**
 * Polnisch hat drei Kategorien, Englisch und Deutsch zwei. `Intl.PluralRules`
 * kennt die Regeln; sie hier nachzubauen wäre der klassische Fehler.
 */
export function rcPlural(lang: RcLang, forms: RcPlural, n: number): string {
  const category = new Intl.PluralRules(lang).select(n);
  const form =
    (category === 'one' && forms.one) ||
    (category === 'few' && forms.few) ||
    (category === 'many' && forms.many) ||
    forms.other;
  return form.replace('{n}', String(n));
}

export const rcFormat = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));

const STORAGE_KEY = 'rc.lang';

export function rcDetectLang(): RcLang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'pl' || stored === 'de') return stored;
  } catch {
    // Privater Modus oder gesperrter Speicher — dann eben die Browsersprache.
  }
  const nav = navigator.language.slice(0, 2).toLowerCase();
  return nav === 'pl' ? 'pl' : nav === 'de' ? 'de' : 'en';
}

export function rcStoreLang(lang: RcLang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ohne Speicher bleibt die Wahl für diese Sitzung — kein Grund zu scheitern.
  }
}
