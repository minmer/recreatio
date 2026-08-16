using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Events;

namespace Recreatio.Api.Endpoints.Events;

/// <summary>
/// What a person may do about their own data from behind their individual link:
/// correct the form they submitted, and fill in the participant card — the
/// supplementary details and the statements a minor's guardian has to sign.
///
/// Every endpoint here is authorised by the token alone, and every one of them
/// is scoped to the link that token belongs to. A link can only ever reach its
/// own registration and its own card; there is no id in any route that could be
/// pointed at somebody else's row.
/// </summary>
public static partial class EventEndpoints
{
    /// <summary>Cards can carry a lot of free text; this is the ceiling per answer.</summary>
    private const int MaxCardAnswer = 2000;

    private static void MapParticipantEndpoints(RouteGroupBuilder group)
    {
        // ── The person's own registration ────────────────────────────────────

        group.MapGet("/link/{token}/registration", async (
            string token,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var link = await FindActiveLinkAsync(dbContext, token, ct);
            if (link is null)
            {
                return Results.NotFound();
            }

            var registration = await FindOwnRegistrationAsync(dbContext, link, ct);
            if (registration is null)
            {
                // Not an error: a link can exist without a submission behind it.
                return Results.NoContent();
            }

            var part = await dbContext.EventParts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == registration.PartId, ct);

            var fields = await dbContext.EventPartFields.AsNoTracking()
                .Where(x => x.PartId == registration.PartId)
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);

            var values = await dbContext.EventRegistrationValues.AsNoTracking()
                .Where(x => x.RegistrationId == registration.Id)
                .ToListAsync(ct);

            return Results.Ok(new EventOwnRegistrationResponse(
                registration.Id,
                registration.PartId,
                part?.MenuLabel ?? "Zgłoszenie",
                registration.SubmittedUtc,
                registration.UpdatedUtc,
                fields.Select(ToFieldResponse).ToList(),
                values.Select(x => new EventOwnValue(x.FieldId, x.Value)).ToList()));
        });

        group.MapPut("/link/{token}/registration", async (
            string token,
            EventOwnRegistrationRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var link = await FindActiveLinkAsync(dbContext, token, ct);
            if (link is null)
            {
                return Results.NotFound();
            }

            var registration = await FindOwnRegistrationAsync(dbContext, link, ct);
            if (registration is null)
            {
                return Results.NotFound();
            }

            var fields = await dbContext.EventPartFields.AsNoTracking()
                .Where(x => x.PartId == registration.PartId)
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);

            if (fields.Count == 0)
            {
                return Results.BadRequest(new { error = "Ten formularz nie ma już pól." });
            }

            var supplied = (request.Values ?? [])
                .GroupBy(v => v.FieldId)
                .ToDictionary(g => g.Key, g => g.First().Value);

            var existing = await dbContext.EventRegistrationValues
                .Where(x => x.RegistrationId == registration.Id)
                .ToListAsync(ct);

            var byField = existing.GroupBy(x => x.FieldId).ToDictionary(g => g.Key, g => g.First());

            // Identity is recomputed rather than patched: the person may have
            // corrected the very field the organizer's list is built from.
            string? name = null;
            string? contact = null;

            foreach (var field in fields)
            {
                supplied.TryGetValue(field.Id, out var raw);
                var value = NormalizeFieldValue(field, raw);

                if (field.IsRequired && string.IsNullOrWhiteSpace(value))
                {
                    return Results.BadRequest(new { error = $"Pole „{field.Label}” jest wymagane." });
                }

                if (!string.IsNullOrWhiteSpace(value))
                {
                    if (field.IdentityRole == "name" && name is null) name = Truncate(value, 200);
                    else if (field.IdentityRole == "contact" && contact is null) contact = Truncate(value, 200);
                }

                if (byField.TryGetValue(field.Id, out var row))
                {
                    row.Value = value;
                    row.FieldLabel = field.Label;
                }
                else
                {
                    // A field added to the form after this person submitted.
                    dbContext.EventRegistrationValues.Add(new EventRegistrationValue
                    {
                        Id = Guid.NewGuid(),
                        RegistrationId = registration.Id,
                        FieldId = field.Id,
                        FieldLabel = field.Label,
                        Value = value
                    });
                }
            }

            // Answers to fields the organizer has since deleted are dropped, so
            // the stored submission keeps matching the form that exists.
            var live = fields.Select(x => x.Id).ToHashSet();
            dbContext.EventRegistrationValues.RemoveRange(existing.Where(x => !live.Contains(x.FieldId)));

            if (name is not null) registration.ParticipantName = name;
            if (contact is not null) registration.ParticipantContact = contact;
            registration.UpdatedUtc = DateTimeOffset.UtcNow;

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new EventSubmitResponse(registration.Id, registration.SubmittedUtc));
        });

        // ── The participant card ─────────────────────────────────────────────

        group.MapGet("/link/{token}/card/{partId:guid}", async (
            string token,
            Guid partId,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var link = await FindActiveLinkAsync(dbContext, token, ct);
            if (link is null || !await CanReachCardPartAsync(dbContext, link, partId, ct))
            {
                return Results.NotFound();
            }

            var card = await dbContext.EventParticipantCards.AsNoTracking()
                .FirstOrDefaultAsync(x => x.AccessLinkId == link.Id && x.PartId == partId, ct);

            if (card is null)
            {
                return Results.Ok(new EventParticipantCardResponse(
                    null, new Dictionary<string, string?>(), [], false, "participant",
                    link.RecipientName, link.RecipientName, null, null));
            }

            return Results.Ok(new EventParticipantCardResponse(
                card.Id,
                ReadData(card.DataJson),
                ReadConsents(card.ConsentsJson),
                card.IsMinor,
                card.SignerRole,
                card.SignerName,
                card.ParticipantName,
                card.SubmittedUtc,
                card.UpdatedUtc));
        });

        group.MapPut("/link/{token}/card/{partId:guid}", async (
            string token,
            Guid partId,
            EventParticipantCardRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var link = await FindActiveLinkAsync(dbContext, token, ct);
            if (link is null || !await CanReachCardPartAsync(dbContext, link, partId, ct))
            {
                return Results.NotFound();
            }

            var signerName = NormalizeShort(request.SignerName, 200);
            if (string.IsNullOrWhiteSpace(signerName))
            {
                return Results.BadRequest(new { error = "Podpis jest wymagany." });
            }

            var now = DateTimeOffset.UtcNow;

            // Consents are stamped here, not on the client: the time a person
            // agreed is part of the proof, and a browser clock is not evidence.
            var consents = (request.Consents ?? [])
                .Select(x => new EventConsentRecord(
                    NormalizeShort(x.Code, 60) ?? string.Empty,
                    NormalizeShort(x.Label, 300) ?? string.Empty,
                    NormalizeShort(x.Text, 4000) ?? string.Empty,
                    x.Accepted,
                    x.Accepted ? now : null))
                .Where(x => x.Code.Length > 0)
                .ToList();

            var data = new Dictionary<string, string?>();
            foreach (var pair in request.Data ?? new Dictionary<string, string?>())
            {
                var code = NormalizeShort(pair.Key, 60);
                if (string.IsNullOrWhiteSpace(code)) continue;
                data[code] = NormalizeShort(pair.Value, MaxCardAnswer);
            }

            var card = await dbContext.EventParticipantCards
                .FirstOrDefaultAsync(x => x.AccessLinkId == link.Id && x.PartId == partId, ct);

            var registrationId = link.RegistrationId
                ?? (await FindOwnRegistrationAsync(dbContext, link, ct))?.Id;

            if (card is null)
            {
                card = new EventParticipantCard
                {
                    Id = Guid.NewGuid(),
                    SiteId = link.SiteId,
                    PartId = partId,
                    AccessLinkId = link.Id,
                    RegistrationId = registrationId,
                    SubmittedUtc = now
                };
                dbContext.EventParticipantCards.Add(card);
            }

            card.RegistrationId ??= registrationId;
            card.DataJson = JsonSerializer.Serialize(data);
            card.ConsentsJson = JsonSerializer.Serialize(consents);
            card.ClauseText = NormalizeShort(request.ClauseText, 8000);
            card.IsMinor = request.IsMinor;
            card.SignerRole = request.SignerRole == "guardian" ? "guardian" : "participant";
            card.SignerName = signerName;
            card.ParticipantName = NormalizeShort(request.ParticipantName, 200) ?? link.RecipientName;
            card.UpdatedUtc = now;

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new EventParticipantCardResponse(
                card.Id, data, consents, card.IsMinor, card.SignerRole, card.SignerName,
                card.ParticipantName, card.SubmittedUtc, card.UpdatedUtc));
        });
    }

    // ── Admin: the signed cards ──────────────────────────────────────────────

    private static void MapParticipantAdminEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/admin/sites/{siteId:guid}/cards", async (
            Guid siteId,
            RecreatioDbContext dbContext,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(httpContext, dbContext, ct))
            {
                return Results.Forbid();
            }

            var cards = await dbContext.EventParticipantCards.AsNoTracking()
                .Where(x => x.SiteId == siteId)
                .OrderBy(x => x.ParticipantName)
                .ToListAsync(ct);

            if (cards.Count == 0)
            {
                return Results.Ok(Array.Empty<EventAdminCardRow>());
            }

            var linkIds = cards.Select(x => x.AccessLinkId).Distinct().ToList();
            var links = await dbContext.EventAccessLinks.AsNoTracking()
                .Where(x => linkIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.RecipientName, ct);

            var rows = cards.Select(x => new EventAdminCardRow(
                x.Id,
                x.AccessLinkId,
                links.GetValueOrDefault(x.AccessLinkId) ?? "—",
                x.ParticipantName,
                x.IsMinor,
                x.SignerRole,
                x.SignerName,
                x.SubmittedUtc,
                x.UpdatedUtc,
                ReadData(x.DataJson),
                ReadConsents(x.ConsentsJson))).ToList();

            return Results.Ok(rows);
        });

        // Deleting a card is a separate act from deleting the person: a card can
        // be withdrawn (consent is revocable) while the registration stands.
        group.MapDelete("/admin/cards/{cardId:guid}", async (
            Guid cardId,
            RecreatioDbContext dbContext,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(httpContext, dbContext, ct))
            {
                return Results.Forbid();
            }

            var card = await dbContext.EventParticipantCards.FirstOrDefaultAsync(x => x.Id == cardId, ct);
            if (card is null)
            {
                return Results.NotFound();
            }

            dbContext.EventParticipantCards.Remove(card);
            await dbContext.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    private static async Task<EventAccessLink?> FindActiveLinkAsync(
        RecreatioDbContext dbContext,
        string token,
        CancellationToken ct) =>
        string.IsNullOrWhiteSpace(token)
            ? null
            : await dbContext.EventAccessLinks.FirstOrDefaultAsync(x => x.Token == token && x.Status == "active", ct);

    /// <summary>
    /// The registration this link stands for. Normally the one it was granted
    /// from; failing that, a submission made from inside the link itself.
    /// </summary>
    private static async Task<EventRegistration?> FindOwnRegistrationAsync(
        RecreatioDbContext dbContext,
        EventAccessLink link,
        CancellationToken ct)
    {
        if (link.RegistrationId is Guid id)
        {
            return await dbContext.EventRegistrations.FirstOrDefaultAsync(x => x.Id == id && !x.IsHidden, ct);
        }

        return await dbContext.EventRegistrations
            .Where(x => x.AccessLinkId == link.Id && !x.IsHidden)
            .OrderBy(x => x.SubmittedUtc)
            .FirstOrDefaultAsync(ct);
    }

    private static Task<bool> CanReachCardPartAsync(
        RecreatioDbContext dbContext,
        EventAccessLink link,
        Guid partId,
        CancellationToken ct) => CanReachPartAsync(dbContext, link, partId, "card", ct);

    /// <summary>
    /// A link may only act on a part of the expected kind sitting on a page it
    /// has actually been granted — the same rule the reader's page load obeys.
    /// </summary>
    private static async Task<bool> CanReachPartAsync(
        RecreatioDbContext dbContext,
        EventAccessLink link,
        Guid partId,
        string kind,
        CancellationToken ct)
    {
        var part = await dbContext.EventParts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == partId && x.IsVisible && x.Kind == kind, ct);
        if (part is null)
        {
            return false;
        }

        var page = await dbContext.EventPages.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == part.PageId && x.SiteId == link.SiteId, ct);
        if (page is null)
        {
            return false;
        }

        if (page.Kind == "public")
        {
            return true;
        }

        return await dbContext.EventAccessLinkPages.AsNoTracking()
            .AnyAsync(x => x.AccessLinkId == link.Id && x.PageId == page.Id, ct);
    }

    private static Dictionary<string, string?> ReadData(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string?>>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static List<EventConsentRecord> ReadConsents(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<EventConsentRecord>>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
