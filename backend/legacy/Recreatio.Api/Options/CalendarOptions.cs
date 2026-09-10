namespace Recreatio.Api.Options;

public sealed class CalendarOptions
{
    public int ReminderPollSeconds { get; set; } = 60;
    public int ReminderLookbackMinutes { get; set; } = 5;
    public int ReminderLookaheadMinutes { get; set; } = 60;
    public int ReminderBatchSize { get; set; } = 250;
    public string WebhookSigningSecret { get; set; } = string.Empty;
}
