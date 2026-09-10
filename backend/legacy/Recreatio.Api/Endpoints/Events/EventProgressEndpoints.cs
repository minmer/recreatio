using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;

namespace Recreatio.Api.Endpoints.Events;

/// <summary>
/// What one person still has to do, in one answer.
///
/// A participant's obligations are scattered across the event by design: the
/// sign-up form lives on the public page, the card with its consents behind the
/// individual link, a note about the money in the organizer's own column. Each
/// of those knows only about itself, and the person is left to work out from
/// three different slides whether they are finished. This endpoint is the one
/// place that answers the question they actually have.
///
/// It answers it for the holder of the token and for nobody else. Every part it
/// reports on is a part this link may already open, and every fact about it —
/// submitted or not, signed or not — is a fact about the person asking.
///
/// It also returns where each thing lives: the page it sits on and its position
/// there. That is what makes the answer useful rather than merely true — the
/// list can then say "this is missing" and hand over a link that opens it.
/// </summary>
public static partial class EventEndpoints
{
    private static void MapProgressEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/link/{token}/progress", async (
            string token,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(token)) return Results.NotFound();

            var link = await dbContext.EventAccessLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Token == token && x.Status == "active", ct);
            if (link is null) return Results.NotFound();

            // The pages this link may open — the same set the link view returns,
            // so the list can never point at a page the person cannot reach.
            var grantedIds = await dbContext.EventAccessLinkPages.AsNoTracking()
                .Where(x => x.AccessLinkId == link.Id)
                .Select(x => x.PageId)
                .ToListAsync(ct);

            var pages = await dbContext.EventPages.AsNoTracking()
                .Where(x => x.SiteId == link.SiteId && (x.Kind == "public" || grantedIds.Contains(x.Id)))
                .OrderBy(x => x.Kind == "public" ? 0 : 1)
                .ThenBy(x => x.SortOrder)
                .ToListAsync(ct);

            var pageIds = pages.Select(x => x.Id).ToList();
            var parts = await dbContext.EventParts.AsNoTracking()
                .Where(x => pageIds.Contains(x.PageId) && x.IsVisible)
                .OrderBy(x => x.SortOrder)
                .ToListAsync(ct);

            // What this person has sent in, and what they have signed.
            var registrations = await dbContext.EventRegistrations.AsNoTracking()
                .Where(x => x.SiteId == link.SiteId
                    && (x.AccessLinkId == link.Id || (link.RegistrationId != null && x.Id == link.RegistrationId)))
                .ToListAsync(ct);

            var cards = await dbContext.EventParticipantCards.AsNoTracking()
                .Where(x => x.AccessLinkId == link.Id)
                .ToListAsync(ct);

            var steps = new List<EventProgressStep>();
            foreach (var page in pages)
            {
                // The position the shell will render it at: visible parts of that
                // page, in order, counted from one — which is exactly what
                // /event/link/{token}/{page}/{n} means.
                var pageParts = parts.Where(x => x.PageId == page.Id).ToList();

                for (var index = 0; index < pageParts.Count; index += 1)
                {
                    var part = pageParts[index];
                    if (part.Kind != "form" && part.Kind != "card") continue;

                    var registration = registrations.FirstOrDefault(x => x.PartId == part.Id);
                    var card = cards.FirstOrDefault(x => x.PartId == part.Id);

                    var done = part.Kind == "form" ? registration is not null : card is not null;
                    var doneUtc = part.Kind == "form" ? registration?.SubmittedUtc : card?.SubmittedUtc;

                    steps.Add(new EventProgressStep(
                        part.Id,
                        part.Kind,
                        part.MenuLabel,
                        page.Slug,
                        index + 1,
                        done,
                        doneUtc,
                        card?.IsMinor ?? false));
                }
            }

            // The organizer's own columns about this person — the money, the
            // returned form. Their row is keyed by the registration they came
            // from, or by the link when they were entered by hand.
            var rowKeys = registrations.Select(x => $"r-{x.Id}").Append($"l-{link.Id}").ToList();
            var marks = await dbContext.EventRosterEntries.AsNoTracking()
                .Where(x => x.SiteId == link.SiteId && rowKeys.Contains(x.RowKey))
                .Select(x => new EventProgressMark(x.Code, x.Value))
                .ToListAsync(ct);

            return Results.Ok(new EventProgressResponse(link.RecipientName, steps, marks));
        });
    }
}
