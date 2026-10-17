using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Zweite Wege zu einer Adresse: Aliase und eigene Domains.</summary>
public static partial class Slug
{
    /* -- Zweite Wege zu einer Adresse, die man führt ------------------------- */

    public sealed record AliasRequest(string Path, string Target, string RoleId);

    /// <summary>
    /// Einen Alias erklären — aus dem Browser.
    ///
    /// <para>
    /// <b>Warum das hier erlaubt ist, obwohl das Register am Server gefüllt
    /// wird.</b> Ein Eintrag mit Code IST die Erlaubnis, eine Adresse zu
    /// übernehmen — und genau die entsteht hier nicht: die Zeile trägt keinen
    /// Code und ist von Anfang an vergeben, an eine Rolle, die das ZIEL schon
    /// führt. Wer sie anlegt, bekommt nichts, was er nicht schon hatte.
    /// </para>
    ///
    /// <para>
    /// <b>Der Alias liegt im eigenen Haus.</b> Er entsteht unter einer Wurzel,
    /// die derselbe Mensch führt — nie als neues Wort auf oberster Ebene. Sonst
    /// wäre das hier der Weg, sich <c>recreatio.pl/&lt;wort&gt;</c> zu nehmen,
    /// und der oberste Namensraum gehört nicht dem, der zuerst tippt.
    /// </para>
    /// </summary>
    private static async Task AliasAsync(HttpContext ctx, Db db, AliasRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var path = Normalise(body.Path);
        var target = Normalise(body.Target);

        if (!IsWellFormed(path) || IsReserved(path) || !IsWellFormed(target))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Adres: małe litery, cyfry i myślniki; części oddziel ukośnikiem.");
            return;
        }

        if (path == target)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Alias nie może wskazywać na siebie.");
            return;
        }

        /*
         * Ein Alias auf oberster Ebene wäre ein neues Wort im gemeinsamen
         * Namensraum. Das vergibt der Server mit einem Code, nicht dieser Ruf.
         */
        if (!path.Contains('/'))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Alias zakładasz pod adresem, który już prowadzisz — nazwy najwyższego poziomu wydaje serwer.");
            return;
        }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rola.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

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

        /*
         * Das Ziel muss es geben und selbst kein Alias sein. Eine Kette liesse
         * sich im Kreis legen, und wer sie aufruft, liefe ihn mit.
         */
        await using (var find = new SqlCommand(
            "SELECT alias_of FROM app.slug WHERE path = @p;", connection))
        {
            find.Parameters.AddWithValue("@p", target);
            var found = await find.ExecuteScalarAsync(ctx.RequestAborted);

            if (found is null)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
                return;
            }

            if (found is not DBNull)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "To jest już alias. Łańcuchów nie ma — wskaż adres, na którym leży treść.");
                return;
            }
        }

        // Am ZIEL: nur wer es weitergeben darf, darf einen zweiten Weg dorthin
        // legen. Und am ELTERNPFAD: dort entsteht die neue Zeile.
        var onTarget = await Access.OfAsync(connection, who.Value.AccountId, target, ctx.RequestAborted);
        if (!onTarget.MayCertify)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
        }

        var parent = string.Join('/', path.Split('/')[..^1]);
        var onParent = await Access.OfAsync(connection, who.Value.AccountId, parent, ctx.RequestAborted);

        if (!onParent.MayCertify)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                $"Nie prowadzisz adresu „{Show(parent)}”, więc nie założysz tam aliasu.");
            return;
        }

        var now = DateTimeOffset.UtcNow;

        await using var insert = new SqlCommand("""
            INSERT INTO app.slug
                (id, path, claim_code_sha256, alias_of, claimed_by_role_id, claimed_by_account_id,
                 claimed_at, created_at)
            VALUES (@id, @path, NULL, @alias, @role, @account, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", Ids.NewId());
        insert.Parameters.AddWithValue("@path", path);
        insert.Parameters.AddWithValue("@alias", target);
        insert.Parameters.AddWithValue("@role", roleId);
        insert.Parameters.AddWithValue("@account", who.Value.AccountId);
        insert.Parameters.AddWithValue("@now", now);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten adres już istnieje.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            path,
            aliasOf = target,
            roleId = Ids.ToText(roleId),
            claimedAt = now
        });
    }

    public sealed record DomainRequest(string Path, string? Host);

    /// <summary>
    /// Eine eigene Domain an eine Adresse hängen, die man führt — oder sie
    /// abnehmen (<c>Host</c> leer).
    ///
    /// <para>
    /// <b>Das ist Betrieb und kein Recht.</b> Der Name gibt niemandem Zugang; er
    /// zeigt einen zweiten Weg auf eine Seite, die ohnehin öffentlich ist. Was
    /// fehlt, steht nicht in der Datenbank: DNS, die Oberfläche unter diesem
    /// Namen, und der Name in <c>Api:Origins</c>. Die Oberfläche sagt es.
    /// </para>
    ///
    /// <para>
    /// <b>Ein Name gehört genau einer Adresse.</b> Sonst entschiede die
    /// Reihenfolge der Zeilen, welche Seite er zeigt — deshalb der eindeutige
    /// Index (0016) und hier die klare Antwort darauf.
    /// </para>
    /// </summary>
    private static async Task DomainAsync(HttpContext ctx, Db db, DomainRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var path = Normalise(body.Path);

        if (!IsWellFormed(path))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        var host = (body.Host ?? string.Empty).Trim().ToLowerInvariant();
        var clear = host.Length == 0 || host == "-";

        if (!clear && !IsHostName(host))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "To nie jest nazwa domeny: małe litery, z kropką, bez http:// i bez ścieżki.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);

        if (grip.OwnerRoleId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nikt jeszcze nie przejął.");
            return;
        }

        if (!grip.MayCertify)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
        }

        await using var cmd = new SqlCommand(
            "UPDATE app.slug SET host = @host WHERE path = @path;", connection);

        cmd.Parameters.AddWithValue("@host", clear ? DBNull.Value : host);
        cmd.Parameters.AddWithValue("@path", path);

        try
        {
            if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
                return;
            }
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta domena wskazuje już inny adres.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { path, host = clear ? null : host });
    }
}
