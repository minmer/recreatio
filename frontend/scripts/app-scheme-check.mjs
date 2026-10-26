/**
 * 2026-10-26 — DAS KIRCHENJAHR, DIE PLÄNE UND DIE REGELN, nachgemessen (ohne Dienst).
 *
 *   1. Ostern, Advent, Taufe des Herrn, Heilige Familie für bekannte Jahre.
 *   2. Abschnitt, Woche, Rang und Name bekannter Tage (Aschermittwoch, Karwoche,
 *      Osteroktav, Pfingsten, die Woche nach Pfingsten, Christkönig, die
 *      Weihnachtsoktav, die Wochen im Jahreskreis).
 *   3. Die Vorlage „Rok liturgiczny — parafia (Polska)" an bekannten Tagen:
 *      Weihnachten mit Pasterka, Palmsonntag rot, Gaudete rosa, Mittwochabend
 *      MB NP (nicht in der Fastenzeit), Sonntag 12:13 „Za parafian", der
 *      8. Dezember an einem Adventssonntag am Montag, der 25. März aus der
 *      Karwoche hinter die Osteroktav, das Triduum, Christi Himmelfahrt am
 *      7. Ostersonntag, Fronleichnam, Herz Jesu, Allerseelen an einem Sonntag,
 *      die Heilige Familie am 30. Dezember, wenn Weihnachten ein Sonntag ist.
 *   4. Die Regel der Intentionen (zweite pojedyncza, zbiorowa zu pojedynczej,
 *      dritte Messe mit zbiorowe in einer Woche, von aussen wartet) und die
 *      der Anmeldungen.
 *   5. Kaputte Abläufe: ohne „Dzień", Schleife, Weg ohne „Godziny mszy".
 *   6. Die Vorlagen selbst: jede Kante trifft einen Knoten, jede Bedingung hat
 *      „tak" und „nie", kein Knoten liegt auf einem anderen, JSON hin und zurück.
 */
import { build } from 'esbuild';
import { isDeepStrictEqual } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-scheme-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}calendar/flow/liturgy';
export { planDay, planRange, runRule, fillTemplate, feastOn, describeTest } from '${app}calendar/flow/flowRun';
export { SCHEME_TEMPLATES, INTENTION_RULE, SIGNUP_RULE } from '${app}calendar/templates/schemeTemplates';
export { PLAN_TEMPLATES, POLISH_CALENDAR } from '${app}calendar/templates/planTemplates';
export { LITURGICAL_COLOURS } from '${app}calendar/scheme';
export { NODE_INFO, PLAN_NODES, RULE_NODES } from '${app}calendar/flow/flowModel';
export { draftValues, editText, sealValues, valueAad, valuesAsDraft } from '${app}calendar/schemeValues';
export { recordAad, weekOf, isLive } from '${app}calendar/records';
export { aadText, openText } from '${app}core/crypto';
export { UNIVERSAL } from '${app}calendar/scheme';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

/* Wie in den anderen Prüfungen: ein BroadcastChannel hielte den Lauf am Leben. */
const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

let failed = 0;
let passed = 0;
const check = (label, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`ok   ${label}`); }
  else { failed += 1; console.log(`FAIL ${label}${detail ? `   ${detail}` : ''}`); }
};
const q = (x) => JSON.stringify(x);

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);

  /* -- 1. Die beweglichen Tage --------------------------------------------------------------- */
  const easters = { 2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16', 2029: '2029-04-01', 2030: '2030-04-21' };
  const gotEaster = Object.keys(easters).map((y) => m.easter(Number(y)));
  check('1.1 Easter 2024–2030', q(gotEaster) === q(Object.values(easters)), q(gotEaster));
  const advents = { 2022: '2022-11-27', 2024: '2024-12-01', 2025: '2025-11-30', 2026: '2026-11-29', 2027: '2027-11-28' };
  const gotAdvent = Object.keys(advents).map((y) => m.adventStart(Number(y)));
  check('1.2 first Sunday of Advent (also when Christmas is a Sunday)', q(gotAdvent) === q(Object.values(advents)), q(gotAdvent));
  check('1.3 Baptism of the Lord: the Sunday after 6 January (6 I on Saturday / Sunday too)',
    m.baptismOfTheLord(2026) === '2026-01-11' && m.baptismOfTheLord(2024) === '2024-01-07' && m.baptismOfTheLord(2030) === '2030-01-13',
    q([m.baptismOfTheLord(2026), m.baptismOfTheLord(2024), m.baptismOfTheLord(2030)]));
  check('1.4 Holy Family: Sunday in the octave, 30 XII when Christmas is a Sunday',
    m.holyFamily(2026) === '2026-12-27' && m.holyFamily(2022) === '2022-12-30' && m.holyFamily(2023) === '2023-12-31',
    q([m.holyFamily(2026), m.holyFamily(2022), m.holyFamily(2023)]));
  check('1.5 weekdays and arithmetic', m.weekdayOf('2026-10-26') === 1 && m.weekdayOf('2026-11-01') === 7 && m.addDays('2026-12-31', 1) === '2027-01-01'
    && m.diffDays('2026-03-01', '2026-02-01') === 28 && !m.isDate('2026-02-30') && m.isDate('2028-02-29'));

  /* -- 2. Der Tag im Kirchenjahr --------------------------------------------------------------- */
  const day = (date, want) => {
    const got = m.dayInfo(date);
    const bad = Object.entries(want).filter(([k, v]) => got[k] !== v);
    check(`2 ${date}: ${Object.entries(want).map(([k, v]) => `${k}=${v}`).join(', ')}`, bad.length === 0, q(Object.fromEntries(bad.map(([k]) => [k, got[k]]))));
  };
  day('2026-01-11', { season: 'narodzenie', sunday: true, sundayName: 'Niedziela Chrztu Pańskiego' });
  day('2026-01-12', { season: 'zwykly', week: 1, dayRank: 13, dayName: 'Poniedziałek I tygodnia zwykłego' });
  day('2026-01-18', { season: 'zwykly', week: 2, dayRank: 6, sundayName: 'II Niedziela zwykła' });
  day('2026-02-17', { season: 'zwykly', week: 6, dayName: 'Wtorek VI tygodnia zwykłego' });
  day('2026-02-18', { season: 'post', week: 0, dayRank: 2, dayName: 'Środa Popielcowa' });
  day('2026-02-19', { season: 'post', week: 0, dayRank: 9, dayName: 'Czwartek po Popielcu' });
  day('2026-02-22', { season: 'post', week: 1, dayRank: 2, sundayName: 'I Niedziela Wielkiego Postu' });
  day('2026-03-15', { season: 'post', week: 4, special: 'laetare', sundayName: 'IV Niedziela Wielkiego Postu' });
  day('2026-03-29', { season: 'post', week: 6, special: 'palm', dayRank: 2, sundayName: 'Niedziela Palmowa Męki Pańskiej' });
  day('2026-03-30', { season: 'post', dayRank: 2, dayName: 'Wielki Poniedziałek' });
  day('2026-04-02', { season: 'triduum', dayRank: 1, dayName: 'Wielki Czwartek' });
  day('2026-04-03', { season: 'triduum', dayRank: 1, special: 'goodFriday' });
  day('2026-04-05', { season: 'wielkanoc', week: 1, dayRank: 1, sundayName: 'Niedziela Zmartwychwstania Pańskiego' });
  day('2026-04-06', { season: 'wielkanoc', week: 1, dayRank: 2, dayName: 'Poniedziałek w oktawie Wielkanocy' });
  day('2026-04-12', { season: 'wielkanoc', week: 2, dayRank: 2, sunday: true });
  day('2026-04-14', { season: 'wielkanoc', week: 2, dayRank: 13, dayName: 'Wtorek II tygodnia wielkanocnego' });
  day('2026-05-24', { season: 'wielkanoc', week: 7, special: 'pentecost', sundayName: 'Niedziela Zesłania Ducha Świętego' });
  day('2026-05-25', { season: 'zwykly', week: 8, dayRank: 13 });
  day('2026-10-25', { season: 'zwykly', week: 30, sundayName: 'XXX Niedziela zwykła' });
  day('2026-11-22', { season: 'zwykly', week: 34, sunday: true, dayRank: 6 });
  day('2026-11-28', { season: 'zwykly', week: 34, dayName: 'Sobota XXXIV tygodnia zwykłego' });
  day('2026-11-29', { season: 'adwent', week: 1, dayRank: 2, sundayName: 'I Niedziela Adwentu' });
  day('2026-12-01', { season: 'adwent', week: 1, dayRank: 13, dayName: 'Wtorek I tygodnia Adwentu' });
  day('2026-12-13', { season: 'adwent', week: 3, special: 'gaudete' });
  day('2026-12-17', { season: 'adwent', dayRank: 9, dayName: '17 grudnia' });
  day('2027-11-29', { season: 'adwent', week: 1, dayRank: 13 });
  day('2026-12-26', { season: 'narodzenie', dayRank: 9, dayName: 'Drugi dzień w oktawie Narodzenia Pańskiego' });
  day('2026-12-27', { season: 'narodzenie', dayRank: 6, sundayName: 'Niedziela w oktawie Narodzenia Pańskiego' });
  day('2027-01-03', { season: 'narodzenie', sundayName: 'II Niedziela po Narodzeniu Pańskim' });
  day('2027-01-07', { season: 'narodzenie', dayRank: 13, dayName: 'Czwartek po Objawieniu Pańskim' });
  check('2.x roman numerals', m.roman(34) === 'XXXIV' && m.roman(9) === 'IX' && m.roman(0) === '');

  /* -- 3. Die Vorlage des Kirchenjahres --------------------------------------------------------- */
  const tpl = m.PLAN_TEMPLATES.find((t) => t.id === 'rok-liturgiczny-pl');
  check('3.0 the plan template exists and needs the scheme "msza"', tpl !== undefined && tpl.needs === 'msza' && m.SCHEME_TEMPLATES.some((s) => s.id === 'msza'));
  const plan = (date) => m.planDay(tpl.def.flow, date);
  const masses = (date) => plan(date).masses;
  const show = (ms) => q(ms.map((x) => [x.slot.time, x.title, x.values.kolor, x.records.map((r) => r.text)]));

  {
    const d = plan('2026-12-25');
    const ms = d.masses;
    check('3.1 Christmas: Pasterka at 0:00 first, then the festive hours, white, "Narodzenie Pańskie"',
      ms.length === 5 && ms[0].slot.key === 'bn0000' && ms[0].title === 'Pasterka — Narodzenie Pańskie'
        && ms.slice(1).every((x) => x.title === 'Narodzenie Pańskie') && ms.every((x) => x.values.kolor === 'biały' && x.values.obchod === 'Narodzenie Pańskie')
        && d.problems.length === 0, show(ms) + q(d.problems));
  }
  {
    const ms = masses('2026-03-29');
    check('3.2 Palm Sunday: red, its name', ms.length === 5 && ms.every((x) => x.values.kolor === 'czerwony' && x.title === 'Niedziela Palmowa Męki Pańskiej'), show(ms));
  }
  {
    const ms = masses('2026-12-13');
    check('3.3 Gaudete: rose', ms.length === 5 && ms.every((x) => x.values.kolor === 'różowy' && x.title === 'III Niedziela Adwentu'), show(ms));
  }
  {
    const ms = masses('2026-07-08');
    check('3.4 an ordinary Wednesday: 7:00 the weekday, 18:00 the votive mass of MB NP in white',
      ms.length === 2 && ms[0].title === 'Środa XIV tygodnia zwykłego' && ms[0].values.kolor === 'zielony'
        && ms[1].title === 'Msza wotywna o Matce Bożej Nieustającej Pomocy' && ms[1].values.kolor === 'biały'
        && ms[1].values.obchod === 'Najświętsza Maryja Panna Nieustającej Pomocy', show(ms));
  }
  {
    const ms = masses('2026-03-11');
    check('3.5 a Wednesday in Lent: no votive mass, violet', ms.length === 2 && ms[1].title === 'Środa III tygodnia Wielkiego Postu' && ms[1].values.kolor === 'fioletowy', show(ms));
  }
  {
    const ms = masses('2026-10-25');
    const suma = ms.find((x) => x.slot.key === 'n1213');
    check('3.6 Sunday 12:13: the record "Za parafian" (single) — only there',
      ms.length === 5 && suma !== undefined && q(suma.records) === q([{ list: 'intencje', mode: 'single', text: 'Za parafian' }])
        && ms.filter((x) => x.records.length > 0).length === 1 && ms.every((x) => x.title === 'XXX Niedziela zwykła' && x.values.kolor === 'zielony'), show(ms));
  }
  {
    const sunday = masses('2024-12-08');
    const monday = masses('2024-12-09');
    check('3.7 8 XII on an Advent Sunday moves to Monday',
      sunday.every((x) => x.title === 'II Niedziela Adwentu' && x.values.kolor === 'fioletowy')
        && monday.length === 2 && monday.every((x) => x.title === 'Niepokalane Poczęcie Najświętszej Maryi Panny' && x.values.kolor === 'biały'),
      show(sunday) + show(monday));
  }
  {
    const holyMonday = masses('2024-03-25');
    const after = masses('2024-04-08');
    check('3.8 25 III in Holy Week moves behind the Easter octave (2024: 8 IV)',
      holyMonday.every((x) => x.title !== 'Zwiastowanie Pańskie') && after.every((x) => x.title === 'Zwiastowanie Pańskie'), show(holyMonday) + show(after));
  }
  {
    const sun = masses('2023-03-19');
    const mon = masses('2023-03-20');
    check('3.9 St Joseph on a Sunday of Lent moves to Monday',
      sun.every((x) => x.title === 'IV Niedziela Wielkiego Postu') && mon.every((x) => x.title === 'Świętego Józefa, Oblubieńca Najświętszej Maryi Panny'), show(sun) + show(mon));
  }
  {
    const thu = plan('2026-04-02');
    const fri = plan('2026-04-03');
    const sat = plan('2026-04-04');
    check('3.10 Triduum: Thursday one mass 18:00 (Wieczerza Pańska, white), Friday none, Saturday the Vigil 20:00',
      thu.masses.length === 1 && thu.masses[0].slot.time === '18:00' && thu.masses[0].title === 'Msza Wieczerzy Pańskiej' && thu.masses[0].values.kolor === 'biały'
        && fri.masses.length === 0 && fri.problems.length === 0
        && sat.masses.length === 1 && sat.masses[0].slot.time === '20:00' && sat.masses[0].title === 'Wigilia Paschalna w Wielką Noc',
      show(thu.masses) + show(fri.masses) + q(fri.problems) + show(sat.masses));
  }
  {
    const easterDay = masses('2026-04-05');
    const monday = masses('2026-04-06');
    check('3.11 Easter and Easter Monday: festive hours, white',
      easterDay.length === 5 && easterDay.every((x) => x.title === 'Niedziela Zmartwychwstania Pańskiego' && x.values.kolor === 'biały')
        && monday.length === 5 && monday.every((x) => x.title === 'Poniedziałek w oktawie Wielkanocy'), show(easterDay) + show(monday));
  }
  const titled = (date, title, colour, count) => {
    const ms = masses(date);
    check(`3 ${date}: ${title} (${colour}${count === undefined ? '' : `, ${count} mszy`})`,
      ms.length > 0 && ms.every((x) => x.title === title && x.values.kolor === colour) && (count === undefined || ms.length === count), show(ms));
  };
  titled('2026-05-17', 'Wniebowstąpienie Pańskie', 'biały', 5);
  titled('2026-05-24', 'Zesłanie Ducha Świętego', 'czerwony', 5);
  titled('2026-05-25', 'Najświętszej Maryi Panny, Matki Kościoła', 'biały', 2);
  titled('2026-05-31', 'Najświętszej Trójcy', 'biały', 5);
  titled('2026-06-04', 'Najświętszego Ciała i Krwi Chrystusa (Boże Ciało)', 'biały', 5);
  titled('2026-06-12', 'Najświętszego Serca Pana Jezusa', 'biały', 2);
  titled('2026-11-22', 'Jezusa Chrystusa, Króla Wszechświata', 'biały', 5);
  titled('2022-12-30', 'Świętej Rodziny: Jezusa, Maryi i Józefa', 'biały');
  titled('2026-12-27', 'Świętej Rodziny: Jezusa, Maryi i Józefa', 'biały', 5);
  titled('2025-11-02', 'Wspomnienie wszystkich wiernych zmarłych', 'fioletowy', 5);
  titled('2026-11-01', 'Wszystkich Świętych', 'biały', 5);
  titled('2026-02-18', 'Środa Popielcowa', 'fioletowy', 2);
  titled('2026-08-15', 'Wniebowzięcie Najświętszej Maryi Panny', 'biały', 5);
  titled('2026-01-06', 'Objawienie Pańskie', 'biały', 5);
  titled('2025-06-13', 'Świętego Antoniego z Padwy', 'biały', 2);
  /* 2026: der 13. Juni ist auch Niepokalanego Serca (Ostern + 69) — die obere Zeile gewinnt, wie im Ordo. */
  titled('2026-06-13', 'Niepokalanego Serca Najświętszej Maryi Panny', 'biały', 2);
  titled('2026-10-22', 'Świętego Jana Pawła II', 'biały', 2);
  titled('2026-03-04', 'Świętego Kazimierza', 'biały', 2);
  titled('2026-03-07', 'Sobota II tygodnia Wielkiego Postu', 'fioletowy', 2);
  titled('2026-09-14', 'Podwyższenie Krzyża Świętego', 'czerwony', 2);
  titled('2026-01-11', 'Chrzest Pański', 'biały', 5);
  titled('2026-12-26', 'Świętego Szczepana, pierwszego męczennika', 'czerwony', 5);

  {
    const t0 = Date.now();
    const year = m.planRange(tpl.def, '2027-01-01', '2027-12-31');
    const ms = year.flatMap((d) => d.masses);
    const problems = year.flatMap((d) => d.problems);
    const sundays = year.filter((d) => d.ctx.sunday);
    const elapsed = Date.now() - t0;
    check('3.20 a whole year (2027): 365 days, no problems, every Sunday 5 masses, every mass titled and coloured, under 5 s',
      year.length === 365 && problems.length === 0 && sundays.every((d) => d.masses.length === 5)
        && ms.every((x) => x.title.trim() !== '' && x.values.kolor !== undefined && x.values.kolor !== '' && x.values.obchod !== '') && elapsed < 5000,
      q({ days: year.length, problems: problems.slice(0, 3), elapsed, empty: ms.filter((x) => !x.values.kolor).slice(0, 2).map((x) => [x.date, x.title]) }));
    const colours = new Set(m.LITURGICAL_COLOURS.map((c) => c.value));
    check('3.21 every colour the year uses is a liturgical colour', ms.every((x) => colours.has(x.values.kolor)), q([...new Set(ms.map((x) => x.values.kolor))]));
    const fixedKeys = new Set(['n0730', 'n0900', 'n1030', 'n1213', 'n1800', 'p0700', 'p1800', 'wcz1800', 'wig2000', 'bn0000']);
    check('3.22 slot keys are the stable ones', ms.every((x) => fixedKeys.has(x.slot.key)), q([...new Set(ms.map((x) => x.slot.key))]));
    check('3.23 only Sundays and festive days carry "Za parafian", one each',
      year.every((d) => d.masses.filter((x) => x.records.length > 0).length === (d.ctx.festive ? 1 : 0)));
  }
  {
    const range = m.planRange(tpl.def, '2026-10-26', '2026-11-08');
    check('3.24 planRange: both ends included', range.length === 14 && range[0].date === '2026-10-26' && range[13].date === '2026-11-08');
    check('3.25 planRange refuses a reversed or broken range', m.planRange(tpl.def, '2026-11-08', '2026-10-26').length === 0 && m.planRange(tpl.def, 'x', '2026-10-26').length === 0);
  }
  {
    const fixedHours = m.PLAN_TEMPLATES.find((t) => t.id === 'stale-godziny');
    const sunday = m.planDay(fixedHours.def.flow, '2026-10-25');
    const monday = m.planDay(fixedHours.def.flow, '2026-10-26');
    check('3.26 "Stałe godziny mszy": 5 on Sunday, 2 on Monday, "Msza święta"',
      sunday.masses.length === 5 && monday.masses.length === 2 && [...sunday.masses, ...monday.masses].every((x) => x.title === 'Msza święta'));
  }

  /* -- 4. Regeln ---------------------------------------------------------------------------------- */
  const rule = m.SCHEME_TEMPLATES.find((s) => s.id === 'msza').def.lists[0].rule;
  const ctx = (over) => ({
    actor: 'office', date: '2026-10-28', weekday: 3, record: { mode: 'single', values: {} },
    occurrence: [], week: [], here: 'mass1@2026-10-28T18:00', ...over
  });
  const verdict = (over) => m.runRule(rule, ctx(over));
  check('4.1 a first single intention is taken', verdict({}).verdict === 'allow');
  check('4.2 a second single intention is refused', verdict({ occurrence: [{ mode: 'single', status: 'accepted' }] }).verdict === 'refuse');
  check('4.3 a cancelled one does not count', verdict({ occurrence: [{ mode: 'single', status: 'cancelled' }] }).verdict === 'allow');
  check('4.4 a collective one to a single one is refused',
    verdict({ record: { mode: 'collective', values: {} }, occurrence: [{ mode: 'single', status: 'accepted' }] }).verdict === 'refuse');
  const twoOthers = [
    { mode: 'collective', status: 'accepted', occurrence: 'a@1' }, { mode: 'collective', status: 'accepted', occurrence: 'a@1' },
    { mode: 'collective', status: 'celebrated', occurrence: 'b@2' }
  ];
  const third = verdict({ record: { mode: 'collective', values: {} }, week: twoOthers });
  check('4.5 a third mass with collective intentions in one week is refused', third.verdict === 'refuse' && /dwie msze/.test(third.message ?? ''), q(third));
  check('4.6 more collective intentions on a mass that already has them are taken',
    verdict({ record: { mode: 'collective', values: {} }, occurrence: [{ mode: 'collective', status: 'accepted' }],
      week: [...twoOthers, { mode: 'collective', status: 'accepted', occurrence: 'mass1@2026-10-28T18:00' }] }).verdict === 'allow');
  check('4.7 a second collective mass in the week is taken',
    verdict({ record: { mode: 'collective', values: {} }, week: twoOthers.slice(0, 2) }).verdict === 'allow');
  const outside = verdict({ actor: 'outside' });
  check('4.8 from outside it waits, with a word', outside.verdict === 'wait' && (outside.message ?? '') !== '' && outside.trace.length > 0, q(outside));
  check('4.9 without a rule: the office takes, outside waits',
    m.runRule(null, ctx({})).verdict === 'allow' && m.runRule(undefined, ctx({ actor: 'outside' })).verdict === 'wait');
  const signup = m.SCHEME_TEMPLATES.find((s) => s.id === 'spotkanie-zapisy').def.lists[0].rule;
  const coming = (n, status = 'waiting') => Array.from({ length: n }, () => ({ mode: 'tak', status }));
  check('4.10 sign-ups: the 21st "będę" is refused (waiting ones count), the 20th is taken, "nie będę" always',
    m.runRule(signup, ctx({ record: { mode: 'tak', values: {} }, occurrence: coming(20) })).verdict === 'refuse'
      && m.runRule(signup, ctx({ record: { mode: 'tak', values: {} }, occurrence: coming(19) })).verdict === 'allow'
      && m.runRule(signup, ctx({ record: { mode: 'nie', values: {} }, occurrence: coming(25) })).verdict === 'allow'
      && m.runRule(signup, ctx({ actor: 'outside', record: { mode: 'tak', values: {} }, occurrence: coming(3) })).verdict === 'wait');
  const loop = { v: 1, nodes: [{ id: 's', type: 'record-start', x: 0, y: 0, data: {} }, { id: 'i', type: 'if', x: 1, y: 0, data: { test: { t: 'actor', is: 'office' } } }],
    edges: [{ id: 'e1', from: 's', to: 'i' }, { id: 'e2', from: 'i', to: 'i', out: 'yes' }] };
  check('4.11 a rule with a loop ends in the fallback', m.runRule(loop, ctx({})).verdict === 'allow');

  /* -- 5. Kaputte Pläne ----------------------------------------------------------------------------- */
  const noDay = m.planDay({ v: 1, nodes: [{ id: 'm', type: 'mass', x: 0, y: 0, data: {} }], edges: [] }, '2026-10-25');
  check('5.1 a plan without "Dzień": no masses, a problem', noDay.masses.length === 0 && noDay.problems.length === 1, q(noDay.problems));
  const openEnd = m.planDay({ v: 1, nodes: [{ id: 'd', type: 'day', x: 0, y: 0, data: {} }, { id: 's', type: 'season', x: 1, y: 0, data: {} }],
    edges: [{ id: 'e', from: 'd', to: 's' }] }, '2026-10-25');
  check('5.2 a day path ending before "Godziny mszy": no masses, a problem naming the node', openEnd.masses.length === 0 && /Okres liturgiczny/.test(openEnd.problems.join(' ')), q(openEnd.problems));
  const dayLoop = m.planDay({ v: 1, nodes: [{ id: 'd', type: 'day', x: 0, y: 0, data: {} }, { id: 'i', type: 'if', x: 1, y: 0, data: { test: { t: 'sunday' } } }],
    edges: [{ id: 'e', from: 'd', to: 'i' }, { id: 'y', from: 'i', to: 'i', out: 'yes' }, { id: 'n', from: 'i', to: 'i', out: 'no' }] }, '2026-10-25');
  check('5.3 a loop is cut off with a problem', dayLoop.masses.length === 0 && /pętla/.test(dayLoop.problems.join(' ')), q(dayLoop.problems));
  const noEnd = m.planDay({ v: 1, nodes: [
    { id: 'd', type: 'day', x: 0, y: 0, data: {} },
    { id: 'sl', type: 'slots', x: 1, y: 0, data: { festive: [{ key: 'a', time: '10:00', minutes: 60 }], weekdays: [] } },
    { id: 'ms', type: 'mass', x: 0, y: 1, data: {} },
    { id: 'st', type: 'set', x: 1, y: 1, data: { target: 'title', value: '{weekRoman} — {nieznane}' } }
  ], edges: [{ id: 'a', from: 'd', to: 'sl' }, { id: 'b', from: 'ms', to: 'st' }] }, '2026-10-25');
  check('5.4 a mass path without "Utwórz" still creates the mass; unknown placeholders stay', noEnd.masses.length === 1 && noEnd.masses[0].title === 'XXX — {nieznane}', q(noEnd.masses.map((x) => x.title)));
  const sundayCtx = m.planDay(tpl.def.flow, '2026-10-25').ctx;
  check('5.5 fillTemplate', m.fillTemplate('{sundayName} · {date} · {weekday} · {dateWords}', sundayCtx) === 'XXX Niedziela zwykła · 25.10.2026 · niedziela · 25 października',
    m.fillTemplate('{sundayName} · {date} · {weekday} · {dateWords}', sundayCtx));

  /* -- 6. Die Vorlagen selbst ------------------------------------------------------------------------ */
  const flows = [
    ...m.PLAN_TEMPLATES.map((t) => [`plan ${t.id}`, t.def.flow, 'plan']),
    ...m.SCHEME_TEMPLATES.flatMap((t) => t.def.lists.filter((l) => l.rule).map((l) => [`rule ${t.id}/${l.key}`, l.rule, 'rule']))
  ];
  for (const [name, flow, kind] of flows) {
    const ids = new Set(flow.nodes.map((n) => n.id));
    const allowed = new Set(kind === 'plan' ? m.PLAN_NODES : m.RULE_NODES);
    const badEdges = flow.edges.filter((e) => !ids.has(e.from) || !ids.has(e.to));
    const badTypes = flow.nodes.filter((n) => !allowed.has(n.type));
    const ifs = flow.nodes.filter((n) => n.type === 'if');
    const unforked = ifs.filter((n) => !['yes', 'no'].every((out) => flow.edges.some((e) => e.from === n.id && (e.out ?? 'out') === out)));
    const places = flow.nodes.map((n) => `${n.x},${n.y}`);
    const dupIds = flow.nodes.length !== ids.size;
    const outs = flow.nodes.filter((n) => m.NODE_INFO[n.type].outs.length > 0 && !m.NODE_INFO[n.type].outs.every((o) => flow.edges.some((e) => e.from === n.id && (e.out ?? 'out') === o)));
    check(`6 ${name}: edges hit nodes, node types fit, every condition has tak/nie, every exit is wired, no two nodes on one spot`,
      badEdges.length === 0 && badTypes.length === 0 && unforked.length === 0 && new Set(places).size === places.length && !dupIds && outs.length === 0,
      q({ badEdges, badTypes: badTypes.map((n) => n.id), unforked: unforked.map((n) => n.id), outs: outs.map((n) => n.id) }));
  }
  check('6.1 the templates survive JSON unchanged',
    m.PLAN_TEMPLATES.every((t) => isDeepStrictEqual(JSON.parse(JSON.stringify(t.def)), t.def))
      && m.SCHEME_TEMPLATES.every((t) => isDeepStrictEqual(JSON.parse(JSON.stringify(t.def)), t.def)));
  const colours = new Set(m.LITURGICAL_COLOURS.map((c) => c.value));
  const badRows = m.POLISH_CALENDAR.filter((r) => !(r.rank >= 1 && r.rank <= 13) || !colours.has(r.colour) || m.datesOf(r.when, 2026).length !== 1 || r.name.trim() === '');
  check('6.2 the calendar table: ranks 1–13, liturgical colours, one date a year, names', badRows.length === 0, q(badRows.map((r) => r.name)));
  const keys = m.SCHEME_TEMPLATES.map((t) => t.id);
  check('6.3 scheme templates: msza, nabozenstwo, spowiedz, spotkanie-zapisy; intentions keep the keys "giver"/"offering"',
    q(keys) === q(['msza', 'nabozenstwo', 'spowiedz', 'spotkanie-zapisy'])
      && q(m.SCHEME_TEMPLATES[0].def.lists[0].fields.map((f) => f.key)) === q(['giver', 'offering']) && m.SCHEME_TEMPLATES[0].def.lists[0].key === 'intencje');
  const fieldKeys = new Set(m.SCHEME_TEMPLATES.find((t) => t.id === 'msza').def.fields.map((f) => f.key));
  const written = new Set(tpl.def.flow.nodes.filter((n) => n.type === 'set' && n.data.target === 'field').map((n) => n.data.key));
  check('6.4 every field the plan writes exists in the scheme it needs', [...written].every((k) => fieldKeys.has(k)), q([...written]));
  check('6.5 describeTest speaks Polish', m.describeTest({ t: 'count', scope: 'week', mode: 'collective', per: 'occurrence', op: '>=', n: 2 }).includes('innych terminów w tygodniu'));

  /* 7 — Werte und Einträge (main, 2026-10-26): was offen hinausgeht, was versiegelt wird, unter welchem Etikett. */
  const colour = { key: 'kolor', label: 'Kolor szat', type: 'colour', public: true, options: m.LITURGICAL_COLOURS };
  const choice = { key: 'ranga', label: 'Ranga', type: 'choice', public: true, options: [{ value: 'u', label: 'uroczystość' }, { value: 's', label: 'święto' }] };
  const people = { key: 'ile', label: 'Ilu', type: 'number', unit: 'osób', public: true };
  const hidden = { key: 'uwagi', label: 'Uwagi', type: 'text' };
  const drafts = m.draftValues([colour, choice, people, hidden], { kolor: 'biały', ranga: 'u', ile: '12', uwagi: 'tylko dla kancelarii', pusty: '' });
  check('7.1 public values go out with their label and as shown (a choice as its word, a number with its unit), others stay hidden',
    q(drafts) === q([
      { key: 'kolor', text: 'biały', publicLabel: 'Kolor szat' },
      { key: 'ranga', text: 'uroczystość', publicLabel: 'Ranga' },
      { key: 'ile', text: '12 osób', publicLabel: 'Ilu' },
      { key: 'uwagi', text: 'tylko dla kancelarii' }
    ]), q(drafts));
  check('7.2 an editor gets back what was chosen (the word of a choice → its value, the unit stripped)',
    m.editText(choice, { text: 'uroczystość', label: 'Ranga', public: true }) === 'u'
      && m.editText(people, { text: '12 osób', label: 'Ilu', public: true }) === '12'
      && m.editText(hidden, { text: 'x', label: null, public: false }) === 'x' && m.editText(colour, undefined) === '');
  const key = crypto.getRandomValues(new Uint8Array(32));
  const item = '0190a1b2-0000-7000-8000-000000000001';
  const sealed = await m.sealValues({ key, epoch: 3 }, 'area-1', item, null, drafts);
  const opened = await m.openText(key, m.valueAad(item, null, 'uwagi'), Uint8Array.from(Buffer.from(sealed.find((v) => v.field === 'uwagi').sealed, 'base64url')));
  check('7.3 sealed under the given key and epoch; public ones carry no blob; opens with the item-level label',
    sealed.length === 4 && sealed.filter((v) => v.sealed !== undefined).length === 1 && sealed.find((v) => v.field === 'uwagi').epoch === 3 && opened === 'tylko dla kancelarii');
  let crossed = false;
  try { await m.openText(key, m.valueAad(item, '2026-11-01T09:00:00.000Z', 'uwagi'), Uint8Array.from(Buffer.from(sealed.find((v) => v.field === 'uwagi').sealed, 'base64url'))); crossed = true; } catch { crossed = false; }
  check('7.4 a value of the appointment does not open as the value of one day (the label names the occurrence)', !crossed);
  check('7.5 labels: no colon inside the object id; one day = its instant',
    !m.aadText(m.valueAad(item, '2026-11-01T09:00:00Z', 'kolor')).split(':')[2].includes('-11-01T')
      && m.aadText(m.valueAad(item, '2026-11-01T09:00:00Z', 'kolor')) === m.aadText(m.valueAad(item, '2026-11-01T09:00:00.000+00:00', 'kolor')));
  check('7.6 intentions keep the old label for giver and offering — everything else gets the record label',
    m.aadText(m.recordAad('intencje', item, 'giver')).startsWith('mass:intention:') && m.aadText(m.recordAad('intencje', item, 'offering')).includes('mass_intention_offering')
      && m.aadText(m.recordAad('zapisy', item, 'giver')).startsWith('calendar:record:') && m.aadText(m.recordAad('intencje', item, 'uwagi')).startsWith('calendar:record:'));
  const week = m.weekOf(new Date(2026, 10, 4, 18, 0));
  check('7.7 the week of a rule runs Monday to Monday', week.from.getDay() === 1 && week.from.getDate() === 2 && week.to.getDate() === 9 && m.isLive('celebrated') && !m.isLive('waiting'));
  check('7.8 the universal scheme: intentions only at a mass, giver and offering hidden', m.UNIVERSAL.lists[0].key === 'intencje'
    && q(m.UNIVERSAL.lists[0].onlyKinds) === q(['mass']) && m.UNIVERSAL.lists[0].fields.every((f) => f.public !== true));
  check('7.9 values travel with a copy as they were (public with their label)', q(m.valuesAsDraft(new Map([['kolor', { text: 'biały', label: 'Kolor szat', public: true }], ['uwagi', { text: 'x', label: null, public: false }]])))
    === q([{ key: 'kolor', text: 'biały', publicLabel: 'Kolor szat' }, { key: 'uwagi', text: 'x' }]));
} catch (e) {
  failed += 1;
  console.log(`FAIL crashed: ${e?.stack ?? e}`);
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
