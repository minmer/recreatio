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

public sealed record AddPersonMemberRequest(
    string LoginId,
    string RelationshipType,
    string? EncryptedRoleKeyCopyBase64,
    string? SignatureBase64
);

public sealed record RoleSummaryResponse(
    Guid RoleId,
    string RoleType
);

public sealed record PersonAccessMemberResponse(
    Guid UserId,
    string LoginId,
    string? DisplayName,
    string RelationshipType,
    List<RoleSummaryResponse> Roles
);

public sealed record PersonAccessResponse(
    Guid PersonRoleId,
    List<PersonAccessMemberResponse> Members
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
