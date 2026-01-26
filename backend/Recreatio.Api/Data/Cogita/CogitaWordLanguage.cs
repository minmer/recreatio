namespace Recreatio.Api.Data.Cogita;

public sealed class CogitaWordLanguage
{
    public Guid LanguageInfoId { get; set; }

    public Guid WordInfoId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
