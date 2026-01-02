namespace Recreatio.Api.Options;

public sealed class AuthOptions
{
    public bool RequireEmailConfirmation { get; set; }
    public int MaxFailedLoginAttempts { get; set; } = 5;
    public int LockoutMinutes { get; set; } = 15;
}
