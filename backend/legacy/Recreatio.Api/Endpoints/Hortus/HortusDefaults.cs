using Recreatio.Api.Data.Hortus;

namespace Recreatio.Api.Endpoints.Hortus;

/// <summary>
/// The shape Hortus Dei starts with: the whole place, the big house with its chapel and dining
/// room, the two small houses, and the garden with its own parts. The coordinator renames,
/// re-times and extends all of it from the panel afterwards.
/// </summary>
internal static class HortusDefaults
{
    public sealed record ResourceBlueprint(
        string Slug,
        string? ParentSlug,
        string Name,
        string Description,
        string Kind,
        string BookingUnit,
        int Capacity,
        int? GuestCapacity,
        int TechnicalMinutesBefore,
        int TechnicalMinutesAfter,
        string ColorToken,
        bool IsPubliclyBookable = true);

    public static HortusPlace CreatePlace(DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        Slug = HortusShared.DefaultPlaceSlug,
        Name = "Hortus Dei",
        Motto = "Ogród, dwa domki i dom z kaplicą — miejsce na rekolekcje i dni skupienia",
        Description = "Miejsce wyciszenia dla grup: dom główny z kaplicą i jadalnią, dwa mniejsze domki "
            + "oraz ogród z altaną i miejscem na grilla. Poszczególne części można rezerwować osobno, "
            + "a kaplica i jadalnia mogą służyć dwóm grupom w tym samym czasie.",
        AddressLine = string.Empty,
        ContactName = string.Empty,
        ContactEmail = string.Empty,
        ContactPhone = string.Empty,
        TimeZoneId = "Central European Standard Time",
        CheckInTime = new TimeOnly(16, 0),
        CheckOutTime = new TimeOnly(10, 0),
        DefaultTechnicalMinutes = 120,
        MinLeadDays = 0,
        PublicRequestsEnabled = true,
        CreatedUtc = now,
        UpdatedUtc = now
    };

    public static IReadOnlyList<ResourceBlueprint> Resources { get; } =
    [
        new("hortus-dei", null, "Całe Hortus Dei",
            "Wyłączna rezerwacja całego miejsca: dom główny, oba domki i ogród.",
            HortusResourceKinds.Whole, HortusBookingUnits.Both, 1, 60, 0, 180, "olive"),

        new("dom-glowny", "hortus-dei", "Dom główny",
            "Dom z kaplicą i jadalnią, z miejscami noclegowymi dla grupy.",
            HortusResourceKinds.House, HortusBookingUnits.Both, 1, 40, 0, 120, "amber"),

        new("kaplica", "dom-glowny", "Kaplica",
            "Kaplica w domu głównym. Może służyć dwóm grupom w różnych godzinach tego samego dnia.",
            HortusResourceKinds.Chapel, HortusBookingUnits.Slot, 2, 60, 0, 30, "indigo"),

        new("jadalnia", "dom-glowny", "Jadalnia",
            "Sala jadalna dla grup. Po każdym posiłku rezerwowany jest czas na zmywanie i sprzątanie.",
            HortusResourceKinds.Dining, HortusBookingUnits.Slot, 2, 50, 0, 60, "rose"),

        new("domek-i", "hortus-dei", "Domek I",
            "Mniejszy dom dla kilkuosobowej grupy lub prowadzących.",
            HortusResourceKinds.House, HortusBookingUnits.Night, 1, 8, 0, 120, "teal"),

        new("domek-ii", "hortus-dei", "Domek II",
            "Drugi z mniejszych domów.",
            HortusResourceKinds.House, HortusBookingUnits.Night, 1, 8, 0, 120, "sky"),

        new("ogrod", "hortus-dei", "Ogród",
            "Cały ogród wraz z altaną, miejscem na grilla i ogrodem modlitwy.",
            HortusResourceKinds.Garden, HortusBookingUnits.Both, 1, 80, 0, 60, "sage"),

        new("grill", "ogrod", "Miejsce na grilla",
            "Palenisko z zadaszeniem. Po ognisku rezerwowany jest czas na uprzątnięcie.",
            HortusResourceKinds.Grill, HortusBookingUnits.Slot, 1, 30, 0, 60, "clay"),

        new("altana", "ogrod", "Altana",
            "Zadaszona altana na konferencje i spotkania w mniejszym gronie.",
            HortusResourceKinds.Garden, HortusBookingUnits.Slot, 2, 20, 0, 30, "sage"),

        new("ogrod-modlitwy", "ogrod", "Ogród modlitwy",
            "Część ogrodu przeznaczona na modlitwę indywidualną i drogę krzyżową.",
            HortusResourceKinds.Garden, HortusBookingUnits.Slot, 2, 40, 0, 0, "moss")
    ];

    /// <summary>Materialises the blueprint into rows, wiring parents by slug and keeping the listed order.</summary>
    public static List<HortusResource> CreateResources(Guid placeId, DateTimeOffset now)
    {
        var idBySlug = Resources.ToDictionary(x => x.Slug, _ => Guid.NewGuid());
        var result = new List<HortusResource>(Resources.Count);
        var sortOrder = 0;

        foreach (var blueprint in Resources)
        {
            result.Add(new HortusResource
            {
                Id = idBySlug[blueprint.Slug],
                PlaceId = placeId,
                ParentId = blueprint.ParentSlug is null ? null : idBySlug[blueprint.ParentSlug],
                Slug = blueprint.Slug,
                Name = blueprint.Name,
                Description = blueprint.Description,
                Kind = blueprint.Kind,
                BookingUnit = blueprint.BookingUnit,
                Capacity = blueprint.Capacity,
                GuestCapacity = blueprint.GuestCapacity,
                TechnicalMinutesBefore = blueprint.TechnicalMinutesBefore,
                TechnicalMinutesAfter = blueprint.TechnicalMinutesAfter,
                IsPubliclyBookable = blueprint.IsPubliclyBookable,
                IsActive = true,
                SortOrder = sortOrder += 10,
                ColorToken = blueprint.ColorToken,
                CreatedUtc = now,
                UpdatedUtc = now
            });
        }

        return result;
    }
}
