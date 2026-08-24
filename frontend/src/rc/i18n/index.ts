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
