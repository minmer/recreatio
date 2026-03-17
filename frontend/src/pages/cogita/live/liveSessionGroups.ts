const MAX_GROUP_NAME_LENGTH = 120;

export function normalizeLiveParticipantGroupName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_GROUP_NAME_LENGTH ? trimmed.slice(0, MAX_GROUP_NAME_LENGTH) : trimmed;
}

export function parseLiveParticipantGroups(settings: unknown): string[] {
  const root = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
  const rawCandidate =
    (Array.isArray(root.participantGroups) ? root.participantGroups : null) ??
    (Array.isArray(root.groups) ? root.groups : null) ??
    (Array.isArray(root.classes) ? root.classes : null);

  if (!rawCandidate) return [];

  const result: string[] = [];
  const seen = new Set<string>();
  rawCandidate.forEach((entry) => {
    const normalized = normalizeLiveParticipantGroupName(entry);
    if (!normalized) return;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result;
}

export function parseLiveParticipantGroupsText(text: string): string[] {
  if (!text.trim()) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  text
    .split(/\r?\n/)
    .map((line) => normalizeLiveParticipantGroupName(line))
    .forEach((normalized) => {
      if (!normalized) return;
      const key = normalized.toLocaleLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push(normalized);
    });
  return result;
}

export function formatLiveParticipantGroupsText(groups: readonly string[]): string {
  return groups.join('\n');
}

export function withLiveParticipantGroups(
  baseSettings: Record<string, unknown>,
  groups: readonly string[]
): Record<string, unknown> {
  if (groups.length === 0) {
    const { participantGroups: _participantGroups, groups: _groups, classes: _classes, ...rest } = baseSettings;
    return rest;
  }

  return {
    ...baseSettings,
    participantGroups: groups
  };
}
