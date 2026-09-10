using Recreatio.Api.Data.Hortus;

namespace Recreatio.Api.Services.Hortus;

/// <summary>
/// Decides who may hold which part of the place and when.
///
/// Three rules, applied to every requested item:
///   1. Nothing exclusive (an admin block, or a booking of an enclosing part) may cover the
///      resource or anything above it.
///   2. The resource must have a free seat: the number of distinct groups holding it — counting
///      groups that hold an enclosing part, because holding the big house means holding its
///      chapel — must stay within the resource's capacity. Capacity 1 is exclusive; the chapel
///      and the dining room are the parts that get 2.
///   3. Nothing inside may be taken: booking the whole place, or a whole house, requires its
///      subtree to be free, so a group never rents "everything" while a stranger sits in the chapel.
///
/// Every interval is compared with its technical minutes included, so the cleaning window after
/// one group and the preparation window before the next can never land on the same room at once.
/// </summary>
public static class HortusAvailabilityEngine
{
    /// <summary>A resource as the engine needs it: its place in the tree and its capacity.</summary>
    public sealed record ResourceNode(Guid Id, Guid? ParentId, string Slug, string Name, int Capacity);

    /// <summary>An interval a group already holds, padded with its technical minutes.</summary>
    public sealed record Occupancy(
        Guid ReservationId,
        Guid ItemId,
        Guid ResourceId,
        string ReservationCode,
        string Status,
        string Kind,
        DateTimeOffset StartUtc,
        DateTimeOffset EndUtc,
        DateTimeOffset BlockedFromUtc,
        DateTimeOffset BlockedUntilUtc,
        bool IsExclusive);

    /// <summary>An interval somebody is asking for.</summary>
    public sealed record Candidate(
        Guid ResourceId,
        DateTimeOffset StartUtc,
        DateTimeOffset EndUtc,
        int TechnicalMinutesBefore,
        int TechnicalMinutesAfter,
        bool IsExclusive)
    {
        public DateTimeOffset BlockedFromUtc => StartUtc.AddMinutes(-TechnicalMinutesBefore);

        public DateTimeOffset BlockedUntilUtc => EndUtc.AddMinutes(TechnicalMinutesAfter);
    }

    public sealed record Conflict(
        Guid ResourceId,
        string ResourceName,
        string Reason,
        Guid? BlockingReservationId,
        string? BlockingReservationCode,
        string? BlockingStatus,
        DateTimeOffset FromUtc,
        DateTimeOffset UntilUtc,
        string Message);

    public static class ConflictReasons
    {
        /// <summary>An admin block, or a booking of the part above, takes the whole thing.</summary>
        public const string Exclusive = "exclusive";

        /// <summary>Every seat of a shared part is already taken.</summary>
        public const string Capacity = "capacity";

        /// <summary>Something inside the requested part is booked by somebody else.</summary>
        public const string Subtree = "subtree";
    }

    /// <summary>Ancestor and descendant lookups over the resource tree, built once per request.</summary>
    public sealed class ResourceTree
    {
        private readonly Dictionary<Guid, ResourceNode> _byId;
        private readonly Dictionary<Guid, List<Guid>> _childrenByParent;
        private readonly Dictionary<Guid, IReadOnlyList<Guid>> _ancestorCache = new();
        private readonly Dictionary<Guid, IReadOnlyList<Guid>> _descendantCache = new();

        public ResourceTree(IEnumerable<ResourceNode> nodes)
        {
            _byId = nodes.ToDictionary(x => x.Id);
            _childrenByParent = _byId.Values
                .Where(x => x.ParentId.HasValue && _byId.ContainsKey(x.ParentId.Value))
                .GroupBy(x => x.ParentId!.Value)
                .ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());
        }

        public IReadOnlyCollection<ResourceNode> Nodes => _byId.Values;

        public bool TryGet(Guid id, out ResourceNode node) => _byId.TryGetValue(id, out node!);

        public ResourceNode? Find(Guid id) => _byId.TryGetValue(id, out var node) ? node : null;

        /// <summary>Parent, grandparent, up to the root. Cycles in the stored data are cut off.</summary>
        public IReadOnlyList<Guid> Ancestors(Guid id)
        {
            if (_ancestorCache.TryGetValue(id, out var cached))
            {
                return cached;
            }

            var result = new List<Guid>();
            var seen = new HashSet<Guid> { id };
            var current = _byId.TryGetValue(id, out var node) ? node.ParentId : null;
            while (current.HasValue && seen.Add(current.Value) && _byId.TryGetValue(current.Value, out var parent))
            {
                result.Add(parent.Id);
                current = parent.ParentId;
            }

            _ancestorCache[id] = result;
            return result;
        }

        /// <summary>Everything strictly below the resource.</summary>
        public IReadOnlyList<Guid> Descendants(Guid id)
        {
            if (_descendantCache.TryGetValue(id, out var cached))
            {
                return cached;
            }

            var result = new List<Guid>();
            var queue = new Queue<Guid>();
            var seen = new HashSet<Guid> { id };
            queue.Enqueue(id);
            while (queue.Count > 0)
            {
                var current = queue.Dequeue();
                if (!_childrenByParent.TryGetValue(current, out var children))
                {
                    continue;
                }

                foreach (var child in children.Where(child => seen.Add(child)))
                {
                    result.Add(child);
                    queue.Enqueue(child);
                }
            }

            _descendantCache[id] = result;
            return result;
        }

        /// <summary>The resource itself plus everything above it — the set an item makes busy upwards.</summary>
        public IReadOnlyList<Guid> SelfAndAncestors(Guid id) => new[] { id }.Concat(Ancestors(id)).ToList();

        public string NameOf(Guid id) => _byId.TryGetValue(id, out var node) ? node.Name : "—";

        public int CapacityOf(Guid id) => _byId.TryGetValue(id, out var node) ? Math.Max(1, node.Capacity) : 1;
    }

    /// <summary>
    /// Checks a whole reservation at once. Items of <paramref name="candidates"/> never conflict with
    /// each other: one group may hold the big house and its chapel in the same breath.
    /// </summary>
    public static IReadOnlyList<Conflict> FindConflicts(
        ResourceTree tree,
        IReadOnlyList<Occupancy> existing,
        IReadOnlyList<Candidate> candidates)
    {
        var conflicts = new List<Conflict>();
        foreach (var candidate in candidates)
        {
            conflicts.AddRange(FindConflicts(tree, existing, candidate));
        }

        return Deduplicate(conflicts);
    }

    private static IEnumerable<Conflict> FindConflicts(
        ResourceTree tree,
        IReadOnlyList<Occupancy> existing,
        Candidate candidate)
    {
        var resourceName = tree.NameOf(candidate.ResourceId);
        var from = candidate.BlockedFromUtc;
        var until = candidate.BlockedUntilUtc;
        if (until <= from)
        {
            yield break;
        }

        var ancestors = new HashSet<Guid>(tree.Ancestors(candidate.ResourceId));
        var descendants = new HashSet<Guid>(tree.Descendants(candidate.ResourceId));

        // Occupancies that make the requested resource busy: on it, or on any part above it.
        var covering = existing
            .Where(x => x.ResourceId == candidate.ResourceId || ancestors.Contains(x.ResourceId))
            .Where(x => Overlaps(x.BlockedFromUtc, x.BlockedUntilUtc, from, until))
            .ToList();

        // Rule 1 — an exclusive hold above or on the resource beats any capacity. A hold on an
        // enclosing part is exclusive whenever that part is not itself shareable; a hold on the
        // resource itself is left to rule 2, which words it as a plain "already taken".
        var exclusive = covering.FirstOrDefault(x =>
            x.IsExclusive ||
            (x.ResourceId != candidate.ResourceId && tree.CapacityOf(x.ResourceId) == 1));
        if (exclusive is not null)
        {
            yield return new Conflict(
                candidate.ResourceId,
                resourceName,
                ConflictReasons.Exclusive,
                exclusive.ReservationId,
                exclusive.ReservationCode,
                exclusive.Status,
                Max(exclusive.BlockedFromUtc, from),
                Min(exclusive.BlockedUntilUtc, until),
                exclusive.Kind == HortusReservationKinds.Block
                    ? $"{resourceName}: w tym czasie trwa blokada techniczna."
                    : $"{resourceName}: część nadrzędna ({tree.NameOf(exclusive.ResourceId)}) jest już zajęta.");
            yield break;
        }

        // Rule 2 — the resource itself must keep a free seat over the whole requested interval.
        var capacity = tree.CapacityOf(candidate.ResourceId);
        foreach (var segment in Segments(covering, from, until))
        {
            var groups = covering
                .Where(x => Overlaps(x.BlockedFromUtc, x.BlockedUntilUtc, segment.From, segment.Until))
                .Select(x => x.ReservationId)
                .Distinct()
                .ToList();

            // An exclusive request — a technical block — tolerates nobody, whatever the capacity.
            var fits = candidate.IsExclusive
                ? groups.Count == 0
                : groups.Count + 1 <= capacity;
            if (fits)
            {
                continue;
            }

            var blocking = covering.First(x => x.ReservationId == groups[0]);
            yield return new Conflict(
                candidate.ResourceId,
                resourceName,
                ConflictReasons.Capacity,
                blocking.ReservationId,
                blocking.ReservationCode,
                blocking.Status,
                segment.From,
                segment.Until,
                capacity == 1 || candidate.IsExclusive
                    ? $"{resourceName}: termin jest już zajęty."
                    : $"{resourceName}: limit {capacity} grup jednocześnie został wyczerpany.");
            yield break;
        }

        // Rule 3 — taking a part means taking everything inside it.
        var inside = existing
            .Where(x => descendants.Contains(x.ResourceId))
            .FirstOrDefault(x => Overlaps(x.BlockedFromUtc, x.BlockedUntilUtc, from, until));
        if (inside is not null)
        {
            yield return new Conflict(
                candidate.ResourceId,
                resourceName,
                ConflictReasons.Subtree,
                inside.ReservationId,
                inside.ReservationCode,
                inside.Status,
                Max(inside.BlockedFromUtc, from),
                Min(inside.BlockedUntilUtc, until),
                $"{resourceName}: część wewnętrzna ({tree.NameOf(inside.ResourceId)}) jest w tym czasie zajęta.");
        }
    }

    private readonly record struct Segment(DateTimeOffset From, DateTimeOffset Until);

    /// <summary>
    /// Cuts [from, until) at every point where the set of overlapping holds changes, so capacity is
    /// judged per moment rather than per request: two half-overlapping groups may each be fine while
    /// the middle of the interval is not.
    /// </summary>
    private static IEnumerable<Segment> Segments(IReadOnlyList<Occupancy> covering, DateTimeOffset from, DateTimeOffset until)
    {
        var points = new SortedSet<DateTimeOffset> { from, until };
        foreach (var occupancy in covering)
        {
            if (occupancy.BlockedFromUtc > from && occupancy.BlockedFromUtc < until)
            {
                points.Add(occupancy.BlockedFromUtc);
            }

            if (occupancy.BlockedUntilUtc > from && occupancy.BlockedUntilUtc < until)
            {
                points.Add(occupancy.BlockedUntilUtc);
            }
        }

        var ordered = points.ToList();
        for (var i = 0; i < ordered.Count - 1; i++)
        {
            yield return new Segment(ordered[i], ordered[i + 1]);
        }
    }

    private static IReadOnlyList<Conflict> Deduplicate(IReadOnlyList<Conflict> conflicts)
    {
        var seen = new HashSet<(Guid, string, Guid?)>();
        var result = new List<Conflict>();
        foreach (var conflict in conflicts)
        {
            if (seen.Add((conflict.ResourceId, conflict.Reason, conflict.BlockingReservationId)))
            {
                result.Add(conflict);
            }
        }

        return result;
    }

    public static bool Overlaps(DateTimeOffset aFrom, DateTimeOffset aUntil, DateTimeOffset bFrom, DateTimeOffset bUntil) =>
        aFrom < bUntil && bFrom < aUntil;

    private static DateTimeOffset Max(DateTimeOffset a, DateTimeOffset b) => a > b ? a : b;

    private static DateTimeOffset Min(DateTimeOffset a, DateTimeOffset b) => a < b ? a : b;

    /// <summary>Turns arrival and departure dates into the instants the group is actually present.</summary>
    public static (DateTimeOffset StartUtc, DateTimeOffset EndUtc) ResolveNight(
        DateOnly arrival,
        DateOnly departure,
        TimeOnly checkIn,
        TimeOnly checkOut,
        TimeZoneInfo timeZone) =>
        (ToInstant(arrival, checkIn, timeZone), ToInstant(departure, checkOut, timeZone));

    /// <summary>Turns a day and an hour range into instants.</summary>
    public static (DateTimeOffset StartUtc, DateTimeOffset EndUtc) ResolveSlot(
        DateOnly day,
        TimeOnly from,
        TimeOnly to,
        TimeZoneInfo timeZone)
    {
        var start = ToInstant(day, from, timeZone);
        // A slot ending at or before its start runs past midnight, e.g. a vigil from 22:00 to 01:00.
        var end = to > from
            ? ToInstant(day, to, timeZone)
            : ToInstant(day.AddDays(1), to, timeZone);
        return (start, end);
    }

    /// <summary>
    /// Local wall-clock time to an absolute instant. Clock changes are resolved the friendly way:
    /// a time that does not exist moves forward, a time that happens twice takes the first pass.
    /// </summary>
    public static DateTimeOffset ToInstant(DateOnly date, TimeOnly time, TimeZoneInfo timeZone)
    {
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);
        if (timeZone.IsInvalidTime(local))
        {
            local = local.AddHours(1);
        }

        var offset = timeZone.IsAmbiguousTime(local)
            ? timeZone.GetAmbiguousTimeOffsets(local).Max()
            : timeZone.GetUtcOffset(local);
        return new DateTimeOffset(local, offset);
    }

    public static TimeZoneInfo ResolveTimeZone(string? timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            return TimeZoneInfo.Utc;
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }
}
