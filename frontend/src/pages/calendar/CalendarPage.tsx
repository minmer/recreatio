import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import {
  ApiError,
  archiveCalendarItem,
  bindCalendarRole,
  completeCalendarTask,
  completeCalendarTaskAndRunGraph,
  createCalendar,
  createCalendarEventGroup,
  createCalendarEventGroupShare,
  createCalendarItem,
  createCalendarShare,
  createWeeklyCalendarSeries,
  executeCalendarGraph,
  getCalendar,
  getCalendarEvents,
  getCalendarGraph,
  getCalendarGraphs,
  getCalendarGraphExecutions,
  getCalendarGraphTemplates,
  getCalendarItem,
  getCalendars,
  getPublicSharedCalendarGroup,
  getPublicSharedCalendarItem,
  getRoles,
  listCalendarEventGroups,
  listCalendarEventGroupShares,
  listCalendarShares,
  linkCalendarEventGraph,
  revokeCalendarEventGroupShare,
  revokeCalendarShare,
  unbindCalendarRole,
  upsertCalendarGraph,
  type CalendarConflictResponse,
  type CalendarEventResponse,
  type CalendarEventGroupShareResponse,
  type CalendarEventShare,
  type CalendarGraphExecution,
  type CalendarGraphTemplate,
  type CalendarOccurrenceResponse,
  type CalendarPublicEventResponse,
  type CalendarPublicGroupResponse,
  type CalendarRoleBindingResponse,
  type RoleResponse
} from '../../lib/api';

type ViewMode = 'month' | 'week' | 'day' | 'list';

const VIEW_MODES: ViewMode[] = ['month', 'week', 'day', 'list'];
type CalendarAccessType = 'viewer' | 'editor' | 'manager';

type ShareRoute = {
  kind: 'item' | 'group';
  code: string;
};

function parseShareRoute(pathname: string): ShareRoute | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 3 || segments[0] !== 'calendar') {
    return null;
  }

  const code = decodeURIComponent(segments[2]);
  if (segments[1] === 'shared' || segments[1] === 'public') {
    return { kind: 'item', code };
  }

  if (segments[1] === 'group-shared') {
    return { kind: 'group', code };
  }

  return null;
}

function formatUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ' UTC';
}

function rangeFromView(anchor: Date, view: ViewMode): { fromUtc: string; toUtc: string } {
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);

  if (view === 'day') {
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (view === 'week') {
    const dayOfWeek = start.getUTCDay();
    const mondayShift = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setUTCDate(start.getUTCDate() + mondayShift);
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 7);
  } else if (view === 'month') {
    start.setUTCDate(1);
    end.setTime(start.getTime());
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else {
    end.setUTCDate(end.getUTCDate() + 30);
  }

  return { fromUtc: start.toISOString(), toUtc: end.toISOString() };
}

function shiftAnchor(anchor: Date, view: ViewMode, direction: -1 | 1): Date {
  const next = new Date(anchor);
  if (view === 'day') next.setUTCDate(next.getUTCDate() + direction);
  else if (view === 'week') next.setUTCDate(next.getUTCDate() + direction * 7);
  else if (view === 'month') next.setUTCMonth(next.getUTCMonth() + direction);
  else next.setUTCDate(next.getUTCDate() + direction * 30);
  return next;
}

function readError(error: unknown): string {
  if (error instanceof ApiError) return 'API ' + error.status + ': ' + error.message;
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function getRoleField(role: RoleResponse, fieldType: string): string {
  return role.fields.find((field) => field.fieldType.toLowerCase() === fieldType.toLowerCase())?.plainValue?.trim() ?? '';
}

function getRoleKind(role: RoleResponse): string {
  return getRoleField(role, 'role_kind').toLowerCase();
}

function getRoleLabel(role: RoleResponse): string {
  return (
    getRoleField(role, 'label') ||
    getRoleField(role, 'display_name') ||
    getRoleField(role, 'nick') ||
    getRoleField(role, 'name') ||
    role.roleId
  );
}

function isPersonRoleKind(roleKind: string): boolean {
  const kind = roleKind.trim().toLowerCase();
  return kind === 'person' || kind.endsWith('-person');
}

function isGroupRoleKind(roleKind: string): boolean {
  const kind = roleKind.trim().toLowerCase();
  return kind === 'group' || kind.endsWith('-group') || kind.includes('group');
}

export function CalendarPage({
  copy,
  onAuthAction,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange
}: {
  copy: Copy;
  onAuthAction: () => void;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
}) {
  const location = useLocation();
  const shareRoute = useMemo(() => parseShareRoute(location.pathname), [location.pathname]);

  const [error, setError] = useState<string | null>(null);
  const [publicItem, setPublicItem] = useState<CalendarPublicEventResponse | null>(null);
  const [publicGroup, setPublicGroup] = useState<CalendarPublicGroupResponse | null>(null);
  const [calendars, setCalendars] = useState<Array<{ id: string; name: string }>>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [calendarRoleBindings, setCalendarRoleBindings] = useState<CalendarRoleBindingResponse[]>([]);
  const [eventGroups, setEventGroups] = useState<Array<{ eventGroupId: string; name: string }>>([]);
  const [ownerRoleId, setOwnerRoleId] = useState<string | null>(null);
  const [selectedPersonRoleId, setSelectedPersonRoleId] = useState('');
  const [selectedGroupRoleId, setSelectedGroupRoleId] = useState('');
  const [personAccessType, setPersonAccessType] = useState<CalendarAccessType>('editor');
  const [groupAccessType, setGroupAccessType] = useState<CalendarAccessType>('viewer');
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [occurrences, setOccurrences] = useState<CalendarOccurrenceResponse[]>([]);
  const [conflicts, setConflicts] = useState<CalendarConflictResponse[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventResponse | null>(null);
  const [shares, setShares] = useState<CalendarEventShare[]>([]);
  const [groupShares, setGroupShares] = useState<CalendarEventGroupShareResponse[]>([]);
  const [latestShareCode, setLatestShareCode] = useState<string | null>(null);
  const [latestGroupShareCode, setLatestGroupShareCode] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CalendarGraphTemplate[]>([]);
  const [calendarGraphs, setCalendarGraphs] = useState<Array<{
    graphId: string;
    sourceEventId: string;
    titlePublic: string;
    templateKey: string;
    status: string;
    version: number;
    updatedUtc: string;
  }>>([]);
  const [executions, setExecutions] = useState<CalendarGraphExecution[]>([]);
  const [graphTemplateKey, setGraphTemplateKey] = useState('');
  const [graphStatus, setGraphStatus] = useState<'draft' | 'active' | 'archived'>('active');
  const [graphConfigJson, setGraphConfigJson] = useState('{}');
  const [graphNodesJson, setGraphNodesJson] = useState('[]');
  const [graphEdgesJson, setGraphEdgesJson] = useState('[]');
  const [selectedReusableGraphId, setSelectedReusableGraphId] = useState('');

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [itemType, setItemType] = useState<'appointment' | 'task'>('appointment');
  const [visibility, setVisibility] = useState<'private' | 'role' | 'public'>('private');
  const [startUtcLocal, setStartUtcLocal] = useState(new Date().toISOString().slice(0, 16));
  const [endUtcLocal, setEndUtcLocal] = useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<'appointment' | 'task' | ''>('');
  const [taskStateFilter, setTaskStateFilter] = useState('');
  const [createAsWeeklySeries, setCreateAsWeeklySeries] = useState(false);
  const [seriesIntervalWeeks, setSeriesIntervalWeeks] = useState(1);
  const [seriesUntilUtcLocal, setSeriesUntilUtcLocal] = useState(new Date(Date.now() + 1000 * 60 * 60 * 24 * 56).toISOString().slice(0, 16));
  const [selectedEventGroupId, setSelectedEventGroupId] = useState('');
  const [newEventGroupName, setNewEventGroupName] = useState('');
  const [viewerRoleId, setViewerRoleId] = useState('');
  const [viewerCanSeeTitle, setViewerCanSeeTitle] = useState(true);
  const [viewerCanSeeGraph, setViewerCanSeeGraph] = useState(false);
  const [viewerScopes, setViewerScopes] = useState<Array<{ roleId: string; label: string; canSeeTitle: boolean; canSeeGraph: boolean }>>([]);

  const range = useMemo(() => rangeFromView(anchor, view), [anchor, view]);
  const shareUrl = useMemo(() => {
    if (!latestShareCode) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return origin + '/#/calendar/shared/' + encodeURIComponent(latestShareCode);
  }, [latestShareCode]);
  const groupShareUrl = useMemo(() => {
    if (!latestGroupShareCode) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return origin + '/#/calendar/group-shared/' + encodeURIComponent(latestGroupShareCode);
  }, [latestGroupShareCode]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, CalendarOccurrenceResponse[]>();
    for (const row of occurrences) {
      const day = row.occurrenceStartUtc.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(row);
      map.set(day, list);
    }
    return map;
  }, [occurrences]);

  const rolesById = useMemo(() => {
    const map = new Map<string, { roleKind: string; label: string }>();
    for (const role of roles) {
      map.set(role.roleId, { roleKind: getRoleKind(role), label: getRoleLabel(role) });
    }
    return map;
  }, [roles]);

  const personRoles = useMemo(
    () => roles
      .filter((role) => isPersonRoleKind(getRoleKind(role)))
      .map((role) => ({ roleId: role.roleId, label: getRoleLabel(role) }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    [roles]
  );

  const groupRoles = useMemo(
    () => roles
      .filter((role) => isGroupRoleKind(getRoleKind(role)))
      .map((role) => ({ roleId: role.roleId, label: getRoleLabel(role) }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    [roles]
  );

  const viewerRoleOptions = useMemo(
    () => roles
      .filter((role) => {
        const roleKind = getRoleKind(role);
        return isPersonRoleKind(roleKind) || isGroupRoleKind(roleKind);
      })
      .map((role) => ({ roleId: role.roleId, label: getRoleLabel(role) }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    [roles]
  );
  const ownerRoleOptions = viewerRoleOptions;

  const linkedPersonBindings = useMemo(
    () => calendarRoleBindings.filter((binding) => isPersonRoleKind(rolesById.get(binding.roleId)?.roleKind ?? '')),
    [calendarRoleBindings, rolesById]
  );

  const linkedGroupBindings = useMemo(
    () => calendarRoleBindings.filter((binding) => isGroupRoleKind(rolesById.get(binding.roleId)?.roleKind ?? '')),
    [calendarRoleBindings, rolesById]
  );
  const effectiveCalendarId = calendarId ?? calendars[0]?.id ?? null;
  const effectiveOwnerRoleId = ownerRoleId ?? ownerRoleOptions[0]?.roleId ?? null;

  useEffect(() => {
    if (!shareRoute) {
      setPublicItem(null);
      setPublicGroup(null);
      return;
    }

    if (shareRoute.kind === 'item') {
      getPublicSharedCalendarItem(shareRoute.code)
        .then((item) => {
          setPublicItem(item);
          setPublicGroup(null);
          setError(null);
        })
        .catch((err) => setError(readError(err)));
      return;
    }

    getPublicSharedCalendarGroup(shareRoute.code)
      .then((group) => {
        setPublicGroup(group);
        setPublicItem(null);
        setError(null);
      })
      .catch((err) => setError(readError(err)));
  }, [shareRoute]);

  useEffect(() => {
    if (!showProfileMenu || shareRoute) return;

    Promise.all([getCalendars(), getRoles(), getCalendarGraphTemplates()])
      .then(async ([calendarList, roleList, templateList]) => {
        setRoles(roleList);
        const defaultPersonRoleId = roleList.find((role) => isPersonRoleKind(getRoleKind(role)))?.roleId ?? null;
        const defaultGroupRoleId = roleList.find((role) => isGroupRoleKind(getRoleKind(role)))?.roleId ?? null;
        const defaultOwnerRoleId = defaultPersonRoleId ?? defaultGroupRoleId;
        const allowedRoleIds = new Set(
          roleList
            .filter((role) => {
              const roleKind = getRoleKind(role);
              return isPersonRoleKind(roleKind) || isGroupRoleKind(roleKind);
            })
            .map((role) => role.roleId)
        );

        let resolvedCalendars = calendarList;
        if (resolvedCalendars.length === 0 && defaultOwnerRoleId) {
          const createdCalendar = await createCalendar({
            name: 'Calendar',
            description: 'Auto-created default calendar',
            ownerRoleId: defaultOwnerRoleId
          });
          resolvedCalendars = [createdCalendar];
        }
        if (resolvedCalendars.length === 0) {
          setError('No calendar available. A person or group role is required to auto-create one.');
        } else {
          setError(null);
        }

        setCalendars(resolvedCalendars.map((row) => ({ id: row.calendarId, name: row.name })));
        setCalendarId((current) => {
          if (current && resolvedCalendars.some((calendar) => calendar.calendarId === current)) {
            return current;
          }
          return resolvedCalendars[0]?.calendarId ?? null;
        });
        setOwnerRoleId((current) => {
          if (current && allowedRoleIds.has(current)) {
            return current;
          }
          return defaultOwnerRoleId ?? null;
        });
        setSelectedPersonRoleId((current) => current || defaultPersonRoleId || '');
        setSelectedGroupRoleId((current) => current || defaultGroupRoleId || '');
        setTemplates(templateList);
        if (templateList.length > 0) {
          setGraphTemplateKey((current) => current || templateList[0].templateKey);
          setGraphConfigJson((current) => (current && current !== '{}' ? current : (templateList[0].defaultConfigJson || '{}')));
          setGraphNodesJson((current) => (current && current !== '[]' ? current : JSON.stringify(templateList[0].nodes, null, 2)));
          setGraphEdgesJson((current) => (current && current !== '[]' ? current : JSON.stringify(templateList[0].edges, null, 2)));
        }
      })
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute]);

  useEffect(() => {
    if (!showProfileMenu || !calendarId || shareRoute) {
      setCalendarRoleBindings([]);
      return;
    }

    getCalendar(calendarId)
      .then((calendar) => setCalendarRoleBindings(calendar.roleBindings ?? []))
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute, calendarId]);

  useEffect(() => {
    if (!showProfileMenu || !calendarId || shareRoute) {
      setEventGroups([]);
      setSelectedEventGroupId('');
      return;
    }

    listCalendarEventGroups(calendarId)
      .then((items) => {
        setEventGroups(items.map((item) => ({ eventGroupId: item.eventGroupId, name: item.name })));
      })
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute, calendarId]);

  useEffect(() => {
    if (!showProfileMenu || !calendarId || shareRoute) {
      setCalendarGraphs([]);
      setSelectedReusableGraphId('');
      return;
    }

    getCalendarGraphs(calendarId)
      .then((graphs) => setCalendarGraphs(graphs))
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute, calendarId]);

  useEffect(() => {
    if (!showProfileMenu || !calendarId || shareRoute) return;

    getCalendarEvents({
      calendarId,
      view,
      fromUtc: range.fromUtc,
      toUtc: range.toUtc,
      status: statusFilter || undefined,
      visibility: visibilityFilter || undefined,
      itemType: itemTypeFilter || undefined,
      taskState: taskStateFilter || undefined,
      includeProtected: true
    })
      .then((bundle) => {
        setOccurrences(bundle.occurrences);
        setConflicts(bundle.conflicts);
        setSelectedEventId((current) => current ?? (bundle.occurrences[0]?.eventId ?? null));
      })
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute, calendarId, range.fromUtc, range.toUtc, view, statusFilter, visibilityFilter, itemTypeFilter, taskStateFilter]);

  useEffect(() => {
    if (!selectedEventId || shareRoute || !showProfileMenu) {
      setSelectedEvent(null);
      return;
    }

    Promise.allSettled([
      getCalendarItem(selectedEventId, true),
      listCalendarShares(selectedEventId),
      getCalendarGraphExecutions(selectedEventId, 20),
      getCalendarGraph(selectedEventId)
    ]).then((results) => {
      if (results[0].status === 'fulfilled') setSelectedEvent(results[0].value);
      if (results[1].status === 'fulfilled') setShares(results[1].value);
      if (results[2].status === 'fulfilled') setExecutions(results[2].value);
      if (results[3].status === 'fulfilled') {
        const graph = results[3].value;
        setGraphTemplateKey(graph.templateKey);
        setGraphStatus(graph.status === 'draft' || graph.status === 'archived' ? graph.status : 'active');
        setGraphConfigJson(graph.templateConfigJson || '{}');
        setGraphNodesJson(JSON.stringify(graph.nodes, null, 2));
        setGraphEdgesJson(JSON.stringify(graph.edges, null, 2));
      }
    });
  }, [selectedEventId, shareRoute, showProfileMenu]);

  useEffect(() => {
    if (!showProfileMenu || shareRoute || !selectedEventGroupId) {
      setGroupShares([]);
      return;
    }

    listCalendarEventGroupShares(selectedEventGroupId)
      .then((items) => setGroupShares(items))
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute, selectedEventGroupId]);

  useEffect(() => {
    setLatestGroupShareCode(null);
  }, [selectedEventGroupId]);

  useEffect(() => {
    if (itemType !== 'appointment') {
      setCreateAsWeeklySeries(false);
    }
  }, [itemType]);

  const applyTemplate = (templateKey: string) => {
    const template = templates.find((entry) => entry.templateKey === templateKey);
    if (!template) return;
    setGraphTemplateKey(template.templateKey);
    setGraphConfigJson(template.defaultConfigJson || '{}');
    setGraphNodesJson(JSON.stringify(template.nodes, null, 2));
    setGraphEdgesJson(JSON.stringify(template.edges, null, 2));
    setGraphStatus('active');
  };

  const refresh = () => {
    if (!calendarId) return;
    getCalendarEvents({
      calendarId,
      view,
      fromUtc: range.fromUtc,
      toUtc: range.toUtc,
      status: statusFilter || undefined,
      visibility: visibilityFilter || undefined,
      itemType: itemTypeFilter || undefined,
      taskState: taskStateFilter || undefined,
      includeProtected: true
    })
      .then((bundle) => {
        setOccurrences(bundle.occurrences);
        setConflicts(bundle.conflicts);
      })
      .catch((err) => setError(readError(err)));
  };

  const createItem = async () => {
    const activeCalendarId = effectiveCalendarId;
    const activeOwnerRoleId = effectiveOwnerRoleId;
    if (!activeCalendarId || !activeOwnerRoleId) {
      setError('No calendar or owner role available.');
      return;
    }
    if (!calendarId && activeCalendarId) {
      setCalendarId(activeCalendarId);
    }
    if (!ownerRoleId && activeOwnerRoleId) {
      setOwnerRoleId(activeOwnerRoleId);
    }

    try {
      const parsedNodes = JSON.parse(graphNodesJson || '[]');
      const parsedEdges = JSON.parse(graphEdgesJson || '[]');
      const shouldReuseGraph = !!selectedReusableGraphId;
      const startUtc = new Date(startUtcLocal).toISOString();
      const endUtc = new Date(endUtcLocal).toISOString();

      if (createAsWeeklySeries && itemType === 'appointment') {
        if (!selectedEventGroupId) {
          setError('Weekly series requires an event group.');
          return;
        }

        await createWeeklyCalendarSeries(selectedEventGroupId, {
          ownerRoleId: activeOwnerRoleId,
          titlePublic: title,
          summaryPublic: summary || null,
          visibility,
          firstStartUtc: startUtc,
          firstEndUtc: endUtc,
          untilUtc: new Date(seriesUntilUtcLocal).toISOString(),
          intervalWeeks: Math.max(1, seriesIntervalWeeks),
          scopedRoleIds: [],
          viewerScopes: viewerScopes.map((viewer) => ({
            roleId: viewer.roleId,
            canSeeTitle: viewer.canSeeTitle,
            canSeeGraph: viewer.canSeeGraph
          })),
          graphId: shouldReuseGraph ? selectedReusableGraphId : null,
          allowConflicts: false
        });
      } else {
        const createdItem = await createCalendarItem({
          calendarId: activeCalendarId,
          eventGroupId: selectedEventGroupId || null,
          ownerRoleId: activeOwnerRoleId,
          titlePublic: title,
          summaryPublic: summary,
          visibility,
          status: 'planned',
          startUtc,
          endUtc,
          itemType,
          taskState: itemType === 'task' ? 'todo' : null,
          taskProgressPercent: itemType === 'task' ? 0 : null,
          viewerScopes: viewerScopes.map((viewer) => ({
            roleId: viewer.roleId,
            canSeeTitle: viewer.canSeeTitle,
            canSeeGraph: viewer.canSeeGraph
          })),
          graph: shouldReuseGraph
            ? null
            : {
                templateKey: graphTemplateKey || 'daily',
                status: 'active',
                templateConfigJson: graphConfigJson,
                nodes: parsedNodes,
                edges: parsedEdges
              }
        });
        if (shouldReuseGraph) {
          await linkCalendarEventGraph(createdItem.eventId, selectedReusableGraphId);
        }
      }

      setTitle('');
      setSummary('');
      setViewerScopes([]);
      setSelectedReusableGraphId('');
      refresh();
      if (activeCalendarId) {
        void getCalendarGraphs(activeCalendarId).then((graphs) => setCalendarGraphs(graphs)).catch(() => {});
      }
    } catch (err) {
      setError(readError(err));
    }
  };

  const createEventGroupNow = async () => {
    const activeCalendarId = effectiveCalendarId;
    const activeOwnerRoleId = effectiveOwnerRoleId;
    if (!activeCalendarId || !activeOwnerRoleId) {
      setError('Select calendar and owner role first.');
      return;
    }

    const name = newEventGroupName.trim();
    if (!name) {
      setError('Group name is required.');
      return;
    }

    try {
      const created = await createCalendarEventGroup(activeCalendarId, {
        name,
        ownerRoleId: activeOwnerRoleId
      });
      setEventGroups((prev) => [{ eventGroupId: created.eventGroupId, name: created.name }, ...prev]);
      setSelectedEventGroupId(created.eventGroupId);
      setNewEventGroupName('');
      setError(null);
    } catch (err) {
      setError(readError(err));
    }
  };

  const createGroupShareNow = async () => {
    if (!selectedEventGroupId) {
      setError('Select an event group first.');
      return;
    }

    try {
      const share = await createCalendarEventGroupShare(selectedEventGroupId, { mode: 'readonly', expiresInHours: 72 });
      setLatestGroupShareCode(share.code);
      const updated = await listCalendarEventGroupShares(selectedEventGroupId);
      setGroupShares(updated);
      setError(null);
    } catch (err) {
      setError(readError(err));
    }
  };

  const linkRoleToCalendar = async (roleId: string, accessType: CalendarAccessType) => {
    if (!calendarId || !roleId) {
      setError('Select a calendar and role first.');
      return;
    }

    try {
      const bindings = await bindCalendarRole(calendarId, { roleId, accessType });
      setCalendarRoleBindings(bindings);
      setError(null);
    } catch (err) {
      setError(readError(err));
    }
  };

  const unlinkRoleFromCalendar = async (roleId: string) => {
    if (!calendarId) {
      setError('Select a calendar first.');
      return;
    }

    try {
      const bindings = await unbindCalendarRole(calendarId, roleId);
      setCalendarRoleBindings(bindings);
      setError(null);
    } catch (err) {
      setError(readError(err));
    }
  };

  const addViewerScope = () => {
    if (!viewerRoleId) {
      setError('Select a viewer role first.');
      return;
    }

    const label = rolesById.get(viewerRoleId)?.label ?? viewerRoleId;
    setViewerScopes((current) => {
      const next = current.filter((entry) => entry.roleId !== viewerRoleId);
      next.push({
        roleId: viewerRoleId,
        label,
        canSeeTitle: viewerCanSeeTitle,
        canSeeGraph: viewerCanSeeGraph
      });
      return next;
    });
    setError(null);
  };

  const header = (
    <header className="calendar-header">
      <a href="/#/section-1" className="calendar-brand" onClick={() => onNavigate('home')}>REcreatio</a>
      <nav className="calendar-top-nav">
        <a href="/#/parish">{copy.nav.parish}</a>
        <a href="/#/event">{copy.nav.events}</a>
        <a href="/#/cogita">{copy.nav.cogita}</a>
        <a href="/#/chat">{copy.nav.chat}</a>
      </nav>
      <div className="calendar-header-actions">
        <LanguageSelect value={language} onChange={onLanguageChange} />
        <AuthAction
          copy={copy}
          label={authLabel}
          isAuthenticated={showProfileMenu}
          secureMode={secureMode}
          onLogin={onAuthAction}
          onProfileNavigate={onProfileNavigate}
          onToggleSecureMode={onToggleSecureMode}
          onLogout={onLogout}
          variant="ghost"
        />
      </div>
    </header>
  );

  if (shareRoute) {
    return (
      <div className="calendar-page">
        {header}
        <main className="calendar-main calendar-main-public">
          <section className="calendar-panel">
            <h1>{shareRoute.kind === 'group' ? 'Shared Calendar Group' : 'Shared Calendar Item'}</h1>
            <p>Code: {shareRoute.code}</p>
            {error && <p className="calendar-error">{error}</p>}
            {shareRoute.kind === 'item' && publicItem && (
              <div className="calendar-public-card">
                <h2>{publicItem.titlePublic}</h2>
                <p>{publicItem.summaryPublic ?? 'No summary'}</p>
                <p>{formatUtc(publicItem.startUtc)} - {formatUtc(publicItem.endUtc)}</p>
                <p>Type: {publicItem.itemType}</p>
                <p>Status: {publicItem.status}</p>
              </div>
            )}
            {shareRoute.kind === 'group' && publicGroup && (
              <div className="calendar-public-card">
                <h2>{publicGroup.name}</h2>
                <p>{publicGroup.description ?? 'No description'}</p>
                <p>Items: {publicGroup.items.length}</p>
                <ul>
                  {publicGroup.items.slice(0, 100).map((item) => (
                    <li key={item.eventId + item.startUtc}>
                      {item.titlePublic}: {formatUtc(item.startUtc)} - {formatUtc(item.endUtc)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  if (!showProfileMenu) {
    return (
      <div className="calendar-page calendar-page-guest">
        {header}
        <main className="calendar-guest-main">
          <h1>{copy.calendar.title}</h1>
          <p>{copy.calendar.subtitle}</p>
          <button type="button" className="cta" onClick={onAuthAction}>{copy.calendar.loginCta}</button>
        </main>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      {header}
      <main className="calendar-main calendar-workspace">
        <aside className="calendar-sidebar">
          <h1>{copy.calendar.title}</h1>
          <div className="calendar-field-row">
            <label>Calendar</label>
            <select value={effectiveCalendarId ?? ''} onChange={(event) => setCalendarId(event.target.value || null)}>
              {calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
            </select>
          </div>
          <div className="calendar-role-link-panel">
            <h2>Calendar role links</h2>
            <div className="calendar-field-row">
              <label>Person role</label>
              <select value={selectedPersonRoleId} onChange={(event) => setSelectedPersonRoleId(event.target.value)}>
                <option value="">select person role</option>
                {personRoles.map((role) => (
                  <option key={role.roleId} value={role.roleId}>{role.label}</option>
                ))}
              </select>
            </div>
            <div className="calendar-inline-grid">
              <select value={personAccessType} onChange={(event) => setPersonAccessType(event.target.value as CalendarAccessType)}>
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="manager">manager</option>
              </select>
              <button type="button" onClick={() => void linkRoleToCalendar(selectedPersonRoleId, personAccessType)}>Link person</button>
            </div>
            <div className="calendar-field-row">
              <label>Group role</label>
              <select value={selectedGroupRoleId} onChange={(event) => setSelectedGroupRoleId(event.target.value)}>
                <option value="">select group role</option>
                {groupRoles.map((role) => (
                  <option key={role.roleId} value={role.roleId}>{role.label}</option>
                ))}
              </select>
            </div>
            <div className="calendar-inline-grid">
              <select value={groupAccessType} onChange={(event) => setGroupAccessType(event.target.value as CalendarAccessType)}>
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="manager">manager</option>
              </select>
              <button type="button" onClick={() => void linkRoleToCalendar(selectedGroupRoleId, groupAccessType)}>Link group</button>
            </div>
            <div className="calendar-role-list-block">
              <h3>Linked persons ({linkedPersonBindings.length})</h3>
              <ul>
                {linkedPersonBindings.map((binding) => (
                  <li key={binding.bindingId}>
                    <span>{rolesById.get(binding.roleId)?.label ?? binding.roleId} / {binding.accessType}</span>
                    <button type="button" onClick={() => void unlinkRoleFromCalendar(binding.roleId)}>Unlink</button>
                  </li>
                ))}
                {linkedPersonBindings.length === 0 && <li>No person roles linked yet.</li>}
              </ul>
            </div>
            <div className="calendar-role-list-block">
              <h3>Linked groups ({linkedGroupBindings.length})</h3>
              <ul>
                {linkedGroupBindings.map((binding) => (
                  <li key={binding.bindingId}>
                    <span>{rolesById.get(binding.roleId)?.label ?? binding.roleId} / {binding.accessType}</span>
                    <button type="button" onClick={() => void unlinkRoleFromCalendar(binding.roleId)}>Unlink</button>
                  </li>
                ))}
                {linkedGroupBindings.length === 0 && <li>No group roles linked yet.</li>}
              </ul>
            </div>
          </div>
          <div className="calendar-view-switch">
            {VIEW_MODES.map((mode) => (
              <button key={mode} type="button" className={view === mode ? 'is-active' : ''} onClick={() => setView(mode)}>{mode}</button>
            ))}
          </div>
          <div className="calendar-range-nav">
            <button type="button" onClick={() => setAnchor((current) => shiftAnchor(current, view, -1))}>Previous</button>
            <button type="button" onClick={() => setAnchor(new Date())}>Today</button>
            <button type="button" onClick={() => setAnchor((current) => shiftAnchor(current, view, 1))}>Next</button>
          </div>
          <div className="calendar-field-row">
            <label>Status filter</label>
            <input value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} />
          </div>
          <div className="calendar-field-row">
            <label>Visibility filter</label>
            <input value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)} />
          </div>
          <div className="calendar-field-row">
            <label>Type filter</label>
            <select value={itemTypeFilter} onChange={(event) => setItemTypeFilter(event.target.value as '' | 'appointment' | 'task')}>
              <option value="">all</option>
              <option value="appointment">appointment</option>
              <option value="task">task</option>
            </select>
          </div>
          <div className="calendar-field-row">
            <label>Task state filter</label>
            <input value={taskStateFilter} onChange={(event) => setTaskStateFilter(event.target.value)} />
          </div>
          {error && <p className="calendar-error">{error}</p>}
        </aside>

        <section className="calendar-board-section">
          <div className="calendar-board-header">
            <h2>{view.toUpperCase()} VIEW</h2>
            <p>{formatUtc(range.fromUtc)} - {formatUtc(range.toUtc)}</p>
          </div>
          {view === 'month' && (
            <div className="calendar-month-grid">
              {Array.from(groupedByDay.keys()).sort().map((day) => (
                <article key={day} className="calendar-day-card">
                  <h3>{day}</h3>
                  <ul>
                    {(groupedByDay.get(day) ?? []).slice(0, 6).map((row) => (
                      <li key={row.eventId + '-' + row.occurrenceStartUtc}>
                        <button type="button" onClick={() => setSelectedEventId(row.eventId)}>{row.event.titlePublic} ({row.event.itemType})</button>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
          {view !== 'month' && (
            <div className="calendar-occurrence-list">
              {occurrences.map((row) => (
                <article key={row.eventId + '-' + row.occurrenceStartUtc} className={'calendar-occurrence-row' + (selectedEventId === row.eventId ? ' is-selected' : '')}>
                  <button type="button" onClick={() => setSelectedEventId(row.eventId)}>
                    <strong>{row.event.titlePublic}</strong>
                    <span>{formatUtc(row.occurrenceStartUtc)} - {formatUtc(row.occurrenceEndUtc)}</span>
                    <span>{row.event.itemType} / {row.event.status}</span>
                  </button>
                </article>
              ))}
            </div>
          )}
          <div className="calendar-conflicts">
            <h3>Conflicts ({conflicts.length})</h3>
            <ul>
              {conflicts.slice(0, 20).map((conflict) => (
                <li key={conflict.eventId + '-' + conflict.startUtc}>{conflict.titlePublic}: {formatUtc(conflict.startUtc)} - {formatUtc(conflict.endUtc)}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="calendar-detail-panel">
          <div className="calendar-create-form">
            <h2>Create item</h2>
            <div className="calendar-field-row">
              <label>Owner role</label>
              <select value={effectiveOwnerRoleId ?? ''} onChange={(event) => setOwnerRoleId(event.target.value || null)}>
                {ownerRoleOptions.map((role) => (
                  <option key={role.roleId} value={role.roleId}>{role.label}</option>
                ))}
              </select>
            </div>
            <div className="calendar-field-row">
              <label>Event group</label>
              <select value={selectedEventGroupId} onChange={(event) => setSelectedEventGroupId(event.target.value)}>
                <option value="">none</option>
                {eventGroups.map((group) => (
                  <option key={group.eventGroupId} value={group.eventGroupId}>{group.name}</option>
                ))}
              </select>
            </div>
            <div className="calendar-inline-grid">
              <input value={newEventGroupName} onChange={(event) => setNewEventGroupName(event.target.value)} placeholder="New group name" />
              <button type="button" onClick={() => void createEventGroupNow()}>Create group</button>
            </div>
            <div className="calendar-share-panel">
              <h3>Group access view</h3>
              <button type="button" disabled={!selectedEventGroupId} onClick={() => void createGroupShareNow()}>Create group share</button>
              {groupShareUrl && (
                <div className="calendar-qr-block">
                  <p>{groupShareUrl}</p>
                  <QRCodeSVG value={groupShareUrl} size={128} />
                </div>
              )}
              {groupShares.length > 0 && (
                <ul>
                  {groupShares.map((share) => (
                    <li key={share.linkId}>
                      <span>{share.label} ({share.isActive ? 'active' : 'revoked'})</span>
                      {share.isActive && selectedEventGroupId && (
                        <button
                          type="button"
                          onClick={() => void revokeCalendarEventGroupShare(selectedEventGroupId, share.linkId)
                            .then(() => listCalendarEventGroupShares(selectedEventGroupId))
                            .then(setGroupShares)
                            .catch((err) => setError(readError(err)))}
                        >
                          Revoke
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
            <textarea rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Summary" />
            <div className="calendar-inline-grid">
              <select value={itemType} onChange={(event) => setItemType(event.target.value as 'appointment' | 'task')}>
                <option value="appointment">appointment</option>
                <option value="task">task</option>
              </select>
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as 'private' | 'role' | 'public')}>
                <option value="private">private</option>
                <option value="role">role</option>
                <option value="public">public</option>
              </select>
            </div>
            <div className="calendar-inline-grid">
              <input type="datetime-local" value={startUtcLocal} onChange={(event) => setStartUtcLocal(event.target.value)} />
              <input type="datetime-local" value={endUtcLocal} onChange={(event) => setEndUtcLocal(event.target.value)} />
            </div>
            {itemType === 'appointment' && (
              <>
                <label><input type="checkbox" checked={createAsWeeklySeries} onChange={(event) => setCreateAsWeeklySeries(event.target.checked)} /> weekly series in group</label>
                {createAsWeeklySeries && (
                  <div className="calendar-inline-grid">
                    <input type="number" min={1} max={52} value={seriesIntervalWeeks} onChange={(event) => setSeriesIntervalWeeks(Number(event.target.value) || 1)} placeholder="interval weeks" />
                    <input type="datetime-local" value={seriesUntilUtcLocal} onChange={(event) => setSeriesUntilUtcLocal(event.target.value)} />
                  </div>
                )}
              </>
            )}
            <div className="calendar-field-row">
              <label>Reusable graph</label>
              <select value={selectedReusableGraphId} onChange={(event) => setSelectedReusableGraphId(event.target.value)}>
                <option value="">new graph from editor</option>
                {calendarGraphs.map((graph) => (
                  <option key={graph.graphId} value={graph.graphId}>{graph.titlePublic} ({graph.templateKey})</option>
                ))}
              </select>
            </div>
            <div className="calendar-field-row">
              <label>Viewer role</label>
              <select value={viewerRoleId} onChange={(event) => setViewerRoleId(event.target.value)}>
                <option value="">select viewer role</option>
                {viewerRoleOptions.map((role) => (
                  <option key={role.roleId} value={role.roleId}>{role.label}</option>
                ))}
              </select>
            </div>
            <div className="calendar-inline-grid">
              <label><input type="checkbox" checked={viewerCanSeeTitle} onChange={(event) => setViewerCanSeeTitle(event.target.checked)} /> title</label>
              <label><input type="checkbox" checked={viewerCanSeeGraph} onChange={(event) => setViewerCanSeeGraph(event.target.checked)} /> graph</label>
            </div>
            <button type="button" onClick={addViewerScope}>Add viewer</button>
            {viewerScopes.length > 0 && (
              <ul className="calendar-viewer-list">
                {viewerScopes.map((viewer) => (
                  <li key={viewer.roleId}>
                    <span>{viewer.label} ({viewer.canSeeTitle ? 'title' : 'appointment-only'}{viewer.canSeeGraph ? ', graph' : ''})</span>
                    <button type="button" onClick={() => setViewerScopes((current) => current.filter((entry) => entry.roleId !== viewer.roleId))}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="cta" onClick={() => void createItem()}>
              {createAsWeeklySeries && itemType === 'appointment' ? 'Create weekly series' : 'Create'}
            </button>
            {(!effectiveCalendarId || !effectiveOwnerRoleId) && (
              <p className="calendar-error">Calendar and owner role must be available before creating items.</p>
            )}
          </div>
          <h2>Item Detail</h2>
          {!selectedEvent && <p>Select an item from the board.</p>}
          {selectedEvent && (
            <>
              <h3>{selectedEvent.titlePublic}</h3>
              <p>{selectedEvent.summaryPublic ?? 'No summary'}</p>
              <p>{formatUtc(selectedEvent.startUtc)} - {formatUtc(selectedEvent.endUtc)}</p>
              <p>Type: {selectedEvent.itemType}</p>
              <p>Status: {selectedEvent.status}</p>
              {selectedEvent.taskState && <p>Task state: {selectedEvent.taskState}</p>}
              <div className="calendar-detail-actions">
                {selectedEvent.itemType === 'task' && (
                  <>
                    <button type="button" onClick={() => void completeCalendarTask(selectedEvent.eventId, { taskState: 'done' }).then(refresh).catch((err) => setError(readError(err)))}>Complete</button>
                    <button type="button" onClick={() => void completeCalendarTaskAndRunGraph(selectedEvent.eventId).then(refresh).catch((err) => setError(readError(err)))}>Complete + Run Graph</button>
                  </>
                )}
                <button type="button" onClick={() => void executeCalendarGraph(selectedEvent.eventId, { triggerType: 'manual' }).then(refresh).catch((err) => setError(readError(err)))}>Run Graph</button>
                <button type="button" onClick={() => void archiveCalendarItem(selectedEvent.eventId).then(refresh).catch((err) => setError(readError(err)))}>Archive</button>
              </div>
              <div className="calendar-share-panel">
                <h3>Graph editor</h3>
                <div className="calendar-inline-grid">
                  <select value={graphTemplateKey} onChange={(event) => applyTemplate(event.target.value)}>
                    <option value="">template</option>
                    {templates.map((template) => (
                      <option key={template.templateKey} value={template.templateKey}>{template.name}</option>
                    ))}
                  </select>
                  <select value={graphStatus} onChange={(event) => setGraphStatus(event.target.value as 'draft' | 'active' | 'archived')}>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
                <textarea rows={4} value={graphConfigJson} onChange={(event) => setGraphConfigJson(event.target.value)} placeholder="Graph config JSON" />
                <textarea rows={6} value={graphNodesJson} onChange={(event) => setGraphNodesJson(event.target.value)} placeholder="Nodes JSON" />
                <textarea rows={6} value={graphEdgesJson} onChange={(event) => setGraphEdgesJson(event.target.value)} placeholder="Edges JSON" />
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedEvent) return;
                    try {
                      const nodes = JSON.parse(graphNodesJson);
                      const edges = JSON.parse(graphEdgesJson);
                      void upsertCalendarGraph(selectedEvent.eventId, {
                        templateKey: graphTemplateKey || 'daily',
                        templateConfigJson: graphConfigJson,
                        status: graphStatus,
                        nodes,
                        edges
                      })
                        .then(() => getCalendarGraphExecutions(selectedEvent.eventId, 20))
                        .then((history) => setExecutions(history))
                        .catch((err) => setError(readError(err)));
                    } catch (err) {
                      setError(readError(err));
                    }
                  }}
                >
                  Save graph
                </button>
              </div>
              <div className="calendar-share-panel">
                <h3>Shared View + QR</h3>
                <button type="button" onClick={() => void createCalendarShare(selectedEvent.eventId, { mode: 'readonly', expiresInHours: 72 }).then((share) => {
                  setLatestShareCode(share.code);
                  return listCalendarShares(selectedEvent.eventId);
                }).then(setShares).catch((err) => setError(readError(err)))}>Create share</button>
                {shareUrl && (
                  <div className="calendar-qr-block">
                    <p>{shareUrl}</p>
                    <QRCodeSVG value={shareUrl} size={128} />
                  </div>
                )}
                <ul>
                  {shares.map((share) => (
                    <li key={share.linkId}>
                      <span>{share.label} ({share.isActive ? 'active' : 'revoked'})</span>
                      {share.isActive && <button type="button" onClick={() => void revokeCalendarShare(selectedEvent.eventId, share.linkId).then(() => listCalendarShares(selectedEvent.eventId)).then(setShares).catch((err) => setError(readError(err)))}>Revoke</button>}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="calendar-graph-history">
                <h3>Graph executions</h3>
                <ul>
                  {executions.map((execution) => (
                    <li key={execution.executionId}>
                      <span>{execution.triggerType} / {execution.status}</span>
                      <span>{formatUtc(execution.createdUtc)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
