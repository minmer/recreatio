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
    title: 'Recreatio',
    subtitle: 'The rebuilt platform. Encrypted by construction, provable by chain.',
    stage: 'Phase 0 — foundation',
    legacyHint: 'The current platform keeps running unchanged alongside this.',
    openLegacy: 'Open the current platform'
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
    title: 'Recreatio',
    subtitle: 'Platforma zbudowana od nowa. Szyfrowana z założenia, dowodliwa przez łańcuch.',
    stage: 'Faza 0 — fundament',
    legacyHint: 'Obecna platforma działa dalej bez zmian, obok tej.',
    openLegacy: 'Otwórz obecną platformę'
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
    title: 'Recreatio',
    subtitle: 'Die neu gebaute Plattform. Verschlüsselt von Bauart, beweisbar durch die Kette.',
    stage: 'Phase 0 — Fundament',
    legacyHint: 'Die bisherige Plattform läuft unverändert daneben weiter.',
    openLegacy: 'Bisherige Plattform öffnen'
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
