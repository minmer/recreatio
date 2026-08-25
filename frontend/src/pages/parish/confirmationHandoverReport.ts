import type {
  ParishConfirmationCandidate,
  ParishConfirmationEvent,
  ParishConfirmationExport,
  ParishConfirmationExportCelebration,
  ParishConfirmationExportCelebrationParticipation,
  ParishConfirmationExportMeetingLink,
  ParishConfirmationExportMeetingSlot,
  ParishConfirmationExportMessage,
  ParishConfirmationExportNote
} from '../../lib/api';
import {
  getConfirmationCandidateYearStatus,
  type ConfirmationYearRequirement
} from './confirmationYearStatus';

type HandoverReportInput = {
  parishName: string;
  candidates: ParishConfirmationCandidate[];
  exportPayload: ParishConfirmationExport;
  events: ParishConfirmationEvent[];
  generatedAt?: Date;
};

type TextGroup = {
  text: string;
  count: number;
  labels: string[];
  firstUtc?: string | null;
  lastUtc?: string | null;
};

const polishDateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

const polishDateTimeFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const multilineHtml = (value: unknown) => escapeHtml(value).replace(/\r?\n/g, '<br />');

const normalizedTextKey = (value: string) =>
  value
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pl-PL');

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : polishDateFormatter.format(date);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : polishDateTimeFormatter.format(date);
};

const fullName = (candidate: Pick<ParishConfirmationCandidate, 'name' | 'surname'>) =>
  `${candidate.name} ${candidate.surname}`.trim();

const sortCandidates = (candidates: ParishConfirmationCandidate[]) =>
  [...candidates].sort((left, right) => {
    const surnameOrder = left.surname.localeCompare(right.surname, 'pl', { sensitivity: 'base' });
    return surnameOrder !== 0
      ? surnameOrder
      : left.name.localeCompare(right.name, 'pl', { sensitivity: 'base' });
  });

export const getConfirmationHandoverRequirements = (
  candidate: ParishConfirmationCandidate
): ConfirmationYearRequirement[] => {
  return getConfirmationCandidateYearStatus(candidate).requirements;
};

const getMissingRequirements = (candidate: ParishConfirmationCandidate) =>
  getConfirmationHandoverRequirements(candidate).filter((item) => item.applicable && !item.fulfilled);

const getIndexSummary = (candidate: ParishConfirmationCandidate) => {
  const modes = [
    candidate.useInternetIndex ? 'internetowy' : null,
    candidate.usePaperIndex ? 'papierowy' : null
  ].filter((item): item is string => Boolean(item));
  if (modes.length === 0) return 'nie wybrano';

  const details: string[] = [modes.join(' + ')];
  if (candidate.useInternetIndex) {
    details.push(
      `online: ${candidate.internetIndexCelebrationFilled ?? 0}/${candidate.internetIndexCelebrationTotal ?? 0}`
    );
  }
  if (candidate.usePaperIndex) {
    details.push(candidate.paperIndexChecked ? 'papierowy sprawdzony' : 'papierowy niesprawdzony');
  }
  return details.join('; ');
};

const groupTextEntries = <T>(
  entries: T[],
  textOf: (entry: T) => string,
  labelOf: (entry: T) => string,
  utcOf?: (entry: T) => string | null | undefined
) => {
  const groups = new Map<string, TextGroup>();
  entries.forEach((entry) => {
    const text = textOf(entry).trim();
    if (!text) return;
    const key = normalizedTextKey(text);
    const utc = utcOf?.(entry) ?? null;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      const label = labelOf(entry);
      if (label && !existing.labels.includes(label)) existing.labels.push(label);
      if (utc && (!existing.firstUtc || utc < existing.firstUtc)) existing.firstUtc = utc;
      if (utc && (!existing.lastUtc || utc > existing.lastUtc)) existing.lastUtc = utc;
      return;
    }
    groups.set(key, {
      text,
      count: 1,
      labels: labelOf(entry) ? [labelOf(entry)] : [],
      firstUtc: utc,
      lastUtc: utc
    });
  });
  return [...groups.values()];
};

const meetingStageLabel = (stage?: string | null) => {
  const normalized = stage?.trim().toLocaleLowerCase('pl-PL');
  if (normalized === 'year1-start') return 'Spotkanie na początku 1. roku';
  if (normalized === 'year1-end') return 'Spotkanie kończące 1. rok';
  return stage?.trim() || 'Spotkanie';
};

const meetingStageOrder = (stage?: string | null) => {
  const normalized = stage?.trim().toLocaleLowerCase('pl-PL');
  if (normalized === 'year1-start') return 0;
  if (normalized === 'year1-end') return 1;
  return 2;
};

const eventJoinStatusLabel = (status: string) => {
  switch (status.trim().toLocaleLowerCase('pl-PL')) {
    case 'accepted':
      return 'zaakceptowane';
    case 'pending':
      return 'oczekujące';
    case 'rejected':
      return 'odrzucone';
    case 'removed':
    case 'cancelled':
      return 'anulowane';
    default:
      return status || '—';
  }
};

const reportDocument = (
  title: string,
  orientation: 'portrait' | 'landscape',
  body: string,
  generatedAt: Date,
  summary: string
) => `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #eef1f5; color: #172033; font-family: "Segoe UI", Arial, sans-serif; line-height: 1.32; }
    body { padding: 14px; }
    .screen-toolbar { max-width: 1180px; margin: 0 auto 14px; padding: 12px 16px; display: flex; gap: 16px; align-items: center; justify-content: space-between; border: 1px solid #cbd3df; border-radius: 12px; background: #fff; }
    .screen-toolbar p { margin: 0; font-size: 13px; }
    .screen-toolbar button { border: 0; border-radius: 9px; padding: 9px 14px; background: #244b7a; color: #fff; font-weight: 700; cursor: pointer; }
    .report-page { width: ${orientation === 'landscape' ? '277mm' : '190mm'}; min-height: ${orientation === 'landscape' ? '190mm' : '277mm'}; margin: 0 auto 12px; padding: 10mm; background: #fff; border: 1px solid #cbd3df; box-shadow: 0 8px 24px rgba(32, 47, 70, 0.08); }
    .report-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 7mm; padding-bottom: 4mm; border-bottom: 2px solid #244b7a; }
    .report-header h1 { margin: 0 0 3px; font-size: 20px; color: #17385f; }
    .report-header p { margin: 0; font-size: 10px; color: #526174; }
    .report-kicker { margin: 0 0 3px; color: #356696; font-size: 9px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .status { display: inline-block; border-radius: 999px; padding: 2px 7px; font-size: 8px; font-weight: 800; white-space: nowrap; }
    .status.yes { background: #dff3e6; color: #146534; }
    .status.no { background: #fde5e2; color: #9a2c24; }
    .status.neutral { background: #e8edf4; color: #40536c; }
    .muted { color: #637083; }
    .warning { color: #8b3a25; font-weight: 700; }
    .footer-note { margin-top: 7mm; padding-top: 3mm; border-top: 1px solid #d7dde6; color: #667386; font-size: 8px; }
    @page { size: A4 ${orientation}; margin: 10mm; }
    @media print {
      html, body { background: #fff; padding: 0; }
      .screen-toolbar { display: none !important; }
      .report-page { width: auto; min-height: 0; margin: 0; padding: 0; border: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="screen-toolbar">
    <p><strong>${escapeHtml(title)}</strong><br />${escapeHtml(summary)} • wygenerowano ${escapeHtml(formatDateTime(generatedAt.toISOString()))}</p>
    <button type="button" onclick="window.print()">Drukuj / zapisz jako PDF</button>
  </div>
  ${body}
</body>
</html>`;

export const buildConfirmationHandoverOverviewHtml = (input: HandoverReportInput) => {
  const generatedAt = input.generatedAt ?? new Date();
  const candidates = sortCandidates(input.candidates);
  const finishedCount = candidates.filter((candidate) => getMissingRequirements(candidate).length === 0).length;
  const annotationCount = candidates.filter((candidate) => candidate.handoverAnnotation?.trim()).length;

  const rows = candidates
    .map((candidate, index) => {
      const missing = getMissingRequirements(candidate);
      const phones = candidate.phoneNumbers.length
        ? candidate.phoneNumbers
            .map(
              (phone) =>
                `<div class="phone">${escapeHtml(phone.number)} <span class="status ${phone.isVerified ? 'yes' : 'no'}">${
                  phone.isVerified ? 'zweryfikowany' : 'niezweryfikowany'
                }</span></div>`
            )
            .join('')
        : '<span class="warning">brak numeru</span>';
      const missingHtml = missing.length
        ? `<ul>${missing.map((item) => `<li>${escapeHtml(item.label)}${item.detail ? ` (${escapeHtml(item.detail)})` : ''}</li>`).join('')}</ul>`
        : '<span class="muted">—</span>';
      return `<tr>
        <td class="number">${index + 1}</td>
        <td><strong>${escapeHtml(fullName(candidate))}</strong><br /><span class="muted">${escapeHtml(candidate.schoolShort || 'szkoła: brak danych')}</span></td>
        <td>${phones}</td>
        <td><span class="status ${missing.length === 0 ? 'yes' : 'no'}">${missing.length === 0 ? 'TAK' : 'NIE'}</span></td>
        <td>${missingHtml}</td>
        <td><span class="status ${candidate.paperConsentReceived ? 'yes' : 'no'}">${candidate.paperConsentReceived ? 'TAK' : 'NIE'}</span></td>
        <td>${candidate.handoverAnnotation?.trim() ? '<span class="status yes">JEST</span>' : '<span class="status no">BRAK</span>'}</td>
      </tr>`;
    })
    .join('');

  const body = `<main class="report-page overview-page">
    <header class="report-header">
      <div>
        <p class="report-kicker">Część I • szybki przegląd</p>
        <h1>Przekazanie przygotowania do bierzmowania</h1>
        <p>${escapeHtml(input.parishName)} • stan obliczony na ${escapeHtml(formatDateTime(generatedAt.toISOString()))}</p>
      </div>
      <div class="totals"><strong>${candidates.length}</strong> kandydatów<br /><strong>${finishedCount}</strong> zakończyło rok<br /><strong>${annotationCount}</strong> ma adnotację</div>
    </header>
    <table>
      <thead><tr><th>Lp.</th><th>Kandydat</th><th>Telefon(y)</th><th>Rok zakończony</th><th>Czego brakuje</th><th>Zgoda rodzica</th><th>Adnotacja</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">Brak kandydatów.</td></tr>'}</tbody>
    </table>
    <p class="footer-note">Status roku jest wyliczony z danych widocznych w systemie w chwili eksportu: pierwszego i drugiego spotkania, wpisanego celu, papierowej zgody rodzica, quizu oraz wybranego i uzupełnionego indeksu. Brak któregokolwiek spotkania oznacza rok niezaliczony. Weryfikacja telefonu jest pokazana informacyjnie i nie wpływa na zaliczenie roku.</p>
  </main>`;

  const html = reportDocument(
    'Bierzmowanie — przegląd zbiorczy',
    'landscape',
    body,
    generatedAt,
    `${candidates.length} kandydatów, ${finishedCount} z zakończonym rokiem`
  );

  return html.replace(
    '</style>',
    `
      .overview-page { font-size: 9px; }
      .overview-page .totals { text-align: right; font-size: 10px; line-height: 1.55; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      thead { display: table-header-group; }
      th, td { padding: 5px 6px; border: 1px solid #cfd6e0; vertical-align: top; text-align: left; }
      th { background: #e9eff7; color: #17385f; font-size: 8px; text-transform: uppercase; letter-spacing: .03em; }
      th:nth-child(1) { width: 4%; } th:nth-child(2) { width: 17%; } th:nth-child(3) { width: 17%; } th:nth-child(4) { width: 10%; } th:nth-child(5) { width: 28%; } th:nth-child(6) { width: 12%; } th:nth-child(7) { width: 12%; }
      td.number { text-align: center; }
      td ul { margin: 0; padding-left: 14px; }
      .phone + .phone { margin-top: 3px; }
      tr { break-inside: avoid; page-break-inside: avoid; }
    </style>`
  );
};

const candidateMeetingHtml = (
  candidateId: string,
  links: ParishConfirmationExportMeetingLink[],
  slotsById: Map<string, ParishConfirmationExportMeetingSlot>
) => {
  const candidateLinks = links
    .filter((link) => link.candidateId === candidateId)
    .sort((left, right) => {
      const stageOrder = meetingStageOrder(left.stage) - meetingStageOrder(right.stage);
      if (stageOrder !== 0) return stageOrder;
      const leftStart = left.slotId ? slotsById.get(left.slotId)?.startsAtUtc ?? '' : '';
      const rightStart = right.slotId ? slotsById.get(right.slotId)?.startsAtUtc ?? '' : '';
      return leftStart.localeCompare(rightStart);
    });
  if (candidateLinks.length === 0) return '<p class="warning">Brak danych o spotkaniach.</p>';

  return `<ul class="compact-list">${candidateLinks
    .map((link) => {
      const slot = link.slotId ? slotsById.get(link.slotId) : undefined;
      const value = slot
        ? `${formatDateTime(slot.startsAtUtc)}${slot.label?.trim() ? ` • ${escapeHtml(slot.label)}` : ''}`
        : '<span class="warning">brak wybranego terminu</span>';
      return `<li><strong>${escapeHtml(meetingStageLabel(link.stage))}:</strong> ${value}</li>`;
    })
    .join('')}</ul>`;
};

const celebrationLabel = (celebration?: ParishConfirmationExportCelebration) =>
  celebration
    ? `${formatDate(celebration.startsAtUtc)} — ${celebration.name}`
    : 'Celebracja archiwalna bez dostępnej nazwy';

const candidateCelebrationsHtml = (
  candidate: ParishConfirmationCandidate,
  participations: ParishConfirmationExportCelebrationParticipation[],
  celebrations: ParishConfirmationExportCelebration[]
) => {
  const celebrationById = new Map(celebrations.map((item) => [item.id, item]));
  const candidateEntries = participations.filter((item) => item.candidateId === candidate.id);
  const grouped = groupTextEntries(
    candidateEntries,
    (item) => item.commentText,
    (item) => celebrationLabel(celebrationById.get(item.celebrationId)),
    (item) => item.updatedUtc
  );
  const entryIds = new Set(candidateEntries.map((item) => item.celebrationId));
  const missingActive = candidate.useInternetIndex
    ? celebrations.filter((item) => item.isActive && !entryIds.has(item.id))
    : [];

  const paperNotice = candidate.usePaperIndex
    ? candidate.useInternetIndex
      ? `<p class="paper-notice">Wybrano również indeks papierowy (${candidate.paperIndexChecked ? 'sprawdzony' : 'jeszcze niesprawdzony'}). Ponieważ wybrano także indeks internetowy, wpisy online pozostają wymagane.</p>`
      : `<p class="paper-notice">Indeks papierowy: <strong>${candidate.paperIndexChecked ? 'sprawdzony' : 'jeszcze niesprawdzony'}</strong>. Brak wpisu online nie jest tu traktowany jako brak celebracji; poniżej pokazano wyłącznie dodatkowe wpisy rzeczywiście zapisane w systemie.</p>`
    : '';

  const onlineSummary = candidate.useInternetIndex
    ? `<p><strong>Indeks internetowy:</strong> ${candidate.internetIndexCelebrationFilled ?? 0} z ${candidate.internetIndexCelebrationTotal ?? 0} wymaganych wpisów.</p>`
    : !candidate.usePaperIndex
      ? '<p class="warning">Nie wybrano rodzaju indeksu.</p>'
      : '';

  const answers = grouped.length
    ? `<ul class="entry-list">${grouped
        .map(
          (group) => `<li><div><strong>Odpowiedź${group.count > 1 ? ` ×${group.count}` : ''}:</strong> ${multilineHtml(group.text)}</div>${
            group.labels.length
              ? `<div class="entry-context">${group.labels.map(escapeHtml).join(' • ')}</div>`
              : ''
          }</li>`
        )
        .join('')}</ul>`
    : '<p class="muted">Brak zapisanych wpisów online.</p>';

  const missing = candidate.useInternetIndex && missingActive.length
    ? `<p class="warning">Brak wpisu przy: ${missingActive.map((item) => escapeHtml(celebrationLabel(item))).join('; ')}.</p>`
    : '';

  return `${onlineSummary}${paperNotice}${answers}${missing}`;
};

const candidateEventsHtml = (candidateId: string, events: ParishConfirmationEvent[]) => {
  const rows = events.flatMap((event) =>
    (event.joins ?? [])
      .filter((join) => join.candidateId === candidateId)
      .map((join) => ({ event, join }))
  );
  if (rows.length === 0) return '<p class="muted">Brak zgłoszeń na dodatkowe wydarzenia.</p>';
  return `<ul class="compact-list">${rows
    .map(
      ({ event, join }) =>
        `<li><strong>${escapeHtml(formatDate(event.startsAtUtc))} — ${escapeHtml(event.name)}:</strong> ${escapeHtml(eventJoinStatusLabel(join.status))}</li>`
    )
    .join('')}</ul>`;
};

const candidateNotesHtml = (candidateId: string, notes: ParishConfirmationExportNote[]) => {
  const entries = notes
    .filter((note) => note.candidateId === candidateId)
    .sort((left, right) => right.updatedUtc.localeCompare(left.updatedUtc));
  const groups = groupTextEntries(
    entries,
    (note) => note.noteText,
    (note) => (note.isPublic ? 'publiczna' : 'prywatna'),
    (note) => note.updatedUtc
  );
  if (groups.length === 0) return '<p class="muted">Brak dodatkowych adnotacji.</p>';
  return `<ul class="entry-list">${groups
    .map(
      (group) => `<li>${multilineHtml(group.text)}${group.count > 1 ? ` <span class="status neutral">×${group.count}</span>` : ''}<div class="entry-context">${escapeHtml(group.labels.join(' / '))}${group.lastUtc ? ` • ${escapeHtml(formatDate(group.lastUtc))}` : ''}</div></li>`
    )
    .join('')}</ul>`;
};

const candidateMessagesHtml = (candidateId: string, messages: ParishConfirmationExportMessage[]) => {
  const entries = messages.filter((message) => message.candidateId === candidateId);
  const groupsBySender = new Map<string, ParishConfirmationExportMessage[]>();
  entries.forEach((message) => {
    const key = `${message.senderType}:${normalizedTextKey(message.messageText)}`;
    const list = groupsBySender.get(key) ?? [];
    list.push(message);
    groupsBySender.set(key, list);
  });
  const groups = [...groupsBySender.values()]
    .map((items) => ({
      senderType: items[0]?.senderType ?? '',
      text: items[0]?.messageText ?? '',
      count: items.length,
      firstUtc: items.map((item) => item.createdUtc).sort()[0],
      lastUtc: items.map((item) => item.createdUtc).sort()[items.length - 1]
    }))
    .sort((left, right) => (left.firstUtc ?? '').localeCompare(right.firstUtc ?? ''));
  if (groups.length === 0) return '<p class="muted">Brak wiadomości w portalu.</p>';
  return `<ul class="entry-list">${groups
    .map(
      (group) => `<li><strong>${group.senderType === 'admin' ? 'Parafia' : 'Kandydat'}:</strong> ${multilineHtml(group.text)}${group.count > 1 ? ` <span class="status neutral">×${group.count}</span>` : ''}<div class="entry-context">${escapeHtml(formatDate(group.firstUtc))}${group.lastUtc && group.lastUtc !== group.firstUtc ? `–${escapeHtml(formatDate(group.lastUtc))}` : ''}</div></li>`
    )
    .join('')}</ul>`;
};

export const buildConfirmationHandoverCandidatesHtml = (input: HandoverReportInput) => {
  const generatedAt = input.generatedAt ?? new Date();
  const candidates = sortCandidates(input.candidates);
  const exportPayload = input.exportPayload;
  const notes = exportPayload.notes ?? [];
  const messages = exportPayload.messages ?? [];
  const participations = exportPayload.celebrationParticipations ?? [];
  const celebrations = exportPayload.celebrations ?? [];
  const meetingLinks = exportPayload.meetingLinks ?? [];
  const slotsById = new Map((exportPayload.meetingSlots ?? []).map((slot) => [slot.id, slot]));

  const candidatePages = candidates
    .map((candidate, index) => {
      const requirements = getConfirmationHandoverRequirements(candidate);
      const missing = requirements.filter((item) => item.applicable && !item.fulfilled);
      const phones = candidate.phoneNumbers.length
        ? `<ul class="compact-list">${candidate.phoneNumbers
            .map(
              (phone) => `<li>${escapeHtml(phone.number)} <span class="status ${phone.isVerified ? 'yes' : 'no'}">${
                phone.isVerified ? 'zweryfikowany' : 'niezweryfikowany'
              }</span></li>`
            )
            .join('')}</ul>`
        : '<p class="warning">Brak numeru telefonu.</p>';
      const checklist = `<ul class="checklist">${requirements
        .filter((item) => item.applicable)
        .map(
          (item) => `<li><span class="status ${item.fulfilled ? 'yes' : 'no'}">${item.fulfilled ? 'TAK' : 'NIE'}</span> ${escapeHtml(item.label)}${item.detail ? ` • ${escapeHtml(item.detail)}` : ''}</li>`
        )
        .join('')}</ul>`;

      return `<article class="report-page candidate-page">
        <header class="report-header">
          <div>
            <p class="report-kicker">Część II • karta kandydata ${index + 1}/${candidates.length}</p>
            <h1>${escapeHtml(fullName(candidate))}</h1>
            <p>${escapeHtml(candidate.schoolShort || 'Brak danych o szkole')} • zgłoszenie: ${escapeHtml(formatDate(candidate.createdUtc))}</p>
          </div>
          <span class="result status ${missing.length === 0 ? 'yes' : 'no'}">${missing.length === 0 ? 'ROK ZAKOŃCZONY' : 'ROK NIEZAKOŃCZONY'}</span>
        </header>

        <section class="handover-note ${candidate.handoverAnnotation?.trim() ? '' : 'is-missing'}">
          <h2>Krótka adnotacja dla następnego duszpasterza</h2>
          ${candidate.handoverAnnotation?.trim() ? `<p>${multilineHtml(candidate.handoverAnnotation)}</p>` : '<p class="warning">Nie dodano jeszcze adnotacji przekazania.</p>'}
        </section>

        <div class="detail-grid">
          <section>
            <h2>Dane i kontakt</h2>
            <dl><dt>Adres</dt><dd>${escapeHtml(candidate.address || '—')}</dd><dt>Telefon(y)</dt><dd>${phones}</dd><dt>RODO przy zgłoszeniu</dt><dd>${candidate.acceptedRodo ? 'zaakceptowane' : 'brak potwierdzenia'}</dd><dt>Papierowa zgoda rodzica</dt><dd><span class="status ${candidate.paperConsentReceived ? 'yes' : 'no'}">${candidate.paperConsentReceived ? 'dostarczona' : 'niedostarczona'}</span></dd></dl>
          </section>
          <section>
            <h2>Wynik pierwszego roku</h2>
            ${missing.length ? `<p class="warning">Braki: ${missing.map((item) => escapeHtml(item.label)).join(', ')}.</p>` : '<p><span class="status yes">Wszystkie wymagania spełnione</span></p>'}
            ${checklist}
          </section>
          <section>
            <h2>Cel bierzmowania</h2>
            ${candidate.goal?.trim() ? `<p>${multilineHtml(candidate.goal)}</p>` : '<p class="warning">Nie wpisano celu.</p>'}
            <p class="section-note">Wpisanie celu jest wymaganiem roku; raport nie ocenia, czy cel został już osiągnięty.</p>
          </section>
          <section>
            <h2>Spotkania</h2>
            ${candidateMeetingHtml(candidate.id, meetingLinks, slotsById)}
          </section>
          <section class="wide">
            <h2>Indeks i celebracje</h2>
            <p><strong>Wybrany sposób dokumentowania:</strong> ${escapeHtml(getIndexSummary(candidate))}</p>
            ${candidateCelebrationsHtml(candidate, participations, celebrations)}
          </section>
          <section>
            <h2>Dodatkowe wydarzenia</h2>
            ${candidateEventsHtml(candidate.id, input.events)}
          </section>
          <section>
            <h2>Dodatkowe adnotacje</h2>
            ${candidateNotesHtml(candidate.id, notes)}
          </section>
          <section class="wide flow-section">
            <h2>Historia wiadomości w portalu</h2>
            ${candidateMessagesHtml(candidate.id, messages)}
          </section>
        </div>
        <p class="footer-note">Stan danych: ${escapeHtml(formatDateTime(generatedAt.toISOString()))}. Raport nie zawiera tokenów dostępu, kodów zaproszeń ani identyfikatorów technicznych.</p>
      </article>`;
    })
    .join('');

  const body = candidatePages || '<main class="report-page"><p>Brak kandydatów.</p></main>';
  const missingAnnotations = candidates.filter((candidate) => !candidate.handoverAnnotation?.trim()).length;
  const html = reportDocument(
    'Bierzmowanie — karty kandydatów',
    'portrait',
    body,
    generatedAt,
    `${candidates.length} kart, ${missingAnnotations} bez krótkiej adnotacji`
  );

  return html.replace(
    '</style>',
    `
      .candidate-page { font-size: 9px; break-after: page; page-break-after: always; }
      .candidate-page:last-of-type { break-after: auto; page-break-after: auto; }
      .candidate-page .report-header { margin-bottom: 4mm; }
      .candidate-page .result { font-size: 9px; padding: 4px 9px; }
      h2 { margin: 0 0 5px; color: #244b7a; font-size: 11px; }
      p { margin: 0 0 5px; }
      .handover-note { margin-bottom: 4mm; padding: 3mm 4mm; border: 1px solid #8eb2d8; border-left: 4px solid #244b7a; border-radius: 7px; background: #f2f7fc; }
      .handover-note.is-missing { border-color: #df9a8f; border-left-color: #b64135; background: #fff5f3; }
      .handover-note p { margin: 0; font-size: 10px; }
      .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; align-items: start; }
      .detail-grid > section { padding: 3mm; border: 1px solid #d5dce6; border-radius: 7px; break-inside: avoid-page; }
      .detail-grid > section.wide { grid-column: 1 / -1; }
      .detail-grid > section.flow-section { break-inside: auto; }
      dl { display: grid; grid-template-columns: 35% 1fr; gap: 3px 8px; margin: 0; }
      dt { color: #59687b; font-weight: 700; }
      dd { margin: 0; }
      .compact-list, .checklist, .entry-list { margin: 0; padding-left: 16px; }
      .compact-list li, .checklist li, .entry-list li { margin: 0 0 3px; }
      .checklist { list-style: none; padding-left: 0; }
      .paper-notice { margin: 5px 0; padding: 5px 7px; border-left: 3px solid #bd8b36; background: #fff8e8; }
      .entry-context, .section-note { margin-top: 2px; color: #687689; font-size: 8px; }
      @media print { .candidate-page { break-after: page; page-break-after: always; } .candidate-page:last-of-type { break-after: auto; page-break-after: auto; } }
    </style>`
  );
};
