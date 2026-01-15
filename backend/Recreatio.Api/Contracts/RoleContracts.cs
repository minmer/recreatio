namespace Recreatio.Api.Contracts;

public sealed record CreateRoleEdgeRequest(
    Guid ChildRoleId,
    string RelationshipType,
    string? SignatureBase64
);
