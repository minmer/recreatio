using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Der Name einer Rozmowa und ihre Karte.</summary>
public static partial class Chat
{
    /* ======================================================================
       NAMEN UND VISITENKARTEN
       ====================================================================== */

    public sealed record NameRequest(string RoleId, string NameSealed, int Epoch, string ByRoleId);

    /// <summary>
    /// WIE JEMAND IN DIESEM BEREICH HEISST — versiegelt unter dessen Schluessel.
    /// Den eigenen Namen setzt man selbst; einen fremden setzt, wer im Bereich
    /// hineinlaesst (er weiss, wen er eben aufgenommen hat).
    /// </summary>
    private static async Task NameAsync(HttpContext ctx, Db db, Guid id, NameRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.RoleId, out var roleId) || !Guid.TryParse(body.ByRoleId, out var byRole))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        byte[] name;
        try { name = Base64Url.Decode(body.NameSealed ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna nazwa.");
            return;
        }

        if (name.Length is 0 or > MaxName)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nazwa jest pusta albo za długa.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        if (!mine.Contains(byRole))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nic nie ustawisz.");
            return;
        }

        /*
         * 0095 — IM BEREICH STEHT AUCH, WER ÜBER EINE ROLLE HEREINKOMMT: eine
         * Person, die „Rada" hält, schreibt in der Rozmowa der Rada — und ihr
         * Name soll dort lesbar sein, ohne dass sie selbst ein Zertifikat trägt.
         */
        var reach = (await Workspace.ClosureAsync(connection, [roleId], ctx.RequestAborted)).Select(r => r.Id).ToList();

        var own = roleId == byRole
            && (await HoldingAsync(connection, reach, id, Readers, ctx.RequestAborted)).Count > 0;
        var certifies = (await HoldingAsync(connection, [byRole], id, ["admin", "certify"], ctx.RequestAborted)).Contains(byRole);

        if (!own && !certifies)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Nazwę ustawia sama osoba albo ten, kto wpuszcza do obszaru.");
            return;
        }

        /* Nur fuer jemanden, der wirklich im Bereich steht — selbst oder über eine Rolle, die er hält. */
        if ((await HoldingAsync(connection, reach, id, [.. Readers, "certify"], ctx.RequestAborted)).Count == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tej roli nie ma w obszarze.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.area_member_name
               SET name_sealed = @name, epoch = @epoch, set_by_role_id = @by, updated_at = @now
             WHERE area_id = @area AND role_id = @role;
            IF @@ROWCOUNT = 0
                INSERT INTO app.area_member_name (area_id, role_id, name_sealed, epoch, set_by_role_id, updated_at)
                VALUES (@area, @role, @name, @epoch, @by, @now);
            """, connection);
        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@role", roleId);
        cmd.Parameters.AddWithValue("@name", name);
        cmd.Parameters.AddWithValue("@epoch", body.Epoch);
        cmd.Parameters.AddWithValue("@by", byRole);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), roleId = Ids.ToText(roleId), named = true });
    }

    /// <summary>Die Namen der Mitglieder eines Bereichs, versiegelt — fuer die Seite des Bereichs.</summary>
    private static async Task AreaNamesAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /* Die Namen liegen unter dem Schlüssel des Bereichs — wer ihn hält (auch ein Link), öffnet sie (`Caller`). */
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!await Area.MayAsync(connection, caller, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        var names = await NamesOfAsync(connection, [id], ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), names = names.TryGetValue(id, out var n) ? n : [] });
    }

    /// <summary>
    /// Die Visitenkarte einer Rolle: Art und oeffentlicher Schluessel. Mit
    /// Anmeldung; kein Konto (0040) — das nimmt nichts entgegen.
    /// </summary>
    private static async Task CardAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand(
            "SELECT kind, wrap_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted) || reader.GetString(0) == "account")
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma osoby ani roli o takim kodzie.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            roleId = Ids.ToText(id),
            kind = reader.GetString(0),
            wrapPublicKey = Base64Url.Encode((byte[])reader[1])
        });
    }
}
