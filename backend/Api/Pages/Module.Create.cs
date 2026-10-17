using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Einen Baustein anlegen.</summary>
public static partial class Module
{
    /* -- Anlegen ------------------------------------------------------------- */

    /// <summary>
    /// <c>ForKind</c> sagt, WOVON der Baustein handelt (0038): von einem
    /// Menschen, einer Gruppe, einem Amt — oder von nichts Benanntem.
    ///
    /// <para>
    /// Daran haengt, woran der Platz haengt, den eine Einsendung erzeugt. Ein
    /// Link muss zu etwas gehoeren; „zu irgendetwas" ist keine Antwort.
    /// </para>
    /// </summary>
    public sealed record CreateRequest(
        string ModuleId, string Kind, string? Name, string? AreaId, string? Config,
        string? ForKind = null,

        /*
         * 0047 — ein Formular, das ein anderes ERWEITERT, und wer es
         * ausfüllt: `person` (der Mensch über seinen Link) oder `office`
         * (nur die Kanzlei).
         */
        string? ExtendsId = null, string? Audience = null,

        /* 0077 — wie oft die Erweiterung je Mensch ausgefüllt wird: once (Vorgabe), day, week, month, year. */
        string? Repeat = null,

        /* 0097 — der Name eines Formulars, versiegelt unter dem Schlüssel seines Bereichs (`Name` bleibt dann leer). */
        string? NameSealed = null, int? NameEpoch = null);

    /// <summary>Wovon ein Baustein handeln kann (0038).</summary>
    private static readonly string[] Subjects = ["none", "person", "group", "role"];

    /// <summary>
    /// Einen Baustein anlegen — ohne Seite.
    ///
    /// <para>
    /// <b>Er entsteht fuer sich</b>, und das ist der ganze Punkt der Trennung:
    /// erst gibt es den Bogen, dann entscheidet jemand, wo er haengt. Vorher
    /// entstand er, indem man ihn irgendwo hinstellte — und dann gab es ihn
    /// genau dort und nirgends sonst.
    /// </para>
    ///
    /// <para>
    /// <b>Mit Bereich heisst: dort muss ich schreiben duerfen.</b> Einen
    /// Baustein in einen fremden Bereich zu haengen hiesse, Daten dorthin zu
    /// legen, wo man selbst nichts zu suchen hat.
    /// </para>
    /// </summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, CreateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.ModuleId, out var moduleId) || moduleId == Guid.Empty)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        var kind = (body.Kind ?? string.Empty).Trim().ToLowerInvariant();
        if (kind.Length is 0 or > 32)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj modułu jest pusty albo za długi.");
            return;
        }

        /*
         * 0097 — DER NAME EINES FORMULARS LIEGT NIE OFFEN. Er kommt versiegelt
         * unter dem Schlüssel seines Bereichs; ein mitgeschickter Klartext wird
         * nicht gespeichert. Andere Bausteine (Text, Kalender) behalten ihren
         * offenen Namen.
         */
        string? name = null;
        var (nameSealed, nameEpoch, nameError) = Names.Read(body.NameSealed, body.NameEpoch);

        if (kind == "form")
        {
            if (nameError is not null || nameSealed is null)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    nameError ?? "Nazwa formularza idzie zapieczętowana kluczem jego obszaru.");
                return;
            }
        }
        else
        {
            name = (body.Name ?? string.Empty).Trim();
            if (name.Length is 0 or > MaxName)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Nazwa: od 1 do {MaxName} znaków.");
                return;
            }
        }

        if ((body.Config?.Length ?? 0) > MaxConfig)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Ustawienia: najwyżej {MaxConfig} znaków.");
            return;
        }

        var forKind = (body.ForKind ?? "none").Trim().ToLowerInvariant();

        if (Array.IndexOf(Subjects, forKind) < 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Moduł dotyczy: none, person, group albo role.");
            return;
        }

        Guid? areaId = null;

        if (!string.IsNullOrWhiteSpace(body.AreaId))
        {
            if (!Guid.TryParse(body.AreaId, out var wanted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung obszaru.");
                return;
            }

            areaId = wanted;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * DIE ERWEITERUNG (0047). Sie gehört zu ihrem Formular: derselbe
         * Bereich (dort liegen seine Fragen, und wer es pflegt, pflegt auch
         * sie), dasselbe „wovon" — und nur, wer das Formular pflegt, darf ihm
         * etwas anhängen. Eine Ebene: eine Erweiterung erweitert nichts.
         */
        Guid? extendsId = null;
        var audience = "public";
        var repeat = Rounds.Once;

        if (!string.IsNullOrWhiteSpace(body.ExtendsId))
        {
            if (!Guid.TryParse(body.ExtendsId, out var baseId) || kind != "form")
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Rozszerzyć można tylko formularz.");
                return;
            }

            audience = (body.Audience ?? string.Empty).Trim().ToLowerInvariant();
            if (audience is not ("person" or "office"))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Rozszerzenie wypełnia osoba (person) albo koordynator (office).");
                return;
            }

            var based = await ReadAsync(connection, baseId, ctx.RequestAborted);
            if (based is null || based.Value.Kind != "form")
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego formularza nie ma.");
                return;
            }

            if (based.Value.ExtendsId is not null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "To już jest rozszerzenie — rozszerza się formularz, nie rozszerzenie.");
                return;
            }

            if (!await MayTendAsync(ctx, db, connection, based.Value, who.Value.AccountId))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Tego formularza nie prowadzisz.");
                return;
            }

            extendsId = baseId;
            areaId ??= based.Value.AreaId;
            forKind = based.Value.ForKind;

            /* 0077 — wie oft: einmal je Mensch, oder je Tag, Woche, Monat, Jahr. */
            repeat = string.IsNullOrWhiteSpace(body.Repeat) ? Rounds.Once : body.Repeat.Trim().ToLowerInvariant();
            if (!Rounds.IsKind(repeat))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Powtarzanie: once, day, week, month albo year.");
                return;
            }
        }
        else if (!string.IsNullOrWhiteSpace(body.Repeat) && body.Repeat.Trim().ToLowerInvariant() != Rounds.Once)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Powtarza się tylko rozszerzenie — zwykły formularz jest samą listą osób.");
            return;
        }

        if (areaId is not null
            && !await Area.MayAsync(connection, who.Value.AccountId, areaId.Value,
                    Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        /* Ein Formular ohne Bereich hätte keinen Schlüssel für seinen Namen — und keinen für seine Fragen. */
        if (kind == "form")
        {
            if (areaId is null)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Formularz potrzebuje obszaru — pod jego kluczem leży nazwa.");
                return;
            }

            if (await Names.EpochProblemAsync(connection, null, areaId.Value, nameEpoch, person: false, ctx.RequestAborted) is { } problem)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, problem);
                return;
            }
        }

        await using var cmd = new SqlCommand("""
            INSERT INTO app.module (id, area_id, kind, name, name_sealed, name_epoch, config, created_at, for_kind, extends_id, audience, repeat_kind)
            VALUES (@id, @area, @kind, @name, @nameSealed, @nameEpoch, @config, @now, @for, @extends, @audience, @repeat);
            """, connection);

        cmd.Parameters.AddBlob("@nameSealed", nameSealed);
        cmd.Parameters.AddWithValue("@nameEpoch", nameSealed is null ? DBNull.Value : nameEpoch);

        cmd.Parameters.AddWithValue("@extends", (object?)extendsId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@audience", audience);
        cmd.Parameters.AddWithValue("@repeat", repeat);

        cmd.Parameters.AddWithValue("@id", moduleId);
        cmd.Parameters.AddWithValue("@area", (object?)areaId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@kind", kind);
        cmd.Parameters.AddWithValue("@name", (object?)name ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@config", (object?)body.Config ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@for", forKind);

        try
        {
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Taki moduł już istnieje.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { moduleId = Ids.ToText(moduleId) });
    }
}
