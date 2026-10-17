using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Wohin ein Link führt (Portal) und die Bögen der Kanzlei.</summary>
public static partial class Form
{
    /// <summary>
    /// Darf dieser Mensch an DIESER Einsendung etwas aendern?
    ///
    /// <para>
    /// <b>Schreiben, nicht lesen.</b> Zum Ansehen genuegt Lesen am Bereich —
    /// zum Wegraeumen oder Loeschen nicht. Wer etwas fortnimmt, aendert den
    /// Bestand, und dafuer gilt dieselbe Schwelle wie fuers Aufstellen der
    /// Fragen.
    /// </para>
    ///
    /// <para>
    /// Antwortet selbst, wenn es nicht geht — der Aufrufer sieht nur noch den
    /// Rueckgabewert an.
    /// </para>
    /// </summary>
    private static async Task<bool> MayTendAsync(
        HttpContext ctx, Db db, SqlConnection connection, Guid registrationId)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return false; }

        Guid partId;

        await using (var cmd = new SqlCommand(
            "SELECT part_id FROM app.registration WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", registrationId);

            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zgłoszenia nie ma.");
                return false;
            }

            partId = found;
        }

        var sheet = await SheetAsync(connection, partId, ctx.RequestAborted);
        if (sheet is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return false;
        }

        if (await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted)) return true;

        var fields = await ReadFieldsAsync(connection, partId, ctx.RequestAborted, withRemoved: true);

        foreach (var areaId in fields.Select(f => f.AreaId).Distinct())
        {
            if (await Area.MayAsync(connection, who.Value.AccountId, areaId,
                    Capability.Write, ctx.RequestAborted))
            {
                return true;
            }
        }

        await Fail(ctx, StatusCodes.Status403Forbidden,
            "Do tego zgłoszenia nie masz prawa zapisu — ani przez adres, ani przez obszar.");
        return false;
    }

    /// <summary>
    /// Eine Ebene hoeher — oder der Pfad selbst, wenn er schon oben steht.
    ///
    /// <para>
    /// Eine oberste Adresse hat kein Darueber: <c>parish</c> bliebe sonst
    /// <c>""</c>, und das ist die Wurzel, die niemandem gehoert.
    /// </para>
    /// </summary>
    private static string Above(string path)
    {
        var cut = path.LastIndexOf('/');
        return cut <= 0 ? path : path[..cut];
    }

    private const string NotAnchorable =
        "Portalem może być strona z tym formularzem, strona nad nią lub pod nią — albo inna "
        + "strona tego samego właściciela, wybrana w ustawieniach formularza. Strona tylko z dostępem "
        + "— wyłącznie wtedy, gdy wybierze ją kancelaria w ustawieniach formularza.";

    /// <summary>
    /// Wo die Kanzlei das Portal dieses Bogens haben will — `portalUnder` am
    /// Baustein, oder <c>null</c>, wenn sie nichts gewaehlt hat.
    /// </summary>
    private static async Task<string?> PortalOfAsync(SqlConnection connection, Guid moduleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT config FROM app.module WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", moduleId);

        if (await cmd.ExecuteScalarAsync(ct) is not string text || text == "") return null;

        try
        {
            var config = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(text);
            return config is not null && config.TryGetValue("portalUnder", out var under) && !string.IsNullOrWhiteSpace(under)
                ? Slug.Normalise(under)
                : null;
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Darf ein Platz dieses Bogens an der Seite <paramref name="wanted"/> haengen?
    ///
    /// <para>
    /// <b>Verwandt mit einer Seite des Bogens</b> — sie selbst, eine darueber,
    /// eine darunter: das darf jeder nennen, auch der Einsendende. Alle drei
    /// liegen im Zustaendigkeitsbereich derselben Kanzlei; darunter ist sogar
    /// ENGER als darueber, denn wer ein Formular fuehrt, fuehrt den Baum
    /// darunter.
    /// </para>
    ///
    /// <para>
    /// <b>Eine andere Seite desselben Traegers — nur, wenn die Kanzlei sie
    /// gewaehlt hat.</b> Das Formular auf `…/confirmation/signin`, das Portal
    /// auf `…/confirmation/candidate`: Geschwister, beide von derselben Rolle
    /// uebernommen. Vorher hing es davon ab, ob der Bogen ZUFAELLIG auch auf
    /// einer hoeheren Seite stand, ob diese Wahl angeboten wurde. Ein
    /// Einsendender kann das nicht erzwingen: er nennt nur, was die Kanzlei
    /// eingestellt hat (`chosenByOffice`), sonst gilt die enge Regel.
    /// </para>
    ///
    /// <para>
    /// <b>Eine Seite nur mit Zugang — nur, wenn die KANZLEI sie gewaehlt hat.</b>
    /// `access_slug` ist ein Weg hinein (0026): ein Platz dort gibt dem
    /// Einsendenden Zutritt. Nennt er die Seite selbst, darf das nie genuegen —
    /// sonst reichte ein Formular auf `lo13` und ein selbst genannter Pfad, um
    /// in `lo13/anna` zu kommen. Hat aber die Kanzlei in den Einstellungen des
    /// Formulars GENAU diese Seite als Portal gewaehlt (die Terminseite der
    /// Kandidaten, 2026-09-28), dann ist das ihre Entscheidung: wer sich hier
    /// anmeldet, bekommt Zugang zu ihr — und ein alter Link aus einem anderen
    /// Formular eben nicht.
    /// </para>
    /// </summary>
    private static async Task<bool> MayAnchorAsync(
        SqlConnection connection, IReadOnlyList<string> formPaths, string wanted, bool chosenByOffice,
        CancellationToken ct)
    {
        await using (var look = new SqlCommand(
            """
            SELECT 1 FROM app.slug s
            WHERE s.path = @p
              AND EXISTS (SELECT 1 FROM app.slug_area w WHERE w.slug_id = s.id);
            """, connection))
        {
            look.Parameters.AddWithValue("@p", wanted);
            if (await look.ExecuteScalarAsync(ct) is not null && !chosenByOffice) return false;
        }

        foreach (var page in formPaths)
        {
            if (page == wanted
                || page.StartsWith(wanted + "/", StringComparison.Ordinal)
                || wanted.StartsWith(page + "/", StringComparison.Ordinal))
            {
                return true;
            }
        }

        if (!chosenByOffice || formPaths.Count == 0) return false;

        var names = string.Join(", ", formPaths.Select((_, at) => $"@f{at}"));

        await using var cmd = new SqlCommand($"""
            SELECT TOP 1 1
            FROM app.slug w
            JOIN app.slug f ON f.claimed_by_role_id = w.claimed_by_role_id
            WHERE w.path = @wanted
              AND w.alias_of IS NULL
              AND f.path IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@wanted", wanted);
        for (var at = 0; at < formPaths.Count; at++) cmd.Parameters.AddWithValue($"@f{at}", formPaths[at]);

        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

    private static async Task<Guid?> SlugIdAsync(
        SqlConnection connection, string path, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id FROM app.slug WHERE path = @p;", connection);

        cmd.Parameters.AddWithValue("@p", path);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    /// <summary>
    /// Ein Formular, wie die Kanzlei es anfasst: sein BAUSTEIN (0036), sein
    /// Bereich, und die Seiten, auf denen er steht.
    /// </summary>
    private sealed record Sheet(Guid ModuleId, Guid? AreaId, IReadOnlyList<string> Paths);

    /// <summary>Was gesagt wird, wenn jemand ein Formular anfasst, das nicht seines ist.</summary>
    private const string NotYours =
        "Tego formularza nie prowadzisz — ani przez jego obszar, ani przez stronę, na której stoi.";

    /// <summary>
    /// Den Bogen finden — ueber den Baustein, nicht ueber EINE Verwendung.
    ///
    /// <para>
    /// <b>Hier stand die Suche nach `slug_part.id`.</b> Sie fand nur Boegen,
    /// deren Baustein zufaellig dieselbe Kennung trug wie seine Verwendung —
    /// die vor 0036 entstandenen und die, die eine Seite nebenbei anlegt. Ein
    /// Baustein aus der Bausteinliste hat eine eigene Kennung; einer, der
    /// (noch) auf keiner Seite steht, hat gar keine Verwendung. Fuer beide
    /// sagte jeder Aufruf „Takiego bloku nie ma", obwohl der Bogen da war.
    /// </para>
    ///
    /// <para>
    /// Angenommen wird beides: die Kennung des Bausteins (so fragt der
    /// Browser) und die einer Verwendung (so fragten aeltere Aufrufer).
    /// </para>
    /// </summary>
    private static async Task<Sheet?> SheetAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        Guid moduleId;
        Guid? areaId;

        await using (var find = new SqlCommand("""
            SELECT TOP 1 m.id, m.area_id
            FROM app.module m
            WHERE m.id = @id
               OR m.id = (SELECT module_id FROM app.slug_part WHERE id = @id)
            ORDER BY CASE WHEN m.id = @id THEN 0 ELSE 1 END;
            """, connection))
        {
            find.Parameters.AddWithValue("@id", id);

            await using var reader = await find.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;

            moduleId = reader.GetGuid(0);
            areaId = reader.IsDBNull(1) ? null : reader.GetGuid(1);
        }

        var paths = new List<string>();

        await using (var where = new SqlCommand("""
            SELECT DISTINCT s.path
            FROM app.slug_part p
            JOIN app.slug s ON s.id = p.slug_id
            WHERE p.module_id = @m
            ORDER BY s.path;
            """, connection))
        {
            where.Parameters.AddWithValue("@m", moduleId);

            await using var reader = await where.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) paths.Add(reader.GetString(0));
        }

        return new Sheet(moduleId, areaId, paths);
    }

    /// <summary>
    /// Wer einen Bogen PFLEGEN darf — dieselbe Regel wie fuer jeden Baustein
    /// (<c>Module.MayTendAsync</c>), und die alte dazu.
    ///
    /// <para>
    /// <b>Mit Bereich entscheidet der Bereich</b>: dort liegen die Antworten.
    /// <b>Und wer eine Seite fuehrt, auf der er steht</b>, darf es weiterhin —
    /// so war es, bevor der Bogen ein eigenes Ding wurde, und niemandem wird
    /// hier etwas genommen.
    /// </para>
    /// </summary>
    private static async Task<bool> MayWriteSheetAsync(
        SqlConnection connection, Guid accountId, Sheet sheet, CancellationToken ct)
    {
        if (sheet.AreaId is Guid area
            && await Area.MayAsync(connection, accountId, area, Capability.Write, ct))
        {
            return true;
        }

        foreach (var path in sheet.Paths)
        {
            if ((await Access.OfAsync(connection, accountId, path, ct)).MayWrite) return true;
        }

        return false;
    }
}
