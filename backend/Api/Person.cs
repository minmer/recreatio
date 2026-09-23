using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Die Angaben eines Menschen — und wie EINE davon herausgeht.
///
/// <para>
/// <b>Das Einzige auf dieser Plattform, was einem MENSCHEN gehoert und keinem
/// Bereich.</b> Vorname, Nachname, Telefon, Geburtstag, Anschrift, E-Mail
/// liegen an seiner Rolle, einzeln versiegelt unter seinem Rollenschluessel.
/// Keine Pfarrei, keine Schule und kein Verein besitzt sie; sie werden
/// FREIGEGEBEN, und zwar einzeln.
/// </para>
///
/// <code>
///   person_value     das Original, unter dem Schluessel des Menschen
///   person_release   eine Abschrift, unter dem Epochenschluessel EINES Bereichs
/// </code>
///
/// <para>
/// <b>Warum eine Abschrift und nicht ein Verweis.</b> Ein Verweis hiesse, dass
/// der Bereich beim Lesen an den Schluessel des Menschen muesste — dann waere
/// die Freigabe ein Versprechen und keine Massnahme. So bekommt jeder Empfaenger
/// seine eigene Huelle, und wer eine Telefonnummer bekommen soll, bekommt genau
/// die und nicht den Geburtstag dazu.
/// </para>
///
/// <para>
/// <b>Zuruecknehmen heisst: die Zeile faellt.</b> Was jemand gelesen hat, hat
/// er gelesen; das kann keine Datenbank rueckgaengig machen, und diese tut auch
/// nicht so. Was aufhoert, ist der Zugriff auf das, was danach kommt.
/// </para>
///
/// <para>
/// Dass man nur freigeben kann, was man hat, steht nicht hier, sondern im
/// Fremdschluessel auf <c>(role_id, field)</c> — eine Regel, die die Datenbank
/// haelt, ist eine, die kein Aufruf umgeht.
/// </para>
/// </summary>
public static class Person
{
    /// <summary>
    /// Dieselben sieben wie <c>ck_person_value_field</c>.
    ///
    /// <para>
    /// Sie stehen hier ein zweites Mal, damit ein Tippfehler eine Meldung
    /// ergibt und keine Nummer aus der Datenbank. Laufen sie auseinander,
    /// lehnt die Datenbank ab, was dieser Dienst durchgelassen hat — deshalb
    /// nennt der Kommentar die Gegenstelle.
    /// </para>
    /// </summary>
    private static readonly string[] Fields =
        ["given_name", "surname", "phone", "born", "address", "email", "nickname"];

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/person/{roleId:guid}/values", ValuesAsync);
        app.MapPost("/workspace/person/{roleId:guid}/value", SetAsync);
        app.MapPost("/workspace/person/{roleId:guid}/forget", ForgetAsync);

        app.MapPost("/workspace/person/{roleId:guid}/release", ReleaseAsync);
        app.MapPost("/workspace/person/{roleId:guid}/withdraw", WithdrawAsync);

        /*
         * Was ein BEREICH ueber Menschen bekommen hat. Die Gegenrichtung, und
         * sie liest nur, was ihr gegeben wurde — es gibt keinen Aufruf, der
         * vom Bereich aus in `person_value` hineinsieht.
         */
        app.MapGet("/workspace/area/{id:guid}/people", GivenAsync);
    }

    /* -- Die eigenen Angaben ------------------------------------------------ */

    private static async Task ValuesAsync(HttpContext ctx, Db db, Guid roleId)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MineAsync(ctx, connection, who.Value.AccountId, roleId)) return;

        var values = new List<object>();

        await using (var cmd = new SqlCommand(
            "SELECT field, value_sealed, updated_at FROM app.person_value WHERE role_id = @r ORDER BY field;",
            connection))
        {
            cmd.Parameters.AddWithValue("@r", roleId);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                values.Add(new
                {
                    field = reader.GetString(0),
                    @sealed = Base64Url.Encode((byte[])reader[1]),
                    updatedAt = reader.GetDateTimeOffset(2)
                });
            }
        }

        /*
         * WOHIN etwas gegangen ist, gehoert neben das, was dasteht. Eine
         * Oberflaeche, die die Angaben zeigt und die Freigaben woanders, laesst
         * die eine Frage offen, die der Mensch wirklich hat: wer hat meine
         * Telefonnummer?
         */
        var releases = new List<object>();

        await using (var cmd = new SqlCommand("""
            SELECT p.field, p.area_id, a.name, p.epoch, p.released_at
            FROM app.person_release p
            JOIN app.area a ON a.id = p.area_id
            WHERE p.role_id = @r
            ORDER BY a.name, p.field;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@r", roleId);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                releases.Add(new
                {
                    field = reader.GetString(0),
                    areaId = Ids.ToText(reader.GetGuid(1)),
                    areaName = reader.GetString(2),
                    epoch = reader.GetInt32(3),
                    releasedAt = reader.GetDateTimeOffset(4)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { roleId = Ids.ToText(roleId), values, releases });
    }

    public sealed record SetRequest(string Field, string Sealed);

    /// <summary>
    /// Eine Angabe setzen oder ersetzen.
    ///
    /// <para>
    /// <b>Der Dienst zieht die Abschriften nicht nach — er kann es nicht.</b>
    /// Eine Abschrift liegt unter dem Epochenschluessel eines Bereichs, und den
    /// hat er nicht. Was er kann, ist SAGEN, welche jetzt veraltet sind: die
    /// Antwort nennt jeden Bereich, der diese Angabe schon hat, samt Epoche.
    /// Neu versiegeln muss der Browser dessen, dem die Angabe gehoert.
    /// </para>
    ///
    /// <para>
    /// <b>Und er zieht sie nach, ohne zu fragen.</b> Wer seine Nummer aendert,
    /// meint seine Nummer — nicht „meine Nummer hier und die alte ueberall
    /// sonst". Die genannten Bereiche haben die Angabe bereits; sie zu
    /// berichtigen gibt nichts heraus, was sie nicht schon haetten. Was
    /// weiterhin niemand automatisch bekommt, ist eine Angabe, die er noch nie
    /// hatte — dafuer bleibt es bei <c>release</c>.
    /// </para>
    /// </summary>
    private static async Task SetAsync(HttpContext ctx, Db db, Guid roleId, SetRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var field = (body.Field ?? string.Empty).Trim().ToLowerInvariant();

        if (!Fields.Contains(field))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Pole: imię, nazwisko, telefon, data urodzenia, adres, e-mail albo przezwisko.");
            return;
        }

        byte[] blob;
        try { blob = Base64Url.Decode(body.Sealed ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna zapieczętowana treść.");
            return;
        }

        if (blob.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Puste pole nie jest zapieczętowane.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MineAsync(ctx, connection, who.Value.AccountId, roleId)) return;

        await using var cmd = new SqlCommand("""
            UPDATE app.person_value SET value_sealed = @blob, updated_at = @now
             WHERE role_id = @r AND field = @f;

            IF @@ROWCOUNT = 0
                INSERT INTO app.person_value (role_id, field, value_sealed, updated_at)
                VALUES (@r, @f, @blob, @now);
            """, connection);

        cmd.Parameters.AddWithValue("@r", roleId);
        cmd.Parameters.AddWithValue("@f", field);
        cmd.Parameters.AddWithValue("@blob", blob);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        /*
         * WO DIESE ANGABE SCHON LIEGT. Erst nach dem Schreiben gefragt: was
         * hier herauskommt, ist die Arbeitsliste fuer den Browser, und die
         * soll zu dem passen, was jetzt dasteht.
         *
         * Die laufende Epoche des Bereichs, nicht die der Abschrift — unter
         * einer abgeloesten Epoche neu zu versiegeln hiesse, die Berichtigung
         * dorthin zu legen, wo niemand mehr nachsieht.
         */
        var stale = new List<object>();

        await using (var ask = new SqlCommand("""
            SELECT r.area_id, a.name,
                   (SELECT MAX(e.epoch) FROM app.area_epoch e WHERE e.area_id = r.area_id)
            FROM app.person_release r
            JOIN app.area a ON a.id = r.area_id
            WHERE r.role_id = @r AND r.field = @f
            ORDER BY a.name;
            """, connection))
        {
            ask.Parameters.AddWithValue("@r", roleId);
            ask.Parameters.AddWithValue("@f", field);

            await using var reader = await ask.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                /* Ohne Epoche liesse sich nichts versiegeln; dann steht der
                   Bereich nicht auf der Liste, statt sie unbrauchbar zu machen. */
                if (reader.IsDBNull(2)) continue;

                stale.Add(new
                {
                    areaId = Ids.ToText(reader.GetGuid(0)),
                    areaName = reader.GetString(1),
                    epoch = reader.GetInt32(2)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            roleId = Ids.ToText(roleId), field, saved = true, stale
        });
    }

    public sealed record ForgetRequest(string Field);

    /// <summary>
    /// Eine Angabe loeschen — mitsamt ihren Freigaben.
    ///
    /// <para>
    /// Die Freigaben MUESSEN mit: der Fremdschluessel zeigt auf die Angabe, und
    /// eine Abschrift, deren Original nicht mehr besteht, waere eine, die
    /// niemand mehr zurueckziehen kann.
    /// </para>
    /// </summary>
    private static async Task ForgetAsync(HttpContext ctx, Db db, Guid roleId, ForgetRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var field = (body.Field ?? string.Empty).Trim().ToLowerInvariant();

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MineAsync(ctx, connection, who.Value.AccountId, roleId)) return;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            int withdrawn;

            await using (var drop = new SqlCommand(
                "DELETE FROM app.person_release WHERE role_id = @r AND field = @f;", connection, tx))
            {
                drop.Parameters.AddWithValue("@r", roleId);
                drop.Parameters.AddWithValue("@f", field);
                withdrawn = await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var drop = new SqlCommand(
                "DELETE FROM app.person_value WHERE role_id = @r AND field = @f;", connection, tx))
            {
                drop.Parameters.AddWithValue("@r", roleId);
                drop.Parameters.AddWithValue("@f", field);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { field, forgotten = true, withdrawn });
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    /* -- Freigeben ---------------------------------------------------------- */

    public sealed record ReleaseRequest(string Field, string AreaId, int Epoch, string Sealed);

    /// <summary>
    /// EINE Angabe an EINEN Bereich.
    ///
    /// <para>
    /// Der Browser hat sie unter dem Epochenschluessel dieses Bereichs neu
    /// versiegelt — er kennt ihn, weil er ihn oeffentlich holen konnte
    /// (<c>/area/{id}/key</c>) oder weil er ihn selbst haelt. Der Dienst legt
    /// die Huelle ab und kann sie nicht oeffnen.
    /// </para>
    ///
    /// <para>
    /// <b>Es wird NICHT geprueft, ob der Bereich darum gebeten hat.</b> Eine
    /// Freigabe ist eine Handlung des Menschen, keine Antwort auf eine
    /// Anforderung — und ein Bereich, der ungefragt etwas bekommt, hat nichts
    /// gewonnen, was er nicht ohnehin bekommen haette.
    /// </para>
    /// </summary>
    private static async Task ReleaseAsync(HttpContext ctx, Db db, Guid roleId, ReleaseRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var field = (body.Field ?? string.Empty).Trim().ToLowerInvariant();

        if (!Fields.Contains(field))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Takiego pola nie ma.");
            return;
        }

        if (!Guid.TryParse(body.AreaId, out var areaId) || body.Epoch < 1)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny obszar albo epoka.");
            return;
        }

        byte[] blob;
        try { blob = Base64Url.Decode(body.Sealed ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna zapieczętowana treść.");
            return;
        }

        if (blob.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Puste pole nie jest zapieczętowane.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MineAsync(ctx, connection, who.Value.AccountId, roleId)) return;

        await using var cmd = new SqlCommand("""
            UPDATE app.person_release
               SET epoch = @epoch, sealed_blob = @blob, released_at = @now
             WHERE role_id = @r AND field = @f AND area_id = @area;

            IF @@ROWCOUNT = 0
                INSERT INTO app.person_release (role_id, field, area_id, epoch, sealed_blob, released_at)
                VALUES (@r, @f, @area, @epoch, @blob, @now);
            """, connection);

        cmd.Parameters.AddWithValue("@r", roleId);
        cmd.Parameters.AddWithValue("@f", field);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@epoch", body.Epoch);
        cmd.Parameters.AddWithValue("@blob", blob);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number == 547)
        {
            /*
             * Der Fremdschluessel auf (role_id, field). Freigeben kann man nur,
             * was man hat — und das ist hier keine Meldung, sondern eine Regel
             * der Datenbank, die dieser Dienst gar nicht umgehen koennte.
             */
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Najpierw wpisz to pole u siebie — nie można udostępnić czegoś, czego nie masz.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            roleId = Ids.ToText(roleId),
            field,
            areaId = Ids.ToText(areaId),
            released = true
        });
    }

    public sealed record WithdrawRequest(string Field, string AreaId);

    private static async Task WithdrawAsync(HttpContext ctx, Db db, Guid roleId, WithdrawRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.AreaId, out var areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung obszaru.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MineAsync(ctx, connection, who.Value.AccountId, roleId)) return;

        await using var cmd = new SqlCommand(
            "DELETE FROM app.person_release WHERE role_id = @r AND field = @f AND area_id = @area;",
            connection);

        cmd.Parameters.AddWithValue("@r", roleId);
        cmd.Parameters.AddWithValue("@f", (body.Field ?? string.Empty).Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("@area", areaId);

        var gone = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) > 0;

        await ctx.Response.WriteAsJsonAsync(new
        {
            withdrawn = gone,

            /*
             * Ehrlich gesagt, und deshalb hier: was gelesen wurde, ist gelesen.
             * Eine Oberflaeche, die „zurueckgezogen" sagt und mehr verspricht,
             * als die Sache hergibt, waere die eigentliche Luege.
             */
            note = "Zapis usunięty. Co już odczytano, pozostaje odczytane."
        });
    }

    /* -- Was ein Bereich bekommen hat --------------------------------------- */

    private static async Task GivenAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("""
            SELECT role_id, field, epoch, sealed_blob, released_at
            FROM app.person_release
            WHERE area_id = @area
            ORDER BY role_id, field;
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);

        var given = new List<object>();

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            given.Add(new
            {
                roleId = Ids.ToText(reader.GetGuid(0)),
                field = reader.GetString(1),
                epoch = reader.GetInt32(2),
                @sealed = Base64Url.Encode((byte[])reader[3]),
                releasedAt = reader.GetDateTimeOffset(4)
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), given });
    }

    /* -- Gemeinsames -------------------------------------------------------- */

    /// <summary>
    /// Gehoert diese Rolle DIESEM Konto?
    ///
    /// <para>
    /// Die einzige Frage, die hier zaehlt. Ein Bereich, ein Zertifikat, eine
    /// Mitgliedschaft geben keinen Zugriff auf die Angaben eines Menschen —
    /// sie gehoeren ihm, nicht seiner Umgebung.
    /// </para>
    /// </summary>
    private static async Task<bool> MineAsync(
        HttpContext ctx, SqlConnection connection, Guid accountId, Guid roleId)
    {
        var mine = await Workspace.RolesOfAsync(connection, accountId, ctx.RequestAborted);
        if (mine.Any(r => r.Id == roleId)) return true;

        await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
        return false;
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
