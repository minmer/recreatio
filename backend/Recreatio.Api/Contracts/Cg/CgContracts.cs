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
