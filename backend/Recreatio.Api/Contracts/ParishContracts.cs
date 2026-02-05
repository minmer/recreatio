namespace Recreatio.Api.Contracts;

public sealed record ParishModuleConfig(
    string ModuleId,
    string Title,
    string Width,
    string Height,
    int Order,
    int? Row = null,
    int? Col = null);

public sealed record ParishHomepageConfig(
    IReadOnlyList<ParishModuleConfig> Modules);

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
