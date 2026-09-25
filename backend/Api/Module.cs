using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Bausteine — die Dinge selbst, getrennt von ihrem Platz auf einer Seite.
///
/// <para>
/// <b>Ein Baustein gehoert in einen BEREICH, nicht auf eine Seite</b> (0036).
/// Die Seite zeigt ihn; sie besitzt ihn nicht. Deshalb steht derselbe Bogen auf
/// zwei Seiten als ZWEI Verwendungen EINES Bausteins da — mit einem Satz
/// Fragen und einem Satz Antworten. Vorher waeren es zwei Bausteine gewesen,
/// die nur gleich aussehen.
/// </para>
///
/// <para>
/// <b>Wer was darf, entscheidet der Bereich</b> — nicht die Adresse. Das ist
/// die Dreiachsenregel an der Stelle, an der sie zaehlt: ein Baustein traegt
/// Daten, Daten liegen unter Schluesseln, und Schluessel sind Bereiche.
/// </para>
///
/// <para>
/// <b>Ein Baustein OHNE Bereich ist kein Fehler.</b> Ein Text traegt nichts
/// Versiegeltes; sein Inhalt steht offen, weil er auf einem Aushang steht. Fuer
/// ihn entscheidet die Seite, auf der er liegt. Die Unterscheidung steht in der
/// Zeile und nicht in einer Bedingung, die jemand richtig schreiben muss.
/// </para>
/// </summary>
public static class Module
{
    public const int MaxName = 200;

    /// <summary>Dieselbe Grenze wie fuer die Einstellung einer Seite (<see cref="Page"/>).</summary>
    private const int MaxConfig = 8000;

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/modules", ListAsync);
        app.MapPost("/workspace/module", CreateAsync);
        app.MapPost("/workspace/module/{id:guid}", UpdateAsync);
        app.MapDelete("/workspace/module/{id:guid}", RemoveAsync);
    }

    /* -- Was ich sehe --------------------------------------------------------- */

    /// <summary>
    /// Die Bausteine, die mich etwas angehen.
    ///
    /// <para>
    /// Zwei Quellen, und beide sind noetig: was in einem Bereich liegt, den ich
    /// lese — und was auf einer Adresse steht, die ich fuehre. Ohne die zweite
    /// waeren die bereichslosen Bausteine (Texte) fuer niemanden sichtbar;
    /// ohne die erste saehe ich einen Bogen nicht, dessen Seite ein anderer
    /// fuehrt, obwohl seine Antworten in MEINEM Bereich landen.
    /// </para>
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (mine.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new { modules = Array.Empty<object>() });
            return;
        }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT m.id, m.area_id, m.kind, m.name, m.config, m.created_at, m.for_kind,
                   a.name AS area_name,
                   m.closed_at, m.controller_name, m.controller_address, m.controller_email,

                   /* Auf wie vielen Seiten er steht — „nirgends" ist eine Auskunft. */
                   (SELECT COUNT(*) FROM app.slug_part p WHERE p.module_id = m.id) AS used,

                   /*
                       UND AUF WELCHEN.

                       Die Zahl allein genuegte nicht. Wo ein Bogen steht,
                       entscheidet, welche Seite sein Portal tragen darf
                       (`Form.ReadSelfSeatAsync`: die Seite mit dem Bogen,
                       eine darueber, eine darunter). Die Oberflaeche las das
                       bisher aus dem WEG, ueber den jemand hereinkam — und
                       wer denselben Baustein ueber die Bausteinliste
                       aufschlug, bekam gar keine Auswahl.

                       Eine Zeichenkette mit Zeilenumbruechen und kein JSON:
                       es sind Pfade, sie enthalten keine Zeilenumbrueche
                       (`ck_slug_path`), und der Aufrufer trennt sie in einer
                       Zeile.
                   */
                   /*
                       `FOR XML PATH` und nicht `STRING_AGG`: dieser Server
                       kennt das zweite nicht. Ein Pfad besteht aus
                       Kleinbuchstaben, Ziffern, Strichen und Schraegstrichen
                       (`ck_slug_path`) — da gibt es nichts zu entschaerfen,
                       und `.value()` macht ohnehin rueckgaengig, was der
                       Umweg ueber XML verschluesselt hat.
                   */
                   (SELECT s.path + CHAR(10)
                      FROM app.slug_part p
                      JOIN app.slug s ON s.id = p.slug_id
                     WHERE p.module_id = m.id
                     ORDER BY s.path
                     FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)') AS pages,

                   /* Und wie viel er traegt: ein Bogen mit Antworten laesst sich
                      nicht mehr beliebig umbauen. */
                   (SELECT COUNT(*) FROM app.slug_field f WHERE f.part_id = m.id) AS fields,
                   (SELECT COUNT(*) FROM app.registration g WHERE g.part_id = m.id) AS entries
            FROM app.module m
            LEFT JOIN app.area a ON a.id = m.area_id
            WHERE
                /* im Bereich, den ich lese */
                EXISTS (SELECT 1 FROM app.certificate c
                         WHERE c.scope_kind = N'area' AND c.scope_id = m.area_id
                           AND c.revoked_at IS NULL AND c.expires_at > @now
                           AND c.subject_role_id IN ({names}))
                OR
                /* oder auf einer Adresse, die ich fuehre */
                EXISTS (SELECT 1 FROM app.slug_part p
                         JOIN app.slug s ON s.id = p.slug_id
                        WHERE p.module_id = m.id
                          AND s.claimed_by_role_id IN ({names}))
            ORDER BY m.kind, m.name;
            """, connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        var modules = new List<object>();

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            modules.Add(new
            {
                moduleId = Ids.ToText(reader.GetGuid(0)),
                areaId = reader.IsDBNull(1) ? null : Ids.ToText(reader.GetGuid(1)),
                kind = reader.GetString(2),
                name = reader.GetString(3),
                config = reader.IsDBNull(4) ? null : reader.GetString(4),
                createdAt = reader.GetDateTimeOffset(5),

                /* Wovon er handelt — daran haengt, woran ein Platz haengt (0038). */
                forKind = reader.GetString(6),
                areaName = reader.IsDBNull(7) ? null : reader.GetString(7),

                /* Das Formular als Ganzes (0042): geschlossen? wer steht fuer die Daten? */
                closed = !reader.IsDBNull(8),
                controller = reader.IsDBNull(9) ? null : new
                {
                    name = reader.GetString(9),
                    address = reader.IsDBNull(10) ? null : reader.GetString(10),
                    email = reader.IsDBNull(11) ? null : reader.GetString(11)
                },

                usedOnPages = reader.GetInt32(12),

                /* Leer heisst: nirgends. Kein `null` nach draussen — eine
                   leere Liste ist dieselbe Auskunft ohne Sonderfall. */
                pages = reader.IsDBNull(13)
                    ? Array.Empty<string>()
                    : reader.GetString(13).Split((char)10, StringSplitOptions.RemoveEmptyEntries),
                fields = reader.GetInt32(14),
                entries = reader.GetInt32(15)
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { modules });
    }

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
        string ModuleId, string Kind, string Name, string? AreaId, string? Config,
        string? ForKind = null);

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

        var name = (body.Name ?? string.Empty).Trim();
        if (name.Length is 0 or > MaxName)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Nazwa: od 1 do {MaxName} znaków.");
            return;
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

        if (areaId is not null
            && !await Area.MayAsync(connection, who.Value.AccountId, areaId.Value,
                    Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("""
            INSERT INTO app.module (id, area_id, kind, name, config, created_at, for_kind)
            VALUES (@id, @area, @kind, @name, @config, @now, @for);
            """, connection);

        cmd.Parameters.AddWithValue("@id", moduleId);
        cmd.Parameters.AddWithValue("@area", (object?)areaId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@kind", kind);
        cmd.Parameters.AddWithValue("@name", name);
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

    /* -- Aendern ------------------------------------------------------------- */

    /// <summary>Eine Frage, unter dem Schluessel des NEUEN Bereichs versiegelt (0042).</summary>
    public sealed record ResealIn(
        string FieldId, string LabelSealed, string? HelpSealed, string? OptionsSealed, int LabelEpoch);

    /// <summary>Die Klausel: wer fuer die Daten steht. Ein leerer Name nimmt sie weg.</summary>
    public sealed record ControllerIn(string? Name, string? Address, string? Email);

    public sealed record UpdateRequest(
        string? Name, string? AreaId, bool ClearArea = false, string? Config = null,
        string? ForKind = null,

        /* 0042 — das Formular als Ganzes. */
        bool? Closed = null, ControllerIn? Controller = null, IReadOnlyList<ResealIn>? Reseal = null,

        /* 0043 — der Aufbau, unter dem Schluessel des neuen Bereichs. */
        string? DesignSealed = null, int? DesignEpoch = null);

    /// <summary>
    /// Umbenennen, den Bereich setzen, die Einstellung aendern.
    ///
    /// <para>
    /// <b>Den Bereich zu WECHSELN ist kein Umbenennen.</b> Was unter dem alten
    /// Schluessel liegt, bleibt darunter liegen — der Dienst kann es nicht
    /// umschluesseln, er hat keinen Schluessel. Deshalb ist es nur erlaubt,
    /// solange der Baustein nichts traegt: keine Felder, keine Einsendungen.
    /// Andernfalls stuende danach ein Bereich an einem Baustein, dessen Inhalt
    /// woanders liegt, und niemand saehe den Widerspruch.
    /// </para>
    /// </summary>
    private static async Task UpdateAsync(HttpContext ctx, Db db, Guid id, UpdateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await ReadAsync(connection, id, ctx.RequestAborted);
        if (found is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego modułu nie ma.");
            return;
        }

        if (!await MayTendAsync(ctx, db, connection, found.Value, who.Value.AccountId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego modułu nie prowadzisz.");
            return;
        }

        Guid? areaId = found.Value.AreaId;
        var moving = false;

        if (body.ClearArea)
        {
            /*
             * NICHT INS NICHTS. Wer einen Baustein pflegen darf, entscheidet
             * sein Bereich ODER die Seite, auf der er steht. Faellt der
             * Bereich weg, waehrend er nirgends steht, bliebe ein Ding uebrig,
             * das niemand mehr aendern und niemand mehr loeschen kann.
             *
             * Das ist kein hypothetischer Fall: er entsteht beim ersten
             * Versuch, einen frisch angelegten Baustein aus seinem Bereich zu
             * nehmen.
             */
            if (found.Value.Used == 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Ten moduł nie stoi na żadnej stronie — bez obszaru nikt nie mógłby go już tknąć. "
                    + "Najpierw postaw go gdzieś albo przenieś do innego obszaru.");
                return;
            }

            areaId = null;
            moving = found.Value.AreaId is not null;
        }
        else if (!string.IsNullOrWhiteSpace(body.AreaId))
        {
            if (!Guid.TryParse(body.AreaId, out var wanted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung obszaru.");
                return;
            }

            moving = wanted != found.Value.AreaId;
            areaId = wanted;

            if (moving && !await Area.MayAsync(connection, who.Value.AccountId, wanted,
                    Capability.Write, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
                return;
            }
        }

        /*
         * UMZIEHEN MIT NEU VERSIEGELTEN FRAGEN (0042).
         *
         * Der Dienst kann nichts umschluesseln — der Browser aber schon: er
         * hat den alten Schluessel und den neuen, oeffnet jede Frage und
         * versiegelt sie neu. Kommen ALLE Fragen mit, ist der Umzug erlaubt;
         * die ANTWORTEN bleiben ohnehin, wo sie sind — sie gehoeren dem
         * Bereich ihrer Frage, nicht dem des Formulars.
         *
         * Ins Nichts nicht: ohne Bereich haette eine Frage keinen Schluessel,
         * unter dem sie liegen koennte.
         */
        var resealed = new Dictionary<Guid, (byte[] Label, byte[]? Help, byte[]? Options, int Epoch)>();

        /*
         * DER AUFBAU ZIEHT MIT (0043). Er liegt unter demselben Schluessel wie
         * die Fragen; ohne neue Huelle bliebe er unter dem alten, und das
         * Formular zeigte seine Fragen, aber nicht mehr seine Ordnung.
         */
        var hasDesign = false;
        await using (var look = new SqlCommand("SELECT 1 FROM app.form_design WHERE module_id = @id;", connection))
        {
            look.Parameters.AddWithValue("@id", id);
            hasDesign = await look.ExecuteScalarAsync(ctx.RequestAborted) is not null;
        }

        byte[]? designSealed = null;

        if (moving && hasDesign)
        {
            if (areaId is null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Formularz z układem potrzebuje obszaru — układ jest zapieczętowany jego kluczem.");
                return;
            }

            try { designSealed = Base64Url.Decode(body.DesignSealed ?? string.Empty); }
            catch (FormatException) { designSealed = null; }

            if (designSealed is null || designSealed.Length == 0 || body.DesignEpoch is null or < 1)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Żeby zmienić obszar, trzeba przepieczętować też układ formularza — odśwież i spróbuj jeszcze raz.");
                return;
            }
        }

        if (moving && found.Value.Fields > 0)
        {
            if (areaId is null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Formularz z pytaniami potrzebuje obszaru — pytania są zapieczętowane jego kluczem.");
                return;
            }

            foreach (var one in body.Reseal ?? [])
            {
                if (!Guid.TryParse(one.FieldId, out var fieldId) || one.LabelEpoch < 1)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne pytanie do przepieczętowania.");
                    return;
                }

                try
                {
                    var label = Base64Url.Decode(one.LabelSealed ?? string.Empty);
                    if (label.Length == 0) throw new FormatException();

                    resealed[fieldId] = (label,
                        string.IsNullOrWhiteSpace(one.HelpSealed) ? null : Base64Url.Decode(one.HelpSealed),
                        string.IsNullOrWhiteSpace(one.OptionsSealed) ? null : Base64Url.Decode(one.OptionsSealed),
                        one.LabelEpoch);
                }
                catch (FormatException)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne pytanie do przepieczętowania.");
                    return;
                }
            }

            var all = new HashSet<Guid>();
            await using (var ask = new SqlCommand("SELECT id FROM app.slug_field WHERE part_id = @id;", connection))
            {
                ask.Parameters.AddWithValue("@id", id);
                await using var reader = await ask.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted)) all.Add(reader.GetGuid(0));
            }

            if (!all.SetEquals(resealed.Keys))
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Żeby zmienić obszar, trzeba przepieczętować wszystkie pytania — odśwież i spróbuj jeszcze raz.");
                return;
            }
        }

        /*
         * WOVON ER HANDELT, steht fest, sobald etwas eingegangen ist (0038).
         *
         * An `for_kind` haengt, woran der Platz einer Einsendung haengt: an
         * einem Menschen, an einer Gruppe, an einem Amt. Waere das im
         * Nachhinein umstellbar, stuenden vorhandene Plaetze an einer Aussage,
         * die zu ihrer Entstehung niemand getroffen hat — und niemand saehe es
         * ihnen an. Solange nichts eingegangen ist, ist es eine Einstellung wie
         * jede andere.
         */
        var forKind = (body.ForKind ?? found.Value.ForKind).Trim().ToLowerInvariant();

        if (Array.IndexOf(Subjects, forKind) < 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Moduł dotyczy: none, person, group albo role.");
            return;
        }

        if (forKind != found.Value.ForKind && found.Value.Entries > 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ten moduł ma już zgłoszenia — tego, kogo dotyczy, nie da się już zmienić.");
            return;
        }

        var name = (body.Name ?? found.Value.Name).Trim();
        if (name.Length is 0 or > MaxName)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Nazwa: od 1 do {MaxName} znaków.");
            return;
        }

        if ((body.Config?.Length ?? 0) > MaxConfig)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Ustawienia: najwyżej {MaxConfig} znaków.");
            return;
        }

        /*
         * DIE KLAUSEL (0042) — Klartext, und das muss sie sein: sie steht unter
         * dem Formular, bevor jemand etwas eingetragen hat.
         */
        string? controllerName = null, controllerAddress = null, controllerEmail = null;
        var touchController = body.Controller is not null;

        if (body.Controller is { } said)
        {
            controllerName = string.IsNullOrWhiteSpace(said.Name) ? null : said.Name.Trim();
            controllerAddress = string.IsNullOrWhiteSpace(said.Address) ? null : said.Address.Trim();
            controllerEmail = string.IsNullOrWhiteSpace(said.Email) ? null : said.Email.Trim();

            if (controllerName is { Length: > 200 } || controllerAddress is { Length: > 400 }
                || controllerEmail is { Length: > 200 })
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Klauzula: nazwa do 200, adres do 400, e-mail do 200 znaków.");
                return;
            }

            if (controllerName is null && (controllerAddress is not null || controllerEmail is not null))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Klauzula potrzebuje nazwy tego, kto odpowiada za dane.");
                return;
            }
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var cmd = new SqlCommand("""
                UPDATE app.module
                   SET name = @name,
                       area_id = @area,
                       for_kind = @for,
                       config = CASE WHEN @config IS NULL THEN config ELSE @config END,
                       closed_at = CASE WHEN @closed IS NULL THEN closed_at
                                        WHEN @closed = 1 THEN COALESCE(closed_at, @now)
                                        ELSE NULL END,
                       controller_name    = CASE WHEN @touch = 1 THEN @cName ELSE controller_name END,
                       controller_address = CASE WHEN @touch = 1 THEN @cAddress ELSE controller_address END,
                       controller_email   = CASE WHEN @touch = 1 THEN @cEmail ELSE controller_email END
                 WHERE id = @id;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@name", name);
                cmd.Parameters.AddWithValue("@for", forKind);
                cmd.Parameters.AddWithValue("@area", (object?)areaId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@config", (object?)body.Config ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@closed", body.Closed is null ? DBNull.Value : body.Closed.Value);
                cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                cmd.Parameters.AddWithValue("@touch", touchController ? 1 : 0);
                cmd.Parameters.AddWithValue("@cName", (object?)controllerName ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@cAddress", (object?)controllerAddress ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@cEmail", (object?)controllerEmail ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@id", id);

                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            if (designSealed is not null)
            {
                await using var design = new SqlCommand("""
                    UPDATE app.form_design SET area_id = @area, epoch = @epoch, sealed = @sealed, updated_at = @now
                     WHERE module_id = @id;
                    """, connection, tx);
                design.Parameters.AddWithValue("@area", areaId!.Value);
                design.Parameters.AddWithValue("@epoch", body.DesignEpoch!.Value);
                design.Parameters.AddWithValue("@sealed", designSealed);
                design.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                design.Parameters.AddWithValue("@id", id);
                await design.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var (fieldId, (label, help, options, epoch)) in resealed)
            {
                await using var seal = new SqlCommand("""
                    UPDATE app.slug_field
                       SET label_sealed = @label, help_sealed = @help, options_sealed = @options,
                           label_area_id = @area, label_epoch = @epoch
                     WHERE id = @field AND part_id = @id;
                    """, connection, tx);
                seal.Parameters.AddWithValue("@label", label);
                seal.Parameters.AddBlob("@help", help);
                seal.Parameters.AddBlob("@options", options);
                seal.Parameters.AddWithValue("@area", areaId!.Value);
                seal.Parameters.AddWithValue("@epoch", epoch);
                seal.Parameters.AddWithValue("@field", fieldId);
                seal.Parameters.AddWithValue("@id", id);
                await seal.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            moduleId = Ids.ToText(id),
            areaId = areaId is null ? null : Ids.ToText(areaId.Value),
            name,
            forKind
        });
    }

    /* -- Entfernen ----------------------------------------------------------- */

    /// <summary>
    /// Einen Baustein loeschen.
    ///
    /// <para>
    /// <b>Nicht, solange er irgendwo steht</b> — sonst verschwaende eine Seite
    /// mitten im Betrieb einen Kasten, und niemand wuesste warum. Und nicht,
    /// solange er Einsendungen traegt: die gehoeren den Menschen, die sie
    /// geschickt haben.
    /// </para>
    /// </summary>
    private static async Task RemoveAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await ReadAsync(connection, id, ctx.RequestAborted);
        if (found is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego modułu nie ma.");
            return;
        }

        if (!await MayTendAsync(ctx, db, connection, found.Value, who.Value.AccountId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego modułu nie prowadzisz.");
            return;
        }

        if (found.Value.Used > 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"Ten moduł stoi jeszcze na {found.Value.Used} stronach — najpierw go stamtąd zdejmij.");
            return;
        }

        if (found.Value.Entries > 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ten moduł ma zgłoszenia — one należą do tych, którzy je wysłali.");
            return;
        }

        await using var cmd = new SqlCommand("""
            DELETE FROM app.slug_field WHERE part_id = @id;
            DELETE FROM app.form_design WHERE module_id = @id;
            DELETE FROM app.module WHERE id = @id;
            """, connection);

        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { moduleId = Ids.ToText(id), removed = true });
    }

    /* -- Gemeinsames --------------------------------------------------------- */

    internal readonly record struct Row(
        Guid Id, Guid? AreaId, string Kind, string Name, string ForKind,
        int Used, int Fields, int Entries);

    internal static async Task<Row?> ReadAsync(
        SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT m.id, m.area_id, m.kind, m.name, m.for_kind,
                   (SELECT COUNT(*) FROM app.slug_part p WHERE p.module_id = m.id),
                   (SELECT COUNT(*) FROM app.slug_field f WHERE f.part_id = m.id),
                   (SELECT COUNT(*) FROM app.registration g WHERE g.part_id = m.id)
            FROM app.module m WHERE m.id = @id;
            """, connection);

        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new Row(
            reader.GetGuid(0),
            reader.IsDBNull(1) ? null : reader.GetGuid(1),
            reader.GetString(2), reader.GetString(3), reader.GetString(4),
            reader.GetInt32(5), reader.GetInt32(6), reader.GetInt32(7));
    }

    /// <summary>
    /// Wer einen Baustein pflegen darf.
    ///
    /// <para>
    /// <b>Mit Bereich entscheidet der Bereich</b> — dort liegen seine Daten.
    /// <b>Ohne Bereich entscheidet die Seite</b>, auf der er steht: ein Text
    /// gehoert dem Aushang, auf dem er haengt. Steht er nirgends und hat keinen
    /// Bereich, kann ihn niemand pflegen — das ist kein Zustand, der entsteht,
    /// ausser jemand nimmt ihn gerade von der letzten Seite.
    /// </para>
    /// </summary>
    private static async Task<bool> MayTendAsync(
        HttpContext ctx, Db db, SqlConnection connection, Row row, Guid accountId)
    {
        if (row.AreaId is not null)
        {
            return await Area.MayAsync(connection, accountId, row.AreaId.Value,
                Capability.Write, ctx.RequestAborted);
        }

        var mine = await Workspace.RolesOfAsync(connection, accountId, ctx.RequestAborted);
        if (mine.Count == 0) return false;

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT TOP 1 1 FROM app.slug_part p
            JOIN app.slug s ON s.id = p.slug_id
            WHERE p.module_id = @id AND s.claimed_by_role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@id", row.Id);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        return await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not null;
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
