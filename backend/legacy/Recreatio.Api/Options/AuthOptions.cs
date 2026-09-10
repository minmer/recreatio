namespace Recreatio.Api.Options;

public sealed class AuthOptions
{
    public bool RequireEmailConfirmation { get; set; }
    public int MaxFailedLoginAttempts { get; set; } = 5;
    public int LockoutMinutes { get; set; } = 15;
    public int SessionIdleMinutes { get; set; } = 60;
    public int RememberMeDays { get; set; } = 30;
}
