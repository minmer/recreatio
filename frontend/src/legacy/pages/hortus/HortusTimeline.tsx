import { useMemo } from 'react';
import type { HortusOccupancyView } from '../../lib/api';
import { addDays, formatDayLabel, formatDateTime, type HortusResourceNode } from './hortusTime';

interface DraftBar {
  resourceId: string;
  startUtc: string;
  endUtc: string;
  label: string;
}

/**
 * One row per part of the place, one continuous time axis across the window. Nights and hour slots
 * are the same kind of bar, only longer, so a house held for three nights and a chapel held for an
 * hour can be read against each other at a glance.
 */
export function HortusTimeline({
  resources,
  occupancies,
  from,
  days,
  timeZone,
  drafts = [],
  showTechnical = true,
  onSelect
}: {
  resources: HortusResourceNode[];
  occupancies: HortusOccupancyView[];
  from: string;
  days: number;
  timeZone: string;
  drafts?: DraftBar[];
  showTechnical?: boolean;
  onSelect?: (occupancy: HortusOccupancyView) => void;
}) {
  const dayList = useMemo(() => Array.from({ length: days }, (_, index) => addDays(from, index)), [from, days]);

  const { windowStart, windowSpan } = useMemo(() => {
    const [year, month, day] = from.split('-').map(Number);
    const start = new Date(year, month - 1, day).getTime();
    const end = new Date(year, month - 1, day + days).getTime();
    return { windowStart: start, windowSpan: end - start };
  }, [from, days]);

  const percent = (iso: string) => ((new Date(iso).getTime() - windowStart) / windowSpan) * 100;

  const byResource = useMemo(() => {
    const map = new Map<string, HortusOccupancyView[]>();
    for (const occupancy of occupancies) {
      const bucket = map.get(occupancy.resourceId);
      if (bucket) {
        bucket.push(occupancy);
      } else {
        map.set(occupancy.resourceId, [occupancy]);
      }
    }
    return map;
  }, [occupancies]);

  const draftsByResource = useMemo(() => {
    const map = new Map<string, DraftBar[]>();
    for (const draft of drafts) {
      const bucket = map.get(draft.resourceId);
      if (bucket) {
        bucket.push(draft);
      } else {
        map.set(draft.resourceId, [draft]);
      }
    }
    return map;
  }, [drafts]);

  return (
    <div className="hortus-timeline">
      <div className="hortus-timeline-head">
        <div className="hortus-timeline-corner" />
        <div className="hortus-timeline-days">
          {dayList.map((date) => {
            const label = formatDayLabel(date);
            return (
              <div key={date} className={`hortus-timeline-day${label.isWeekend ? ' is-weekend' : ''}`}>
                <span className="hortus-timeline-weekday">{label.weekday}</span>
                <span className="hortus-timeline-daynum">{label.day}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hortus-timeline-body">
        {resources.map((resource) => {
          const bars = byResource.get(resource.id) ?? [];
          const resourceDrafts = draftsByResource.get(resource.id) ?? [];
          return (
            <div key={resource.id} className="hortus-timeline-row">
              <div className="hortus-timeline-label" style={{ paddingLeft: `${0.6 + resource.depth * 0.85}rem` }}>
                <span className="hortus-timeline-name">{resource.name}</span>
                {resource.capacity > 1 ? (
                  <span className="hortus-chip hortus-chip-capacity" title="Ile grup naraz">
                    {resource.capacity} grupy
                  </span>
                ) : null}
              </div>
              <div className={`hortus-timeline-track hortus-color-${resource.colorToken}`}>
                {dayList.map((date, index) => (
                  <span
                    key={date}
                    className="hortus-timeline-gridline"
                    style={{ left: `${(index / days) * 100}%`, width: `${100 / days}%` }}
                  />
                ))}

                {bars.map((occupancy, index) => {
                  const left = Math.max(0, percent(showTechnical ? occupancy.blockedFromUtc : occupancy.startUtc));
                  const right = Math.min(100, percent(showTechnical ? occupancy.blockedUntilUtc : occupancy.endUtc));
                  if (right <= 0 || left >= 100) {
                    return null;
                  }

                  const coreLeft = Math.max(0, percent(occupancy.startUtc));
                  const coreRight = Math.min(100, percent(occupancy.endUtc));
                  const title = `${occupancy.label ?? 'Zajęte'} · ${formatDateTime(occupancy.startUtc, timeZone)} – ${formatDateTime(occupancy.endUtc, timeZone)}`;
                  return (
                    <button
                      key={`${occupancy.resourceId}-${occupancy.startUtc}-${index}`}
                      type="button"
                      className={`hortus-bar hortus-bar-${occupancy.status}${occupancy.kind === 'block' ? ' is-block' : ''}`}
                      style={{ left: `${left}%`, width: `${Math.max(right - left, 0.6)}%` }}
                      title={title}
                      onClick={onSelect ? () => onSelect(occupancy) : undefined}
                      disabled={!onSelect}
                    >
                      {/* The lighter shoulders are the technical time; the solid core is the group itself. */}
                      <span
                        className="hortus-bar-core"
                        style={{
                          left: `${((coreLeft - left) / Math.max(right - left, 0.0001)) * 100}%`,
                          width: `${((coreRight - coreLeft) / Math.max(right - left, 0.0001)) * 100}%`
                        }}
                      />
                      <span className="hortus-bar-label">{occupancy.label ?? 'Zajęte'}</span>
                    </button>
                  );
                })}

                {resourceDrafts.map((draft, index) => {
                  const left = Math.max(0, percent(draft.startUtc));
                  const right = Math.min(100, percent(draft.endUtc));
                  if (right <= 0 || left >= 100) {
                    return null;
                  }

                  return (
                    <span
                      key={`draft-${index}`}
                      className="hortus-bar hortus-bar-draft"
                      style={{ left: `${left}%`, width: `${Math.max(right - left, 0.6)}%` }}
                      title={draft.label}
                    >
                      <span className="hortus-bar-label">{draft.label}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
        {resources.length === 0 ? <p className="hortus-empty">Brak części do pokazania.</p> : null}
      </div>

      <div className="hortus-legend">
        <span className="hortus-legend-item"><i className="hortus-swatch hortus-swatch-confirmed" /> potwierdzone</span>
        <span className="hortus-legend-item"><i className="hortus-swatch hortus-swatch-pending" /> oczekujące</span>
        <span className="hortus-legend-item"><i className="hortus-swatch hortus-swatch-block" /> przerwa techniczna</span>
        <span className="hortus-legend-item"><i className="hortus-swatch hortus-swatch-draft" /> Twój wybór</span>
      </div>
    </div>
  );
}
