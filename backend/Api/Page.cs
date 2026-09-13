using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Was unter einer Adresse steht.
///
/// <para>
/// <b>Öffentlich im Wortsinn.</b> Das Anzeigen verlangt keine Sitzung, keinen
/// Keks und keinen Schlüssel — eine Seite, die man erst nach dem Anmelden
/// sieht, ist keine Seite, sondern eine Ansicht. Deshalb liegen Überschrift und
/// Vorspann im Klartext; sie zu versiegeln hiesse, sie genau dem
/// vorzuenthalten, für den sie geschrieben sind.
/// </para>
///
/// <para>
/// <b>Schreiben darf, wer die Adresse führt</b> — oder die nächsthöhere. Wer
/// <c>parish</c> hält, schreibt auch auf <c>parish/aktualnosci</c>; das ist
/// dieselbe Regel wie beim Übernehmen (<see cref="Slug"/>) und steht deshalb
/// auch an derselben Stelle.
/// </para>
/// </summary>
public static class Page
{
    public const int MaxTitle = 200;
    public const int MaxLead = 4000;

    public static void Map(WebApplication app)
    {
        // `{*path}` fängt auch die Teile nach dem Schrägstrich: `parish/proby`
        // ist EINE Adresse und nicht eine Adresse mit einem Anhängsel.
        app.MapGet("/page/{*path}", ShowAsync);
        app.MapPut("/workspace/page/{*path}", SaveAsync);

        /*
         * Der Pfad reist im Rumpf und nicht in der Route: ein Fangmuster
         * (`{*path}`) muss am Ende stehen, und hinter dem Pfad stünde hier noch
         * etwas.
         */
        app.MapPut("/workspace/parts", SavePartsAsync);
    }

    public sealed record SaveRequest(string Title, string? Lead);

    /// <summary>Ein Baustein, wie ihn die Oberfläche schickt.</summary>
    public sealed record PartInput(string Id, string Kind, string Layout, string? Config);

    public sealed record PartsRequest(string Path, IReadOnlyList<PartInput> Parts);

    /// <summary>So viele Bausteine trägt keine Seite — und wer es versucht, meint es nicht gut.</summary>
    public const int MaxParts = 60;
    public const int MaxLayout = 2000;
    public const int MaxConfig = 8000;

    /* -- Zeigen ------------------------------------------------------------- */

    private static async Task ShowAsync(HttpContext ctx, Db db, string path)
    {
        var wanted = Slug.Normalise(path);

        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma strony.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid slugId;
        string? title = null, lead = null;
        DateTimeOffset? updatedAt = null;

        await using (var cmd = new SqlCommand("""
            SELECT s.id, s.claimed_by_role_id, p.title, p.lead, p.updated_at
            FROM app.slug s
            LEFT JOIN app.slug_page p ON p.slug_id = s.id
            WHERE s.path = @path;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@path", wanted);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);

            if (!await reader.ReadAsync(ctx.RequestAborted) || reader.IsDBNull(1))
            {
                /*
                 * Eine Adresse, die niemand führt, ist keine Seite — und eine,
                 * die gar nicht im Register steht, auch nicht. Dieselbe Antwort
                 * für beides: der Unterschied verriete, welche Adressen noch zu
                 * haben sind, bevor sie jemand hat.
                 */
                await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma jeszcze strony.");
                return;
            }

            slugId = reader.GetGuid(0);
            title = reader.IsDBNull(2) ? null : reader.GetString(2);
            lead = reader.IsDBNull(3) ? null : reader.GetString(3);
            updatedAt = reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4);
        }

        /*
         * Die Bausteine gehen MIT der Seite hinaus, nicht auf einen zweiten
         * Ruf. Ein Besucher, der erst die Seite und dann ihren Inhalt holt,
         * sieht dazwischen eine leere Seite — und wer sie in dem Augenblick
         * wegklickt, kommt nicht wieder.
         */
        var parts = new List<object>();

        await using (var cmd = new SqlCommand("""
            SELECT id, kind, layout, config
            FROM app.slug_part
            WHERE slug_id = @slug
            ORDER BY position;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@slug", slugId);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                parts.Add(new
                {
                    id = Ids.ToText(reader.GetGuid(0)),
                    kind = reader.GetString(1),
                    layout = reader.GetString(2),
                    config = reader.IsDBNull(3) ? null : reader.GetString(3)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, title, lead, updatedAt, parts });
    }

    /* -- Schreiben ---------------------------------------------------------- */

    private static async Task SaveAsync(HttpContext ctx, Db db, string path, SaveRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = Slug.Normalise(path);
        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        var title = (body.Title ?? string.Empty).Trim();
        if (title.Length is 0 or > MaxTitle)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Tytuł: od 1 do {MaxTitle} znaków.");
            return;
        }

        var lead = string.IsNullOrWhiteSpace(body.Lead) ? null : body.Lead.Trim();
        if (lead is not null && lead.Length > MaxLead)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Tekst: najwyżej {MaxLead} znaków.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * Wer darf hier schreiben? Zwei Wege, und beide beantwortet
         * <see cref="Access"/>: eine meiner Rollen FÜHRT die Adresse (oder die
         * nächsthöhere), oder eine meiner Rollen hält ein Zertifikat darauf.
         *
         * Die Frage hier noch einmal zu beantworten hiesse, zwei Rechteprüfungen
         * zu haben — und eine davon liefe irgendwann anders.
         */
        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);

        if (grip.OwnerRoleId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nikt jeszcze nie przejął.");
            return;
        }

        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tego adresu nie prowadzi żadna z Twoich ról i nie masz do niego prawa zapisu.");
            return;
        }

        Guid slugId;
        await using (var find = new SqlCommand("SELECT id FROM app.slug WHERE path = @path;", connection))
        {
            find.Parameters.AddWithValue("@path", wanted);

            // Eine Seite hängt an einer Zeile des Registers. Ein Unterpfad, den
            // niemand geöffnet hat, ist keine Adresse — auch nicht für den, der
            // die Adresse darüber führt.
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
                return;
            }

            slugId = found;
        }

        var now = DateTimeOffset.UtcNow;

        await using var save = new SqlCommand("""
            UPDATE app.slug_page
            SET title = @title, lead = @lead, updated_at = @now, updated_by_role_id = @role
            WHERE slug_id = @id;

            IF @@ROWCOUNT = 0
            INSERT INTO app.slug_page (slug_id, title, lead, updated_at, updated_by_role_id)
            VALUES (@id, @title, @lead, @now, @role);
            """, connection);

        save.Parameters.AddWithValue("@id", slugId);
        save.Parameters.AddWithValue("@title", title);
        save.Parameters.AddWithValue("@lead", (object?)lead ?? DBNull.Value);
        save.Parameters.AddWithValue("@now", now);
        // Die Rolle, ÜBER DIE es galt — nicht die des Führenden. Wer über ein
        // Zertifikat schreibt, soll auch als der dastehen, der er war.
        save.Parameters.AddWithValue("@role", (object?)grip.ViaRoleId ?? grip.OwnerRoleId!.Value);

        await save.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, title, lead, updatedAt = now });
    }

    /* -- Die Bausteine setzen ----------------------------------------------- */

    /// <summary>
    /// Die ganze Anordnung auf einmal — löschen und neu schreiben, in EINER
    /// Transaktion.
    ///
    /// <para>
    /// <b>Warum nicht je Baustein ein Aufruf.</b> Wer im Editor zieht, schiebt
    /// und löscht, ändert nicht einen Baustein, sondern eine Anordnung: die
    /// Reihenfolge, die Rechtecke und der Bestand hängen zusammen. Fünf einzelne
    /// Aufrufe könnten zur Hälfte ankommen, und dann stünde eine Seite da, die
    /// so nie jemand gebaut hat.
    /// </para>
    ///
    /// <para>
    /// <b>Der Dienst liest den Inhalt nicht.</b> `layout` und `config` sind für
    /// ihn Zeichenketten mit einer Obergrenze. Was darin steht, versteht der
    /// Baustein — und die Anzeige ist duldsam gegenüber allem, was nicht passt
    /// (`modules.ts`). Eine Prüfung hier wäre ein zweiter Katalog, der dem
    /// ersten hinterherhinkt.
    /// </para>
    /// </summary>
    private static async Task SavePartsAsync(HttpContext ctx, Db db, PartsRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = Slug.Normalise(body.Path);
        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        var parts = body.Parts ?? [];
        if (parts.Count > MaxParts)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Najwyżej {MaxParts} modułów na stronie.");
            return;
        }

        var ids = new HashSet<Guid>();

        foreach (var part in parts)
        {
            if (!Guid.TryParse(part.Id, out var id) || !ids.Add(id))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Moduły muszą mieć różne kennungi.");
                return;
            }

            var kind = (part.Kind ?? string.Empty).Trim();
            if (kind.Length is 0 or > 40)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj modułu: od 1 do 40 znaków.");
                return;
            }

            if (string.IsNullOrWhiteSpace(part.Layout) || part.Layout.Length > MaxLayout)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Układ modułu jest pusty albo za długi.");
                return;
            }

            if (part.Config is not null && part.Config.Length > MaxConfig)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Treść modułu: najwyżej {MaxConfig} znaków.");
                return;
            }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);

        if (grip.OwnerRoleId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nikt jeszcze nie przejął.");
            return;
        }

        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tego adresu nie prowadzi żadna z Twoich ról i nie masz do niego prawa zapisu.");
            return;
        }

        Guid slugId;
        await using (var find = new SqlCommand("SELECT id FROM app.slug WHERE path = @path;", connection))
        {
            find.Parameters.AddWithValue("@path", wanted);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
                return;
            }
            slugId = found;
        }

        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        await using (var clear = new SqlCommand(
            "DELETE FROM app.slug_part WHERE slug_id = @slug;", connection, tx))
        {
            clear.Parameters.AddWithValue("@slug", slugId);
            await clear.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        for (var i = 0; i < parts.Count; i++)
        {
            await using var insert = new SqlCommand("""
                INSERT INTO app.slug_part (id, slug_id, kind, position, layout, config, created_at)
                VALUES (@id, @slug, @kind, @position, @layout, @config, @now);
                """, connection, tx);

            insert.Parameters.AddWithValue("@id", Guid.Parse(parts[i].Id));
            insert.Parameters.AddWithValue("@slug", slugId);
            insert.Parameters.AddWithValue("@kind", parts[i].Kind.Trim());
            insert.Parameters.AddWithValue("@position", i);
            insert.Parameters.AddWithValue("@layout", parts[i].Layout);
            insert.Parameters.AddWithValue("@config", (object?)parts[i].Config ?? DBNull.Value);
            insert.Parameters.AddWithValue("@now", now);

            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { path = wanted, parts = parts.Count });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
