namespace Recreatio.Api.Contracts;

public sealed record RoleFieldRequest(
    string FieldType,
    string? PlainValue,
    Guid? DataKeyId,
    string? SignatureBase64
);

public sealed record CreateRoleRequest(
    List<RoleFieldRequest> Fields,
    Guid? ParentRoleId,
    string? RelationshipType,
    string? PublicSigningKeyBase64,
    string? PublicSigningKeyAlg,
    string? SignatureBase64
);

public sealed record UpdateRoleFieldRequest(
    string FieldType,
    string? PlainValue,
    Guid? DataKeyId,
    string? SignatureBase64
);

public sealed record RoleFieldResponse(
    Guid FieldId,
    string FieldType,
    string? PlainValue,
    Guid DataKeyId
);

public sealed record RoleResponse(
    Guid RoleId,
    string? PublicSigningKeyBase64,
    string? PublicSigningKeyAlg,
    List<RoleFieldResponse> Fields
);

public sealed record AddRoleShareRequest(
    Guid TargetRoleId,
    string RelationshipType,
    string? SignatureBase64
);

public sealed record RoleSummaryResponse(
    Guid RoleId,
    string RoleKind
);

public sealed record RoleAccessRoleResponse(
    Guid RoleId,
    string RoleKind,
    string RelationshipType
);

public sealed record RoleAccessResponse(
    Guid RoleId,
    List<RoleAccessRoleResponse> Roles
);

public sealed record PendingRoleShareResponse(
    Guid ShareId,
    Guid SourceRoleId,
    Guid TargetRoleId,
    string RelationshipType,
    DateTimeOffset CreatedUtc
);

public sealed record PendingRoleShareAcceptRequest(
    string? SignatureBase64
);

public sealed record RoleSearchResponse(
    Guid RoleId,
    string RoleKind,
    string Nick
);

public sealed record RoleGraphNode(
    string Id,
    string Label,
    string NodeType,
    string? Kind,
    string? Value,
    Guid? RoleId,
    string? FieldType,
    Guid? DataKeyId,
    bool CanLink
);

public sealed record RoleGraphEdge(
    string Id,
    string SourceRoleId,
    string TargetRoleId,
    string Type
);

public sealed record RoleGraphResponse(
    List<RoleGraphNode> Nodes,
    List<RoleGraphEdge> Edges
);

public sealed record RoleParentsResponse(
    Guid RoleId,
    List<Guid> ParentRoleIds
);

public sealed record LedgerVerificationSummary(
    string Ledger,
    int TotalEntries,
    int HashMismatches,
    int PreviousHashMismatches,
    int SignaturesVerified,
    int SignaturesMissing,
    int SignaturesInvalid,
    int RoleSignedEntries,
    int RoleInvalidSignatures
);

public sealed record RoleLedgerVerificationResponse(
    Guid RoleId,
    List<LedgerVerificationSummary> Ledgers
);

public sealed record RecoveryShareRequest(
    Guid SharedWithRoleId,
    string EncryptedShareBase64,
    string? SignatureBase64
);

public sealed record RecoveryRequestCreate(
    Guid InitiatorRoleId,
    string? SignatureBase64
);

public sealed record RecoveryApproveRequest(
    Guid ApproverRoleId,
    string EncryptedApprovalBase64,
    string? SignatureBase64
);

public sealed record RecoveryRequestResponse(
    Guid RequestId,
    string Status,
    int RequiredApprovals
);
