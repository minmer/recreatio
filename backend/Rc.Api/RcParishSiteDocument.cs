using System.Text.Json;

namespace Rc.Api;

/// <summary>
/// Das Dokument einer Pfarrseite: Aufbau, Menue und Inhalt.
///
/// <b>Warum der Dienst das prueft und nicht nur durchreicht.</b> Was hier
/// hineingeht, wird spaeter OHNE Konto ausgeliefert und von einem Browser
/// gezeichnet. Ein Dienst, der beliebiges JSON annimmt, weil „der Browser
/// schon das Richtige schickt", verlaesst sich auf einen Absender, den er
/// nicht kennt — jeder mit einem Zertifikat auf dem Bereich kann etwas anderes
/// schicken.
///
/// <b>Geprueft wird die FORM, nicht der Geschmack.</b> Ob ein Baustein sinnvoll
/// steht, entscheidet die Pfarrei; dass ein Baustein eine Kennung, eine Art und
/// eine Anordnung hat, entscheidet diese Datei. Der Unterschied ist wichtig:
/// eine Pruefung, die Gestaltung vorschreibt, muss bei jeder neuen Idee
/// nachgezogen werden und steht dann im Weg.
///
/// <b>Grenzen gibt es, weil es sie geben muss.</b> Ein Dokument ohne Obergrenze
/// ist ein Weg, die Datenbank vollzuschreiben — die Spalte ist
/// <c>nvarchar(max)</c>, und der einzige Halt davor steht hier.
/// </summary>
public static class RcParishSiteDocument
{
    /// <summary>
    /// 256 KiB. Eine Pfarrseite mit fuenfzig Bausteinen und ausgefuellten
    /// Angaben liegt bei wenigen Kilobyte; das Hundertfache ist kein Ergebnis
    /// von Arbeit, sondern von etwas anderem.
    /// </summary>
    public const int MaxLength = 256 * 1024;

    private const int MaxModules = 120;
    private const int MaxMenuNodes = 40;
    private const int MaxChildren = 30;
    private const int MaxFields = 400;
    private const int MaxFieldLength = 20_000;
    private const int MaxLabelLength = 200;

    /// <summary>Was an einem Dokument nicht stimmt — oder <c>null</c>.</summary>
    public static string? Fault(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "Das Dokument ist leer.";
        if (text.Length > MaxLength) return $"Das Dokument ist zu gross (hoechstens {MaxLength} Zeichen).";

        JsonDocument doc;
        try { doc = JsonDocument.Parse(text); }
        catch (JsonException) { return "Das Dokument ist kein gueltiges JSON."; }

        using (doc)
        {
            var root = doc.RootElement;

            /*
             * DIE ALTE FORM BLEIBT ERLAUBT.
             *
             * Frueher stand hier eine blosse Liste von Bausteinnamen. Sie
             * abzuweisen hiesse: eine Pfarrei, die vor der Umstellung etwas
             * gespeichert hat, kann ihre Seite nicht mehr sichern, ohne dass
             * jemand die Zeile von Hand anfasst.
             */
            if (root.ValueKind == JsonValueKind.Array) return null;

            if (root.ValueKind != JsonValueKind.Object)
                return "Das Dokument muss ein Objekt sein.";

            if (root.TryGetProperty("modules", out var modules))
            {
                if (modules.ValueKind != JsonValueKind.Array) return "modules muss eine Liste sein.";
                if (modules.GetArrayLength() > MaxModules) return $"Hoechstens {MaxModules} Bausteine.";

                foreach (var module in modules.EnumerateArray())
                {
                    var fault = ModuleFault(module);
                    if (fault is not null) return fault;
                }
            }

            if (root.TryGetProperty("menu", out var menu))
            {
                if (menu.ValueKind != JsonValueKind.Array) return "menu muss eine Liste sein.";
                if (menu.GetArrayLength() > MaxMenuNodes) return $"Hoechstens {MaxMenuNodes} Menuepunkte.";

                foreach (var node in menu.EnumerateArray())
                {
                    var fault = MenuFault(node);
                    if (fault is not null) return fault;
                }
            }

            if (root.TryGetProperty("content", out var content))
            {
                if (content.ValueKind != JsonValueKind.Object) return "content muss ein Objekt sein.";

                var fields = 0;
                foreach (var field in content.EnumerateObject())
                {
                    if (++fields > MaxFields) return $"Hoechstens {MaxFields} Angaben.";
                    if (field.Value.ValueKind != JsonValueKind.String)
                        return $"Die Angabe „{field.Name}\" ist kein Text.";
                    if ((field.Value.GetString()?.Length ?? 0) > MaxFieldLength)
                        return $"Die Angabe „{field.Name}\" ist zu lang.";
                }
            }
        }

        return null;
    }

    private static string? ModuleFault(JsonElement module)
    {
        if (module.ValueKind != JsonValueKind.Object) return "Ein Baustein ist kein Objekt.";

        if (!module.TryGetProperty("id", out var id) || id.ValueKind != JsonValueKind.String)
            return "Ein Baustein hat keine Kennung.";

        if (!module.TryGetProperty("type", out var type) || type.ValueKind != JsonValueKind.String)
            return "Ein Baustein hat keine Art.";

        if ((type.GetString()?.Length ?? 0) > 64) return "Die Art eines Bausteins ist zu lang.";

        /*
         * Die Anordnung wird NICHT bis in die Zahlen geprueft.
         *
         * Ob ein Baustein in Spalte 4 mit Breite 3 steht, ist eine Frage des
         * Rasters, und das Raster steht im Browser — es aendert sich, wenn dort
         * eine Bildschirmgroesse dazukommt. Eine Pruefung hier muesste jedes
         * Mal nachgezogen werden und wuerde beim ersten Vergessen eine
         * Speicherung abweisen, die richtig ist.
         *
         * Was hier zaehlt: es IST eine Anordnung und kein Text.
         */
        if (module.TryGetProperty("layouts", out var layouts) && layouts.ValueKind != JsonValueKind.Object)
            return "Die Anordnung eines Bausteins ist kein Objekt.";

        return null;
    }

    private static string? MenuFault(JsonElement node)
    {
        if (node.ValueKind != JsonValueKind.Object) return "Ein Menuepunkt ist kein Objekt.";

        if (!node.TryGetProperty("label", out var label) || label.ValueKind != JsonValueKind.String)
            return "Ein Menuepunkt hat keine Beschriftung.";

        if ((label.GetString()?.Length ?? 0) > MaxLabelLength)
            return "Eine Beschriftung im Menue ist zu lang.";

        if (node.TryGetProperty("children", out var children))
        {
            if (children.ValueKind != JsonValueKind.Array) return "Die Untermenuepunkte sind keine Liste.";
            if (children.GetArrayLength() > MaxChildren) return $"Hoechstens {MaxChildren} Untermenuepunkte.";

            foreach (var child in children.EnumerateArray())
            {
                if (child.ValueKind != JsonValueKind.Object) return "Ein Untermenuepunkt ist kein Objekt.";
                if (!child.TryGetProperty("label", out var childLabel) || childLabel.ValueKind != JsonValueKind.String)
                    return "Ein Untermenuepunkt hat keine Beschriftung.";
                if ((childLabel.GetString()?.Length ?? 0) > MaxLabelLength)
                    return "Eine Beschriftung im Untermenue ist zu lang.";
            }
        }

        return null;
    }

    /// <summary>Ein leeres Dokument — was eine Pfarrei bekommt, die nichts eingerichtet hat.</summary>
    public const string Empty = """{"modules":[],"menu":[],"content":{}}""";
}
