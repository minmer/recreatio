using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Events;

namespace Recreatio.Api.Endpoints.Events;

/// <summary>
/// Questions and answers between participants. Every route is authorised by the
/// individual token and scoped to the link it belongs to: the name on a message
/// is the name on the link, so nobody can post as somebody else, and nobody
/// without a link can post at all.
/// </summary>
public static partial class EventEndpoints
{
    private const int MaxTopicsPerPart = 300;
    private const int MaxMessageLength = 2000;

    private static void MapTopicEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/link/{token}/topics/{partId:guid}", async (
            string token,
            Guid partId,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var link = await FindActiveLinkAsync(dbContext, token, ct);
            if (link is null || !await CanReachPartAsync(dbContext, link, partId, "topics", ct))
            {
                return Results.NotFound();
            }

            // Newest conversation first: a topic answered this morning matters
            // more than one opened last week and never touched again. A disabled
            // topic is not listed at all — that is what disabling means.
            var topics = await dbContext.EventTopics.AsNoTracking()
                .Where(x => x.PartId == partId && x.Status != "disabled")
                .OrderByDescending(x => x.LastMessageUtc)
                .Take(MaxTopicsPerPart)
                .Select(x => new EventTopicRow(
                    x.Id, x.Title, x.AuthorName, x.Status, x.CreatedUtc, x.LastMessageUtc, x.MessageCount,
                    x.AccessLinkId == link.Id))
                .ToListAsync(ct);

            return Results.Ok(topics);
        });

        group.MapPost("/link/{token}/topics/{partId:guid}", async (
            string token,
            Guid partId,
            EventTopicCreateRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var link = await FindActiveLinkAsync(dbContext, token, ct);
            if (link is null || !await CanReachPartAsync(dbContext, link, partId, "topics", ct))
            {
                return Results.NotFound();
            }

            var title = NormalizeShort(request.Title, 200);
            var body = NormalizeShort(request.Body, MaxMessageLength);
            if (string.IsNullOrWhiteSpace(title))
            {
                return Results.BadRequest(new { error = "Podaj temat." });
            }
            if (string.IsNullOrWhiteSpace(body))
            {
                return Results.BadRequest(new { error = "Napisz treść pytania." });
            }

            var now = DateTimeOffset.UtcNow;
            var topic = new EventTopic
            {
                Id = Guid.NewGuid(),
                SiteId = link.SiteId,
                PartId = partId,
                AccessLinkId = link.Id,
                AuthorName = link.RecipientName,
                Title = title,
                CreatedUtc = now,
                LastMessageUtc = now,
                MessageCount = 1
            };

            // The question itself is the first message, so a topic is never an
            // empty shell and the thread reads in one order.
            dbContext.EventTopics.Add(topic);
            dbContext.EventTopicMessages.Add(new EventTopicMessage
            {
                Id = Guid.NewGuid(),
                TopicId = topic.Id,
                AccessLinkId = link.Id,
                AuthorName = link.RecipientName,
                Body = body,
                CreatedUtc = now
            });

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(ToTopicRow(topic, link.Id));
        });

        group.MapGet("/link/{token}/topics/{partId:guid}/{topicId:guid}", async (
            string token,
            Guid partId,
            Guid topicId,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var link = await FindActiveLinkAsync(dbContext, token, ct);
            if (link is null || !await CanReachPartAsync(dbContext, link, partId, "topics", ct))
            {
                return Results.NotFound();
            }

            var topic = await dbContext.EventTopics.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == topicId && x.PartId == partId, ct);
            // A disabled topic does not open, for anyone.
            if (topic is null || topic.Status == "disabled")
            {
                return Results.NotFound();
            }

            var messages = await dbContext.EventTopicMessages.AsNoTracking()
                .Where(x => x.TopicId == topicId)
                .OrderBy(x => x.CreatedUtc)
                .Select(x => new EventTopicMessageRow(
                    x.Id, x.AuthorName, x.Body, x.CreatedUtc, x.AccessLinkId == link.Id))
                .ToListAsync(ct);

            return Results.Ok(new EventTopicThread(ToTopicRow(topic, link.Id), messages));
        });

        group.MapPost("/link/{token}/topics/{partId:guid}/{topicId:guid}", async (
            string token,
            Guid partId,
            Guid topicId,
            EventTopicMessageRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var link = await FindActiveLinkAsync(dbContext, token, ct);
            if (link is null || !await CanReachPartAsync(dbContext, link, partId, "topics", ct))
            {
                return Results.NotFound();
            }

            var topic = await dbContext.EventTopics.FirstOrDefaultAsync(x => x.Id == topicId && x.PartId == partId, ct);
            if (topic is null || topic.Status == "disabled")
            {
                return Results.NotFound();
            }
            if (topic.Status != "open")
            {
                return Results.BadRequest(new { error = "Ten temat jest zamknięty — nie można już w nim pisać." });
            }

            var body = NormalizeShort(request.Body, MaxMessageLength);
            if (string.IsNullOrWhiteSpace(body))
            {
                return Results.BadRequest(new { error = "Napisz wiadomość." });
            }

            var now = DateTimeOffset.UtcNow;
            var message = new EventTopicMessage
            {
                Id = Guid.NewGuid(),
                TopicId = topic.Id,
                AccessLinkId = link.Id,
                AuthorName = link.RecipientName,
                Body = body,
                CreatedUtc = now
            };

            dbContext.EventTopicMessages.Add(message);
            topic.LastMessageUtc = now;
            topic.MessageCount += 1;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new EventTopicMessageRow(message.Id, message.AuthorName, message.Body, now, true));
        });

        // The author's own controls: retitle it, close it when it is answered,
        // open it again if it turns out it was not. Never delete — the answers
        // under a question belong to the people who wrote them.
        group.MapPut("/link/{token}/topics/{partId:guid}/{topicId:guid}", async (
            string token,
            Guid partId,
            Guid topicId,
            EventTopicUpdateRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var link = await FindActiveLinkAsync(dbContext, token, ct);
            if (link is null)
            {
                return Results.NotFound();
            }

            var topic = await dbContext.EventTopics
                .FirstOrDefaultAsync(x => x.Id == topicId && x.PartId == partId && x.AccessLinkId == link.Id, ct);
            if (topic is null || topic.Status == "disabled")
            {
                return Results.NotFound();
            }

            var title = NormalizeShort(request.Title, 200);
            if (!string.IsNullOrWhiteSpace(title)) topic.Title = title;

            // An author may close and reopen. Taking a topic out of circulation
            // is a moderator's act, so "disabled" is not on this list.
            if (request.Status is "open" or "closed") topic.Status = request.Status;

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(ToTopicRow(topic, link.Id));
        });
    }

    /** One topic as the reader sees it. viewerLinkId is Guid.Empty for the admin. */
    private static EventTopicRow ToTopicRow(EventTopic topic, Guid viewerLinkId) =>
        new(topic.Id, topic.Title, topic.AuthorName, topic.Status, topic.CreatedUtc,
            topic.LastMessageUtc, topic.MessageCount, topic.AccessLinkId == viewerLinkId);

    private static void MapTopicAdminEndpoints(RouteGroupBuilder group)
    {
        // Moderation, and the whole of it: retitle, close, or take out of
        // circulation. There is no delete — see the entity for why.
        group.MapPut("/admin/topics/{topicId:guid}", async (
            Guid topicId,
            EventTopicUpdateRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var topic = await dbContext.EventTopics.FirstOrDefaultAsync(x => x.Id == topicId, ct);
            if (topic is null) return Results.NotFound();

            var title = NormalizeShort(request.Title, 200);
            if (!string.IsNullOrWhiteSpace(title)) topic.Title = title;
            if (request.Status is "open" or "closed" or "disabled") topic.Status = request.Status;

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(ToTopicRow(topic, Guid.Empty));
        });

        group.MapDelete("/admin/topic-messages/{messageId:guid}", async (
            Guid messageId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var message = await dbContext.EventTopicMessages.FirstOrDefaultAsync(x => x.Id == messageId, ct);
            if (message is null) return Results.NotFound();

            var topic = await dbContext.EventTopics.FirstOrDefaultAsync(x => x.Id == message.TopicId, ct);
            dbContext.EventTopicMessages.Remove(message);
            if (topic is not null && topic.MessageCount > 0) topic.MessageCount -= 1;

            await dbContext.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }
}
