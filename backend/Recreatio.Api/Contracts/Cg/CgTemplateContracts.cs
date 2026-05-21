namespace Recreatio.Api.Contracts.Cg;

public sealed record CgTemplateCreateRequest(string Name);

public sealed record CgTemplateNodeSaveItem(
    string NodeKey,
    string NodeType,
    string ConfigJson,
    decimal PositionX,
    decimal PositionY
);

public sealed record CgTemplateEdgeSaveItem(
    string EdgeKey,
    string SourceKey,
    string TargetKey,
    string? SourceHandle,
    string? TargetHandle
);

public sealed record CgTemplateSaveRequest(
    string Name,
    IReadOnlyList<CgTemplateNodeSaveItem> Nodes,
    IReadOnlyList<CgTemplateEdgeSaveItem> Edges
);

public sealed record CgTemplateListItem(
    long Id,
    string Name,
    int NodeCount,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

public sealed record CgTemplateNodeResponse(
    long Id,
    string NodeKey,
    string NodeType,
    string ConfigJson,
    decimal PositionX,
    decimal PositionY
);

public sealed record CgTemplateEdgeResponse(
    long Id,
    string EdgeKey,
    string SourceKey,
    string TargetKey,
    string? SourceHandle,
    string? TargetHandle
);

public sealed record CgTemplateGraphResponse(
    long Id,
    string Name,
    IReadOnlyList<CgTemplateNodeResponse> Nodes,
    IReadOnlyList<CgTemplateEdgeResponse> Edges,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc
);

// ── Quiz ──────────────────────────────────────────────────────────────────────

public sealed record CgQuizRequest(long EntityId);

public sealed record CgQuizStimulus(
    string Label,
    IReadOnlyList<string> Values
);

public sealed record CgQuizQuestion(
    long TemplateId,
    string TemplateName,
    long EntityId,
    IReadOnlyList<CgQuizStimulus> Stimulus,
    string AnswerType,
    string AnswerConfigJson,
    IReadOnlyList<string> Expected,
    IReadOnlyList<string> Distractors,
    IReadOnlyList<string> Warnings
);
