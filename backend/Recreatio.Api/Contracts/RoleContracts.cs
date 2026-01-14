namespace Recreatio.Api.Contracts;

public sealed record CreateRoleEdgeRequest(
    Guid ChildRoleId,
    string RelationshipType,
    string EncryptedRoleKeyCopyBase64,
    string? SignatureBase64
);
