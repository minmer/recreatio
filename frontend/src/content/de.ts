import type { Copy } from './types';

export const de: Copy = {
  nav: {
    home: 'Start',
    parish: 'Pfarrei',
    cogita: 'Cogita',
    faq: 'FAQ',
    legal: 'DSGVO und Regeln',
    login: 'Anmelden',
    account: 'Profil'
  },
  accountMenu: {
    profile: 'Benutzereinstellungen',
    secureModeOn: 'Sicheren Modus aktivieren',
    secureModeOff: 'Sicheren Modus deaktivieren',
    logout: 'Abmelden'
  },
  hero: {
    headline: 'REcreatio — Plattform für Vertrauen und gemeinsames Wissen.',
    subtitle:
      'Wir verbinden Bildung, Pfarreien und Gemeinschaften in einem Ökosystem, in dem der Datenzugriff kryptografisch gesteuert wird.',
    ctaPrimary: 'Zum Login',
    ctaSecondary: 'Portale entdecken'
  },
  modules: {
    title: 'Öffentliche Portale und kommende Module',
    items: [
      {
        title: 'Pfarrei',
        desc: 'Intentionen, Bekanntmachungen, Kalender und Spenden — öffentlich und sicher.',
        tag: 'öffentlich',
        route: 'parish'
      },
      {
        title: 'Cogita',
        desc: 'Wissensraum, Quiz und gemeinsames Erstellen von Bildungsinhalten.',
        tag: 'öffentlich',
        route: 'cogita'
      },
      {
        title: 'Benutzerbereich',
        desc: 'Profileinstellungen, Rollen, Zugangsschlüssel und Aktivitätsverlauf.',
        tag: 'bald',
        route: 'account'
      }
    ]
  },
  access: {
    title: 'Zugang zu REcreatio',
    subtitle: 'Login ermöglicht Verwaltung, öffentliche Portale bleiben ohne Konto zugänglich.',
    login: 'Anmelden',
    register: 'Registrieren',
    loginId: 'Login (Benutzername oder E-Mail)',
    password: 'Passwort',
    confirm: 'Passwort bestätigen',
    displayName: 'Öffentlicher Nickname (optional)',
    secureMode: 'Sicherer Modus (kein Schlüssel-Cache)',
    create: 'Konto erstellen',
    signIn: 'Anmelden',
    statusTitle: 'Status',
    statusReady: 'Bereit.',
    loginRequired: 'Login und Passwort sind erforderlich.',
    loginError: 'Anmeldung fehlgeschlagen.',
    registerError: 'Registrierung fehlgeschlagen.',
    loginTaken: 'Login ist bereits vergeben.',
    passwordMismatch: 'Passwörter stimmen nicht überein.',
    passwordTooShort: 'Mindestens 8 Zeichen verwenden.',
    passwordCommon: 'Dieses Passwort ist zu häufig.',
    passwordWeak: 'Nutze Groß-/Kleinbuchstaben, Zahl und Symbol.',
    passwordStrong: 'Starkes Passwort.',
    loadingLogin: 'Anmeldung…',
    loadingRegister: 'Registrierung…',
    sessionLabel: 'Sitzung',
    checkSession: 'Sitzung prüfen',
    toggleMode: 'Modus wechseln',
    logout: 'Abmelden'
  },
  dashboard: {
    title: 'Dashboard nach Login',
    subtitle: 'Hier erscheinen Module, Kurzlinks und Sicherheitshinweise.',
    cards: [
      {
        title: 'Profileinstellungen',
        desc: 'Bald: persönliche Daten, Rollen und Sicherheit.',
        action: 'Öffnen (bald)',
        route: 'account'
      },
      {
        title: 'Pfarrei',
        desc: 'Zugang zu Intentionen, Bekanntmachungen und Adminbereich.',
        action: 'Portal öffnen',
        route: 'parish'
      },
      {
        title: 'Cogita',
        desc: 'Zugang zu Wissen, Quiz und Bildungsinhalten.',
        action: 'Portal öffnen',
        route: 'cogita'
      }
    ]
  },
  parish: {
    title: 'Pfarrportal',
    subtitle:
      'Öffentliche Informationen sind ohne Login zugänglich. Konten sind für Bearbeitung und Verwaltung erforderlich.',
    items: [
      'Intentionen und Spenden — sicher und auditiert.',
      'Bekanntmachungen und Veranstaltungskalender.',
      'Öffentliche Zusammenfassungen und geschützte Finanzdaten.'
    ],
    note: 'Öffentliche Inhalte sind bereits sichtbar. Adminfunktionen erscheinen nach Login.',
    loginCta: 'Mit REcreatio anmelden'
  },
  cogita: {
    title: 'Cogita Portal',
    subtitle:
      'Wissensbereich und gemeinsames Erstellen von Inhalten. Öffentliches Lesen, Konto für Bearbeitung.',
    items: [
      'Live-Quiz und interaktive Module.',
      'Wissensbibliothek und Bildungstools.',
      'Teilen von Materialien mit Zugangskontrolle.'
    ],
    note: 'Cogita kann auch unter eigener Domain laufen, z.B. cogita.pl — ohne Backend-Änderung.',
    loginCta: 'Mit REcreatio anmelden',
    shell: {
      back: 'Zurück',
      up: 'Oben'
    },
    user: {
      librariesKicker: 'Bibliotheken',
      librariesTitle: 'Deine Wissensbibliotheken',
      librariesSubtitle: 'Erstelle eine Bibliotheksrolle und betrete sie, um verschlüsselte Karteikarten und Verbindungen zu verwalten.',
      createLibraryTitle: 'Neue Bibliothek erstellen',
      libraryNameLabel: 'Bibliotheksname',
      libraryNamePlaceholder: 'z.B. Mittelalterliche Theologie',
      createLibraryAction: 'Bibliothek erstellen',
      availableLibraries: 'Verfügbare Bibliotheken',
      loadingLibraries: 'Bibliotheken werden geladen...',
      noLibraries: 'Noch keine Bibliotheken. Erstelle eine, um zu starten.',
      libraryRoleLabel: 'Bibliotheksrolle',
      openOverview: 'Übersicht öffnen',
      openCards: 'Karten öffnen',
      libraryNameRequired: 'Bibliotheksname ist erforderlich.',
      libraryCreateFailed: 'Bibliothek konnte noch nicht erstellt werden.'
    },
    introSlides: [
      {
        id: 'entry',
        title: 'Cogita.',
        subtitle: 'Eine Live-Wissensbühne für Lernen und Dialog.',
        micro: 'Steig ein und sieh, wie dich die Wissenskarte führt.',
        cta: 'Tour starten'
      },
      {
        id: 'workspace',
        title: 'Den nächsten Schritt bekommst du erst, wenn du bereit bist.',
        body:
          'Neues Wissen öffnet sich erst, wenn das vorherige sitzt.\nFehlt die Basis, stärkt Cogita sie — und führt dann weiter.',
        micro: 'Ein Lernbaum, der dich leitet.',
        cta: 'Weiter: Wie es führt'
      },
      {
        id: 'library',
        title: 'Wissen zum Wiederverwenden — nicht nur zum Lesen.',
        body:
          'Speichere Ideen als strukturierte Karten: Zusammenfassung, Zitat, Quelle, Tags.\nNutze sie für Argumente und Notizen, ohne Kontextverlust.',
        micro: 'Deine persönliche Wissensbox.',
        cta: 'Weiter: Live-Kollaboration'
      },
      {
        id: 'live',
        title: 'Wissen lebt im Gespräch.',
        body:
          'Du lernst schneller, wenn du mit anderen denkst.\nEine gemeinsame Fragerunde macht Lernen zum Dialog.',
        micro: 'Fragen, antworten, erklären.',
        cta: 'Weiter: Das gemeinsame Spiel'
      },
      {
        id: 'quiz',
        title: 'Sieh deinen Fortschritt — und was als Nächstes zählt.',
        body:
          'Verfolge dein Wachstum und vergleiche es mit der Gruppe.\nFinde Lücken und verbinde dich mit ähnlichem Niveau.',
        micro: 'Klare Rückmeldung, kein Raten.',
        cta: 'Weiter: Vertrauen & Schutz'
      },
      {
        id: 'protection',
        title: 'Offen, aber geschützt.',
        body: 'Privates bleibt privat — Zugang ist kontrolliert, Daten sind geschützt.',
        micro: 'Vertrauen als Fundament.',
        cta: 'Weiter: Beitreten'
      },
      {
        id: 'register',
        title: 'Jetzt zu Cogita.',
        body: 'Erstelle ein Konto und starte deine erste Wissensszene.',
        micro: 'Dauert nur einen Moment.',
        cta: 'Registrieren',
        secondary: 'Zurück zum Start'
      }
    ],
    page: {
      nav: [
        { id: 'home', label: 'Start' },
        { id: 'library', label: 'Bibliothek' },
        { id: 'live', label: 'Live' },
        { id: 'participation', label: 'Teilnahme' },
        { id: 'results', label: 'Ergebnisse' },
        { id: 'security', label: 'Sicherheit' },
        { id: 'join', label: 'Einstieg' }
      ],
      hero: {
        tag: 'Cogita',
        title: 'Ein Live-Wissensraum für Quiz, Dialog und gemeinsames Lernen.',
        subtitle:
          'Quiz entwerfen, Live-Sessions steuern und jedem Teilnehmenden eine persönliche Ergebnisansicht geben. Cogita hält Inhalte offen und Schlüssel privat.',
        primaryCta: 'Mit REcreatio starten',
        secondaryCta: 'Unterseiten entdecken'
      },
      homeSlides: [
        {
          id: 'overview',
          title: 'Cogita. Eine Live-Bühne für Wissen und Dialog.',
          text:
            'Ein Präsentationsraum für Quiz, Sessions und Ressourcen, offen für alle und geschützt durch Kryptografie.',
          ctaLabel: 'Tour starten'
        },
        {
          id: 'library',
          title: 'Wissensbibliothek mit wiederverwendbaren Quiz-Stapeln.',
          text: 'Lektionen bauen, Ressourcen anhängen und kuratierte Sammlungen teilen.',
          ctaLabel: 'Weiter: Live'
        },
        {
          id: 'live',
          title: 'Live-Sessions mit kontrolliertem Tempo.',
          text: 'Session starten, Code teilen und die Gruppe durch jede Runde führen.',
          ctaLabel: 'Weiter: Teilnahme'
        },
        {
          id: 'results',
          title: 'Teilnahme, Ergebnisse und SharedViews.',
          text: 'Jede Person erhält eine eigene Ergebnisansicht, auch ohne Konto.',
          ctaLabel: 'Weiter: Sicherheit'
        },
        {
          id: 'security',
          title: 'Sicherheit in jedem Schritt.',
          text: 'Rollenbasierte Schlüssel, Audit-Trail und eigene Domains wie cogita.pl.',
          ctaLabel: 'Weiter: Login',
          variant: 'secondary'
        },
        {
          id: 'login',
          title: 'Bereit für Cogita?',
          text: 'Mit REcreatio anmelden, um Quiz zu erstellen, Sessions zu hosten und Wissen zu steuern.',
          ctaLabel: 'Anmelden über REcreatio'
        }
      ],
      stats: [
        { value: '3 Modi', label: 'Lehrkraft, Lernende, Gast' },
        { value: '1 Link', label: 'QR oder Session-Code' },
        { value: '0 Vertrauen', label: 'Schlüssel regeln Zugriff' }
      ],
      highlights: [
        {
          title: 'Live-Session-Steuerung',
          desc: 'Sessions starten, pausieren und beenden — mit synchronem Tempo.'
        },
        {
          title: 'Anonym bereit',
          desc: 'Teilnehmende ohne Konto erhalten trotzdem eine private Ergebnisansicht.'
        },
        {
          title: 'Audit-first',
          desc: 'Jede Änderung wird protokolliert und ist rollenbasiert nachvollziehbar.'
        }
      ],
      sections: [
        {
          id: 'library',
          tag: 'Wissensbibliothek',
          title: 'Lektion aufbauen, Quiz-Stapel wiederverwenden, Kontext bewahren.',
          subtitle: 'Quiz und Materialien mit Vorlagen, Versionierung und Co-Authoring erstellen.',
          cards: [
            {
              title: 'Quiz-Builder',
              desc: 'Fragebanken, Vorlagen und zufällige Varianten für Assessments.',
              meta: 'Vorlagen + Generator'
            },
            {
              title: 'Knowledge Boards',
              desc: 'Themen bündeln, Materialien anhängen und Kontext sichtbar halten.',
              meta: 'Sammlungen + Tags'
            },
            {
              title: 'Gemeinsames Bearbeiten',
              desc: 'Rollenbasiert entwerfen, prüfen und veröffentlichen.',
              meta: 'Rollenbasierter Zugriff'
            }
          ],
          bullets: [
            'Wiederverwendbare Fragenvorlagen mit Parametern.',
            'Lesestoff, Medien und Links direkt am Block.',
            'Öffentliche Vorschauen ohne Preisgabe der Lösungen.'
          ]
        },
        {
          id: 'live',
          tag: 'Live-Sessions',
          title: 'Live-Teilnahme steuern, ohne den Fokus zu verlieren.',
          subtitle: 'Session starten, Code teilen und die Gruppe in Echtzeit begleiten.',
          cards: [
            {
              title: 'Session-Desk',
              desc: 'Fragen sperren, Zeit steuern und Runden live begleiten.',
              meta: 'Lehrkraft-Steuerung'
            },
            {
              title: 'Sofort-Feedback',
              desc: 'Antworten sammeln, Trends zeigen und Ergebnisse dosiert freigeben.',
              meta: 'Live-Dashboard'
            },
            {
              title: 'Gruppierung',
              desc: 'Auf Klassen begrenzen oder für Gäste öffnen.',
              meta: 'Klassenfokus'
            }
          ],
          bullets: [
            'Quiz mit sofortigem Feedback und Moderation.',
            'Unterstützung für angemeldete und anonyme Teilnehmende.',
            'QR-Ansichten für persönliche Ergebnisse.'
          ]
        },
        {
          id: 'participation',
          tag: 'Teilnahme',
          title: 'Teilnahme so flexibel wie die Gruppe.',
          subtitle: 'Drei Zugangsarten mit passenden Datenansichten.',
          cards: [
            {
              title: 'Angemeldete Lernende',
              desc: 'Ergebnisse bleiben mit dem Konto verknüpft.',
              meta: 'Konto-basiert'
            },
            {
              title: 'Anonyme Gäste',
              desc: 'Sofort beitreten per QR, mit privatem Ergebnislink.',
              meta: 'Ohne Konto'
            },
            {
              title: 'Später übernehmen',
              desc: 'Gäste können Ergebnisse nachträglich an ein Konto binden.',
              meta: 'SharedView'
            }
          ],
          bullets: [
            'QR-basierter Einstieg mit SharedViews.',
            'Persönliche Ergebnislinks bleiben privat und widerrufbar.',
            'Historie bleibt beim späteren Konto erhalten.'
          ]
        },
        {
          id: 'results',
          tag: 'Ergebnisse',
          title: 'Lernsignale sehen, nicht nur Punkte.',
          subtitle: 'Zeit, Korrektheit und Gruppendynamik ohne Rohdaten preiszugeben.',
          cards: [
            {
              title: 'Zeit vs. Genauigkeit',
              desc: 'Erkennen, wo Unsicherheit entsteht und wo Klarheit wächst.',
              meta: 'Analytics'
            },
            {
              title: 'Session-Review',
              desc: 'Fragen mit aggregierten Mustern erneut betrachten.',
              meta: 'Nachbereitung'
            },
            {
              title: 'Export-Ansichten',
              desc: 'Zusammenfassungen teilen, ohne Antworten offenzulegen.',
              meta: 'Kontrollierte Reports'
            }
          ],
          bullets: [
            'Aggregierte Einblicke ohne Einblick in Einzelantworten.',
            'QR-Ansichten für persönliche Ergebnisse.',
            'Vertrauen durch auditierbare Zusammenfassungen.'
          ]
        },
        {
          id: 'security',
          tag: 'Sicherheit',
          title: 'Zugriff wird durch Schlüssel erzwungen.',
          subtitle: 'Cogita nutzt REcreatio-Kryptografie für Ende-zu-Ende-Schutz.',
          cards: [
            {
              title: 'Rollenbasierte Schlüssel',
              desc: 'Lehrkräfte, Admins und Klassen steuern eigene Datenkeys.',
              meta: 'Key Ledger'
            },
            {
              title: 'SharedViews',
              desc: 'Anonyme Ergebnisse sind strikt pro Teilnehmer begrenzt.',
              meta: 'QR-Sicherheit'
            },
            {
              title: 'Audit Trail',
              desc: 'Änderungen an Quiz und Sessions sind nachvollziehbar.',
              meta: 'Auth Ledger'
            }
          ],
          bullets: [
            'Verschlüsselte Konfiguration und Antwortspeicherung.',
            'Kein Zugriff ohne passende Rollenschlüssel.',
            'Secure Mode deaktiviert Key-Caching.'
          ]
        }
      ],
      join: {
        title: 'Einstieg in Cogita',
        subtitle: 'Zum Erstellen anmelden oder öffentliche Inhalte direkt ansehen.',
        cards: [
          {
            title: 'Anmelden zum Erstellen',
            desc: 'Quiz entwerfen, Sessions steuern und Mitwirkende einladen.',
            action: 'Anmelden'
          },
          {
            title: 'Öffentliche Bereiche ansehen',
            desc: 'Wissensboards und Demo-Sessions entdecken.',
            action: 'Entdecken'
          },
          {
            title: 'Pilotprojekt planen',
            desc: 'Mit Schule oder Community eine erste Runde starten.',
            action: 'Kontakt'
          }
        ]
      }
    },
    library: {
      nav: {
        overview: 'Übersicht',
        list: 'Kartenliste',
        add: 'Info hinzufügen',
        collections: 'Sammlungen'
      },
      navLabel: 'Bibliotheksnavigation',
      sidebar: {
        title: 'Bibliothekskarte',
        sections: {
          library: 'Bibliothek',
          cards: 'Karten',
          collections: 'Sammlungen',
          currentCollection: 'Aktuelle Sammlung'
        },
        items: {
          overview: 'Übersicht',
          list: 'Karten durchsuchen',
          add: 'Neue Info hinzufügen',
          collections: 'Alle Sammlungen',
          createCollection: 'Sammlung erstellen',
          collectionDetail: 'Sammlungsdetails',
          revisionSettings: 'Wiederholungseinstellungen',
          revisionRun: 'Wiederholung starten'
        }
      },
      actions: {
        backToCogita: 'Zurück zu Cogita',
        libraryOverview: 'Bibliotheksübersicht',
        openList: 'Liste öffnen',
        collections: 'Sammlungen',
        addInfo: 'Neue Info hinzufügen',
        createCollection: 'Sammlung erstellen',
        saveCollection: 'Sammlung speichern',
        startRevision: 'Wiederholung starten',
        collectionDetail: 'Sammlungsdetails'
      },
      infoTypes: {
        any: 'Alle Karteikarten',
        vocab: 'Vokabelkarte',
        language: 'Sprache',
        word: 'Wort',
        sentence: 'Satz / Zitat',
        topic: 'Thema',
        collection: 'Sammlung',
        person: 'Person',
        address: 'Adresse',
        email: 'E-Mail',
        phone: 'Telefon',
        book: 'Buch',
        media: 'Medien',
        geo: 'Geo',
        musicPiece: 'Musikstück',
        musicFragment: 'Musikfragment'
      },
      connectionTypes: {
        wordLanguage: 'Wort - Sprache',
        wordTopic: 'Wort - Thema',
        languageSentence: 'Sprache - Satz',
        translation: 'Übersetzungsverknüpfung'
      },
      groupTypes: {
        vocab: 'Vokabelkarte'
      },
      overview: {
        kicker: 'Bibliothek',
        subtitle: 'Übersicht deiner verschlüsselten Karteikartenbibliothek.',
        stats: {
          totalInfos: 'Gesamtinfos',
          connections: 'Verbindungen',
          words: 'Wörter',
          sentences: 'Sätze',
          languages: 'Sprachen',
          collections: 'Sammlungen'
        },
        quickActionsTitle: 'Schnellaktionen',
        quickActionsText: 'Zur Liste wechseln, um Karten zu durchsuchen oder einen neuen Eintrag hinzuzufügen.',
        browseList: 'Liste öffnen',
        viewCollections: 'Sammlungen ansehen',
        addInfo: 'Info hinzufügen',
        seedMock: 'Mock-Daten anlegen',
        seedSuccess: 'Mock-Daten bereit: {languages} Sprachen, {translations} Vokabelkarten.',
        seedFail: 'Mock-Daten konnten nicht erstellt werden.',
        focusTitle: 'Was ist enthalten?',
        focusBody1: 'Jede Infokarte ist verschlüsselt und über Beziehungen verknüpft.',
        focusBody2: 'Nutze die Liste zum Erkunden und füge neue Wissensknoten hinzu.',
        transferTitle: 'Export & Import',
        transferBody: 'Export entschlüsselt die Bibliothek in ein JSON-Bundle. Import erstellt sie mit neuen Schlüsseln neu.',
        export: 'Bibliothek exportieren',
        import: 'Bundle importieren',
        exportReady: 'Export bereit.',
        exportFail: 'Export fehlgeschlagen.',
        importDone: 'Import abgeschlossen.',
        importFail: 'Import fehlgeschlagen.'
      },
      list: {
        kicker: 'Bibliotheksliste',
        subtitle: 'Alle verschlüsselten Infokarten durchsuchen.',
        searchTitle: 'Suche',
        searchPlaceholder: 'Suche nach Text, Name oder Label',
        cardCount: '{shown} von {total} Karten',
        cardTypeInfo: 'Info',
        cardTypeConnection: 'Verbindung',
        cardTypeVocab: 'Vokabeln',
        modes: {
          detail: 'Detail',
          collection: 'Sammlung',
          list: 'Liste'
        },
        selectedTitle: 'Ausgewählte Info',
        selectedEmpty: 'Info auswählen',
        selectedHint: 'Nutze die Hinzufügen-Seite, um Verknüpfungen oder Vokabeln zu erstellen.',
        noMatch: 'Keine passenden Infos gefunden.',
        addInfo: 'Info hinzufügen',
        loadMore: 'Mehr laden',
        loading: 'Lädt...',
        ready: 'Bereit'
      },
      filters: {
        title: 'Filter',
        clear: 'Filter zurücksetzen',
        languageA: 'Sprache A',
        languageB: 'Sprache B',
        topic: 'Thema',
        level: 'Übersetzungs-Tag',
        placeholderLanguageA: 'Nach Sprache A filtern',
        placeholderLanguageB: 'Nach Sprache B filtern',
        placeholderTopic: 'Nach Thema filtern',
        placeholderLevel: 'Nach Übersetzungs-Tag filtern'
      },
      add: {
        kicker: 'Info hinzufügen',
        subtitle: 'Neue Infokarten, Verknüpfungen oder Vokabeln erstellen.',
        tabs: {
          info: 'info',
          connection: 'verbindung',
          group: 'gruppe'
        },
        tabDesc: {
          info: 'Sprache, Wort, Satz, Thema, Person oder Daten hinzufügen.',
          connection: 'Zwei oder mehr Infos mit einer Beziehung verbinden.',
          group: 'Vokabel-Links aus Wörtern, Sprachen und Übersetzungen erstellen.'
        },
        info: {
          typeLabel: 'Infotyp',
          labelLabel: 'Label',
          labelPlaceholder: 'Titel, Name oder Haupttext',
          languageLabel: 'Sprache',
          languagePlaceholder: 'Sprache suchen oder erstellen',
          notesLabel: 'Notizen',
          notesPlaceholder: 'Beschreibung, Zitathinweis oder Metadaten',
          save: 'Info speichern',
          saved: 'Info gespeichert.',
          failed: 'Info konnte nicht gespeichert werden.'
        },
        connection: {
          typeLabel: 'Verbindungstyp',
          languageLabel: 'Sprache',
          languagePlaceholder: 'Sprache suchen oder erstellen',
          wordLabel: 'Wort',
          wordPlaceholder: 'Wort suchen oder erstellen',
          wordALabel: 'Wort A',
          wordAPlaceholder: 'Wort A suchen oder erstellen',
          wordBLabel: 'Wort B',
          wordBPlaceholder: 'Wort B suchen oder erstellen',
          sentenceLabel: 'Satz',
          sentencePlaceholder: 'Satz suchen oder erstellen',
          topicLabel: 'Thema',
          topicPlaceholder: 'Thema suchen oder erstellen',
          noteLabel: 'Notiz',
          notePlaceholder: 'Optionaler Kontext für die Verbindung',
          save: 'Verbindung speichern',
          saved: 'Verbindung gespeichert.',
          failed: 'Verbindung konnte nicht gespeichert werden.',
          pairExists: 'Dieses Wort gehört bereits zu dieser Sprache.',
          selectWordLanguage: 'Wähle eine Sprache und ein Wort.',
          selectWordTopic: 'Wähle ein Wort und ein Thema.',
          selectTwoWords: 'Wähle zwei Wörter zum Verknüpfen.',
          selectLanguageSentence: 'Wähle eine Sprache und einen Satz.'
        },
        group: {
          typeLabel: 'Gruppentyp',
          languageALabel: 'Sprache A',
          languageAPlaceholder: 'Sprache A suchen oder erstellen',
          wordATagsLabel: 'Tags für Wort A',
          wordATagsPlaceholder: 'Tags für Wort A suchen oder erstellen',
          wordBTagsLabel: 'Tags für Wort B',
          wordBTagsPlaceholder: 'Tags für Wort B suchen oder erstellen',
          translationTagsLabel: 'Tags für Übersetzung',
          translationTagsPlaceholder: 'Tags für Übersetzung suchen oder erstellen',
          wordALabel: 'Wort A',
          wordAPlaceholder: 'Wort A suchen oder erstellen',
          languageBLabel: 'Sprache B',
          languageBPlaceholder: 'Sprache B suchen oder erstellen',
          wordBLabel: 'Wort B',
          wordBPlaceholder: 'Wort B suchen oder erstellen',
          save: 'Vokabel-Links speichern',
          saved: 'Vokabelverknüpfungen gespeichert.',
          failed: 'Vokabelverknüpfungen konnten nicht gespeichert werden.',
          pairExistsA: 'Wort A gehört bereits zu Sprache A.',
          pairExistsB: 'Wort B gehört bereits zu Sprache B.',
          selectBoth: 'Wähle beide Sprachen und beide Wörter.'
        }
      },
      collections: {
        listKicker: 'Sammlungen',
        listSubtitle: 'Kuratierten Karteistapel für Wiederholung.',
        searchPlaceholder: 'Sammlungsname suchen',
        emptyTitle: 'Noch keine Sammlungen.',
        emptyAction: 'Erste Sammlung erstellen',
        countLabel: '{shown} von {total} Sammlungen',
        collectionLabel: 'Sammlung',
        noNotes: 'Keine Notizen',
        defaultName: 'Sammlung',
        itemCountLabel: '{count} Karten',
        detailKicker: 'Sammlungsdetails',
        detailSubtitle: 'Kuratierten Karteistapel für Wiederholung.',
        noCards: 'Noch keine Karten in dieser Sammlung.',
        detailFocusTitle: 'Wiederholungen vorbereiten',
        detailFocusBody: 'Erstelle Sammlungen aus Wörtern, Übersetzungen oder beliebigen Infos.',
        createKicker: 'Neue Sammlung',
        createSubtitle: 'Karten für fokussiertes Lernen bündeln.',
        collectionInfoTitle: 'Sammlungsinfo',
        nameLabel: 'Name',
        namePlaceholder: 'z.B. Deutsch Grundlagen',
        notesLabel: 'Notizen',
        notesPlaceholder: 'Fokus, Zeitplan oder Hinweise',
        saveRequiredName: 'Sammlungsname ist erforderlich.',
        saveSuccess: 'Sammlung gespeichert.',
        saveFail: 'Sammlung konnte nicht gespeichert werden.',
        findCardsTitle: 'Karten finden',
        searchCardsPlaceholder: 'Karten suchen',
        addToCollection: 'Zur Sammlung hinzufügen',
        added: 'Hinzugefügt',
        selectedCardsTitle: 'Ausgewählte Karten',
        selectedCountLabel: '{count} Einträge',
        noSelected: 'Noch keine Karten ausgewählt.',
        remove: 'Entfernen',
        loading: 'Lädt...',
        ready: 'Bereit'
      },
      revision: {
        settingsKicker: 'Wiederholungseinstellungen',
        settingsSubtitle: 'Wiederholungseinstellungen',
        runKicker: 'Wiederholung',
        modeSummary: 'Modus: {mode} · Prüfung: {check}',
        modeLabel: 'Modus',
        modeValue: 'Zufällig',
        checkLabel: 'Prüfung',
        checkValue: 'Exakte Übereinstimmung',
        cardsPerSessionLabel: 'Karten pro Sitzung',
        previewTitle: 'Zufällige Reihenfolge, exakte Antworten',
        previewBody1: 'Vokabelkarten fragen nach der Übersetzung.',
        previewBody2: 'Wortkarten fragen nach der Sprache.',
        start: 'Wiederholung starten',
        progressTitle: 'Fortschritt',
        loading: 'Wiederholungskarten werden geladen...',
        error: 'Karten konnten nicht geladen werden.',
        empty: 'Keine Karten für die Wiederholung.',
        completed: 'Wiederholung abgeschlossen. Gut gemacht!',
        vocabLabel: 'Vokabeln',
        infoLabel: 'Info',
        answerLabel: 'Deine Antwort',
        answerPlaceholder: 'Übersetzung eingeben',
        checkAnswer: 'Antwort prüfen',
        skip: 'Überspringen',
        hintSelectLanguage: 'Wähle die Sprache für dieses Wort.',
        hintReview: 'Karte prüfen und als erledigt markieren.',
        markDone: 'Als erledigt markieren',
        correct: 'Richtig',
        tryAgain: 'Nochmal',
        noLanguages: 'Keine Sprachen gefunden.'
      },
      lookup: {
        searchFailed: 'Suche fehlgeschlagen.',
        createFailed: 'Erstellung fehlgeschlagen.',
        createNew: 'Neu erstellen {type}',
        saving: 'Speichern...',
        loadMore: 'Mehr anzeigen'
      }
    }
  },
  faq: {
    title: 'FAQ und Sicherheit',
    items: [
      {
        q: 'Sind meine Daten verschlüsselt?',
        a: 'Ja. Daten sind mit Rollen-Schlüsseln verschlüsselt.\nOhne Schlüssel kein Zugriff, auch nicht für Administratoren.'
      },
      {
        q: 'Kennt der Server mein Passwort?',
        a: 'Nein. Das Passwort wird lokal verarbeitet, der Server speichert nur den Prüfwert.\nDie Datenbank speichert nie H1/H2/H3, nur H4.'
      },
      {
        q: 'Kann ich ohne Konto nutzen?',
        a: 'Ja. Öffentliche Portale (Pfarrei und Cogita) sind ohne Login verfügbar.'
      },
      {
        q: 'Was ist der sichere Modus?',
        a: 'Im sicheren Modus ist der Schlüssel-Cache deaktiviert.\nSchlüssel werden pro Anfrage rekonstruiert und sofort verworfen.'
      },
      {
        q: 'Gibt es einen klassischen Passwort-Reset?',
        a: 'Nein. Die Wiederherstellung erfordert ein Mehrpersonen-Verfahren und ein Audit.\nSo werden stille Resets verhindert.'
      },
      {
        q: 'Welche Kontozustände gibt es?',
        a: 'Konten können Pending, Active, Locked, Disabled oder Deleted sein.\nÄnderungen werden im Auth Ledger protokolliert.'
      },
      {
        q: 'Was passiert nach dem Login?',
        a: 'Es wird eine SessionId und ein Zugriffstoken erstellt.\nTokens enthalten keine Schlüssel oder sensible Daten.'
      },
      {
        q: 'Werden Änderungen protokolliert?',
        a: 'Ja. Wichtige Ereignisse werden im Auth Ledger erfasst.\nDas sorgt für Nachvollziehbarkeit und Kontrolle.'
      }
    ]
  },
  legal: {
    title: 'DSGVO, Regeln und Transparenz',
    items: [
      {
        title: 'Datenschutz und Richtlinien',
        desc:
          'Verantwortlicher: Parafia Rzymskokatolicka pw. sw. Jana Chrzciciela w Krakowie.\nAdresse: ul. Dobrego Pasterza 117, 31-416 Krakow, Polska.\nNIP 9451520798, REGON 040098025.\nKontakt: parafia@janchrzciciel.eu, tel. +48 12 412 58 50.'
      },
      {
        title: 'Zwecke und Rechtsgrundlagen',
        desc:
          'Zwecke: Kontoverwaltung, öffentliche Portale, Kommunikation, Sicherheit und Audits.\nRechtsgrundlagen: Einwilligung, Vertragserfüllung, berechtigtes Interesse, gesetzliche Pflichten.'
      },
      {
        title: 'Datenkategorien',
        desc:
          'Identifikation: Login, E-Mail, Name (falls angegeben).\nTechnisch: Sitzungs-IDs, Geräteinfos, Sicherheitslogs.\nPortalinhalte: freiwillig bereitgestellte Daten.'
      },
      {
        title: 'Empfänger und Auftragsverarbeiter',
        desc:
          'Hosting und Infrastruktur: Webio (Hosting Webio).\nIT-Unterstützung nur soweit für den Betrieb erforderlich.\nDaten werden nicht verkauft.'
      },
      {
        title: 'Sicherheitsmassnahmen',
        desc:
          'Verschlüsselung, rollenbasierte Zugriffe, Audit-Logs und eingeschränkter Admin-Zugang.\nKontinuierliche Überwachung und Sicherheitsprotokolle.'
      },
      {
        title: 'Regeln',
        desc: 'Nutzungsregeln, Rollen der Administratoren und Verantwortung der Nutzer.\nVerbot von Missbrauch und rechtswidrigen Handlungen.'
      },
      {
        title: 'Impressum',
        desc:
          'Technischer Kontakt: ks. Michael Mleczek, mleczek_pradnik@outlook.com.\nHosting: Webio (Hosting Webio), ul. Gwiazdzista 8/52, 66-400 Gorzow Wielkopolski, Polska.\nNIP 5992688099, REGON 080265578, e-mail: sprzedaz@webio.pl.'
      },
      {
        title: 'Speicherdauer',
        desc:
          'Kontodaten werden für die Dauer des Kontos und gemäß gesetzlichen Pflichten gespeichert.\nSicherheits- und Audit-Logs können länger aufbewahrt werden.'
      },
      {
        title: 'Datenübermittlung',
        desc:
          'Keine Übermittlung ausserhalb des Europäischen Wirtschaftsraums.\nKeine automatisierten Entscheidungen oder Profiling.'
      },
      {
        title: 'Datenschutzbeauftragter',
        desc: 'IOD: rodo@diecezja.krakow.pl, tel. +48 12 628 81 00, ul. Franciskańska 3, 31-004 Krakow, Polska.'
      },
      {
        title: 'Aufsichtsbehoerde',
        desc: 'Kościelny Inspektor Ochrony Danych (KIOD).\nAdresse: Skwer kard. Stefana Wyszynskiego 6, 01–015 Warszawa.\nE-mail: kiod@episkopat.pl.'
      },
      {
        title: 'Ihre Rechte',
        desc:
          'Recht auf Auskunft, Berichtigung, Löschung, Einschränkung und Datenübertragbarkeit.\nRecht auf Widerspruch und Beschwerde bei der Aufsichtsbehörde.'
      }
    ]
  },
  account: {
    title: 'Benutzereinstellungen',
    subtitle: 'Öffentliches Profil und Sicherheit verwalten.',
    overviewTitle: 'Überblick',
    overviewLead: 'Login muss keine E-Mail sein. Der Nickname ist öffentlich.',
    sections: {
      overview: 'Überblick',
      profile: 'Öffentliches Profil',
      roles: 'Rollen-Graph',
      security: 'Sicherheit'
    },
    menuLabel: 'Bereiche',
    loginIdLabel: 'Login',
    loginIdHint: 'Kann Benutzername oder E-Mail sein und ist nicht änderbar.',
    nicknameLabel: 'Öffentlicher Nickname',
    nicknameHint: 'Für andere sichtbar. Keine sensiblen Daten.',
    nicknamePlaceholder: 'Öffentlichen Nickname wählen',
    nicknameToggle: 'Nickname ändern',
    nicknameAction: 'Nickname speichern',
    nicknameWorking: 'Nickname wird gespeichert…',
    nicknameSuccess: 'Nickname aktualisiert.',
    nicknameError: 'Nickname konnte nicht aktualisiert werden.',
    passwordTitle: 'Passwort ändern',
    currentPassword: 'Aktuelles Passwort',
    newPassword: 'Neues Passwort',
    confirmPassword: 'Neues Passwort bestätigen',
    passwordToggle: 'Passwort ändern',
    passwordAction: 'Passwort aktualisieren',
    passwordWorking: 'Passwort wird aktualisiert…',
    passwordSuccess: 'Passwort wurde aktualisiert.',
    passwordError: 'Passwortänderung fehlgeschlagen.',
    secureModeTitle: 'Sicherer Modus',
    secureModeNote: 'Im sicheren Modus wird der Schlüssel-Cache deaktiviert.',
    secureModeEnable: 'Sicheren Modus aktivieren',
    secureModeDisable: 'Sicheren Modus deaktivieren',
    logoutAction: 'Abmelden',
    roles: {
      lead: 'Der Graph zeigt Rollen, Datenknoten und Schlüsselbeziehungen. Wähle Knoten oder Kanten für Details.',
      searchPlaceholder: 'Nach Nick oder Rollen-ID suchen',
      reachableToggle: 'Nur erreichbare vom gewählten Knoten',
      fullscreenEnter: 'Vollbild',
      fullscreenExit: 'Vollbild verlassen',
      noFilters: 'Keine Beziehungstypen.',
      loading: 'Graph wird geladen…',
      noNodes: 'Keine Rollen verfügbar.',
      panelTitle: 'Details',
      panelEmpty: 'Wähle eine Rolle oder Beziehung.',
      legendTitle: 'Legende',
      edgeTitle: 'Beziehung',
      edgeDeleteAction: 'Beziehung löschen',
      edgeDeleteWorking: 'Beziehung wird entfernt…',
      edgeDeleteSuccess: 'Beziehung entfernt.',
      edgeDeleteError: 'Beziehung konnte nicht entfernt werden.',
      linkDraftTitle: 'Letzte Verknüpfung',
      linkDraftHint: 'Die zuletzt im Graph erstellte Beziehung.',
      linkWorking: 'Rollen werden verknüpft…',
      linkSuccess: 'Beziehung gespeichert.',
      linkError: 'Rollen konnten nicht verknüpft werden.',
      createOwnedRole: 'Unterrolle erstellen',
      createOwnedRoleHint: 'Eigentümer ist die gewählte Rolle.',
      createRoleTitle: 'Neue Rolle',
      createRoleNickLabel: 'Rollen-Nick',
      createRoleKindLabel: 'Rollentyp',
      createRoleRelationLabel: 'Beziehung',
      createRoleAction: 'Rolle erstellen',
      createRoleWorking: 'Rolle wird erstellt…',
      createRoleSuccess: 'Rolle erstellt.',
      createRoleError: 'Rolle konnte nicht erstellt werden.',
      dataAddTitle: 'Datenfeld hinzufügen',
      dataFieldLabel: 'Feldtyp',
      dataKindLabel: 'Datentyp',
      dataKindData: 'Daten',
      dataKindKey: 'Schlüssel',
      dataValueLabel: 'Wert',
      dataAddAction: 'Feld hinzufügen',
      dataAddWorking: 'Daten werden gespeichert…',
      dataAddSuccess: 'Daten gespeichert.',
      dataAddError: 'Daten konnten nicht hinzugefügt werden.',
      dataEditTitle: 'Daten bearbeiten',
      dataEditAction: 'Daten speichern',
      dataEditWorking: 'Änderungen werden gespeichert…',
      dataEditSuccess: 'Daten aktualisiert.',
      dataEditError: 'Daten konnten nicht aktualisiert werden.',
      dataDeleteAction: 'Feld löschen',
      dataDeleteWorking: 'Daten werden entfernt…',
      dataDeleteSuccess: 'Daten entfernt.',
      dataDeleteError: 'Daten konnten nicht entfernt werden.',
      dataOwnerLabel: 'Owner-Rolle',
      dataShareTitle: 'Daten teilen',
      dataShareTargetLabel: 'Zielrollen-ID',
      dataSharePermissionLabel: 'Zugriffsart',
      dataShareAction: 'Daten teilen',
      dataShareWorking: 'Daten werden geteilt…',
      dataShareSuccess: 'Daten geteilt.',
      dataShareError: 'Daten konnten nicht geteilt werden.',
      shareRoleTitle: 'Rolle teilen',
      shareRoleTargetLabel: 'Zielrollen-ID',
      shareRoleRelationLabel: 'Zugriffstyp',
      shareRoleAction: 'Rolle teilen',
      shareRoleWorking: 'Rolle wird geteilt…',
      shareRoleSuccess: 'Rolle geteilt.',
      shareRoleError: 'Rolle konnte nicht geteilt werden.',
      shareRoleHint: 'Erstellt eine Einladung, die akzeptiert werden muss.',
      recoveryPrepareAction: 'Wiederherstellung vorbereiten',
      recoveryPrepareWorking: 'Wiederherstellung wird vorbereitet…',
      recoveryPrepareSuccess: 'Wiederherstellung vorbereitet.',
      recoveryPrepareError: 'Wiederherstellung konnte nicht vorbereitet werden.',
      recoveryPlanTitle: 'Wiederherstellung (Entwurf)',
      recoveryPlanHint: 'Owner-Rollen verbinden und dann den Schlüssel aktivieren.',
      recoveryPlanNeedsShares: 'Fehlt: mindestens eine Owner-Verbindung hinzufügen.',
      recoveryPlanLabel: 'Wiederherstellungsschlüssel',
      recoveryPlanError: 'Wähle den Wiederherstellungs-Entwurf aus.',
      recoveryShareWorking: 'Wiederherstellungsanteil wird hinzugefügt…',
      recoveryShareSuccess: 'Wiederherstellungsanteil hinzugefügt.',
      recoveryShareError: 'Wiederherstellungsanteil konnte nicht hinzugefügt werden.',
      recoveryActivateAction: 'Wiederherstellungsschlüssel erstellen',
      recoveryActivateWorking: 'Wiederherstellung wird aktiviert…',
      recoveryActivateSuccess: 'Wiederherstellung aktiviert.',
      recoveryActivateError: 'Wiederherstellung konnte nicht aktiviert werden.',
      contextAddRoleTitle: 'Rolle zum Graph hinzufügen',
      contextAddRolePlaceholder: 'Rollen-ID',
      contextAddRoleAction: 'Rolle anzeigen',
      contextAddRoleWorking: 'Rolle wird geladen…',
      contextAddRoleSuccess: 'Rolle hinzugefügt.',
      contextAddRoleError: 'Diese Rolle ist im Graph nicht verfügbar.',
      linkPermissionNeeded: 'Berechtigung zum Erstellen der Verbindung erforderlich.',
      contextAddData: 'Daten hinzufügen',
      contextPrepareRecovery: 'Wiederherstellung vorbereiten',
      contextClose: 'Schließen',
      pendingTitle: 'Offene Einladungen',
      pendingAction: 'Einladungen laden',
      pendingWorking: 'Einladungen werden geladen…',
      pendingError: 'Einladungen konnten nicht geladen werden.',
      pendingEmpty: 'Keine Einladungen.',
      pendingAccept: 'Annehmen',
      pendingDataTitle: 'Offene Datenfreigaben',
      pendingDataAction: 'Datenfreigaben laden',
      pendingDataWorking: 'Datenfreigaben werden geladen…',
      pendingDataError: 'Datenfreigaben konnten nicht geladen werden.',
      pendingDataEmpty: 'Keine Datenfreigaben.',
      parentsTitle: 'Übergeordnete Rollen',
      parentsAction: 'Eltern laden',
      parentsWorking: 'Eltern werden geladen…',
      parentsError: 'Eltern konnten nicht geladen werden.',
      parentsRemoved: 'Beziehung entfernt.',
      parentsRemoveAction: 'Entfernen',
      verifyTitle: 'Ledger-Prüfung',
      verifyAction: 'Signaturen prüfen',
      verifyWorking: 'Ledger wird geprüft…',
      verifyError: 'Prüfung fehlgeschlagen.',
      verifyHashOk: 'Hash-Kette OK',
      verifyHashIssue: 'Hash-Fehler',
      verifySigOk: 'Signaturen OK',
      verifySigIssue: 'Signaturproblem',
      verifyRoleSigned: 'Signiert von Rolle: {count}',
      relationNotesTitle: 'Bedeutung der Beziehungen',
      relationOwner: 'Owner — volle Kontrolle, Beziehungen ändern.',
      relationWrite: 'Write — Daten bearbeiten, keine Mitgliedschaft.',
      relationRead: 'Read — nur lesen.',
      viewGraph: 'Graph',
      viewDetails: 'Details',
      cancelAction: 'Abbrechen',
      incomingTitle: 'Eingehend',
      outgoingTitle: 'Ausgehend',
      none: 'Keine'
    }
  },
  footer: {
    headline: 'REcreatio — gemeinsames Ökosystem für Wissen und Vertrauen',
    contact: 'Kontakt: kontakt@recreatio.pl',
    imprint: 'Impressum & DSGVO',
    security: 'Sicherheitsdokumentation'
  },
  loginCard: {
    title: 'REcreatio',
    contextDefault: 'Zugang über REcreatio'
  }
};
