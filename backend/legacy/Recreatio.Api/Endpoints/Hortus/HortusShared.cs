using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Hortus;
using Recreatio.Api.Data.Pilgrimage;
using Recreatio.Api.Services.Hortus;

namespace Recreatio.Api.Endpoints.Hortus;

/// <summary>
/// Loading, validation and mapping shared by the public reservation page and the coordinator panel.
/// </summary>
internal static class HortusShared
{
    public const string DefaultPlaceSlug = "hortus-dei";
    public const string AdminScope = "hortus-dei";

    /// <summary>Widest technical window we ever honour, and the slack used when pre-filtering in SQL.</summary>
    public const int MaxTechnicalMinutes = 7 * 24 * 60;

    private const int MaxItemsPerReservation = 40;
    private const int MaxHorizonDays = 730;

    private static readonly TimeSpan QueryPadding = TimeSpan.FromDays(8);

    // Ambiguous characters (0/O, 1/I) are left out so a code can be read over the phone.
    private const string CodeAlphabet = "ACDEFGHJKLMNPQRTUVWXY2346789";

    public static async Task<HortusPlace?> FindPlaceAsync(RecreatioDbContext db, string? slug, CancellationToken ct)
    {
        var normalized = NormalizeSlug(slug) ?? DefaultPlaceSlug;
        return await db.HortusPlaces.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == normalized, ct);
    }

    public static async Task<List<HortusResource>> LoadResourcesAsync(RecreatioDbContext db, Guid placeId, CancellationToken ct) =>
        await db.HortusResources.AsNoTracking()
            .Where(x => x.PlaceId == placeId)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .ToListAsync(ct);

    public static HortusAvailabilityEngine.ResourceTree BuildTree(IEnumerable<HortusResource> resources) =>
        new(resources.Select(x => new HortusAvailabilityEngine.ResourceNode(x.Id, x.ParentId, x.Slug, x.Name, x.Capacity)));

    /// <summary>
    /// Every hold that touches the window. Technical padding is applied in memory — SQL only
    /// pre-filters with a generous margin — so the numbers stay exact whatever the padding is.
    /// </summary>
    public static async Task<List<HortusAvailabilityEngine.Occupancy>> LoadOccupanciesAsync(
        RecreatioDbContext db,
        Guid placeId,
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc,
        bool includePending,
        Guid? excludeReservationId,
        CancellationToken ct)
    {
        var lowerBound = fromUtc - QueryPadding;
        var upperBound = toUtc + QueryPadding;

        var rows = await (
            from item in db.HortusReservationItems.AsNoTracking()
            join reservation in db.HortusReservations.AsNoTracking() on item.ReservationId equals reservation.Id
            where reservation.PlaceId == placeId
                && item.EndUtc >= lowerBound
                && item.StartUtc <= upperBound
                && (reservation.Status == HortusReservationStatuses.Confirmed
                    || (includePending && reservation.Status == HortusReservationStatuses.Pending))
            select new
            {
                item.Id,
                item.ReservationId,
                item.ResourceId,
                item.StartUtc,
                item.EndUtc,
                item.TechnicalMinutesBefore,
                item.TechnicalMinutesAfter,
                item.IsExclusive,
                reservation.Code,
                reservation.Status,
                reservation.Kind
            }).ToListAsync(ct);

        var occupancies = new List<HortusAvailabilityEngine.Occupancy>(rows.Count);
        foreach (var row in rows)
        {
            if (excludeReservationId.HasValue && row.ReservationId == excludeReservationId.Value)
            {
                continue;
            }

            var blockedFrom = row.StartUtc.AddMinutes(-ClampTechnical(row.TechnicalMinutesBefore));
            var blockedUntil = row.EndUtc.AddMinutes(ClampTechnical(row.TechnicalMinutesAfter));
            if (!HortusAvailabilityEngine.Overlaps(blockedFrom, blockedUntil, fromUtc, toUtc))
            {
                continue;
            }

            occupancies.Add(new HortusAvailabilityEngine.Occupancy(
                row.ReservationId,
                row.Id,
                row.ResourceId,
                row.Code,
                row.Status,
                row.Kind,
                row.StartUtc,
                row.EndUtc,
                blockedFrom,
                blockedUntil,
                row.IsExclusive || row.Kind == HortusReservationKinds.Block));
        }

        return occupancies;
    }

    /// <summary>
    /// Turns requested nights and hour ranges into concrete intervals. Returns false with a message
    /// the page can show as-is; the caller never has to interpret half-built items.
    /// </summary>
    public static bool TryResolveItems(
        HortusPlace place,
        IReadOnlyList<HortusResource> resources,
        IReadOnlyList<HortusReservationItemRequest>? requests,
        bool isAdmin,
        bool isExclusive,
        out List<HortusReservationItem> items,
        out string? error)
    {
        items = [];
        error = null;

        if (requests is null || requests.Count == 0)
        {
            error = "Wybierz przynajmniej jedną część miejsca.";
            return false;
        }

        if (requests.Count > MaxItemsPerReservation)
        {
            error = $"Jedna rezerwacja może obejmować najwyżej {MaxItemsPerReservation} pozycji.";
            return false;
        }

        var timeZone = HortusAvailabilityEngine.ResolveTimeZone(place.TimeZoneId);
        var byId = resources.ToDictionary(x => x.Id);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timeZone).DateTime);

        foreach (var request in requests)
        {
            if (!byId.TryGetValue(request.ResourceId, out var resource) || !resource.IsActive)
            {
                error = "Wybrana część miejsca jest niedostępna.";
                return false;
            }

            if (!isAdmin && !resource.IsPubliclyBookable)
            {
                error = $"{resource.Name}: tę część rezerwuje wyłącznie koordynator.";
                return false;
            }

            var unit = NormalizeUnit(request.Unit);
            if (unit is null || !HortusBookingUnits.Allows(resource.BookingUnit, unit))
            {
                error = resource.BookingUnit == HortusBookingUnits.Night
                    ? $"{resource.Name}: rezerwujemy na noclegi, nie na godziny."
                    : $"{resource.Name}: rezerwujemy na godziny, nie na noclegi.";
                return false;
            }

            DateOnly startDate = request.StartDate;
            DateOnly endDate;
            DateTimeOffset startUtc;
            DateTimeOffset endUtc;

            if (unit == HortusBookingUnits.Night)
            {
                endDate = request.EndDate ?? startDate.AddDays(1);
                if (endDate <= startDate)
                {
                    error = $"{resource.Name}: wyjazd musi być po przyjeździe.";
                    return false;
                }

                (startUtc, endUtc) = HortusAvailabilityEngine.ResolveNight(
                    startDate, endDate, place.CheckInTime, place.CheckOutTime, timeZone);
            }
            else
            {
                var startTime = request.StartTime;
                var endTime = request.EndTime;
                if (startTime is null || endTime is null)
                {
                    error = $"{resource.Name}: podaj godzinę od i do.";
                    return false;
                }

                if (startTime == endTime)
                {
                    error = $"{resource.Name}: godzina zakończenia musi różnić się od rozpoczęcia.";
                    return false;
                }

                (startUtc, endUtc) = HortusAvailabilityEngine.ResolveSlot(startDate, startTime.Value, endTime.Value, timeZone);
                endDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(endUtc, timeZone).DateTime);
            }

            if (startDate < today.AddDays(-1) && !isAdmin)
            {
                error = $"{resource.Name}: nie można rezerwować wstecz.";
                return false;
            }

            if (!isAdmin && place.MinLeadDays > 0 && startDate < today.AddDays(place.MinLeadDays))
            {
                error = $"Zgłoszenia przyjmujemy najpóźniej na {place.MinLeadDays} dni przed terminem.";
                return false;
            }

            if (startDate > today.AddDays(MaxHorizonDays))
            {
                error = "Termin jest zbyt odległy.";
                return false;
            }

            items.Add(new HortusReservationItem
            {
                Id = Guid.NewGuid(),
                ResourceId = resource.Id,
                Unit = unit,
                StartDate = startDate,
                EndDate = endDate,
                StartUtc = startUtc,
                EndUtc = endUtc,
                TechnicalMinutesBefore = ClampTechnical(isAdmin && request.TechnicalMinutesBefore.HasValue
                    ? request.TechnicalMinutesBefore.Value
                    : resource.TechnicalMinutesBefore),
                TechnicalMinutesAfter = ClampTechnical(isAdmin && request.TechnicalMinutesAfter.HasValue
                    ? request.TechnicalMinutesAfter.Value
                    : resource.TechnicalMinutesAfter),
                IsExclusive = isExclusive,
                Note = NormalizeText(request.Note, 400)
            });
        }

        return true;
    }

    public static IReadOnlyList<HortusAvailabilityEngine.Candidate> ToCandidates(IEnumerable<HortusReservationItem> items) =>
        items.Select(x => new HortusAvailabilityEngine.Candidate(
            x.ResourceId,
            x.StartUtc,
            x.EndUtc,
            x.TechnicalMinutesBefore,
            x.TechnicalMinutesAfter,
            x.IsExclusive)).ToList();

    /// <summary>Window the given items touch, padded so nearby holds are loaded too.</summary>
    public static (DateTimeOffset FromUtc, DateTimeOffset ToUtc) Window(IReadOnlyList<HortusReservationItem> items)
    {
        var from = items.Min(x => x.StartUtc.AddMinutes(-ClampTechnical(x.TechnicalMinutesBefore)));
        var to = items.Max(x => x.EndUtc.AddMinutes(ClampTechnical(x.TechnicalMinutesAfter)));
        return (from, to);
    }

    public static async Task<bool> IsAdminAsync(RecreatioDbContext db, Guid userId, CancellationToken ct)
    {
        var assignment = await db.PortalAdminAssignments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ScopeKey == AdminScope, ct);
        return assignment is not null && assignment.UserId == userId;
    }

    public static async Task<PortalAdminAssignment?> FindAdminAssignmentAsync(RecreatioDbContext db, CancellationToken ct) =>
        await db.PortalAdminAssignments.AsNoTracking().FirstOrDefaultAsync(x => x.ScopeKey == AdminScope, ct);

    public static async Task<string> GenerateCodeAsync(RecreatioDbContext db, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 12; attempt++)
        {
            var code = "HD-" + RandomString(6);
            if (!await db.HortusReservations.AsNoTracking().AnyAsync(x => x.Code == code, ct))
            {
                return code;
            }
        }

        return "HD-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
    }

    public static string CreateRequesterToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();

    public static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    public static bool TokenMatches(string? tokenHash, string? providedToken) =>
        !string.IsNullOrEmpty(tokenHash)
        && !string.IsNullOrWhiteSpace(providedToken)
        && CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(tokenHash),
            Encoding.UTF8.GetBytes(HashToken(providedToken.Trim())));

    private static string RandomString(int length)
    {
        var builder = new StringBuilder(length);
        for (var i = 0; i < length; i++)
        {
            builder.Append(CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)]);
        }

        return builder.ToString();
    }

    // ---- mapping ------------------------------------------------------------------------------

    public static HortusPlaceView ToPlaceView(HortusPlace place) => new(
        place.Id,
        place.Slug,
        place.Name,
        place.Motto,
        place.Description,
        place.AddressLine,
        place.ContactName,
        place.ContactEmail,
        place.ContactPhone,
        place.TimeZoneId,
        ToIanaTimeZone(place.TimeZoneId),
        place.CheckInTime,
        place.CheckOutTime,
        place.DefaultTechnicalMinutes,
        place.MinLeadDays,
        place.PublicRequestsEnabled);

    /// <summary>
    /// Fallback for hosts whose <see cref="TimeZoneInfo.TryConvertWindowsIdToIanaId(string, out string?)"/>
    /// has no ICU data to work with. Without it the Windows id travels to the browser, where
    /// <c>Intl</c> refuses it outright.
    /// </summary>
    private static readonly Dictionary<string, string> WindowsToIana = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Central European Standard Time"] = "Europe/Warsaw",
        ["Central Europe Standard Time"] = "Europe/Budapest",
        ["W. Europe Standard Time"] = "Europe/Berlin",
        ["Romance Standard Time"] = "Europe/Paris",
        ["GMT Standard Time"] = "Europe/London",
        ["E. Europe Standard Time"] = "Europe/Chisinau",
        ["FLE Standard Time"] = "Europe/Kiev",
        ["UTC"] = "UTC"
    };

    /// <summary>
    /// Windows zone ids are what the server stores; browsers only understand IANA ones. An id that
    /// is already IANA fails the conversion and is passed through unchanged — but anything still
    /// shaped like a Windows id after both attempts is replaced, because sending it on would take
    /// the reservation page down rather than merely show the wrong hour.
    /// </summary>
    private static string ToIanaTimeZone(string timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            return DefaultIanaTimeZone;
        }

        if (TimeZoneInfo.TryConvertWindowsIdToIanaId(timeZoneId, out var converted) && LooksIana(converted))
        {
            return converted;
        }

        if (WindowsToIana.TryGetValue(timeZoneId.Trim(), out var mapped))
        {
            return mapped;
        }

        return LooksIana(timeZoneId) ? timeZoneId : DefaultIanaTimeZone;
    }

    private const string DefaultIanaTimeZone = "Europe/Warsaw";

    /// <summary>IANA ids are either "Region/City" or the bare "UTC"; Windows ids are neither.</summary>
    private static bool LooksIana(string? value) =>
        !string.IsNullOrWhiteSpace(value)
        && (value.Contains('/', StringComparison.Ordinal) || string.Equals(value, "UTC", StringComparison.Ordinal));

    public static HortusResourceView ToResourceView(HortusResource resource) => new(
        resource.Id,
        resource.ParentId,
        resource.Slug,
        resource.Name,
        resource.Description,
        resource.Kind,
        resource.BookingUnit,
        resource.Capacity,
        resource.GuestCapacity,
        resource.TechnicalMinutesBefore,
        resource.TechnicalMinutesAfter,
        resource.IsPubliclyBookable,
        resource.IsActive,
        resource.SortOrder,
        resource.ColorToken);

    public static HortusReservationItemView ToItemView(HortusReservationItem item, IReadOnlyDictionary<Guid, HortusResource> resources)
    {
        var resource = resources.TryGetValue(item.ResourceId, out var found) ? found : null;
        return new HortusReservationItemView(
            item.Id,
            item.ResourceId,
            resource?.Slug ?? string.Empty,
            resource?.Name ?? "—",
            item.Unit,
            item.StartDate,
            item.EndDate,
            item.StartUtc,
            item.EndUtc,
            item.TechnicalMinutesBefore,
            item.TechnicalMinutesAfter,
            item.IsExclusive,
            item.Note);
    }

    public static HortusReservationView ToAdminView(
        HortusReservation reservation,
        IEnumerable<HortusReservationItem> items,
        IReadOnlyDictionary<Guid, HortusResource> resources) => new(
        reservation.Id,
        reservation.Code,
        reservation.Kind,
        reservation.Status,
        reservation.GroupName,
        reservation.Organization,
        reservation.ContactName,
        reservation.ContactEmail,
        reservation.ContactPhone,
        reservation.GuestCount,
        reservation.PurposeNote,
        reservation.AdminNote,
        reservation.CreatedUtc,
        reservation.UpdatedUtc,
        reservation.DecidedUtc,
        items.OrderBy(x => x.StartUtc).Select(x => ToItemView(x, resources)).ToList());

    public static HortusReservationPublicView ToPublicView(
        HortusReservation reservation,
        IEnumerable<HortusReservationItem> items,
        IReadOnlyDictionary<Guid, HortusResource> resources) => new(
        reservation.Code,
        reservation.Status,
        reservation.GroupName,
        reservation.ContactName,
        reservation.GuestCount,
        reservation.PurposeNote,
        reservation.CreatedUtc,
        reservation.DecidedUtc,
        items.OrderBy(x => x.StartUtc).Select(x => ToItemView(x, resources)).ToList());

    /// <summary>
    /// Calendar rows. Public callers see that a part is taken and by how many groups, never by whom.
    /// </summary>
    public static IReadOnlyList<HortusOccupancyView> ToOccupancyViews(
        IEnumerable<HortusAvailabilityEngine.Occupancy> occupancies,
        IReadOnlyDictionary<Guid, HortusResource> resources,
        IReadOnlyDictionary<Guid, string>? groupNames,
        bool includeIdentity) =>
        occupancies
            .OrderBy(x => x.BlockedFromUtc)
            .Select(x => new HortusOccupancyView(
                x.ResourceId,
                resources.TryGetValue(x.ResourceId, out var resource) ? resource.Slug : string.Empty,
                includeIdentity ? x.ReservationId : null,
                includeIdentity ? x.ReservationCode : null,
                x.Status,
                x.Kind,
                includeIdentity
                    ? groupNames is not null && groupNames.TryGetValue(x.ReservationId, out var name) ? name : x.ReservationCode
                    : x.Kind == HortusReservationKinds.Block ? "Przerwa techniczna" : "Zajęte",
                x.StartUtc,
                x.EndUtc,
                x.BlockedFromUtc,
                x.BlockedUntilUtc,
                x.IsExclusive))
            .ToList();

    public static HortusConflictView ToConflictView(HortusAvailabilityEngine.Conflict conflict) => new(
        conflict.ResourceId,
        conflict.ResourceName,
        conflict.Reason,
        conflict.Message,
        conflict.BlockingReservationCode,
        conflict.BlockingStatus,
        conflict.FromUtc,
        conflict.UntilUtc);

    // ---- normalisation ------------------------------------------------------------------------

    public static int ClampTechnical(int minutes) => Math.Clamp(minutes, 0, MaxTechnicalMinutes);

    public static string? NormalizeUnit(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return normalized switch
        {
            HortusBookingUnits.Night => HortusBookingUnits.Night,
            HortusBookingUnits.Slot => HortusBookingUnits.Slot,
            _ => null
        };
    }

    public static string? NormalizeSlug(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var builder = new StringBuilder();
        foreach (var character in value.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
            }
            else if (character is ' ' or '-' or '_' && builder.Length > 0 && builder[^1] != '-')
            {
                builder.Append('-');
            }
        }

        var slug = builder.ToString().Trim('-');
        return slug.Length == 0 ? null : slug[..Math.Min(slug.Length, 80)];
    }

    public static string NormalizeRequired(string? value, int maxLength) => NormalizeText(value, maxLength) ?? string.Empty;

    public static string? NormalizeText(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        return normalized.Length > maxLength ? normalized[..maxLength] : normalized;
    }

    public static string? NormalizeEmail(string? value)
    {
        var normalized = NormalizeText(value, 180)?.ToLowerInvariant();
        return normalized is null || !normalized.Contains('@') || normalized.StartsWith('@') || normalized.EndsWith('@')
            ? null
            : normalized;
    }
}
