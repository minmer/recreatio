using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Events;

namespace Recreatio.Api.Endpoints.Events;

/// <summary>
/// The participant list as a slide: the registration, the individual link and
/// the signed card of one person in one row, so the organizer stops reading the
/// same name in three places.
///
/// Two rules decide what leaves the server here, and neither of them is left to
/// the browser:
///
///  1. **A column that is switched off is never sent.** The slide's config names
///     the columns; anything not named is dropped before the response is built.
///     Hiding a column in the table would hide it from the eye only — the values
///     would still sit in the payload for whoever opens the console. "Hidden"
///     therefore means *fetched but folded away*, and "off" means *not fetched*,
///     which is the difference the organizer is actually choosing between.
///
///  2. **The page decides who may look.** A roster on a public page is public,
///     exactly as it was built; on an internal page it needs a link that was
///     granted that page — the same test the form submit endpoint runs. The
///     organizer places the slide, so the placement is the permission.
/// </summary>
public static partial class EventEndpoints
{
    /// <summary>
    /// Polish names for the card's fixed field codes. The card itself is built in
    /// the browser (cardLevels.ts), so a code the organizer invented for a
    /// question of their own has no name here — it falls back to the code, and
    /// the builder lets them rename the column anyway.
    /// </summary>
    private static readonly Dictionary<string, string> CardFieldLabels = new()
    {
        ["participantName"] = "Imię i nazwisko (karta)",
        ["birthDate"] = "Data urodzenia",
        ["pesel"] = "PESEL",
        ["address"] = "Adres zamieszkania",
        ["guardian1Name"] = "Opiekun — imię i nazwisko",
        ["guardian1Phone"] = "Opiekun — telefon",
        ["guardianAddress"] = "Adres opiekunów",
        ["emergencyName"] = "Kontakt na wydarzenie — kto",
        ["emergencyPhone"] = "Kontakt na wydarzenie — telefon",
        ["specialNeeds"] = "Szczególne potrzeby edukacyjne",
        ["vaccTetanus"] = "Szczepienie: tężec",
        ["vaccDiphtheria"] = "Szczepienie: błonica",
        ["health"] = "Zdrowie: zgłoszone",
        ["healthDetail"] = "Zdrowie: szczegóły",
        ["diet"] = "Dieta: zgłoszona",
        ["dietDetail"] = "Dieta: jaka"
    };

    private const string GroupPerson = "Osoba";
    private const string GroupCard = "Karta uczestnika";
    private const string GroupConsents = "Zgody";
    private const string GroupAssignments = "Przydziały z linku";
    private const string GroupMarks = "Dopisane na liście";

    private static void MapRosterEndpoints(RouteGroupBuilder group)
    {
        // The column universe, for the builder. Everything a roster on this event
        // could show, with the number of people who have a value there — so the
        // organizer picks from what exists rather than from what might exist.
        group.MapGet("/admin/sites/{siteId:guid}/roster-columns", async (
            Guid siteId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var site = await dbContext.EventSites.AsNoTracking().FirstOrDefaultAsync(x => x.Id == siteId, ct);
            if (site is null) return Results.NotFound();

            // No filter: the builder is allowed to see which columns exist. It
            // gets names and counts, never anybody's answers.
            var roster = await BuildRosterAsync(
                dbContext, siteId, includeLinkOnly: true, allowed: null, partId: null, extras: null, ct);
            return Results.Ok(roster.Columns);
        }).RequireAuthorization();

        // The table itself, for whoever is reading the page the slide sits on.
        group.MapGet("/site/{slug}/parts/{partId:guid}/roster", async (
            string slug,
            Guid partId,
            string? token,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            // Not FindPublishedSiteAsync: an internal page is reached through a
            // link, and a link works while the event is still a draft — that is
            // how an organizer checks their own list before publishing. The
            // publication gate belongs to the public page, and stands below.
            var normalized = slug.Trim().ToLowerInvariant();
            var site = await dbContext.EventSites.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == normalized, ct);
            if (site is null) return Results.NotFound();

            var part = await dbContext.EventParts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == partId, ct);
            if (part is null || !part.IsVisible || part.Kind != "roster") return Results.NotFound();

            var page = await dbContext.EventPages.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == part.PageId && x.SiteId == site.Id, ct);
            if (page is null) return Results.NotFound();

            var access = await ResolveAccessAsync(dbContext, context, site.Id, page.Id, token, ct);

            if (page.Kind == "public")
            {
                if (!site.IsPublished) return Results.NotFound();
            }
            else if (!access.MayRead)
            {
                return Results.NotFound();
            }

            var config = ReadRosterConfig(part.ConfigJson);
            if (config.Allowed.Count == 0)
            {
                return Results.Ok(new EventRosterResponse([], [], IsUnconfigured: true, MayFill: false));
            }

            var roster = await BuildRosterAsync(
                dbContext, site.Id, config.IncludeLinkOnly, config.Allowed, part.Id, config.Extras, ct);

            return Results.Ok(new EventRosterResponse(
                roster.Columns, roster.Rows, IsUnconfigured: false, MayFill(config, access, page.Kind)));
        });

        // Writing one mark: attendance ticked off, a note added.
        group.MapPut("/site/{slug}/parts/{partId:guid}/roster/{rowKey}", async (
            string slug,
            Guid partId,
            string rowKey,
            string? token,
            EventRosterMarkRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var normalized = slug.Trim().ToLowerInvariant();
            var site = await dbContext.EventSites.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Slug == normalized, ct);
            if (site is null) return Results.NotFound();

            var part = await dbContext.EventParts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == partId, ct);
            if (part is null || !part.IsVisible || part.Kind != "roster") return Results.NotFound();

            var page = await dbContext.EventPages.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == part.PageId && x.SiteId == site.Id, ct);
            if (page is null) return Results.NotFound();

            var access = await ResolveAccessAsync(dbContext, context, site.Id, page.Id, token, ct);
            var config = ReadRosterConfig(part.ConfigJson);

            if (!MayFill(config, access, page.Kind))
            {
                return Results.Forbid();
            }

            if (!config.Extras.TryGetValue(request.Code.Trim(), out var extra))
            {
                // A column the slide does not declare is not a column. Otherwise
                // the table would be a place to store anything at all.
                return Results.BadRequest(new { error = "Nieznana kolumna." });
            }

            if (!await RowExistsAsync(dbContext, site.Id, rowKey, ct))
            {
                return Results.NotFound();
            }

            var value = NormalizeMark(extra, request.Value);
            var existing = await dbContext.EventRosterEntries
                .FirstOrDefaultAsync(x => x.PartId == partId && x.RowKey == rowKey && x.Code == extra.Code, ct);

            var who = access.IsAdmin ? "organizator" : access.Link?.RecipientName;
            var now = DateTimeOffset.UtcNow;

            if (value is null)
            {
                // A mark taken back leaves no row: an empty cell and a cell that
                // says nothing are the same thing to everybody reading the list.
                if (existing is not null) dbContext.EventRosterEntries.Remove(existing);
            }
            else if (existing is null)
            {
                dbContext.EventRosterEntries.Add(new EventRosterEntry
                {
                    Id = Guid.NewGuid(),
                    SiteId = site.Id,
                    PartId = partId,
                    RowKey = rowKey,
                    Code = extra.Code,
                    Value = value,
                    UpdatedBy = who,
                    UpdatedUtc = now
                });
            }
            else
            {
                existing.Value = value;
                existing.UpdatedBy = who;
                existing.UpdatedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new EventRosterMarkResponse(rowKey, extra.Code, value, who, now));
        });
    }

    /// <summary>
    /// Whether the row being written to is a row of this event — a registration
    /// or a link of this site. The key comes from the browser, so it is checked
    /// rather than trusted.
    /// </summary>
    private static async Task<bool> RowExistsAsync(
        RecreatioDbContext dbContext,
        Guid siteId,
        string rowKey,
        CancellationToken ct)
    {
        if (rowKey.Length < 3 || !Guid.TryParse(rowKey[2..], out var id)) return false;

        return rowKey[0] switch
        {
            'r' => await dbContext.EventRegistrations.AsNoTracking()
                .AnyAsync(x => x.Id == id && x.SiteId == siteId, ct),
            'l' => await dbContext.EventAccessLinks.AsNoTracking()
                .AnyAsync(x => x.Id == id && x.SiteId == siteId, ct),
            _ => false
        };
    }

    /// <summary>
    /// The value as the column allows it, or null to clear the cell. The kind is
    /// declared in the slide, so it is enforced here — a "check" column that
    /// arrives holding a paragraph is not a check column any more.
    /// </summary>
    private static string? NormalizeMark(RosterExtra extra, string? raw)
    {
        var value = raw?.Trim();
        if (string.IsNullOrWhiteSpace(value)) return null;

        switch (extra.Kind)
        {
            case "check":
                return value is "tak" or "true" or "1" ? "tak" : null;

            case "number":
                return decimal.TryParse(
                    value.Replace(',', '.'),
                    System.Globalization.NumberStyles.Number,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out _)
                        ? value
                        : null;

            case "choice":
                return extra.Options.FirstOrDefault(
                    option => string.Equals(option, value, StringComparison.OrdinalIgnoreCase));

            default:
                return value.Length > 400 ? value[..400] : value;
        }
    }

    /// <summary>
    /// Who is asking. An internal page opens for the link that was granted it —
    /// and for the organizer, who would otherwise have to send themselves a link
    /// to look at their own event.
    /// </summary>
    private sealed record RosterAccess(bool ViaLink, bool IsAdmin, EventAccessLink? Link)
    {
        public bool MayRead => ViaLink || IsAdmin;
    }

    private static async Task<RosterAccess> ResolveAccessAsync(
        RecreatioDbContext dbContext,
        HttpContext context,
        Guid siteId,
        Guid pageId,
        string? token,
        CancellationToken ct)
    {
        EventAccessLink? link = null;
        var viaLink = false;

        if (!string.IsNullOrWhiteSpace(token))
        {
            link = await dbContext.EventAccessLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Token == token && x.SiteId == siteId && x.Status == "active", ct);
            if (link is not null)
            {
                viaLink = await dbContext.EventAccessLinkPages.AsNoTracking()
                    .AnyAsync(x => x.AccessLinkId == link.Id && x.PageId == pageId, ct);
            }
        }

        return new RosterAccess(viaLink, await IsAdminAsync(context, dbContext, ct), link);
    }

    /// <summary>
    /// Whether this reader may write the organizer's own columns.
    ///
    /// The organizer always may. Anybody else needs three things at once: the
    /// slide has to invite it, the page has to be an internal one, and the
    /// reader has to have come through a link that was granted that page. A
    /// public page is never writable by its readers — a list anyone on the
    /// internet can tick off is not a list of who was there.
    /// </summary>
    private static bool MayFill(RosterConfig config, RosterAccess access, string pageKind) =>
        config.Extras.Count > 0
        && (access.IsAdmin || (config.ReadersMayFill && pageKind != "public" && access.ViaLink));

    // ── Config ───────────────────────────────────────────────────────────────

    /// <summary>A column the organizer fills in on the list itself.</summary>
    private sealed record RosterExtra(string Code, string Label, string Kind, IReadOnlyList<string> Options);

    private sealed record RosterConfig(
        Dictionary<string, string> Allowed,
        bool IncludeLinkOnly,
        Dictionary<string, RosterExtra> Extras,
        /// <summary>Whether people holding a link may write, or only the organizer.</summary>
        bool ReadersMayFill);

    /// <summary>
    /// Reads the slide's config the way every part module reads its own: badly
    /// formed JSON is an empty roster, not an exception. Only the two things the
    /// server has to decide are read here — which columns may be sent, and who
    /// counts as a person. The rest (order, presets, search wording) is the
    /// browser's business.
    /// </summary>
    private static RosterConfig ReadRosterConfig(string? configJson)
    {
        var allowed = new Dictionary<string, string>(StringComparer.Ordinal);
        var extras = new Dictionary<string, RosterExtra>(StringComparer.Ordinal);
        var includeLinkOnly = false;
        var readersMayFill = false;

        var empty = new RosterConfig(allowed, includeLinkOnly, extras, readersMayFill);
        if (string.IsNullOrWhiteSpace(configJson)) return empty;

        try
        {
            using var document = JsonDocument.Parse(configJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return empty;

            if (root.TryGetProperty("whoMayFill", out var whoMayFill)
                && whoMayFill.ValueKind == JsonValueKind.String
                && whoMayFill.GetString() == "readers")
            {
                readersMayFill = true;
            }

            if (root.TryGetProperty("extras", out var declared) && declared.ValueKind == JsonValueKind.Array)
            {
                foreach (var extra in declared.EnumerateArray())
                {
                    if (extra.ValueKind != JsonValueKind.Object) continue;

                    var code = extra.TryGetProperty("code", out var codeValue) && codeValue.ValueKind == JsonValueKind.String
                        ? codeValue.GetString()?.Trim()
                        : null;
                    if (string.IsNullOrWhiteSpace(code) || code.Length > 40) continue;

                    var label = extra.TryGetProperty("label", out var labelValue) && labelValue.ValueKind == JsonValueKind.String
                        ? labelValue.GetString()?.Trim()
                        : null;

                    var kind = extra.TryGetProperty("kind", out var kindValue) && kindValue.ValueKind == JsonValueKind.String
                        ? kindValue.GetString()
                        : null;

                    var options = new List<string>();
                    if (extra.TryGetProperty("options", out var optionValues) && optionValues.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var option in optionValues.EnumerateArray())
                        {
                            if (option.ValueKind != JsonValueKind.String) continue;
                            var text = option.GetString()?.Trim();
                            if (!string.IsNullOrWhiteSpace(text)) options.Add(text);
                        }
                    }

                    extras[code] = new RosterExtra(
                        code,
                        string.IsNullOrWhiteSpace(label) ? code : label,
                        kind is "check" or "number" or "choice" ? kind : "text",
                        options);
                }
            }

            if (root.TryGetProperty("source", out var source)
                && source.ValueKind == JsonValueKind.String
                && source.GetString() == "everyone")
            {
                includeLinkOnly = true;
            }

            if (root.TryGetProperty("columns", out var columns) && columns.ValueKind == JsonValueKind.Array)
            {
                foreach (var column in columns.EnumerateArray())
                {
                    if (column.ValueKind != JsonValueKind.Object) continue;

                    var key = column.TryGetProperty("key", out var keyValue) && keyValue.ValueKind == JsonValueKind.String
                        ? keyValue.GetString()
                        : null;
                    if (string.IsNullOrWhiteSpace(key)) continue;

                    var state = column.TryGetProperty("state", out var stateValue)
                        && stateValue.ValueKind == JsonValueKind.String
                            ? stateValue.GetString()
                            : "off";

                    // Anything that is not plainly "visible" or "hidden" stays
                    // off: a config half-written by hand should leak nothing.
                    if (state != "visible" && state != "hidden") continue;

                    var label = column.TryGetProperty("label", out var labelValue)
                        && labelValue.ValueKind == JsonValueKind.String
                            ? labelValue.GetString()
                            : null;

                    allowed[key] = string.IsNullOrWhiteSpace(label) ? string.Empty : label;
                }
            }
        }
        catch (JsonException)
        {
            // Half-written config: nothing may leave and nothing may be written.
            // Both defaults fail closed.
            return new RosterConfig(
                new Dictionary<string, string>(StringComparer.Ordinal),
                false,
                new Dictionary<string, RosterExtra>(StringComparer.Ordinal),
                false);
        }

        return new RosterConfig(allowed, includeLinkOnly, extras, readersMayFill);
    }

    // ── The table ────────────────────────────────────────────────────────────

    /// <summary>
    /// Builds the whole table once, then keeps the columns that are allowed.
    /// <paramref name="allowed"/> is null for the builder's column list — it asks
    /// what exists, and gets names and counts without any values.
    /// </summary>
    private static async Task<(List<EventRosterColumn> Columns, List<EventRosterRow> Rows)> BuildRosterAsync(
        RecreatioDbContext dbContext,
        Guid siteId,
        bool includeLinkOnly,
        IReadOnlyDictionary<string, string>? allowed,
        Guid? partId,
        IReadOnlyDictionary<string, RosterExtra>? extras,
        CancellationToken ct)
    {
        // Hidden registrations are out of the working list by the organizer's own
        // decision; a slide is no place to bring them back.
        var registrations = await dbContext.EventRegistrations.AsNoTracking()
            .Where(x => x.SiteId == siteId && !x.IsHidden)
            .ToListAsync(ct);

        var registrationIds = registrations.Select(x => x.Id).ToList();
        var values = registrationIds.Count == 0
            ? []
            : await dbContext.EventRegistrationValues.AsNoTracking()
                .Where(x => registrationIds.Contains(x.RegistrationId))
                .ToListAsync(ct);

        var links = await dbContext.EventAccessLinks.AsNoTracking()
            .Where(x => x.SiteId == siteId)
            .ToListAsync(ct);

        var linkIds = links.Select(x => x.Id).ToList();
        var assignments = linkIds.Count == 0
            ? []
            : await dbContext.EventAccessLinkAssignments.AsNoTracking()
                .Where(x => linkIds.Contains(x.AccessLinkId))
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);

        var cards = await dbContext.EventParticipantCards.AsNoTracking()
            .Where(x => x.SiteId == siteId)
            .ToListAsync(ct);

        var pageIds = await dbContext.EventPages.AsNoTracking()
            .Where(x => x.SiteId == siteId)
            .Select(x => x.Id)
            .ToListAsync(ct);

        var parts = await dbContext.EventParts.AsNoTracking()
            .Where(x => pageIds.Contains(x.PageId))
            .OrderBy(x => x.SortOrder)
            .Select(x => new { x.Id, x.Kind, x.MenuLabel, x.SortOrder })
            .ToListAsync(ct);

        var formParts = parts.Where(x => x.Kind == "form").ToList();
        var formPartIds = formParts.Select(x => x.Id).ToList();
        var fields = formPartIds.Count == 0
            ? []
            : await dbContext.EventPartFields.AsNoTracking()
                .Where(x => formPartIds.Contains(x.PartId))
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);

        // ── Which columns this event can offer ──────────────────────────────
        var definitions = new List<EventRosterColumn>
        {
            new("person.name", "Imię i nazwisko", GroupPerson, 0),
            new("person.contact", "Kontakt", GroupPerson, 0),
            new("person.submitted", "Data zgłoszenia", GroupPerson, 0),
            new("person.form", "Formularz", GroupPerson, 0),
            new("person.link", "Link osobisty", GroupPerson, 0),
            new("person.card", "Karta", GroupPerson, 0)
        };

        var partLabels = parts.ToDictionary(x => x.Id, x => x.MenuLabel);
        foreach (var field in fields.OrderBy(x => formPartIds.IndexOf(x.PartId)).ThenBy(x => x.SortOrder))
        {
            var group = formParts.Count > 1
                ? $"Formularz: {partLabels.GetValueOrDefault(field.PartId) ?? "—"}"
                : "Formularz";
            definitions.Add(new EventRosterColumn($"field:{field.Id}", field.Label, group, 0));
        }

        var cardData = cards.ToDictionary(x => x.Id, x => ReadData(x.DataJson));
        var cardConsents = cards.ToDictionary(x => x.Id, x => ReadConsents(x.ConsentsJson));

        if (cards.Count > 0)
        {
            definitions.Add(new EventRosterColumn("card.minor", "Niepełnoletni", GroupCard, 0));
            definitions.Add(new EventRosterColumn("card.signer", "Podpisał", GroupCard, 0));
            definitions.Add(new EventRosterColumn("card.submitted", "Karta wypełniona", GroupCard, 0));

            // The known codes first, in the order the card asks them, then
            // whatever else somebody's card happens to carry.
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var code in CardFieldLabels.Keys)
            {
                if (cardData.Values.Any(data => data.ContainsKey(code)) && seen.Add(code))
                {
                    definitions.Add(new EventRosterColumn($"card:{code}", CardFieldLabels[code], GroupCard, 0));
                }
            }

            foreach (var code in cardData.Values.SelectMany(data => data.Keys).Distinct(StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal))
            {
                if (seen.Add(code))
                {
                    definitions.Add(new EventRosterColumn($"card:{code}", CardFieldLabels.GetValueOrDefault(code, code), GroupCard, 0));
                }
            }

            foreach (var consent in cardConsents.Values.SelectMany(list => list)
                .GroupBy(x => x.Code, StringComparer.Ordinal))
            {
                var label = consent.Select(x => x.Label).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)) ?? consent.Key;
                definitions.Add(new EventRosterColumn($"consent:{consent.Key}", label, GroupConsents, 0));
            }
        }

        foreach (var label in assignments.Select(x => x.Label).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            definitions.Add(new EventRosterColumn(AssignmentKey(label), label, GroupAssignments, 0));
        }

        // The organizer's own columns, and what has been written in them so far.
        var marksByRow = new Dictionary<string, List<EventRosterEntry>>(StringComparer.Ordinal);
        if (partId is not null && extras is not null && extras.Count > 0)
        {
            foreach (var extra in extras.Values)
            {
                definitions.Add(new EventRosterColumn($"extra:{extra.Code}", extra.Label, GroupMarks, 0));
            }

            marksByRow = (await dbContext.EventRosterEntries.AsNoTracking()
                .Where(x => x.PartId == partId.Value)
                .ToListAsync(ct))
                .Where(x => extras.ContainsKey(x.Code))
                .GroupBy(x => x.RowKey, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);
        }

        // ── One row per person ───────────────────────────────────────────────
        var valuesByRegistration = values
            .GroupBy(x => x.RegistrationId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var linkByRegistration = links
            .Where(x => x.RegistrationId.HasValue)
            .GroupBy(x => x.RegistrationId!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        // An event can carry more than one card part; the latest signature is the
        // one that describes the person now.
        var cardByLink = cards
            .GroupBy(x => x.AccessLinkId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.UpdatedUtc).First());

        var assignmentsByLink = assignments
            .GroupBy(x => x.AccessLinkId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Built whole first: the builder's counts have to see every value, and the
        // reader's response is that same table with the disallowed columns taken
        // out at the last step.
        var built = new List<(string Key, Dictionary<string, string?> Values)>();
        var usedLinks = new HashSet<Guid>();

        foreach (var registration in registrations.OrderByDescending(x => x.SubmittedUtc))
        {
            linkByRegistration.TryGetValue(registration.Id, out var link);
            if (link is not null) usedLinks.Add(link.Id);
            var card = link is not null ? cardByLink.GetValueOrDefault(link.Id) : null;

            var row = new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["person.name"] = registration.ParticipantName ?? link?.RecipientName,
                ["person.contact"] = registration.ParticipantContact ?? link?.RecipientContact,
                ["person.submitted"] = registration.SubmittedUtc.ToString("o"),
                ["person.form"] = partLabels.GetValueOrDefault(registration.PartId),
                ["person.link"] = link is not null && link.Status == "active" ? "tak" : "nie",
                ["person.card"] = card is not null ? "tak" : "nie"
            };

            foreach (var value in valuesByRegistration.GetValueOrDefault(registration.Id) ?? [])
            {
                row[$"field:{value.FieldId}"] = value.Value;
            }

            AddCard(row, card, cardData, cardConsents);
            AddAssignments(row, link, assignmentsByLink);
            AddMarks(row, $"r-{registration.Id}", marksByRow);

            built.Add(($"r-{registration.Id}", row));
        }

        if (includeLinkOnly)
        {
            // People the organizer typed in by hand: a link and a card, but no
            // submission behind them. They are on the event all the same.
            foreach (var link in links.Where(x => !usedLinks.Contains(x.Id) && x.RegistrationId is null)
                .OrderBy(x => x.RecipientName, StringComparer.CurrentCulture))
            {
                var card = cardByLink.GetValueOrDefault(link.Id);
                var row = new Dictionary<string, string?>(StringComparer.Ordinal)
                {
                    ["person.name"] = link.RecipientName,
                    ["person.contact"] = link.RecipientContact,
                    ["person.submitted"] = null,
                    ["person.form"] = null,
                    ["person.link"] = link.Status == "active" ? "tak" : "nie",
                    ["person.card"] = card is not null ? "tak" : "nie"
                };

                AddCard(row, card, cardData, cardConsents);
                AddAssignments(row, link, assignmentsByLink);
                AddMarks(row, $"l-{link.Id}", marksByRow);

                built.Add(($"l-{link.Id}", row));
            }
        }

        // ── The columns that survive, with their labels and their counts ─────
        var columns = new List<EventRosterColumn>();
        foreach (var definition in definitions)
        {
            string? chosenLabel = null;
            if (allowed is not null && !allowed.TryGetValue(definition.Key, out chosenLabel)) continue;

            var filled = built.Count(entry =>
                entry.Values.TryGetValue(definition.Key, out var value) && !string.IsNullOrWhiteSpace(value));

            // The organizer may rename a column; an empty name means the one it
            // came with was fine.
            columns.Add(definition with
            {
                Label = string.IsNullOrWhiteSpace(chosenLabel) ? definition.Label : chosenLabel,
                Filled = filled
            });
        }

        var rows = built.Select(entry => new EventRosterRow(entry.Key, Keep(entry.Values, allowed))).ToList();
        return (columns, rows);
    }

    private static void AddCard(
        Dictionary<string, string?> row,
        EventParticipantCard? card,
        IReadOnlyDictionary<Guid, Dictionary<string, string?>> cardData,
        IReadOnlyDictionary<Guid, List<EventConsentRecord>> cardConsents)
    {
        if (card is null) return;

        row["card.minor"] = card.IsMinor ? "tak" : "nie";
        row["card.signer"] = card.SignerName;
        row["card.submitted"] = card.SubmittedUtc.ToString("o");

        foreach (var (code, value) in cardData.GetValueOrDefault(card.Id) ?? [])
        {
            row[$"card:{code}"] = value;
        }

        foreach (var consent in cardConsents.GetValueOrDefault(card.Id) ?? [])
        {
            row[$"consent:{consent.Code}"] = consent.Accepted ? "tak" : "nie";
        }
    }

    private static void AddMarks(
        Dictionary<string, string?> row,
        string rowKey,
        IReadOnlyDictionary<string, List<EventRosterEntry>> marksByRow)
    {
        foreach (var mark in marksByRow.GetValueOrDefault(rowKey) ?? [])
        {
            row[$"extra:{mark.Code}"] = mark.Value;
        }
    }

    private static void AddAssignments(
        Dictionary<string, string?> row,
        EventAccessLink? link,
        IReadOnlyDictionary<Guid, List<EventAccessLinkAssignment>> assignmentsByLink)
    {
        if (link is null) return;

        foreach (var assignment in assignmentsByLink.GetValueOrDefault(link.Id) ?? [])
        {
            row[AssignmentKey(assignment.Label)] = assignment.Value;
        }
    }

    /// <summary>
    /// Assignment labels are typed by hand per person, so "Grupa" and "grupa" are
    /// one column. The label shown is whichever spelling the builder picked up.
    /// </summary>
    private static string AssignmentKey(string label) => $"assign:{label.Trim().ToLowerInvariant()}";

    /// <summary>
    /// Drops everything the slide did not ask for. Null means the caller is the
    /// builder asking which columns exist — it gets no values at all.
    /// </summary>
    private static Dictionary<string, string?> Keep(
        Dictionary<string, string?> row,
        IReadOnlyDictionary<string, string>? allowed)
    {
        if (allowed is null) return [];

        var kept = new Dictionary<string, string?>(StringComparer.Ordinal);
        foreach (var (key, value) in row)
        {
            if (allowed.ContainsKey(key) && !string.IsNullOrWhiteSpace(value)) kept[key] = value;
        }

        return kept;
    }
}
