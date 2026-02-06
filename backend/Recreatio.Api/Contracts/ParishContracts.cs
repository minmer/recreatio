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
    string? Note);

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
    string? Note);

public sealed record ParishMassUpdateRequest(
    DateTimeOffset MassDateTime,
    string ChurchName,
    string Title,
    string? Note);

public sealed record ParishOfferingCreateRequest(
    Guid IntentionId,
    string Amount,
    string Currency,
    DateTimeOffset Date,
    string? DonorReference);

public sealed record ParishSiteConfigUpdateRequest(
    ParishHomepageConfig Homepage,
    bool IsPublished);
