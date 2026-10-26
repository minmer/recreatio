/**
 * 2026-10-26 — VORLAGEN FÜR PLÄNE (D6 B, D8): ein Ablauf, einmal eingegeben,
 * jedes Jahr wieder auf einen Zeitraum angewandt.
 *
 * <b>Rok liturgiczny — parafia (Polska)</b>: der allgemeine Kalender in
 * Polen als Tabelle des Knotens „Kalendarz świąt" — Hochfeste, Feste, die
 * polnischen Eigenfeiern, was an Ostern und am Advent hängt, und die
 * gebotenen Gedenktage. Ränge nach der Tabelle der liturgischen Tage (1 =
 * höchster … 13 = Wochentag); `festive` = mit den Gottesdiensten des Sonntags
 * (gebotene Feiertage, dazu Ostermontag und 26. Dezember, die in Polen frei
 * sind); `moveIfImpeded` = verdrängt wandert die Feier auf den nächsten freien
 * Tag (8. Dezember an einem Adventssonntag → Montag).
 *
 * Danach die Messen: Sonntage 7:30, 9:00, 10:30, 12:13 (Suma — mit der
 * Intention „Za parafian"), 18:00; werktags 7:00 und 18:00; Gründonnerstag
 * nur 18:00, Karfreitag keine Messe, Karsamstag die Osternacht, am
 * 25. Dezember die Pasterka um 0:00. Jede Messe bekommt Titel, Obchód und
 * Kolor; am Mittwochabend ohne Fest (Rang ≥ 12) die Votivmesse von der Mutter
 * Gottes von der Immerwährenden Hilfe.
 *
 * Alles ist Vorschlag — die Pfarrei ändert Stunden, Feste und Farben in ihrem
 * Ablauf. Die Schlüssel der Messen bleiben (`n0730` … `p1800`): an ihnen
 * erkennt die Vorschau, was schon geplant ist.
 */

import type { DateRule, FeastRow, FlowDoc, FlowEdge, FlowNode, FlowNodeType, FlowOut, SlotRow, Test } from '../flow/flowModel';
import type { PlanDef } from '../scheme';

const node = (id: string, type: FlowNodeType, x: number, y: number, data: Record<string, unknown> = {}): FlowNode => ({ id, type, x, y, data });
const edge = (from: string, to: string, out: FlowOut = 'out'): FlowEdge => ({ id: `${from}-${out}-${to}`, from, to, ...(out === 'out' ? {} : { out }) });
const when = (test: Test) => ({ test });

const fixed = (month: number, day: number): DateRule => ({ r: 'fixed', month, day });
const easter = (offset: number): DateRule => ({ r: 'easter', offset });

const B = 'biały';
const R = 'czerwony';
const V = 'fioletowy';

type Row = [name: string, when: DateRule, rank: number, colour: string, extra?: Partial<Pick<FeastRow, 'festive' | 'title' | 'moveIfImpeded'>>];

/*
 * DER KALENDER. Reihenfolge: zuerst, was an Ostern, Advent und Weihnachten
 * hängt, dann die Tage des Jahres. Bei gleichem Rang an einem Tag gewinnt die
 * obere Zeile.
 */
const ROWS: readonly Row[] = [
  /* -- Fastenzeit, Triduum, Osterzeit ------------------------------------------------- */
  ['Środa Popielcowa', easter(-46), 2, V],
  ['Wielki Czwartek', easter(-3), 1, B, { title: 'Msza Wieczerzy Pańskiej' }],
  ['Wielki Piątek Męki Pańskiej', easter(-2), 1, R],
  ['Wielka Sobota', easter(-1), 1, B, { title: 'Wigilia Paschalna w Wielką Noc' }],
  ['Niedziela Zmartwychwstania Pańskiego', easter(0), 1, B, { festive: true }],
  ['Poniedziałek w oktawie Wielkanocy', easter(1), 2, B, { festive: true }],
  ['Wniebowstąpienie Pańskie', easter(42), 2, B, { festive: true }],
  ['Zesłanie Ducha Świętego', easter(49), 2, R, { festive: true }],
  ['Najświętszej Maryi Panny, Matki Kościoła', easter(50), 8, B],
  ['Jezusa Chrystusa, Najwyższego i Wiecznego Kapłana', easter(53), 8, B],
  ['Najświętszej Trójcy', easter(56), 3, B],
  ['Najświętszego Ciała i Krwi Chrystusa (Boże Ciało)', easter(60), 3, B, { festive: true }],
  ['Najświętszego Serca Pana Jezusa', easter(68), 3, B],
  ['Niepokalanego Serca Najświętszej Maryi Panny', easter(69), 10, B],

  /* -- Advent, Weihnachten ------------------------------------------------------------- */
  ['Jezusa Chrystusa, Króla Wszechświata', { r: 'advent', offset: -7 }, 3, B],
  ['Świętej Rodziny: Jezusa, Maryi i Józefa', { r: 'christmas-sunday' }, 5, B],
  ['Chrzest Pański', { r: 'baptism' }, 5, B],

  /* -- Styczeń -------------------------------------------------------------------------- */
  ['Świętej Bożej Rodzicielki Maryi', fixed(1, 1), 3, B, { festive: true }],
  ['Świętych Bazylego Wielkiego i Grzegorza z Nazjanzu', fixed(1, 2), 10, B],
  ['Objawienie Pańskie', fixed(1, 6), 2, B, { festive: true }],
  ['Świętego Antoniego, opata', fixed(1, 17), 10, B],
  ['Świętej Agnieszki, dziewicy i męczennicy', fixed(1, 21), 10, R],
  ['Świętego Franciszka Salezego', fixed(1, 24), 10, B],
  ['Nawrócenie świętego Pawła Apostoła', fixed(1, 25), 7, B],
  ['Świętych Tymoteusza i Tytusa', fixed(1, 26), 10, B],
  ['Świętego Tomasza z Akwinu', fixed(1, 28), 10, B],
  ['Świętego Jana Bosko', fixed(1, 31), 10, B],

  /* -- Luty ------------------------------------------------------------------------------ */
  ['Ofiarowanie Pańskie', fixed(2, 2), 5, B],
  ['Świętej Agaty, dziewicy i męczennicy', fixed(2, 5), 10, R],
  ['Świętych męczenników Pawła Miki i Towarzyszy', fixed(2, 6), 10, R],
  ['Świętej Scholastyki', fixed(2, 10), 10, B],
  ['Świętych Cyryla i Metodego, patronów Europy', fixed(2, 14), 7, B],
  ['Katedry świętego Piotra Apostoła', fixed(2, 22), 7, B],

  /* -- Marzec ---------------------------------------------------------------------------- */
  ['Świętego Kazimierza', fixed(3, 4), 8, B],
  ['Świętych Perpetuy i Felicyty', fixed(3, 7), 10, R],
  ['Świętego Józefa, Oblubieńca Najświętszej Maryi Panny', fixed(3, 19), 3, B, { moveIfImpeded: true }],
  ['Zwiastowanie Pańskie', fixed(3, 25), 3, B, { moveIfImpeded: true }],

  /* -- Kwiecień ------------------------------------------------------------------------- */
  ['Świętego Wojciecha, biskupa i męczennika, głównego patrona Polski', fixed(4, 23), 4, R, { moveIfImpeded: true }],
  ['Świętego Marka Ewangelisty', fixed(4, 25), 7, R],
  ['Świętej Katarzyny Sieneńskiej, patronki Europy', fixed(4, 29), 7, B],

  /* -- Maj -------------------------------------------------------------------------------- */
  ['Świętego Atanazego', fixed(5, 2), 10, B],
  ['Najświętszej Maryi Panny, Królowej Polski', fixed(5, 3), 4, B, { festive: true, moveIfImpeded: true }],
  ['Świętych Apostołów Filipa i Jakuba', fixed(5, 6), 7, R],
  ['Świętego Stanisława, biskupa i męczennika, głównego patrona Polski', fixed(5, 8), 4, R, { moveIfImpeded: true }],
  ['Świętego Macieja Apostoła', fixed(5, 14), 7, R],
  ['Świętego Andrzeja Boboli, prezbitera i męczennika, patrona Polski', fixed(5, 16), 8, R],
  ['Świętego Filipa Nereusza', fixed(5, 26), 10, B],
  ['Nawiedzenie Najświętszej Maryi Panny', fixed(5, 31), 7, B],

  /* -- Czerwiec ------------------------------------------------------------------------- */
  ['Świętego Justyna, męczennika', fixed(6, 1), 10, R],
  ['Świętych męczenników Karola Lwangi i Towarzyszy', fixed(6, 3), 10, R],
  ['Świętego Bonifacego, biskupa i męczennika', fixed(6, 5), 10, R],
  ['Świętej Jadwigi Królowej', fixed(6, 8), 11, B],
  ['Świętego Barnaby Apostoła', fixed(6, 11), 10, R],
  ['Świętego Antoniego z Padwy', fixed(6, 13), 10, B],
  ['Świętego Alojzego Gonzagi', fixed(6, 21), 10, B],
  ['Narodzenie świętego Jana Chrzciciela', fixed(6, 24), 3, B, { moveIfImpeded: true }],
  ['Świętego Ireneusza, biskupa i męczennika', fixed(6, 28), 10, R],
  ['Świętych Apostołów Piotra i Pawła', fixed(6, 29), 3, R, { moveIfImpeded: true }],

  /* -- Lipiec ----------------------------------------------------------------------------- */
  ['Świętego Tomasza Apostoła', fixed(7, 3), 7, R],
  ['Świętego Benedykta, opata, patrona Europy', fixed(7, 11), 7, B],
  ['Świętego Bonawentury', fixed(7, 15), 10, B],
  ['Świętej Marii Magdaleny', fixed(7, 22), 7, B],
  ['Świętej Brygidy, patronki Europy', fixed(7, 23), 7, B],
  ['Świętego Jakuba Apostoła', fixed(7, 25), 7, R],
  ['Świętych Joachima i Anny, rodziców Najświętszej Maryi Panny', fixed(7, 26), 10, B],
  ['Świętych Marty, Marii i Łazarza', fixed(7, 29), 10, B],
  ['Świętego Ignacego z Loyoli', fixed(7, 31), 10, B],

  /* -- Sierpień --------------------------------------------------------------------------- */
  ['Świętego Alfonsa Marii Liguoriego', fixed(8, 1), 10, B],
  ['Przemienienie Pańskie', fixed(8, 6), 5, B],
  ['Świętego Dominika', fixed(8, 8), 10, B],
  ['Świętej Teresy Benedykty od Krzyża, patronki Europy', fixed(8, 9), 7, R],
  ['Świętego Wawrzyńca, diakona i męczennika', fixed(8, 10), 7, R],
  ['Świętej Klary', fixed(8, 11), 10, B],
  ['Świętego Maksymiliana Marii Kolbego', fixed(8, 14), 10, R],
  ['Wniebowzięcie Najświętszej Maryi Panny', fixed(8, 15), 3, B, { festive: true }],
  ['Świętego Bernarda', fixed(8, 20), 10, B],
  ['Świętego Piusa X', fixed(8, 21), 10, B],
  ['Najświętszej Maryi Panny Królowej', fixed(8, 22), 10, B],
  ['Świętego Bartłomieja Apostoła', fixed(8, 24), 7, R],
  ['Najświętszej Maryi Panny Częstochowskiej', fixed(8, 26), 4, B, { moveIfImpeded: true }],
  ['Świętej Moniki', fixed(8, 27), 10, B],
  ['Świętego Augustyna', fixed(8, 28), 10, B],
  ['Męczeństwo świętego Jana Chrzciciela', fixed(8, 29), 10, R],

  /* -- Wrzesień --------------------------------------------------------------------------- */
  ['Świętego Grzegorza Wielkiego', fixed(9, 3), 10, B],
  ['Narodzenie Najświętszej Maryi Panny', fixed(9, 8), 7, B],
  ['Świętego Jana Chryzostoma', fixed(9, 13), 10, B],
  ['Podwyższenie Krzyża Świętego', fixed(9, 14), 5, R],
  ['Najświętszej Maryi Panny Bolesnej', fixed(9, 15), 10, B],
  ['Świętych męczenników Korneliusza i Cypriana', fixed(9, 16), 10, R],
  ['Świętego Stanisława Kostki, patrona Polski', fixed(9, 18), 8, B],
  ['Świętych męczenników Andrzeja Kim Taegon, Pawła Chong Hasang i Towarzyszy', fixed(9, 20), 10, R],
  ['Świętego Mateusza, Apostoła i Ewangelisty', fixed(9, 21), 7, R],
  ['Świętego Pio z Pietrelciny', fixed(9, 23), 10, B],
  ['Świętego Wincentego a Paulo', fixed(9, 27), 10, B],
  ['Świętych Archaniołów Michała, Gabriela i Rafała', fixed(9, 29), 7, B],
  ['Świętego Hieronima', fixed(9, 30), 10, B],

  /* -- Październik ------------------------------------------------------------------------ */
  ['Świętej Teresy od Dzieciątka Jezus', fixed(10, 1), 10, B],
  ['Świętych Aniołów Stróżów', fixed(10, 2), 10, B],
  ['Świętego Franciszka z Asyżu', fixed(10, 4), 10, B],
  ['Świętej Faustyny Kowalskiej', fixed(10, 5), 11, B],
  ['Najświętszej Maryi Panny Różańcowej', fixed(10, 7), 10, B],
  ['Świętej Teresy od Jezusa', fixed(10, 15), 10, B],
  ['Świętej Jadwigi Śląskiej', fixed(10, 16), 11, B],
  ['Świętego Ignacego Antiocheńskiego, biskupa i męczennika', fixed(10, 17), 10, R],
  ['Świętego Łukasza Ewangelisty', fixed(10, 18), 7, R],
  ['Świętego Jana Pawła II', fixed(10, 22), 11, B],
  ['Świętych Apostołów Szymona i Judy Tadeusza', fixed(10, 28), 7, R],

  /* -- Listopad --------------------------------------------------------------------------- */
  ['Wszystkich Świętych', fixed(11, 1), 3, B, { festive: true }],
  ['Wspomnienie wszystkich wiernych zmarłych', fixed(11, 2), 3, V],
  ['Świętego Karola Boromeusza', fixed(11, 4), 10, B],
  ['Rocznica poświęcenia Bazyliki Laterańskiej', fixed(11, 9), 5, B],
  ['Świętego Leona Wielkiego', fixed(11, 10), 10, B],
  ['Świętego Marcina z Tours', fixed(11, 11), 10, B],
  ['Świętego Jozafata, biskupa i męczennika', fixed(11, 12), 10, R],
  ['Ofiarowanie Najświętszej Maryi Panny', fixed(11, 21), 10, B],
  ['Świętej Cecylii, dziewicy i męczennicy', fixed(11, 22), 10, R],
  ['Świętego Andrzeja Apostoła', fixed(11, 30), 7, R],

  /* -- Grudzień ---------------------------------------------------------------------------- */
  ['Świętego Franciszka Ksawerego', fixed(12, 3), 10, B],
  ['Świętego Ambrożego', fixed(12, 7), 10, B],
  ['Niepokalane Poczęcie Najświętszej Maryi Panny', fixed(12, 8), 3, B, { moveIfImpeded: true }],
  ['Świętej Łucji, dziewicy i męczennicy', fixed(12, 13), 10, R],
  ['Świętego Jana od Krzyża', fixed(12, 14), 10, B],
  ['Narodzenie Pańskie', fixed(12, 25), 2, B, { festive: true }],
  ['Świętego Szczepana, pierwszego męczennika', fixed(12, 26), 7, R, { festive: true }],
  ['Świętego Jana Apostoła i Ewangelisty', fixed(12, 27), 7, B],
  ['Świętych Młodzianków, męczenników', fixed(12, 28), 7, R]
];

export const POLISH_CALENDAR: readonly FeastRow[] = ROWS.map(([name, rule, rank, colour, extra]) => ({ name, when: rule, rank, colour, ...extra }));

/* -- Die Messen ------------------------------------------------------------------------------ */

const SUNDAY_SLOTS: readonly SlotRow[] = [
  { key: 'n0730', time: '07:30', minutes: 60 },
  { key: 'n0900', time: '09:00', minutes: 60 },
  { key: 'n1030', time: '10:30', minutes: 60 },
  { key: 'n1213', label: 'Suma', time: '12:13', minutes: 75 },
  { key: 'n1800', time: '18:00', minutes: 60 }
];

const WEEKDAY_SLOTS: readonly SlotRow[] = [
  { key: 'p0700', time: '07:00', minutes: 45, days: [1, 2, 3, 4, 5, 6] },
  { key: 'p1800', time: '18:00', minutes: 45, days: [1, 2, 3, 4, 5, 6] }
];

const SEASON_COLOURS = {
  colours: { adwent: V, narodzenie: B, zwykly: 'zielony', post: V, triduum: B, wielkanoc: B },
  special: { gaudete: 'różowy', laetare: 'różowy', palm: R, goodFriday: R, pentecost: R }
};

/*
 * Die Fläche: oben der Tag (von links nach rechts, die Ausnahmetage zweigen
 * nach unten ab), darunter die Messe (Entscheidungen in der Zeile, was sie
 * setzen darunter; alles läuft rechts in „Kolor" zusammen).
 */
const LITURGICAL_YEAR: FlowDoc = {
  v: 1,
  nodes: [
    node('d_day', 'day', 0, 0),
    node('d_season', 'season', 260, 0, SEASON_COLOURS),
    node('d_feasts', 'feasts', 520, 0, { rows: POLISH_CALENDAR }),
    node('d_gf', 'if', 780, 0, when({ t: 'date', rule: easter(-2) })),
    node('d_skip', 'skip', 780, 160),
    node('d_ht', 'if', 1040, 0, when({ t: 'date', rule: easter(-3) })),
    node('d_slots_ht', 'slots', 1040, 160, {
      festive: [], weekdays: [{ key: 'wcz1800', label: 'Msza Wieczerzy Pańskiej', time: '18:00', minutes: 90, days: [4] }]
    }),
    node('d_hs', 'if', 1300, 0, when({ t: 'date', rule: easter(-1) })),
    node('d_slots_hs', 'slots', 1300, 160, {
      festive: [], weekdays: [{ key: 'wig2000', label: 'Wigilia Paschalna', time: '20:00', minutes: 150, days: [6] }]
    }),
    node('d_bn', 'if', 1560, 0, when({ t: 'date', rule: fixed(12, 25) })),
    node('d_slots_bn', 'slots', 1560, 160, {
      festive: [{ key: 'bn0000', label: 'Pasterka', time: '00:00', minutes: 90 }, ...SUNDAY_SLOTS.filter((s) => s.key !== 'n0730')],
      weekdays: []
    }),
    node('d_slots', 'slots', 1820, 0, { festive: SUNDAY_SLOTS, weekdays: WEEKDAY_SLOTS }),

    node('m_mass', 'mass', 0, 420),
    node('m_past', 'if', 260, 420, when({ t: 'slot', keys: ['bn0000'] })),
    node('m_past_t', 'set', 260, 580, { target: 'title', value: 'Pasterka — {celebration}' }),
    node('m_past_o', 'set', 260, 740, { target: 'field', key: 'obchod', value: '{celebration}' }),
    node('m_cel', 'if', 520, 420, when({ t: 'celebration', is: 'any' })),
    node('m_cel_t', 'set', 520, 580, { target: 'title', value: '{celebrationTitle}' }),
    node('m_cel_o', 'set', 520, 740, { target: 'field', key: 'obchod', value: '{celebration}' }),
    node('m_wed', 'if', 780, 420, when({ t: 'weekday', days: [3] })),
    node('m_wed18', 'if', 1040, 420, when({ t: 'slot', keys: ['p1800'] })),
    node('m_rank', 'if', 1300, 420, when({ t: 'rank', op: '>=', n: 12 })),
    node('m_mbnp_t', 'set', 1300, 580, { target: 'title', value: 'Msza wotywna o Matce Bożej Nieustającej Pomocy' }),
    node('m_mbnp_o', 'set', 1300, 740, { target: 'field', key: 'obchod', value: 'Najświętsza Maryja Panna Nieustającej Pomocy' }),
    node('m_mbnp_c', 'set', 1300, 900, { target: 'var', key: 'colour', value: B }),
    node('m_sun', 'if', 1560, 420, when({ t: 'sunday' })),
    node('m_sun_t', 'set', 1560, 580, { target: 'title', value: '{sundayName}' }),
    node('m_sun_o', 'set', 1560, 740, { target: 'field', key: 'obchod', value: '{sundayName}' }),
    node('m_wd_t', 'set', 1820, 420, { target: 'title', value: '{dayName}' }),
    node('m_wd_o', 'set', 1820, 580, { target: 'field', key: 'obchod', value: '{dayName}' }),
    node('m_kolor', 'set', 2080, 740, { target: 'field', key: 'kolor', value: '{colour}' }),
    node('m_1213', 'if', 2340, 740, when({ t: 'slot', keys: ['n1213'] })),
    node('m_rec', 'record', 2340, 900, { list: 'intencje', mode: 'single', text: 'Za parafian' }),
    node('m_end', 'end', 2600, 740)
  ],
  edges: [
    edge('d_day', 'd_season'),
    edge('d_season', 'd_feasts'),
    edge('d_feasts', 'd_gf'),
    edge('d_gf', 'd_skip', 'yes'),
    edge('d_gf', 'd_ht', 'no'),
    edge('d_ht', 'd_slots_ht', 'yes'),
    edge('d_ht', 'd_hs', 'no'),
    edge('d_hs', 'd_slots_hs', 'yes'),
    edge('d_hs', 'd_bn', 'no'),
    edge('d_bn', 'd_slots_bn', 'yes'),
    edge('d_bn', 'd_slots', 'no'),

    edge('m_mass', 'm_past'),
    edge('m_past', 'm_past_t', 'yes'),
    edge('m_past', 'm_cel', 'no'),
    edge('m_past_t', 'm_past_o'),
    edge('m_past_o', 'm_kolor'),
    edge('m_cel', 'm_cel_t', 'yes'),
    edge('m_cel', 'm_wed', 'no'),
    edge('m_cel_t', 'm_cel_o'),
    edge('m_cel_o', 'm_kolor'),
    edge('m_wed', 'm_wed18', 'yes'),
    edge('m_wed', 'm_sun', 'no'),
    edge('m_wed18', 'm_rank', 'yes'),
    edge('m_wed18', 'm_sun', 'no'),
    edge('m_rank', 'm_mbnp_t', 'yes'),
    edge('m_rank', 'm_sun', 'no'),
    edge('m_mbnp_t', 'm_mbnp_o'),
    edge('m_mbnp_o', 'm_mbnp_c'),
    edge('m_mbnp_c', 'm_kolor'),
    edge('m_sun', 'm_sun_t', 'yes'),
    edge('m_sun', 'm_wd_t', 'no'),
    edge('m_sun_t', 'm_sun_o'),
    edge('m_sun_o', 'm_kolor'),
    edge('m_wd_t', 'm_wd_o'),
    edge('m_wd_o', 'm_kolor'),
    edge('m_kolor', 'm_1213'),
    edge('m_1213', 'm_rec', 'yes'),
    edge('m_1213', 'm_end', 'no'),
    edge('m_rec', 'm_end')
  ]
};

/** Nur die Stunden, ohne Kirchenjahr: Sonntage und Werktage, jede Messe „Msza święta". */
const FIXED_HOURS: FlowDoc = {
  v: 1,
  nodes: [
    node('d_day', 'day', 0, 0),
    node('d_slots', 'slots', 260, 0, { festive: SUNDAY_SLOTS, weekdays: WEEKDAY_SLOTS }),
    node('m_mass', 'mass', 0, 200),
    node('m_title', 'set', 260, 200, { target: 'title', value: 'Msza święta' }),
    node('m_end', 'end', 520, 200)
  ],
  edges: [
    edge('d_day', 'd_slots'),
    edge('m_mass', 'm_title'),
    edge('m_title', 'm_end')
  ]
};

export const PLAN_TEMPLATES: readonly { readonly id: string; readonly def: PlanDef; readonly needs?: string }[] = [
  {
    id: 'rok-liturgiczny-pl',
    needs: 'msza',
    def: {
      name: 'Rok liturgiczny — parafia (Polska)',
      schemeId: null,
      kind: 'mass',
      weeks: 8,
      flow: LITURGICAL_YEAR,
      says: 'Msze na kolejne tygodnie według roku liturgicznego: kalendarz świąt w Polsce, godziny niedzielne i powszednie, '
        + 'Triduum, Pasterka, obchód i kolor każdej mszy, w środę wieczorem msza wotywna o MB Nieustającej Pomocy, '
        + 'w niedzielę o 12:13 intencja „Za parafian”.'
    }
  },
  {
    id: 'stale-godziny',
    def: {
      name: 'Stałe godziny mszy',
      schemeId: null,
      kind: 'mass',
      weeks: 4,
      flow: FIXED_HOURS,
      says: 'Tylko godziny: niedziele i święta 7:30, 9:00, 10:30, 12:13, 18:00; dni powszednie 7:00 i 18:00 — bez kalendarza świąt.'
    }
  }
];

export const planTemplate = (id: string) => PLAN_TEMPLATES.find((t) => t.id === id);
