type ParticipantMode = 'solo_independent' | 'single_shared' | 'groups' | 'groups_subgroups';

type ParticipantSettings = {
  mode: ParticipantMode;
  allowUngroupedParticipants: boolean;
  allowSelfRegistration: boolean;
  groupsCanAddMembers: boolean;
  groupAdminsEnabled: boolean;
};

type SessionSubgroupTemplate = {
  subgroupKey: string;
  displayName: string;
  capacity?: number;
  canAddMembers?: boolean;
  adminIds?: string[];
};

type SessionGroupTemplate = {
  groupKey: string;
  displayName: string;
  capacity?: number;
  canAddMembers?: boolean;
  adminIds?: string[];
  subgroups?: SessionSubgroupTemplate[];
};

function parseJsonObject<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toCommaList(values: string[] | undefined): string {
  return (values ?? []).join(', ');
}

function defaultParticipantMode(gameMode: string): ParticipantMode {
  const normalized = gameMode.trim().toLowerCase();
  if (normalized === 'solo') return 'solo_independent';
  if (normalized === 'group') return 'groups';
  return 'groups';
}

function normalizeSettings(raw: unknown, gameMode: string): ParticipantSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const mode = String(source.mode ?? defaultParticipantMode(gameMode)) as ParticipantMode;
  return {
    mode:
      mode === 'solo_independent' || mode === 'single_shared' || mode === 'groups' || mode === 'groups_subgroups'
        ? mode
        : 'groups',
    allowUngroupedParticipants: Boolean(source.allowUngroupedParticipants ?? false),
    allowSelfRegistration: Boolean(source.allowSelfRegistration ?? true),
    groupsCanAddMembers: Boolean(source.groupsCanAddMembers ?? false),
    groupAdminsEnabled: Boolean(source.groupAdminsEnabled ?? true)
  };
}

function normalizeGroups(raw: unknown): SessionGroupTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const root = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const subgroupRaw = Array.isArray(root.subgroups) ? root.subgroups : [];
    return {
      groupKey: String(root.groupKey ?? `group-${index + 1}`),
      displayName: String(root.displayName ?? `Group ${index + 1}`),
      capacity: typeof root.capacity === 'number' ? root.capacity : undefined,
      canAddMembers: Boolean(root.canAddMembers ?? false),
      adminIds: Array.isArray(root.adminIds) ? root.adminIds.map((value) => String(value)) : [],
      subgroups: subgroupRaw.map((subgroup, subgroupIndex) => {
        const sub = subgroup && typeof subgroup === 'object' ? (subgroup as Record<string, unknown>) : {};
        return {
          subgroupKey: String(sub.subgroupKey ?? `subgroup-${subgroupIndex + 1}`),
          displayName: String(sub.displayName ?? `Subgroup ${subgroupIndex + 1}`),
          capacity: typeof sub.capacity === 'number' ? sub.capacity : undefined,
          canAddMembers: Boolean(sub.canAddMembers ?? false),
          adminIds: Array.isArray(sub.adminIds) ? sub.adminIds.map((value) => String(value)) : []
        };
      })
    };
  });
}

export function CogitaGameParticipants({
  details,
  onDetailsChange,
  onSaveGame,
  sessionGroupsText,
  sessionZonesText,
  onSessionGroupsTextChange,
  onSessionZonesTextChange
}: {
  details: { name: string; mode: string; settingsText: string } | null;
  onDetailsChange: (next: { name: string; mode: string; settingsText: string } | null) => void;
  onSaveGame: () => void;
  sessionGroupsText: string;
  sessionZonesText: string;
  onSessionGroupsTextChange: (value: string) => void;
  onSessionZonesTextChange: (value: string) => void;
}) {
  if (!details) {
    return <p>Loading participant settings...</p>;
  }

  const settingsRoot = parseJsonObject<Record<string, unknown>>(details.settingsText, {});
  const participantSettings = normalizeSettings(settingsRoot.participants, details.mode);
  const groups = normalizeGroups(parseJsonObject<unknown>(sessionGroupsText, []));

  const updateParticipantSettings = (next: ParticipantSettings) => {
    const nextRoot = {
      ...settingsRoot,
      participants: next
    };
    onDetailsChange({
      ...details,
      settingsText: JSON.stringify(nextRoot, null, 2)
    });
  };

  const updateGroups = (next: SessionGroupTemplate[]) => {
    onSessionGroupsTextChange(JSON.stringify(next, null, 2));
  };

  const updateGroupAt = (groupIndex: number, updater: (group: SessionGroupTemplate) => SessionGroupTemplate) => {
    updateGroups(groups.map((group, index) => (index === groupIndex ? updater(group) : group)));
  };

  const canUseGroups = participantSettings.mode === 'groups' || participantSettings.mode === 'groups_subgroups';

  return (
    <div style={{ display: 'grid', gap: '0.9rem', maxWidth: 980 }}>
      <div className="cogita-panel" style={{ display: 'grid', gap: '0.6rem' }}>
        <h3 style={{ margin: 0 }}>Participant Model</h3>
        <label>
          Participant mode
          <select
            className="cogita-input"
            value={participantSettings.mode}
            onChange={(event) =>
              updateParticipantSettings({
                ...participantSettings,
                mode: event.target.value as ParticipantMode
              })
            }
          >
            <option value="solo_independent">Single users, independent sessions</option>
            <option value="single_shared">Single users, one shared game session</option>
            <option value="groups">Groups</option>
            <option value="groups_subgroups">Groups with subgroups</option>
          </select>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={participantSettings.allowUngroupedParticipants}
            onChange={(event) =>
              updateParticipantSettings({
                ...participantSettings,
                allowUngroupedParticipants: event.target.checked
              })
            }
          />
          Allow participants without group assignment
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={participantSettings.allowSelfRegistration}
            onChange={(event) =>
              updateParticipantSettings({
                ...participantSettings,
                allowSelfRegistration: event.target.checked
              })
            }
          />
          Allow participants to join by themselves
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={participantSettings.groupAdminsEnabled}
            onChange={(event) =>
              updateParticipantSettings({
                ...participantSettings,
                groupAdminsEnabled: event.target.checked
              })
            }
          />
          Enable group admins
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={participantSettings.groupsCanAddMembers}
            onChange={(event) =>
              updateParticipantSettings({
                ...participantSettings,
                groupsCanAddMembers: event.target.checked
              })
            }
          />
          Groups can add new members
        </label>
      </div>

      {canUseGroups ? (
        <div className="cogita-panel" style={{ display: 'grid', gap: '0.7rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Groups / Subgroups</h3>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                updateGroups([
                  ...groups,
                  {
                    groupKey: `group-${groups.length + 1}`,
                    displayName: `Group ${groups.length + 1}`,
                    capacity: 8,
                    canAddMembers: participantSettings.groupsCanAddMembers,
                    adminIds: [],
                    subgroups: []
                  }
                ])
              }
            >
              Add Group
            </button>
          </div>

          {groups.map((group, groupIndex) => (
            <div key={`${group.groupKey}:${groupIndex}`} style={{ border: '1px solid #e4e4e4', borderRadius: 8, padding: '0.75rem', display: 'grid', gap: '0.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: '0.5rem' }}>
                <label>
                  Group key
                  <input
                    className="cogita-input"
                    value={group.groupKey}
                    onChange={(event) =>
                      updateGroupAt(groupIndex, (current) => ({ ...current, groupKey: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Display name
                  <input
                    className="cogita-input"
                    value={group.displayName}
                    onChange={(event) =>
                      updateGroupAt(groupIndex, (current) => ({ ...current, displayName: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Capacity
                  <input
                    className="cogita-input"
                    value={String(group.capacity ?? '')}
                    onChange={(event) =>
                      updateGroupAt(groupIndex, (current) => ({ ...current, capacity: parseNumber(event.target.value) }))
                    }
                  />
                </label>
              </div>

              {participantSettings.groupAdminsEnabled ? (
                <label>
                  Group admins (comma-separated IDs/emails)
                  <input
                    className="cogita-input"
                    value={toCommaList(group.adminIds)}
                    onChange={(event) =>
                      updateGroupAt(groupIndex, (current) => ({ ...current, adminIds: parseCommaList(event.target.value) }))
                    }
                  />
                </label>
              ) : null}

              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={Boolean(group.canAddMembers)}
                  onChange={(event) =>
                    updateGroupAt(groupIndex, (current) => ({ ...current, canAddMembers: event.target.checked }))
                  }
                />
                This group can add members
              </label>

              {participantSettings.mode === 'groups_subgroups' ? (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>Subgroups</strong>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() =>
                        updateGroupAt(groupIndex, (current) => ({
                          ...current,
                          subgroups: [
                            ...(current.subgroups ?? []),
                            {
                              subgroupKey: `subgroup-${(current.subgroups ?? []).length + 1}`,
                              displayName: `Subgroup ${(current.subgroups ?? []).length + 1}`,
                              capacity: 4,
                              canAddMembers: current.canAddMembers ?? false,
                              adminIds: []
                            }
                          ]
                        }))
                      }
                    >
                      Add Subgroup
                    </button>
                  </div>

                  {(group.subgroups ?? []).map((subgroup, subgroupIndex) => (
                    <div key={`${subgroup.subgroupKey}:${subgroupIndex}`} style={{ border: '1px dashed #d0d0d0', borderRadius: 8, padding: '0.6rem', display: 'grid', gap: '0.4rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: '0.5rem' }}>
                        <label>
                          Subgroup key
                          <input
                            className="cogita-input"
                            value={subgroup.subgroupKey}
                            onChange={(event) =>
                              updateGroupAt(groupIndex, (current) => ({
                                ...current,
                                subgroups: (current.subgroups ?? []).map((item, index) =>
                                  index === subgroupIndex ? { ...item, subgroupKey: event.target.value } : item
                                )
                              }))
                            }
                          />
                        </label>
                        <label>
                          Display name
                          <input
                            className="cogita-input"
                            value={subgroup.displayName}
                            onChange={(event) =>
                              updateGroupAt(groupIndex, (current) => ({
                                ...current,
                                subgroups: (current.subgroups ?? []).map((item, index) =>
                                  index === subgroupIndex ? { ...item, displayName: event.target.value } : item
                                )
                              }))
                            }
                          />
                        </label>
                        <label>
                          Capacity
                          <input
                            className="cogita-input"
                            value={String(subgroup.capacity ?? '')}
                            onChange={(event) =>
                              updateGroupAt(groupIndex, (current) => ({
                                ...current,
                                subgroups: (current.subgroups ?? []).map((item, index) =>
                                  index === subgroupIndex ? { ...item, capacity: parseNumber(event.target.value) } : item
                                )
                              }))
                            }
                          />
                        </label>
                      </div>
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(subgroup.canAddMembers)}
                          onChange={(event) =>
                            updateGroupAt(groupIndex, (current) => ({
                              ...current,
                              subgroups: (current.subgroups ?? []).map((item, index) =>
                                index === subgroupIndex ? { ...item, canAddMembers: event.target.checked } : item
                              )
                            }))
                          }
                        />
                        Subgroup can add members
                      </label>
                      {participantSettings.groupAdminsEnabled ? (
                        <label>
                          Subgroup admins (comma-separated IDs/emails)
                          <input
                            className="cogita-input"
                            value={toCommaList(subgroup.adminIds)}
                            onChange={(event) =>
                              updateGroupAt(groupIndex, (current) => ({
                                ...current,
                                subgroups: (current.subgroups ?? []).map((item, index) =>
                                  index === subgroupIndex ? { ...item, adminIds: parseCommaList(event.target.value) } : item
                                )
                              }))
                            }
                          />
                        </label>
                      ) : null}
                      <div>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            updateGroupAt(groupIndex, (current) => ({
                              ...current,
                              subgroups: (current.subgroups ?? []).filter((_, index) => index !== subgroupIndex)
                            }))
                          }
                        >
                          Remove Subgroup
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => updateGroups(groups.filter((_, index) => index !== groupIndex))}
                >
                  Remove Group
                </button>
              </div>
            </div>
          ))}

          {groups.length === 0 ? <p>No groups configured yet.</p> : null}
        </div>
      ) : (
        <div className="cogita-panel">
          <p>This participant mode does not require groups.</p>
        </div>
      )}

      <div className="cogita-panel" style={{ display: 'grid', gap: '0.6rem', maxWidth: 880 }}>
        <p>Session zone template JSON</p>
        <textarea
          className="cogita-input"
          style={{ minHeight: 180, fontFamily: 'monospace' }}
          value={sessionZonesText}
          onChange={(event) => onSessionZonesTextChange(event.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="cta" onClick={onSaveGame}>Save Participant Settings</button>
      </div>
    </div>
  );
}
