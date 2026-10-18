/**
 * POKAZY CHEMICZNE (2026-10-18) — die Doświadczenia als Slajdy: eine Seite im
 * Modus „slides”, vorn ein Slajd mit dem Ziel, dann je Schritt ein Slajd mit
 * dem Labor (eine eingeschränkte Szene der einen Piaskownica — sie fängt dort
 * an, wo der vorige Schritt aufhörte: der Zustand steht in der Szene selbst,
 * `before`/`warm` nur für wenige Sekunden), am Ende die Erklärung.
 *
 * `expect` sagt, was der Motor beim Schritt zeigen muss — `lab-examples.mjs`
 * prüft jede Folie, bevor es schreibt: said (ein Satz in den Obserwacjach),
 * notSaid, above/below (ein Termometr am Ende), plateau (wie viele Sekunden ein
 * Termometr bei einer Temperatur stand), out (eine Kerze ist aus), warmer
 * (eine Stelle wärmer als eine andere), up (wie viel eines Stoffes in der oberen
 * Hälfte der Flüssigkeit ist), more (eine Grösse in einem Glas ist mehr als
 * f-mal die in einem anderen: "aq:Cu+2" gelöst, "s:S" fest, "gas:NO2" Anteil im
 * Gas, "up:MnO4-" Anteil oben).
 */

const W = (amount) => ({ reagent: 'water', amount });
const step = (say, act, wait, ask) => ({ say, ...(act === null ? {} : { do: act }), wait, ...(ask === undefined ? {} : { ask }) });
const ask = (q, options, answer, why) => ({ q, options, answer, why });

/* -- Cyna: topnienie i krzepnięcie -------------------------------------------------------------- */

const tin = (T, lit, extra = {}) => ({
  things: [
    { id: 'palnik', kind: 'burner', x: 0, air: 1, gas: 0.8, ...(lit ? { lit: true } : {}) },
    { id: 'trojnog', kind: 'tripod', x: 0 },
    { id: 'tygiel', kind: 'crucible', size: 30, on: 'trojnog', label: 'cyna 20 g', fill: [{ reagent: 'Sn', amount: 20 }], ...(T === null ? {} : { T }) },
    { id: 'termometr', kind: 'thermometer', into: 'tygiel' }
  ],
  shelf: ['Sn', 'Pb', 'Field'],
  tools: ['match', 'probe'],
  graph: { things: ['termometr'], of: ['T'] },
  ...extra
});

const cyna = {
  file: 'lab-pokaz-cyna.json',
  path: 'pokaz-cyna',
  title: 'Topnienie i krzepnięcie cyny',
  accent: '#b0602a',
  intro: {
    badge: 'Pokaz · fizyka i chemia',
    headline: 'Topnienie i krzepnięcie cyny',
    lede: 'Co dzieje się z temperaturą metalu, który się topi?',
    paragraphs: [
      'Cyna topi się w 232 °C — w zasięgu zwykłego palnika. Na kolejnych slajdach ogrzejesz ją w tyglu, zobaczysz, jak się topi, a potem jak krzepnie.',
      'Na każdym slajdzie jest jeden krok. Najpierw odpowiedz na pytanie — przewiduj! — potem wykonaj krok sam albo naciśnij „Pokaż”. Wykres pokazuje temperaturę z termometru w tyglu.'
    ]
  },
  slides: [
    {
      id: 'ogrzewanie', label: 'Ogrzewanie',
      text: ['Na trójnogu stoi tygiel z 20 g cyny, w środku termometr. Palnik jest zgaszony.', 'Zapal palnik (zapałka z narzędzi albo „Pokaż”) i patrz na wykres. Czas płynie pięć razy szybciej.'],
      scene: tin(null, false, {
        speed: 5,
        steps: [step('Zapal palnik pod tyglem.', { burner: 'palnik', on: true }, 90, ask('Co zacznie się dziać, gdy termometr dojdzie do 232 °C?', ['cyna zacznie się topić', 'cyna zacznie wrzeć', 'nic się nie zmieni'], 'cyna zacznie się topić', '232 °C to temperatura topnienia cyny — od niej ciało stałe przechodzi w ciecz.'))]
      }),
      expect: [{ said: 'Cyna topi się' }, { above: ['termometr', 225] }]
    },
    {
      id: 'topnienie', label: 'Topnienie',
      text: ['Cyna ma już 225 °C, palnik grzeje dalej.', 'Patrz na wykres, aż cała cyna się stopi.'],
      scene: tin(225, true, {
        speed: 5,
        steps: [step('Obserwuj termometr, aż cała cyna się stopi.', { speed: 5 }, 90, ask('Co pokazuje termometr, dopóki w tyglu jest i stała, i ciekła cyna?', ['temperatura rośnie dalej', 'temperatura stoi na 232 °C', 'temperatura spada'], 'temperatura stoi na 232 °C', 'Całe ciepło z palnika idzie na topnienie (ciepło topnienia) — dopiero gdy cała cyna jest ciekła, temperatura znów rośnie.'))]
      }),
      expect: [{ plateau: ['termometr', 232, 2, 8] }, { above: ['termometr', 236] }]
    },
    {
      id: 'krzepniecie', label: 'Krzepnięcie',
      text: ['Cała cyna jest ciekła i ma 260 °C. Palnik zgaszono.', 'Obserwuj, jak metal stygnie i krzepnie — czas płynie dziesięć razy szybciej.'],
      scene: tin(260, false, {
        speed: 10,
        steps: [step('Obserwuj, jak ciekła cyna stygnie.', { speed: 10 }, 280, ask('Co stanie się z temperaturą, gdy cyna zacznie krzepnąć?', ['będzie spadać tak samo jak przedtem', 'zatrzyma się na 232 °C, aż cała cyna zakrzepnie', 'wzrośnie'], 'zatrzyma się na 232 °C, aż cała cyna zakrzepnie', 'Krzepnąc, cyna oddaje ciepło topnienia — tyle, ile pobrała przy topnieniu — więc temperatura stoi, dopóki cała nie zakrzepnie.'))]
      }),
      expect: [{ said: 'Cyna krzepnie' }, { plateau: ['termometr', 232, 1.5, 60] }, { below: ['termometr', 229] }]
    }
  ],
  outro: {
    title: 'Co się wydarzyło?',
    body: [
      'Do 232 °C ciepło z palnika podnosi temperaturę cyny.',
      'W 232 °C ciepło idzie na rozrywanie sieci krystalicznej — temperatura stoi, aż cała cyna się stopi. To ciepło topnienia: dla cyny ok. 59 J na każdy gram.',
      'Przy stygnięciu jest odwrotnie: krzepnąc, cyna oddaje to samo ciepło, więc na wykresie znów widać poziomą „półkę” na 232 °C.',
      '## Zapamiętaj',
      'Temperatura topnienia i temperatura krzepnięcia czystej substancji są takie same. Przemiana fazowa to na wykresie temperatury pozioma półka.',
      '## Spróbuj sam',
      'W piaskownicy ołów topi się w 327 °C, a stop Fielda (bizmut, ind, cyna) już w 62 °C — stopi się nawet w gorącej wodzie.'
    ].join('\n')
  }
};

/* -- Reakcje strąceniowe ------------------------------------------------------------------------ */

/** Ein Slajd: in der Probówka eine Lösung, dazu eine zweite — es fällt ein Niederschlag (`solid`: sein Name in der Beobachtung). */
const precip = ({ id, label, has, formula, reagent, add, addId, solid }, q, options, answer, why) => ({
  id, label,
  text: [`W probówce jest roztwór: ${has}.`, `Dodaj ${add} (z półki albo „Pokaż”) i obserwuj probówkę. Równanie pojawi się w obserwacjach.`],
  scene: {
    things: [{ id: 'p', kind: 'tube', size: 25, x: 0, label: formula, fill: [{ reagent, amount: 8 }] }],
    shelf: [addId],
    tools: ['stir'],
    steps: [step(`Dodaj ${add}.`, [{ add: addId, to: 'p', amount: 4 }, { use: 'stir', at: 'p' }], 6, ask(q, options, answer, why))]
  },
  expect: [{ said: solid }]
});

const osady = {
  file: 'lab-pokaz-osady.json',
  path: 'pokaz-osady',
  title: 'Reakcje strąceniowe',
  accent: '#2f6fa8',
  intro: {
    badge: 'Pokaz · chemia',
    headline: 'Reakcje strąceniowe',
    lede: 'Dwa przezroczyste roztwory — a po zmieszaniu osad. Skąd się bierze?',
    paragraphs: [
      'Gdy zmieszasz roztwory dwóch soli, jony mogą połączyć się w substancję, która w wodzie prawie się nie rozpuszcza. Wtedy ciecz mętnieje i powstaje osad.',
      'Silnik liczy rozpuszczalność w każdej kropli cieczy osobno — osad pojawia się dokładnie tam, gdzie roztwory się spotykają, a potem powoli opada.'
    ]
  },
  slides: [
    {
      id: 'chlorek-srebra', label: 'Chlorek srebra',
      text: ['W dużej zlewce jest roztwór chlorku sodu, w małej — azotanu(V) srebra.', 'Przelej azotan srebra do chlorku sodu: przytrzymaj małą zlewkę nad dużą (albo „Pokaż”). Gdzie najpierw pojawia się osad?'],
      scene: {
        things: [
          { id: 'nacl', kind: 'beaker', size: 100, x: -5, label: 'NaCl', fill: [{ reagent: 'NaCl-aq', amount: 40 }] },
          { id: 'agno3', kind: 'beaker', size: 50, x: 8, label: 'AgNO₃', fill: [{ reagent: 'AgNO3', amount: 20 }] }
        ],
        shelf: ['NaCl-aq', 'AgNO3'],
        tools: ['stir'],
        steps: [step('Przelej azotan srebra do chlorku sodu.', { pour: 'agno3', to: 'nacl', ml: 20 }, 12, ask('Co zobaczysz po zmieszaniu?', ['biały osad', 'niebieski roztwór', 'nic — oba roztwory są bezbarwne'], 'biały osad', 'Ag⁺ + Cl⁻ → AgCl↓ — chlorek srebra prawie nie rozpuszcza się w wodzie.'))]
      },
      expect: [{ said: 'chlorek srebra' }]
    },
    precip({ id: 'wodorotlenek-miedzi', label: 'Wodorotlenek miedzi(II)', has: 'siarczan(VI) miedzi(II)', formula: 'CuSO₄', reagent: 'CuSO4-aq', add: 'zasadę sodową', addId: 'NaOH-aq', solid: 'wodorotlenek miedzi(II)' },
      'Jaki kolor będzie miał osad?', ['niebieski', 'biały', 'czerwony'], 'niebieski', 'Cu²⁺ + 2OH⁻ → Cu(OH)₂↓ — galaretowaty, niebieski osad.'),
    precip({ id: 'jodek-olowiu', label: 'Jodek ołowiu(II)', has: 'azotan(V) ołowiu(II)', formula: 'Pb(NO₃)₂', reagent: 'Pb(NO3)2', add: 'roztwór jodku potasu', addId: 'KI', solid: 'jodek ołowiu(II)' },
      'Jaki kolor będzie miał osad?', ['żółty', 'biały', 'czarny'], 'żółty', 'Pb²⁺ + 2I⁻ → PbI₂↓ — jaskrawożółty osad.'),
    precip({ id: 'wodorotlenek-zelaza', label: 'Wodorotlenek żelaza(III)', has: 'chlorek żelaza(III)', formula: 'FeCl₃', reagent: 'FeCl3', add: 'zasadę sodową', addId: 'NaOH-aq', solid: 'wodorotlenek żelaza(III)' },
      'Jaki kolor będzie miał osad?', ['rdzawobrunatny', 'zielony', 'biały'], 'rdzawobrunatny', 'Fe³⁺ + 3OH⁻ → Fe(OH)₃↓ — rdzawobrunatny, kłaczkowaty osad.'),
    precip({ id: 'siarczan-baru', label: 'Siarczan(VI) baru', has: 'chlorek baru', formula: 'BaCl₂', reagent: 'BaCl2', add: 'roztwór siarczanu(VI) sodu', addId: 'Na2SO4', solid: 'siarczan(VI) baru' },
      'Czy powstanie osad?', ['tak, biały', 'nie — obie sole dobrze się rozpuszczają'], 'tak, biały', 'Ba²⁺ + SO₄²⁻ → BaSO₄↓ — jeden z najtrudniej rozpuszczalnych siarczanów.')
  ],
  outro: {
    title: 'Co się wydarzyło?',
    body: [
      'W każdej probówce dwa jony spotkały się i utworzyły trudno rozpuszczalną sól albo wodorotlenek:',
      'Ag⁺ + Cl⁻ → AgCl↓ (biały)  ·  Cu²⁺ + 2OH⁻ → Cu(OH)₂↓ (niebieski)  ·  Pb²⁺ + 2I⁻ → PbI₂↓ (żółty)  ·  Fe³⁺ + 3OH⁻ → Fe(OH)₃↓ (rdzawy)  ·  Ba²⁺ + SO₄²⁻ → BaSO₄↓ (biały)',
      'Pozostałe jony (Na⁺, K⁺, NO₃⁻, Cl⁻, SO₄²⁻) zostały w roztworze — nie biorą udziału w reakcji, dlatego w równaniu jonowym skróconym ich nie ma.',
      '## Zapamiętaj',
      'Osad powstaje, gdy iloczyn stężeń jonów przekroczy iloczyn rozpuszczalności soli. Które połączenia są trudno rozpuszczalne, mówi tabela rozpuszczalności.',
      '## Spróbuj sam',
      'W piaskownicy wlej jodek potasu do azotanu ołowiu, ogrzej zlewkę, aż osad zniknie, i pozwól jej wystygnąć — to „złoty deszcz”.'
    ].join('\n')
  }
};

/* -- Metale i kwasy: wodór ---------------------------------------------------------------------- */

const wodor = {
  file: 'lab-pokaz-wodor.json',
  path: 'pokaz-wodor',
  title: 'Metale, kwasy i wodór',
  accent: '#3d7a3a',
  intro: {
    badge: 'Pokaz · chemia',
    headline: 'Metale, kwasy i wodór',
    lede: 'Które metale wypierają wodór z kwasu — i jak go wykryć?',
    paragraphs: [
      'Niektóre metale roztwarzają się w kwasie solnym i wydziela się gaz. Inne leżą w kwasie i nic się nie dzieje.',
      'Na kolejnych slajdach porównasz metale, a na końcu wykryjesz wodór płonącym łuczywem.'
    ]
  },
  slides: [
    {
      id: 'cynk', label: 'Cynk w kwasie',
      text: ['W probówce jest 12 cm³ kwasu solnego.', 'Wrzuć do niej granulki cynku (z półki albo „Pokaż”).'],
      scene: {
        things: [{ id: 'reakcja', kind: 'tube', size: 25, x: 0, label: 'HCl', fill: [{ reagent: 'HCl', amount: 12 }] }],
        shelf: ['Zn'],
        tools: [],
        steps: [step('Wrzuć do kwasu granulki cynku.', { add: 'Zn', to: 'reakcja', amount: 2 }, 10, ask('Co zobaczysz?', ['pęcherzyki gazu', 'biały osad', 'niebieski roztwór'], 'pęcherzyki gazu', 'Zn + 2HCl → ZnCl₂ + H₂↑ — cynk wypiera wodór z kwasu.'))]
      },
      expect: [{ said: 'Cynk roztwarza się' }]
    },
    {
      id: 'szereg', label: 'Szereg aktywności',
      text: ['W czterech probówkach jest kwas solny.', 'Włóż do nich magnez, cynk, żelazo i miedź — gdzie gaz wydziela się najszybciej, a gdzie wcale?'],
      scene: {
        things: [
          { id: 'mg', kind: 'tube', size: 25, x: -9, label: 'Mg', fill: [{ reagent: 'HCl', amount: 10 }] },
          { id: 'zn', kind: 'tube', size: 25, x: -3, label: 'Zn', fill: [{ reagent: 'HCl', amount: 10 }] },
          { id: 'fe', kind: 'tube', size: 25, x: 3, label: 'Fe', fill: [{ reagent: 'HCl', amount: 10 }] },
          { id: 'cu', kind: 'tube', size: 25, x: 9, label: 'Cu', fill: [{ reagent: 'HCl', amount: 10 }] }
        ],
        shelf: ['Mg', 'Zn', 'Fe', 'Cu'],
        tools: [],
        steps: [step('Włóż do probówek magnez, cynk, żelazo i miedź.', [{ add: 'Mg', to: 'mg', amount: 0.1 }, { add: 'Zn', to: 'zn', amount: 1 }, { add: 'Fe', to: 'fe', amount: 2 }, { add: 'Cu', to: 'cu', amount: 1 }], 15, ask('W której probówce gaz nie będzie się wydzielał?', ['z magnezem', 'z cynkiem', 'z miedzią'], 'z miedzią', 'Miedź stoi w szeregu aktywności za wodorem — nie wypiera go z kwasu.'))]
      },
      expect: [{ said: 'Magnez roztwarza się' }, { said: 'Cynk roztwarza się' }, { notSaid: 'Miedź roztwarza się' }]
    },
    {
      id: 'pyk', label: 'Próba łuczywa',
      text: ['Cynk reaguje z kwasem już od kilkunastu sekund — u wylotu probówki wodór miesza się z powietrzem.', 'Zbliż płonące łuczywo do wylotu probówki (narzędzie „łuczywo” albo „Pokaż”).'],
      scene: {
        things: [{ id: 'reakcja', kind: 'tube', size: 25, x: 0, label: 'Zn + HCl', fill: [{ reagent: 'HCl', amount: 12 }] }],
        before: [{ add: 'Zn', to: 'reakcja', amount: 2 }],
        warm: 12,
        shelf: ['Zn', 'HCl'],
        tools: ['splint'],
        steps: [step('Zbliż płonące łuczywo do wylotu probówki.', { use: 'splint', at: 'reakcja' }, 4, ask('Co usłyszymy?', ['nic', 'charakterystyczny trzask („pyk”)', 'syk gaszonego płomienia'], 'charakterystyczny trzask („pyk”)', 'Wodór zmieszany z powietrzem spala się gwałtownie: 2H₂ + O₂ → 2H₂O.'))]
      },
      expect: [{ said: 'Pyk!' }]
    }
  ],
  outro: {
    title: 'Co się wydarzyło?',
    body: [
      'Magnez, cynk i żelazo wypierają wodór z kwasu solnego: Mg + 2HCl → MgCl₂ + H₂↑. Magnez robi to najgwałtowniej, żelazo najwolniej. Miedź nie reaguje.',
      'O tym decyduje szereg aktywności metali: K, Na, Ca, Mg, Al, Zn, Fe, Pb, (H), Cu, Ag, Au. Metale przed wodorem wypierają go z kwasów, metale za nim — nie.',
      'Wodór zmieszany z powietrzem spala się z trzaskiem: 2H₂ + O₂ → 2H₂O. To próba na wodór.',
      '## Zapamiętaj',
      'metal aktywny + kwas → sól + wodór↑',
      '## Spróbuj sam',
      'W piaskownicy wrzuć cynk do zasady sodowej — też wydziela się wodór (cynk jest amfoteryczny). A miedź? Włóż ją do roztworu azotanu srebra.'
    ].join('\n')
  }
};

/* -- Spalanie potrzebuje tlenu ------------------------------------------------------------------- */

const swieca = {
  file: 'lab-pokaz-swieca.json',
  path: 'pokaz-swieca',
  title: 'Spalanie potrzebuje tlenu',
  accent: '#c0392b',
  intro: {
    badge: 'Pokaz · chemia',
    headline: 'Spalanie potrzebuje tlenu',
    lede: 'Dlaczego świeca pod słojem gaśnie — i czym gasić płomień?',
    paragraphs: [
      'Płomień świecy to spalanie par parafiny w tlenie z powietrza. Powstają tlenek węgla(IV) i para wodna.',
      'Zobaczysz, co się stanie, gdy tlenu zabraknie, i sprawdzisz, czym jest gaz, który powstaje.'
    ]
  },
  slides: [
    {
      id: 'sloj', label: 'Świeca pod słojem',
      text: ['Zapalona świeca stoi na stole, obok wisi odwrócony słój.', 'Przykryj świecę słojem (przeciągnij go albo „Pokaż”). Sonda pokaże skład gazu w słoju.'],
      scene: {
        things: [
          { id: 'swieca', kind: 'candle', x: 0, lit: true },
          { id: 'sloj', kind: 'jar', size: 500, x: 14, y: 11.6, angle: 180, label: 'słój' }
        ],
        view: [-8, -2, 20, 16],
        shelf: [],
        tools: ['match', 'probe'],
        steps: [step('Przykryj świecę słojem.', { move: 'sloj', to: [0, 11.6] }, 40, ask('Co stanie się z płomieniem?', ['będzie się palił dalej', 'po chwili zgaśnie', 'zgaśnie od razu'], 'po chwili zgaśnie', 'Świeca zużywa tlen; gdy w słoju zostaje go ok. 15%, płomień gaśnie.'))]
      },
      expect: [{ out: 'swieca' }]
    },
    {
      id: 'co2', label: 'CO₂ gasi płomień',
      text: ['W zlewce jest tlenek węgla(IV) — bezbarwny gaz, cięższy od powietrza. W dużym słoju palą się dwie świece: niska i wysoka.', 'Przelej gaz do słoja, jakby był cieczą (przytrzymaj zlewkę nad słojem albo „Pokaż”).'],
      scene: {
        things: [
          { id: 'sloj', kind: 'jar', size: 1000, x: -6, label: 'słój ze świecami' },
          { id: 'niska', kind: 'candle', size: 4, x: -8.4, y: 0.4, lit: true },
          { id: 'wysoka', kind: 'candle', size: 9, x: -3.6, y: 0.4, lit: true },
          { id: 'co2', kind: 'beaker', size: 600, x: 12, label: 'CO₂', gas: { CO2: 1 } }
        ],
        shelf: ['CO2-gas'],
        tools: ['match', 'probe'],
        steps: [step('Przelej gaz ze zlewki do słoja.', { pour: 'co2', to: 'sloj', ml: 8 }, 20, ask('Która świeca zgaśnie pierwsza?', ['niska', 'wysoka', 'obie naraz'], 'niska', 'CO₂ jest cięższy od powietrza — wypełnia słój od dna, więc najpierw gasi niższy płomień.'))]
      },
      expect: [{ out: 'niska' }]
    },
    {
      id: 'woda-wapienna', label: 'Wykrywanie CO₂',
      text: ['W probówce jest woda wapienna — klarowny roztwór wodorotlenku wapnia.', 'Przepuść przez nią tlenek węgla(IV) z butli (z półki albo „Pokaż”).'],
      scene: {
        things: [{ id: 'woda', kind: 'tube', size: 25, x: 0, label: 'woda wapienna', fill: [{ reagent: 'limewater', amount: 12 }] }],
        shelf: ['CO2-gas', 'O2-gas'],
        tools: ['stir'],
        steps: [step('Przepuść tlenek węgla(IV) przez wodę wapienną.', { add: 'CO2-gas', to: 'woda', amount: 50 }, 14, ask('Co stanie się z wodą wapienną?', ['zmętnieje', 'zabarwi się na niebiesko', 'nic się nie stanie'], 'zmętnieje', 'CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O — wytrąca się biały węglan wapnia.'))]
      },
      expect: [{ said: 'węglan wapnia' }]
    }
  ],
  outro: {
    title: 'Co się wydarzyło?',
    body: [
      'Pod słojem świeca zużywała tlen. Gdy jego udział spadł z 21% do ok. 15%, płomień zgasł — choć w słoju wciąż było sporo tlenu.',
      'Tlenek węgla(IV) jest półtora raza cięższy od powietrza: wlany do słoja spływa na dno i wypiera powietrze od dołu, dlatego niższa świeca gaśnie pierwsza. Tak działają gaśnice śniegowe.',
      'Woda wapienna mętnieje od CO₂: Ca(OH)₂ + CO₂ → CaCO₃↓ + H₂O. To próba na tlenek węgla(IV) — także w wydychanym powietrzu.',
      '## Zapamiętaj',
      'Do spalania potrzebne są: substancja palna, tlen i odpowiednio wysoka temperatura. Usunięcie jednego z nich gasi płomień.'
    ].join('\n')
  }
};

/* -- Kwasy, zasady i zobojętnianie --------------------------------------------------------------- */

const zobojetnianie = {
  file: 'lab-pokaz-zobojetnianie.json',
  path: 'pokaz-zobojetnianie',
  title: 'Kwas, zasada i zobojętnianie',
  accent: '#8e44ad',
  intro: {
    badge: 'Pokaz · chemia',
    headline: 'Kwas, zasada i zobojętnianie',
    lede: 'Jak wskaźnik pokazuje odczyn — i co się dzieje, gdy kwas spotyka zasadę?',
    paragraphs: [
      'Wskaźniki zmieniają barwę zależnie od pH. Fenoloftaleina jest bezbarwna w kwasie i w wodzie, a malinowa w zasadzie.',
      'Zobaczysz, że zobojętnianie wydziela ciepło, a na koniec zmiareczkujesz zasadę kwasem — dokładnie do punktu, w którym wskaźnik się odbarwi.'
    ]
  },
  slides: [
    {
      id: 'wskaznik', label: 'Fenoloftaleina',
      text: ['W jednej probówce jest kwas solny, w drugiej zasada sodowa (oba o stężeniu 0,1 mol/dm³).', 'Dodaj do obu kilka kropli fenoloftaleiny (z półki albo „Pokaż”).'],
      scene: {
        things: [
          { id: 'kwas', kind: 'tube', size: 25, x: -3, label: 'HCl', fill: [{ reagent: 'HCl-dil', amount: 8 }] },
          { id: 'zasada', kind: 'tube', size: 25, x: 3, label: 'NaOH', fill: [{ reagent: 'NaOH-dil', amount: 8 }] }
        ],
        shelf: ['phenolphthalein', 'methylorange', 'universal'],
        tools: ['stir', 'paper'],
        steps: [step('Dodaj fenoloftaleinę do obu probówek.', [{ add: 'phenolphthalein', to: 'kwas', amount: 3 }, { add: 'phenolphthalein', to: 'zasada', amount: 3 }, { use: 'stir', at: 'kwas' }, { use: 'stir', at: 'zasada' }], 6, ask('W której probówce fenoloftaleina zmieni barwę?', ['w kwasie', 'w zasadzie', 'w obu'], 'w zasadzie', 'Fenoloftaleina barwi się na malinowo w odczynie zasadowym (pH powyżej ok. 8,2).'))]
      },
      expect: [{ said: 'barwi się' }]
    },
    {
      id: 'cieplo', label: 'Ciepło zobojętniania',
      text: ['W zlewce jest 50 cm³ kwasu solnego (1 mol/dm³) i termometr, obok zasada sodowa o tym samym stężeniu.', 'Wlej zasadę do kwasu i zamieszaj (albo „Pokaż”). Patrz na wykres.'],
      scene: {
        things: [
          { id: 'zlewka', kind: 'beaker', size: 250, x: -5, label: 'HCl 1 mol/dm³', fill: [{ reagent: 'HCl', amount: 50 }] },
          { id: 'termometr', kind: 'thermometer', into: 'zlewka' },
          { id: 'naoh', kind: 'beaker', size: 100, x: 8, label: 'NaOH 1 mol/dm³', fill: [{ reagent: 'NaOH-aq', amount: 50 }] }
        ],
        shelf: ['NaOH-aq', 'HCl'],
        tools: ['stir', 'thermometer'],
        graph: { things: ['termometr'], of: ['T'] },
        steps: [step('Wlej zasadę do kwasu i zamieszaj.', [{ pour: 'naoh', to: 'zlewka', ml: 50 }, { use: 'stir', at: 'zlewka' }], 15, ask('Co pokaże termometr?', ['temperatura wzrośnie', 'temperatura spadnie', 'nic się nie zmieni'], 'temperatura wzrośnie', 'H⁺ + OH⁻ → H₂O — zobojętnianie jest egzotermiczne: ok. 57 kJ na każdy mol powstałej wody.'))]
      },
      expect: [{ above: ['termometr', 24] }]
    },
    {
      id: 'miareczkowanie', label: 'Miareczkowanie',
      text: ['W kolbie na mieszadle magnetycznym jest 25 cm³ zasady sodowej (0,1 mol/dm³) z fenoloftaleiną, w biurecie kwas solny o tym samym stężeniu.', 'Otwórz kranik (dotknij biurety albo „Pokaż”) i obserwuj wykres pH. Przy ilu cm³ kwasu roztwór się odbarwi?'],
      scene: {
        things: [
          { id: 'mieszadlo', kind: 'hotplate', x: 0, stir: true },
          { id: 'kolba', kind: 'flask', size: 100, on: 'mieszadlo', label: 'NaOH + fenoloftaleina', fill: [{ reagent: 'NaOH-dil', amount: 25 }, { reagent: 'phenolphthalein', amount: 2 }] },
          { id: 'biureta', kind: 'burette', size: 50, x: 0, y: 12.8, label: 'HCl 0,1 mol/dm³', fill: [{ reagent: 'HCl-dil', amount: 50 }] }
        ],
        shelf: ['phenolphthalein', 'methylorange', 'bromothymol'],
        tools: ['stir', 'paper'],
        graph: { things: ['kolba'], of: ['pH'] },
        steps: [step('Otwórz kranik biurety — kwas kapie do kolby.', { tap: 'biureta', rate: 0.6 }, 50, ask('Przy ilu cm³ kwasu roztwór się odbarwi?', ['ok. 10 cm³', 'ok. 25 cm³', 'ok. 50 cm³'], 'ok. 25 cm³', 'W kolbie jest 2,5 mmol NaOH — tyle samo HCl jest w 25 cm³ kwasu. Wtedy pH gwałtownie spada przez 7 i fenoloftaleina się odbarwia.'))]
      },
      expect: [{ said: 'odbarwia się' }]
    }
  ],
  outro: {
    title: 'Co się wydarzyło?',
    body: [
      'Fenoloftaleina zabarwiła na malinowo tylko zasadę — w kwasie pozostała bezbarwna.',
      'Kwas z zasadą reaguje: H⁺ + OH⁻ → H₂O (a jony Na⁺ i Cl⁻ zostają w roztworze). Reakcja wydziela ciepło — 0,05 mola wody ogrzało roztwór o ok. 6 °C.',
      'Przy miareczkowaniu pH długo zmienia się niewiele, a w pobliżu 25 cm³ spada o kilka jednostek naraz — to punkt równoważności. Wskaźnik odbarwia się właśnie wtedy.',
      '## Zapamiętaj',
      'kwas + zasada → sól + woda (zobojętnianie, reakcja egzotermiczna). Z objętości kwasu w punkcie równoważności oblicza się stężenie zasady.'
    ].join('\n')
  }
};

/* -- Jak wędruje ciepło -------------------------------------------------------------------------- */

const cieplo = {
  file: 'lab-pokaz-cieplo.json',
  path: 'pokaz-cieplo',
  title: 'Jak wędruje ciepło',
  accent: '#d35400',
  intro: {
    badge: 'Pokaz · fizyka',
    headline: 'Jak wędruje ciepło',
    lede: 'Przewodzenie, konwekcja i ciepło przemian — zobaczysz je w widoku ciepła.',
    paragraphs: [
      'Ciepło zawsze płynie od cieplejszego do zimniejszego. W ciałach stałych przewodzi je sama substancja, w cieczach i gazach niesie je płynąca materia.',
      'Przycisk „widok ciepła” zamienia obraz w mapę temperatur: im jaśniej, tym cieplej.'
    ]
  },
  slides: [
    {
      id: 'przewodzenie', label: 'Przewodzenie',
      text: ['W gorącej wodzie (80 °C) stoją trzy pręty: miedziany, stalowy i szklany. Widok ciepła jest włączony.', 'Który pręt najszybciej nagrzeje się nad wodą? Sprawdź sondą temperaturę prętów.'],
      scene: {
        things: [
          { id: 'zlewka', kind: 'beaker', size: 600, x: 0, label: 'woda 80 °C', fill: [{ reagent: 'water-hot', amount: 450 }] },
          { id: 'cu', kind: 'rod', of: 'Cu', size: 22, x: -2.8, into: 'zlewka', label: 'miedź' },
          { id: 'stal', kind: 'rod', of: 'steel', size: 22, x: 0, into: 'zlewka', label: 'stal' },
          { id: 'szklo', kind: 'rod', of: 'glass', size: 22, x: 2.8, into: 'zlewka', label: 'szkło' }
        ],
        shelf: [],
        tools: ['probe', 'thermometer'],
        show: { heat: true },
        speed: 2,
        steps: [step('Obserwuj, jak ciepło wędruje w górę prętów.', { speed: 2 }, 40, ask('Który pręt najszybciej zrobi się ciepły nad wodą?', ['miedziany', 'stalowy', 'szklany'], 'miedziany', 'Miedź przewodzi ciepło ok. 10 razy lepiej niż stal i kilkaset razy lepiej niż szkło.'))]
      },
      expect: [{ warmer: [['cu', 12], ['szklo', 12], 6] }]
    },
    {
      id: 'konwekcja', label: 'Konwekcja',
      text: ['Na dnie zlewki z wodą leży kryształek manganianu(VII) potasu. Zlewka stoi na płycie grzejnej.', 'Włącz płytę (albo „Pokaż”) i obserwuj fioletowe smugi.'],
      scene: {
        things: [
          { id: 'plyta', kind: 'hotplate', x: 0, power: 400 },
          { id: 'zlewka', kind: 'beaker', size: 600, on: 'plyta', label: 'woda', fill: [W(450), { reagent: 'KMnO4', amount: 0.5 }] }
        ],
        shelf: ['KMnO4', 'water'],
        tools: ['probe', 'thermometer'],
        speed: 2,
        steps: [step('Włącz płytę grzejną.', { heat: 'plyta', on: true, power: 400 }, 60, ask('Dokąd popłynie fioletowy roztwór znad kryształu?', ['zostanie na dnie', 'popłynie w górę z ogrzaną wodą', 'opadnie pod kryształ'], 'popłynie w górę z ogrzaną wodą', 'Ciepła woda ma mniejszą gęstość — unosi się, a zimna opada: to konwekcja.'))]
      },
      expect: [{ up: ['zlewka', 'MnO4-', 0.1] }]
    },
    {
      id: 'mieszanina', label: 'Lód z solą',
      text: ['W zlewce jest pokruszony lód z odrobiną wody i termometr.', 'Dosyp soli kuchennej i mieszaj co kilka sekund (albo „Pokaż”). Patrz na wykres.'],
      scene: {
        things: [
          { id: 'zlewka', kind: 'beaker', size: 250, x: 0, label: 'lód', fill: [{ reagent: 'ice-crushed', amount: 60 }, W(20)] },
          { id: 'termometr', kind: 'thermometer', into: 'zlewka' }
        ],
        shelf: ['NaCl', 'CaCl2', 'ice-crushed'],
        tools: ['stir', 'thermometer'],
        graph: { things: ['termometr'], of: ['T'] },
        speed: 2,
        steps: [
          step('Dosyp soli i zamieszaj.', [{ add: 'NaCl', to: 'zlewka', amount: 20 }, { use: 'stir', at: 'zlewka' }], 7, ask('Jak zmieni się temperatura?', ['wzrośnie', 'spadnie poniżej 0 °C', 'zostanie 0 °C'], 'spadnie poniżej 0 °C', 'Sól obniża temperaturę topnienia lodu. Lód topi się i pobiera na to ciepło — z samej mieszaniny, więc ta się oziębia.')),
          ...[1, 2, 3, 4, 5, 6].map(() => step('Zamieszaj jeszcze raz.', { use: 'stir', at: 'zlewka' }, 7)),
          step('Zamieszaj i odczytaj temperaturę.', { use: 'stir', at: 'zlewka' }, 12)
        ]
      },
      expect: [{ said: 'Lód topi się w roztworze soli' }, { below: ['termometr', -4] }]
    }
  ],
  outro: {
    title: 'Co się wydarzyło?',
    body: [
      'Przewodzenie: w pręcie ciepło przechodzi od cząstki do cząstki. Metale (miedź!) przewodzą świetnie, szkło słabo — dlatego miedziany pręt tuż nad wodą szybko zrobił się ciepły. Szklany też trochę się ogrzał, ale nie przez szkło: grzeje go ciepłe, wilgotne powietrze znad wody (para skrapla się na zimnym szkle i oddaje mu ciepło).',
      'Konwekcja: ogrzana od dołu woda rozszerza się i unosi, a chłodniejsza opada. Fioletowe smugi pokazały, jak płynie — tak samo krąży powietrze nad kaloryferem.',
      'Ciepło przemian: topniejący lód pobiera ciepło. Z solą topi się poniżej 0 °C, więc pobiera je z samej mieszaniny — ta oziębia się nawet do −20 °C.',
      '## Zapamiętaj',
      'Ciepło płynie od ciała cieplejszego do zimniejszego: przez przewodzenie (ciała stałe), konwekcję (ciecze i gazy) i promieniowanie. Topnienie i parowanie pobierają ciepło, krzepnięcie i skraplanie je oddają.'
    ].join('\n')
  }
};

/* -- Rozpuszczanie i dyfuzja --------------------------------------------------------------------- */

/** Zwei Gläser nebeneinander, in beide dasselbe (`what`, `amount`) — sonst unterscheiden sie sich in einem einzigen Punkt. */
const both = (a, b, what, amount, extra = []) => [{ add: what, to: a, amount }, { add: what, to: b, amount }, ...extra];

const rozpuszczanie = {
  file: 'lab-pokaz-rozpuszczanie.json',
  path: 'pokaz-rozpuszczanie',
  title: 'Rozpuszczanie i dyfuzja',
  accent: '#2a7fa8',
  intro: {
    badge: 'Pokaz · chemia',
    headline: 'Rozpuszczanie i dyfuzja',
    lede: 'Od czego zależy, jak szybko kryształ znika w wodzie — i jak cząsteczki same rozchodzą się w cieczy?',
    paragraphs: [
      'Kryształ rozpuszcza się tylko na swojej powierzchni. Tuż przy niej woda jest nasycona, a jony muszą odejść w głąb roztworu — przez cienką warstwę cieczy przechodzą dyfuzją.',
      'Na kolejnych slajdach zmienisz po jednym czynniku: temperaturę, mieszanie, rozdrobnienie. Silnik liczy rozpuszczanie w każdej kropli osobno — z prawdziwą rozpuszczalnością i szybkością dyfuzji, która rośnie z temperaturą.'
    ]
  },
  slides: [
    {
      id: 'dyfuzja', label: 'Dyfuzja',
      text: ['W dwóch zlewkach jest woda: w lewej zimna (2 °C), w prawej gorąca (80 °C). Nikt jej nie miesza.', 'Wrzuć do obu po kryształku manganianu(VII) potasu (albo „Pokaż”) i obserwuj fioletowe smugi. Czas płynie pięć razy szybciej.'],
      scene: {
        things: [
          { id: 'zimna', kind: 'beaker', size: 250, x: -6, label: 'woda 2 °C', fill: [{ reagent: 'water-cold', amount: 200 }] },
          { id: 'goraca', kind: 'beaker', size: 250, x: 6, label: 'woda 80 °C', fill: [{ reagent: 'water-hot', amount: 200 }] }
        ],
        shelf: ['KMnO4'],
        tools: ['probe', 'thermometer'],
        speed: 5,
        steps: [step('Wrzuć kryształki manganianu(VII) potasu do obu zlewek.', both('zimna', 'goraca', 'KMnO4', 0.05), 60, ask('W której zlewce fiolet szybciej rozejdzie się po wodzie?', ['w zimnej', 'w gorącej', 'w obu tak samo'], 'w gorącej', 'W gorącej wodzie cząsteczki poruszają się szybciej, więc dyfuzja jest szybsza — a stygnąca woda dodatkowo krąży (konwekcja).'))]
      },
      expect: [{ more: [['goraca', 'up:MnO4-'], ['zimna', 'up:MnO4-'], 2] }]
    },
    {
      id: 'temperatura', label: 'Temperatura',
      text: ['W lewej zlewce jest 50 cm³ zimnej wody (2 °C), w prawej tyle samo gorącej (80 °C).', 'Wsyp do obu po 2 g niebieskiego siarczanu(VI) miedzi(II) (albo „Pokaż”). Nie mieszaj. Czas płynie dziesięć razy szybciej.'],
      scene: {
        things: [
          { id: 'zimna', kind: 'beaker', size: 100, x: -5, label: 'woda 2 °C', fill: [{ reagent: 'water-cold', amount: 50 }] },
          { id: 'goraca', kind: 'beaker', size: 100, x: 5, label: 'woda 80 °C', fill: [{ reagent: 'water-hot', amount: 50 }] }
        ],
        shelf: ['CuSO4·5H2O'],
        tools: ['stir', 'probe', 'thermometer'],
        speed: 10,
        steps: [step('Wsyp siarczan(VI) miedzi(II) do obu zlewek.', both('zimna', 'goraca', 'CuSO4·5H2O', 2), 60, ask('Gdzie kryształy znikną szybciej?', ['w zimnej wodzie', 'w gorącej wodzie', 'tak samo'], 'w gorącej wodzie', 'W gorącej wodzie jony szybciej odchodzą od kryształu (dyfuzja jest kilka razy szybsza), a do tego rozpuszcza się więcej soli.'))]
      },
      expect: [{ more: [['goraca', 'aq:Cu+2'], ['zimna', 'aq:Cu+2'], 2] }]
    },
    {
      id: 'mieszanie', label: 'Mieszanie',
      text: ['W obu zlewkach jest woda o temperaturze pokojowej. Prawa stoi na mieszadle magnetycznym — mieszadełko kręci się cały czas.', 'Wsyp do obu po 2 g siarczanu(VI) miedzi(II) (albo „Pokaż”). Czas płynie dziesięć razy szybciej.'],
      scene: {
        things: [
          { id: 'spokojna', kind: 'beaker', size: 100, x: -8, label: 'bez mieszania', fill: [W(50)] },
          { id: 'mieszadlo', kind: 'hotplate', x: 6, stir: true },
          { id: 'mieszana', kind: 'beaker', size: 100, on: 'mieszadlo', label: 'mieszana', fill: [W(50)] }
        ],
        shelf: ['CuSO4·5H2O'],
        tools: ['stir', 'probe'],
        speed: 10,
        steps: [step('Wsyp siarczan(VI) miedzi(II) do obu zlewek.', both('spokojna', 'mieszana', 'CuSO4·5H2O', 2), 40, ask('W której zlewce kryształy rozpuszczą się szybciej?', ['w spokojnej', 'w mieszanej', 'tak samo'], 'w mieszanej', 'Mieszanie odprowadza roztwór nasycony sprzed kryształu — warstwa, przez którą jony muszą przejść, robi się cieńsza. Wstrząsanie probówką działa tak samo.'))]
      },
      expect: [{ more: [['mieszana', 'aq:Cu+2'], ['spokojna', 'aq:Cu+2'], 2] }]
    },
    {
      id: 'rozdrobnienie', label: 'Rozdrobnienie',
      text: ['W obu zlewkach jest woda o temperaturze pokojowej.', 'Do lewej wsyp 2 g kryształów siarczanu(VI) miedzi(II), do prawej tyle samo utartego na proszek (albo „Pokaż”). Czas płynie dziesięć razy szybciej.'],
      scene: {
        things: [
          { id: 'krysztaly', kind: 'beaker', size: 100, x: -5, label: 'kryształy', fill: [W(50)] },
          { id: 'proszek', kind: 'beaker', size: 100, x: 5, label: 'proszek', fill: [W(50)] }
        ],
        shelf: ['CuSO4·5H2O', 'CuSO4·5H2O-powder'],
        tools: ['stir', 'probe'],
        speed: 10,
        steps: [step('Wsyp kryształy do lewej, a proszek do prawej zlewki.', [{ add: 'CuSO4·5H2O', to: 'krysztaly', amount: 2 }, { add: 'CuSO4·5H2O-powder', to: 'proszek', amount: 2 }], 40, ask('Co rozpuści się szybciej?', ['kryształy', 'proszek', 'tak samo'], 'proszek', 'Proszek ma wielokrotnie większą powierzchnię — woda styka się z większą liczbą jonów naraz.'))]
      },
      expect: [{ more: [['proszek', 'aq:Cu+2'], ['krysztaly', 'aq:Cu+2'], 2] }]
    },
    {
      id: 'nasycony', label: 'Roztwór nasycony',
      text: ['Na dwóch mieszadłach stoją zlewki z 10 cm³ wody o temperaturze pokojowej. Prawa płyta grzeje.', 'Wsyp do obu po 6 g azotanu(V) potasu (albo „Pokaż”). Czy cała sól się rozpuści? Patrz na termometry — czas płynie pięć razy szybciej.'],
      scene: {
        things: [
          { id: 'm1', kind: 'hotplate', x: -7, stir: true },
          { id: 'zimna', kind: 'beaker', size: 50, on: 'm1', label: 'bez grzania', fill: [W(10)] },
          { id: 't1', kind: 'thermometer', into: 'zimna' },
          { id: 'm2', kind: 'hotplate', x: 7, stir: true, power: 300, lit: true },
          { id: 'goraca', kind: 'beaker', size: 50, on: 'm2', label: 'grzana', fill: [W(10)] },
          { id: 't2', kind: 'thermometer', into: 'goraca' }
        ],
        shelf: ['KNO3', 'NaCl'],
        tools: ['stir', 'thermometer'],
        graph: { things: ['t1', 't2'], of: ['T'] },
        speed: 5,
        steps: [step('Wsyp azotan(V) potasu do obu zlewek.', both('zimna', 'goraca', 'KNO3', 6), 120, ask('W której zlewce zostanie nierozpuszczona sól?', ['w zimnej', 'w ogrzewanej', 'w żadnej'], 'w zimnej', 'W 20 °C w 10 g wody rozpuszcza się tylko ok. 3 g KNO₃ — roztwór jest nasycony, reszta zostaje na dnie. W ogrzewanej zlewce rozpuszczalność rośnie (w 60 °C ponad 11 g w 10 g wody) i rozpuszcza się wszystko.'))]
      },
      expect: [{ more: [['zimna', 's:KNO3'], ['goraca', 's:KNO3'], 5] }, { below: ['t1', 17] }, { above: ['t2', 50] }]
    }
  ],
  outro: {
    title: 'Co się wydarzyło?',
    body: [
      'Rozpuszczanie zachodzi na powierzchni kryształu. Tuż przy niej powstaje warstewka roztworu nasyconego, a jony odchodzą z niej w głąb dyfuzją. Szybkość rozpuszczania opisuje prawo Noyesa–Whitneya: rośnie z powierzchnią kryształu i współczynnikiem dyfuzji, maleje z grubością warstewki i zanika, gdy roztwór zbliża się do nasycenia.',
      'Temperatura: w gorącej wodzie cząsteczki poruszają się szybciej — dyfuzja w 80 °C jest ok. 3 razy szybsza niż w 20 °C — a większość soli rozpuszcza się lepiej. Mieszanie i wstrząsanie zdzierają warstewkę nasyconą. Rozdrobnienie zwiększa powierzchnię.',
      'Sama dyfuzja jest powolna: w nieruchomej wodzie fiolet przesuwa się w ciągu 10 minut o milimetr, dwa. Roztwór KMnO₄ jest cięższy od wody, więc w zimnej zlewce zbiera się na dnie. W gorącej wodzie rozprowadzają go prądy stygnącej wody.',
      'Roztwór nasycony: w danej temperaturze rozpuści się tylko określona ilość soli, reszta zostaje na dnie. Rozpuszczalność KNO₃ rośnie z temperaturą — 32 g w 100 g wody w 20 °C, 110 g w 60 °C. Jego rozpuszczanie pobiera ciepło: w zlewce bez grzania temperatura spadła, a w zimniejszym roztworze rozpuszcza się jeszcze mniej.',
      '## Zapamiętaj',
      'Rozpuszczanie przyspieszają: ogrzewanie, mieszanie (wstrząsanie) i rozdrobnienie. Ile substancji może się rozpuścić, mówi jej rozpuszczalność — a ta zależy od temperatury.',
      '## Spróbuj sam',
      'W piaskownicy porównaj cukier i cukier puder w zimnej i gorącej wodzie. Ile soli kuchennej rozpuści się w 10 cm³ wody — i czy w gorącej wodzie dużo więcej?'
    ].join('\n')
  }
};

/* -- Szybkość reakcji ---------------------------------------------------------------------------- */

const szybkosc = {
  file: 'lab-pokaz-szybkosc.json',
  path: 'pokaz-szybkosc',
  title: 'Szybkość reakcji chemicznej',
  accent: '#1e8a7a',
  intro: {
    badge: 'Pokaz · chemia',
    headline: 'Szybkość reakcji chemicznej',
    lede: 'Dlaczego jedne reakcje trwają ułamek sekundy, a inne minuty — i jak je przyspieszyć?',
    paragraphs: [
      'Żeby zaszła reakcja, cząsteczki muszą się zderzyć — i to dość mocno. Szybkość reakcji zależy więc od tego, jak często i jak energicznie się zderzają: od stężenia, temperatury, rozdrobnienia i obecności katalizatora.',
      'Silnik liczy dla każdej reakcji jej prawo szybkości, np. v = k·[S₂O₃²⁻], a stała k rośnie z temperaturą (równanie Arrheniusa). Reakcja zachodzi tylko tam, gdzie substraty naprawdę się spotykają.'
    ]
  },
  slides: [
    {
      id: 'stezenie', label: 'Stężenie',
      text: ['W lewej kolbie jest 50 cm³ roztworu tiosiarczanu sodu, w prawej 25 cm³ tego roztworu rozcieńczone wodą do 50 cm³.', 'Wlej do obu po 5 cm³ kwasu solnego i zamieszaj (albo „Pokaż”). Gdzie roztwór szybciej zmętnieje?'],
      scene: {
        things: [
          { id: 'stezony', kind: 'flask', size: 100, x: -6, label: 'tiosiarczan', fill: [{ reagent: 'Na2S2O3', amount: 50 }] },
          { id: 'rozcienczony', kind: 'flask', size: 100, x: 6, label: 'tiosiarczan + woda', fill: [{ reagent: 'Na2S2O3', amount: 25 }, W(25)] }
        ],
        shelf: ['HCl', 'Na2S2O3', 'water'],
        tools: ['stir'],
        steps: [step('Wlej kwas solny do obu kolb i zamieszaj.', both('stezony', 'rozcienczony', 'HCl', 5, [{ use: 'stir', at: 'stezony' }, { use: 'stir', at: 'rozcienczony' }]), 60, ask('Gdzie siarka wydzieli się szybciej?', ['w stężonym roztworze', 'w rozcieńczonym', 'tak samo'], 'w stężonym roztworze', 'Im więcej cząsteczek w tej samej objętości, tym częściej się zderzają — szybkość tej reakcji jest proporcjonalna do stężenia tiosiarczanu.'))]
      },
      expect: [{ said: 'mętnieje' }, { more: [['stezony', 's:S'], ['rozcienczony', 's:S'], 1.6] }]
    },
    {
      id: 'temperatura', label: 'Temperatura',
      text: ['W obu kolbach jest po 50 cm³ roztworu tiosiarczanu sodu — w lewej o temperaturze pokojowej, w prawej ogrzany do 50 °C.', 'Wlej do obu po 5 cm³ kwasu solnego i zamieszaj (albo „Pokaż”).'],
      scene: {
        things: [
          { id: 'zimny', kind: 'flask', size: 100, x: -6, label: '20 °C', fill: [{ reagent: 'Na2S2O3', amount: 50 }] },
          { id: 'cieply', kind: 'flask', size: 100, x: 6, label: '50 °C', fill: [{ reagent: 'Na2S2O3', amount: 50 }], T: 50 }
        ],
        shelf: ['HCl', 'Na2S2O3'],
        tools: ['stir', 'thermometer'],
        steps: [step('Wlej kwas solny do obu kolb i zamieszaj.', both('zimny', 'cieply', 'HCl', 5, [{ use: 'stir', at: 'zimny' }, { use: 'stir', at: 'cieply' }]), 40, ask('W której kolbie roztwór zmętnieje szybciej?', ['w zimnej', 'w ciepłej', 'tak samo'], 'w ciepłej', 'W wyższej temperaturze więcej zderzeń ma energię potrzebną do reakcji — tu szybkość rośnie mniej więcej dwa razy na każde 10 °C.'))]
      },
      expect: [{ said: 'mętnieje' }, { more: [['cieply', 's:S'], ['zimny', 's:S'], 2.5] }]
    },
    {
      id: 'katalizator', label: 'Katalizator',
      text: ['W obu kolbach jest po 50 cm³ wody utlenionej (3%). Nadtlenek wodoru sam rozkłada się bardzo powoli.', 'Do prawej kolby dosyp szczyptę tlenku manganu(IV) (albo „Pokaż”), a potem wsuń do niej żarzące się łuczywo.'],
      scene: {
        things: [
          { id: 'bez', kind: 'flask', size: 250, x: -7, label: 'H₂O₂', fill: [{ reagent: 'H2O2', amount: 50 }] },
          { id: 'z', kind: 'flask', size: 250, x: 7, label: 'H₂O₂ + MnO₂', fill: [{ reagent: 'H2O2', amount: 50 }] }
        ],
        shelf: ['MnO2', 'potato', 'KI-s', 'H2O2'],
        tools: ['glow', 'splint'],
        steps: [
          step('Dosyp tlenku manganu(IV) do prawej kolby.', { add: 'MnO2', to: 'z', amount: 0.5 }, 20, ask('Co się stanie w kolbie z tlenkiem manganu(IV)?', ['nic', 'zacznie się wydzielać gaz', 'roztwór zmieni barwę'], 'zacznie się wydzielać gaz', 'MnO₂ jest katalizatorem: przyspiesza rozkład 2H₂O₂ → 2H₂O + O₂, a sam się nie zużywa.')),
          step('Wsuń żarzące się łuczywo do prawej kolby.', { use: 'glow', at: 'z' }, 6)
        ]
      },
      expect: [{ said: 'tlenku manganu(IV) — wydziela się tlen' }, { more: [['z', 'gas:O2'], ['bez', 'gas:O2'], 1.5] }]
    },
    {
      id: 'rozdrobnienie', label: 'Rozdrobnienie',
      text: ['W obu kolbach jest po 20 cm³ kwasu solnego.', 'Do lewej wrzuć 2 g marmuru w kawałkach, do prawej 2 g kredy w proszku (albo „Pokaż”). Jedno i drugie to węglan wapnia.'],
      scene: {
        things: [
          { id: 'marmur', kind: 'flask', size: 100, x: -6, label: 'marmur', fill: [{ reagent: 'HCl', amount: 20 }] },
          { id: 'kreda', kind: 'flask', size: 100, x: 6, label: 'kreda', fill: [{ reagent: 'HCl', amount: 20 }] }
        ],
        shelf: ['CaCO3', 'CaCO3-powder', 'HCl'],
        tools: ['splint', 'stir'],
        steps: [step('Wrzuć marmur do lewej, a kredę do prawej kolby.', [{ add: 'CaCO3', to: 'marmur', amount: 2 }, { add: 'CaCO3-powder', to: 'kreda', amount: 2 }], 8, ask('Gdzie gaz wydziela się gwałtowniej?', ['przy marmurze', 'przy kredzie', 'tak samo'], 'przy kredzie', 'Kwas reaguje tylko z powierzchnią ciała stałego — proszek ma jej wielokrotnie więcej niż kawałki.'))]
      },
      expect: [{ more: [['kreda', 'aq:Ca+2'], ['marmur', 'aq:Ca+2'], 1.4] }]
    }
  ],
  outro: {
    title: 'Co się wydarzyło?',
    body: [
      'Stężenie: tiosiarczan sodu rozkłada się w kwasie: S₂O₃²⁻ + 2H⁺ → S↓ + SO₂ + H₂O. Szybkość jest proporcjonalna do stężenia tiosiarczanu (v = k·[S₂O₃²⁻]) — w roztworze rozcieńczonym o połowę siarka wydziela się dwa razy wolniej.',
      'Temperatura: stała szybkości rośnie wykładniczo z temperaturą (równanie Arrheniusa, k = A·e^(−Eₐ/RT)). Dla tej reakcji (Eₐ ≈ 45 kJ/mol) ogrzanie o 30 °C przyspiesza ją ok. 5 razy.',
      'Katalizator: MnO₂ otwiera reakcji łatwiejszą drogę, o niższej energii aktywacji. Rozkład H₂O₂, który sam trwałby miesiącami, zachodzi w kilka sekund — a tlenek manganu(IV) zostaje w kolbie nienaruszony. Tlen podtrzymuje palenie: łuczywo rozżarza się mocniej.',
      'Rozdrobnienie: reakcja ciała stałego z cieczą zachodzi tylko na jego powierzchni. Kreda w proszku reaguje znacznie szybciej niż kawałki marmuru, choć to ten sam węglan wapnia.',
      '## Zapamiętaj',
      'Szybkość reakcji zwiększają: wyższe stężenie, wyższa temperatura, większe rozdrobnienie i katalizator. Katalizator nie zużywa się w reakcji.',
      '## Spróbuj sam',
      'W piaskownicy porównaj katalizatory w wodzie utlenionej: MnO₂, plasterek ziemniaka (enzym katalaza) i jodek potasu. Co zrobi ziemniak w gorącej wodzie utlenionej (70 °C)?'
    ].join('\n')
  }
};

/* -- Równowaga chemiczna ------------------------------------------------------------------------- */

/** NO₂ z powietrzem: w gorącej wodzie ciśnienie rośnie o ok. 1/3 — korek wytrzymuje (sam NO₂ by go wypchnął). */
const NO2_AIR = { NO2: 0.4, N2: 0.48, O2: 0.12 };

const rownowaga = {
  file: 'lab-pokaz-rownowaga.json',
  path: 'pokaz-rownowaga',
  title: 'Reakcje odwracalne i równowaga',
  accent: '#c27c0e',
  intro: {
    badge: 'Pokaz · chemia',
    headline: 'Reakcje odwracalne i równowaga',
    lede: 'Czy reakcja zawsze idzie do końca? Czasem substraty i produkty zostają razem — w równowadze.',
    paragraphs: [
      'Wiele reakcji biegnie w obie strony. Gdy szybkość reakcji w prawo zrówna się z szybkością reakcji w lewo, skład mieszaniny przestaje się zmieniać — to równowaga chemiczna. Zmiana warunków (stężenia, temperatury) przesuwa ją w jedną stronę: to reguła przekory Le Chateliera.',
      'Zobaczysz to na dwóch przykładach: żółty chromian i pomarańczowy dichromian w roztworze oraz brunatny NO₂ i bezbarwny N₂O₄ w zamkniętych probówkach.'
    ]
  },
  slides: [
    {
      id: 'kwas', label: 'Chromian w kwasie',
      text: ['W probówce jest żółty roztwór chromianu(VI) potasu.', 'Dodaj kwasu siarkowego(VI) i zamieszaj (albo „Pokaż”).'],
      scene: {
        things: [{ id: 'probowka', kind: 'tube', size: 25, x: 0, label: 'K₂CrO₄', fill: [{ reagent: 'K2CrO4', amount: 8 }] }],
        shelf: ['H2SO4', 'NaOH-aq', 'K2CrO4'],
        tools: ['stir', 'paper'],
        steps: [step('Dodaj kwas siarkowy(VI) i zamieszaj.', [{ add: 'H2SO4', to: 'probowka', amount: 2 }, { use: 'stir', at: 'probowka' }], 6, ask('Jaki kolor przybierze roztwór?', ['pomarańczowy', 'niebieski', 'zostanie żółty'], 'pomarańczowy', 'W kwasie jony chromianowe łączą się w dichromianowe: 2CrO₄²⁻ + 2H⁺ ⇄ Cr₂O₇²⁻ + H₂O.'))]
      },
      expect: [{ said: 'staje się pomarańczowy' }]
    },
    {
      id: 'zasada', label: 'I z powrotem',
      text: ['Teraz w probówce jest pomarańczowy roztwór dichromianu(VI) potasu.', 'Dodaj zasady sodowej i zamieszaj (albo „Pokaż”). Czy wróci żółty chromian?'],
      scene: {
        things: [{ id: 'probowka', kind: 'tube', size: 25, x: 0, label: 'K₂Cr₂O₇', fill: [{ reagent: 'K2Cr2O7', amount: 8 }] }],
        shelf: ['NaOH-aq', 'H2SO4', 'K2Cr2O7'],
        tools: ['stir', 'paper'],
        steps: [step('Dodaj zasadę sodową i zamieszaj.', [{ add: 'NaOH-aq', to: 'probowka', amount: 4 }, { use: 'stir', at: 'probowka' }], 6, ask('Co się stanie?', ['roztwór znów zżółknie', 'wytrąci się osad', 'nic'], 'roztwór znów zżółknie', 'Zasada zabiera jony H⁺ — równowaga przesuwa się w lewo: Cr₂O₇²⁻ + 2OH⁻ → 2CrO₄²⁻ + H₂O.'))]
      },
      expect: [{ said: 'żółty chromian' }]
    },
    {
      id: 'no2', label: 'NO₂ i N₂O₄',
      text: ['W trzech zamkniętych probówkach jest ta sama mieszanina: brunatny tlenek azotu(IV) NO₂ i bezbarwny N₂O₄ z powietrzem. Probówki stoją w wodzie z lodem, w wodzie o temperaturze pokojowej i w gorącej wodzie.', 'Obserwuj barwę gazu (albo „Pokaż”). Czas płynie pięć razy szybciej.'],
      scene: {
        things: [
          { id: 'lod', kind: 'beaker', size: 600, x: -11, label: 'woda z lodem', fill: [{ reagent: 'water-cold', amount: 380 }, { reagent: 'ice-crushed', amount: 100 }] },
          { id: 'p1', kind: 'tube', size: 10, into: 'lod', gas: NO2_AIR, closed: true },
          { id: 'woda', kind: 'beaker', size: 600, x: 0, label: 'woda 20 °C', fill: [W(480)] },
          { id: 'p2', kind: 'tube', size: 10, into: 'woda', gas: NO2_AIR, closed: true },
          { id: 'goraca', kind: 'beaker', size: 600, x: 11, label: 'woda 80 °C', fill: [{ reagent: 'water-hot', amount: 480 }] },
          { id: 'p3', kind: 'tube', size: 10, into: 'goraca', gas: NO2_AIR, closed: true }
        ],
        shelf: [],
        tools: ['probe', 'thermometer'],
        speed: 5,
        steps: [step('Obserwuj barwę gazu w probówkach.', { speed: 5 }, 60, ask('W której probówce gaz będzie najciemniejszy?', ['w wodzie z lodem', 'w temperaturze pokojowej', 'w gorącej wodzie'], 'w gorącej wodzie', 'N₂O₄ ⇄ 2NO₂ pochłania ciepło (ΔH = +57 kJ/mol). Ogrzanie przesuwa równowagę w stronę brunatnego NO₂, oziębienie — w stronę bezbarwnego N₂O₄.'))]
      },
      expect: [{ more: [['p3', 'gas:NO2'], ['p2', 'gas:NO2'], 1.8] }, { more: [['p2', 'gas:NO2'], ['p1', 'gas:NO2'], 1.4] }]
    }
  ],
  outro: {
    title: 'Co się wydarzyło?',
    body: [
      'Chromiany: w roztworze ustala się równowaga 2CrO₄²⁻ + 2H⁺ ⇄ Cr₂O₇²⁻ + H₂O. Kwas (więcej H⁺) przesuwa ją w prawo — roztwór robi się pomarańczowy. Zasada zabiera H⁺ i przesuwa ją z powrotem — roztwór znów jest żółty. Reakcja jest odwracalna.',
      'NO₂ i N₂O₄: w każdej probówce są obie substancje naraz, w stosunku zależnym od temperatury. Rozpad N₂O₄ na 2NO₂ pochłania ciepło, więc ogrzanie przesuwa równowagę w stronę NO₂ (ciemniej), a oziębienie — w stronę N₂O₄ (jaśniej). W gorącej probówce rośnie też ciśnienie: z jednej cząsteczki N₂O₄ powstają dwie cząsteczki NO₂.',
      'W równowadze reakcja się nie zatrzymuje: w każdej chwili tyle samo N₂O₄ się rozpada, ile powstaje. Silnik liczy obie reakcje z ich szybkościami — i stałą równowagi K, która zmienia się z temperaturą (równanie van ’t Hoffa).',
      '## Zapamiętaj',
      'Reguła przekory: układ w równowadze reaguje na zmianę warunków tak, by ją osłabić — zużywa dodany substrat, a ogrzany przesuwa się w stronę reakcji, która pochłania ciepło.',
      '## Spróbuj sam',
      'Przestaw probówkę z gorącej wody do wody z lodem — barwa zblednie. Reakcja biegnie z powrotem.'
    ].join('\n')
  }
};

export const CHEM_DECKS = [cyna, osady, wodor, swieca, zobojetnianie, cieplo, rozpuszczanie, szybkosc, rownowaga];
