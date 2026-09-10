import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { getParticipantCard, saveParticipantCard, type EventParticipantCard } from '../../../lib/api';
import {
  CARD_LEVELS,
  LEVEL_OPTIONS,
  readLevel,
  type CardLevel,
  type ConsentSpec,
  type Question
} from './cardLevels';
import { asBool, asOptionalText, asRecord, asText, definePart } from './contracts';
import { AreaRow, CheckRow, NumberRow, SelectRow, TextRow } from './editorKit';

/**
 * The participant card: what still has to be asked of a named person once they
 * are taking part, and the statements someone has to sign.
 *
 * The organizer chooses one of four documents (see cardLevels.ts) and everything
 * else follows from it — which blocks appear, who signs, and whether clicking
 * finishes the matter. Two rules run underneath:
 *
 * **Ask for as little as the level needs.** An adult is identified by name, and
 * by a date of birth where the level has to tell an adult from a minor. Contact
 * details are already in the registration; asking twice would be collecting the
 * same data twice.
 *
 * **A minor's card ends on paper.** Ticking a box on a website is not the
 * guardian's signature — nobody can show who sat at the keyboard, and no school,
 * parish or insurer will accept it as one. So a minor fills the card in online,
 * prints it, signs it by hand, and hands it over at the start. The screen says
 * so before and after saving, and the sheet says so too.
 */

type CardConfig = {
  level: CardLevel;
  intro: string | null;
  saveLabel: string | null;
  savedMessage: string | null;
  adultAge: number;
  /** A contact for the event itself, beyond the guardian's own number. */
  askEmergency: boolean;
  questions: Question[];
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

const DEFAULT_PURPOSES = [
  'udział w wydarzeniu i kontakt w sprawach organizacyjnych — art. 6 ust. 1 lit. b RODO, a w przypadku osoby niepełnoletniej art. 6 ust. 1 lit. a RODO (zgoda opiekuna),',
  'bezpieczeństwo uczestników i reagowanie w sytuacjach nagłych — art. 6 ust. 1 lit. d RODO, a w zakresie zdrowia i diety art. 9 ust. 2 lit. a RODO (wyraźna zgoda),',
  'ustalenie, dochodzenie lub obrona roszczeń — art. 6 ust. 1 lit. f RODO.'
];

type CardField = {
  code: string;
  label: string;
  kind: 'text' | 'date' | 'tel';
  hint?: string;
  half?: boolean;
  required?: boolean;
};

type CardSection = { key: string; title: string; note?: string; fields: CardField[] };

/** The structured fields for a level and an age. Nothing here is optional decoration. */
function buildSections(config: CardConfig, isMinor: boolean): CardSection[] {
  const spec = CARD_LEVELS[config.level];
  const sections: CardSection[] = [];

  const participant: CardField[] = [
    { code: 'participantName', label: 'Imię i nazwisko', kind: 'text', required: true }
  ];
  if (spec.askBirthDate) {
    participant.push({ code: 'birthDate', label: 'Data urodzenia', kind: 'date', half: true, required: true });
  }
  if (spec.askKarta) {
    participant.push({
      code: 'pesel',
      label: 'PESEL',
      kind: 'text',
      half: true,
      hint: 'Wymagany we wzorze karty kwalifikacyjnej.'
    });
    participant.push({ code: 'address', label: 'Adres zamieszkania', kind: 'text', required: true });
  }
  sections.push({ key: 'participant', title: 'Uczestnik', fields: participant });

  if (isMinor && spec.guardianForMinors) {
    const guardian: CardField[] = [
      { code: 'guardian1Name', label: 'Imię i nazwisko', kind: 'text', required: true },
      {
        code: 'guardian1Phone',
        label: 'Telefon',
        kind: 'tel',
        half: true,
        required: true,
        hint: 'Numer czynny przez cały czas trwania wydarzenia.'
      }
    ];
    if (spec.askKarta) {
      guardian.push({
        code: 'guardianAddress',
        label: 'Adres zamieszkania rodziców',
        kind: 'text',
        hint: 'Wypełnij, jeśli inny niż adres uczestnika.'
      });
    }
    sections.push({
      key: 'guardians',
      title: 'Rodzic / opiekun prawny',
      note: 'Uczestnik jest niepełnoletni, więc kartę wypełnia i podpisuje rodzic albo opiekun prawny.',
      fields: guardian
    });
  }

  // A second number only where the organizer asked for one — a minor's guardian
  // phone already is the contact for the event.
  if (config.askEmergency && config.level !== 'rodo') {
    sections.push({
      key: 'emergency',
      title: 'Kontakt na czas wydarzenia',
      fields: [
        { code: 'emergencyName', label: 'Kto', kind: 'text', half: true, required: true },
        { code: 'emergencyPhone', label: 'Telefon', kind: 'tel', half: true, required: true }
      ]
    });
  }

  if (spec.askKarta) {
    sections.push({
      key: 'karta',
      title: 'Karta kwalifikacyjna — pozostałe pola',
      note: 'Te pola wynikają wprost ze wzoru karty.',
      fields: [
        { code: 'specialNeeds', label: 'Szczególne potrzeby edukacyjne', kind: 'text' },
        { code: 'vaccTetanus', label: 'Szczepienie: tężec (rok)', kind: 'text', half: true },
        { code: 'vaccDiphtheria', label: 'Szczepienie: błonica (rok)', kind: 'text', half: true }
      ]
    });
  }

  return sections;
}

function questionsFor(config: CardConfig, isMinor: boolean): Question[] {
  if (!CARD_LEVELS[config.level].askQuestions) return [];
  return config.questions.filter((entry) => entry.scope === 'all' || isMinor);
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

  if (config.dpoContact) lines.push(`Kontakt do inspektora ochrony danych: ${config.dpoContact}.`);

  if (config.purposes.length > 0) {
    lines.push('Cele i podstawy prawne: ' + config.purposes.join(' '));
  }

  lines.push(
    `Odbiorcy danych: ${
      config.recipients ??
      'osoby prowadzące wydarzenie oraz dostawcy usług, z których korzystamy (np. hosting), a w razie potrzeby służby ratunkowe.'
    }`
  );
  lines.push(`Okres przechowywania: ${config.retention ?? '[uzupełnij: jak długo przechowujecie te dane]'}`);
  lines.push(
    'Prawa: dostęp do danych, sprostowanie, usunięcie, ograniczenie przetwarzania, przenoszenie danych oraz ' +
      'sprzeciw wobec przetwarzania opartego na prawnie uzasadnionym interesie. Zgody można wycofać w każdej ' +
      'chwili — bez wpływu na zgodność z prawem przetwarzania sprzed wycofania. Przysługuje skarga do Prezesa ' +
      'Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa.'
  );
  lines.push(
    'Podanie danych jest dobrowolne, ale bez nich nie możemy przyjąć zgłoszenia. Dane nie służą do ' +
      'zautomatyzowanego podejmowania decyzji ani do profilowania.'
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

function formatMoment(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
}

export const participantCardPart = definePart<CardConfig>({
  kind: 'card',
  label: 'Karta uczestnika i zgody',
  description:
    'Zgody za linkiem osobistym. Wybierasz jeden z czterech dokumentów; zakres pól i sposób podpisu wynikają z niego.',

  defaultConfig: () => ({
    level: 'trip',
    intro:
      'Uzupełnij kartę uczestnika. Pytamy o tyle, ile naprawdę potrzebujemy. Dane widzi tylko organizator, ' +
      'a Ty możesz je poprawić w każdej chwili z tego samego linku.',
    saveLabel: 'Zapisz i podpisz',
    savedMessage: 'Karta została zapisana.',
    adultAge: 18,
    askEmergency: false,
    questions: CARD_LEVELS.trip.questions,
    controllerName: null,
    controllerAddress: null,
    controllerContact: null,
    dpoContact: null,
    purposes: DEFAULT_PURPOSES,
    recipients: null,
    retention: null,
    extraClause: null,
    consents: CARD_LEVELS.trip.consents
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    const level = readLevel(record.level);

    const purposes = Array.isArray(record.purposes)
      ? record.purposes.map((entry) => asText(entry).trim()).filter((entry) => entry.length > 0)
      : [];

    return {
      level,
      intro: asOptionalText(record.intro),
      saveLabel: asOptionalText(record.saveLabel),
      savedMessage: asOptionalText(record.savedMessage),
      adultAge: (() => {
        const value = Number(record.adultAge);
        return Number.isFinite(value) && value >= 1 && value <= 26 ? Math.round(value) : 18;
      })(),
      askEmergency: asBool(record.askEmergency),
      // Questions and statements are never read from the stored config. They
      // are the document, and the document is what the level says it is — an
      // organizer editing "wyrażam zgodę" into something else, or a stale copy
      // surviving a change of level, is how a consent stops being one.
      questions: CARD_LEVELS[level].questions,
      controllerName: asOptionalText(record.controllerName),
      controllerAddress: asOptionalText(record.controllerAddress),
      controllerContact: asOptionalText(record.controllerContact),
      dpoContact: asOptionalText(record.dpoContact),
      purposes: purposes.length > 0 ? purposes : DEFAULT_PURPOSES,
      recipients: asOptionalText(record.recipients),
      retention: asOptionalText(record.retention),
      extraClause: asOptionalText(record.extraClause),
      consents: CARD_LEVELS[level].consents
    };
  },

  Renderer: ({ config, ctx }) => {
    const token = ctx.accessToken;
    const partId = ctx.part.id;
    const spec = CARD_LEVELS[config.level];

    const [card, setCard] = useState<EventParticipantCard | null>(null);
    const [data, setData] = useState<Record<string, string>>({});
    const [accepted, setAccepted] = useState<Record<string, boolean>>({});
    const [signerName, setSignerName] = useState('');
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

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

    // Without a date of birth the level has decided nobody is a minor.
    const age = spec.askBirthDate ? ageAt(data.birthDate ?? '') : null;
    const isMinor = age !== null && age < config.adultAge;
    const sections = useMemo(() => buildSections(config, isMinor), [config, isMinor]);
    const questions = useMemo(() => questionsFor(config, isMinor), [config, isMinor]);
    const clause = useMemo(() => buildClause(config), [config]);
    const visibleConsents = config.consents.filter((entry) => !entry.minorOnly || isMinor);
    const needsPaper = isMinor && spec.paperForMinors;

    if (!token) {
      return <p className="ev-note">Ta sekcja działa tylko z linku osobistego.</p>;
    }
    if (loading) {
      return <p className="ev-note">Wczytywanie karty…</p>;
    }

    const setField = (code: string, value: string) =>
      setData((previous) => ({ ...previous, [code]: value }));

    const save = async (event: FormEvent) => {
      event.preventDefault();
      setError(null);
      setSaved(false);

      if (spec.askBirthDate && age === null) {
        setError('Podaj datę urodzenia — od niej zależy, kto podpisuje kartę.');
        return;
      }

      const missing = sections
        .flatMap((section) => section.fields)
        .find((field) => field.required && (data[field.code] ?? '').trim().length === 0);
      if (missing) {
        setError(`Uzupełnij pole „${missing.label}”.`);
        return;
      }

      const unexplained = questions.find(
        (question) =>
          question.requireDetail &&
          data[question.code] === 'tak' &&
          (data[`${question.code}Detail`] ?? '').trim().length === 0
      );
      if (unexplained) {
        setError(`Napisz krótko: ${unexplained.detailLabel.toLowerCase()}.`);
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

      // "Nie" carries nothing worth storing, and an explanation under a "nie" is
      // stale. Neither is sent.
      const payload: Record<string, string | null> = {};
      for (const field of sections.flatMap((section) => section.fields)) {
        const value = (data[field.code] ?? '').trim();
        if (value.length > 0) payload[field.code] = value;
      }
      for (const question of questions) {
        if (data[question.code] !== 'tak') continue;
        payload[question.code] = 'tak';
        const detail = (data[`${question.code}Detail`] ?? '').trim();
        if (detail.length > 0) payload[`${question.code}Detail`] = detail;
      }

      setPending(true);
      try {
        const response = await saveParticipantCard(token, partId, {
          data: payload,
          consents: visibleConsents.map((entry) => ({
            code: entry.code,
            label: entry.label,
            text: entry.text,
            accepted: accepted[entry.code] === true
          })),
          clauseText: clause,
          isMinor,
          signerRole: isMinor ? 'guardian' : 'participant',
          signerName: signerName.trim(),
          participantName: data.participantName ?? null
        });
        setCard(response);
        setSaved(true);
      } catch (saveError: unknown) {
        setError(saveError instanceof Error ? saveError.message : 'Nie udało się zapisać karty.');
      } finally {
        setPending(false);
      }
    };

    return (
      <div className="ev-card-form">
        {config.intro ? <p className="ev-note">{config.intro}</p> : null}

        {needsPaper ? (
          <p className="ev-paper-note">
            <strong>Sama strona nie wystarczy.</strong> Za osobę niepełnoletnią podpisuje rodzic albo opiekun
            prawny, a taki podpis musi być odręczny. Uzupełnij kartę, zapisz ją, wydrukuj, podpisz i oddaj
            organizatorowi na starcie.
          </p>
        ) : null}

        {card?.submittedUtc ? (
          <p className="ev-own-meta">
            Zapisano: {card.signerName}
            {card.isMinor ? ' (rodzic / opiekun prawny)' : ''} · {formatMoment(card.updatedUtc ?? card.submittedUtc)}
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
                    <input
                      type={field.kind === 'date' ? 'date' : field.kind === 'tel' ? 'tel' : 'text'}
                      value={data[field.code] ?? ''}
                      onChange={(event) => setField(field.code, event.target.value)}
                    />
                    {field.hint ? <small>{field.hint}</small> : null}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {age !== null ? (
            <p className={`ev-card-age ${isMinor ? 'is-minor' : ''}`}>
              {isMinor
                ? `Uczestnik ma ${age} lat — podpisuje rodzic albo opiekun prawny, odręcznie na wydruku.`
                : `Uczestnik jest pełnoletni (${age} lat) — podpisuje tutaj i nic nie trzeba drukować.`}
            </p>
          ) : null}

          {questions.length > 0 ? (
            <fieldset className="ev-fieldset">
              <legend>Pytania</legend>
              <small>Odpowiedz „nie”, jeśli nie dotyczy — wtedy nic więcej nie zapisujemy.</small>

              {questions.map((question) => {
                const answer = data[question.code] ?? '';
                return (
                  <div className="ev-question" key={question.code}>
                    <p>{question.text}</p>
                    <div className="ev-question-choice">
                      {(['nie', 'tak'] as const).map((option) => (
                        <label key={option}>
                          <input
                            type="radio"
                            name={`${partId}-${question.code}`}
                            checked={answer === option}
                            onChange={() => setField(question.code, option)}
                          />
                          <span>{option === 'tak' ? 'Tak' : 'Nie'}</span>
                        </label>
                      ))}
                    </div>

                    {answer === 'tak' ? (
                      <label className="ev-field">
                        <span className="ev-field-label">
                          {question.detailLabel}
                          {question.requireDetail ? <em aria-hidden="true"> *</em> : null}
                        </span>
                        <textarea
                          rows={2}
                          value={data[`${question.code}Detail`] ?? ''}
                          onChange={(event) => setField(`${question.code}Detail`, event.target.value)}
                        />
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </fieldset>
          ) : null}

          {/* Shown, not linked: the obligation is to inform, and it has to be in
              front of the person before they tick anything. */}
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
              {isMinor ? 'Imię i nazwisko rodzica / opiekuna prawnego' : 'Podpis — imię i nazwisko'}
              <em aria-hidden="true"> *</em>
            </span>
            <input type="text" value={signerName} onChange={(event) => setSignerName(event.target.value)} />
            <small>
              {isMinor
                ? 'Ta osoba podpisze wydruk odręcznie.'
                : 'Wpisanie imienia i nazwiska podpisuje kartę. Data i godzina zapisują się same.'}
            </small>
          </label>

          <div className="ev-actions">
            {/* Nothing is being signed here when the participant is a minor —
                the signature happens by hand on the printout. */}
            <button className="ev-cta" type="submit" disabled={pending}>
              {pending ? 'Zapisywanie…' : needsPaper ? 'Zapisz kartę' : (config.saveLabel ?? 'Zapisz i podpisz')}
            </button>
            {needsPaper && card?.submittedUtc ? (
              <button className="ev-cta" type="button" onClick={() => window.print()}>
                Drukuj zgodę
              </button>
            ) : null}
          </div>

          {error ? <p className="ev-error">{error}</p> : null}
          {saved ? (
            <p className="ev-success">
              {needsPaper
                ? 'Zapisane. Teraz wydrukuj zgodę, podpisz ją odręcznie i oddaj organizatorowi na starcie — bez tego zgłoszenie nie jest kompletne.'
                : (config.savedMessage ?? 'Karta została zapisana.')}
            </p>
          ) : null}
        </form>

        {needsPaper && card?.submittedUtc ? (
          <PrintableConsent
            title={CARD_LEVELS[config.level].label}
            eventTitle={ctx.siteTitle}
            eventDate={ctx.siteDateLabel}
            eventPlaces={ctx.sitePlaces}
            organizer={[config.controllerName, config.controllerAddress, config.controllerContact]
              .filter((entry): entry is string => !!entry)
              .join(', ')}
            card={card}
            sections={sections}
            questions={questions}
            clause={clause}
          />
        ) : null}
      </div>
    );
  },

  Editor: ({ config, onChange }) => {
    /**
     * Switching the level replaces the statements and questions with that
     * level's own. Carrying a parental consent into the RODO-only level, or
     * leaving a trip without its medical statement, is how a document ends up
     * legally wrong while looking complete.
     */
    const switchLevel = (level: CardLevel) =>
      onChange({
        ...config,
        level,
        questions: CARD_LEVELS[level].questions,
        consents: CARD_LEVELS[level].consents
      });

    return (
      <>
        <SelectRow<CardLevel>
          label="Wersja dokumentu"
          value={config.level}
          options={LEVEL_OPTIONS}
          onChange={switchLevel}
        />
        <p className="eve-hint">{CARD_LEVELS[config.level].note}</p>
        <p className="eve-hint">
          Zmiana wersji przywraca pytania i zgody właściwe dla niej — Twoje zmiany w ich treści zostaną nadpisane.
        </p>

        <p className="eve-warn">
          Uzupełnij administratora danych i okres przechowywania — bez nich klauzula informacyjna jest niekompletna,
          a wydruk nie zostanie przyjęty. Treść zgód zapisuje się razem z odpowiedzią, więc późniejsza zmiana nie
          podmienia tego, na co ktoś już się zgodził.
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
          label="Komunikat po zapisaniu (osoby pełnoletnie)"
          rows={2}
          value={config.savedMessage ?? ''}
          onChange={(savedMessage) => onChange({ ...config, savedMessage: savedMessage || null })}
        />

        <fieldset className="eve-group">
          <legend>Zakres</legend>
          <NumberRow
            label="Pełnoletność od (lat)"
            value={config.adultAge}
            hint="Poniżej tego wieku podpisuje rodzic albo opiekun prawny, odręcznie na wydruku."
            onChange={(adultAge) => onChange({ ...config, adultAge })}
          />
          <CheckRow
            label="Pytaj o osobny kontakt na czas wydarzenia"
            checked={config.askEmergency}
            onChange={(askEmergency) => onChange({ ...config, askEmergency })}
          />
          <p className="eve-hint">
            Dla osoby niepełnoletniej telefon rodzica i tak jest kontaktem na czas wydarzenia — włączaj to tylko,
            gdy potrzebujesz drugiego numeru.
          </p>
        </fieldset>

        {/* The questions and the statements are not editable. They are the
            document, and which document it is was already chosen above; letting
            them be retyped is how "wyrażam zgodę" quietly becomes something
            that is not a consent. What is left below is only what the organizer
            alone can know: who they are and how long they keep the data. */}
        <fieldset className="eve-group">
          <legend>Co ta wersja zawiera</legend>
          {CARD_LEVELS[config.level].questions.length > 0 ? (
            <>
              <p className="eve-hint">Pytania „tak / nie”:</p>
              <ul className="eva-warnings">
                {CARD_LEVELS[config.level].questions.map((question) => (
                  <li key={question.code}>{question.text}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="eve-hint">Ta wersja nie zadaje żadnych pytań.</p>
          )}

          <p className="eve-hint">Oświadczenia i zgody:</p>
          <ul className="eva-warnings">
            {CARD_LEVELS[config.level].consents.map((consent) => (
              <li key={consent.code}>
                {consent.label}
                {consent.required ? ' (wymagana)' : ' (dobrowolna)'}
                {consent.minorOnly ? ' — tylko dla niepełnoletnich' : ''}
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="eve-group">
          <legend>Klauzula informacyjna (RODO art. 13)</legend>
          <TextRow
            label="Administrator danych"
            value={config.controllerName ?? ''}
            hint="Pełna nazwa — trafia na wydruk jako organizator."
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
            rows={5}
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
            hint="Np. do końca roku kalendarzowego po wydarzeniu."
            onChange={(retention) => onChange({ ...config, retention: retention || null })}
          />
          <AreaRow
            label="Dodatkowy akapit"
            rows={3}
            value={config.extraClause ?? ''}
            onChange={(extraClause) => onChange({ ...config, extraClause: extraClause || null })}
          />
        </fieldset>
      </>
    );
  }
});
/**
 * The sheet a guardian signs by hand.
 *
 * Portalled to document.body: the reader's page is a transformed, fixed-position
 * track, so printing it directly yields one clipped screenshot. The print
 * stylesheet hides everything else, and this is laid out to hold a whole consent
 * on one side of A4 — the data in two columns, the statements as one line each,
 * the clause as a dense block of small print at the foot. Nobody is going to
 * print three pages per participant, and a form that runs over is a form that
 * arrives incomplete.
 *
 * It prints from the saved card rather than from the form on screen: a sheet
 * that disagreed with the record would be worse than no sheet.
 */
function PrintableConsent({
  title,
  eventTitle,
  eventDate,
  eventPlaces,
  organizer,
  card,
  sections,
  questions,
  clause
}: {
  title: string;
  eventTitle: string;
  eventDate: string | null;
  eventPlaces: string[];
  organizer: string;
  card: EventParticipantCard;
  sections: CardSection[];
  questions: Question[];
  clause: string;
}) {
  if (typeof document === 'undefined') return null;

  const value = (code: string) => card.data[code] ?? '';
  const subtitle = [eventDate, eventPlaces.join(' – ')].filter((entry) => entry && entry.length > 0).join(' · ');

  return createPortal(
    <div className="ev-print-doc">
      <header>
        <h1>Zgoda rodzica / opiekuna prawnego</h1>
        <p className="ev-print-event">
          <strong>{eventTitle}</strong>
          {subtitle ? ` · ${subtitle}` : ''}
        </p>
        {organizer ? <p className="ev-print-org">Organizator: {organizer}</p> : null}
        <p className="ev-print-kind">{title}</p>
      </header>

      <div className="ev-print-body">
        {sections.map((section) => {
          const filled = section.fields.filter((field) => value(field.code).trim().length > 0);
          if (filled.length === 0) return null;
          return (
            <section key={section.key}>
              <h2>{section.title}</h2>
              <dl>
                {filled.map((field) => (
                  <div key={field.code}>
                    <dt>{field.label}</dt>
                    <dd>{value(field.code)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}

        {questions.length > 0 ? (
          <section>
            <h2>Pytania</h2>
            <dl>
              {questions.map((question) => (
                <div key={question.code}>
                  <dt>{question.text}</dt>
                  <dd>
                    {value(question.code) === 'tak'
                      ? `TAK${value(`${question.code}Detail`) ? ` — ${value(`${question.code}Detail`)}` : ''}`
                      : 'NIE'}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section>
          <h2>Oświadczenia</h2>
          <ul>
            {card.consents.map((consent) => (
              <li key={consent.code}>
                <b>{consent.accepted ? 'TAK' : 'NIE'}</b> {consent.text}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="ev-print-clause">
        {clause.split('\n').map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </section>

      <footer>
        <p className="ev-print-trace">
          Kartę wypełniono elektronicznie {formatMoment(card.updatedUtc ?? card.submittedUtc)} przez:{' '}
          {card.signerName}. Podpis odręczny poniżej jest wymagany — wydruk oddaje się organizatorowi na starcie.
        </p>
        <div className="ev-print-signatures">
          <span>miejscowość i data</span>
          <span>czytelny podpis rodzica / opiekuna prawnego</span>
        </div>
      </footer>
    </div>,
    document.body
  );
}
