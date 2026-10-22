/**
 * 2026-10-22 — STELLEN DER SCHRIFT (Schritt 4 des Umbaus).
 *
 * Gelesen wird, was man ohnehin schreibt: „Dz 1,14", „Dz 1:14", „Acts 1,14",
 * „Act 1,14" (lateinisch), Bereiche „Dz 1,14-16", über Kapitel hinweg
 * „Łk 1,26–2,5", Listen „Dz 1,8.14" (englisch „Acts 1:8,14"), ganze Kapitel
 * „Ps 23", „Rdz 1-3", mehrere Stellen „Mt 5,3-12; 6,1; Łk 6,20", die zweite
 * Zählung der Psalmen „Ps 51(50),3", Teile eines Verses „Ps 22,2a" und „i
 * następne" „Mk 16,9nn". Bücher heissen polnisch (Biblia Tysiąclecia),
 * lateinisch (Nova Vulgata) oder englisch — abgekürzt oder ausgeschrieben.
 *
 * <b>Gespeichert wird nichts.</b> Eine Stelle bleibt der Text, den jemand
 * geschrieben hat (`locator`); wer nach einer Stelle sucht oder Zitate ordnet,
 * liest sie hier. Nur die Stellen eines Werks mit `workType: bible` werden so
 * gelesen — andere Werke behalten freie Stellen („s. 23").
 */

export interface Book {
  /** Kennung wie in OSIS: `Gen`, `Acts`, `1Cor`. */
  readonly id: string;
  /** Die Ordnung des Kanons (Biblia Tysiąclecia), ab 1. */
  readonly order: number;
  /** Die übliche Abkürzung je Sprache — die erste der Liste. */
  readonly pl: string;
  readonly la: string;
  readonly en: string;
}

/** Ein Vers; `v: null` — das ganze Kapitel. */
export interface Verse {
  readonly c: number;
  readonly v: number | null;
}

/** Ein Stück der Schrift: von … bis, in einem Buch. */
export interface BibleSpan {
  readonly book: string;
  readonly from: Verse;
  readonly to: Verse;
}

/*
 * Die Bücher in der Ordnung der Biblia Tysiąclecia. Je Zeile: Kennung |
 * polnische Abkürzungen | lateinische | englische | polnische Namen |
 * lateinische | englische. Die erste Abkürzung ist die, mit der geschrieben
 * wird; alle anderen werden nur gelesen.
 */
const TABLE = `
Gen|Rdz|Gn|Gen,Gn,Ge|Księga Rodzaju,Rodzaju|Genesis|Genesis
Exod|Wj|Ex|Exod,Ex|Księga Wyjścia,Wyjścia|Exodus|Exodus
Lev|Kpł,Kpl|Lv|Lev,Lv|Księga Kapłańska,Kapłańska|Leviticus|Leviticus
Num|Lb|Nm|Num,Nm,Nb|Księga Liczb,Liczb|Numeri|Numbers
Deut|Pwt|Dt|Deut,Dt|Księga Powtórzonego Prawa,Powtórzonego Prawa|Deuteronomium|Deuteronomy
Josh|Joz|Ios|Josh,Jos|Księga Jozuego,Jozuego|Iosue|Joshua
Judg|Sdz|Idc|Judg,Jdg,Jg|Księga Sędziów,Sędziów|Iudicum|Judges
Ruth|Rt|Rt,Ru|Ruth,Ru|Księga Rut,Rut|Ruth|Ruth
1Sam|1 Sm|1 Sm,1 Sam|1 Sam,1 Sa,1 S|1 Księga Samuela,1 Samuela|I Samuelis|1 Samuel
2Sam|2 Sm|2 Sm,2 Sam|2 Sam,2 Sa,2 S|2 Księga Samuela,2 Samuela|II Samuelis|2 Samuel
1Kgs|1 Krl|1 Rg,3 Rg|1 Kgs,1 Kg,1 Ki|1 Księga Królewska,1 Królewska|I Regum|1 Kings
2Kgs|2 Krl|2 Rg,4 Rg|2 Kgs,2 Kg,2 Ki|2 Księga Królewska,2 Królewska|II Regum|2 Kings
1Chr|1 Krn|1 Par|1 Chr,1 Ch|1 Księga Kronik,1 Kronik|I Paralipomenon|1 Chronicles
2Chr|2 Krn|2 Par|2 Chr,2 Ch|2 Księga Kronik,2 Kronik|II Paralipomenon|2 Chronicles
Ezra|Ezd|Esd|Ezra,Ezr|Księga Ezdrasza,Ezdrasza|Esdrae|Ezra
Neh|Ne|Ne|Neh,Ne|Księga Nehemiasza,Nehemiasza|Nehemiae|Nehemiah
Tob|Tb|Tb|Tob,Tb|Księga Tobiasza,Tobiasza|Tobiae|Tobit
Jdt|Jdt|Idt|Jdt,Jth|Księga Judyty,Judyty|Iudith|Judith
Esth|Est|Est|Esth,Est|Księga Estery,Estery|Esther|Esther
1Macc|1 Mch|1 Mac|1 Macc,1 Mc,1 Ma|1 Księga Machabejska,1 Machabejska|I Machabaeorum|1 Maccabees
2Macc|2 Mch|2 Mac|2 Macc,2 Mc,2 Ma|2 Księga Machabejska,2 Machabejska|II Machabaeorum|2 Maccabees
Job|Hi|Iob|Job,Jb|Księga Hioba,Hioba|Iob|Job
Ps|Ps|Ps|Ps,Psa,Pss,Psalm|Księga Psalmów,Psalmów,Psalm,Psalmy|Psalmi,Psalmus|Psalms
Prov|Prz|Prv|Prov,Prv,Pr|Księga Przysłów,Przysłów|Proverbiorum|Proverbs
Eccl|Koh|Qo,Eccle|Eccl,Ecc,Qoh|Księga Koheleta,Koheleta,Kohelet,Eklezjastes|Ecclesiastes,Qoheleth|Ecclesiastes,Qoheleth
Song|Pnp|Ct|Song,Cant,Sg|Pieśń nad Pieśniami|Canticum Canticorum|Song of Songs,Song of Solomon,Canticles
Wis|Mdr|Sap|Wis,Ws|Księga Mądrości,Mądrości|Sapientiae|Wisdom
Sir|Syr|Sir|Sir,Ecclus|Mądrość Syracha,Syracha,Syracydesa,Eklezjastyk|Siracides,Ecclesiasticus|Sirach,Ecclesiasticus
Isa|Iz|Is|Isa,Is|Księga Izajasza,Izajasza|Isaiae|Isaiah
Jer|Jr|Ier|Jer,Jr|Księga Jeremiasza,Jeremiasza|Ieremiae|Jeremiah
Lam|Lm|Lam|Lam|Lamentacje,Treny|Lamentationes|Lamentations
Bar|Ba|Bar|Bar|Księga Barucha,Barucha|Baruch|Baruch
Ezek|Ez|Ez|Ezek,Ezk|Księga Ezechiela,Ezechiela|Ezechielis|Ezekiel
Dan|Dn|Dn|Dan,Dn|Księga Daniela,Daniela|Danielis|Daniel
Hos|Oz|Os|Hos,Ho|Księga Ozeasza,Ozeasza|Osee|Hosea
Joel|Jl|Ioel|Joel,Jl|Księga Joela,Joela|Ioel|Joel
Amos|Am|Am|Amos,Am|Księga Amosa,Amosa|Amos|Amos
Obad|Ab|Abd|Obad,Ob|Księga Abdiasza,Abdiasza|Abdiae|Obadiah
Jonah|Jon|Ion|Jonah,Jon,Jnh|Księga Jonasza,Jonasza|Ionae|Jonah
Mic|Mi|Mi|Mic,Mi|Księga Micheasza,Micheasza|Michaeae|Micah
Nah|Na|Na|Nah,Na|Księga Nahuma,Nahuma|Nahum|Nahum
Hab|Ha|Hab|Hab,Hb|Księga Habakuka,Habakuka|Habacuc|Habakkuk
Zeph|So|Soph|Zeph,Zep|Księga Sofoniasza,Sofoniasza|Sophoniae|Zephaniah
Hag|Ag|Agg|Hag,Hg|Księga Aggeusza,Aggeusza|Aggaei|Haggai
Zech|Za|Zac|Zech,Zec|Księga Zachariasza,Zachariasza|Zachariae|Zechariah
Mal|Ml|Mal|Mal|Księga Malachiasza,Malachiasza|Malachiae|Malachi
Matt|Mt|Mt|Matt,Mt|Ewangelia według świętego Mateusza,Mateusza|Matthaeum|Matthew
Mark|Mk|Mc|Mark,Mk,Mr|Ewangelia według świętego Marka,Marka|Marcum|Mark
Luke|Łk|Lc|Luke,Lk,Lu|Ewangelia według świętego Łukasza,Łukasza|Lucam|Luke
John|J|Io|John,Jn,Jhn,Joh|Ewangelia według świętego Jana,Jana|Ioannem|John
Acts|Dz|Act|Acts,Ac|Dzieje Apostolskie,Dzieje|Actus Apostolorum|Acts of the Apostles
Rom|Rz|Rom|Rom,Rm,Ro|List do Rzymian,Rzymian|Romanos|Romans
1Cor|1 Kor|1 Cor|1 Cor,1 Co|1 List do Koryntian,1 Koryntian|I Corinthios|1 Corinthians
2Cor|2 Kor|2 Cor|2 Cor,2 Co|2 List do Koryntian,2 Koryntian|II Corinthios|2 Corinthians
Gal|Ga|Gal|Gal,Ga|List do Galatów,Galatów|Galatas|Galatians
Eph|Ef|Eph|Eph,Ep|List do Efezjan,Efezjan|Ephesios|Ephesians
Phil|Flp|Phil|Phil,Php,Pp|List do Filipian,Filipian|Philippenses|Philippians
Col|Kol|Col|Col|List do Kolosan,Kolosan|Colossenses|Colossians
1Thess|1 Tes|1 Thes|1 Thess,1 Thes,1 Th|1 List do Tesaloniczan,1 Tesaloniczan|I Thessalonicenses|1 Thessalonians
2Thess|2 Tes|2 Thes|2 Thess,2 Thes,2 Th|2 List do Tesaloniczan,2 Tesaloniczan|II Thessalonicenses|2 Thessalonians
1Tim|1 Tm|1 Tim|1 Tim,1 Ti|1 List do Tymoteusza,1 Tymoteusza|I Timotheum|1 Timothy
2Tim|2 Tm|2 Tim|2 Tim,2 Ti|2 List do Tymoteusza,2 Tymoteusza|II Timotheum|2 Timothy
Titus|Tt|Tit|Titus,Tit|List do Tytusa,Tytusa|Titum|Titus
Phlm|Flm|Phlm|Phlm,Philem,Phm|List do Filemona,Filemona|Philemonem|Philemon
Heb|Hbr|Hebr|Heb,Hebr|List do Hebrajczyków,Hebrajczyków|Hebraeos|Hebrews
Jas|Jk|Iac|Jas,Jm|List świętego Jakuba,Jakuba|Iacobi|James
1Pet|1 P|1 Pt|1 Pet,1 Pt,1 Pe|1 List świętego Piotra,1 Piotra|I Petri|1 Peter
2Pet|2 P|2 Pt|2 Pet,2 Pt,2 Pe|2 List świętego Piotra,2 Piotra|II Petri|2 Peter
1John|1 J|1 Io|1 John,1 Jn,1 Jo|1 List świętego Jana,1 Jana|I Ioannis|1 John
2John|2 J|2 Io|2 John,2 Jn,2 Jo|2 List świętego Jana,2 Jana|II Ioannis|2 John
3John|3 J|3 Io|3 John,3 Jn,3 Jo|3 List świętego Jana,3 Jana|III Ioannis|3 John
Jude|Jud|Iud|Jude,Jd|List świętego Judy,Judy|Iudae|Jude
Rev|Ap|Ap,Apc|Rev,Rv,Apoc,Re|Apokalipsa świętego Jana,Apokalipsa,Objawienie|Apocalypsis|Revelation
`;

/** Wie ein Name verglichen wird: klein, ohne Akzente und Punkte, ohne Leerzeichen; „I Kor" wie „1 Kor". */
function norm(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/\./g, ' ').trim()
    .replace(/^(iii|ii|i)\s+(?=\p{L})/u, (m) => ({ i: '1', ii: '2', iii: '3' } as Record<string, string>)[m.trim()] ?? m)
    .replace(/\s+/g, '');
}

/** „Księga", „Ewangelia według świętego", „List do" — fallen weg, wenn der Rest ein Name ist. */
const stripWords = (n: string): string =>
  n.replace(/^([123]?)(ksiega|ewangelia(wedlug|wg)?(swietego|sw)?|list(do|swietego|sw)?)/, '$1');

const BOOKS: readonly Book[] = [];
const BY_ID = new Map<string, Book>();
const BY_NAME = new Map<string, Book>();

TABLE.trim().split('\n').forEach((line, i) => {
  const [id, pl, la, en, plNames, laNames, enNames] = line.split('|');
  const book: Book = { id, order: i + 1, pl: pl.split(',')[0], la: la.split(',')[0], en: en.split(',')[0] };
  (BOOKS as Book[]).push(book);
  BY_ID.set(id.toLowerCase(), book);
  for (const name of [id, pl, la, en, plNames, laNames, enNames].flatMap((s) => s.split(','))) {
    const key = norm(name);
    if (key !== '' && !BY_NAME.has(key)) BY_NAME.set(key, book);
    const short = stripWords(key);
    if (short !== '' && !BY_NAME.has(short)) BY_NAME.set(short, book);
  }
});

export const bibleBooks = (): readonly Book[] => BOOKS;

/** Ein Buch nach seinem Namen — gleich in welcher Sprache, abgekürzt oder nicht. */
export function bookOf(name: string): Book | undefined {
  const n = norm(name);
  return BY_NAME.get(n) ?? BY_NAME.get(stripWords(n)) ?? BY_ID.get(name.trim().toLowerCase());
}

export const bookById = (id: string): Book | undefined => BY_ID.get(id.toLowerCase());

/* -- Lesen ------------------------------------------------------------------------------------- */

const MAX_CHAPTER = 150;
const MAX_VERSE = 176;

const num = (s: string | undefined): number => (s !== undefined && /^\d{1,3}$/.test(s) ? Number(s) : 0);

/** Kapitel und Verse eines Buches: „1,14", „1:8,14", „1,26-2,5", „23", „23-24". */
function spansIn(book: string, text: string): BibleSpan[] {
  const rest = text
    .replace(/\([^)]*\)/g, '')                                          // Ps 51(50) — die zweite Zählung fällt weg
    .replace(/[–—−]/g, '-')
    .replace(/(\d)\s*(nn|ff)\b\.?/gi, '$1-999')                         // „i następne"
    .replace(/(\d+)\s*[nf]\b\.?/gi, (_m, d: string) => `${d}-${Number(d) + 1}`)
    .replace(/(\d)[a-e]\b/gi, '$1')                                     // 22,2a — ein Teil des Verses
    .replace(/\s+/g, '');
  if (rest === '') return [{ book, from: { c: 1, v: null }, to: { c: MAX_CHAPTER, v: null } }];
  const colon = rest.includes(':');
  const cv = colon ? ':' : ',';
  const list = colon ? ',' : '.';

  /* Nur Kapitel: „Ps 23", „Rdz 1-3". */
  if (!rest.includes(cv)) {
    return rest.split(list).flatMap((item): BibleSpan[] => {
      const [a, b] = item.split('-');
      const c1 = num(a);
      const c2 = b === undefined ? c1 : num(b);
      if (c1 < 1 || c2 < c1 || c2 > MAX_CHAPTER) return [];
      return [{ book, from: { c: c1, v: null }, to: { c: c2, v: null } }];
    });
  }

  const out: BibleSpan[] = [];
  let chapter = num(rest.slice(0, rest.indexOf(cv)));
  if (chapter < 1 || chapter > MAX_CHAPTER) return [];
  for (const item of rest.slice(rest.indexOf(cv) + 1).split(list)) {
    const dash = item.indexOf('-');
    let a = dash < 0 ? item : item.slice(0, dash);
    const b = dash < 0 ? undefined : item.slice(dash + 1);
    /* Ein Punkt der Liste kann ein neues Kapitel beginnen: „1,26-38.2,1-5". */
    if (a.includes(cv)) { chapter = num(a.slice(0, a.indexOf(cv))); a = a.slice(a.indexOf(cv) + 1); }
    const v1 = num(a);
    if (chapter < 1 || v1 < 1) continue;
    let to: Verse;
    if (b === undefined) to = { c: chapter, v: v1 };
    else if (b.includes(cv)) to = { c: num(b.slice(0, b.indexOf(cv))), v: num(b.slice(b.indexOf(cv) + 1)) };
    else to = { c: chapter, v: Math.min(num(b), 999) };
    if (to.c < chapter || to.c > MAX_CHAPTER || (to.v ?? 0) < 1 || (to.c === chapter && (to.v ?? 0) < v1)) continue;
    out.push({ book, from: { c: chapter, v: v1 }, to: to.v === 999 ? { c: to.c, v: null } : to });
    chapter = to.c;
  }
  return out.filter((s) => (s.from.v ?? 0) <= MAX_VERSE);
}

/**
 * Die Stellen eines Textes — leer, wenn er keine nennt. Ein Stück ohne Buch
 * („6,1" nach „Mt 5,3-12;") gehört zum Buch davor; ein unbekanntes Buch
 * nimmt seine Fortsetzungen mit.
 */
export function parseBible(text: string): BibleSpan[] {
  const out: BibleSpan[] = [];
  let book: string | undefined;
  for (const raw of text.split(';')) {
    const seg = raw.trim();
    if (seg === '') continue;
    let i = /^[1-3]\s*\.?\s*(?=\p{L})/u.exec(seg)?.[0].length ?? 0;
    while (i < seg.length && !/\d/.test(seg[i]!)) i += 1;
    const name = seg.slice(0, i).trim().replace(/[,:]$/, '').trim();
    if (name !== '') {
      book = bookOf(name)?.id;
      if (book === undefined) continue;
    }
    if (book === undefined) continue;
    out.push(...spansIn(book, seg.slice(i)));
  }
  return out;
}

/* -- Vergleichen und Ordnen --------------------------------------------------------------------- */

const at = (verse: Verse, end: boolean): number => verse.c * 1000 + (verse.v ?? (end ? 999 : 0));

/** Berühren sich zwei Stellen? Dasselbe Buch und mindestens ein gemeinsamer Vers. */
export function overlaps(a: BibleSpan, b: BibleSpan): boolean {
  return a.book === b.book && at(a.from, false) <= at(b.to, true) && at(b.from, false) <= at(a.to, true);
}

export const anyOverlap = (a: readonly BibleSpan[], b: readonly BibleSpan[]): boolean => a.some((x) => b.some((y) => overlaps(x, y)));

const pad = (n: number, width: number) => String(n).padStart(width, '0');

/** Ein Schlüssel zum Ordnen: Buch nach dem Kanon, dann Kapitel, dann Vers — „Dz 1,8" vor „Dz 1,14". */
export function bibleKey(locator: string): string {
  const first = parseBible(locator)[0];
  if (first === undefined) return `~${locator.toLowerCase()}`;
  const book = bookById(first.book)!;
  return `${pad(book.order, 2)}.${pad(first.from.c, 3)}.${pad(first.from.v ?? 0, 3)}.${pad(first.to.c, 3)}.${pad(first.to.v ?? 999, 3)}`;
}

/** Eine Stelle zum Ordnen — in der Schrift nach dem Kanon, sonst mit Zahlen als Zahlen („s. 9" vor „s. 10"). */
export function locatorKey(locator: string, bible: boolean): string {
  return bible ? bibleKey(locator) : locator.toLowerCase().replace(/\d+/g, (d) => d.padStart(6, '0'));
}

/* -- Schreiben ---------------------------------------------------------------------------------- */

/** Eine Stelle, wie man sie schreibt: „Dz 1,14", „Dz 1,14-16", „Łk 1,26–2,5", „Ps 23" — polnisch, lateinisch oder englisch. */
export function formatSpan(span: BibleSpan, lang: 'pl' | 'la' | 'en' = 'pl'): string {
  const book = bookById(span.book);
  const name = book === undefined ? span.book : book[lang];
  const sep = lang === 'en' ? ':' : ',';
  const { from, to } = span;
  if (from.v === null) {
    if (from.c === 1 && to.c >= MAX_CHAPTER) return name;
    return from.c === to.c ? `${name} ${from.c}` : `${name} ${from.c}-${to.c}`;
  }
  if (to.c === from.c) {
    if (to.v === from.v) return `${name} ${from.c}${sep}${from.v}`;
    return to.v === null ? `${name} ${from.c}${sep}${from.v}nn` : `${name} ${from.c}${sep}${from.v}-${to.v}`;
  }
  return `${name} ${from.c}${sep}${from.v}–${to.c}${sep}${to.v ?? ''}`.replace(/[,:]$/, '');
}

export const formatBible = (spans: readonly BibleSpan[], lang: 'pl' | 'la' | 'en' = 'pl'): string => spans.map((s) => formatSpan(s, lang)).join('; ');
