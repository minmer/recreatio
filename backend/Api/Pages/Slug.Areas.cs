using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Wer eine Seite sehen darf (Bereiche), eine Adresse verschieben.</summary>
public static partial class Slug
{
    public sealed record AreasRequest(string Path, IReadOnlyList<string>? AreaIds);

    /// <summary>
    /// WER DIESE SEITE OEFFNEN DARF — die Bereiche, an die sie gebunden ist
    /// (0051). Leer heisst: oeffentlich.
    ///
    /// <para>
    /// <b>Ersetzt die alte Rollenbindung</b> (0026): wer Bereiche waehlt oder
    /// die Seite oeffentlich macht, nimmt die Rolle gleich mit weg. Zwei
    /// Regeln nebeneinander liessen niemanden sagen, wer eigentlich hinein darf.
    /// </para>
    ///
    /// <para>
    /// <b>Nur Bereiche, die man selbst sieht.</b> Wer eine Seite an einen
    /// fremden Bereich bindet, entschiede, wem dessen Menschen Zutritt geben —
    /// ohne je in diesen Bereich zu gehoeren.
    /// </para>
    /// </summary>
    private static async Task AreasAsync(HttpContext ctx, Db db, AreasRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var path = Normalise(body.Path);

        var areas = new List<Guid>();
        foreach (var text in body.AreaIds ?? [])
        {
            if (!Guid.TryParse(text, out var area))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny obszar.");
                return;
            }
            if (!areas.Contains(area)) areas.Add(area);
        }

        if (areas.Count > 20)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Najwyżej 20 obszarów.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
        }

        foreach (var area in areas)
        {
            if (!await Area.MayAsync(connection, who.Value.AccountId, area, Capability.Read, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma — albo go nie widzisz.");
                return;
            }
        }

        Guid slugId;
        await using (var find = new SqlCommand("SELECT id FROM app.slug WHERE path = @path;", connection))
        {
            find.Parameters.AddWithValue("@path", path);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
                return;
            }
            slugId = found;
        }

        /*
         * 0121 — EINE VERSIEGELTE SEITE bleibt eine Seite mit Zugang: öffentlich
         * wäre sie für niemanden lesbar. Und wer aus ihren Bereichen fällt, bekommt
         * ihren Schlüssel nicht mehr: seine Hülle geht gleich mit. (Für einen neuen
         * Bereich packt der Browser den Schlüssel neu — der Dienst hat ihn nicht.)
         */
        var seal = Page.ReadSeal(await Page.SealOfAsync(connection, slugId, ctx.RequestAborted));
        if (seal is not null && areas.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ta strona jest zaszyfrowana — wyłącz najpierw szyfrowanie, potem udostępnij ją wszystkim.");
            return;
        }

        /* Bliebe keine Hülle übrig, hätte niemand mehr den Schlüssel — und die Seite wäre verloren. */
        if (seal is not null && !seal.Wraps.Any(one => one.Area is null || areas.Contains(one.Area.Value)))
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Po tej zmianie nikt nie miałby klucza do tej zaszyfrowanej strony — zostaw choć jeden z jej dotychczasowych obszarów.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            if (seal is not null)
            {
                var kept = seal with { Wraps = seal.Wraps.Where(one => one.Area is null || areas.Contains(one.Area.Value)).ToList() };
                await using var prune = new SqlCommand("UPDATE app.slug SET page_seal = @seal WHERE id = @slug;", connection, tx);
                prune.Parameters.AddWithValue("@seal", Page.WriteSeal(kept));
                prune.Parameters.AddWithValue("@slug", slugId);
                await prune.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var drop = new SqlCommand(
                "DELETE FROM app.slug_area WHERE slug_id = @slug;", connection, tx))
            {
                drop.Parameters.AddWithValue("@slug", slugId);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var area in areas)
            {
                await using var add = new SqlCommand(
                    "INSERT INTO app.slug_area (slug_id, area_id) VALUES (@slug, @area);", connection, tx);
                add.Parameters.AddWithValue("@slug", slugId);
                add.Parameters.AddWithValue("@area", area);
                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { path, areaIds = areas.Select(Ids.ToText), @sealed = seal is not null });
    }

    public sealed record MoveRequest(string Path, string NewPath);

    /// <summary>
    /// Eine Unteradresse umhaengen oder umbenennen — mitsamt allem darunter.
    ///
    /// <para>
    /// <b>Der Inhalt zieht NICHT um.</b> `slug_page` und `slug_part` haengen an
    /// der Kennung, nicht am Pfad; eine Seite behaelt also ihren Text, ihre
    /// Bausteine und ihre Formularfelder. Was sich aendert, ist die Adresse —
    /// und die von allem, was darunter liegt.
    /// </para>
    ///
    /// <para>
    /// <b>Verweise ziehen mit.</b> Ein Alias zeigt auf einen PFAD; bliebe er
    /// stehen, zeigte er nach dem Umhaengen ins Leere. Beides geschieht in
    /// einer Transaktion, sonst gaebe es einen Augenblick, in dem die Seite
    /// unter keiner Adresse zu finden ist.
    /// </para>
    ///
    /// <para>
    /// <b>Eine Wurzel entsteht hier nicht.</b> Oberste Adressen nimmt man mit
    /// einem Code (0017); waere Umhaengen ein zweiter Weg dorthin, liesse sich
    /// der Code umgehen.
    /// </para>
    /// </summary>
    private static async Task MoveAsync(HttpContext ctx, Db db, MoveRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var from = Normalise(body.Path);
        var to = Normalise(body.NewPath);

        if (from == Home || to == Home || !IsWellFormed(from) || !IsWellFormed(to) || IsReserved(to))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Adres: małe litery, cyfry i myślniki; części oddziel ukośnikiem.");
            return;
        }

        if (from == to)
        {
            await ctx.Response.WriteAsJsonAsync(new { path = to, moved = false });
            return;
        }

        if (!to.Contains('/'))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Adres najwyższego poziomu bierze się kodem, nie przeciągnięciem.");
            return;
        }

        /*
         * IN SICH SELBST laesst sich nichts haengen. Sonst verschwaende der
         * ganze Ast: seine Vorfahren waeren seine Nachfahren.
         */
        if (to.StartsWith(from + "/", StringComparison.Ordinal))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Nie można wsunąć gałęzi w nią samą.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * ZWEI Rechte: an der Stelle, von der etwas weggeht, und an der, wo es
         * ankommt. Eines allein genuegte, um eine Seite in einen fremden
         * Unterbau zu schieben — oder aus ihm heraus.
         */
        var here = await Access.OfAsync(connection, who.Value.AccountId, from, ctx.RequestAborted);
        if (!here.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
        }

        var parent = to[..to.LastIndexOf('/')];
        var there = await Access.OfAsync(connection, who.Value.AccountId, parent, ctx.RequestAborted);

        if (!there.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tam nie możesz nic położyć.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var taken = new SqlCommand(
                "SELECT TOP 1 1 FROM app.slug WHERE path = @to;", connection, tx))
            {
                taken.Parameters.AddWithValue("@to", to);

                if (await taken.ExecuteScalarAsync(ctx.RequestAborted) is not null)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Fail(ctx, StatusCodes.Status409Conflict, "Pod tym adresem już coś jest.");
                    return;
                }
            }

            int moved;

            await using (var cmd = new SqlCommand("""
                UPDATE app.slug
                   SET path = @to + SUBSTRING(path, LEN(@from) + 1, 200)
                 WHERE path = @from OR path LIKE @under;

                SELECT @@ROWCOUNT;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@from", from);
                cmd.Parameters.AddWithValue("@to", to);
                cmd.Parameters.AddWithValue("@under", from + "/%");

                moved = (int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted) ?? 0);
            }

            if (moved == 0)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
                return;
            }

            await using (var cmd = new SqlCommand("""
                UPDATE app.slug
                   SET alias_of = @to + SUBSTRING(alias_of, LEN(@from) + 1, 200)
                 WHERE alias_of = @from OR alias_of LIKE @under;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@from", from);
                cmd.Parameters.AddWithValue("@to", to);
                cmd.Parameters.AddWithValue("@under", from + "/%");

                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { path = to, moved });
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }
}
