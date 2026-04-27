import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import ReactFlow, {
  Background,
  ConnectionMode,
  ConnectionLineType,
  Controls,
  Handle,
  MarkerType,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';
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
  updateCalendarItem,
  upsertCalendarGraph,
  type CalendarConflictResponse,
  type CalendarEventResponse,
  type CalendarEventGroupShareResponse,
  type CalendarEventShare,
  type CalendarGraphExecution,
  type CalendarGraphNode,
  type CalendarGraphEdge,
  type CalendarGraphTemplate,
  type CalendarOccurrenceResponse,
  type CalendarPublicEventResponse,
  type CalendarPublicGroupResponse,
  type CalendarRoleBindingResponse,
  type RoleResponse
} from '../../lib/api';

type ViewMode = 'month' | 'week' | 'day' | 'list' | 'timeline' | 'year';

const VIEW_MODES: ViewMode[] = ['day', 'week', 'month', 'timeline', 'year', 'list'];
type CalendarAccessType = 'viewer' | 'editor' | 'manager';
const CALENDAR_PERSON_PREF_KEY = 'recreatio.calendar.personRoleId';

type ShareRoute = {
  kind: 'item' | 'group';
  code: string;
};

type GraphNodeType = 'trigger' | 'delay' | 'create_task' | 'create_appointment' | 'condition' | 'noop';
type PortValueType = 'string' | 'number' | 'date' | 'boolean' | 'json';
type PortDirection = 'in' | 'out';

type CalendarGraphPort = {
  id: string;
  label: string;
  valueType: PortValueType;
};

type CalendarGraphCanvasNodeData = {
  label: string;
  nodeType: GraphNodeType;
  nodeKey: string;
  configJson: string;
  inputs: CalendarGraphPort[];
  outputs: CalendarGraphPort[];
};

type CalendarGraphCanvasEdgeData = {
  edgeType: string;
  conditionJson: string | null;
  valueType: PortValueType;
};

type CalendarGraphCanvasNode = Node<CalendarGraphCanvasNodeData>;
type CalendarGraphCanvasEdge = Edge<CalendarGraphCanvasEdgeData>;
type CalendarItemPatchPayload = Parameters<typeof updateCalendarItem>[1];

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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return year + '-' + month + '-' + day + ' ' + hour + ':' + minute;
}

function formatDateTimeLocalInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatLocalDay(value: Date): string {
  return value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function colorForKey(key: string): string {
  const colors = ['#2e86ab', '#55a630', '#9d4edd', '#f77f00', '#ef476f', '#1f8a70', '#3a86ff', '#8f5db7', '#ff6b6b', '#f4a261'];
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(index)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 3 && normalized.length !== 6) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
  const full = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hasOpenEndedOccurrence(row: CalendarOccurrenceResponse): boolean {
  const eventEndUtc = `${(row.event as { endUtc?: string | null }).endUtc ?? ''}`.trim();
  if (!eventEndUtc) return true;
  const occurrenceEndUtc = `${row.occurrenceEndUtc ?? ''}`.trim();
  if (!occurrenceEndUtc) return true;
  const startMs = Date.parse(row.occurrenceStartUtc);
  const endMs = Date.parse(occurrenceEndUtc);
  if (!Number.isFinite(endMs)) return true;
  return Number.isFinite(startMs) && endMs <= startMs;
}

function buildEventBackground(color: string, orientation: 'vertical' | 'horizontal', isOpenEnded: boolean): string {
  if (!isOpenEnded) return color;
  if (orientation === 'vertical') {
    return `linear-gradient(180deg, ${color} 0%, ${color} 68%, ${hexToRgba(color, 0)} 100%)`;
  }
  return `linear-gradient(90deg, ${color} 0%, ${color} 70%, ${hexToRgba(color, 0)} 100%)`;
}

function makeGraphId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

const PORT_TYPE_COLORS: Record<PortValueType, string> = {
  string: '#2563eb',
  number: '#f97316',
  date: '#7c3aed',
  boolean: '#16a34a',
  json: '#334155'
};

function normalizePortId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'port';
}

function toPortLabel(value: string): string {
  return value
    .replace(/\./g, ' > ')
    .replace(/\[(\d+)\]/g, ' [$1]')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function inferPortType(key: string, value: unknown): PortValueType {
  const normalizedKey = key.toLowerCase();
  const isDateKey = normalizedKey.endsWith('utc') || normalizedKey.includes('date') || normalizedKey.includes('time') || normalizedKey.includes('start') || normalizedKey.includes('end') || normalizedKey.includes('due') || normalizedKey.includes('completed');
  const isNumberKey = normalizedKey.includes('count') || normalizedKey.includes('number') || normalizedKey.includes('percent') || normalizedKey.includes('minutes') || normalizedKey.includes('hours') || normalizedKey.includes('days') || normalizedKey.includes('weeks') || normalizedKey.includes('duration') || normalizedKey.includes('interval') || normalizedKey.includes('version');
  const isBooleanKey = normalizedKey.startsWith('is') || normalizedKey.startsWith('has') || normalizedKey.startsWith('can') || normalizedKey.includes('required') || normalizedKey.includes('enabled');

  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    if (isDateKey) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return 'date';
    }
    return 'string';
  }
  if (value === null || value === undefined) {
    if (isDateKey) return 'date';
    if (isNumberKey) return 'number';
    if (isBooleanKey) return 'boolean';
    return 'json';
  }
  if (value instanceof Date) return 'date';
  if (Array.isArray(value)) return 'json';
  if (isDateKey) return 'date';
  if (isNumberKey) return 'number';
  if (isBooleanKey) return 'boolean';
  return 'json';
}

type TriggerPortCandidate = {
  path: string;
  value: unknown;
};

function collectTriggerPortCandidates(path: string, value: unknown, output: TriggerPortCandidate[], depth = 0): void {
  if (!path) return;

  if (value === null || value === undefined || typeof value !== 'object' || value instanceof Date) {
    output.push({ path, value });
    return;
  }

  if (Array.isArray(value)) {
    output.push({ path, value });
    if (depth >= 2) {
      return;
    }
    for (let index = 0; index < value.length; index += 1) {
      collectTriggerPortCandidates(`${path}[${index}]`, value[index], output, depth + 1);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  output.push({ path, value });

  if (depth >= 2) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(record)) {
    collectTriggerPortCandidates(`${path}.${key}`, nestedValue, output, depth + 1);
  }
}

function buildTriggerPorts(eventContext: CalendarEventResponse | null): CalendarGraphPort[] {
  if (!eventContext) {
    return [{ id: 'payload', label: 'Payload', valueType: 'json' }];
  }

  const candidates: TriggerPortCandidate[] = [];
  const raw = eventContext as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw)) {
    collectTriggerPortCandidates(key, value, candidates, 0);
  }

  if (candidates.length === 0) {
    return [{ id: 'payload', label: 'Payload', valueType: 'json' }];
  }

  const dedupCounter = new Map<string, number>();
  const ports: CalendarGraphPort[] = [];
  for (const entry of candidates) {
    const baseId = normalizePortId(entry.path);
    const existingCount = dedupCounter.get(baseId) ?? 0;
    dedupCounter.set(baseId, existingCount + 1);
    const portId = existingCount === 0 ? baseId : `${baseId}_${existingCount + 1}`;
    ports.push({
      id: portId,
      label: toPortLabel(entry.path),
      valueType: inferPortType(entry.path, entry.value)
    });
  }

  ports.sort((left, right) => left.label.localeCompare(right.label));
  return ports;
}

function buildNodePorts(nodeType: GraphNodeType, eventContext: CalendarEventResponse | null): { inputs: CalendarGraphPort[]; outputs: CalendarGraphPort[] } {
  switch (nodeType) {
    case 'trigger':
      return {
        inputs: [],
        outputs: buildTriggerPorts(eventContext)
      };
    case 'delay':
      return {
        inputs: [
          { id: 'start', label: 'Start Date', valueType: 'date' },
          { id: 'days', label: 'Days', valueType: 'number' }
        ],
        outputs: [{ id: 'result', label: 'Shifted Date', valueType: 'date' }]
      };
    case 'condition':
      return {
        inputs: [
          { id: 'value', label: 'Value', valueType: 'json' },
          { id: 'rule', label: 'Rule', valueType: 'string' }
        ],
        outputs: [
          { id: 'true', label: 'When True', valueType: 'json' },
          { id: 'false', label: 'When False', valueType: 'json' }
        ]
      };
    case 'create_task':
      return {
        inputs: [
          { id: 'title', label: 'Title', valueType: 'string' },
          { id: 'summary', label: 'Summary', valueType: 'string' },
          { id: 'start_utc', label: 'Start UTC', valueType: 'date' },
          { id: 'end_utc', label: 'End UTC', valueType: 'date' },
          { id: 'task_state', label: 'Task State', valueType: 'string' },
          { id: 'progress', label: 'Progress %', valueType: 'number' }
        ],
        outputs: [{ id: 'created_task_id', label: 'Created Task Id', valueType: 'string' }]
      };
    case 'create_appointment':
      return {
        inputs: [
          { id: 'title', label: 'Title', valueType: 'string' },
          { id: 'summary', label: 'Summary', valueType: 'string' },
          { id: 'start_utc', label: 'Start UTC', valueType: 'date' },
          { id: 'end_utc', label: 'End UTC', valueType: 'date' },
          { id: 'visibility', label: 'Visibility', valueType: 'string' }
        ],
        outputs: [{ id: 'created_event_id', label: 'Created Event Id', valueType: 'string' }]
      };
    case 'noop':
    default:
      return {
        inputs: [{ id: 'input', label: 'Input', valueType: 'json' }],
        outputs: [{ id: 'output', label: 'Output', valueType: 'json' }]
      };
  }
}

function makeHandleId(direction: PortDirection, port: CalendarGraphPort): string {
  return `${direction}|${port.valueType}|${port.id}`;
}

function parseHandleId(handleId: string | null | undefined): { direction: PortDirection; valueType: PortValueType; portId: string } | null {
  if (!handleId) return null;
  const [directionRaw, valueTypeRaw, ...rest] = handleId.split('|');
  if ((directionRaw !== 'in' && directionRaw !== 'out') || rest.length === 0) return null;
  const portId = rest.join('|').trim();
  if (!portId) return null;
  if (!['string', 'number', 'date', 'boolean', 'json'].includes(valueTypeRaw)) return null;
  return {
    direction: directionRaw as PortDirection,
    valueType: valueTypeRaw as PortValueType,
    portId
  };
}

const CalendarTypedNode = ({ data, selected }: NodeProps<CalendarGraphCanvasNodeData>) => {
  return (
    <div className={`calendar-typed-node calendar-typed-node--${data.nodeType}${selected ? ' is-selected' : ''}`}>
      <div className="calendar-typed-node-head">
        <strong>{data.nodeKey}</strong>
        <span>{data.nodeType}</span>
      </div>
      <div className="calendar-typed-node-grid">
        <div className="calendar-typed-node-col">
          {data.inputs.length === 0 && <small className="calendar-typed-node-empty">no inputs</small>}
          {data.inputs.map((port) => (
            <div key={`in-${port.id}`} className="calendar-typed-port calendar-typed-port-in">
              <Handle
                id={makeHandleId('in', port)}
                type="target"
                position={Position.Left}
                className="calendar-typed-handle"
                style={{
                  '--port-color': PORT_TYPE_COLORS[port.valueType]
                } as CSSProperties}
              />
              <span className={`calendar-port-type calendar-port-type-${port.valueType}`}>{port.label}</span>
            </div>
          ))}
        </div>
        <div className="calendar-typed-node-col">
          {data.outputs.length === 0 && <small className="calendar-typed-node-empty">no outputs</small>}
          {data.outputs.map((port) => (
            <div key={`out-${port.id}`} className="calendar-typed-port calendar-typed-port-out">
              <Handle
                id={makeHandleId('out', port)}
                type="source"
                position={Position.Right}
                className="calendar-typed-handle"
                style={{
                  '--port-color': PORT_TYPE_COLORS[port.valueType]
                } as CSSProperties}
              />
              <span className={`calendar-port-type calendar-port-type-${port.valueType}`}>{port.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function toCanvasNode(node: CalendarGraphNode, eventContext: CalendarEventResponse | null): CalendarGraphCanvasNode {
  const normalizedType = (node.nodeType || 'noop') as GraphNodeType;
  const nodeKey = node.nodeKey || normalizedType;
  const ports = buildNodePorts(normalizedType, eventContext);
  return {
    id: node.nodeId || makeGraphId('node'),
    type: 'typed',
    position: {
      x: Number.isFinite(node.positionX) ? node.positionX : 0,
      y: Number.isFinite(node.positionY) ? node.positionY : 0
    },
    data: {
      label: nodeKey,
      nodeType: normalizedType,
      nodeKey,
      configJson: node.configJson || '{}',
      inputs: ports.inputs,
      outputs: ports.outputs
    }
  };
}

function toCanvasEdge(edge: CalendarGraphEdge): CalendarGraphCanvasEdge {
  const sourceMeta = parseHandleId(edge.fromPort);
  const valueType = sourceMeta?.valueType ?? 'json';
  const color = PORT_TYPE_COLORS[valueType];
  return {
    id: edge.edgeId || makeGraphId('edge'),
    source: edge.fromNodeId,
    sourceHandle: edge.fromPort ?? undefined,
    target: edge.toNodeId,
    targetHandle: edge.toPort ?? undefined,
    type: 'default',
    markerEnd: { type: MarkerType.ArrowClosed, color },
    style: { stroke: color, strokeWidth: 2 },
    data: {
      edgeType: edge.edgeType || 'flow',
      conditionJson: edge.conditionJson ?? null,
      valueType
    }
  };
}

function toApiGraphNode(node: CalendarGraphCanvasNode): CalendarGraphNode {
  return {
    nodeId: node.id,
    nodeType: node.data.nodeType || 'noop',
    nodeKey: node.data.nodeKey || node.data.label || 'node',
    configJson: node.data.configJson || '{}',
    positionX: Math.round(node.position.x),
    positionY: Math.round(node.position.y)
  };
}

function toApiGraphEdge(edge: CalendarGraphCanvasEdge): CalendarGraphEdge {
  return {
    edgeId: edge.id,
    fromNodeId: edge.source,
    fromPort: edge.sourceHandle ?? null,
    toNodeId: edge.target,
    toPort: edge.targetHandle ?? null,
    edgeType: edge.data?.edgeType || edge.type || 'flow',
    conditionJson: edge.data?.conditionJson ?? null
  };
}

function localDayKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthMatrix(anchor: Date): Date[] {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
  const weekday = monthStart.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() + mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function rangeFromView(anchor: Date, view: ViewMode): { fromUtc: string; toUtc: string } {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 0, 0, 0, 0);
  const end = new Date(start);

  if (view === 'day') {
    end.setDate(end.getDate() + 1);
  } else if (view === 'week') {
    const dayOfWeek = start.getDay();
    const mondayShift = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + mondayShift);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  } else if (view === 'month') {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  } else if (view === 'timeline') {
    end.setDate(end.getDate() + 42);
  } else if (view === 'year') {
    start.setMonth(0, 1);
    end.setTime(start.getTime());
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setDate(end.getDate() + 30);
  }

  return { fromUtc: start.toISOString(), toUtc: end.toISOString() };
}

function shiftAnchor(anchor: Date, view: ViewMode, direction: -1 | 1): Date {
  const next = new Date(anchor);
  if (view === 'day') next.setDate(next.getDate() + direction);
  else if (view === 'week') next.setDate(next.getDate() + direction * 7);
  else if (view === 'month') next.setMonth(next.getMonth() + direction);
  else if (view === 'timeline') next.setDate(next.getDate() + direction * 42);
  else if (view === 'year') next.setFullYear(next.getFullYear() + direction);
  else next.setDate(next.getDate() + direction * 30);
  return next;
}

function readError(error: unknown): string {
  if (error instanceof ApiError) return 'API ' + error.status + ': ' + error.message;
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function readCalendarConflictCount(errorMessage: string): number | null {
  try {
    const payload = JSON.parse(errorMessage) as { conflicts?: unknown };
    if (payload && Array.isArray(payload.conflicts)) {
      return payload.conflicts.length;
    }
  } catch {
    // ignore malformed payload
  }
  return null;
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
  const [calendarPersonRoleId, setCalendarPersonRoleId] = useState('');
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
  const [graphFlowNodes, setGraphFlowNodes, onGraphFlowNodesChange] = useNodesState<CalendarGraphCanvasNode>([]);
  const [graphFlowEdges, setGraphFlowEdges, onGraphFlowEdgesChange] = useEdgesState<CalendarGraphCanvasEdge>([]);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const [selectedReusableGraphId, setSelectedReusableGraphId] = useState('');

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [itemType, setItemType] = useState<'appointment' | 'task'>('appointment');
  const [visibility, setVisibility] = useState<'private' | 'role' | 'public'>('private');
  const [startUtcLocal, setStartUtcLocal] = useState(formatDateTimeLocalInput(new Date()));
  const [endUtcLocal, setEndUtcLocal] = useState(formatDateTimeLocalInput(new Date(Date.now() + 3600000)));
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<'appointment' | 'task' | ''>('');
  const [taskStateFilter, setTaskStateFilter] = useState('');
  const [simpleKeywordFilter, setSimpleKeywordFilter] = useState('');
  const [simpleSubCalendarFilter, setSimpleSubCalendarFilter] = useState<'all' | string>('all');
  const [createWithGraph, setCreateWithGraph] = useState(false);
  const [createAsWeeklySeries, setCreateAsWeeklySeries] = useState(false);
  const [seriesIntervalWeeks, setSeriesIntervalWeeks] = useState(1);
  const [seriesUntilUtcLocal, setSeriesUntilUtcLocal] = useState(formatDateTimeLocalInput(new Date(Date.now() + 1000 * 60 * 60 * 24 * 56)));
  const [selectedEventGroupId, setSelectedEventGroupId] = useState('');
  const [newEventGroupName, setNewEventGroupName] = useState('');
  const [viewerRoleId, setViewerRoleId] = useState('');
  const [viewerCanSeeTitle, setViewerCanSeeTitle] = useState(true);
  const [viewerCanSeeGraph, setViewerCanSeeGraph] = useState(false);
  const [viewerScopes, setViewerScopes] = useState<Array<{ roleId: string; label: string; canSeeTitle: boolean; canSeeGraph: boolean }>>([]);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editStartUtcLocal, setEditStartUtcLocal] = useState('');
  const [editEndUtcLocal, setEditEndUtcLocal] = useState('');
  const [editStatus, setEditStatus] = useState('planned');
  const [pendingConflictSave, setPendingConflictSave] = useState<CalendarItemPatchPayload | null>(null);
  const [nodeEditorType, setNodeEditorType] = useState<GraphNodeType>('delay');
  const [nodeEditorKey, setNodeEditorKey] = useState('');
  const [nodeEditorConfigJson, setNodeEditorConfigJson] = useState('{}');
  const [selectedGraphEdgeId, setSelectedGraphEdgeId] = useState<string | null>(null);

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

  const rolesById = useMemo(() => {
    const map = new Map<string, { roleKind: string; label: string }>();
    for (const role of roles) {
      map.set(role.roleId, { roleKind: getRoleKind(role), label: getRoleLabel(role) });
    }
    return map;
  }, [roles]);

  const personScopedOccurrences = useMemo(() => {
    if (!calendarPersonRoleId) return [];
    return occurrences.filter((row) => row.event.ownerRoleId === calendarPersonRoleId);
  }, [occurrences, calendarPersonRoleId]);

  const personEventIds = useMemo(() => new Set(personScopedOccurrences.map((row) => row.eventId)), [personScopedOccurrences]);

  const personScopedConflicts = useMemo(
    () => conflicts.filter((conflict) => personEventIds.has(conflict.eventId)),
    [conflicts, personEventIds]
  );

  const groupedByDay = useMemo(() => {
    const map = new Map<string, CalendarOccurrenceResponse[]>();
    for (const row of personScopedOccurrences) {
      const day = row.occurrenceStartUtc.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(row);
      map.set(day, list);
    }
    return map;
  }, [personScopedOccurrences]);
  const queryView: 'month' | 'week' | 'day' | 'list' = view === 'timeline' || view === 'year' ? 'month' : view;

  const simpleSubCalendars = useMemo(() => {
    const map = new Map<string, { id: string; label: string; color: string }>();
    for (const row of personScopedOccurrences) {
      const roleId = row.event.ownerRoleId;
      if (map.has(roleId)) continue;
      const label = rolesById.get(roleId)?.label ?? row.event.eventGroupName ?? 'Default';
      map.set(roleId, { id: roleId, label, color: colorForKey(roleId) });
    }
    return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [personScopedOccurrences, rolesById]);

  const simpleFilteredOccurrences = useMemo(() => {
    const keyword = simpleKeywordFilter.trim().toLowerCase();
    return personScopedOccurrences.filter((row) => {
      if (simpleSubCalendarFilter !== 'all' && row.event.ownerRoleId !== simpleSubCalendarFilter) {
        return false;
      }
      if (!keyword) return true;
      const haystack = `${row.event.titlePublic} ${row.event.summaryPublic ?? ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [personScopedOccurrences, simpleKeywordFilter, simpleSubCalendarFilter]);

  const miniMonthDays = useMemo(() => buildMonthMatrix(anchor), [anchor]);

  const schedulerDays = useMemo(() => {
    const start = new Date(range.fromUtc);
    const count = view === 'day' ? 1 : 7;
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [range.fromUtc, view]);

  const hourSlots = useMemo(() => Array.from({ length: 16 }, (_, index) => index + 6), []);

  const simpleGroupedByLocalDay = useMemo(() => {
    const map = new Map<string, CalendarOccurrenceResponse[]>();
    for (const row of simpleFilteredOccurrences) {
      const day = localDayKey(new Date(row.occurrenceStartUtc));
      const list = map.get(day) ?? [];
      list.push(row);
      map.set(day, list);
    }
    return map;
  }, [simpleFilteredOccurrences]);

  const schedulerEventsByDay = useMemo(() => {
    return schedulerDays.map((day) => {
      const dayKey = localDayKey(day);
      const rows = simpleGroupedByLocalDay.get(dayKey) ?? [];
      return rows
        .map((row) => {
          const start = new Date(row.occurrenceStartUtc);
          if (Number.isNaN(start.getTime())) return null;
          const isOpenEnded = hasOpenEndedOccurrence(row);
          const end = isOpenEnded ? null : new Date(row.occurrenceEndUtc);
          const startMinutes = start.getHours() * 60 + start.getMinutes();
          const endMinutes = end ? end.getHours() * 60 + end.getMinutes() : 22 * 60;
          const baseStart = 6 * 60;
          const baseEnd = 22 * 60;
          const topPct = Math.max(0, Math.min(100, ((startMinutes - baseStart) / (baseEnd - baseStart)) * 100));
          const rawHeight = ((Math.max(startMinutes + 15, endMinutes) - startMinutes) / (baseEnd - baseStart)) * 100;
          const heightPct = Math.max(4, Math.min(100 - topPct, rawHeight));
          return { row, topPct, heightPct, isOpenEnded };
        })
        .filter((entry): entry is { row: CalendarOccurrenceResponse; topPct: number; heightPct: number; isOpenEnded: boolean } => entry !== null)
        .sort((left, right) => left.row.occurrenceStartUtc.localeCompare(right.row.occurrenceStartUtc));
    });
  }, [schedulerDays, simpleGroupedByLocalDay]);

  const timelineRows = useMemo(() => {
    const source = simpleSubCalendars.length > 0
      ? simpleSubCalendars
      : [{ id: 'default', label: 'Default', color: '#2e86ab' }];
    return source.map((subCalendar) => {
      const items = simpleFilteredOccurrences.filter((row) => {
        if (subCalendar.id === 'default') return true;
        return row.event.ownerRoleId === subCalendar.id;
      });
      return { subCalendar, items };
    });
  }, [simpleSubCalendars, simpleFilteredOccurrences]);

  const graphNodes = useMemo(() => graphFlowNodes.map((node) => toApiGraphNode(node)), [graphFlowNodes]);
  const graphEdges = useMemo(() => graphFlowEdges.map((edge) => toApiGraphEdge(edge)), [graphFlowEdges]);
  const selectedGraphNode = useMemo(
    () => graphFlowNodes.find((node) => node.id === selectedGraphNodeId) ?? null,
    [graphFlowNodes, selectedGraphNodeId]
  );
  const graphNodeTypes = useMemo(() => ({ typed: CalendarTypedNode }), []);
  const isValidGraphConnection = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) {
      return false;
    }

    const sourceHandle = parseHandleId(connection.sourceHandle);
    const targetHandle = parseHandleId(connection.targetHandle);
    if (!sourceHandle || !targetHandle) {
      return false;
    }

    if (sourceHandle.direction !== 'out' || targetHandle.direction !== 'in') {
      return false;
    }

    return sourceHandle.valueType === targetHandle.valueType;
  }, []);
  const graphTemplateOptions = useMemo(() => {
    if (!selectedEvent) return templates;
    if (selectedEvent.itemType === 'appointment') {
      return templates.filter((template) => template.category === 'recurrence' || template.category === 'custom');
    }
    return templates.filter((template) => template.category === 'task' || template.category === 'followup' || template.category === 'custom');
  }, [templates, selectedEvent]);
  const graphPurposeLabel = selectedEvent?.itemType === 'appointment'
    ? 'Appointment recurrence graph (optional)'
    : 'Completion automation graph (optional)';

  const personRoles = useMemo(
    () => roles
      .map((role) => ({ roleId: role.roleId, label: getRoleLabel(role), kind: getRoleKind(role) }))
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

  const linkedPersonBindings = useMemo(
    () => calendarRoleBindings.filter((binding) => isPersonRoleKind(rolesById.get(binding.roleId)?.roleKind ?? '')),
    [calendarRoleBindings, rolesById]
  );

  const linkedGroupBindings = useMemo(
    () => calendarRoleBindings.filter((binding) => isGroupRoleKind(rolesById.get(binding.roleId)?.roleKind ?? '')),
    [calendarRoleBindings, rolesById]
  );
  const simpleMode = !location.search.includes('calendarAdvanced=1');
  const queryItemType = simpleMode ? undefined : (itemTypeFilter || undefined);
  const queryTaskState = simpleMode ? undefined : (taskStateFilter || undefined);
  const effectiveCalendarId = calendarId ?? calendars[0]?.id ?? null;

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

    const loadPromise = Promise.all([getCalendars(), getRoles(), getCalendarGraphTemplates()])
      .then(([calendarList, roleList, templateList]) => ({ calendarList, roleList, templateList }));

    loadPromise
      .then(async ({ calendarList, roleList, templateList }) => {
        setRoles(roleList);
        const defaultPersonRoleId =
          roleList.find((role) => isPersonRoleKind(getRoleKind(role)))?.roleId ??
          roleList[0]?.roleId ??
          null;
        const defaultGroupRoleId = roleList.find((role) => isGroupRoleKind(getRoleKind(role)))?.roleId ?? null;
        const personRoleIds = roleList.map((role) => role.roleId);
        const savedPersonRoleId = (() => {
          if (typeof window === 'undefined') return '';
          try {
            return window.localStorage.getItem(CALENDAR_PERSON_PREF_KEY) ?? '';
          } catch {
            return '';
          }
        })();
        const preferredPersonRoleId = personRoleIds.includes(savedPersonRoleId) ? savedPersonRoleId : (defaultPersonRoleId ?? '');
        const defaultOwnerRoleId = preferredPersonRoleId || null;
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
          setError('No roles found. Go to your Account to create a role, then return here to start using the calendar.');
        } else {
          if (!preferredPersonRoleId) {
            setError('No role available to view events. Go to your Account to create a role.');
          } else {
            setError(null);
          }
        }

        setCalendars(resolvedCalendars.map((row) => ({ id: row.calendarId, name: row.name })));
        setCalendarId((current) => {
          if (current && resolvedCalendars.some((calendar) => calendar.calendarId === current)) {
            return current;
          }
          return resolvedCalendars[0]?.calendarId ?? null;
        });
        setCalendarPersonRoleId((current) => {
          if (current && personRoleIds.includes(current)) {
            return current;
          }
          return preferredPersonRoleId;
        });
        setOwnerRoleId((current) => {
          if (simpleMode && preferredPersonRoleId) {
            return preferredPersonRoleId;
          }
          if (current && allowedRoleIds.has(current) && personRoleIds.includes(current)) {
            return current;
          }
          return preferredPersonRoleId || null;
        });
        setSelectedPersonRoleId((current) => current || defaultPersonRoleId || '');
        setSelectedGroupRoleId((current) => current || defaultGroupRoleId || '');
        if (templateList.length > 0) {
          setTemplates(templateList);
          setGraphTemplateKey((current) => current || templateList[0].templateKey);
          setGraphConfigJson((current) => (current && current !== '{}' ? current : '{}'));
        }
      })
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute, simpleMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (calendarPersonRoleId) {
        window.localStorage.setItem(CALENDAR_PERSON_PREF_KEY, calendarPersonRoleId);
      } else {
        window.localStorage.removeItem(CALENDAR_PERSON_PREF_KEY);
      }
    } catch {
      // ignore local preference persistence failures
    }
  }, [calendarPersonRoleId]);

  useEffect(() => {
    if (!calendarPersonRoleId) return;
    if (simpleMode || !ownerRoleId) {
      setOwnerRoleId(calendarPersonRoleId);
    }
  }, [calendarPersonRoleId, simpleMode, ownerRoleId]);

  useEffect(() => {
    setSimpleSubCalendarFilter('all');
  }, [calendarPersonRoleId]);

  useEffect(() => {
    setSelectedEventId((current) => {
      if (personScopedOccurrences.length === 0) return null;
      if (current && personScopedOccurrences.some((row) => row.eventId === current)) {
        return current;
      }
      return personScopedOccurrences[0]?.eventId ?? null;
    });
  }, [personScopedOccurrences]);

  useEffect(() => {
    if (!selectedEvent) {
      setEditTitle('');
      setEditSummary('');
      setEditStartUtcLocal('');
      setEditEndUtcLocal('');
      setEditStatus('planned');
      setPendingConflictSave(null);
      return;
    }

    const start = new Date(selectedEvent.startUtc);
    const end = new Date(selectedEvent.endUtc);
    setEditTitle(selectedEvent.titlePublic ?? '');
    setEditSummary(selectedEvent.summaryPublic ?? '');
    setEditStartUtcLocal(Number.isNaN(start.getTime()) ? '' : formatDateTimeLocalInput(start));
    setEditEndUtcLocal(Number.isNaN(end.getTime()) ? '' : formatDateTimeLocalInput(end));
    setEditStatus(selectedEvent.status ?? 'planned');
    setPendingConflictSave(null);
  }, [selectedEvent]);

  useEffect(() => {
    if (simpleMode || !showProfileMenu || !calendarId || shareRoute) {
      setCalendarRoleBindings([]);
      return;
    }

    getCalendar(calendarId)
      .then((calendar) => setCalendarRoleBindings(calendar.roleBindings ?? []))
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute, calendarId, simpleMode]);

  useEffect(() => {
    if (simpleMode || !showProfileMenu || !calendarId || shareRoute) {
      setEventGroups([]);
      setSelectedEventGroupId('');
      return;
    }

    listCalendarEventGroups(calendarId)
      .then((items) => {
        setEventGroups(items.map((item) => ({ eventGroupId: item.eventGroupId, name: item.name })));
      })
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute, calendarId, simpleMode]);

  useEffect(() => {
    if (simpleMode || !showProfileMenu || !calendarId || shareRoute) {
      setCalendarGraphs([]);
      setSelectedReusableGraphId('');
      return;
    }

    getCalendarGraphs(calendarId)
      .then((graphs) => setCalendarGraphs(graphs))
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute, calendarId, simpleMode]);

  useEffect(() => {
    if (!showProfileMenu || !calendarId || shareRoute) return;

    getCalendarEvents({
      calendarId,
      view: queryView,
      fromUtc: range.fromUtc,
      toUtc: range.toUtc,
      status: statusFilter || undefined,
      visibility: visibilityFilter || undefined,
      itemType: queryItemType,
      taskState: queryTaskState,
      includeProtected: true
    })
      .then((bundle) => {
        setOccurrences(bundle.occurrences);
        setConflicts(bundle.conflicts);
      })
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute, calendarId, range.fromUtc, range.toUtc, view, statusFilter, visibilityFilter, queryItemType, queryTaskState]);

  useEffect(() => {
    if (!selectedEventId || shareRoute || !showProfileMenu) {
      setSelectedEvent(null);
      return;
    }

    if (simpleMode) {
      Promise.allSettled([
        getCalendarItem(selectedEventId, true),
        getCalendarGraph(selectedEventId),
        getCalendarGraphExecutions(selectedEventId, 20)
      ]).then((results) => {
        if (results[0].status === 'fulfilled') {
          setSelectedEvent(results[0].value);
        }
        if (results[1].status === 'fulfilled') {
          const graph = results[1].value;
          const eventContext = results[0].status === 'fulfilled' ? results[0].value : selectedEvent;
          setGraphTemplateKey(graph.templateKey);
          setGraphStatus(graph.status === 'draft' || graph.status === 'archived' ? graph.status : 'active');
          setGraphConfigJson(graph.templateConfigJson || '{}');
          setGraphFlowNodes(graph.nodes.map((node) => toCanvasNode(node, eventContext)));
          setGraphFlowEdges(graph.edges.map((edge) => toCanvasEdge(edge)));
          setSelectedGraphNodeId(null);
          setSelectedGraphEdgeId(null);
        } else {
          setGraphTemplateKey(templates[0]?.templateKey ?? 'custom');
          setGraphStatus('draft');
          setGraphConfigJson('{}');
          setGraphFlowNodes([]);
          setGraphFlowEdges([]);
          setSelectedGraphNodeId(null);
          setSelectedGraphEdgeId(null);
        }
        if (results[2].status === 'fulfilled') {
          setExecutions(results[2].value);
        }
      }).catch((err) => setError(readError(err)));
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
        const eventContext = results[0].status === 'fulfilled' ? results[0].value : selectedEvent;
        setGraphTemplateKey(graph.templateKey);
        setGraphStatus(graph.status === 'draft' || graph.status === 'archived' ? graph.status : 'active');
        setGraphConfigJson(graph.templateConfigJson || '{}');
        setGraphFlowNodes(graph.nodes.map((node) => toCanvasNode(node, eventContext)));
        setGraphFlowEdges(graph.edges.map((edge) => toCanvasEdge(edge)));
        setSelectedGraphNodeId(null);
        setSelectedGraphEdgeId(null);
      } else {
        setGraphTemplateKey(templates[0]?.templateKey ?? 'custom');
        setGraphStatus('draft');
        setGraphConfigJson('{}');
        setGraphFlowNodes([]);
        setGraphFlowEdges([]);
        setSelectedGraphNodeId(null);
        setSelectedGraphEdgeId(null);
      }
    });
  }, [selectedEventId, shareRoute, showProfileMenu, simpleMode, templates]);

  useEffect(() => {
    if (simpleMode || !showProfileMenu || shareRoute || !selectedEventGroupId) {
      setGroupShares([]);
      return;
    }

    listCalendarEventGroupShares(selectedEventGroupId)
      .then((items) => setGroupShares(items))
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareRoute, selectedEventGroupId, simpleMode]);

  useEffect(() => {
    setLatestGroupShareCode(null);
  }, [selectedEventGroupId]);

  useEffect(() => {
    if (itemType !== 'appointment') {
      setCreateAsWeeklySeries(false);
    }
  }, [itemType]);

  useEffect(() => {
    if (graphFlowNodes.length === 0) {
      setSelectedGraphNodeId(null);
      setSelectedGraphEdgeId(null);
      return;
    }

    if (selectedGraphNodeId && !graphFlowNodes.some((node) => node.id === selectedGraphNodeId)) {
      setSelectedGraphNodeId(null);
    }
    if (selectedGraphEdgeId && !graphFlowEdges.some((edge) => edge.id === selectedGraphEdgeId)) {
      setSelectedGraphEdgeId(null);
    }
  }, [graphFlowNodes, graphFlowEdges, selectedGraphNodeId, selectedGraphEdgeId]);

  useEffect(() => {
    setGraphFlowNodes((current) => current.map((node) => {
      if (node.data.nodeType !== 'trigger') {
        return node;
      }

      const triggerPorts = buildNodePorts('trigger', selectedEvent);
      return {
        ...node,
        data: {
          ...node.data,
          inputs: triggerPorts.inputs,
          outputs: triggerPorts.outputs
        }
      };
    }));
  }, [selectedEvent, setGraphFlowNodes]);

  useEffect(() => {
    if (!selectedGraphNode) {
      return;
    }

    setNodeEditorType((selectedGraphNode.data.nodeType as GraphNodeType) || 'noop');
    setNodeEditorKey(selectedGraphNode.data.nodeKey || selectedGraphNode.data.label || '');
    setNodeEditorConfigJson(selectedGraphNode.data.configJson || '{}');
  }, [selectedGraphNode]);

  const applyTemplate = (templateKey: string) => {
    const template = templates.find((entry) => entry.templateKey === templateKey);
    if (!template) return;
    setGraphTemplateKey(template.templateKey);
    setGraphConfigJson(template.defaultConfigJson || '{}');
    setGraphFlowNodes(template.nodes.map((node) => toCanvasNode(node, selectedEvent)));
    setGraphFlowEdges(template.edges.map((edge) => toCanvasEdge(edge)));
    setSelectedGraphNodeId(null);
    setSelectedGraphEdgeId(null);
    setGraphStatus('active');
  };

  const refresh = (preferredEventId?: string | null) => {
    const activeCalendarId = calendarId ?? effectiveCalendarId;
    if (!activeCalendarId) return;
    getCalendarEvents({
      calendarId: activeCalendarId,
      view: queryView,
      fromUtc: range.fromUtc,
      toUtc: range.toUtc,
      status: statusFilter || undefined,
      visibility: visibilityFilter || undefined,
      itemType: queryItemType,
      taskState: queryTaskState,
      includeProtected: true
    })
      .then((bundle) => {
        setOccurrences(bundle.occurrences);
        setConflicts(bundle.conflicts);
        if (preferredEventId) {
          const hasPreferred = bundle.occurrences.some((row) => row.eventId === preferredEventId);
          if (hasPreferred) {
            setSelectedEventId(preferredEventId);
          }
        }
      })
      .catch((err) => setError(readError(err)));
  };

  const createQuickAppointment = async () => {
    const activeCalendarId = effectiveCalendarId;
    const activeOwnerRoleId = calendarPersonRoleId || null;
    const normalizedTitle = title.trim();
    if (!activeCalendarId || !activeOwnerRoleId) {
      setError('No calendar or person role available.');
      return;
    }

    if (!normalizedTitle) {
      setError('Title is required.');
      return;
    }

    const start = new Date(startUtcLocal);
    if (Number.isNaN(start.getTime())) {
      setError('Start time is invalid.');
      return;
    }

    try {
      if (!calendarId) {
        setCalendarId(activeCalendarId);
      }
      if (!ownerRoleId) {
        setOwnerRoleId(activeOwnerRoleId);
      }

      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const created = await createCalendarItem({
        calendarId: activeCalendarId,
        ownerRoleId: activeOwnerRoleId,
        titlePublic: normalizedTitle,
        summaryPublic: null,
        visibility: 'private',
        status: 'planned',
        startUtc: start.toISOString(),
        endUtc: end.toISOString(),
        itemType,
        taskState: itemType === 'task' ? 'todo' : null,
        taskProgressPercent: itemType === 'task' ? 0 : null,
        viewerScopes: [],
        graph: null
      });

      setTitle('');
      setStartUtcLocal(formatDateTimeLocalInput(new Date()));
      setEndUtcLocal(formatDateTimeLocalInput(new Date(Date.now() + 3600000)));
      setAnchor(start);
      setSelectedEventId(created.eventId);
      void getCalendarItem(created.eventId, true).then(setSelectedEvent).catch(() => {});
      setError(null);
      refresh(created.eventId);
    } catch (err) {
      setError(readError(err));
    }
  };

  const createItem = async () => {
    const activeCalendarId = effectiveCalendarId;
    const activeOwnerRoleId = calendarPersonRoleId || null;
    if (!activeCalendarId || !activeOwnerRoleId) {
      setError('No calendar or person role available.');
      return;
    }
    if (!calendarId && activeCalendarId) {
      setCalendarId(activeCalendarId);
    }
    if (!ownerRoleId && activeOwnerRoleId) {
      setOwnerRoleId(activeOwnerRoleId);
    }

    try {
      const shouldReuseGraph = !!selectedReusableGraphId;
      const shouldAttachGraph = createWithGraph || shouldReuseGraph;
      const needsInlineGraph = shouldAttachGraph && !shouldReuseGraph;
      const parsedNodes = needsInlineGraph ? graphNodes : [];
      const parsedEdges = needsInlineGraph ? graphEdges : [];
      const startUtc = new Date(startUtcLocal).toISOString();
      const endUtc = new Date(endUtcLocal).toISOString();

      let createdEventId: string | null = null;
      if (createAsWeeklySeries && itemType === 'appointment') {
        if (!selectedEventGroupId) {
          setError('Weekly series requires an event group.');
          return;
        }

        const series = await createWeeklyCalendarSeries(selectedEventGroupId, {
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
          graphId: shouldAttachGraph && shouldReuseGraph ? selectedReusableGraphId : null,
          allowConflicts: false
        });
        createdEventId = series.eventIds[0] ?? null;
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
          graph: !needsInlineGraph
            ? null
            : {
                templateKey: graphTemplateKey || (itemType === 'appointment' ? 'weekly' : 'custom'),
                status: 'active',
                templateConfigJson: graphConfigJson,
                nodes: parsedNodes,
                edges: parsedEdges
              }
        });
        createdEventId = createdItem.eventId;
        if (shouldAttachGraph && shouldReuseGraph) {
          await linkCalendarEventGraph(createdItem.eventId, selectedReusableGraphId);
        }
      }

      setTitle('');
      setSummary('');
      setViewerScopes([]);
      setSelectedReusableGraphId('');
      setCreateWithGraph(false);
      setAnchor(new Date(startUtc));
      if (createdEventId) {
        setSelectedEventId(createdEventId);
        void getCalendarItem(createdEventId, true).then(setSelectedEvent).catch(() => {});
      }
      refresh(createdEventId);
      if (activeCalendarId) {
        void getCalendarGraphs(activeCalendarId).then((graphs) => setCalendarGraphs(graphs)).catch(() => {});
      }
    } catch (err) {
      setError(readError(err));
    }
  };

  const createEventGroupNow = async () => {
    const activeCalendarId = effectiveCalendarId;
    const activeOwnerRoleId = calendarPersonRoleId || null;
    if (!activeCalendarId || !activeOwnerRoleId) {
      setError('Select calendar and person role first.');
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

  const saveSelectedItem = async () => {
    if (!selectedEvent) {
      setError('Select an item first.');
      return;
    }

    const normalizedTitle = editTitle.trim();
    if (!normalizedTitle) {
      setError('Title is required.');
      return;
    }

    const start = new Date(editStartUtcLocal);
    const end = new Date(editEndUtcLocal);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('Start or end time is invalid.');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setError('End time must be after start time.');
      return;
    }

    const payload: CalendarItemPatchPayload = {
      titlePublic: normalizedTitle,
      summaryPublic: editSummary.trim() || null,
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      status: editStatus as 'planned' | 'confirmed' | 'cancelled' | 'completed'
    };

    try {
      const updated = await updateCalendarItem(selectedEvent.eventId, payload);
      setSelectedEvent(updated);
      setPendingConflictSave(null);
      setError(null);
      refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const conflictCount = readCalendarConflictCount(err.message);
        const suffix = conflictCount !== null ? ` (${conflictCount} conflict${conflictCount === 1 ? '' : 's'})` : '';
        setPendingConflictSave(payload);
        setError(`Time conflict detected${suffix}. Use "Save anyway" to allow overlap.`);
        return;
      }
      setPendingConflictSave(null);
      setError(readError(err));
    }
  };

  const saveSelectedItemAllowConflicts = async () => {
    if (!selectedEvent || !pendingConflictSave) {
      setError('Nothing pending to save.');
      return;
    }

    try {
      const updated = await updateCalendarItem(selectedEvent.eventId, {
        ...pendingConflictSave,
        allowConflicts: true
      });
      setSelectedEvent(updated);
      setPendingConflictSave(null);
      setError(null);
      refresh(selectedEvent.eventId);
    } catch (err) {
      setError(readError(err));
    }
  };

  const removeSelectedItem = async () => {
    if (!selectedEventId) {
      setError('Select an item first.');
      return;
    }

    try {
      await archiveCalendarItem(selectedEventId);
      setSelectedEvent(null);
      setSelectedEventId(null);
      setPendingConflictSave(null);
      setError(null);
      refresh();
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

  const persistGraphDraft = (nodes: CalendarGraphNode[], edges: CalendarGraphEdge[]) => {
    setGraphFlowNodes(nodes.map((node) => toCanvasNode(node, selectedEvent)));
    setGraphFlowEdges(edges.map((edge) => toCanvasEdge(edge)));
    setSelectedGraphNodeId((current) => {
      if (!current) return null;
      return nodes.some((node) => node.nodeId === current) ? current : null;
    });
    setSelectedGraphEdgeId((current) => {
      if (!current) return null;
      return edges.some((edge) => edge.edgeId === current) ? current : null;
    });
  };

  const addGraphNode = () => {
    const config = nodeEditorConfigJson.trim() || '{}';
    try {
      JSON.parse(config);
    } catch {
      setError('Node config JSON is invalid.');
      return;
    }

    const nodeId = makeGraphId('node');
    const nextNode: CalendarGraphNode = {
      nodeId,
      nodeType: nodeEditorType,
      nodeKey: nodeEditorKey.trim() || `${nodeEditorType}_${graphNodes.length + 1}`,
      configJson: config,
      positionX: graphNodes.length * 220,
      positionY: (graphNodes.length % 4) * 90
    };

    const nextNodes = [...graphNodes, nextNode];
    persistGraphDraft(nextNodes, graphEdges);
    setSelectedGraphNodeId(nodeId);
    setSelectedGraphEdgeId(null);
    setError(null);
  };

  const removeGraphNode = (nodeId: string) => {
    const nextNodes = graphNodes.filter((node) => node.nodeId !== nodeId);
    const nextEdges = graphEdges.filter((edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId);
    persistGraphDraft(nextNodes, nextEdges);
  };

  const updateSelectedGraphNode = () => {
    if (!selectedGraphNodeId) {
      setError('Select a node first.');
      return;
    }

    const config = nodeEditorConfigJson.trim() || '{}';
    try {
      JSON.parse(config);
    } catch {
      setError('Node config JSON is invalid.');
      return;
    }

    const normalizedKey = nodeEditorKey.trim() || `${nodeEditorType}_${graphNodes.length}`;
    const ports = buildNodePorts(nodeEditorType, selectedEvent);
    setGraphFlowNodes((current) => current.map((node) => {
      if (node.id !== selectedGraphNodeId) {
        return node;
      }

      return {
        ...node,
        data: {
          ...node.data,
          label: normalizedKey,
          nodeType: nodeEditorType,
          nodeKey: normalizedKey,
          configJson: config,
          inputs: ports.inputs,
          outputs: ports.outputs
        }
      };
    }));
    setError(null);
  };

  const removeGraphEdge = (edgeId: string) => {
    persistGraphDraft(graphNodes, graphEdges.filter((edge) => edge.edgeId !== edgeId));
  };

  const removeSelectedGraphEdge = () => {
    if (!selectedGraphEdgeId) {
      setError('Select an edge first.');
      return;
    }

    removeGraphEdge(selectedGraphEdgeId);
    setSelectedGraphEdgeId(null);
    setError(null);
  };

  const connectGraphNodes = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || !isValidGraphConnection(connection)) {
      setError('Only matching data types can be connected.');
      return;
    }

    const sourceMeta = parseHandleId(connection.sourceHandle);
    if (!sourceMeta) {
      setError('Invalid output handle.');
      return;
    }

    const valueType = sourceMeta.valueType;
    const stroke = PORT_TYPE_COLORS[valueType];

    setGraphFlowEdges((current) => {
      const exists = current.some((edge) =>
        edge.source === connection.source &&
        edge.target === connection.target &&
        (edge.sourceHandle ?? '') === (connection.sourceHandle ?? '') &&
        (edge.targetHandle ?? '') === (connection.targetHandle ?? '')
      );
      if (exists) {
        return current;
      }

      return addEdge({
        id: makeGraphId('edge'),
        source: connection.source,
        sourceHandle: connection.sourceHandle ?? undefined,
        target: connection.target,
        targetHandle: connection.targetHandle ?? undefined,
        type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
        style: { stroke, strokeWidth: 2 },
        data: { edgeType: 'flow', conditionJson: null, valueType }
      }, current) as CalendarGraphCanvasEdge[];
    });
    setSelectedGraphNodeId(null);
    setError(null);
  }, [setGraphFlowEdges, isValidGraphConnection]);

  const applyCustomTaskGraphPreset = (outputType: 'task' | 'appointment') => {
    const triggerNodeId = makeGraphId('node');
    const delayNodeId = makeGraphId('node');
    const outputNodeId = makeGraphId('node');

    const nextNodes: CalendarGraphNode[] = [
      {
        nodeId: triggerNodeId,
        nodeType: 'trigger',
        nodeKey: 'input_task_payload',
        configJson: '{}',
        positionX: 0,
        positionY: 0
      },
      {
        nodeId: delayNodeId,
        nodeType: 'delay',
        nodeKey: 'start_plus_1_day',
        configJson: '{"days":1}',
        positionX: 220,
        positionY: 0
      },
      {
        nodeId: outputNodeId,
        nodeType: outputType === 'task' ? 'create_task' : 'create_appointment',
        nodeKey: outputType === 'task' ? 'output_task' : 'output_appointment',
        configJson: outputType === 'task'
          ? '{"title":"Recreated task","durationMinutes":60}'
          : '{"title":"Follow-up appointment","durationMinutes":60}',
        positionX: 460,
        positionY: 0
      }
    ];

    const nextEdges: CalendarGraphEdge[] = [
      {
        edgeId: makeGraphId('edge'),
        fromNodeId: triggerNodeId,
        toNodeId: delayNodeId,
        fromPort: 'out|date|startutc',
        toPort: 'in|date|start',
        edgeType: 'flow',
        conditionJson: null
      },
      {
        edgeId: makeGraphId('edge'),
        fromNodeId: delayNodeId,
        toNodeId: outputNodeId,
        fromPort: 'out|date|result',
        toPort: 'in|date|start_utc',
        edgeType: 'flow',
        conditionJson: null
      }
    ];

    setGraphTemplateKey('custom');
    setGraphConfigJson('{}');
    setGraphStatus('active');
    persistGraphDraft(nextNodes, nextEdges);
    setError(null);
  };

  const applyCustomAppointmentGraphPreset = () => {
    const triggerNodeId = makeGraphId('node');
    const delayNodeId = makeGraphId('node');
    const outputNodeId = makeGraphId('node');

    const nextNodes: CalendarGraphNode[] = [
      {
        nodeId: triggerNodeId,
        nodeType: 'trigger',
        nodeKey: 'input_appointment_payload',
        configJson: '{}',
        positionX: 0,
        positionY: 0
      },
      {
        nodeId: delayNodeId,
        nodeType: 'delay',
        nodeKey: 'start_plus_1_day',
        configJson: '{"days":1}',
        positionX: 220,
        positionY: 0
      },
      {
        nodeId: outputNodeId,
        nodeType: 'create_appointment',
        nodeKey: 'output_appointment',
        configJson: '{"title":"Next appointment","durationMinutes":60}',
        positionX: 460,
        positionY: 0
      }
    ];

    const nextEdges: CalendarGraphEdge[] = [
      {
        edgeId: makeGraphId('edge'),
        fromNodeId: triggerNodeId,
        toNodeId: delayNodeId,
        fromPort: 'out|date|startutc',
        toPort: 'in|date|start',
        edgeType: 'flow',
        conditionJson: null
      },
      {
        edgeId: makeGraphId('edge'),
        fromNodeId: delayNodeId,
        toNodeId: outputNodeId,
        fromPort: 'out|date|result',
        toPort: 'in|date|start_utc',
        edgeType: 'flow',
        conditionJson: null
      }
    ];

    setGraphTemplateKey('custom');
    setGraphConfigJson('{}');
    setGraphStatus('active');
    persistGraphDraft(nextNodes, nextEdges);
    setError(null);
  };

  const saveGraphDraft = async () => {
    if (!selectedEvent) {
      setError('Select an item first.');
      return;
    }

    const selectedTemplateKey = graphTemplateKey || (graphTemplateOptions[0]?.templateKey ?? 'custom');
    try {
      const saved = await upsertCalendarGraph(selectedEvent.eventId, {
        templateKey: selectedTemplateKey,
        templateConfigJson: graphConfigJson,
        status: graphStatus,
        nodes: graphNodes,
        edges: graphEdges
      });
      setGraphTemplateKey(saved.templateKey);
      setGraphStatus(saved.status === 'draft' || saved.status === 'archived' ? saved.status : 'active');
      setGraphConfigJson(saved.templateConfigJson || '{}');
      setGraphFlowNodes(saved.nodes.map((node) => toCanvasNode(node, selectedEvent)));
      setGraphFlowEdges(saved.edges.map((edge) => toCanvasEdge(edge)));
      setSelectedGraphNodeId(null);
      setSelectedGraphEdgeId(null);
      const history = await getCalendarGraphExecutions(selectedEvent.eventId, 20);
      setExecutions(history);
      setError(null);
    } catch (err) {
      setError(readError(err));
    }
  };

  const runTaskCompletionAction = async (outcome: 'fulfilled' | 'dismissed', runGraph: boolean) => {
    if (!selectedEvent || selectedEvent.itemType !== 'task') {
      setError('Select a task first.');
      return;
    }

    const mappedTaskState = outcome === 'fulfilled' ? 'done' : 'cancelled';
    try {
      if (runGraph && mappedTaskState === 'done') {
        await completeCalendarTaskAndRunGraph(selectedEvent.eventId, {});
      } else {
        await completeCalendarTask(selectedEvent.eventId, { taskState: mappedTaskState });
        if (runGraph) {
          try {
            await executeCalendarGraph(selectedEvent.eventId, { triggerType: 'completion', completionAction: 'run_graph' });
          } catch (err) {
            const message = readError(err).toLowerCase();
            if (!message.includes('no active graph')) {
              throw err;
            }
          }
        }
      }

      const [item, history] = await Promise.all([
        getCalendarItem(selectedEvent.eventId, true),
        getCalendarGraphExecutions(selectedEvent.eventId, 20)
      ]);
      setSelectedEvent(item);
      setExecutions(history);
      refresh(selectedEvent.eventId);
      setError(null);
    } catch (err) {
      setError(readError(err));
    }
  };

  const runSelectedGraphManual = async () => {
    if (!selectedEvent) {
      setError('Select an item first.');
      return;
    }

    try {
      await executeCalendarGraph(selectedEvent.eventId, { triggerType: 'manual' });
      const [item, history] = await Promise.all([
        getCalendarItem(selectedEvent.eventId, true),
        getCalendarGraphExecutions(selectedEvent.eventId, 20)
      ]);
      setSelectedEvent(item);
      setExecutions(history);
      refresh(selectedEvent.eventId);
      setError(null);
    } catch (err) {
      setError(readError(err));
    }
  };

  const selectedMainInspector = (
    <section className="calendar-panel calendar-main-selected-panel">
      <h3>Selected item</h3>
      {!selectedEvent && <p>Select an appointment or task to edit details and automation.</p>}
      {selectedEvent && (
        <div className="calendar-selected-content">
          <div className="calendar-field-row">
            <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Title" />
            <textarea rows={2} value={editSummary} onChange={(event) => setEditSummary(event.target.value)} placeholder="Summary" />
            <div className="calendar-inline-grid">
              <input type="datetime-local" value={editStartUtcLocal} onChange={(event) => setEditStartUtcLocal(event.target.value)} />
              <input type="datetime-local" value={editEndUtcLocal} onChange={(event) => setEditEndUtcLocal(event.target.value)} />
            </div>
            <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
              <option value="planned">planned</option>
              <option value="confirmed">confirmed</option>
              <option value="cancelled">cancelled</option>
              <option value="completed">completed</option>
            </select>
            <div className="calendar-detail-actions">
              <button type="button" onClick={() => void saveSelectedItem()}>Save</button>
              {pendingConflictSave && <button type="button" onClick={() => void saveSelectedItemAllowConflicts()}>Save anyway</button>}
              <button type="button" onClick={() => void removeSelectedItem()}>Remove</button>
              <button type="button" onClick={() => void runSelectedGraphManual()}>Run graph</button>
            </div>
          </div>

          {selectedEvent.itemType === 'task' && (
            <div className="calendar-share-panel">
              <h4>Task completion</h4>
              <div className="calendar-detail-actions">
                <button type="button" onClick={() => void runTaskCompletionAction('fulfilled', false)}>Fulfill</button>
                <button type="button" onClick={() => void runTaskCompletionAction('fulfilled', true)}>Fulfill + run graph</button>
                <button type="button" onClick={() => void runTaskCompletionAction('dismissed', false)}>Dismiss</button>
                <button type="button" onClick={() => void runTaskCompletionAction('dismissed', true)}>Dismiss + run graph</button>
              </div>
            </div>
          )}

          <div className="calendar-share-panel">
            <h4>{graphPurposeLabel}</h4>
            <p>Input node carries selected item data. Add transform nodes (for example delay +1 day) and connect to output create nodes.</p>
            <div className="calendar-inline-grid">
              <select value={graphTemplateKey} onChange={(event) => applyTemplate(event.target.value)}>
                <option value="">template</option>
                {graphTemplateOptions.map((template) => (
                  <option key={template.templateKey} value={template.templateKey}>{template.name}</option>
                ))}
              </select>
              <select value={graphStatus} onChange={(event) => setGraphStatus(event.target.value as 'draft' | 'active' | 'archived')}>
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </div>
            <textarea rows={3} value={graphConfigJson} onChange={(event) => setGraphConfigJson(event.target.value)} placeholder="Graph options" />
            {selectedEvent.itemType === 'task' ? (
              <div className="calendar-detail-actions">
                <button type="button" onClick={() => applyCustomTaskGraphPreset('task')}>Preset: recreate task +1 day</button>
                <button type="button" onClick={() => applyCustomTaskGraphPreset('appointment')}>Preset: follow-up appointment +1 day</button>
              </div>
            ) : (
              <div className="calendar-detail-actions">
                <button type="button" onClick={() => applyTemplate('daily')}>Daily recurrence</button>
                <button type="button" onClick={() => applyTemplate('weekly')}>Weekly recurrence</button>
                <button type="button" onClick={() => applyTemplate('monthly')}>Monthly recurrence</button>
                <button type="button" onClick={applyCustomAppointmentGraphPreset}>Custom +1 day recreate</button>
              </div>
            )}
            <div className="calendar-graph-flow">
              <ReactFlow
                nodes={graphFlowNodes}
                edges={graphFlowEdges}
                nodeTypes={graphNodeTypes}
                connectionMode={ConnectionMode.Strict}
                onNodesChange={onGraphFlowNodesChange}
                onEdgesChange={onGraphFlowEdgesChange}
                onConnect={connectGraphNodes}
                isValidConnection={isValidGraphConnection}
                onNodeClick={(_, node) => {
                  setSelectedGraphNodeId(node.id);
                  setSelectedGraphEdgeId(null);
                }}
                onEdgeClick={(_, edge) => {
                  setSelectedGraphEdgeId(edge.id);
                  setSelectedGraphNodeId(null);
                }}
                onPaneClick={() => {
                  setSelectedGraphNodeId(null);
                  setSelectedGraphEdgeId(null);
                }}
                fitView
                minZoom={0.45}
                maxZoom={1.8}
                connectionLineType={ConnectionLineType.Bezier}
                defaultEdgeOptions={{ type: 'default' }}
              >
                <Background gap={20} size={1} color="rgba(15, 23, 42, 0.08)" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
            <div className="calendar-port-legend">
              <span className="calendar-port-type calendar-port-type-string">string</span>
              <span className="calendar-port-type calendar-port-type-number">number</span>
              <span className="calendar-port-type calendar-port-type-date">date</span>
              <span className="calendar-port-type calendar-port-type-boolean">boolean</span>
              <span className="calendar-port-type calendar-port-type-json">json</span>
            </div>
            <div className="calendar-inline-grid">
              <select value={nodeEditorType} onChange={(event) => setNodeEditorType(event.target.value as GraphNodeType)}>
                <option value="trigger">trigger</option>
                <option value="delay">delay</option>
                <option value="create_task">create_task</option>
                <option value="create_appointment">create_appointment</option>
                <option value="condition">condition</option>
                <option value="noop">noop</option>
              </select>
              <input value={nodeEditorKey} onChange={(event) => setNodeEditorKey(event.target.value)} placeholder="node key" />
            </div>
            <textarea rows={2} value={nodeEditorConfigJson} onChange={(event) => setNodeEditorConfigJson(event.target.value)} placeholder="Node options" />
            <div className="calendar-detail-actions">
              <button type="button" onClick={addGraphNode}>Add node</button>
              <button type="button" disabled={!selectedGraphNodeId} onClick={updateSelectedGraphNode}>Update selected node</button>
              <button type="button" disabled={!selectedGraphNodeId} onClick={() => selectedGraphNodeId && removeGraphNode(selectedGraphNodeId)}>Remove selected node</button>
              <button type="button" disabled={!selectedGraphEdgeId} onClick={removeSelectedGraphEdge}>Remove selected edge</button>
            </div>
            <div className="calendar-detail-actions">
              <button type="button" onClick={() => void saveGraphDraft()}>Save graph</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );

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

  if (simpleMode) {
    const rangeStart = new Date(range.fromUtc);
    const rangeEnd = new Date(range.toUtc);
    const timelineStartMs = rangeStart.getTime();
    const timelineSpanMs = Math.max(1, rangeEnd.getTime() - timelineStartMs);
    const monthDays = miniMonthDays;
    const anchorDayKey = localDayKey(anchor);
    const monthGridDays = buildMonthMatrix(anchor);
    const monthGridLabel = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const yearValue = anchor.getFullYear();

    return (
      <div className="calendar-page">
        {header}
        <main className="calendar-main calendar-main-teamup">
          <aside className="calendar-shell-sidebar">
            <div className="calendar-panel">
              <h1>{copy.calendar.title}</h1>
              <div className="calendar-field-row">
                <label>View as</label>
                <select
                  value={calendarPersonRoleId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCalendarPersonRoleId(value);
                    if (value) setOwnerRoleId(value);
                  }}
                >
                  {personRoles.length === 0 && <option value="">no roles available — go to Account</option>}
                  {personRoles.map((role) => <option key={role.roleId} value={role.roleId}>{role.label}</option>)}
                </select>
              </div>
              {calendars.length > 1 && (
                <div className="calendar-field-row">
                  <label>Calendar</label>
                  <select value={effectiveCalendarId ?? ''} onChange={(event) => setCalendarId(event.target.value || null)}>
                    {calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
                  </select>
                </div>
              )}
              <div className="calendar-mini-month">
                <div className="calendar-mini-month-header">
                  <strong>{monthGridLabel}</strong>
                </div>
                <div className="calendar-mini-month-grid">
                  {monthDays.map((day) => {
                    const dayKey = localDayKey(day);
                    const isActive = dayKey === anchorDayKey;
                    const isOutside = day.getMonth() !== anchor.getMonth();
                    return (
                      <button
                        key={dayKey}
                        type="button"
                        className={`calendar-mini-day${isActive ? ' is-active' : ''}${isOutside ? ' is-outside' : ''}`}
                        onClick={() => setAnchor(day)}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <h2 className="calendar-sidebar-title">Calendars</h2>
              <div className="calendar-sidebar-chips">
                <button
                  type="button"
                  className={`calendar-side-chip${simpleSubCalendarFilter === 'all' ? ' is-active' : ''}`}
                  onClick={() => setSimpleSubCalendarFilter('all')}
                >
                  All
                </button>
                {simpleSubCalendars.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`calendar-side-chip${simpleSubCalendarFilter === entry.id ? ' is-active' : ''}`}
                    style={{ borderColor: entry.color }}
                    onClick={() => setSimpleSubCalendarFilter(entry.id)}
                  >
                    <span className="calendar-side-chip-dot" style={{ backgroundColor: entry.color }} />
                    {entry.label}
                  </button>
                ))}
              </div>

              <div className="calendar-field-row">
                <label>Filter</label>
                <input value={simpleKeywordFilter} onChange={(event) => setSimpleKeywordFilter(event.target.value)} placeholder="by keyword" />
              </div>

              <a href="/#/calendar?calendarAdvanced=1" className="calendar-advanced-link">Open advanced tools</a>
            </div>
          </aside>

          <section className="calendar-shell-main calendar-panel">
            <div className="calendar-shell-toolbar">
              <div className="calendar-range-nav">
                <button type="button" onClick={() => setAnchor((current) => shiftAnchor(current, view, -1))}>Previous</button>
                <button type="button" onClick={() => setAnchor(new Date())}>Today</button>
                <button type="button" onClick={() => setAnchor((current) => shiftAnchor(current, view, 1))}>Next</button>
              </div>
              <p className="calendar-shell-range">{formatUtc(range.fromUtc)} - {formatUtc(range.toUtc)}</p>
              <div className="calendar-view-switch calendar-view-switch-shell">
                {VIEW_MODES.map((mode) => (
                  <button key={mode} type="button" className={view === mode ? 'is-active' : ''} onClick={() => setView(mode)}>
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {selectedMainInspector}

            {view === 'day' || view === 'week' ? (
              <div className="calendar-scheduler-grid">
                <div className="calendar-time-column">
                  {hourSlots.map((hour) => (
                    <div key={hour} className="calendar-time-cell">{String(hour).padStart(2, '0')}:00</div>
                  ))}
                </div>
                <div className="calendar-scheduler-days" style={{ gridTemplateColumns: `repeat(${schedulerDays.length}, minmax(140px, 1fr))` }}>
                  {schedulerDays.map((day, index) => (
                    <div key={localDayKey(day)} className="calendar-scheduler-day">
                      <div className="calendar-scheduler-day-header">{formatLocalDay(day)}</div>
                        <div className="calendar-scheduler-day-body">
                          {hourSlots.map((hour) => (
                            <div key={hour} className="calendar-scheduler-hour-line" />
                          ))}
                          {schedulerEventsByDay[index]?.map((entry) => {
                            const color = colorForKey(entry.row.event.ownerRoleId);
                            const isSelected = selectedEventId === entry.row.eventId;
                            return (
                              <button
                                key={entry.row.eventId + entry.row.occurrenceStartUtc}
                                type="button"
                                className={`calendar-scheduler-event${entry.isOpenEnded ? ' is-open-ended' : ''}${isSelected ? ' is-selected' : ''}`}
                                style={{
                                  top: `${entry.topPct}%`,
                                  height: `${entry.heightPct}%`,
                                  background: buildEventBackground(color, 'vertical', entry.isOpenEnded)
                                }}
                                onClick={() => setSelectedEventId(entry.row.eventId)}
                              >
                                <strong>{entry.row.event.titlePublic}</strong>
                                <span>{new Date(entry.row.occurrenceStartUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
            ) : null}

            {view === 'month' ? (
              <div className="calendar-month-grid calendar-month-grid-shell">
                {monthGridDays.map((day) => {
                  const key = localDayKey(day);
                  const rows = simpleGroupedByLocalDay.get(key) ?? [];
                    const isOutside = day.getMonth() !== anchor.getMonth();
                    return (
                      <article key={key} className={`calendar-day-card${isOutside ? ' is-outside' : ''}`}>
                        <h3>{day.getDate()}</h3>
                        <ul>
                          {rows.slice(0, 4).map((row) => (
                            <li key={row.eventId + row.occurrenceStartUtc}>
                              <button
                                type="button"
                                className={selectedEventId === row.eventId ? 'is-selected' : ''}
                                onClick={() => setSelectedEventId(row.eventId)}
                              >
                                {row.event.titlePublic}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </article>
                    );
                  })}
                </div>
            ) : null}

            {view === 'timeline' ? (
              <div className="calendar-timeline">
                {timelineRows.map((row) => (
                  <div key={row.subCalendar.id} className="calendar-timeline-row">
                    <div className="calendar-timeline-label">{row.subCalendar.label}</div>
                    <div className="calendar-timeline-track">
                      {row.items.map((item) => {
                        const rawStartMs = new Date(item.occurrenceStartUtc).getTime();
                        if (!Number.isFinite(rawStartMs)) return null;
                        const openEnded = hasOpenEndedOccurrence(item);
                        const resolvedEndMs = openEnded ? rangeEnd.getTime() : new Date(item.occurrenceEndUtc).getTime();
                        if (!Number.isFinite(resolvedEndMs)) return null;
                        const startMs = Math.max(rawStartMs, timelineStartMs);
                        const endMs = Math.min(resolvedEndMs, rangeEnd.getTime());
                          if (endMs <= timelineStartMs || startMs >= rangeEnd.getTime()) return null;
                          const left = ((startMs - timelineStartMs) / timelineSpanMs) * 100;
                          const width = Math.max(1.5, ((endMs - startMs) / timelineSpanMs) * 100);
                          return (
                            <button
                              key={item.eventId + item.occurrenceStartUtc}
                              type="button"
                              className={`calendar-timeline-event${openEnded ? ' is-open-ended' : ''}${selectedEventId === item.eventId ? ' is-selected' : ''}`}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                background: buildEventBackground(row.subCalendar.color, 'horizontal', openEnded)
                              }}
                              onClick={() => setSelectedEventId(item.eventId)}
                            >
                              {item.event.titlePublic}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                ))}
              </div>
            ) : null}

            {view === 'year' ? (
              <div className="calendar-year-grid">
                {Array.from({ length: 12 }, (_, monthIndex) => {
                  const monthStart = new Date(yearValue, monthIndex, 1, 0, 0, 0, 0);
                  const monthEnd = new Date(yearValue, monthIndex + 1, 1, 0, 0, 0, 0);
                  const spanMs = Math.max(1, monthEnd.getTime() - monthStart.getTime());
                  const monthItems = simpleFilteredOccurrences.filter((row) => {
                    const startMs = new Date(row.occurrenceStartUtc).getTime();
                    const endMs = hasOpenEndedOccurrence(row) ? monthEnd.getTime() : new Date(row.occurrenceEndUtc).getTime();
                    return endMs > monthStart.getTime() && startMs < monthEnd.getTime();
                  });
                  return (
                    <div key={monthIndex} className="calendar-year-row">
                      <div className="calendar-year-label">{monthStart.toLocaleDateString(undefined, { month: 'long' })}</div>
                      <div className="calendar-year-track">
                        {monthItems.map((item) => {
                          const rawStartMs = new Date(item.occurrenceStartUtc).getTime();
                          if (!Number.isFinite(rawStartMs)) return null;
                          const openEnded = hasOpenEndedOccurrence(item);
                          const resolvedEndMs = openEnded ? monthEnd.getTime() : new Date(item.occurrenceEndUtc).getTime();
                          if (!Number.isFinite(resolvedEndMs)) return null;
                          const startMs = Math.max(rawStartMs, monthStart.getTime());
                            const endMs = Math.min(resolvedEndMs, monthEnd.getTime());
                            const left = ((startMs - monthStart.getTime()) / spanMs) * 100;
                            const width = Math.max(1, ((endMs - startMs) / spanMs) * 100);
                            return (
                              <button
                                key={item.eventId + item.occurrenceStartUtc}
                                type="button"
                                className={`calendar-year-event${openEnded ? ' is-open-ended' : ''}${selectedEventId === item.eventId ? ' is-selected' : ''}`}
                                style={{
                                  left: `${left}%`,
                                  width: `${width}%`,
                                  background: buildEventBackground(colorForKey(item.event.ownerRoleId), 'horizontal', openEnded)
                                }}
                                onClick={() => setSelectedEventId(item.eventId)}
                              >
                                {item.event.titlePublic}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                  );
                })}
              </div>
            ) : null}

              {view === 'list' ? (
                <div className="calendar-occurrence-list">
                  {simpleFilteredOccurrences.map((row) => (
                    <article key={row.eventId + row.occurrenceStartUtc} className={'calendar-occurrence-row' + (selectedEventId === row.eventId ? ' is-selected' : '')}>
                      <button type="button" onClick={() => setSelectedEventId(row.eventId)}>
                        <strong>{row.event.titlePublic}</strong>
                        <span>{formatUtc(row.occurrenceStartUtc)} - {formatUtc(row.occurrenceEndUtc)}</span>
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}

            {error && (
              <div className="calendar-error-block">
                <p className="calendar-error">{error}</p>
                {personRoles.length === 0 && (
                  <button type="button" className="cta" onClick={() => onNavigate('account')}>
                    Go to Account →
                  </button>
                )}
              </div>
            )}
          </section>

          <aside className="calendar-shell-right">
            <section className="calendar-panel calendar-create-form">
              <h2>Add item</h2>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
              <input type="datetime-local" value={startUtcLocal} onChange={(event) => setStartUtcLocal(event.target.value)} />
              <select value={itemType} onChange={(event) => setItemType(event.target.value as 'appointment' | 'task')}>
                <option value="appointment">appointment</option>
                <option value="task">task</option>
              </select>
              <button type="button" className="cta" onClick={() => void createQuickAppointment()}>
                Add
              </button>
              {(!effectiveCalendarId || !calendarPersonRoleId) && (
                <div className="calendar-error-block">
                  <p className="calendar-error">
                    {personRoles.length === 0
                      ? 'No roles found. Create a role in your Account first.'
                      : 'Select a role above to enable adding items.'}
                  </p>
                  {personRoles.length === 0 && (
                    <button type="button" className="ghost" onClick={() => onNavigate('account')}>
                      Go to Account →
                    </button>
                  )}
                </div>
              )}
            </section>
            <section className="calendar-panel calendar-shell-meta">
              <h3>Visible items</h3>
              <p>{simpleFilteredOccurrences.length}</p>
              <h3>Conflicts</h3>
              <p>{personScopedConflicts.length}</p>
            </section>
            <section className="calendar-panel">
              <h3>Edit selected</h3>
              {!selectedEvent && <p>Select an appointment or task on the calendar.</p>}
              {selectedEvent && (
                <div className="calendar-field-row">
                  <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Title" />
                  <textarea rows={3} value={editSummary} onChange={(event) => setEditSummary(event.target.value)} placeholder="Summary" />
                  <input type="datetime-local" value={editStartUtcLocal} onChange={(event) => setEditStartUtcLocal(event.target.value)} />
                  <input type="datetime-local" value={editEndUtcLocal} onChange={(event) => setEditEndUtcLocal(event.target.value)} />
                  <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
                    <option value="planned">planned</option>
                    <option value="confirmed">confirmed</option>
                    <option value="cancelled">cancelled</option>
                    <option value="completed">completed</option>
                  </select>
                  <div className="calendar-detail-actions">
                    <button type="button" onClick={() => void saveSelectedItem()}>Save</button>
                    <button type="button" onClick={() => void removeSelectedItem()}>Remove</button>
                  </div>
                </div>
              )}
            </section>
          </aside>
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
            <label>View as</label>
            <select
              value={calendarPersonRoleId}
              onChange={(event) => {
                const value = event.target.value;
                setCalendarPersonRoleId(value);
                if (value) setOwnerRoleId(value);
              }}
            >
              {personRoles.length === 0 && <option value="">no roles available — go to Account</option>}
              {personRoles.map((role) => <option key={role.roleId} value={role.roleId}>{role.label}</option>)}
            </select>
          </div>
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
          {selectedMainInspector}
            {view === 'month' && (
              <div className="calendar-month-grid">
                {Array.from(groupedByDay.keys()).sort().map((day) => (
                  <article key={day} className="calendar-day-card">
                    <h3>{day}</h3>
                    <ul>
                      {(groupedByDay.get(day) ?? []).slice(0, 6).map((row) => (
                        <li key={row.eventId + '-' + row.occurrenceStartUtc}>
                          <button
                            type="button"
                            className={selectedEventId === row.eventId ? 'is-selected' : ''}
                            onClick={() => setSelectedEventId(row.eventId)}
                          >
                            {row.event.titlePublic} ({row.event.itemType})
                          </button>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          {view !== 'month' && (
            <div className="calendar-occurrence-list">
              {personScopedOccurrences.map((row) => (
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
            <h3>Conflicts ({personScopedConflicts.length})</h3>
            <ul>
              {personScopedConflicts.slice(0, 20).map((conflict) => (
                <li key={conflict.eventId + '-' + conflict.startUtc}>{conflict.titlePublic}: {formatUtc(conflict.startUtc)} - {formatUtc(conflict.endUtc)}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="calendar-detail-panel">
          <div className="calendar-create-form">
            <h2>Create item</h2>
            <div className="calendar-field-row">
              <label>Person owner</label>
              <select
                value={calendarPersonRoleId}
                onChange={(event) => {
                  const value = event.target.value;
                  setCalendarPersonRoleId(value);
                  setOwnerRoleId(value || null);
                }}
              >
                {personRoles.length === 0 && <option value="">no person roles available</option>}
                {personRoles.map((role) => <option key={role.roleId} value={role.roleId}>{role.label}</option>)}
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
            <label><input type="checkbox" checked={createWithGraph} onChange={(event) => setCreateWithGraph(event.target.checked)} /> attach graph (optional)</label>
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
            {(!effectiveCalendarId || !calendarPersonRoleId) && (
              <p className="calendar-error">Calendar and person role must be available before creating items.</p>
            )}
          </div>
          <h2>Item Detail</h2>
          {!selectedEvent && <p>Select an item from the board.</p>}
          {selectedEvent && (
            <>
              <h3>Edit item</h3>
              <div className="calendar-field-row">
                <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Title" />
                <textarea rows={3} value={editSummary} onChange={(event) => setEditSummary(event.target.value)} placeholder="Summary" />
                <div className="calendar-inline-grid">
                  <input type="datetime-local" value={editStartUtcLocal} onChange={(event) => setEditStartUtcLocal(event.target.value)} />
                  <input type="datetime-local" value={editEndUtcLocal} onChange={(event) => setEditEndUtcLocal(event.target.value)} />
                </div>
                <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
                  <option value="planned">planned</option>
                  <option value="confirmed">confirmed</option>
                  <option value="cancelled">cancelled</option>
                  <option value="completed">completed</option>
                </select>
              </div>
              <p>Type: {selectedEvent.itemType}</p>
              {selectedEvent.taskState && <p>Task state: {selectedEvent.taskState}</p>}
              <div className="calendar-detail-actions">
                <button type="button" onClick={() => void saveSelectedItem()}>Save</button>
                {pendingConflictSave && <button type="button" onClick={() => void saveSelectedItemAllowConflicts()}>Save anyway</button>}
                {selectedEvent.itemType === 'task' && (
                  <>
                    <button type="button" onClick={() => void runTaskCompletionAction('fulfilled', false)}>Fulfill</button>
                    <button type="button" onClick={() => void runTaskCompletionAction('fulfilled', true)}>Fulfill + run graph</button>
                    <button type="button" onClick={() => void runTaskCompletionAction('dismissed', false)}>Dismiss</button>
                    <button type="button" onClick={() => void runTaskCompletionAction('dismissed', true)}>Dismiss + run graph</button>
                  </>
                )}
                <button type="button" onClick={() => void runSelectedGraphManual()}>Run graph</button>
                <button type="button" onClick={() => void removeSelectedItem()}>Remove</button>
              </div>
              <div className="calendar-share-panel">
                <h3>Graph editor</h3>
                <div className="calendar-inline-grid">
                  <select value={graphTemplateKey} onChange={(event) => applyTemplate(event.target.value)}>
                    <option value="">template</option>
                    {graphTemplateOptions.map((template) => (
                      <option key={template.templateKey} value={template.templateKey}>{template.name}</option>
                    ))}
                  </select>
                  <select value={graphStatus} onChange={(event) => setGraphStatus(event.target.value as 'draft' | 'active' | 'archived')}>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
                <textarea rows={4} value={graphConfigJson} onChange={(event) => setGraphConfigJson(event.target.value)} placeholder="Graph options" />
                <p>Use the visual graph editor in the main calendar panel.</p>
                <button
                  type="button"
                  onClick={() => void saveGraphDraft()}
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
