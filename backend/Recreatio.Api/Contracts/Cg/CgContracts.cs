namespace Recreatio.Api.Contracts.Cg;

public sealed record CgLibraryCreateRequest(string Name);

public sealed record CgLibraryRenameRequest(string Name);

public sealed record CgLibraryResponse(
    long Id,
    string Name,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record CgTypeDefCreateRequest(string Name);

public sealed record CgTypeDefRenameRequest(string Name);

public sealed record CgTypeDefResponse(
    long Id,
    string Name,
    int FieldCount,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record CgTypeDefDetailResponse(
    long Id,
    string Name,
    IReadOnlyList<CgFieldDefResponse> Fields,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record CgFieldDefResponse(
    long Id,
    string Label,
    int SortOrder,
    string InputType,
    bool Multiple,
    bool IsOrdered,
    IReadOnlyList<long> TargetTypeDefIds
);

public sealed record CgFieldDefSaveItem(
    long? Id,
    string Label,
    string InputType,
    bool Multiple,
    bool IsOrdered,
    IReadOnlyList<long> TargetTypeDefIds
);

public sealed record CgFieldsSaveRequest(IReadOnlyList<CgFieldDefSaveItem> Fields);

public sealed record CgTypeDeleteConflictEntry(
    long FieldDefId,
    string FieldLabel,
    long TypeDefId,
    string TypeDefName
);

public sealed record CgTypeDeleteConflictResponse(
    IReadOnlyList<CgTypeDeleteConflictEntry> References
);

// ── Entities ───────────────────────────────────────────────────────────────

public sealed record CgEntityValueSaveItem(
    long FieldDefId,
    int SortOrder,
    string? PlainValue,
    long? RefEntityId
);

public sealed record CgEntitySaveRequest(
    IReadOnlyList<CgEntityValueSaveItem> Values
);

public sealed record CgEntityValueResponse(
    long Id,
    int SortOrder,
    string? PlainValue,
    long? RefEntityId,
    string? RefDisplayValue,
    long? RefTypeDefId,
    string? RefTypeDefName
);

public sealed record CgEntityFieldResponse(
    long FieldDefId,
    string Label,
    string InputType,
    bool Multiple,
    bool IsOrdered,
    IReadOnlyList<CgEntityValueResponse> Values
);

public sealed record CgEntityDetailResponse(
    long Id,
    long TypeDefId,
    string TypeDefName,
    IReadOnlyList<CgEntityFieldResponse> Fields,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record CgEntityListItem(
    long Id,
    string DisplayValue,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record CgEntitySearchItem(
    long Id,
    string DisplayValue,
    long TypeDefId,
    string TypeDefName
);

public sealed record CgEntityResolveRequest(
    IReadOnlyList<long> EntityIds
);
