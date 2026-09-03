/**
 * Englisch. Übersetzt aus dem Polnischen, nicht unabhängig davon geschrieben.
 */

import type { PublicCopy } from './types';

export const en: PublicCopy = {
  meta: {
    siteName: 'REcreatio',
    description:
      'REcreatio — a family and pastoral initiative from Limanowa. A house for 52 people '
      + 'under construction, pilgrimages, retreats, formation and educational tools.',
    titleSuffix: 'REcreatio'
  },

  nav: {
    front: 'Start',
    recreatio: 'REcreatio',
    'o-nas': 'About the initiative',
    bezpieczenstwo: 'Security',
    przejrzystosc: 'Transparency',
    kontakt: 'Contact',
    osrodek: 'The house',
    wydarzenia: 'Events',
    biblioteka: 'Library',
    cogita: 'Cogita',
    narzedzia: 'Tools',
    wesprzyj: 'Get involved',

    menu: 'Menu',
    skipToContent: 'Skip to content',
    signIn: 'Sign in',
    register: 'Register',
    access: 'Access',
    platform: 'Platform',
    account: 'Account',
    lock: 'Lock keys',
    signOut: 'Sign out',
    more: 'More'
  },

  front: {
    screen1: {
      wordmark: 'REcreatio',
      sentence: 'An initiative working for the integral development of the person',
      hint: 'Scroll'
    },

    scenes: [
      {
        label: 'A person is a whole',
        bubbles: [
          { kind: 'title', lines: ['A person is a whole'] },
          {
            kind: 'body',
            lines: [
              'We do not grow separately — spiritually, intellectually, emotionally or '
              + 'physically. All of it meets in one person and in one life. That is why '
              + 'REcreatio wants to make room for growth in every one of those '
              + 'directions: through formation, conversation, work, study, movement, '
              + 'rest, culture and prayer.'
            ]
          },
          {
            kind: 'close',
            lines: ['Not one more area of life.', 'A more human life, whole.']
          },
          { kind: 'note', lines: ['in themselves · in community · with God'] }
        ]
      },
      {
        label: 'A person needs another person',
        bubbles: [
          { kind: 'title', lines: ['A person needs another person'] },
          {
            kind: 'body',
            lines: [
              'We do not want to build one more place that holds a person in front of a '
              + 'screen. We want to use what the present makes possible, so that it '
              + 'becomes easier to meet, to organise something together, to study, to set '
              + 'out on a road, to read a good book or to build a community.',

              'We are going back to the basic things — relationships, responsibility, '
              + 'good conversation, shared work, rest and prayer — reaching for the tools '
              + 'of the present world where they genuinely help.'
            ]
          },
          {
            kind: 'close',
            lines: ['Tools should lead into life.', 'Not life into tools.']
          }
        ]
      },
      {
        label: 'Your data is yours',
        bubbles: [
          { kind: 'title', lines: ['Your data is yours'] },
          {
            kind: 'body',
            lines: [
              'We do not want to build a system that knows more about a person than it '
              + 'truly needs to.',

              'REcreatio should collect only the data a particular function needs in '
              + 'order to work. Access to information should belong only to those who '
              + 'have actually been granted it — not to a single administrator who by '
              + 'definition can see everything.',

              'We do not want to track people or build profiles out of what they do. '
              + 'Security and privacy should follow from the way the system is built, and '
              + 'not from its terms alone.'
            ]
          },
          {
            kind: 'close',
            lines: [
              'Less data.',
              'Less tracking.',
              'Less access than needed.',
              '',
              'More control on the person’s side.',
              '',
              'Privacy by limitation.',
              'Not by promise.'
            ]
          }
        ]
      }
    ],

    screen3: {
      title: 'How this happens',
      stages: 'These parts are at different stages.',
      works: [
        {
          name: 'Hortus Dei',
          body:
            'The house in Limanowa, under construction, for about 52 people. Retreats, '
            + 'days of recollection, formation, education and rest. Intended for '
            + 'groups — parishes, communities, altar servers, chaplaincies, scouts, '
            + 'schools, families and youth initiatives.',
          cta: 'See the house'
        },
        {
          name: 'Events',
          body:
            'Retreats, pilgrimages on foot and by bicycle, expeditions, and sport and '
            + 'formation events. Effort, prayer, nature, conversation and going past '
            + 'one\'s own limits.',
          cta: 'See the events'
        },
        {
          name: 'Cogita',
          body: 'The learning environment: texts, storyboards, collections, repetition.',
          cta: 'See Cogita'
        },
        {
          name: 'And further',
          body:
            'Publishing and the book list, educational materials, the education portal, '
            + 'and projects for children, youth and families.',
          cta: 'To the library'
        }
      ]
    }
  },

  manifest: {
    title: 'REcreatio',
    opening: {
      lead:
        'A family and pastoral initiative from Limanowa. The name says what it is about: '
        + 'renewal, rest and recreation, rediscovering the person, spiritual renewal, and '
        + 'new creation in Christ.',
      inFormation:
        'The foundation does not exist yet. No registration number, no board, no statute; '
        + 'we collect no donations and give no account number.'
    },

    mission: {
      title: 'Mission',
      body:
        'The development of the person as a whole: spiritual, religious, moral, '
        + 'intellectual, psychological, social and physical. Spiritual life is the basis; '
        + 'from it follow family, upbringing, education, culture, health, sport and travel.'
    },

    areas: {
      title: 'Six areas',
      items: [
        {
          name: 'Spiritual life and faith',
          body: 'Retreats, days of recollection, pilgrimages, prayer and formation meetings.'
        },
        {
          name: 'Family',
          body: 'Support for marriages, for bonds between generations, and for parents.'
        },
        {
          name: 'Children and youth',
          body: 'Formation, camps and expeditions. Responsibility, maturity, social competence.'
        },
        {
          name: 'Education',
          body: 'Courses, materials, publishing and an education portal. Hence Cogita and the Library.'
        },
        {
          name: 'Health and integral development',
          body:
            'Prevention in mental, physical and social health. No medical treatment — that '
            + 'requires separate authorisation.'
        },
        {
          name: 'Pilgrimage, sport and adventure',
          body: 'Expeditions on foot and by bicycle, sport, recreation, travel and country lore.'
        }
      ]
    },

    inspiration: {
      title: 'Christian inspiration and openness',
      body:
        'The inspiration is the Gospel and the Christian vision of the person: the dignity '
        + 'of the person, the primacy of truth, freedom and responsibility, love of '
        + 'neighbour, service to the common good. Taking part is open to everyone, '
        + 'whatever their confession or worldview, and is voluntary. The Christian '
        + 'character is not hidden in the process.'
    },

    family: {
      title: 'Rooted in a family',
      body:
        'One family carries the undertaking. What it is to become is a family, secular '
        + 'body of civil law — not a church institution and not a "family foundation" in '
        + 'the legal sense. Cooperation with parishes and communities, with its own '
        + 'autonomy kept.'
    },

    road: {
      title: 'Where this is going',
      intro: 'The house first. Without a place the rest stays a plan.',
      steps: [
        'The house in Limanowa.',
        'Our own retreats and events.',
        'Opening the house to other communities.',
        'Pilgrimages and sport-formation events.',
        'Educational materials.',
        'Publishing.',
        'The education portal.',
        'Projects for children, youth and families.'
      ]
    },

    closing: ['Renew.', 'Rest.', 'Grow.', 'Meet.']
  },

  security: {
    title: 'Security, and why it is built this way',
    lead:
      'The REcreatio tools are built differently from most. What the difference is, and '
      + 'what it costs, is set out here.',

    points: [
      {
        q: 'There is no administrator',
        a:
          'Nobody on our side can open your content. The keys are created on your device; '
          + 'the server does not know them. Anyone stealing the whole database would get '
          + 'encrypted blocks and dates.'
      },
      {
        q: 'A password cannot be reset — an account can be recovered',
        a:
          'The password never leaves the device. What leaves is a key derived from it by '
          + 'Argon2id, at 64 MiB of memory per derivation. The server does not know the '
          + 'password and therefore cannot change it — a "set a new password" e-mail is '
          + 'impossible. Recovery works differently: you name several guarantors. Each '
          + 'holds one share, sealed with their own key. When enough of them hand their '
          + 'share over, the account comes back. One guarantor is not enough, and a single '
          + 'share says nothing.'
      },
      {
        q: 'The tools are public, but the way in is the address',
        a:
          'There is no directory and no search across communities. An address looks like '
          + 'this: /parish/limanowa, /cogita/library-name. Whoever knows it gets in; '
          + 'whoever does not will not stumble on it by browsing. The address alone opens '
          + 'nothing encrypted — it leads to what is public anyway, such as the mass '
          + 'schedule on the noticeboard.'
      },
      {
        q: 'You do not hand over data — you share your own',
        a:
          'We do not ask for data in order to keep it. You keep yours and release a '
          + 'section of it to others. A release can be withdrawn. The limit, said plainly: '
          + 'withdrawal takes effect from the moment of withdrawal. Whoever had access '
          + 'before could already read, and no button takes that back. New entries are '
          + 'closed to them from then on; the past stays the past. Promising otherwise '
          + 'would be a lie.'
      }
    ],

    originTitle: 'Where these tools come from',
    origin:
      'None was built as a product to sell. Each came out of a concrete piece of work '
      + 'where something was missing: the mass schedule with its intentions, the list of '
      + 'confirmation candidates, registration for a pilgrimage, the calendar of rooms. '
      + 'That is why they are shaped as they are — and why their shape says something '
      + 'about the initiative itself: things here come from a need, not the other way '
      + 'round. What is built well once can be handed to other communities, and that is '
      + 'how it is done.',

    toolsTitle: 'The tools one by one',
    toolsIntro: 'What each does, and what is visible in it and what is not.',
    tools: [
      {
        name: 'Chat',
        body:
          'Conversation in a group. Whoever joins today does not see what was written '
          + 'before — unless someone deliberately gives them the key to the past. Someone '
          + 'leaving cuts an epoch: further messages are unreadable for them.'
      },
      {
        name: 'Calendar',
        body:
          'Time is open, content is not. You can see that someone is busy on Tuesday at '
          + 'ten; not with what. That makes it possible to find free time without showing '
          + 'anyone what is going on.'
      },
      {
        name: 'Occupancy',
        body:
          'The same for rooms and houses: free or taken, with no group name and no '
          + 'contact. Visible without an account, so a group can check July without '
          + 'signing up for anything on the way.'
      },
      {
        name: 'Forms',
        body:
          'Registrations and enquiries. Sent openly, stored encrypted — the encryption '
          + 'happens in the browser before anything leaves the device. Only whoever runs '
          + 'the thing can read it.'
      },
      {
        name: 'Parish',
        body:
          'Mass schedule and intentions. One line is public and internal at the same time: '
          + '"for a particular intention" on the noticeboard, and inside — which one, and '
          + 'from whom.'
      },
      {
        name: 'Cogita',
        body:
          'Learning: storyboards, texts, collections, repetition and live sessions. Content '
          + 'may be public; the keys stay private.'
      }
    ]
  },

  about: {
    title: 'About the initiative',
    lead: 'What REcreatio is today, and what does not exist yet.',
    whatInitiativeMeans: {
      title: 'An initiative, not a foundation',
      body:
        'There is no legal entity: no registration number, no tax number, no board, no '
        + 'statute, no charity status. It is carried by a family and the people working '
        + 'with it. Registration is an intention; until then no registration number or '
        + 'donation account will appear here.'
    },
    family: {
      title: 'Family',
      body:
        'The undertaking grows out of one family and out of responsibility for continuing '
        + 'it. The intended form is a family, secular body of civil law, working with '
        + 'parishes and communities while keeping its own autonomy.'
    },
    road: {
      title: 'What has to happen',
      body:
        'Founding documents, written permission from the church authority, accounting, and '
        + 'the notarial deed. Only then registration. Charity status requires separately '
        + 'satisfied statutory conditions and an independent audit committee.'
    },
    people: {
      title: 'Who stands behind it',
      body: { missing: 'Names of the people and consent for them to appear' }
    }
  },

  transparency: {
    title: 'Transparency',
    lead:
      'How the initiative’s activity and the private property of those who carry it are '
      + 'kept apart.',
    separation: {
      title: 'Activity and private property',
      body:
        'The initiative has no legal personality and therefore owns neither property nor '
        + 'other assets. The founders’ private property stays separate from it.'
    },
    house: {
      title: 'The house',
      body:
        'The house in Limanowa remains private property and is not contributed to any '
        + 'future foundation — neither as a gift nor as an endowment. After any '
        + 'registration it would be let on market terms. Set in advance: a contract with a '
        + 'related person requires the approval of the supervisory body, documented market '
        + 'terms, and signature by someone that body designates; outlays on the private '
        + 'property are settled separately.'
    },
    notYet: {
      title: 'What does not exist yet',
      body:
        'No separate bookkeeping, no public-benefit status, no audit. This is stated '
        + 'because leaving it out would read as the opposite.'
    }
  },

  contact: {
    title: 'Contact',
    email: 'mleczek_grzegorzki@outlook.com',
    address: 'ul. Żuławskiego 3E\n34-600 Limanowa, Poland',
    people: 'Fr. Michał Mleczek'
  },

  osrodek: {
    title: 'The house in Limanowa',
    underConstruction:
      'The house is under construction and is not yet receiving guests. What is already '
      + 'settled is set out here, so that groups can plan ahead.',
    purpose: {
      title: 'What it is for',
      body: 'Retreats, days of recollection, formation, education and rest.'
    },
    capacity: {
      title: 'How many people',
      body: 'About 52 people, mainly groups.',
      exact: { missing: 'Confirmation that the capacity is exactly 52' },
      groups: [
        'retreat groups',
        'parish groups',
        'altar servers',
        'youth groups',
        'scouting groups',
        'families',
        'school groups',
        'formation groups',
        'sport and walking groups'
      ]
    },
    character: {
      title: 'The character of the place',
      body: 'Simple and hospitable: prayer, work, study, conversation and rest in one place.'
    },
    facilities: {
      title: 'What is there',
      items: [
        'sleeping places',
        'a common space',
        'a dining room',
        'a kitchen the group uses itself'
      ]
    },
    openToOthers: {
      title: 'Not only for us',
      body: 'The house does not serve only our own projects. Also welcome:',
      items: [
        'parishes',
        'Light-Life communities',
        'altar-server groups',
        'chaplaincies',
        'scouting',
        'schools',
        'social organisations',
        'families',
        'youth initiatives'
      ]
    },
    supports: {
      title: 'Why for a fee',
      body: 'Letting the house funds the rest of the initiative’s work.'
    },
    where: {
      title: 'Where',
      address: { missing: 'Address of the house, and whether to publish it before opening' }
    },
    photos: { missing: 'Photographs of the house, the area and past events' },

    availability: {
      title: 'Free periods',
      intro: 'Which periods are still free.',
      showsNothingElse:
        'The list shows only this: free or taken. Not who is coming, for what, or how to '
        + 'reach anyone.',
      free: 'free',
      held: 'held',
      taken: 'taken',
      loading: 'Checking periods…',
      unreachable:
        'The periods could not be loaded. That does not mean they are taken — please try '
        + 'again or write.',
      noAccountNeeded: 'No account is needed to look.',
      month: 'Month',
      nothingPlanned: 'Nothing is taken in this month yet.'
    },

    enquiry: {
      title: 'Enquire about a period',
      intro: 'Fill in the form, we will reply.',
      brokeredNotBooked:
        'This is an enquiry, not a booking. Nothing is paid, no deposit is taken, and no '
        + 'contract is concluded through this page.',
      groupName: 'Group name',
      contactPerson: 'Contact person',
      contact: 'Phone or e-mail',
      from: 'From',
      to: 'To',
      people: 'Number of people',
      groupKind: 'Kind of group',
      note: 'Notes',
      submit: 'Send enquiry',
      sending: 'Sending…',
      sent: 'Enquiry sent.',
      sentBody: 'We will reply by the means you gave.',
      failed:
        'The enquiry could not be sent. Please try again or write to mleczek_grzegorzki@outlook.com.',
      sealedNote:
        'The form encrypts in the browser before anything leaves the device. Only whoever '
        + 'runs the house can read it.',
      required: 'This field is needed.'
    }
  },

  wesprzyj: {
    title: 'Get involved',
    lead: 'None of these ways consists of giving money today.',
    ways: [
      { name: 'Volunteering', body: 'Work on the house and help at events.' },
      {
        name: 'Knowledge and skills',
        body: 'Building, legal, educational or technical experience.'
      },
      {
        name: 'Co-organising events',
        body: 'Retreats, pilgrimages, expeditions and sport-formation events.'
      },
      {
        name: 'Using the house',
        body: 'Once it opens, a stay with a group funds the rest of the work.'
      },
      { name: 'Prayer', body: 'Named here not out of politeness.' }
    ],
    financialLater:
      'Financial support will be set up once the legal form exists. Until then we collect '
      + 'no donations and give no account number.'
  },

  placeholders: {
    wydarzenia: {
      title: 'Events',
      body:
        'Pilgrimages on foot and by bicycle, expeditions, retreats, and sport and '
        + 'formation events. Registration and details will live here.',
      preparing: 'This part is being prepared.'
    },
    biblioteka: {
      title: 'Library',
      body:
        'A list of published books with what helps a reader use them. Also the citation '
        + 'source for Cogita.',
      preparing: 'This part is being prepared.'
    },
    cogita: {
      title: 'Cogita',
      body: 'The learning environment: storyboards, texts, collections, repetition.',
      preparing: 'This part is being prepared.'
    }
  },

  tools: {
    title: 'Tools',
    lead:
      'Everything being built in REcreatio, and where to find it. Each tool runs '
      + 'separately for each community — a parish, a group, a confirmation year has its '
      + 'own address and its own data.',

    addressTitle: 'How an address is built',
    address:
      'The part first, then the name: /parish/jan, not /jan. That way two communities '
      + 'may share a name, and the browser knows from the address alone whether it must '
      + 'recognise someone before showing anything.',
    slug: 'name',

    signIn: "The tools run on an account. Without one they open, but stay empty: what lies inside is sealed, and the key is derived from your password.",
    signInDo: "Sign in or create an account",

    liveTitle: "Already open",
    liveLead: "These pages are online and need no account. Anyone can read them.",

    openLabel: 'Without a key',
    embedded: 'No address of its own — it is placed inside another page.',

    items: [
      {
        name: 'Parish',
        part: 'parish',
        body:
          'Mass schedule, intentions and offerings. The schedule hangs in the noticeboard '
          + 'and does the same here; the rest is sealed.',
        open: 'The mass schedule is visible without an account.'
      },
      {
        name: 'Events',
        part: 'event',
        body:
          'Retreats, pilgrimages and expeditions: the announcement, the details and '
          + 'sign-up. Whoever leads one builds it themselves.',
        open: 'The announcement is visible without an account.'
      },
      {
        name: 'Cogita',
        part: 'cogita',
        body:
          'The learning environment: texts, storyboards, collections and repetition, tied '
          + 'together into a knowledge graph.',
        open: 'Nothing — a key is needed.'
      },
      {
        name: 'Calendar',
        part: 'calendar',
        body:
          'Dates, tasks and repetitions. The time is open, the content is not: you can '
          + 'see that someone is busy, not what with.',
        open: 'Busy or free, without the content.'
      },
      {
        name: 'Chat',
        part: 'chat',
        body:
          'Conversation in a group, with epochs: whoever joins today does not read what '
          + 'came before, unless someone deliberately opens it to them.',
        open: 'Nothing — a key is needed.'
      },
      {
        name: 'Confirmation',
        part: 'confirmation',
        body: 'The year, candidates, meetings and attendance. Run by the catechist.',
        open: 'Nothing — a key is needed.'
      },
      {
        name: 'Occupancy and enquiries',
        part: null,
        body:
          'Free and taken times for rooms and houses, plus the enquiry form. Placed into '
          + 'a page — as on the house page here.',
        open: 'Free and taken without an account; the enquiry is encrypted in the browser.'
      }
    ],

    note:
      'The tools are being built along with the platform and are at different stages. '
      + 'The addresses are already settled and will not change.'
  },

  notFound: {
    title: 'There is no such page',
    body: 'This address leads nowhere. The link may be out of date.',
    back: 'Back to the front page'
  },

  footer: {
    logoAlt: 'REcreatio',
    initiative: 'An initiative in formation.'
  },

  factNeeded: 'Missing fact',
  sourceTextNeeded: 'Source text'
};
