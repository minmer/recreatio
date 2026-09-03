/**
 * Deutsch. Übersetzt aus dem Polnischen, nicht unabhängig davon geschrieben.
 * Eine deutsche Fassung, die etwas anderes sagt als die polnische, ist
 * schlimmer als gar keine.
 */

import type { PublicCopy } from './types';

export const de: PublicCopy = {
  meta: {
    siteName: 'REcreatio',
    description:
      'REcreatio — eine familiäre und seelsorgliche Initiative aus Limanowa. Das '
      + 'entstehende Haus für 52 Personen, Wallfahrten, Exerzitien, Bildung und Werkzeuge.',
    titleSuffix: 'REcreatio'
  },

  nav: {
    front: 'Start',
    recreatio: 'REcreatio',
    'o-nas': 'Über die Initiative',
    bezpieczenstwo: 'Sicherheit',
    przejrzystosc: 'Transparenz',
    kontakt: 'Kontakt',
    osrodek: 'Das Haus',
    wydarzenia: 'Veranstaltungen',
    biblioteka: 'Bibliothek',
    cogita: 'Cogita',
    narzedzia: 'Werkzeuge',
    wesprzyj: 'Mitmachen',

    menu: 'Menü',
    skipToContent: 'Zum Inhalt springen',
    signIn: 'Anmelden',
    register: 'Registrieren',
    access: 'Zugang',
    platform: 'Plattform',
    account: 'Konto',
    lock: 'Schlüssel sperren',
    signOut: 'Abmelden',
    more: 'Mehr'
  },

  front: {
    screen1: {
      wordmark: 'REcreatio',
      sentence: 'Eine Initiative für die integrale Entwicklung des Menschen',
      hint: 'Weiter'
    },

    scenes: [
      {
        label: 'Der Mensch ist ein Ganzes',
        bubbles: [
          { kind: 'title', lines: ['Der Mensch ist ein Ganzes'] },
          {
            kind: 'body',
            lines: [
              'Wir wachsen nicht getrennt — geistlich, geistig, seelisch oder körperlich. '
              + 'Das alles trifft sich in einem Menschen und in einem Leben. Deshalb will '
              + 'REcreatio Gelegenheiten zum Wachsen in allen diesen Richtungen schaffen: '
              + 'durch Formung, Gespräch, Arbeit, Lernen, Bewegung, Ruhe, Kultur und '
              + 'Gebet.'
            ]
          },
          {
            kind: 'close',
            lines: ['Kein weiteres Gebiet des Lebens.', 'Ein menschlicheres Leben im Ganzen.']
          },
          { kind: 'note', lines: ['in sich · in Gemeinschaft · mit Gott'] }
        ]
      },
      {
        label: 'Der Mensch braucht den Menschen',
        bubbles: [
          { kind: 'title', lines: ['Der Mensch braucht den Menschen'] },
          {
            kind: 'body',
            lines: [
              'Wir wollen keinen weiteren Ort schaffen, der den Menschen vor dem '
              + 'Bildschirm festhält. Wir wollen die Möglichkeiten der Gegenwart nutzen, '
              + 'damit es leichter wird, sich zu treffen, gemeinsam etwas auf die Beine '
              + 'zu stellen, zu lernen, aufzubrechen, ein gutes Buch zu lesen oder eine '
              + 'Gemeinschaft aufzubauen.',

              'Wir kehren zum Grundlegenden zurück — zu Beziehungen, Verantwortung, gutem '
              + 'Gespräch, gemeinsamer Arbeit, Ruhe und Gebet — und greifen dort zu den '
              + 'Werkzeugen der heutigen Welt, wo sie wirklich helfen.'
            ]
          },
          {
            kind: 'close',
            lines: ['Werkzeuge sollen ins Leben führen.', 'Nicht das Leben in die Werkzeuge.']
          }
        ]
      },
      {
        label: 'Deine Daten gehören dir',
        bubbles: [
          { kind: 'title', lines: ['Deine Daten gehören dir'] },
          {
            kind: 'body',
            lines: [
              'Wir wollen kein System bauen, das mehr über einen Menschen weiss, als es '
              + 'wirklich braucht.',

              'REcreatio soll nur die Daten erheben, die eine bestimmte Aufgabe zum '
              + 'Arbeiten braucht. Zugang zu einer Auskunft soll nur haben, wem er '
              + 'wirklich gegeben wurde — nicht ein einziger Verwalter, der von Amts '
              + 'wegen alles sehen kann.',

              'Wir wollen niemanden verfolgen und aus seinem Verhalten kein Profil '
              + 'bilden. Sicherheit und Privatheit sollen daraus folgen, wie das System '
              + 'gebaut ist, und nicht bloss aus einer Ordnung.'
            ]
          },
          {
            kind: 'close',
            lines: [
              'Weniger Daten.',
              'Weniger Verfolgung.',
              'Weniger unnötiger Zugang.',
              '',
              'Mehr Verfügung beim Menschen.',
              '',
              'Privatheit durch Beschränkung.',
              'Nicht durch Versprechen.'
            ]
          }
        ]
      }
    ],

    screen3: {
      title: 'Wie es geschieht',
      stages: 'Diese Teile sind verschieden weit.',
      works: [
        {
          name: 'Hortus Dei',
          body:
            'Das Haus in Limanowa, im Bau, für etwa 52 Personen. Exerzitien, '
            + 'Besinnungstage, Formung, Bildung und Erholung. Gedacht für Gruppen — '
            + 'Pfarreien, Gemeinschaften, Ministranten, Seelsorge, Pfadfinder, Schulen, '
            + 'Familien und Jugendinitiativen.',
          cta: 'Das Haus ansehen'
        },
        {
          name: 'Veranstaltungen',
          body:
            'Exerzitien, Wallfahrten zu Fuss und mit dem Rad, Fahrten sowie Sport- und '
            + 'Formungsveranstaltungen. Anstrengung, Gebet, Natur, Gespräch und das '
            + 'Überschreiten eigener Grenzen.',
          cta: 'Veranstaltungen ansehen'
        },
        {
          name: 'Cogita',
          body: 'Die Lernumgebung: Texte, Storyboards, Sammlungen, Wiederholung.',
          cta: 'Cogita ansehen'
        },
        {
          name: 'Und weiter',
          body:
            'Verlagsarbeit und das Bücherverzeichnis, Bildungsmaterialien, das '
            + 'Bildungsportal sowie Projekte für Kinder, Jugendliche und Familien.',
          cta: 'Zur Bibliothek'
        }
      ]
    }
  },

  manifest: {
    title: 'REcreatio',
    opening: {
      lead:
        'Eine familiäre und seelsorgliche Initiative aus Limanowa. Der Name sagt, worum '
        + 'es geht: Erneuerung, Ruhe und Erholung, den Menschen neu entdecken, '
        + 'geistliche Erneuerung und neue Schöpfung in Christus.',
      inFormation:
        'Die Stiftung gibt es noch nicht. Keine Registernummer, kein Vorstand, keine '
        + 'Satzung; wir sammeln keine Spenden und nennen kein Konto.'
    },

    mission: {
      title: 'Auftrag',
      body:
        'Die Entwicklung des Menschen im Ganzen: geistlich, religiös, sittlich, geistig, '
        + 'seelisch, sozial und körperlich. Grundlage ist das geistliche Leben; daraus '
        + 'folgen Familie, Erziehung, Bildung, Kultur, Gesundheit, Sport und Reisen.'
    },

    areas: {
      title: 'Sechs Bereiche',
      items: [
        {
          name: 'Geistliches Leben und Glaube',
          body: 'Exerzitien, Besinnungstage, Wallfahrten, Gebets- und Formungstreffen.'
        },
        {
          name: 'Familie',
          body: 'Unterstützung für Ehen, für die Bande zwischen Generationen und für Eltern.'
        },
        {
          name: 'Kinder und Jugendliche',
          body: 'Formung, Lager und Fahrten. Verantwortung, Reife, soziale Fähigkeiten.'
        },
        {
          name: 'Bildung',
          body: 'Kurse, Materialien, Verlagsarbeit und Bildungsportal. Daher Cogita und Bibliothek.'
        },
        {
          name: 'Gesundheit und integrale Entwicklung',
          body:
            'Vorbeugung für seelische, körperliche und soziale Gesundheit. Ohne '
            + 'Heilbehandlung — dafür braucht es eigene Befugnisse.'
        },
        {
          name: 'Wallfahrt, Sport und Abenteuer',
          body: 'Fahrten zu Fuss und mit dem Rad, Sport, Erholung, Reisen und Landeskunde.'
        }
      ]
    },

    inspiration: {
      title: 'Christliche Inspiration und Offenheit',
      body:
        'Die Inspiration ist das Evangelium und das christliche Bild vom Menschen: Würde '
        + 'der Person, Vorrang der Wahrheit, Freiheit und Verantwortung, Nächstenliebe, '
        + 'Dienst am Gemeinwohl. Die Teilnahme steht jedem offen, unabhängig von '
        + 'Bekenntnis und Weltanschauung, und ist freiwillig. Die christliche Prägung '
        + 'wird dabei nicht versteckt.'
    },

    family: {
      title: 'In einer Familie verwurzelt',
      body:
        'Getragen wird das Vorhaben von einer Familie. Werden soll es ein familiäres, '
        + 'weltliches Rechtssubjekt des Zivilrechts — keine kirchliche Einrichtung und '
        + 'keine „Familienstiftung" im rechtlichen Sinn. Zusammenarbeit mit Pfarreien '
        + 'und Gemeinschaften bei eigener Selbstständigkeit.'
    },

    road: {
      title: 'Wohin das führt',
      intro: 'Zuerst das Haus. Ohne Ort bleibt der Rest ein Plan.',
      steps: [
        'Das Haus in Limanowa.',
        'Eigene Exerzitien und Veranstaltungen.',
        'Das Haus für andere Gemeinschaften öffnen.',
        'Wallfahrten sowie Sport- und Formungsveranstaltungen.',
        'Bildungsmaterialien.',
        'Verlagsarbeit.',
        'Das Bildungsportal.',
        'Projekte für Kinder, Jugendliche und Familien.'
      ]
    },

    closing: ['Erneuern.', 'Ausruhen.', 'Wachsen.', 'Begegnen.']
  },

  security: {
    title: 'Sicherheit, und warum so',
    lead:
      'Die Werkzeuge von REcreatio sind anders gebaut als die meisten. Worin der '
      + 'Unterschied besteht und was er kostet, steht hier.',

    points: [
      {
        q: 'Es gibt keinen Verwalter',
        a:
          'Niemand auf unserer Seite kann deine Inhalte öffnen. Die Schlüssel entstehen '
          + 'auf deinem Gerät; der Server kennt sie nicht. Wer die ganze Datenbank '
          + 'stähle, bekäme verschlüsselte Blöcke und Datumsangaben.'
      },
      {
        q: 'Ein Passwort lässt sich nicht zurücksetzen — ein Konto lässt sich zurückholen',
        a:
          'Das Passwort verlässt das Gerät nicht. Hinaus geht nur ein Schlüssel, den '
          + 'Argon2id daraus errechnet, mit 64 MiB Speicher je Durchgang. Der Server '
          + 'kennt das Passwort nicht und kann es deshalb nicht ändern — eine E-Mail '
          + '„neues Passwort setzen" ist unmöglich. Das Zurückholen geht anders: du '
          + 'benennst mehrere Bürgen. Jeder hält einen Anteil, mit seinem eigenen '
          + 'Schlüssel verschlossen. Geben genügend viele ihren Anteil, kommt das Konto '
          + 'zurück. Ein Bürge genügt nicht, und ein einzelner Anteil sagt nichts.'
      },
      {
        q: 'Die Werkzeuge sind öffentlich, der Eingang führt über die Adresse',
        a:
          'Es gibt kein Verzeichnis und keine Suche über Gemeinschaften. Eine Adresse '
          + 'sieht so aus: /parish/limanowa, /cogita/name-der-bibliothek. Wer sie kennt, '
          + 'kommt hinein; wer nicht, stösst beim Blättern nicht darauf. Die Adresse '
          + 'allein öffnet nichts Verschlüsseltes — sie führt zu dem, was ohnehin offen '
          + 'ist, etwa dem Messplan im Schaukasten.'
      },
      {
        q: 'Du gibst keine Daten — du teilst deine',
        a:
          'Wir fragen nicht nach Daten, um sie aufzubewahren. Du behältst deine und gibst '
          + 'anderen einen Ausschnitt frei. Die Freigabe lässt sich zurücknehmen. Die '
          + 'Grenze, die wir offen nennen: das Zurücknehmen wirkt ab dem Zeitpunkt des '
          + 'Zurücknehmens. Wer vorher Zugang hatte, konnte bereits lesen, und das holt '
          + 'kein Knopf zurück. Neue Einträge sind für ihn ab dann verschlossen; die '
          + 'Vergangenheit bleibt die Vergangenheit. Etwas anderes zu versprechen wäre '
          + 'gelogen.'
      }
    ],

    originTitle: 'Woher diese Werkzeuge kommen',
    origin:
      'Keines ist als Ware entstanden. Jedes entstand bei einer konkreten Arbeit, bei '
      + 'der etwas fehlte: der Messplan mit den Intentionen, die Liste der Firmlinge, '
      + 'die Anmeldung zur Wallfahrt, der Kalender der Räume. Deshalb sind sie so, wie '
      + 'sie sind — und deshalb sagt ihr Zuschnitt etwas über die Initiative selbst: '
      + 'Dinge entstehen hier aus einem Bedarf, nicht umgekehrt. Was einmal gut gebaut '
      + 'ist, lässt sich anderen Gemeinschaften überlassen, und so wird es gehalten.',

    toolsTitle: 'Die Werkzeuge der Reihe nach',
    toolsIntro: 'Was jedes tut, und was dabei sichtbar ist und was nicht.',
    tools: [
      {
        name: 'Nachrichten',
        body:
          'Gespräch in einer Gruppe. Wer heute dazukommt, sieht nicht, was vorher '
          + 'geschrieben wurde — es sei denn, jemand gibt ihm bewusst den Schlüssel zur '
          + 'Vergangenheit. Ein Austritt schneidet eine Epoche: weitere Nachrichten sind '
          + 'für ihn unlesbar.'
      },
      {
        name: 'Kalender',
        body:
          'Die Zeit ist offen, der Inhalt nicht. Man sieht, dass jemand Dienstag um zehn '
          + 'belegt ist; womit, sieht man nicht. So lassen sich freie Zeiten finden, ohne '
          + 'irgendwem zu zeigen, was geschieht.'
      },
      {
        name: 'Belegung',
        body:
          'Dasselbe für Räume und Häuser: frei oder belegt, ohne Gruppennamen und ohne '
          + 'Kontakt. Ohne Konto einsehbar, damit eine Gruppe den Juli prüfen kann, ohne '
          + 'unterwegs etwas anzulegen.'
      },
      {
        name: 'Formulare',
        body:
          'Anmeldungen und Anfragen. Offen eingesandt, verschlüsselt abgelegt — '
          + 'verschlüsselt wird im Browser, bevor etwas das Gerät verlässt. Lesen kann '
          + 'nur, wer die Sache führt.'
      },
      {
        name: 'Pfarrei',
        body:
          'Messplan und Intentionen. Eine Zeile ist zugleich öffentlich und intern: „in '
          + 'einer bestimmten Absicht" im Schaukasten, und innen — in welcher und von wem.'
      },
      {
        name: 'Cogita',
        body:
          'Lernen: Storyboards, Texte, Sammlungen, Wiederholung und Sitzungen in Echtzeit. '
          + 'Inhalte dürfen offen sein; die Schlüssel bleiben privat.'
      }
    ]
  },

  about: {
    title: 'Über die Initiative',
    lead: 'Was REcreatio heute ist und was es noch nicht gibt.',
    whatInitiativeMeans: {
      title: 'Initiative, nicht Stiftung',
      body:
        'Es gibt keine juristische Person: keine Registernummer, keine Steuernummer, '
        + 'keinen Vorstand, keine Satzung, keinen Gemeinnützigkeitsstatus. Getragen wird '
        + 'es von einer Familie und den Menschen, die mit ihr arbeiten. Die Eintragung '
        + 'ist eine Absicht; bis dahin erscheint hier keine Registernummer und kein '
        + 'Spendenkonto.'
    },
    family: {
      title: 'Familie',
      body:
        'Das Vorhaben wächst aus einer Familie und aus der Verantwortung für seine '
        + 'Fortsetzung. Die angestrebte Form ist ein familiäres, weltliches Rechtssubjekt '
        + 'des Zivilrechts, das mit Pfarreien und Gemeinschaften zusammenarbeitet und '
        + 'dabei eigenständig bleibt.'
    },
    road: {
      title: 'Was geschehen muss',
      body:
        'Gründungsunterlagen, die schriftliche Zustimmung der kirchlichen Autorität, eine '
        + 'Buchhaltung und der notarielle Akt. Erst danach die Eintragung. Der '
        + 'Gemeinnützigkeitsstatus verlangt gesondert erfüllte gesetzliche Bedingungen '
        + 'und ein unabhängiges Prüfgremium.'
    },
    people: {
      title: 'Wer dahintersteht',
      body: { missing: 'Namen der Menschen und die Zustimmung, sie zu nennen' }
    }
  },

  transparency: {
    title: 'Transparenz',
    lead:
      'Wie die Tätigkeit der Initiative und das private Vermögen der Tragenden getrennt sind.',
    separation: {
      title: 'Tätigkeit und Privatvermögen',
      body:
        'Die Initiative hat keine Rechtspersönlichkeit und besitzt deshalb weder '
        + 'Grundstücke noch anderes Vermögen. Das Privatvermögen der Gründer bleibt '
        + 'davon getrennt.'
    },
    house: {
      title: 'Das Haus',
      body:
        'Das Haus in Limanowa bleibt Privateigentum und wird nicht in eine künftige '
        + 'Stiftung eingebracht — weder als Schenkung noch als Einlage. Nach einer '
        + 'etwaigen Eintragung würde es zu marktüblichen Bedingungen vermietet. Vorab '
        + 'festgelegt: ein Vertrag mit einer nahestehenden Person verlangt die Zustimmung '
        + 'des Aufsichtsorgans, den Nachweis marktüblicher Bedingungen und die '
        + 'Unterschrift einer von diesem Organ benannten Person; Aufwendungen auf das '
        + 'private Grundstück werden gesondert abgerechnet.'
    },
    notYet: {
      title: 'Was es noch nicht gibt',
      body:
        'Keine getrennte Buchhaltung, kein Gemeinnützigkeitsstatus, keine Prüfung. Das '
        + 'steht hier, weil das Fehlen dieses Satzes sich umgekehrt läse.'
    }
  },

  contact: {
    title: 'Kontakt',
    email: 'mleczek_grzegorzki@outlook.com',
    address: 'ul. Żuławskiego 3E\n34-600 Limanowa, Polen',
    people: 'Pfr. Michał Mleczek'
  },

  osrodek: {
    title: 'Das Haus in Limanowa',
    underConstruction:
      'Das Haus ist im Bau und nimmt noch keine Gäste auf. Was schon feststeht, steht '
      + 'hier, damit Gruppen vorausplanen können.',
    purpose: {
      title: 'Wofür es da ist',
      body: 'Exerzitien, Besinnungstage, Formung, Bildung und Erholung.'
    },
    capacity: {
      title: 'Wie viele Menschen',
      body: 'Etwa 52 Personen, vor allem Gruppen.',
      exact: { missing: 'Bestätigung, ob die Platzzahl genau 52 beträgt' },
      groups: [
        'Exerzitiengruppen',
        'Pfarrgruppen',
        'Ministranten',
        'Jugendgruppen',
        'Pfadfinder',
        'Familien',
        'Schulklassen',
        'Formungsgruppen',
        'Sport- und Wandergruppen'
      ]
    },
    character: {
      title: 'Der Charakter des Ortes',
      body: 'Einfach und gastfreundlich: Gebet, Arbeit, Lernen, Gespräch und Ruhe an einem Ort.'
    },
    facilities: {
      title: 'Was vor Ort ist',
      items: [
        'Schlafplätze',
        'ein gemeinsamer Raum',
        'ein Speisesaal',
        'eine Küche zur eigenen Nutzung durch die Gruppe'
      ]
    },
    openToOthers: {
      title: 'Nicht nur für uns',
      body: 'Das Haus dient nicht allein den eigenen Vorhaben. Eingeladen sind auch:',
      items: [
        'Pfarreien',
        'Gemeinschaften der Licht-Leben-Bewegung',
        'Ministrantengruppen',
        'Hochschul- und Schulseelsorge',
        'Pfadfinder',
        'Schulen',
        'soziale Organisationen',
        'Familien',
        'Jugendinitiativen'
      ]
    },
    supports: {
      title: 'Warum gegen Entgelt',
      body: 'Die Vermietung des Hauses trägt die übrige Arbeit der Initiative.'
    },
    where: {
      title: 'Wo',
      address: { missing: 'Anschrift des Hauses und die Entscheidung, sie vor der Eröffnung zu nennen' }
    },
    photos: { missing: 'Bilder des Hauses, der Umgebung und früherer Veranstaltungen' },

    availability: {
      title: 'Freie Zeiträume',
      intro: 'Welche Zeiträume noch frei sind.',
      showsNothingElse:
        'Die Liste zeigt ausschliesslich: frei oder belegt. Nicht, wer kommt, wozu, oder '
        + 'wie jemand zu erreichen wäre.',
      free: 'frei',
      held: 'vorgemerkt',
      taken: 'belegt',
      loading: 'Zeiträume werden geprüft …',
      unreachable:
        'Die Zeiträume liessen sich nicht abrufen. Das heisst nicht, dass sie belegt '
        + 'sind — bitte noch einmal versuchen oder schreiben.',
      noAccountNeeded: 'Für die Einsicht ist kein Konto nötig.',
      month: 'Monat',
      nothingPlanned: 'In diesem Monat ist noch nichts belegt.'
    },

    enquiry: {
      title: 'Anfrage für einen Zeitraum',
      intro: 'Formular ausfüllen, wir antworten.',
      brokeredNotBooked:
        'Das ist eine Anfrage, keine Buchung. Es wird nichts bezahlt, keine Anzahlung '
        + 'verlangt und über diese Seite kein Vertrag geschlossen.',
      groupName: 'Name der Gruppe',
      contactPerson: 'Ansprechpartner',
      contact: 'Telefon oder E-Mail',
      from: 'Zeitraum von',
      to: 'Zeitraum bis',
      people: 'Anzahl der Personen',
      groupKind: 'Art der Gruppe',
      note: 'Anmerkungen',
      submit: 'Anfrage senden',
      sending: 'Wird gesendet …',
      sent: 'Anfrage gesendet.',
      sentBody: 'Wir antworten auf dem angegebenen Weg.',
      failed:
        'Die Anfrage liess sich nicht senden. Bitte noch einmal versuchen oder an '
        + 'mleczek_grzegorzki@outlook.com schreiben.',
      sealedNote:
        'Das Formular verschlüsselt im Browser, bevor etwas das Gerät verlässt. Lesen '
        + 'kann es nur, wer das Haus führt.',
      required: 'Dieses Feld wird gebraucht.'
    }
  },

  wesprzyj: {
    title: 'Mitmachen',
    lead: 'Keiner dieser Wege besteht heute darin, Geld zu geben.',
    ways: [
      { name: 'Mitarbeit', body: 'Arbeit am Haus und Hilfe bei Veranstaltungen.' },
      {
        name: 'Wissen und Können',
        body: 'Handwerkliche, rechtliche, pädagogische oder technische Erfahrung.'
      },
      {
        name: 'Veranstaltungen mitgestalten',
        body: 'Exerzitien, Wallfahrten, Fahrten sowie Sport- und Formungsveranstaltungen.'
      },
      {
        name: 'Das Haus nutzen',
        body: 'Nach der Eröffnung trägt ein Aufenthalt mit einer Gruppe die übrige Arbeit.'
      },
      { name: 'Gebet', body: 'Hier nicht aus Höflichkeit genannt.' }
    ],
    financialLater:
      'Finanzielle Unterstützung wird nach Erhalt der Rechtsform eingerichtet. Bis dahin '
      + 'sammeln wir keine Spenden und nennen kein Konto.'
  },

  placeholders: {
    wydarzenia: {
      title: 'Veranstaltungen',
      body:
        'Wallfahrten zu Fuss und mit dem Rad, Fahrten, Exerzitien sowie Sport- und '
        + 'Formungsveranstaltungen. Anmeldung und Einzelheiten kommen hierher.',
      preparing: 'Dieser Teil wird vorbereitet.'
    },
    biblioteka: {
      title: 'Bibliothek',
      body:
        'Ein Verzeichnis der erschienenen Bücher mit dem, was beim Lesen hilft. Zugleich '
        + 'die Quelle der Belegstellen für Cogita.',
      preparing: 'Dieser Teil wird vorbereitet.'
    },
    cogita: {
      title: 'Cogita',
      body: 'Die Lernumgebung: Storyboards, Texte, Sammlungen, Wiederholung.',
      preparing: 'Dieser Teil wird vorbereitet.'
    }
  },

  tools: {
    title: 'Werkzeuge',
    lead:
      'Alles, was in REcreatio entsteht, und wo es zu finden ist. Jedes Werkzeug läuft '
      + 'für jede Gemeinschaft getrennt — eine Pfarrei, eine Gruppe, ein Jahrgang hat '
      + 'ihre eigene Adresse und ihre eigenen Daten.',

    addressTitle: 'Wie eine Adresse gebaut ist',
    address:
      'Erst der Teil, dann der Name: /parish/jan, nicht /jan. So dürfen zwei '
      + 'Gemeinschaften gleich heissen, und der Browser weiss schon aus der Adresse, ob '
      + 'er jemanden erkennen muss, bevor er etwas zeigt.',
    slug: 'name',

    openLabel: 'Ohne Schlüssel',
    embedded: 'Ohne eigene Adresse — wird in eine fremde Seite eingesetzt.',

    items: [
      {
        name: 'Pfarrei',
        part: 'parish',
        body:
          'Messplan, Intentionen und Gaben. Der Plan hängt im Schaukasten und tut es '
          + 'hier genauso; der Rest ist verschlossen.',
        open: 'Der Messplan ist ohne Konto zu sehen.'
      },
      {
        name: 'Veranstaltungen',
        part: 'event',
        body:
          'Exerzitien, Wallfahrten und Fahrten: Ankündigung, Einzelheiten und Anmeldung. '
          + 'Wer sie leitet, baut sie selbst.',
        open: 'Die Ankündigung ist ohne Konto zu sehen.'
      },
      {
        name: 'Cogita',
        part: 'cogita',
        body:
          'Die Lernumgebung: Texte, Storyboards, Sammlungen und Wiederholung, verbunden '
          + 'zu einem Wissensgraphen.',
        open: 'Nichts — es braucht einen Schlüssel.'
      },
      {
        name: 'Kalender',
        part: 'calendar',
        body:
          'Termine, Aufgaben und Wiederholungen. Die Zeit ist offen, der Inhalt nicht: '
          + 'man sieht, dass jemand belegt ist, nicht womit.',
        open: 'Belegt oder frei, ohne den Inhalt.'
      },
      {
        name: 'Nachrichten',
        part: 'chat',
        body:
          'Das Gespräch in der Gruppe, mit Epochen: wer heute dazukommt, liest nicht, '
          + 'was vorher stand — es sei denn, jemand öffnet es ihm eigens.',
        open: 'Nichts — es braucht einen Schlüssel.'
      },
      {
        name: 'Firmung',
        part: 'confirmation',
        body: 'Jahrgang, Kandidaten, Treffen und Anwesenheit. Geführt von der Katechese.',
        open: 'Nichts — es braucht einen Schlüssel.'
      },
      {
        name: 'Belegung und Anfragen',
        part: null,
        body:
          'Freie und belegte Zeiten von Räumen und Häusern, dazu das Anfrageformular. '
          + 'Wird in eine Seite eingesetzt — so wie hier beim Haus.',
        open: 'Frei und belegt ohne Konto; die Anfrage verschlüsselt der Browser.'
      }
    ],

    note:
      'Die Werkzeuge entstehen mit der Plattform und sind verschieden weit. Die '
      + 'Adressen stehen bereits fest und ändern sich nicht mehr.'
  },

  notFound: {
    title: 'Diese Seite gibt es nicht',
    body: 'Diese Adresse führt nirgendwohin. Der Link ist womöglich veraltet.',
    back: 'Zurück zur Startseite'
  },

  footer: {
    logoAlt: 'REcreatio',
    initiative: 'Eine Initiative im Entstehen.'
  },

  factNeeded: 'Fehlende Angabe',
  sourceTextNeeded: 'Quelltext'
};
