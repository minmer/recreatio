import type { HortusPlaceView, HortusResourceView } from '../../lib/api';
import { bookingUnitLabel, formatMinutes, shortTime, type HortusResourceNode } from './hortusTime';
import { createDraftItem, type HortusDraftItem } from './hortusDraft';

/**
 * The basket: which parts of the place a group wants, each with its own nights or hours. The
 * coordinator gets two extra fields per row — the technical minutes — because only the coordinator
 * knows when a room needs longer than usual.
 */
export function HortusItemEditor({
  resources,
  place,
  items,
  onChange,
  isAdmin = false
}: {
  resources: HortusResourceNode[];
  place: HortusPlaceView;
  items: HortusDraftItem[];
  onChange: (items: HortusDraftItem[]) => void;
  isAdmin?: boolean;
}) {
  const bookable = resources.filter((resource) => resource.isActive && (isAdmin || resource.isPubliclyBookable));
  const byId = new Map(bookable.map((resource) => [resource.id, resource] as const));

  const update = (key: string, patch: Partial<HortusDraftItem>) => {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const remove = (key: string) => onChange(items.filter((item) => item.key !== key));

  const add = (resource: HortusResourceView) => onChange([...items, createDraftItem(resource, place)]);

  return (
    <div className="hortus-basket">
      <div className="hortus-basket-add">
        <label htmlFor="hortus-add-resource">Dodaj część miejsca</label>
        <select
          id="hortus-add-resource"
          value=""
          onChange={(event) => {
            const resource = byId.get(event.target.value);
            if (resource) add(resource);
          }}
        >
          <option value="">Wybierz…</option>
          {bookable.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {'— '.repeat(resource.depth)}
              {resource.name} ({bookingUnitLabel(resource.bookingUnit)})
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <p className="hortus-empty">
          Nic jeszcze nie wybrano. Możesz zarezerwować całe Hortus Dei albo tylko pojedyncze części —
          kaplicę, jadalnię czy miejsce na grilla.
        </p>
      ) : null}

      <ul className="hortus-basket-list">
        {items.map((item) => {
          const resource = byId.get(item.resourceId);
          const allowsNight = !resource || resource.bookingUnit !== 'slot';
          const allowsSlot = !resource || resource.bookingUnit !== 'night';
          return (
            <li key={item.key} className="hortus-basket-item">
              <div className="hortus-basket-item-head">
                <strong>{resource?.name ?? 'Część miejsca'}</strong>
                <button type="button" className="hortus-link-button" onClick={() => remove(item.key)}>
                  usuń
                </button>
              </div>

              {allowsNight && allowsSlot ? (
                <div className="hortus-unit-switch" role="group" aria-label="Sposób rezerwacji">
                  <button
                    type="button"
                    className={item.unit === 'night' ? 'is-active' : ''}
                    onClick={() => update(item.key, { unit: 'night' })}
                  >
                    Noclegi
                  </button>
                  <button
                    type="button"
                    className={item.unit === 'slot' ? 'is-active' : ''}
                    onClick={() => update(item.key, { unit: 'slot' })}
                  >
                    Godziny
                  </button>
                </div>
              ) : null}

              {item.unit === 'night' ? (
                <div className="hortus-field-row">
                  <label>
                    Przyjazd
                    <input
                      type="date"
                      value={item.startDate}
                      onChange={(event) => update(item.key, { startDate: event.target.value })}
                    />
                  </label>
                  <label>
                    Wyjazd
                    <input
                      type="date"
                      value={item.endDate}
                      onChange={(event) => update(item.key, { endDate: event.target.value })}
                    />
                  </label>
                  <p className="hortus-hint">
                    Zakwaterowanie od {shortTime(place.checkInTime)}, wyjazd do {shortTime(place.checkOutTime)}.
                  </p>
                </div>
              ) : (
                <div className="hortus-field-row">
                  <label>
                    Dzień
                    <input
                      type="date"
                      value={item.startDate}
                      onChange={(event) => update(item.key, { startDate: event.target.value })}
                    />
                  </label>
                  <label>
                    Od
                    <input
                      type="time"
                      value={item.startTime}
                      onChange={(event) => update(item.key, { startTime: event.target.value })}
                    />
                  </label>
                  <label>
                    Do
                    <input
                      type="time"
                      value={item.endTime}
                      onChange={(event) => update(item.key, { endTime: event.target.value })}
                    />
                  </label>
                </div>
              )}

              {resource ? (
                <p className="hortus-hint">
                  {resource.capacity > 1
                    ? `Ta część może służyć ${resource.capacity} grupom naraz.`
                    : 'Ta część jest rezerwowana na wyłączność.'}
                  {resource.technicalMinutesAfter > 0
                    ? ` Po zakończeniu rezerwujemy ${formatMinutes(resource.technicalMinutesAfter)} na sprzątanie.`
                    : ''}
                </p>
              ) : null}

              {isAdmin ? (
                <div className="hortus-field-row hortus-field-row-technical">
                  <label>
                    Czas techniczny przed (min)
                    <input
                      type="number"
                      min={0}
                      step={15}
                      placeholder={`${resource?.technicalMinutesBefore ?? 0}`}
                      value={item.technicalMinutesBefore ?? ''}
                      onChange={(event) =>
                        update(item.key, {
                          technicalMinutesBefore: event.target.value === '' ? null : Number(event.target.value)
                        })
                      }
                    />
                  </label>
                  <label>
                    Czas techniczny po (min)
                    <input
                      type="number"
                      min={0}
                      step={15}
                      placeholder={`${resource?.technicalMinutesAfter ?? 0}`}
                      value={item.technicalMinutesAfter ?? ''}
                      onChange={(event) =>
                        update(item.key, {
                          technicalMinutesAfter: event.target.value === '' ? null : Number(event.target.value)
                        })
                      }
                    />
                  </label>
                  <label className="hortus-field-wide">
                    Notatka do pozycji
                    <input
                      type="text"
                      value={item.note}
                      maxLength={400}
                      onChange={(event) => update(item.key, { note: event.target.value })}
                    />
                  </label>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
