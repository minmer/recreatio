import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { getParticipantCard, saveParticipantCard, type EventParticipantCard } from '../../../lib/api';
import { asBool, asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { AreaRow, CheckRow, ListEditor, NumberRow, TextRow } from './editorKit';

/**
 * The participant card: the data an event needs about a named person once they
 * are actually taking part, and the statements someone has to sign.
 *
 * Why this is a part of its own rather than another form:
 *
 *  - It is only reachable behind an individual link, so the sensitive half of a
 *    participant's data never sits on the open web.
 *  - Its shape is fixed by law, not by the organizer. It follows the karta
 *    kwalifikacyjna uczestnika wypoczynku (rozporządzenie MEN o wypoczynku
 *    dzieci i młodzieży; wzór obowiązujący od 6 czerwca 2026 r., Dz.U. 2026
 *    poz. 704) — participant and parents, year of birth, PESEL, addresses, a
 *    contact reachable during the event, special educational needs, health,
 *    diet and vaccinations. Letting an organizer retype that by hand is how
 *    required entries go missing.
 *  - It carries health data, which RODO art. 9 treats as a special category:
 *    it needs its own explicit consent, separate from everything else.
 *  - It has to record what was agreed to, not merely that something was. RODO
 *    art. 7(1) puts the burden of proof on the organizer, so the accepted
 *    wording and the information clause are stored with the answers.
 *
 * What the organizer must fill in is the identity of the administrator, the
 * retention period and the wording of the statements — the things only they
 * know. The defaults below are a starting point, not legal advice.
 */

type ConsentSpec = {
  code: string;
  label: string;
  text: string;
  required: boolean;
  /** Shown only when the participant is under age. */
  minorOnly: boolean;
};

type CardConfig = {
  intro: string | null;
  saveLabel: string | null;
  savedMessage: string | null;
  /** Age at which the participant signs for themselves. */
  adultAge: number;
  collectPesel: boolean;
  collectSpecialNeeds: boolean;
  collectHealth: boolean;
  collectVaccinations: boolean;
  collectEmergency: boolean;
  /** RODO art. 13: who processes the data and on what terms. */
  controllerName: string | null;
  controllerAddress: string | null;
  controllerContact: string | null;
  dpoContact: string | null;
  purposes: string[];
  recipients: string | null;
  retention: string | null;
  extraClause: string | null;
  consents: ConsentSpec[];
};

const DEFAULT_CONSENTS: ConsentSpec[] = [
  {
    code: 'participation',
    label: 'Zgoda na udział',
    text:
      'Jako rodzic/opiekun prawny wyrażam zgodę na udział mojego dziecka w tym wydarzeniu, ' +
      'na warunkach opisanych na stronie wydarzenia i w regulaminie. Oświadczam, że znam stan ' +
      'zdrowia dziecka i nie ma przeciwwskazań do jego udziału.',
    required: true,
    minorOnly: true
  },
  {
    code: 'health',
    label: 'Zgoda na przetwarzanie danych o zdrowiu',
    text:
      'Wyrażam wyraźną zgodę na przetwarzanie podanych wyżej danych o stanie zdrowia, diecie i ' +
      'szczepieniach (art. 9 ust. 2 lit. a RODO) wyłącznie w celu zapewnienia bezpieczeństwa i ' +
      'opieki podczas wydarzenia. Zgodę mogę wycofać w każdej chwili; wycofanie nie wpływa na ' +
      'zgodność z prawem przetwarzania sprzed jej wycofania.',
    required: true,
    minorOnly: false
  },
  {
    code: 'medical',
    label: 'Pomoc medyczna',
    text:
      'W razie zagrożenia zdrowia lub życia wyrażam zgodę na wezwanie pomocy medycznej, ' +
      'przewóz do placówki ochrony zdrowia i udzielenie niezbędnej pomocy, a organizatora ' +
      'proszę o niezwłoczne poinformowanie mnie o takim zdarzeniu.',
    required: true,
    minorOnly: false
  },
  {
    code: 'rules',
    label: 'Regulamin',
    text: 'Zapoznałam/em się z regulaminem wydarzenia i zobowiązuję się go przestrzegać.',
    required: true,
    minorOnly: false
  },
  {
    code: 'image',
    label: 'Wizerunek (dobrowolne)',
    text:
      'Wyrażam zgodę na nieodpłatne utrwalenie i publikację wizerunku w relacjach z wydarzenia ' +
      '(strona internetowa i profile organizatora), zgodnie z art. 81 ustawy o prawie autorskim ' +
      'i prawach pokrewnych. Zgoda jest dobrowolna i nie warunkuje udziału; mogę ją wycofać.',
    required: false,
    minorOnly: false
  },
  {
    code: 'contact',
    label: 'Informacje o kolejnych wydarzeniach (dobrowolne)',
    text:
      'Chcę otrzymywać od organizatora informacje o kolejnych wydarzeniach. Zgoda jest ' +
      'dobrowolna i mogę ją wycofać w każdej chwili.',
    required: false,
    minorOnly: false
  }
];

const DEFAULT_PURPOSES = [
  'organizacja udziału w wydarzeniu i kontakt w sprawach organizacyjnych — art. 6 ust. 1 lit. b RODO (umowa) oraz art. 6 ust. 1 lit. a RODO (zgoda) w przypadku osoby niepełnoletniej,',
  'zapewnienie bezpieczeństwa i opieki, w tym reagowanie w sytuacjach nagłych — art. 6 ust. 1 lit. d oraz art. 9 ust. 2 lit. a RODO (wyraźna zgoda) w zakresie danych o zdrowiu,',
  'wypełnienie obowiązków organizatora wynikających z przepisów o wypoczynku dzieci i młodzieży — art. 6 ust. 1 lit. c RODO,',
  'ustalenie, dochodzenie lub obrona roszczeń — art. 6 ust. 1 lit. f RODO.'
];

type CardField = {
  code: string;
  label: string;
  kind: 'text' | 'textarea' | 'date' | 'tel' | 'email';
  hint?: string;
  half?: boolean;
  required?: boolean;
};

type CardSection = {
  key: string;
  title: string;
  note?: string;
  fields: CardField[];
};

/** The sections the reader fills in, given the event's settings and their age. */
function buildSections(config: CardConfig, isMinor: boolean): CardSection[] {
  const sections: CardSection[] = [
    {
      key: 'participant',
      title: 'Uczestnik',
      fields: [
        { code: 'participantName', label: 'Imię i nazwisko', kind: 'text', required: true },
        { code: 'birthDate', label: 'Data urodzenia', kind: 'date', half: true, required: true },
        ...(config.collectPesel
          ? [
              {
                code: 'pesel',
                label: 'PESEL',
                kind: 'text' as const,
                half: true,
                hint: 'Potrzebny do potwierdzenia prawa do świadczeń zdrowotnych.'
              }
            ]
          : []),
        { code: 'address', label: 'Adres zamieszkania', kind: 'text', required: true },
        { code: 'phone', label: 'Telefon uczestnika', kind: 'tel', half: true },
        { code: 'email', label: 'E-mail', kind: 'email', half: true }
      ]
    }
  ];

  if (isMinor) {
    sections.push({
      key: 'guardians',
      title: 'Rodzice / opiekunowie prawni',
      note: 'Uczestnik jest niepełnoletni, więc kartę wypełnia i podpisuje rodzic albo opiekun prawny.',
      fields: [
        { code: 'guardian1Name', label: 'Imię i nazwisko', kind: 'text', required: true },
        { code: 'guardian1Phone', label: 'Telefon', kind: 'tel', half: true, required: true },
        { code: 'guardian1Email', label: 'E-mail', kind: 'email', half: true },
        {
          code: 'guardianAddress',
          label: 'Adres zamieszkania rodziców',
          kind: 'text',
          hint: 'Wypełnij, jeśli inny niż adres uczestnika.'
        },
        { code: 'guardian2Name', label: 'Drugi rodzic / opiekun', kind: 'text', half: true },
        { code: 'guardian2Phone', label: 'Telefon', kind: 'tel', half: true }
      ]
    });
  }

  if (config.collectEmergency) {
    sections.push({
      key: 'emergency',
      title: 'Kontakt w czasie wydarzenia',
      note: 'Numer, pod którym na pewno ktoś odbierze przez cały czas trwania wydarzenia.',
      fields: [
        { code: 'emergencyName', label: 'Kto', kind: 'text', half: true, required: true },
        { code: 'emergencyPhone', label: 'Telefon', kind: 'tel', half: true, required: true }
      ]
    });
  }

  if (config.collectSpecialNeeds) {
    sections.push({
      key: 'needs',
      title: 'Szczególne potrzeby',
      fields: [
        {
          code: 'specialNeeds',
          label: 'Potrzeby wynikające z niepełnosprawności, stanu zdrowia lub sytuacji uczestnika',
          kind: 'textarea',
          hint: 'Zostaw puste, jeśli nie dotyczy.'
        }
      ]
    });
  }

  if (config.collectHealth) {
    sections.push({
      key: 'health',
      title: 'Stan zdrowia i dieta',
      note:
        'To dane szczególnej kategorii (art. 9 RODO). Zbieramy je wyłącznie po to, żeby bezpiecznie ' +
        'zaopiekować się uczestnikiem, i tylko za wyraźną zgodą poniżej.',
      fields: [
        {
          code: 'healthAllergies',
          label: 'Uczulenia',
          kind: 'textarea',
          hint: 'Leki, pokarmy, pyłki, jad owadów.'
        },
        { code: 'healthChronic', label: 'Choroby przewlekłe', kind: 'textarea' },
        {
          code: 'healthMedication',
          label: 'Leki przyjmowane na stałe i dawki',
          kind: 'textarea'
        },
        { code: 'healthDiet', label: 'Dieta', kind: 'text' },
        {
          code: 'healthAids',
          label: 'Okulary, soczewki, aparat ortodontyczny, inne',
          kind: 'text'
        },
        { code: 'healthTravel', label: 'Jak znosi jazdę i wysiłek', kind: 'text' },
        {
          code: 'healthPsych',
          label: 'Trudności emocjonalne, funkcjonowanie w grupie, lęki',
          kind: 'textarea',
          hint: 'Np. lęk wysokości lub wody. Zostaw puste, jeśli nie dotyczy.'
        }
      ]
    });
  }

  if (config.collectVaccinations) {
    sections.push({
      key: 'vaccinations',
      title: 'Szczepienia ochronne',
      note: 'Podaj rok ostatniego szczepienia.',
      fields: [
        { code: 'vaccTetanus', label: 'Tężec', kind: 'text', half: true },
        { code: 'vaccDiphtheria', label: 'Błonica', kind: 'text', half: true },
        { code: 'vaccOther', label: 'Inne', kind: 'text' }
      ]
    });
  }

  sections.push({
    key: 'notes',
    title: 'Uwagi',
    fields: [{ code: 'notes', label: 'Cokolwiek jeszcze organizator powinien wiedzieć', kind: 'textarea' }]
  });

  return sections;
}

/** The art. 13 information clause, assembled so it always matches the settings. */
function buildClause(config: CardConfig): string {
  const lines: string[] = ['Informacja o przetwarzaniu danych osobowych (art. 13 RODO)'];

  lines.push(
    `Administratorem danych jest ${config.controllerName ?? '[uzupełnij: nazwa administratora]'}` +
      (config.controllerAddress ? `, ${config.controllerAddress}` : '') +
      (config.controllerContact ? `. Kontakt: ${config.controllerContact}` : '') +
      '.'
  );

  if (config.dpoContact) {
    lines.push(`Kontakt do inspektora ochrony danych: ${config.dpoContact}.`);
  }

  if (config.purposes.length > 0) {
    lines.push('Dane przetwarzamy w celach:');
    for (const purpose of config.purposes) lines.push(`— ${purpose}`);
  }

  lines.push(
    `Odbiorcy danych: ${config.recipients ?? 'osoby prowadzące wydarzenie oraz podmioty, którym powierzamy usługi (np. hosting), a w razie potrzeby służby ratunkowe i placówki ochrony zdrowia.'}`
  );
  lines.push(
    `Okres przechowywania: ${config.retention ?? '[uzupełnij: jak długo przechowujecie karty]'}`
  );
  lines.push(
    'Masz prawo dostępu do danych, ich sprostowania, usunięcia lub ograniczenia przetwarzania, prawo ' +
      'do przenoszenia danych oraz prawo sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym ' +
      'interesie. Zgody, na których opiera się przetwarzanie, możesz wycofać w każdej chwili — bez wpływu ' +
      'na zgodność z prawem przetwarzania sprzed wycofania. Przysługuje Ci skarga do Prezesa Urzędu ' +
      'Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa.'
  );
  lines.push(
    'Podanie danych jest dobrowolne, ale bez części z nich nie możemy przyjąć zgłoszenia ani zapewnić ' +
      'bezpieczeństwa podczas wydarzenia. Dane nie służą do zautomatyzowanego podejmowania decyzji ani ' +
      'do profilowania.'
  );

  if (config.extraClause) lines.push(config.extraClause);

  return lines.join('\n');
}

/** Whole years between a date of birth and today; null when the date is unusable. */
function ageAt(birthDate: string): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) age -= 1;
  return age;
}

export const participantCardPart = definePart<CardConfig>({
  kind: 'card',
  label: 'Karta uczestnika i zgody',
  description:
    'Dane uzupełniające za linkiem osobistym: karta uczestnika, zgoda rodzica dla niepełnoletnich i klauzula RODO.',

  defaultConfig: () => ({
    intro:
      'Uzupełnij kartę uczestnika. Dane są widoczne tylko dla organizatora i służą wyłącznie do ' +
      'przeprowadzenia wydarzenia. Możesz je poprawić w każdej chwili z tego samego linku.',
    saveLabel: 'Zapisz i podpisz',
    savedMessage: 'Karta została zapisana.',
    adultAge: 18,
    collectPesel: true,
    collectSpecialNeeds: true,
    collectHealth: true,
    collectVaccinations: true,
    collectEmergency: true,
    controllerName: null,
    controllerAddress: null,
    controllerContact: null,
    dpoContact: null,
    purposes: DEFAULT_PURPOSES,
    recipients: null,
    retention: null,
    extraClause: null,
    consents: DEFAULT_CONSENTS
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    const consents = mapEntries<ConsentSpec>(record.consents, (item) => {
      const code = asText(item.code).trim();
      const text = asText(item.text).trim();
      if (code.length === 0 || text.length === 0) return null;
      return {
        code,
        label: asText(item.label, code).trim(),
        text,
        required: asBool(item.required),
        minorOnly: asBool(item.minorOnly)
      };
    });

    const purposes = Array.isArray(record.purposes)
      ? record.purposes.map((entry) => asText(entry).trim()).filter((entry) => entry.length > 0)
      : [];

    return {
      intro: asOptionalText(record.intro),
      saveLabel: asOptionalText(record.saveLabel),
      savedMessage: asOptionalText(record.savedMessage),
      adultAge: (() => {
        const value = Number(record.adultAge);
        return Number.isFinite(value) && value >= 1 && value <= 26 ? Math.round(value) : 18;
      })(),
      collectPesel: asBool(record.collectPesel, true),
      collectSpecialNeeds: asBool(record.collectSpecialNeeds, true),
      collectHealth: asBool(record.collectHealth, true),
      collectVaccinations: asBool(record.collectVaccinations, true),
      collectEmergency: asBool(record.collectEmergency, true),
      controllerName: asOptionalText(record.controllerName),
      controllerAddress: asOptionalText(record.controllerAddress),
      controllerContact: asOptionalText(record.controllerContact),
      dpoContact: asOptionalText(record.dpoContact),
      purposes: purposes.length > 0 ? purposes : DEFAULT_PURPOSES,
      recipients: asOptionalText(record.recipients),
      retention: asOptionalText(record.retention),
      extraClause: asOptionalText(record.extraClause),
      consents: consents.length > 0 ? consents : DEFAULT_CONSENTS
    };
  },

  Renderer: ({ config, ctx }) => {
    const token = ctx.accessToken;
    const partId = ctx.part.id;

    const [card, setCard] = useState<EventParticipantCard | null>(null);
    const [data, setData] = useState<Record<string, string>>({});
    const [accepted, setAccepted] = useState<Record<string, boolean>>({});
    const [signerName, setSignerName] = useState('');
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);

    const load = useCallback(async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await getParticipantCard(token, partId);
        setCard(response);
        const next: Record<string, string> = {};
        for (const [code, value] of Object.entries(response.data)) next[code] = value ?? '';
        if (!next.participantName && response.participantName) next.participantName = response.participantName;
        setData(next);
        setAccepted(Object.fromEntries(response.consents.map((entry) => [entry.code, entry.accepted])));
        setSignerName(response.signerName ?? '');
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać karty.');
      } finally {
        setLoading(false);
      }
    }, [partId, token]);

    useEffect(() => {
      void load();
    }, [load]);

    const age = ageAt(data.birthDate ?? '');
    const isMinor = age !== null && age < config.adultAge;
    const sections = useMemo(() => buildSections(config, isMinor), [config, isMinor]);
    const clause = useMemo(() => buildClause(config), [config]);
    const visibleConsents = config.consents.filter((entry) => !entry.minorOnly || isMinor);

    if (!token) {
      return <p className="ev-note">Ta sekcja działa tylko z linku osobistego.</p>;
    }
    if (loading) {
      return <p className="ev-note">Wczytywanie karty…</p>;
    }

    const save = async (event: FormEvent) => {
      event.preventDefault();
      setError(null);
      setSaved(null);

      if (age === null) {
        setError('Podaj datę urodzenia uczestnika — od niej zależy, kto podpisuje kartę.');
        return;
      }

      const missing = sections
        .flatMap((section) => section.fields)
        .find((field) => field.required && (data[field.code] ?? '').trim().length === 0);
      if (missing) {
        setError(`Uzupełnij pole „${missing.label}”.`);
        return;
      }

      const refused = visibleConsents.find((entry) => entry.required && !accepted[entry.code]);
      if (refused) {
        setError(`Bez zgody „${refused.label}” nie możemy przyjąć karty.`);
        return;
      }

      if (signerName.trim().length === 0) {
        setError('Podpisz kartę imieniem i nazwiskiem.');
        return;
      }

      setPending(true);
      try {
        const response = await saveParticipantCard(token, partId, {
          data,
          consents: visibleConsents.map((entry) => ({
            code: entry.code,
            label: entry.label,
            text: entry.text,
            accepted: accepted[entry.code] === true
          })),
          // Stored with the answers: proving art. 13 was met means keeping the
          // text the person was actually shown, not today's version of it.
          clauseText: clause,
          isMinor,
          signerRole: isMinor ? 'guardian' : 'participant',
          signerName: signerName.trim(),
          participantName: data.participantName ?? null
        });
        setCard(response);
        setSaved(config.savedMessage ?? 'Karta została zapisana.');
      } catch (saveError: unknown) {
        setError(saveError instanceof Error ? saveError.message : 'Nie udało się zapisać karty.');
      } finally {
        setPending(false);
      }
    };

    const setField = (code: string, value: string) =>
      setData((previous) => ({ ...previous, [code]: value }));

    return (
      <div className="ev-card-form">
        {config.intro ? <p className="ev-note">{config.intro}</p> : null}

        {card?.submittedUtc ? (
          <p className="ev-own-meta">
            Karta podpisana przez: {card.signerName}
            {card.isMinor ? ' (rodzic / opiekun prawny)' : ''} ·{' '}
            {new Date(card.updatedUtc ?? card.submittedUtc).toLocaleString('pl-PL', {
              dateStyle: 'long',
              timeStyle: 'short'
            })}
          </p>
        ) : null}

        <form className="ev-form" onSubmit={(event) => void save(event)}>
          {sections.map((section) => (
            <fieldset className="ev-fieldset" key={section.key}>
              <legend>{section.title}</legend>
              {section.note ? <small>{section.note}</small> : null}

              <div className="ev-card-grid">
                {section.fields.map((field) => (
                  <label className={`ev-field ${field.half ? 'is-half' : ''}`} key={field.code}>
                    <span className="ev-field-label">
                      {field.label}
                      {field.required ? <em aria-hidden="true"> *</em> : null}
                    </span>
                    {field.kind === 'textarea' ? (
                      <textarea
                        rows={2}
                        value={data[field.code] ?? ''}
                        onChange={(event) => setField(field.code, event.target.value)}
                      />
                    ) : (
                      <input
                        type={field.kind === 'date' ? 'date' : field.kind === 'tel' ? 'tel' : field.kind}
                        value={data[field.code] ?? ''}
                        onChange={(event) => setField(field.code, event.target.value)}
                      />
                    )}
                    {field.hint ? <small>{field.hint}</small> : null}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {age !== null ? (
            <p className={`ev-card-age ${isMinor ? 'is-minor' : ''}`}>
              {isMinor
                ? `Uczestnik ma ${age} lat — kartę wypełnia i podpisuje rodzic albo opiekun prawny.`
                : `Uczestnik ma ${age} lat — podpisuje kartę samodzielnie.`}
            </p>
          ) : null}

          {/* The information obligation is met by showing this, not by linking
              it: it stays on the page above the consents. */}
          <section className="ev-clause" aria-label="Informacja o przetwarzaniu danych">
            {clause.split('\n').map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </section>

          <fieldset className="ev-fieldset">
            <legend>Oświadczenia i zgody</legend>
            {visibleConsents.map((entry) => (
              <label className="ev-check-row" key={entry.code}>
                <input
                  type="checkbox"
                  checked={accepted[entry.code] === true}
                  onChange={(event) =>
                    setAccepted((previous) => ({ ...previous, [entry.code]: event.target.checked }))
                  }
                />
                <span>
                  <strong>
                    {entry.label}
                    {entry.required ? <em aria-hidden="true"> *</em> : null}
                  </strong>
                  <small>{entry.text}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="ev-field">
            <span className="ev-field-label">
              Podpis — imię i nazwisko {isMinor ? 'rodzica / opiekuna prawnego' : 'uczestnika'}
              <em aria-hidden="true"> *</em>
            </span>
            <input type="text" value={signerName} onChange={(event) => setSignerName(event.target.value)} />
            <small>
              Wpisanie imienia i nazwiska jest równoznaczne z podpisaniem karty. Data i godzina podpisu
              zapisują się same.
            </small>
          </label>

          <button className="ev-cta" type="submit" disabled={pending}>
            {pending ? 'Zapisywanie…' : (config.saveLabel ?? 'Zapisz i podpisz')}
          </button>

          {error ? <p className="ev-error">{error}</p> : null}
          {saved ? <p className="ev-success">{saved}</p> : null}
        </form>
      </div>
    );
  },

  Editor: ({ config, onChange }) => (
    <>
      <p className="eve-warn">
        Ta sekcja zbiera dane wrażliwe i zgody. Uzupełnij administratora danych i okres przechowywania — bez tego
        klauzula informacyjna jest niekompletna. Treść zgód zapisuje się razem z odpowiedzią, więc późniejsza zmiana
        nie podmienia tego, na co ktoś się już zgodził.
      </p>

      <AreaRow
        label="Wstęp"
        rows={3}
        value={config.intro ?? ''}
        onChange={(intro) => onChange({ ...config, intro: intro || null })}
      />
      <TextRow
        label="Napis na przycisku"
        value={config.saveLabel ?? ''}
        onChange={(saveLabel) => onChange({ ...config, saveLabel: saveLabel || null })}
      />
      <AreaRow
        label="Komunikat po zapisaniu"
        rows={2}
        value={config.savedMessage ?? ''}
        onChange={(savedMessage) => onChange({ ...config, savedMessage: savedMessage || null })}
      />

      <fieldset className="eve-group">
        <legend>Co zbieramy</legend>
        <NumberRow
          label="Pełnoletność od (lat)"
          value={config.adultAge}
          hint="Poniżej tego wieku kartę podpisuje rodzic albo opiekun prawny."
          onChange={(adultAge) => onChange({ ...config, adultAge })}
        />
        <CheckRow
          label="PESEL uczestnika"
          checked={config.collectPesel}
          onChange={(collectPesel) => onChange({ ...config, collectPesel })}
        />
        <CheckRow
          label="Szczególne potrzeby"
          checked={config.collectSpecialNeeds}
          onChange={(collectSpecialNeeds) => onChange({ ...config, collectSpecialNeeds })}
        />
        <CheckRow
          label="Stan zdrowia i dieta"
          checked={config.collectHealth}
          onChange={(collectHealth) => onChange({ ...config, collectHealth })}
        />
        <CheckRow
          label="Szczepienia"
          checked={config.collectVaccinations}
          onChange={(collectVaccinations) => onChange({ ...config, collectVaccinations })}
        />
        <CheckRow
          label="Kontakt w czasie wydarzenia"
          checked={config.collectEmergency}
          onChange={(collectEmergency) => onChange({ ...config, collectEmergency })}
        />
      </fieldset>

      <fieldset className="eve-group">
        <legend>Klauzula informacyjna (RODO art. 13)</legend>
        <TextRow
          label="Administrator danych"
          value={config.controllerName ?? ''}
          hint="Np. Parafia św. … w …"
          onChange={(controllerName) => onChange({ ...config, controllerName: controllerName || null })}
        />
        <TextRow
          label="Adres administratora"
          value={config.controllerAddress ?? ''}
          onChange={(controllerAddress) => onChange({ ...config, controllerAddress: controllerAddress || null })}
        />
        <TextRow
          label="Kontakt"
          value={config.controllerContact ?? ''}
          hint="E-mail albo telefon, pod którym można realizować swoje prawa."
          onChange={(controllerContact) => onChange({ ...config, controllerContact: controllerContact || null })}
        />
        <TextRow
          label="Inspektor ochrony danych"
          value={config.dpoContact ?? ''}
          hint="Zostaw puste, jeśli nie został wyznaczony."
          onChange={(dpoContact) => onChange({ ...config, dpoContact: dpoContact || null })}
        />
        <AreaRow
          label="Cele i podstawy prawne"
          rows={6}
          value={config.purposes.join('\n')}
          hint="Jeden cel na linię."
          onChange={(value) =>
            onChange({
              ...config,
              purposes: value
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
            })
          }
        />
        <AreaRow
          label="Odbiorcy danych"
          rows={2}
          value={config.recipients ?? ''}
          onChange={(recipients) => onChange({ ...config, recipients: recipients || null })}
        />
        <TextRow
          label="Okres przechowywania"
          value={config.retention ?? ''}
          hint="Np. do końca roku kalendarzowego po wydarzeniu, a rozliczenia — 5 lat."
          onChange={(retention) => onChange({ ...config, retention: retention || null })}
        />
        <AreaRow
          label="Dodatkowy akapit"
          rows={3}
          value={config.extraClause ?? ''}
          onChange={(extraClause) => onChange({ ...config, extraClause: extraClause || null })}
        />
      </fieldset>

      <ListEditor<ConsentSpec>
        legend="Zgody i oświadczenia"
        items={config.consents}
        addLabel="Dodaj zgodę"
        blank={() => ({ code: `zgoda${config.consents.length + 1}`, label: 'Nowa zgoda', text: '', required: false, minorOnly: false })}
        titleOf={(item) => item.label || item.code}
        onChange={(consents) => onChange({ ...config, consents })}
        renderItem={(item, update) => (
          <>
            <TextRow
              label="Kod"
              value={item.code}
              hint="Krótki, stały identyfikator — po nim rozpoznajesz zgodę w wykazie."
              onChange={(code) => update({ ...item, code })}
            />
            <TextRow label="Nazwa" value={item.label} onChange={(label) => update({ ...item, label })} />
            <AreaRow label="Treść" rows={4} value={item.text} onChange={(text) => update({ ...item, text })} />
            <CheckRow
              label="Wymagana (bez niej nie da się zapisać karty)"
              checked={item.required}
              onChange={(required) => update({ ...item, required })}
            />
            <CheckRow
              label="Tylko dla niepełnoletnich"
              checked={item.minorOnly}
              onChange={(minorOnly) => update({ ...item, minorOnly })}
            />
          </>
        )}
      />
    </>
  )
});
