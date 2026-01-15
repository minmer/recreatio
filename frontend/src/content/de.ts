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
    loginCta: 'Mit REcreatio anmelden'
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
      persons: 'Personen',
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
      lead: 'Visualisiere Rollen und Beziehungen. Wähle Knoten oder Kanten für Details.',
      searchPlaceholder: 'Nach Nick oder Rollen-ID suchen',
      reachableToggle: 'Nur erreichbare vom gewählten Knoten',
      noFilters: 'Keine Beziehungstypen.',
      loading: 'Graph wird geladen…',
      noNodes: 'Keine Rollen verfügbar.',
      panelTitle: 'Details',
      panelEmpty: 'Wähle eine Rolle oder Beziehung.',
      edgeTitle: 'Beziehung',
      incomingTitle: 'Eingehend',
      outgoingTitle: 'Ausgehend',
      none: 'Keine'
    },
    persons: {
      lead: 'Personenrollen starten mit einem privaten Nick. Persönliche Daten werden separat und rollenbasiert verschlüsselt.',
      addToggle: 'Person hinzufügen',
      nameLabel: 'Nick',
      namePlaceholder: 'Private Bezeichnung (nicht der echte Name)',
      createAction: 'Person anlegen',
      createWorking: 'Person wird angelegt…',
      createSuccess: 'Person angelegt.',
      createError: 'Person konnte nicht angelegt werden.',
      createMissing: 'Nick ist erforderlich.',
      loading: 'Personen werden geladen…',
      empty: 'Noch keine Personen.',
      missingField: 'Fehlende Daten',
      encryptedPlaceholder: 'Verschlüsselter Wert',
      editToggle: 'Details bearbeiten',
      editAction: 'Speichern',
      editCancel: 'Abbrechen',
      editWorking: 'Speichern…',
      editSuccess: 'Person aktualisiert.',
      editError: 'Aktualisierung fehlgeschlagen.',
      dataTitle: 'Persönliche Daten',
      dataEmpty: 'Noch keine persönlichen Daten.',
      dataEdit: 'Bearbeiten',
      dataTypeLabel: 'Typ',
      dataTypePlaceholder: 'Name, Geburtstag, etc.',
      dataValueLabel: 'Wert',
      dataValuePlaceholder: 'Wert eingeben',
      dataAction: 'Daten speichern',
      dataWorking: 'Daten werden gespeichert…',
      dataSuccess: 'Daten aktualisiert.',
      dataError: 'Aktualisierung fehlgeschlagen.',
      dataMissing: 'Typ und Wert sind erforderlich.',
      dataNickReserved: 'Den Nick bearbeitest du im Personenprofil.',
      accessToggle: 'Zugriff',
      accessTitle: 'Zugriffsliste',
      accessRefresh: 'Aktualisieren',
      accessLoading: 'Zugriffsliste wird geladen…',
      accessError: 'Zugriffsliste nicht verfügbar.',
      accessEmpty: 'Keine geteilten Rollen.',
      pendingTitle: 'Ausstehende Freigaben',
      pendingAccept: 'Annehmen',
      pendingWorking: 'Freigabe wird angenommen…',
      pendingSuccess: 'Freigabe angenommen.',
      pendingError: 'Freigabe konnte nicht angenommen werden.',
      memberTitle: 'Mit Rolle teilen',
      lookupLabel: 'Per Nick suchen',
      lookupPlaceholder: 'Rollen-Nick eingeben',
      lookupAction: 'Rolle suchen',
      lookupWorking: 'Rollen werden gesucht…',
      lookupSuccess: 'Rollen geladen.',
      lookupError: 'Keine Rollen gefunden.',
      lookupMissing: 'Nick ist erforderlich.',
      memberRoleLabel: 'Zielrollen-ID',
      memberRolePlaceholder: 'Rollen-ID einfügen',
      memberTypeLabel: 'Zugriffsrolle',
      memberAction: 'Rolle teilen',
      memberWorking: 'Rolle wird geteilt…',
      memberSuccess: 'Rolle geteilt.',
      memberError: 'Teilen fehlgeschlagen.',
      memberMissing: 'Rollen-ID ist erforderlich.',
      roleOwner: 'Eigentümer',
      roleRead: 'Lesen',
      roleWrite: 'Schreiben',
      roleRecovery: 'Wiederherstellung'
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
