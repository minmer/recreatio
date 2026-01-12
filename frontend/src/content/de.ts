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
  hero: {
    headline: 'ReCreatio — Plattform fuer Vertrauen und gemeinsames Wissen.',
    subtitle:
      'Wir verbinden Bildung, Pfarreien und Gemeinschaften in einem Oekosystem, in dem der Datenzugriff kryptografisch gesteuert wird.',
    ctaPrimary: 'Zum Login',
    ctaSecondary: 'Portale entdecken'
  },
  modules: {
    title: 'Oeffentliche Portale und kommende Module',
    items: [
      {
        title: 'Pfarrei',
        desc: 'Intentionen, Bekanntmachungen, Kalender und Spenden — oeffentlich und sicher.',
        tag: 'oeffentlich',
        route: 'parish'
      },
      {
        title: 'Cogita',
        desc: 'Wissensraum, Quiz und gemeinsames Erstellen von Bildungsinhalten.',
        tag: 'oeffentlich',
        route: 'cogita'
      },
      {
        title: 'Benutzerbereich',
        desc: 'Profileinstellungen, Rollen, Zugangsschluessel und Aktivitaetsverlauf.',
        tag: 'bald',
        route: 'account'
      }
    ]
  },
  access: {
    title: 'Zugang zu ReCreatio',
    subtitle: 'Login ermoeglicht Verwaltung, oeffentliche Portale bleiben ohne Konto zugaenglich.',
    login: 'Anmelden',
    register: 'Registrieren',
    loginId: 'Login (E-Mail oder Name)',
    password: 'Passwort',
    confirm: 'Passwort bestaetigen',
    displayName: 'Name (optional)',
    secureMode: 'Sicherer Modus (kein Schluessel-Cache)',
    create: 'Konto erstellen',
    signIn: 'Anmelden',
    statusTitle: 'Status',
    statusReady: 'Bereit.',
    loginRequired: 'Login und Passwort sind erforderlich.',
    loginError: 'Anmeldung fehlgeschlagen.',
    registerError: 'Registrierung fehlgeschlagen.',
    loginTaken: 'Login ist bereits vergeben.',
    passwordMismatch: 'Passwoerter stimmen nicht ueberein.',
    loadingLogin: 'Anmeldung…',
    loadingRegister: 'Registrierung…',
    sessionLabel: 'Sitzung',
    checkSession: 'Sitzung pruefen',
    toggleMode: 'Modus wechseln',
    logout: 'Abmelden'
  },
  dashboard: {
    title: 'Dashboard nach Login',
    subtitle: 'Hier erscheinen Module, Kurzlinks und Sicherheitshinweise.',
    cards: [
      {
        title: 'Profileinstellungen',
        desc: 'Bald: persoenliche Daten, Rollen und Sicherheit.',
        action: 'Oeffnen (bald)',
        route: 'account'
      },
      {
        title: 'Pfarrei',
        desc: 'Zugang zu Intentionen, Bekanntmachungen und Adminbereich.',
        action: 'Portal oeffnen',
        route: 'parish'
      },
      {
        title: 'Cogita',
        desc: 'Zugang zu Wissen, Quiz und Bildungsinhalten.',
        action: 'Portal oeffnen',
        route: 'cogita'
      }
    ]
  },
  parish: {
    title: 'Pfarrportal',
    subtitle:
      'Oeffentliche Informationen sind ohne Login zugaenglich. Konten sind fuer Bearbeitung und Verwaltung erforderlich.',
    items: [
      'Intentionen und Spenden — sicher und auditiert.',
      'Bekanntmachungen und Veranstaltungskalender.',
      'Oeffentliche Zusammenfassungen und geschuetzte Finanzdaten.'
    ],
    note: 'Oeffentliche Inhalte sind bereits sichtbar. Adminfunktionen erscheinen nach Login.',
    loginCta: 'Mit ReCreatio anmelden'
  },
  cogita: {
    title: 'Cogita Portal',
    subtitle:
      'Wissensbereich und gemeinsames Erstellen von Inhalten. Oeffentliches Lesen, Konto fuer Bearbeitung.',
    items: [
      'Live-Quiz und interaktive Module.',
      'Wissensbibliothek und Bildungstools.',
      'Teilen von Materialien mit Zugangskontrolle.'
    ],
    note: 'Cogita kann auch unter eigener Domain laufen, z.B. cogita.pl — ohne Backend-Aenderung.',
    loginCta: 'Mit ReCreatio anmelden'
  },
  faq: {
    title: 'FAQ und Sicherheit',
    items: [
      {
        q: 'Sind meine Daten verschluesselt?',
        a: 'Ja. Daten sind mit Rollen-Schluesseln verschluesselt.\nOhne Schluessel kein Zugriff, auch nicht fuer Administratoren.'
      },
      {
        q: 'Kennt der Server mein Passwort?',
        a: 'Nein. Das Passwort wird lokal verarbeitet, der Server speichert nur den Pruefwert.\nDie Datenbank speichert nie H1/H2/H3, nur H4.'
      },
      {
        q: 'Kann ich ohne Konto nutzen?',
        a: 'Ja. Oeffentliche Portale (Pfarrei und Cogita) sind ohne Login verfuegbar.'
      },
      {
        q: 'Was ist der sichere Modus?',
        a: 'Im sicheren Modus ist der Schluessel-Cache deaktiviert.\nSchluessel werden pro Anfrage rekonstruiert und sofort verworfen.'
      },
      {
        q: 'Gibt es einen klassischen Passwort-Reset?',
        a: 'Nein. Die Wiederherstellung erfordert ein Mehrpersonen-Verfahren und ein Audit.\nSo werden stille Resets verhindert.'
      },
      {
        q: 'Welche Kontozustaende gibt es?',
        a: 'Konten koennen Pending, Active, Locked, Disabled oder Deleted sein.\nAenderungen werden im Auth Ledger protokolliert.'
      },
      {
        q: 'Was passiert nach dem Login?',
        a: 'Es wird eine SessionId und ein Zugriffstoken erstellt.\nTokens enthalten keine Schluessel oder sensible Daten.'
      },
      {
        q: 'Werden Aenderungen protokolliert?',
        a: 'Ja. Wichtige Ereignisse werden im Auth Ledger erfasst.\nDas sorgt fuer Nachvollziehbarkeit und Kontrolle.'
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
          'Zwecke: Kontoverwaltung, oeffentliche Portale, Kommunikation, Sicherheit und Audits.\nRechtsgrundlagen: Einwilligung, Vertragserfuellung, berechtigtes Interesse, gesetzliche Pflichten.'
      },
      {
        title: 'Datenkategorien',
        desc:
          'Identifikation: Login, E-Mail, Name (falls angegeben).\nTechnisch: Sitzungs-IDs, Geraeteinfos, Sicherheitslogs.\nPortalinhalte: freiwillig bereitgestellte Daten.'
      },
      {
        title: 'Empfaenger und Auftragsverarbeiter',
        desc:
          'Hosting und Infrastruktur: Webio (Hosting Webio).\nIT-Unterstuetzung nur soweit fuer den Betrieb erforderlich.\nDaten werden nicht verkauft.'
      },
      {
        title: 'Sicherheitsmassnahmen',
        desc:
          'Verschluesselung, rollenbasierte Zugriffe, Audit-Logs und eingeschraenkter Admin-Zugang.\nKontinuierliche Ueberwachung und Sicherheitsprotokolle.'
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
          'Kontodaten werden fuer die Dauer des Kontos und gemaess gesetzlichen Pflichten gespeichert.\nSicherheits- und Audit-Logs koennen laenger aufbewahrt werden.'
      },
      {
        title: 'Datenuebermittlung',
        desc:
          'Keine Uebermittlung ausserhalb des Europaeischen Wirtschaftsraums.\nKeine automatisierten Entscheidungen oder Profiling.'
      },
      {
        title: 'Datenschutzbeauftragter',
        desc: 'IOD: rodo@diecezja.krakow.pl, tel. +48 12 628 81 00, ul. Franciskanska 3, 31-004 Krakow, Polska.'
      },
      {
        title: 'Aufsichtsbehoerde',
        desc: 'Koescielny Inspektor Ochrony Danych (KIOD).\nAdresse: Skwer kard. Stefana Wyszynskiego 6, 01–015 Warszawa.\nE-mail: kiod@episkopat.pl.'
      },
      {
        title: 'Ihre Rechte',
        desc:
          'Recht auf Auskunft, Berichtigung, Loeschung, Einschraenkung und Datenuebertragbarkeit.\nRecht auf Widerspruch und Beschwerde bei der Aufsichtsbehoerde.'
      }
    ]
  },
  account: {
    title: 'Profileinstellungen',
    subtitle: 'Nur nach Login verfuegbar.',
    placeholder: 'Bald: persoenliche Daten, Rollen, Schluessel und Verlauf.'
  },
  footer: {
    headline: 'ReCreatio — gemeinsames Oekosystem fuer Wissen und Vertrauen',
    contact: 'Kontakt: kontakt@recreatio.pl',
    imprint: 'Impressum & DSGVO',
    security: 'Sicherheitsdokumentation'
  },
  loginCard: {
    title: 'ReCreatio',
    contextDefault: 'Zugang ueber ReCreatio'
  }
};
