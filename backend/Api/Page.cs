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
    }

    public sealed record SaveRequest(string Title, string? Lead);

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
        await using var cmd = new SqlCommand("""
            SELECT s.claimed_by_role_id, p.title, p.lead, p.updated_at
            FROM app.slug s
            LEFT JOIN app.slug_page p ON p.slug_id = s.id
            WHERE s.path = @path;
            """, connection);

        cmd.Parameters.AddWithValue("@path", wanted);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);

        if (!await reader.ReadAsync(ctx.RequestAborted) || reader.IsDBNull(0))
        {
            /*
             * Eine Adresse, die niemand führt, ist keine Seite — und eine, die
             * gar nicht im Register steht, auch nicht. Dieselbe Antwort für
             * beides: der Unterschied verriete, welche Adressen noch zu haben
             * sind, bevor sie jemand hat.
             */
            await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma jeszcze strony.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            path = wanted,
            title = reader.IsDBNull(1) ? null : reader.GetString(1),
            lead = reader.IsDBNull(2) ? null : reader.GetString(2),
            updatedAt = reader.IsDBNull(3) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(3)
        });
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
         * Wer ist hier verantwortlich? Die Adresse selbst, wenn sie übernommen
         * wurde — sonst die nächsthöhere. Dieselbe Frage wie beim Übernehmen,
         * dieselbe Antwort, dieselbe Stelle im Quelltext.
         */
        var paths = new List<string> { wanted };
        paths.AddRange(Slug.Ancestors(wanted));

        var responsible = await Slug.LongestClaimedAsync(connection, paths, ctx.RequestAborted);
        if (responsible is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nikt jeszcze nie przejął.");
            return;
        }

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == responsible.Value.RoleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzi żadna z Twoich ról.");
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
        save.Parameters.AddWithValue("@role", responsible.Value.RoleId);

        await save.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, title, lead, updatedAt = now });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
