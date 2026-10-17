using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Wer an einer Adresse was darf — und wie man darunter eine Seite öffnet.
///
/// <para>
/// <b>Ein Weg zu einem Recht:</b> eine meiner Rollen FÜHRT die Adresse (oder
/// die nächsthöhere). Diese eine Stelle beantwortet die Frage für alle, die sie
/// stellen. Wer eine Seite mit Zugang führt, bindet sie an Bereiche
/// (<c>slug_area</c>, 0051) — wer einen davon liest, sieht sie.
/// </para>
///
/// <para>
/// <b>Vererbt wird nach unten.</b> Wer <c>parish</c> führt, führt auch
/// <c>parish/aktualnosci</c>: die Unterseite ist Teil dessen, was er führt.
/// Andersherum gilt es nie.
/// </para>
/// </summary>
public static class Access
{
    public static void Map(WebApplication app)
    {
        /*
         * Ohne `{*path}` in der Route: ein Fangmuster muss am Ende stehen, und
         * hier steht hinter dem Pfad noch etwas. Der Pfad reist deshalb im
         * Rumpf beziehungsweise in der Abfrage.
         */
        app.MapPost("/workspace/subpage", OpenAsync);
    }

    /* -- Was jemand an einer Adresse darf ----------------------------------- */

    /// <summary>
    /// <see cref="ViaRoleId"/> ist die Rolle, ÜBER DIE es gilt. Ohne sie liesse
    /// sich nicht beantworten, warum jemand etwas darf — und ein Recht, das
    /// sich nicht erklären lässt, lässt sich auch nicht zurechtrücken.
    /// </summary>
    public readonly record struct Grip(
        bool MayWrite, bool MayCertify, Guid? OwnerRoleId, string? OwnerPath, Guid? ViaRoleId);

    public static async Task<Grip> OfAsync(
        SqlConnection connection, Guid accountId, string path, CancellationToken ct)
    {
        var paths = new List<string> { path };
        paths.AddRange(Slug.Ancestors(path));

        // Die Adresse selbst UND alles darüber: wer weiter oben führt, führt hier mit.
        var rows = new List<(Guid Id, string Path, Guid? Owner)>();

        var names = string.Join(", ", paths.Select((_, i) => $"@p{i}"));
        await using (var cmd = new SqlCommand(
            $"SELECT id, path, claimed_by_role_id FROM app.slug WHERE path IN ({names});", connection))
        {
            for (var i = 0; i < paths.Count; i++) cmd.Parameters.AddWithValue($"@p{i}", paths[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                rows.Add((reader.GetGuid(0), reader.GetString(1),
                    reader.IsDBNull(2) ? null : reader.GetGuid(2)));
            }
        }

        if (rows.Count == 0) return new Grip(false, false, null, null, null);

        // Die nächstliegende Heimat entscheidet, nicht die oberste.
        var owner = rows.Where(r => r.Owner is not null)
            .OrderByDescending(r => r.Path.Length)
            .Select(r => (r.Path, RoleId: r.Owner!.Value))
            .FirstOrDefault();

        var mine = await Workspace.RolesOfAsync(connection, accountId, ct);
        var mineIds = mine.Select(r => r.Id).ToHashSet();

        if (owner.Path is not null && mineIds.Contains(owner.RoleId))
        {
            // Wer führt, darf alles daran.
            return new Grip(true, true, owner.RoleId, owner.Path, owner.RoleId);
        }

        return new Grip(false, false, owner.Path is null ? null : owner.RoleId, owner.Path, null);
    }

    /* -- Eine Unterseite öffnen --------------------------------------------- */

    public sealed record OpenRequest(string Path, string RoleId, string? Note);

    /// <summary>
    /// Eine Unterseite entsteht VON OBEN — ohne Code.
    ///
    /// <para>
    /// Ein Code ist das Mittel, eine Adresse an jemanden zu geben, den man nicht
    /// erreicht. Wer <c>parish</c> führt, erreicht sich selbst: ein Geheimnis,
    /// das man sich selbst schickt, ist Umstand ohne Gewinn. Deshalb steht in
    /// der Zeile kein Hash, sondern NULL (0012) — und die Adresse ist von
    /// Anfang an vergeben.
    /// </para>
    ///
    /// <para>
    /// Die Rolle muss eine EIGENE sein. Einer fremden Rolle eine Adresse zu
    /// geben, wäre eine Verfügung über jemanden, der nicht gefragt wurde; wer
    /// anderen Zugang geben will, bindet die Seite an einen Bereich.
    /// </para>
    /// </summary>
    private static async Task OpenAsync(HttpContext ctx, Db db, OpenRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var path = Slug.Normalise(body.Path);

        if (!Slug.IsWellFormed(path) || Slug.IsReserved(path))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Adres: małe litery, cyfry i myślniki; części oddziel ukośnikiem.");
            return;
        }

        var ancestors = Slug.Ancestors(path);
        if (ancestors.Count == 0)
        {
            // Eine Adresse auf oberster Ebene hat kein „oben", das sie öffnen
            // könnte. Die gibt es weiterhin nur mit Code.
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "To nie jest podstrona. Adres najwyższego poziomu bierze się kodem.");
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

        // Gefragt wird am ELTERNPFAD: dort hängt das Recht, darunter etwas zu
        // öffnen. Die neue Adresse selbst kennt noch niemand.
        var parent = string.Join('/', path.Split('/')[..^1]);
        var grip = await OfAsync(connection, who.Value.AccountId, parent, ctx.RequestAborted);

        if (grip.OwnerRoleId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Adresu nadrzędnego nikt jeszcze nie przejął.");
            return;
        }

        if (!grip.MayCertify)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tu nie możesz otwierać podstron — do tego trzeba prawa „certify”.");
            return;
        }

        var now = DateTimeOffset.UtcNow;

        await using var insert = new SqlCommand("""
            INSERT INTO app.slug
                (id, path, claim_code_sha256, note, claimed_by_role_id, claimed_by_account_id,
                 claimed_at, created_at)
            VALUES (@id, @path, NULL, @note, @role, @account, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", Ids.NewId());
        insert.Parameters.AddWithValue("@path", path);
        insert.Parameters.AddWithValue("@note", (object?)body.Note?.Trim() ?? DBNull.Value);
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

        await ctx.Response.WriteAsJsonAsync(new { path, roleId = Ids.ToText(roleId), claimedAt = now });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
