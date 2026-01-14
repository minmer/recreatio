namespace Recreatio.Api.Contracts;

public sealed record PersonFieldRequest(
    string FieldType,
    string? PlainValue,
    Guid? DataKeyId,
    string? SignatureBase64
);

public sealed record CreatePersonRequest(
    List<PersonFieldRequest> Fields,
    string? PublicSigningKeyBase64,
    string? PublicSigningKeyAlg,
    string? SignatureBase64
);

public sealed record UpdatePersonFieldRequest(
    string FieldType,
    string? PlainValue,
    Guid? DataKeyId,
    string? SignatureBase64
);

public sealed record PersonFieldResponse(
    string FieldType,
    string? PlainValue,
    Guid DataKeyId
);

public sealed record PersonResponse(
    Guid PersonRoleId,
    string? PublicSigningKeyBase64,
    string? PublicSigningKeyAlg,
    List<PersonFieldResponse> Fields
);

public sealed record AddPersonShareRequest(
    Guid TargetRoleId,
    string RelationshipType,
    string? SignatureBase64
);

public sealed record RoleSummaryResponse(
    Guid RoleId,
    string RoleType
);

public sealed record PersonAccessRoleResponse(
    Guid RoleId,
    string RoleType,
    string RelationshipType
);

public sealed record PersonAccessResponse(
    Guid PersonRoleId,
    List<PersonAccessRoleResponse> Roles
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

public sealed record RoleLookupResponse(
    Guid UserId,
    string LoginId,
    string? DisplayName,
    Guid MasterRoleId
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
