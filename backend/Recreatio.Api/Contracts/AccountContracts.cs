namespace Recreatio.Api.Contracts;

public sealed record ProfileResponse(
    string LoginId,
    string? DisplayName
);

public sealed record ProfileUpdateRequest(
    string? DisplayName
);
