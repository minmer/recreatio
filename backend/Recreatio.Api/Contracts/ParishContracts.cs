namespace Recreatio.Api.Contracts;

public sealed record ParishLayoutPosition(
    int Row,
    int Col);

public sealed record ParishLayoutSize(
    int ColSpan,
    int RowSpan);

public sealed record ParishLayoutFrame(
    ParishLayoutPosition Position,
    ParishLayoutSize Size);

public sealed class ParishLayoutItem
{
    public string Id { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public Dictionary<string, ParishLayoutFrame>? Layouts { get; init; }
    public ParishLayoutPosition? Position { get; init; }
    public ParishLayoutSize? Size { get; init; }
    public Dictionary<string, string>? Props { get; init; }
}

public sealed record ParishHomepageConfig(
    IReadOnlyList<ParishLayoutItem> Modules);

public sealed record ParishCreateRequest(
    string Name,
    string Location,
    string Slug,
    string Theme,
    string? HeroImageUrl,
    ParishHomepageConfig Homepage);

public sealed record ParishSummaryResponse(
    Guid Id,
    string Slug,
    string Name,
    string Location,
    string Theme,
    string? HeroImageUrl);

public sealed record ParishSiteResponse(
    Guid Id,
    string Slug,
    string Name,
    string Location,
    string Theme,
    string? HeroImageUrl,
    ParishHomepageConfig Homepage);

public sealed record ParishIntentionsPublicResponse(
    Guid Id,
    DateTimeOffset MassDateTime,
    string ChurchName,
    string PublicText,
    string Status);

public sealed record ParishMassPublicResponse(
    Guid Id,
    DateTimeOffset MassDateTime,
    string ChurchName,
    string Title,
    string? Note,
    bool IsCollective,
    int? DurationMinutes,
    string? Kind,
    string? BeforeService,
    string? AfterService,
    string? IntentionsJson,
    string? DonationSummary);

public sealed record ParishMassIntentionInput(
    string Text,
    string? Donation);

public sealed record ParishIntentionCreateRequest(
    DateTimeOffset MassDateTime,
    string ChurchName,
    string PublicText,
    string? InternalText,
    string? DonorReference,
    string Status);

public sealed record ParishIntentionUpdateRequest(
    DateTimeOffset MassDateTime,
    string ChurchName,
    string PublicText,
    string? InternalText,
    string? DonorReference,
    string Status);

public sealed record ParishMassCreateRequest(
    DateTimeOffset MassDateTime,
    string ChurchName,
    string Title,
    string? Note,
    bool IsCollective,
    int? DurationMinutes,
    string? Kind,
    string? BeforeService,
    string? AfterService,
    IReadOnlyList<ParishMassIntentionInput>? Intentions,
    string? DonationSummary);

public sealed record ParishMassUpdateRequest(
    DateTimeOffset MassDateTime,
    string ChurchName,
    string Title,
    string? Note,
    bool IsCollective,
    int? DurationMinutes,
    string? Kind,
    string? BeforeService,
    string? AfterService,
    IReadOnlyList<ParishMassIntentionInput>? Intentions,
    string? DonationSummary);

public sealed record ParishMassRuleNode(
    string Id,
    string Type,
    string? NextId,
    string? ElseId,
    Dictionary<string, string>? Config);

public sealed record ParishMassRuleGraph(
    string StartNodeId,
    IReadOnlyList<ParishMassRuleNode> Nodes,
    Dictionary<string, string>? Metadata);

public sealed record ParishMassRuleResponse(
    Guid Id,
    string Name,
    string? Description,
    ParishMassRuleGraph Graph,
    DateTimeOffset UpdatedUtc);

public sealed record ParishMassRuleUpsertRequest(
    string Name,
    string? Description,
    ParishMassRuleGraph Graph);

public sealed record ParishMassRuleSimulationRequest(
    DateOnly FromDate,
    DateOnly ToDate,
    bool IncludeExisting);

public sealed record ParishMassRuleApplyRequest(
    DateOnly FromDate,
    DateOnly ToDate,
    bool ReplaceExisting);

public sealed record ParishOfferingCreateRequest(
    Guid IntentionId,
    string Amount,
    string Currency,
    DateTimeOffset Date,
    string? DonorReference);

public sealed record ParishSiteConfigUpdateRequest(
    ParishHomepageConfig Homepage,
    bool IsPublished);
