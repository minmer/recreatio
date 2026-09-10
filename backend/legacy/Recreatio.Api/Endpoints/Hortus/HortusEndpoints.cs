using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Hortus;
using Recreatio.Api.Services.Hortus;

namespace Recreatio.Api.Endpoints.Hortus;

/// <summary>
/// The public reservation site: what the place is made of, what is free, and how a group asks for it.
/// Everything submitted here lands as <see cref="HortusReservationStatuses.Pending"/> — only the
/// coordinator turns a request into a booking.
/// </summary>
public static class HortusEndpoints
{
    private const int MaxWindowDays = 400;

    public static void MapHortusEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/hortus");

        group.MapGet("/{slug}", async (string slug, RecreatioDbContext db, CancellationToken ct) =>
        {
            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                if (!string.Equals(HortusShared.NormalizeSlug(slug), HortusShared.DefaultPlaceSlug, StringComparison.Ordinal))
                {
                    return Results.NotFound();
                }

                // Not provisioned yet: describe the place, offer nothing to book.
                var draft = HortusDefaults.CreatePlace(DateTimeOffset.UtcNow);
                return Results.Ok(new HortusSiteResponse(
                    HortusShared.ToPlaceView(draft) with { Id = null },
                    [],
                    false));
            }

            var resources = await HortusShared.LoadResourcesAsync(db, place.Id, ct);
            return Results.Ok(new HortusSiteResponse(
                HortusShared.ToPlaceView(place),
                resources.Where(x => x.IsActive).Select(HortusShared.ToResourceView).ToList(),
                true));
        });

        group.MapGet("/{slug}/availability", async (
            string slug,
            DateOnly? from,
            DateOnly? to,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var timeZone = HortusAvailabilityEngine.ResolveTimeZone(place.TimeZoneId);
            if (!TryResolveWindow(from, to, timeZone, out var fromUtc, out var toUtc, out var windowError))
            {
                return Results.BadRequest(new { error = windowError });
            }

            var resources = await HortusShared.LoadResourcesAsync(db, place.Id, ct);
            var occupancies = await HortusShared.LoadOccupanciesAsync(db, place.Id, fromUtc, toUtc, true, null, ct);

            return Results.Ok(new HortusAvailabilityResponse(
                fromUtc,
                toUtc,
                HortusShared.ToOccupancyViews(occupancies, resources.ToDictionary(x => x.Id), null, false)));
        });

        // Dry run for the booking form: same rules as a submission, nothing written.
        group.MapPost("/{slug}/check", async (
            string slug,
            HortusCheckRequest request,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var resources = await HortusShared.LoadResourcesAsync(db, place.Id, ct);
            if (!HortusShared.TryResolveItems(place, resources, request.Items, false, false, out var items, out var error))
            {
                return Results.BadRequest(new { error });
            }

            var result = await EvaluateAsync(db, place, resources, items, null, ct);
            return Results.Ok(result);
        });

        group.MapPost("/{slug}/requests", async (
            string slug,
            HortusRequestSubmission request,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            if (!place.PublicRequestsEnabled)
            {
                return Results.BadRequest(new { error = "Zgłoszenia przez stronę są chwilowo wyłączone. Prosimy o kontakt telefoniczny." });
            }

            var groupName = HortusShared.NormalizeText(request.GroupName, 200);
            var contactName = HortusShared.NormalizeText(request.ContactName, 200);
            var contactEmail = HortusShared.NormalizeEmail(request.ContactEmail);
            var contactPhone = HortusShared.NormalizeText(request.ContactPhone, 32);

            if (groupName is null)
            {
                return Results.BadRequest(new { error = "Podaj nazwę grupy." });
            }

            if (contactName is null)
            {
                return Results.BadRequest(new { error = "Podaj imię i nazwisko osoby odpowiedzialnej." });
            }

            if (contactEmail is null && contactPhone is null)
            {
                return Results.BadRequest(new { error = "Podaj e-mail lub telefon — inaczej nie potwierdzimy rezerwacji." });
            }

            var resources = await HortusShared.LoadResourcesAsync(db, place.Id, ct);
            if (!HortusShared.TryResolveItems(place, resources, request.Items, false, false, out var items, out var error))
            {
                return Results.BadRequest(new { error });
            }

            var evaluation = await EvaluateAsync(db, place, resources, items, null, ct);
            if (!evaluation.IsAvailable)
            {
                return Results.Conflict(new
                {
                    error = "Wybrany termin jest już zajęty.",
                    conflicts = evaluation.Conflicts
                });
            }

            var now = DateTimeOffset.UtcNow;
            var token = HortusShared.CreateRequesterToken();
            var reservation = new HortusReservation
            {
                Id = Guid.NewGuid(),
                PlaceId = place.Id,
                Code = await HortusShared.GenerateCodeAsync(db, ct),
                Kind = HortusReservationKinds.Reservation,
                Status = HortusReservationStatuses.Pending,
                GroupName = groupName,
                Organization = HortusShared.NormalizeRequired(request.Organization, 200),
                ContactName = contactName,
                ContactEmail = contactEmail ?? string.Empty,
                ContactPhone = contactPhone ?? string.Empty,
                GuestCount = NormalizeGuestCount(request.GuestCount),
                PurposeNote = HortusShared.NormalizeText(request.PurposeNote, 2000),
                RequesterTokenHash = HortusShared.HashToken(token),
                // A signed-in requester keeps the link to their account; guests stay anonymous.
                RequestedByUserId = EndpointHelpers.TryGetUserId(context, out var requesterId) ? requesterId : null,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            foreach (var item in items)
            {
                item.ReservationId = reservation.Id;
            }

            db.HortusReservations.Add(reservation);
            db.HortusReservationItems.AddRange(items);
            db.HortusReservationStatusLogs.Add(new HortusReservationStatusLog
            {
                Id = Guid.NewGuid(),
                ReservationId = reservation.Id,
                FromStatus = string.Empty,
                ToStatus = HortusReservationStatuses.Pending,
                Note = "Zgłoszenie ze strony",
                CreatedUtc = now
            });
            await db.SaveChangesAsync(ct);

            var byId = resources.ToDictionary(x => x.Id);
            return Results.Ok(new HortusRequestSubmissionResponse(
                reservation.Code,
                token,
                HortusShared.ToPublicView(reservation, items, byId)));
        });

        group.MapGet("/{slug}/requests/{code}", async (
            string slug,
            string code,
            string? token,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var found = await FindByCodeAsync(db, slug, code, token, ct);
            if (found is null)
            {
                return Results.NotFound();
            }

            var (_, reservation, items, resources) = found.Value;
            return Results.Ok(HortusShared.ToPublicView(reservation, items, resources));
        });

        group.MapPost("/{slug}/requests/{code}/cancel", async (
            string slug,
            string code,
            string? token,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var found = await FindByCodeAsync(db, slug, code, token, ct);
            if (found is null)
            {
                return Results.NotFound();
            }

            var (_, reservation, items, resources) = found.Value;
            if (!HortusReservationStatuses.IsOpen(reservation.Status))
            {
                return Results.BadRequest(new { error = "Ta rezerwacja jest już zamknięta." });
            }

            var tracked = await db.HortusReservations.FirstAsync(x => x.Id == reservation.Id, ct);
            var now = DateTimeOffset.UtcNow;
            var previous = tracked.Status;
            tracked.Status = HortusReservationStatuses.Cancelled;
            tracked.UpdatedUtc = now;
            db.HortusReservationStatusLogs.Add(new HortusReservationStatusLog
            {
                Id = Guid.NewGuid(),
                ReservationId = tracked.Id,
                FromStatus = previous,
                ToStatus = HortusReservationStatuses.Cancelled,
                Note = "Odwołane przez zgłaszającego",
                CreatedUtc = now
            });
            await db.SaveChangesAsync(ct);

            return Results.Ok(HortusShared.ToPublicView(tracked, items, resources));
        });

        app.MapHortusAdminEndpoints(group);
    }

    /// <summary>
    /// Runs the engine twice: confirmed bookings decide whether the term is free at all, pending
    /// ones only produce warnings, because a request nobody confirmed must not lock the calendar.
    /// </summary>
    internal static async Task<HortusCheckResponse> EvaluateAsync(
        RecreatioDbContext db,
        HortusPlace place,
        IReadOnlyList<HortusResource> resources,
        IReadOnlyList<HortusReservationItem> items,
        Guid? ignoreReservationId,
        CancellationToken ct)
    {
        var byId = resources.ToDictionary(x => x.Id);
        var tree = HortusShared.BuildTree(resources);
        var candidates = HortusShared.ToCandidates(items);
        var (fromUtc, toUtc) = HortusShared.Window(items);

        var open = await HortusShared.LoadOccupanciesAsync(db, place.Id, fromUtc, toUtc, true, ignoreReservationId, ct);
        var confirmed = open.Where(x => HortusReservationStatuses.Occupies(x.Status)).ToList();
        var pending = open.Where(x => x.Status == HortusReservationStatuses.Pending).ToList();

        var conflicts = HortusAvailabilityEngine.FindConflicts(tree, confirmed, candidates)
            .Select(HortusShared.ToConflictView).ToList();
        var warnings = HortusAvailabilityEngine.FindConflicts(tree, pending, candidates)
            .Select(HortusShared.ToConflictView).ToList();

        return new HortusCheckResponse(
            conflicts.Count == 0,
            items.Select(x => HortusShared.ToItemView(x, byId)).ToList(),
            conflicts,
            warnings);
    }

    internal static bool TryResolveWindow(
        DateOnly? from,
        DateOnly? to,
        TimeZoneInfo timeZone,
        out DateTimeOffset fromUtc,
        out DateTimeOffset toUtc,
        out string? error)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timeZone).DateTime);
        var start = from ?? today;
        var end = to ?? start.AddDays(30);
        error = null;
        fromUtc = default;
        toUtc = default;

        if (end < start)
        {
            error = "Zakres dat jest odwrócony.";
            return false;
        }

        if (end.DayNumber - start.DayNumber > MaxWindowDays)
        {
            error = $"Zakres dat nie może przekraczać {MaxWindowDays} dni.";
            return false;
        }

        fromUtc = HortusAvailabilityEngine.ToInstant(start, TimeOnly.MinValue, timeZone);
        toUtc = HortusAvailabilityEngine.ToInstant(end.AddDays(1), TimeOnly.MinValue, timeZone);
        return true;
    }

    private static async Task<(HortusPlace Place, HortusReservation Reservation, List<HortusReservationItem> Items, Dictionary<Guid, HortusResource> Resources)?> FindByCodeAsync(
        RecreatioDbContext db,
        string slug,
        string code,
        string? token,
        CancellationToken ct)
    {
        var place = await HortusShared.FindPlaceAsync(db, slug, ct);
        if (place is null)
        {
            return null;
        }

        var normalizedCode = code.Trim().ToUpperInvariant();
        var reservation = await db.HortusReservations.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PlaceId == place.Id && x.Code == normalizedCode, ct);
        if (reservation is null || !HortusShared.TokenMatches(reservation.RequesterTokenHash, token))
        {
            // Same answer for "no such code" and "wrong token" — a code alone reveals nothing.
            return null;
        }

        var items = await db.HortusReservationItems.AsNoTracking()
            .Where(x => x.ReservationId == reservation.Id)
            .ToListAsync(ct);
        var resources = (await HortusShared.LoadResourcesAsync(db, place.Id, ct)).ToDictionary(x => x.Id);
        return (place, reservation, items, resources);
    }

    private static int? NormalizeGuestCount(int? value) =>
        value is null or <= 0 ? null : Math.Min(value.Value, 2000);
}
