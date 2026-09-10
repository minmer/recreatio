using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Calendar;
using Recreatio.Api.Options;

namespace Recreatio.Api.Services;

public sealed class CalendarReminderDispatcherHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<CalendarReminderDispatcherHostedService> _logger;
    private readonly CalendarOptions _options;

    public CalendarReminderDispatcherHostedService(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpClientFactory,
        IOptions<CalendarOptions> options,
        ILogger<CalendarReminderDispatcherHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var pollSeconds = Math.Clamp(_options.ReminderPollSeconds, 10, 3600);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DispatchCycleAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Calendar reminder dispatcher cycle failed.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(pollSeconds), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task DispatchCycleAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<RecreatioDbContext>();
        var graphRuntimeService = scope.ServiceProvider.GetRequiredService<ICalendarGraphRuntimeService>();

        var now = DateTimeOffset.UtcNow;
        await ProcessRetriesAsync(dbContext, now, ct);

        var lookbackMinutes = Math.Clamp(_options.ReminderLookbackMinutes, 1, 120);
        var lookaheadMinutes = Math.Clamp(_options.ReminderLookaheadMinutes, 1, 60 * 24 * 31);
        var batchSize = Math.Clamp(_options.ReminderBatchSize, 10, 1000);

        var reminderRows = await (
            from reminder in dbContext.CalendarEventReminders.AsNoTracking()
            join item in dbContext.CalendarEvents.AsNoTracking() on reminder.EventId equals item.Id
            where reminder.Status == "active" &&
                  !item.IsArchived &&
                  item.Status != "cancelled"
            select new { reminder, item })
            .OrderBy(row => row.reminder.UpdatedUtc)
            .Take(batchSize)
            .ToListAsync(ct);

        if (reminderRows.Count == 0)
        {
            return;
        }

        var lookbackUtc = now.AddMinutes(-lookbackMinutes);
        var horizonUtc = now.AddMinutes(lookaheadMinutes);

        foreach (var row in reminderRows)
        {
            var item = row.item;
            var reminder = row.reminder;
            var occurrenceFrom = lookbackUtc.AddMinutes(reminder.MinutesBefore);
            var occurrenceTo = horizonUtc.AddMinutes(reminder.MinutesBefore);
            var occurrences = await graphRuntimeService.ExpandOccurrencesAsync(item, occurrenceFrom, occurrenceTo, ct);

            foreach (var occurrence in occurrences)
            {
                var dueUtc = occurrence.StartUtc.AddMinutes(-reminder.MinutesBefore);
                if (dueUtc > now || dueUtc < lookbackUtc)
                {
                    continue;
                }

                await UpsertDispatchAsync(dbContext, reminder, item, occurrence.StartUtc, dueUtc, ct);
            }
        }
    }

    private async Task ProcessRetriesAsync(RecreatioDbContext dbContext, DateTimeOffset now, CancellationToken ct)
    {
        var retryCandidates = await dbContext.CalendarReminderDispatches
            .Where(entry =>
                entry.Channel == "webhook" &&
                (entry.Status == "pending" || entry.Status == "failed") &&
                entry.NextRetryUtc != null &&
                entry.NextRetryUtc <= now)
            .OrderBy(entry => entry.NextRetryUtc)
            .Take(200)
            .ToListAsync(ct);

        if (retryCandidates.Count == 0)
        {
            return;
        }

        var reminderIds = retryCandidates.Select(entry => entry.ReminderId).Distinct().ToList();
        var eventIds = retryCandidates.Select(entry => entry.EventId).Distinct().ToList();
        var reminders = await dbContext.CalendarEventReminders.AsNoTracking()
            .Where(entry => reminderIds.Contains(entry.Id))
            .ToDictionaryAsync(entry => entry.Id, ct);
        var events = await dbContext.CalendarEvents.AsNoTracking()
            .Where(entry => eventIds.Contains(entry.Id))
            .ToDictionaryAsync(entry => entry.Id, ct);

        foreach (var dispatch in retryCandidates)
        {
            if (!reminders.TryGetValue(dispatch.ReminderId, out var reminder) || !events.TryGetValue(dispatch.EventId, out var item))
            {
                dispatch.Status = "failed";
                dispatch.LastError = "Reminder or event no longer exists.";
                dispatch.NextRetryUtc = null;
                dispatch.UpdatedUtc = now;
                continue;
            }

            await DispatchWebhookAsync(dbContext, dispatch, reminder, item, dispatch.OccurrenceStartUtc, ct);
        }

        await dbContext.SaveChangesAsync(ct);
    }

    private async Task UpsertDispatchAsync(
        RecreatioDbContext dbContext,
        CalendarEventReminder reminder,
        CalendarEvent item,
        DateTimeOffset occurrenceStartUtc,
        DateTimeOffset dueUtc,
        CancellationToken ct)
    {
        var existing = await dbContext.CalendarReminderDispatches
            .FirstOrDefaultAsync(entry => entry.ReminderId == reminder.Id && entry.OccurrenceStartUtc == occurrenceStartUtc, ct);
        if (existing is not null)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var idempotencyKey = $"{reminder.Id:N}:{occurrenceStartUtc:yyyyMMddHHmm}";
        var dispatch = new CalendarReminderDispatch
        {
            Id = Guid.NewGuid(),
            EventId = item.Id,
            ReminderId = reminder.Id,
            OccurrenceStartUtc = occurrenceStartUtc,
            IdempotencyKey = idempotencyKey,
            Channel = reminder.Channel,
            Status = reminder.Channel == "webhook" ? "pending" : "pending_channel_not_enabled",
            AttemptCount = 0,
            NextRetryUtc = reminder.Channel == "webhook" ? dueUtc : null,
            LastAttemptUtc = null,
            DeliveredUtc = null,
            LastError = reminder.Channel == "webhook" ? null : "Channel execution disabled in this release.",
            DeliveryPayloadJson = null,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        dbContext.CalendarReminderDispatches.Add(dispatch);
        await dbContext.SaveChangesAsync(ct);

        if (reminder.Channel == "webhook")
        {
            await DispatchWebhookAsync(dbContext, dispatch, reminder, item, occurrenceStartUtc, ct);
            await dbContext.SaveChangesAsync(ct);
        }
    }

    private async Task DispatchWebhookAsync(
        RecreatioDbContext dbContext,
        CalendarReminderDispatch dispatch,
        CalendarEventReminder reminder,
        CalendarEvent item,
        DateTimeOffset occurrenceStartUtc,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        dispatch.AttemptCount += 1;
        dispatch.LastAttemptUtc = now;
        dispatch.UpdatedUtc = now;

        var (url, method, secret, headers, configError) = ParseWebhookConfig(reminder.ChannelConfigJson);
        if (configError is not null)
        {
            dispatch.Status = "failed";
            dispatch.LastError = configError;
            dispatch.NextRetryUtc = ComputeNextRetryUtc(now, dispatch.AttemptCount);
            return;
        }

        var payload = JsonSerializer.Serialize(new
        {
            dispatchId = dispatch.Id,
            idempotencyKey = dispatch.IdempotencyKey,
            reminderId = reminder.Id,
            eventId = item.Id,
            calendarId = item.CalendarId,
            itemType = item.ItemType,
            titlePublic = item.TitlePublic,
            status = item.Status,
            occurrenceStartUtc,
            reminderMinutesBefore = reminder.MinutesBefore,
            dueUtc = occurrenceStartUtc.AddMinutes(-reminder.MinutesBefore),
            dispatchedAtUtc = now
        });
        dispatch.DeliveryPayloadJson = payload;

        var request = new HttpRequestMessage(method, url)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-Recreatio-Idempotency-Key", dispatch.IdempotencyKey);
        request.Headers.Add("X-Recreatio-Event", "calendar.reminder");

        if (!string.IsNullOrWhiteSpace(secret))
        {
            var signature = CreateSignature(secret, payload);
            request.Headers.Add("X-Recreatio-Signature", signature);
        }

        foreach (var header in headers)
        {
            if (header.Value is null)
            {
                continue;
            }

            if (!request.Headers.TryAddWithoutValidation(header.Key, header.Value))
            {
                _ = request.Content?.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }
        }

        var client = _httpClientFactory.CreateClient("calendar-reminder-webhook");
        HttpResponseMessage? response = null;
        try
        {
            response = await client.SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
            {
                dispatch.Status = "dispatched";
                dispatch.DeliveredUtc = DateTimeOffset.UtcNow;
                dispatch.NextRetryUtc = null;
                dispatch.LastError = null;
            }
            else
            {
                var responseBody = await response.Content.ReadAsStringAsync(ct);
                dispatch.Status = "failed";
                dispatch.LastError = $"Webhook returned {(int)response.StatusCode}: {Truncate(responseBody, 1024)}";
                dispatch.NextRetryUtc = ComputeNextRetryUtc(now, dispatch.AttemptCount);
            }
        }
        catch (Exception ex)
        {
            dispatch.Status = "failed";
            dispatch.LastError = Truncate(ex.Message, 1024);
            dispatch.NextRetryUtc = ComputeNextRetryUtc(now, dispatch.AttemptCount);
        }
        finally
        {
            response?.Dispose();
            request.Dispose();
            await dbContext.SaveChangesAsync(ct);
        }
    }

    private (Uri? Url, HttpMethod Method, string? Secret, Dictionary<string, string?> Headers, string? Error) ParseWebhookConfig(string? channelConfigJson)
    {
        if (string.IsNullOrWhiteSpace(channelConfigJson))
        {
            return (null, HttpMethod.Post, null, new Dictionary<string, string?>(), "Webhook config is required for webhook channel.");
        }

        try
        {
            using var doc = JsonDocument.Parse(channelConfigJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return (null, HttpMethod.Post, null, new Dictionary<string, string?>(), "Webhook config must be a JSON object.");
            }

            var root = doc.RootElement;
            var urlString = root.TryGetProperty("url", out var urlElement)
                ? urlElement.GetString()
                : null;
            if (string.IsNullOrWhiteSpace(urlString) || !Uri.TryCreate(urlString.Trim(), UriKind.Absolute, out var url))
            {
                return (null, HttpMethod.Post, null, new Dictionary<string, string?>(), "Webhook url is invalid.");
            }

            if (url.Scheme != Uri.UriSchemeHttp && url.Scheme != Uri.UriSchemeHttps)
            {
                return (null, HttpMethod.Post, null, new Dictionary<string, string?>(), "Webhook url must use HTTP or HTTPS.");
            }

            var methodString = root.TryGetProperty("method", out var methodElement)
                ? methodElement.GetString()
                : null;
            var method = string.IsNullOrWhiteSpace(methodString)
                ? HttpMethod.Post
                : new HttpMethod(methodString.Trim().ToUpperInvariant());

            var secret = root.TryGetProperty("secret", out var secretElement)
                ? secretElement.GetString()
                : null;
            if (string.IsNullOrWhiteSpace(secret))
            {
                secret = string.IsNullOrWhiteSpace(_options.WebhookSigningSecret)
                    ? null
                    : _options.WebhookSigningSecret;
            }

            var headers = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            if (root.TryGetProperty("headers", out var headersElement) && headersElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in headersElement.EnumerateObject())
                {
                    headers[property.Name] = property.Value.ValueKind == JsonValueKind.String
                        ? property.Value.GetString()
                        : property.Value.GetRawText();
                }
            }

            return (url, method, secret, headers, null);
        }
        catch (Exception ex)
        {
            return (null, HttpMethod.Post, null, new Dictionary<string, string?>(), $"Webhook config parse failed: {Truncate(ex.Message, 512)}");
        }
    }

    private static string CreateSignature(string secret, string payload)
    {
        var secretBytes = Encoding.UTF8.GetBytes(secret);
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        using var hmac = new HMACSHA256(secretBytes);
        var signatureBytes = hmac.ComputeHash(payloadBytes);
        return "sha256=" + Convert.ToHexString(signatureBytes).ToLowerInvariant();
    }

    private static DateTimeOffset ComputeNextRetryUtc(DateTimeOffset now, int attemptCount)
    {
        var exponent = Math.Clamp(attemptCount, 1, 12);
        var minutes = Math.Min(720, 1 << exponent);
        return now.AddMinutes(minutes);
    }

    private static string Truncate(string value, int maxLength)
    {
        if (value.Length <= maxLength)
        {
            return value;
        }

        return value[..maxLength];
    }
}
