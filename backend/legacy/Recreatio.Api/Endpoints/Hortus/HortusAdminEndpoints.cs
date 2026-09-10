using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Hortus;
using Recreatio.Api.Data.Pilgrimage;
using Recreatio.Api.Services.Hortus;

namespace Recreatio.Api.Endpoints.Hortus;

/// <summary>
/// The coordinator's side: the pending queue, the timeline of everything at once, manual bookings,
/// technical blocks, and the definition of the parts themselves — how many groups each one takes
/// and how much time it needs for washing up afterwards.
/// </summary>
public static class HortusAdminEndpoints
{
    public static void MapHortusAdminEndpoints(this WebApplication app, RouteGroupBuilder group)
    {
        group.MapGet("/admin/status", async (HttpContext context, RecreatioDbContext db, CancellationToken ct) =>
        {
            var assignment = await HortusShared.FindAdminAssignmentAsync(db, ct);
            var account = assignment is null
                ? null
                : await db.UserAccounts.AsNoTracking()
                    .Where(x => x.Id == assignment.UserId)
                    .Select(x => new { x.LoginId, x.DisplayName })
                    .FirstOrDefaultAsync(ct);

            var hasAdmin = assignment is not null && account is not null;
            var isCurrentUserAdmin = hasAdmin
                && EndpointHelpers.TryGetUserId(context, out var userId)
                && assignment!.UserId == userId;
            var isProvisioned = await db.HortusPlaces.AsNoTracking().AnyAsync(x => x.Slug == HortusShared.DefaultPlaceSlug, ct);

            return Results.Ok(new HortusAdminStatusResponse(
                hasAdmin,
                isCurrentUserAdmin,
                hasAdmin ? account?.DisplayName ?? account?.LoginId : null,
                isProvisioned));
        });

        group.MapPost("/admin/claim", async (HttpContext context, RecreatioDbContext db, CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var existing = await db.PortalAdminAssignments.FirstOrDefaultAsync(x => x.ScopeKey == HortusShared.AdminScope, ct);
            if (existing is not null)
            {
                return existing.UserId == userId
                    ? Results.Ok(new { claimed = true, alreadyOwned = true })
                    : Results.Conflict(new { error = "Koordynator jest już przypisany." });
            }

            db.PortalAdminAssignments.Add(new PortalAdminAssignment
            {
                Id = Guid.NewGuid(),
                ScopeKey = HortusShared.AdminScope,
                UserId = userId,
                CreatedUtc = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { claimed = true, alreadyOwned = false });
        }).RequireAuthorization();

        group.MapPost("/admin/bootstrap", async (HttpContext context, RecreatioDbContext db, CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var existing = await db.HortusPlaces.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == HortusShared.DefaultPlaceSlug, ct);
            if (existing is not null)
            {
                var current = await HortusShared.LoadResourcesAsync(db, existing.Id, ct);
                return Results.Ok(new HortusSiteResponse(
                    HortusShared.ToPlaceView(existing),
                    current.Select(HortusShared.ToResourceView).ToList(),
                    true));
            }

            var now = DateTimeOffset.UtcNow;
            var place = HortusDefaults.CreatePlace(now);
            var resources = HortusDefaults.CreateResources(place.Id, now);
            db.HortusPlaces.Add(place);
            db.HortusResources.AddRange(resources);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new HortusSiteResponse(
                HortusShared.ToPlaceView(place),
                resources.Select(HortusShared.ToResourceView).ToList(),
                true));
        }).RequireAuthorization();

        // ---- reservations -------------------------------------------------------------------

        group.MapGet("/{slug}/admin/reservations", async (
            string slug,
            string? status,
            DateOnly? from,
            DateOnly? to,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var timeZone = HortusAvailabilityEngine.ResolveTimeZone(place.TimeZoneId);
            var query = db.HortusReservations.AsNoTracking().Where(x => x.PlaceId == place.Id);

            var normalizedStatus = status?.Trim().ToLowerInvariant();
            if (!string.IsNullOrEmpty(normalizedStatus) && normalizedStatus != "all")
            {
                if (!HortusReservationStatuses.IsKnown(normalizedStatus))
                {
                    return Results.BadRequest(new { error = "Nieznany status." });
                }

                query = query.Where(x => x.Status == normalizedStatus);
            }

            var reservations = await query.OrderByDescending(x => x.CreatedUtc).Take(1000).ToListAsync(ct);

            // A date range filters on what the reservation occupies, not on when it was submitted.
            if (from.HasValue || to.HasValue)
            {
                if (!HortusEndpoints.TryResolveWindow(from, to, timeZone, out var fromUtc, out var toUtc, out var windowError))
                {
                    return Results.BadRequest(new { error = windowError });
                }

                var ids = reservations.Select(x => x.Id).ToList();
                var matching = await db.HortusReservationItems.AsNoTracking()
                    .Where(x => ids.Contains(x.ReservationId) && x.EndUtc >= fromUtc && x.StartUtc <= toUtc)
                    .Select(x => x.ReservationId)
                    .Distinct()
                    .ToListAsync(ct);
                var matchingSet = matching.ToHashSet();
                reservations = reservations.Where(x => matchingSet.Contains(x.Id)).ToList();
            }

            var reservationIds = reservations.Select(x => x.Id).ToList();
            var items = await db.HortusReservationItems.AsNoTracking()
                .Where(x => reservationIds.Contains(x.ReservationId))
                .ToListAsync(ct);
            var itemsByReservation = items.GroupBy(x => x.ReservationId).ToDictionary(g => g.Key, g => g.ToList());
            var resources = (await HortusShared.LoadResourcesAsync(db, place.Id, ct)).ToDictionary(x => x.Id);

            var views = reservations
                .Select(x => HortusShared.ToAdminView(
                    x,
                    itemsByReservation.TryGetValue(x.Id, out var reservationItems) ? reservationItems : [],
                    resources))
                .ToList();

            var pendingCount = await db.HortusReservations.AsNoTracking()
                .CountAsync(x => x.PlaceId == place.Id && x.Status == HortusReservationStatuses.Pending, ct);

            return Results.Ok(new HortusReservationListResponse(views, pendingCount));
        }).RequireAuthorization();

        group.MapGet("/{slug}/admin/timeline", async (
            string slug,
            DateOnly? from,
            DateOnly? to,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var timeZone = HortusAvailabilityEngine.ResolveTimeZone(place.TimeZoneId);
            if (!HortusEndpoints.TryResolveWindow(from, to, timeZone, out var fromUtc, out var toUtc, out var windowError))
            {
                return Results.BadRequest(new { error = windowError });
            }

            var occupancies = await HortusShared.LoadOccupanciesAsync(db, place.Id, fromUtc, toUtc, true, null, ct);
            var resources = (await HortusShared.LoadResourcesAsync(db, place.Id, ct)).ToDictionary(x => x.Id);
            var reservationIds = occupancies.Select(x => x.ReservationId).Distinct().ToList();
            var groupNames = await db.HortusReservations.AsNoTracking()
                .Where(x => reservationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.GroupName, ct);

            return Results.Ok(new HortusAvailabilityResponse(
                fromUtc,
                toUtc,
                HortusShared.ToOccupancyViews(occupancies, resources, groupNames, true)));
        }).RequireAuthorization();

        group.MapPost("/{slug}/admin/check", async (
            string slug,
            HortusCheckRequest request,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var resources = await HortusShared.LoadResourcesAsync(db, place.Id, ct);
            if (!HortusShared.TryResolveItems(place, resources, request.Items, true, false, out var items, out var error))
            {
                return Results.BadRequest(new { error });
            }

            return Results.Ok(await HortusEndpoints.EvaluateAsync(db, place, resources, items, request.IgnoreReservationId, ct));
        }).RequireAuthorization();

        group.MapPost("/{slug}/admin/reservations", async (
            string slug,
            HortusReservationUpsertRequest request,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var kind = NormalizeKind(request.Kind);
            var status = NormalizeStatus(request.Status) ?? HortusReservationStatuses.Confirmed;
            var resources = await HortusShared.LoadResourcesAsync(db, place.Id, ct);
            if (!HortusShared.TryResolveItems(place, resources, request.Items, true, kind == HortusReservationKinds.Block, out var items, out var error))
            {
                return Results.BadRequest(new { error });
            }

            if (HortusReservationStatuses.Occupies(status) && !request.Force)
            {
                var evaluation = await HortusEndpoints.EvaluateAsync(db, place, resources, items, null, ct);
                if (!evaluation.IsAvailable)
                {
                    return Results.Conflict(new { error = "Termin koliduje z inną rezerwacją.", conflicts = evaluation.Conflicts });
                }
            }

            var now = DateTimeOffset.UtcNow;
            var reservation = new HortusReservation
            {
                Id = Guid.NewGuid(),
                PlaceId = place.Id,
                Code = await HortusShared.GenerateCodeAsync(db, ct),
                Kind = kind,
                Status = status,
                GroupName = HortusShared.NormalizeText(request.GroupName, 200)
                    ?? (kind == HortusReservationKinds.Block ? "Przerwa techniczna" : "Rezerwacja"),
                Organization = HortusShared.NormalizeRequired(request.Organization, 200),
                ContactName = HortusShared.NormalizeRequired(request.ContactName, 200),
                ContactEmail = HortusShared.NormalizeEmail(request.ContactEmail) ?? string.Empty,
                ContactPhone = HortusShared.NormalizeRequired(request.ContactPhone, 32),
                GuestCount = request.GuestCount is null or <= 0 ? null : Math.Min(request.GuestCount.Value, 2000),
                PurposeNote = HortusShared.NormalizeText(request.PurposeNote, 2000),
                AdminNote = HortusShared.NormalizeText(request.AdminNote, 2000),
                DecidedByUserId = HortusReservationStatuses.Occupies(status) ? guard.UserId : null,
                DecidedUtc = HortusReservationStatuses.Occupies(status) ? now : null,
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
                ToStatus = status,
                ChangedByUserId = guard.UserId,
                Note = kind == HortusReservationKinds.Block ? "Blokada techniczna" : "Wpis koordynatora",
                CreatedUtc = now
            });
            await db.SaveChangesAsync(ct);

            return Results.Ok(HortusShared.ToAdminView(reservation, items, resources.ToDictionary(x => x.Id)));
        }).RequireAuthorization();

        group.MapPut("/{slug}/admin/reservations/{id:guid}", async (
            string slug,
            Guid id,
            HortusReservationUpsertRequest request,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var reservation = await db.HortusReservations.FirstOrDefaultAsync(x => x.Id == id && x.PlaceId == place.Id, ct);
            if (reservation is null)
            {
                return Results.NotFound();
            }

            var kind = NormalizeKind(request.Kind);
            var status = NormalizeStatus(request.Status) ?? reservation.Status;
            var resources = await HortusShared.LoadResourcesAsync(db, place.Id, ct);
            if (!HortusShared.TryResolveItems(place, resources, request.Items, true, kind == HortusReservationKinds.Block, out var items, out var error))
            {
                return Results.BadRequest(new { error });
            }

            if (HortusReservationStatuses.Occupies(status) && !request.Force)
            {
                var evaluation = await HortusEndpoints.EvaluateAsync(db, place, resources, items, reservation.Id, ct);
                if (!evaluation.IsAvailable)
                {
                    return Results.Conflict(new { error = "Termin koliduje z inną rezerwacją.", conflicts = evaluation.Conflicts });
                }
            }

            var now = DateTimeOffset.UtcNow;
            var previousStatus = reservation.Status;
            reservation.Kind = kind;
            reservation.Status = status;
            reservation.GroupName = HortusShared.NormalizeText(request.GroupName, 200) ?? reservation.GroupName;
            reservation.Organization = HortusShared.NormalizeRequired(request.Organization, 200);
            reservation.ContactName = HortusShared.NormalizeRequired(request.ContactName, 200);
            reservation.ContactEmail = HortusShared.NormalizeEmail(request.ContactEmail) ?? string.Empty;
            reservation.ContactPhone = HortusShared.NormalizeRequired(request.ContactPhone, 32);
            reservation.GuestCount = request.GuestCount is null or <= 0 ? null : Math.Min(request.GuestCount.Value, 2000);
            reservation.PurposeNote = HortusShared.NormalizeText(request.PurposeNote, 2000);
            reservation.AdminNote = HortusShared.NormalizeText(request.AdminNote, 2000);
            reservation.UpdatedUtc = now;
            if (previousStatus != status && HortusReservationStatuses.Occupies(status))
            {
                reservation.DecidedByUserId = guard.UserId;
                reservation.DecidedUtc = now;
            }

            var existingItems = await db.HortusReservationItems.Where(x => x.ReservationId == reservation.Id).ToListAsync(ct);
            db.HortusReservationItems.RemoveRange(existingItems);
            foreach (var item in items)
            {
                item.ReservationId = reservation.Id;
            }

            db.HortusReservationItems.AddRange(items);

            if (previousStatus != status)
            {
                db.HortusReservationStatusLogs.Add(new HortusReservationStatusLog
                {
                    Id = Guid.NewGuid(),
                    ReservationId = reservation.Id,
                    FromStatus = previousStatus,
                    ToStatus = status,
                    ChangedByUserId = guard.UserId,
                    Note = "Zmiana przy edycji",
                    CreatedUtc = now
                });
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(HortusShared.ToAdminView(reservation, items, resources.ToDictionary(x => x.Id)));
        }).RequireAuthorization();

        group.MapPost("/{slug}/admin/reservations/{id:guid}/decision", async (
            string slug,
            Guid id,
            HortusDecisionRequest request,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var status = NormalizeStatus(request.Status);
            if (status is null)
            {
                return Results.BadRequest(new { error = "Nieznany status." });
            }

            var reservation = await db.HortusReservations.FirstOrDefaultAsync(x => x.Id == id && x.PlaceId == place.Id, ct);
            if (reservation is null)
            {
                return Results.NotFound();
            }

            var items = await db.HortusReservationItems.Where(x => x.ReservationId == reservation.Id).ToListAsync(ct);
            var resources = await HortusShared.LoadResourcesAsync(db, place.Id, ct);

            // Confirming is the moment the calendar changes hands, so it is re-checked even though
            // the request looked free when it was submitted.
            if (HortusReservationStatuses.Occupies(status) && !request.Force && items.Count > 0)
            {
                var evaluation = await HortusEndpoints.EvaluateAsync(db, place, resources, items, reservation.Id, ct);
                if (!evaluation.IsAvailable)
                {
                    return Results.Conflict(new { error = "Termin koliduje z inną rezerwacją.", conflicts = evaluation.Conflicts });
                }
            }

            var now = DateTimeOffset.UtcNow;
            var previousStatus = reservation.Status;
            reservation.Status = status;
            reservation.UpdatedUtc = now;
            reservation.DecidedByUserId = guard.UserId;
            reservation.DecidedUtc = now;
            if (!string.IsNullOrWhiteSpace(request.Note))
            {
                reservation.AdminNote = HortusShared.NormalizeText(request.Note, 2000);
            }

            db.HortusReservationStatusLogs.Add(new HortusReservationStatusLog
            {
                Id = Guid.NewGuid(),
                ReservationId = reservation.Id,
                FromStatus = previousStatus,
                ToStatus = status,
                ChangedByUserId = guard.UserId,
                Note = HortusShared.NormalizeText(request.Note, 400),
                CreatedUtc = now
            });
            await db.SaveChangesAsync(ct);

            return Results.Ok(HortusShared.ToAdminView(reservation, items, resources.ToDictionary(x => x.Id)));
        }).RequireAuthorization();

        group.MapDelete("/{slug}/admin/reservations/{id:guid}", async (
            string slug,
            Guid id,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var reservation = await db.HortusReservations.FirstOrDefaultAsync(x => x.Id == id && x.PlaceId == place.Id, ct);
            if (reservation is null)
            {
                return Results.NotFound();
            }

            // Group requests are kept for the record and cancelled instead; only blocks are erased.
            if (reservation.Kind != HortusReservationKinds.Block)
            {
                return Results.BadRequest(new { error = "Rezerwacji grupy nie usuwamy — zmień status na odwołaną." });
            }

            var items = await db.HortusReservationItems.Where(x => x.ReservationId == reservation.Id).ToListAsync(ct);
            var logs = await db.HortusReservationStatusLogs.Where(x => x.ReservationId == reservation.Id).ToListAsync(ct);
            db.HortusReservationItems.RemoveRange(items);
            db.HortusReservationStatusLogs.RemoveRange(logs);
            db.HortusReservations.Remove(reservation);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization();

        // ---- resources and settings ----------------------------------------------------------

        group.MapGet("/{slug}/admin/resources", async (
            string slug,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var resources = await HortusShared.LoadResourcesAsync(db, place.Id, ct);
            return Results.Ok(new HortusSiteResponse(
                HortusShared.ToPlaceView(place),
                resources.Select(HortusShared.ToResourceView).ToList(),
                true));
        }).RequireAuthorization();

        group.MapPost("/{slug}/admin/resources", async (
            string slug,
            HortusResourceUpsertRequest request,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var resources = await HortusShared.LoadResourcesAsync(db, place.Id, ct);
            var resource = new HortusResource
            {
                Id = Guid.NewGuid(),
                PlaceId = place.Id,
                CreatedUtc = DateTimeOffset.UtcNow
            };

            var validation = ApplyResource(resource, request, resources);
            if (validation is not null)
            {
                return Results.BadRequest(new { error = validation });
            }

            db.HortusResources.Add(resource);
            await db.SaveChangesAsync(ct);
            return Results.Ok(HortusShared.ToResourceView(resource));
        }).RequireAuthorization();

        group.MapPut("/{slug}/admin/resources/{id:guid}", async (
            string slug,
            Guid id,
            HortusResourceUpsertRequest request,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var resource = await db.HortusResources.FirstOrDefaultAsync(x => x.Id == id && x.PlaceId == place.Id, ct);
            if (resource is null)
            {
                return Results.NotFound();
            }

            var resources = await HortusShared.LoadResourcesAsync(db, place.Id, ct);
            var validation = ApplyResource(resource, request, resources);
            if (validation is not null)
            {
                return Results.BadRequest(new { error = validation });
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(HortusShared.ToResourceView(resource));
        }).RequireAuthorization();

        group.MapDelete("/{slug}/admin/resources/{id:guid}", async (
            string slug,
            Guid id,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await HortusShared.FindPlaceAsync(db, slug, ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var resource = await db.HortusResources.FirstOrDefaultAsync(x => x.Id == id && x.PlaceId == place.Id, ct);
            if (resource is null)
            {
                return Results.NotFound();
            }

            var hasChildren = await db.HortusResources.AnyAsync(x => x.ParentId == resource.Id, ct);
            if (hasChildren)
            {
                return Results.BadRequest(new { error = "Najpierw przenieś lub usuń części wewnętrzne." });
            }

            // History must keep pointing at something, so a used resource is only switched off.
            var isUsed = await db.HortusReservationItems.AnyAsync(x => x.ResourceId == resource.Id, ct);
            if (isUsed)
            {
                resource.IsActive = false;
                resource.UpdatedUtc = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(ct);
                return Results.Ok(HortusShared.ToResourceView(resource));
            }

            db.HortusResources.Remove(resource);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization();

        group.MapPut("/{slug}/admin/settings", async (
            string slug,
            HortusPlaceUpdateRequest request,
            HttpContext context,
            RecreatioDbContext db,
            CancellationToken ct) =>
        {
            var guard = await RequireAdminAsync(context, db, ct);
            if (guard.Failure is not null)
            {
                return guard.Failure;
            }

            var place = await db.HortusPlaces.FirstOrDefaultAsync(
                x => x.Slug == (HortusShared.NormalizeSlug(slug) ?? HortusShared.DefaultPlaceSlug), ct);
            if (place is null)
            {
                return Results.NotFound();
            }

            var name = HortusShared.NormalizeText(request.Name, 200);
            if (name is null)
            {
                return Results.BadRequest(new { error = "Nazwa miejsca jest wymagana." });
            }

            place.Name = name;
            place.Motto = HortusShared.NormalizeRequired(request.Motto, 300);
            place.Description = HortusShared.NormalizeRequired(request.Description, 4000);
            place.AddressLine = HortusShared.NormalizeRequired(request.AddressLine, 300);
            place.ContactName = HortusShared.NormalizeRequired(request.ContactName, 160);
            place.ContactEmail = HortusShared.NormalizeEmail(request.ContactEmail) ?? string.Empty;
            place.ContactPhone = HortusShared.NormalizeRequired(request.ContactPhone, 32);
            place.CheckInTime = request.CheckInTime;
            place.CheckOutTime = request.CheckOutTime;
            place.DefaultTechnicalMinutes = HortusShared.ClampTechnical(request.DefaultTechnicalMinutes);
            place.MinLeadDays = Math.Clamp(request.MinLeadDays, 0, 365);
            place.PublicRequestsEnabled = request.PublicRequestsEnabled;
            place.UpdatedUtc = DateTimeOffset.UtcNow;

            var timeZoneId = HortusShared.NormalizeText(request.TimeZoneId, 80);
            if (!string.IsNullOrWhiteSpace(timeZoneId))
            {
                place.TimeZoneId = timeZoneId;
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(HortusShared.ToPlaceView(place));
        }).RequireAuthorization();
    }

    /// <summary>Copies a validated upsert onto the row; returns a message when something is off.</summary>
    private static string? ApplyResource(
        HortusResource resource,
        HortusResourceUpsertRequest request,
        IReadOnlyList<HortusResource> siblings)
    {
        var slug = HortusShared.NormalizeSlug(request.Slug);
        var name = HortusShared.NormalizeText(request.Name, 200);
        if (slug is null || name is null)
        {
            return "Nazwa i identyfikator są wymagane.";
        }

        if (siblings.Any(x => x.Id != resource.Id && x.Slug == slug))
        {
            return "Taki identyfikator już istnieje.";
        }

        if (!HortusResourceKinds.IsKnown(request.Kind))
        {
            return "Nieznany rodzaj części.";
        }

        if (!HortusBookingUnits.IsKnown(request.BookingUnit))
        {
            return "Nieznany sposób rezerwacji.";
        }

        if (request.ParentId.HasValue)
        {
            if (request.ParentId.Value == resource.Id)
            {
                return "Część nie może być swoim rodzicem.";
            }

            var parent = siblings.FirstOrDefault(x => x.Id == request.ParentId.Value);
            if (parent is null)
            {
                return "Nie znaleziono części nadrzędnej.";
            }

            // Walking up from the proposed parent must never lead back to this resource.
            var byId = siblings.ToDictionary(x => x.Id);
            var cursor = parent;
            var seen = new HashSet<Guid> { resource.Id };
            while (cursor is not null)
            {
                if (!seen.Add(cursor.Id))
                {
                    return "Taka struktura tworzyłaby pętlę.";
                }

                cursor = cursor.ParentId.HasValue && byId.TryGetValue(cursor.ParentId.Value, out var next) ? next : null;
            }
        }

        resource.ParentId = request.ParentId;
        resource.Slug = slug;
        resource.Name = name;
        resource.Description = HortusShared.NormalizeRequired(request.Description, 2000);
        resource.Kind = request.Kind;
        resource.BookingUnit = request.BookingUnit;
        resource.Capacity = Math.Clamp(request.Capacity, 1, 50);
        resource.GuestCapacity = request.GuestCapacity is null or <= 0 ? null : Math.Min(request.GuestCapacity.Value, 5000);
        resource.TechnicalMinutesBefore = HortusShared.ClampTechnical(request.TechnicalMinutesBefore);
        resource.TechnicalMinutesAfter = HortusShared.ClampTechnical(request.TechnicalMinutesAfter);
        resource.IsPubliclyBookable = request.IsPubliclyBookable;
        resource.IsActive = request.IsActive;
        resource.SortOrder = Math.Clamp(request.SortOrder, 0, 100000);
        resource.ColorToken = HortusShared.NormalizeText(request.ColorToken, 16) ?? "sage";
        resource.UpdatedUtc = DateTimeOffset.UtcNow;
        return null;
    }

    private static string NormalizeKind(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return normalized is not null && HortusReservationKinds.IsKnown(normalized)
            ? normalized
            : HortusReservationKinds.Reservation;
    }

    private static string? NormalizeStatus(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return normalized is not null && HortusReservationStatuses.IsKnown(normalized) ? normalized : null;
    }

    private readonly record struct AdminGuard(IResult? Failure, Guid UserId);

    private static async Task<AdminGuard> RequireAdminAsync(HttpContext context, RecreatioDbContext db, CancellationToken ct)
    {
        if (!EndpointHelpers.TryGetUserId(context, out var userId))
        {
            return new AdminGuard(Results.Unauthorized(), Guid.Empty);
        }

        return await HortusShared.IsAdminAsync(db, userId, ct)
            ? new AdminGuard(null, userId)
            : new AdminGuard(Results.Forbid(), Guid.Empty);
    }
}
