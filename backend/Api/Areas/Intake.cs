using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Die Annahme — wie etwas von aussen hereinkommt, ohne dass der Dienst es liest.
///
/// <para>
/// Ein Formular sammelt von Fremden. Die Antwort muss dort landen, wo nur das
/// Amt sie oeffnet — und der Fremde hat kein Konto, keine Rolle und keinen
/// Schluessel.
/// </para>
///
/// <code>
///   1. Der Bereich hat ein RSA-Paar. Die oeffentliche Haelfte geht MIT dem
///      Formular hinaus — damit laesst sich verschliessen und nichts oeffnen.
///   2. Der Browser wuerfelt je Feld einen Schluessel, versiegelt damit den
///      Wert und verpackt den Schluessel unter der oeffentlichen Haelfte.
///   3. Der Dienst legt beides hin. Er kann nichts davon oeffnen.
///   4. Wer den Schluessel des AMTES hat, packt die private Haelfte aus, damit
///      den Feldschluessel, damit den Wert.
/// </code>
///
/// <para>
/// <b>Die private Haelfte liegt unter dem AMTSSCHLUESSEL, nicht unter einer
/// Epoche.</b> 0005 nannte den Grund, und er ist der wichtigste Satz dieser
/// Datei: lag sie unter dem Epochenschluessel des Bereichs, konnte jeder Helfer
/// saemtliche Anmeldungen lesen, ohne dass ihm jemand etwas gegeben haette. Es
/// folgte aus der Mitgliedschaft — und Mitgliedschaft ist keine Befugnis.
/// </para>
///
/// <para>
/// Ein Schnitt der Epoche macht die Annahme ausserdem nicht unbrauchbar: sie
/// haengt nicht daran.
/// </para>
/// </summary>
public static class Intake
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/area/{id:guid}/intake", CreateAsync);

        /*
         * Die private Haelfte — versiegelt, fuer das Amt. Sie geht nur an den
         * hinaus, der ohnehin am Bereich schreiben darf; oeffnen kann sie nur,
         * wer den Rollenschluessel hat, fuer den sie versiegelt wurde.
         */
        app.MapGet("/workspace/area/{id:guid}/intake", OfficeAsync);

        /* 0129 — wer fuer die Daten geradesteht, liegt jetzt bei Controllers (Datensatz, Fassungen, Unterschrift). */

        /*
         * Was ein Formular braucht, um sich zu verschliessen — OHNE Konto.
         *
         * Hier steht auch die Klausel: wer personenbezogene Daten erhebt, muss
         * sagen, WER sie verarbeitet und unter welcher Anschrift, und zwar
         * BEVOR jemand etwas eingegeben hat.
         */
        app.MapGet("/intake/{id:guid}", PublicAsync);
    }

    /* -- Anlegen ------------------------------------------------------------ */

    public sealed record CreateRequest(string PublicKey, string PrivateKeySealed, string RoleId);

    /// <summary>
    /// Das Annahmepaar anlegen — einmal je Bereich.
    ///
    /// <para>
    /// <b>Es wird nicht ersetzt.</b> Ein zweites Paar machte jede bisherige
    /// Einsendung unlesbar: ihre Feldschluessel sind unter der ALTEN
    /// oeffentlichen Haelfte verpackt, und die private dazu waere fort. Wer
    /// wechseln will, muss vorher alles Alte oeffnen — und das ist eine
    /// Entscheidung, keine Nebenwirkung eines zweiten Klicks.
    /// </para>
    /// </summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, Guid id, CreateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung roli.");
            return;
        }

        byte[] publicKey, privateSealed;
        try
        {
            publicKey = Base64Url.Decode(body.PublicKey ?? string.Empty);
            privateSealed = Base64Url.Decode(body.PrivateKeySealed ?? string.Empty);
        }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
            return;
        }

        if (publicKey.Length == 0 || privateSealed.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brakuje klucza.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * `admin` und nicht `write`: wer die Annahme einrichtet, entscheidet,
         * WER kuenftig die Einsendungen lesen kann. Das ist mehr, als einen
         * Termin einzutragen.
         */
        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == roleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
            return;
        }

        // Dem Konto wird nichts gegeben (0040) — nur Personen und Rollen darunter.
        if (Workspace.IsAccount(mine, roleId))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, Workspace.AccountTakesNothing);
            return;
        }

        await using var insert = new SqlCommand("""
            IF EXISTS (SELECT 1 FROM app.intake WHERE area_id = @area)
                THROW 50001, 'intake exists', 1;

            INSERT INTO app.intake (area_id, public_key, private_key_sealed, sealed_for_role_id, created_at)
            VALUES (@area, @public, @private, @role, @now);
            """, connection);

        insert.Parameters.AddWithValue("@area", id);
        insert.Parameters.AddWithValue("@public", publicKey);
        insert.Parameters.AddWithValue("@private", privateSealed);
        insert.Parameters.AddWithValue("@role", roleId);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number == 50001 || e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ten obszar ma już klucz przyjmowania. Wymiana unieważniłaby wszystkie dotychczasowe zgłoszenia.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            sealedForRoleId = Ids.ToText(roleId)
        });
    }

    /* -- Fuer das Amt ------------------------------------------------------- */

    private static async Task OfficeAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using var cmd = new SqlCommand(
            "SELECT public_key, private_key_sealed, sealed_for_role_id FROM app.intake WHERE area_id = @area;",
            connection);

        cmd.Parameters.AddWithValue("@area", id);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);

        if (!await reader.ReadAsync(ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Ten obszar nie przyjmuje zgłoszeń.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            publicKey = Base64Url.Encode((byte[])reader[0]),

            /*
             * Versiegelt. Wer `read` hat, bekommt die Huelle zu sehen; oeffnen
             * kann sie nur, wer den Schluessel der genannten Rolle haelt. Das
             * ist der Unterschied zwischen „darf" und „kann" (0001), und er ist
             * hier beabsichtigt.
             */
            privateKeySealed = Base64Url.Encode((byte[])reader[1]),
            sealedForRoleId = Ids.ToText(reader.GetGuid(2))
        });
    }

    /* -- Fuer das Formular -------------------------------------------------- */

    /// <summary>
    /// Was der Browser braucht, um eine Einsendung zu verschliessen — ohne Konto.
    ///
    /// <para>
    /// Der oeffentliche Annahmeschluessel ist kein Geheimnis: mit ihm laesst
    /// sich VERSCHLIESSEN und nichts oeffnen. Er darf deshalb ohne Konto
    /// hinausgehen, und er muss es auch — sonst koennte sich niemand von aussen
    /// anmelden.
    /// </para>
    /// </summary>
    private static async Task PublicAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var publicKey = await PublicKeyAsync(connection, id, ctx.RequestAborted);
        if (publicKey is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tu nic się nie przyjmuje.");
            return;
        }

        /* 0129 — was für den Bereich GILT (sein Datensatz oder der eines Bereichs darüber), nicht nur eine eigene Zeile. */
        var controller = await Controllers.OfAreaAsync(connection, id, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            publicKey = Base64Url.Encode(publicKey),

            /*
             * `null` heisst: niemand ist benannt. Die Oberflaeche muss das
             * sehen und das Formular sperren — ein Formular ohne Klausel darf
             * keine personenbezogenen Daten sammeln, und ein erfundener Name
             * waere schlimmer als gar keiner.
             */
            controller = Controllers.Json(controller)
        });
    }

    /* -- Gemeinsames -------------------------------------------------------- */

    /// <summary>Die oeffentliche Haelfte eines Bereichs — fuer <see cref="Form"/>.</summary>
    internal static async Task<byte[]?> PublicKeyAsync(
        SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT public_key FROM app.intake WHERE area_id = @area;", connection);

        cmd.Parameters.AddWithValue("@area", areaId);
        return await cmd.ExecuteScalarAsync(ct) as byte[];
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
