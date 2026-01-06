namespace Recreatio.Api.Contracts;

public sealed record RegisterRequest(
    string LoginId,
    string UserSaltBase64,
    string H3Base64,
    string? DisplayName
);

public sealed record LoginRequest(
    string LoginId,
    string H3Base64,
    bool SecureMode,
    string? DeviceInfo
);

public sealed record LoginResponse(
    Guid UserId,
    string SessionId,
    bool SecureMode
);

public sealed record PasswordChangeRequest(
    string H3OldBase64,
    string H3NewBase64
);

public sealed record SessionModeRequest(
    bool SecureMode
);

public sealed record SaltResponse(
    string UserSaltBase64
);

public sealed record AvailabilityResponse(
    bool IsAvailable
);
