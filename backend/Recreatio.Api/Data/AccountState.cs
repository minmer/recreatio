namespace Recreatio.Api.Data;

public enum AccountState
{
    PendingEmailConfirmation = 0,
    Active = 1,
    Locked = 2,
    Disabled = 3,
    Deleted = 4
}
