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
    string Token,
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
