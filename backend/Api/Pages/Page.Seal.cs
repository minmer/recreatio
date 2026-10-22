using System.Text.Json;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0121 — EINE SEITE VERSIEGELN.
///
/// <para>
/// <b>Nur eine Seite mit Zugang</b> (0051): eine öffentliche wäre versiegelt für
/// niemanden lesbar, für den sie da ist. Versiegelt liegen dann Titel, Vorspann,
/// Aussehen, Karte, Wybór, Anordnung und Inhalt der Bausteine und das Menü als
/// Hülle (<c>rcs1.&lt;Fassung&gt;.&lt;base64url&gt;</c>) in denselben Spalten
/// wie vorher. Der Dienst öffnet nichts davon — er prüft nur, dass auf einer
/// versiegelten Seite nichts Offenes ankommt und auf einer offenen nichts
/// Versiegeltes, und dass die Hüllen nicht über ihre Grenzen wachsen.
/// </para>
///
/// <para>
/// <b>Der Schlüssel der Seite</b> entsteht im Browser und liegt in
/// <c>slug.page_seal</c> verpackt: unter dem Epochenschlüssel jedes gebundenen
/// Bereichs und unter dem Schlüssel der Rolle, die die Seite führt. Wer einen
/// Bereich der Seite liest — mit Konto, über einen Link, als Platz mit einer
/// Rolle (0091) —, öffnet ihn; wer sie führt, auch ohne Bereich.
/// </para>
///
/// <para>
/// <b>Ein Formular bleibt, wie es ist.</b> Seine Einstellungen liest der Dienst
/// (Portal, gesperrte Fragen) — sie bleiben offen; seine Fragen und Antworten
/// liegen ohnehin unter dem Schlüssel seines Bereichs.
/// </para>
///
/// <para>
/// <b>Ein- und Ausschalten geschieht in EINER Transaktion</b>
/// (<c>PUT /workspace/page-seal/{path}</c>): der Browser schickt alles, was die
/// Seite trägt, neu — versiegelt oder offen. Auf halbem Weg stehen zu bleiben
/// hiesse, eine Seite zu haben, deren Titel offen und deren Menü versiegelt ist.
/// </para>
/// </summary>
public static partial class Page
{
    /* -- Die Hülle ------------------------------------------------------------------------------ */

    /// <summary>Vor jeder versiegelten Zeichenkette: Format 1, dann die Fassung des Seitenschlüssels.</summary>
    public const string SealPrefix = "rcs1.";

    /// <summary>
    /// Versiegelt ist ein Text länger als offen: UTF-8 (höchstens drei Byte je
    /// Zeichen), Kopf, Nonce, Etikett, base64. Der Browser packt vorher, meist
    /// wird es also kürzer — aber die Grenze muss auch für Ungepacktes reichen.
    /// </summary>
    public static int SealedLimit(int plain) => plain * 4 + 256;

    /// <summary>Höchstens so viele Hüllen trägt ein Seitenschlüssel: 20 Bereiche (0051) und die führende Rolle.</summary>
    private const int MaxWraps = 21;

    /// <summary>
    /// Ist das eine Hülle? <c>rcs1.&lt;Ziffern&gt;.&lt;base64url&gt;</c> — und lang
    /// genug für Kopf (20), Nonce (12), Etikett (16) und das Byte davor: 49 Byte,
    /// in base64url mindestens 66 Zeichen (dieselbe Form prüft `pageSeal.ts`).
    /// </summary>
    public static bool IsEnvelope(string? text)
    {
        if (text is null || text.Length < SealPrefix.Length + 2 + 66 || !text.StartsWith(SealPrefix, StringComparison.Ordinal)) return false;

        var rest = text.AsSpan(SealPrefix.Length);
        var dot = rest.IndexOf('.');
        if (dot is < 1 or > 6) return false;

        foreach (var c in rest[..dot]) if (c is < '0' or > '9') return false;
        foreach (var c in rest[(dot + 1)..]) if (!(char.IsAsciiLetterOrDigit(c) || c is '-' or '_')) return false;

        return true;
    }

    /* -- Ob 0121 schon gelaufen ist -------------------------------------------------------------- */

    private static volatile bool sealReady;
    private static long sealCheckedAt;

    /// <summary>
    /// Die Spalte <c>slug.page_seal</c> gibt es — sonst ist keine Seite versiegelt
    /// und keine lässt sich versiegeln. Der Dienst geht manchmal vor der Migration
    /// hinaus; dann fragt er nicht nach einer Spalte, die es nicht gibt. Ein „ja"
    /// gilt für immer, ein „nein" eine halbe Minute.
    /// </summary>
    internal static async Task<bool> SealReadyAsync(SqlConnection connection, CancellationToken ct, SqlTransaction? tx = null)
    {
        if (sealReady) return true;

        var now = Environment.TickCount64;
        var last = Interlocked.Read(ref sealCheckedAt);
        if (last != 0 && now - last < 30_000) return false;

        await using var cmd = new SqlCommand(
            "SELECT CASE WHEN COL_LENGTH(N'app.slug', N'page_seal') IS NULL THEN 0 ELSE 1 END;", connection, tx);
        var there = (int)(await cmd.ExecuteScalarAsync(ct))! == 1;

        Interlocked.Exchange(ref sealCheckedAt, now);
        if (there) sealReady = true;
        return there;
    }

    /// <summary>Die Hüllen des Seitenschlüssels (JSON) — oder <c>null</c>: die Seite ist offen.</summary>
    internal static async Task<string?> SealOfAsync(SqlConnection connection, Guid slugId, CancellationToken ct, SqlTransaction? tx = null)
    {
        if (!await SealReadyAsync(connection, ct, tx)) return null;

        await using var cmd = new SqlCommand("SELECT page_seal FROM app.slug WHERE id = @id;", connection, tx);
        cmd.Parameters.AddWithValue("@id", slugId);
        return await cmd.ExecuteScalarAsync(ct) as string;
    }

    /* -- Die Hüllen des Seitenschlüssels ----------------------------------------------------------- */

    /// <summary>Eine Hülle: unter dem Epochenschlüssel eines Bereichs (<c>Area</c>, <c>Epoch</c>) oder dem Schlüssel einer Rolle.</summary>
    public sealed record SealWrap(Guid? Area, int? Epoch, Guid? Role, string Key);

    public sealed record SealHeader(int Version, IReadOnlyList<SealWrap> Wraps);

    /// <summary>Gespeichert oder geschickt — gelesen, geprüft, oder <c>null</c>, wenn es keines ist.</summary>
    public static SealHeader? ReadSeal(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        if (!element.TryGetProperty("v", out var v) || v.ValueKind != JsonValueKind.Number || !v.TryGetInt32(out var version) || version < 1) return null;
        if (!element.TryGetProperty("w", out var w) || w.ValueKind != JsonValueKind.Array) return null;

        var wraps = new List<SealWrap>();
        foreach (var one in w.EnumerateArray())
        {
            if (one.ValueKind != JsonValueKind.Object) return null;
            if (!one.TryGetProperty("k", out var k) || k.ValueKind != JsonValueKind.String) return null;

            var key = k.GetString() ?? string.Empty;
            if (key.Length is < 40 or > 600 || key.Any(c => !(char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))) return null;

            if (one.TryGetProperty("a", out var a))
            {
                if (a.ValueKind != JsonValueKind.String || !Guid.TryParse(a.GetString(), out var area)) return null;
                if (!one.TryGetProperty("e", out var e) || e.ValueKind != JsonValueKind.Number || !e.TryGetInt32(out var epoch) || epoch < 1) return null;
                wraps.Add(new SealWrap(area, epoch, null, key));
            }
            else if (one.TryGetProperty("r", out var r))
            {
                if (r.ValueKind != JsonValueKind.String || !Guid.TryParse(r.GetString(), out var role)) return null;
                wraps.Add(new SealWrap(null, null, role, key));
            }
            else return null;
        }

        return wraps.Count is 0 or > MaxWraps ? null : new SealHeader(version, wraps);
    }

    public static SealHeader? ReadSeal(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var document = JsonDocument.Parse(json);
            return ReadSeal(document.RootElement);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>So steht es in der Spalte und geht es hinaus: <c>{"v":…,"w":[…]}</c>, mit Kennungen im Textformat.</summary>
    public static string WriteSeal(SealHeader seal) => JsonSerializer.Serialize(new
    {
        v = seal.Version,
        w = seal.Wraps.Select(one => one.Area is not null
            ? (object)new { a = Ids.ToText(one.Area.Value), e = one.Epoch ?? 1, k = one.Key }
            : new { r = Ids.ToText(one.Role!.Value), k = one.Key })
    });

    /// <summary>Was der Browser zum Öffnen braucht: die Kennung der Seite (sie steht in jedem Etikett), die Fassung, die Hüllen.</summary>
    internal static object? SealOut(Guid slugId, string? json)
    {
        var seal = ReadSeal(json);
        if (seal is null) return null;

        return new
        {
            id = Ids.ToText(slugId),
            v = seal.Version,
            w = seal.Wraps.Select(one => one.Area is not null
                ? (object)new { a = Ids.ToText(one.Area.Value), e = one.Epoch ?? 1, k = one.Key }
                : new { r = Ids.ToText(one.Role!.Value), k = one.Key })
        };
    }

    /* -- Was zur Seite passt ------------------------------------------------------------------------ */

    /// <summary>
    /// Ein Wert, der zum Stand der Seite nicht passt — versiegelt auf einer
    /// offenen, offen auf einer versiegelten. Das Urteil sagt dem Browser, wie die
    /// Seite gerade ist (<c>sealed</c> / <c>open</c>), damit er neu lädt und
    /// noch einmal schreibt — diesmal passend.
    /// </summary>
    internal static Task SealMismatch(HttpContext ctx, bool sealedPage)
    {
        ctx.Response.StatusCode = StatusCodes.Status409Conflict;
        return ctx.Response.WriteAsJsonAsync(new
        {
            error = sealedPage
                ? "Ta strona jest zaszyfrowana — odśwież edytor, a zapis zaszyfruje się sam."
                : "Ta strona nie jest (już) zaszyfrowana — odśwież edytor.",
            verdict = sealedPage ? "sealed" : "open"
        });
    }

    /// <summary>Passt dieser Wert zur Seite? <c>null</c> passt immer (nichts gesetzt).</summary>
    internal static bool Fits(bool sealedPage, string? value) =>
        value is null || IsEnvelope(value) == sealedPage;

    /// <summary>
    /// Die Bausteine (ausser Formularen), die auf einer versiegelten Seite stehen
    /// und AUCH woanders — oder auf einer offenen Seite stehen und auch auf einer
    /// versiegelten. Beides geht nicht: derselbe Inhalt wäre auf der einen Seite
    /// versiegelt und auf der anderen offen, oder unter zwei Schlüsseln zugleich.
    /// Gibt die Adressen der anderen Seiten zurück, leer: kein Konflikt.
    /// </summary>
    internal static async Task<List<string>> SharedAcrossSealAsync(
        SqlConnection connection, Guid slugId, bool sealedPage, IReadOnlyCollection<Guid> modules, CancellationToken ct, SqlTransaction? tx = null)
    {
        var found = new List<string>();
        if (modules.Count == 0 || !await SealReadyAsync(connection, ct, tx)) return found;

        var names = string.Join(", ", modules.Select((_, i) => $"@m{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT DISTINCT s.path
            FROM app.slug_part p
            JOIN app.slug s ON s.id = p.slug_id
            JOIN app.module m ON m.id = p.module_id
            WHERE p.module_id IN ({names}) AND p.slug_id <> @slug AND m.kind <> N'form'
              AND (@sealed = 1 OR s.page_seal IS NOT NULL);
            """, connection, tx);
        var i = 0;
        foreach (var module in modules) cmd.Parameters.AddWithValue($"@m{i++}", module);
        cmd.Parameters.AddWithValue("@slug", slugId);
        cmd.Parameters.AddWithValue("@sealed", sealedPage ? 1 : 0);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) found.Add(reader.GetString(0));
        return found;
    }

    /// <summary>
    /// Für die Bausteinliste (<c>Module.UpdateAsync</c>): darf diese Einstellung
    /// so gespeichert werden? Ein Baustein auf einer versiegelten Seite wird dort
    /// geändert, im Editor der Seite — die Liste hat ihren Schlüssel nicht.
    /// <c>null</c>: ja.
    /// </summary>
    internal static async Task<string?> ModuleSealConflictAsync(SqlConnection connection, Guid moduleId, string config, CancellationToken ct)
    {
        if (!await SealReadyAsync(connection, ct)) return IsEnvelope(config) ? "Ta treść jest zaszyfrowana, a strony nie są." : null;

        await using var cmd = new SqlCommand("""
            SELECT TOP 1 m.kind, s.path
            FROM app.module m
            LEFT JOIN app.slug_part p ON p.module_id = m.id
            LEFT JOIN app.slug s ON s.id = p.slug_id AND s.page_seal IS NOT NULL
            WHERE m.id = @id
            ORDER BY CASE WHEN s.path IS NULL THEN 1 ELSE 0 END;
            """, connection);
        cmd.Parameters.AddWithValue("@id", moduleId);

        string? kind = null, sealedPath = null;
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            if (await reader.ReadAsync(ct))
            {
                kind = reader.GetString(0);
                sealedPath = reader.IsDBNull(1) ? null : reader.GetString(1);
            }
        }

        if (kind == "form" || sealedPath is null)
            return IsEnvelope(config) ? "Tego modułu nie da się zapisać jako zaszyfrowanego." : null;

        return IsEnvelope(config)
            ? null
            : $"Ten moduł stoi na zaszyfrowanej stronie „{sealedPath}” — zmieniaj go w edytorze tej strony.";
    }

    /* -- Versiegeln und Öffnen in einem Zug ---------------------------------------------------------- */

    public sealed record SealPart(string Id, string? Layout, string? Config);

    /// <summary>
    /// <c>Seal</c>: die Hüllen des NEUEN Seitenschlüssels — oder <c>null</c>: die Seite wird
    /// wieder offen. Alles andere ist der ganze Inhalt der Seite, wie er nachher
    /// gilt — versiegelt unter dem neuen Schlüssel oder offen.
    /// </summary>
    public sealed record SealRequest(
        JsonElement? Seal, string? Title, string? Lead, string? Theme, string? Logic, string? Subject,
        IReadOnlyList<SealPart>? Parts, string? Menu);

    private static async Task SealAsync(HttpContext ctx, Db db, string? path, SealRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = Slug.Normalise(path);
        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        var sealing = body.Seal is { ValueKind: JsonValueKind.Object };
        var seal = sealing ? ReadSeal(body.Seal!.Value) : null;
        if (sealing && seal is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne klucze strony.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await SealReadyAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Szyfrowanie stron jeszcze nie działa na tym serwerze (brakuje migracji 0121).");
            return;
        }

        var row = await RowAsync(connection, wanted, ctx.RequestAborted);
        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
            return;
        }

        if (row.Value.AliasOf is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"Ten adres jest tylko innym wejściem do „{row.Value.AliasOf}” — szyfrowanie ustawia się tam.");
            return;
        }

        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);
        if (grip.OwnerRoleId is null || !grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tego adresu nie prowadzi żadna z Twoich ról i nie masz do niego prawa zapisu.");
            return;
        }

        var slugId = row.Value.Id;
        var current = ReadSeal(await SealOfAsync(connection, slugId, ctx.RequestAborted));

        /* Die Bereiche der Seite — versiegelt wird nur eine Seite mit Zugang, und verpackt nur für ihre Bereiche. */
        var areas = new HashSet<Guid>();
        await using (var cmd = new SqlCommand("SELECT area_id FROM app.slug_area WHERE slug_id = @slug;", connection))
        {
            cmd.Parameters.AddWithValue("@slug", slugId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) areas.Add(reader.GetGuid(0));
        }

        if (seal is not null)
        {
            if (areas.Count == 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Zaszyfrować można tylko stronę z dostępem — najpierw wybierz obszary, które ją otwierają.");
                return;
            }

            if (current is not null && seal.Version <= current.Version)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ktoś właśnie zmienił klucz tej strony — odśwież i spróbuj jeszcze raz.");
                return;
            }

            var seen = new HashSet<Guid>();
            foreach (var wrap in seal.Wraps)
            {
                if (wrap.Area is { } area && (!areas.Contains(area) || !seen.Add(area)))
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Klucz strony jest zapakowany dla obszaru, który jej nie otwiera.");
                    return;
                }

                if (wrap.Role is { } role && role != grip.OwnerRoleId.Value)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Klucz strony może dostać tylko rola, która ją prowadzi.");
                    return;
                }
            }
        }

        bool Fitting(string? value) => value is null || IsEnvelope(value) == (seal is not null);

        /* -- Titel und Vorspann ----------------------------------------------------------------------- */

        bool hasPage;
        await using (var cmd = new SqlCommand("SELECT 1 FROM app.slug_page WHERE slug_id = @slug;", connection))
        {
            cmd.Parameters.AddWithValue("@slug", slugId);
            hasPage = await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not null;
        }

        var title = string.IsNullOrWhiteSpace(body.Title) ? null : body.Title.Trim();
        var lead = string.IsNullOrWhiteSpace(body.Lead) ? null : body.Lead.Trim();

        if (hasPage != (title is not null) || !Fitting(title) || !Fitting(lead)
            || (title is not null && title.Length > (seal is null ? MaxTitle : SealedLimit(MaxTitle)))
            || (lead is not null && lead.Length > (seal is null ? MaxLead : SealedLimit(MaxLead))))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Tytuł albo tekst strony nie pasuje do tego, co ma być zapisane.");
            return;
        }

        /* -- Aussehen, Karte, Wybór --------------------------------------------------------------------- */

        var theme = string.IsNullOrWhiteSpace(body.Theme) ? null : body.Theme;
        var logic = string.IsNullOrWhiteSpace(body.Logic) ? null : body.Logic;
        var subject = string.IsNullOrWhiteSpace(body.Subject) ? null : body.Subject;

        if (!Fitting(theme) || !Fitting(logic) || !Fitting(subject)
            || (theme is not null && theme.Length > (seal is null ? MaxTheme : SealedLimit(MaxTheme)))
            || (logic is not null && logic.Length > (seal is null ? MaxLogic : SealedLimit(MaxLogic)))
            || (subject is not null && subject.Length > (seal is null ? MaxSubject : SealedLimit(MaxSubject)))
            || (seal is null && (!IsJson(theme) || !IsJson(logic) || !IsJson(subject))))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Wygląd, mapa albo wybór strony nie pasuje do tego, co ma być zapisane.");
            return;
        }

        /* -- Die Bausteine: GENAU die, die dastehen ------------------------------------------------------ */

        var standing = new Dictionary<Guid, (string Kind, Guid? Module)>();
        await using (var cmd = new SqlCommand("""
            SELECT p.id, COALESCE(m.kind, p.kind), p.module_id
            FROM app.slug_part p LEFT JOIN app.module m ON m.id = p.module_id
            WHERE p.slug_id = @slug;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@slug", slugId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                standing[reader.GetGuid(0)] = (reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetGuid(2));
        }

        var parts = new List<(Guid Id, string Kind, Guid? Module, string Layout, string? Config)>();
        foreach (var part in body.Parts ?? [])
        {
            if (!Guid.TryParse(part.Id, out var id) || !standing.TryGetValue(id, out var was) || parts.Any(one => one.Id == id))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Moduły strony zmieniły się w międzyczasie — odśwież i spróbuj jeszcze raz.");
                return;
            }

            var layout = part.Layout ?? string.Empty;
            var config = was.Kind == "form" ? null : string.IsNullOrWhiteSpace(part.Config) ? null : part.Config;

            if (layout.Length == 0 || !Fitting(layout) || !Fitting(config)
                || layout.Length > (seal is null ? MaxLayout : SealedLimit(MaxLayout))
                || (config is not null && config.Length > (seal is null ? MaxConfig : SealedLimit(MaxConfig))))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Układ albo treść modułu nie pasuje do tego, co ma być zapisane.");
                return;
            }

            parts.Add((id, was.Kind, was.Module, layout, config));
        }

        if (parts.Count != standing.Count)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Moduły strony zmieniły się w międzyczasie — odśwież i spróbuj jeszcze raz.");
            return;
        }

        if (seal is not null)
        {
            var shared = await SharedAcrossSealAsync(connection, slugId, true,
                parts.Where(one => one.Kind != "form" && one.Module is not null).Select(one => one.Module!.Value).ToHashSet(), ctx.RequestAborted);
            if (shared.Count > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    $"Któryś moduł tej strony stoi też na: {string.Join(", ", shared.Take(5))}. Zaszyfrowana strona nie dzieli modułów — zdejmij go tam albo skopiuj.");
                return;
            }
        }

        /* -- Das Menü: das EIGENE der Seite ------------------------------------------------------------- */

        bool ownMenu;
        var borrowers = new List<string>();
        await using (var cmd = new SqlCommand("""
            SELECT CASE WHEN EXISTS (SELECT 1 FROM app.slug_menu WHERE slug_id = @slug AND menu IS NOT NULL) THEN 1 ELSE 0 END;
            SELECT s.path FROM app.slug_menu m JOIN app.slug s ON s.id = m.slug_id WHERE m.uses_slug_id = @slug;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@slug", slugId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            await reader.ReadAsync(ctx.RequestAborted);
            ownMenu = reader.GetInt32(0) == 1;
            await reader.NextResultAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) borrowers.Add(reader.GetString(0));
        }

        if (seal is not null && borrowers.Count > 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"Menu tej strony pokazują też: {string.Join(", ", borrowers.Take(5))}. Zaszyfrowanego menu tamte strony by nie odczytały — najpierw daj im własne.");
            return;
        }

        string? menu = null;
        if (ownMenu)
        {
            var given = string.IsNullOrWhiteSpace(body.Menu) ? null : body.Menu;
            if (seal is not null)
            {
                if (!IsEnvelope(given) || given!.Length > SealedLimit(60_000))
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Menu strony nie pasuje do tego, co ma być zapisane.");
                    return;
                }
                menu = JsonSerializer.Serialize(given);
            }
            else
            {
                List<Menu.Item>? items = null;
                try { items = given is null ? null : JsonSerializer.Deserialize<List<Menu.Item>>(given, new JsonSerializerOptions(JsonSerializerDefaults.Web)); }
                catch (JsonException) { items = null; }

                var count = 0;
                var clean = items is null ? null : Api.Menu.Validate(items, 1, ref count, out _);
                if (clean is null || clean.Count == 0)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Menu strony nie pasuje do tego, co ma być zapisane.");
                    return;
                }
                menu = JsonSerializer.Serialize(clean, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            }
        }
        else if (!string.IsNullOrWhiteSpace(body.Menu))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Menu strony zmieniło się w międzyczasie — odśwież i spróbuj jeszcze raz.");
            return;
        }

        /* -- Alles in einem Zug ------------------------------------------------------------------------- */

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using (var cmd = new SqlCommand("""
                UPDATE app.slug
                   SET page_seal = @seal, page_theme = @theme, page_logic = @logic, page_subject = @subject
                 WHERE id = @slug;

                UPDATE app.slug_page
                   SET title = COALESCE(@title, title), lead = @lead, updated_at = @now, updated_by_role_id = @role
                 WHERE slug_id = @slug;

                IF @menu IS NOT NULL
                    UPDATE app.slug_menu SET menu = @menu, updated_at = @now WHERE slug_id = @slug AND menu IS NOT NULL;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@seal", seal is null ? DBNull.Value : WriteSeal(seal));
                cmd.Parameters.AddWithValue("@theme", (object?)theme ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@logic", (object?)logic ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@subject", (object?)subject ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@title", (object?)title ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@lead", (object?)lead ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@menu", (object?)menu ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                cmd.Parameters.AddWithValue("@role", (object?)grip.ViaRoleId ?? grip.OwnerRoleId.Value);
                cmd.Parameters.AddWithValue("@slug", slugId);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var part in parts)
            {
                await using var cmd = new SqlCommand("""
                    UPDATE app.slug_part
                       SET layout = @layout, config = CASE WHEN @form = 1 THEN config ELSE @config END
                     WHERE id = @id;

                    IF @form = 0 AND @module IS NOT NULL
                        UPDATE app.module SET config = @config WHERE id = @module AND kind <> N'form';
                    """, connection, tx);
                cmd.Parameters.AddWithValue("@layout", part.Layout);
                cmd.Parameters.AddWithValue("@config", (object?)part.Config ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@form", part.Kind == "form" ? 1 : 0);
                cmd.Parameters.AddWithValue("@module", (object?)part.Module ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@id", part.Id);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, @sealed = seal is not null, v = seal?.Version });
    }

    /// <summary>Leer, oder JSON — eine Zeichenkette, die keines ist, legte jede Seite lahm, die sie liest.</summary>
    private static bool IsJson(string? text)
    {
        if (text is null) return true;
        try { using var _ = JsonDocument.Parse(text); return true; }
        catch (JsonException) { return false; }
    }
}
