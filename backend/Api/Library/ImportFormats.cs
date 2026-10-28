using System.Text.Json;

namespace Api;

/// <summary>
/// 2026-10-28 — DIE FORMATE DER JSON-IMPORTE für Assistenten: über MCP (<c>list_import_formats</c>,
/// <c>get_import_format</c>, AiMcp.cs) und über den Link (<c>/ai/{link}/formats</c>, AiAccess.Read.cs).
///
/// <para>
/// <b>Aus der App erzeugt, nicht hier geschrieben.</b> <c>frontend/scripts/import-formats.mjs</c> legt in
/// <c>ImportFormats.json</c> dieselben Beschreibungen ab, die in der App neben jedem Import stehen, dazu die
/// Leitfäden für die KI und die fertigen Schemata (<c>templates/cogita/</c>); <c>app-json-check</c> prüft,
/// dass die Datei der App folgt. Sie reist eingebettet im Programm mit.
/// </para>
///
/// <para>
/// <b>Nichts wird von hier geschrieben.</b> Ein Assistent bereitet JSON vor; importiert wird in der App, vom
/// Menschen, mit der Liste der Änderungen davor.
/// </para>
/// </summary>
public static class ImportFormats
{
    /// <summary>Eine Überschrift eines langen Formats und der Teil, in dem sie steht.</summary>
    public sealed record ContentsLine(int Level, string Title, int Part);

    /// <summary>Ein Format: wofür, wo in der App, der Text in Teilen (höchstens ~24 000 Zeichen je Teil).</summary>
    public sealed record Format(string Id, string Group, string Title, string What, string Where, int Size, IReadOnlyList<string> Parts, IReadOnlyList<ContentsLine> Contents);

    /// <summary>Was es nur an seiner Stelle gibt (es hängt von einem Formular, einem Werk, einem Text ab).</summary>
    public sealed record Contextual(string Title, string Where, string Why);

    public sealed record Doc(string About, IReadOnlyList<Format> Formats, IReadOnlyList<Contextual> Contextual);

    /// <summary>Der Name der eingebetteten Datei (Api.csproj, <c>LogicalName</c>).</summary>
    public const string Resource = "Api.ImportFormats.json";

    private static readonly Lazy<Doc> Loaded = new(Load);

    public static Doc All => Loaded.Value;

    private static Doc Load()
    {
        using var stream = typeof(ImportFormats).Assembly.GetManifestResourceStream(Resource)
            ?? throw new InvalidOperationException("ImportFormats.json fehlt im Programm (EmbeddedResource in Api.csproj).");
        return JsonSerializer.Deserialize<Doc>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException("ImportFormats.json ist leer.");
    }

    /// <summary>Ein Format nach seiner Kennung (Gross- und Kleinschreibung gleich) — oder <c>null</c>.</summary>
    public static Format? Find(string? id)
    {
        var wanted = (id ?? "").Trim();
        return wanted.Length == 0 ? null : All.Formats.FirstOrDefault(f => string.Equals(f.Id, wanted, StringComparison.OrdinalIgnoreCase));
    }
}
