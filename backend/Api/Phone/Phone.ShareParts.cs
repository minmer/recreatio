using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 2026-11-21 — GROSSE PLIKI PRZEZ LINK IN STÜCKEN (ein Film über 50 MB).
///
/// <para>
/// Der Browser versiegelt die Datei Stück für Stück (<c>shareSeal.ts</c>, Fassung 2)
/// und schickt jedes Stück für sich: <c>PUT …/share/{id}/part/{n}</c>. Bricht das Netz
/// ab, geht nur dieses Stück noch einmal — nicht die ganze Datei. <c>POST …/finish</c>
/// setzt die Stücke in ihrer Reihenfolge zusammen und legt den Link an, mit denselben
/// Grenzen wie ein Hinauf in einem Stück (<see cref="StoreShareAsync"/>).
/// </para>
///
/// <para>
/// Ein Stück bleibt klein (höchstens gut 8 MB): darunter liegt jede Grenze eines Proxys
/// oder des IIS. Liegengebliebene Stücke (kein finish) räumt jedes neue Stück nach zwei
/// Tagen fort.
/// </para>
/// </summary>
public static partial class Phone
{
    /// <summary>Die ganze versiegelte Datei aus Stücken: 250 MB und ihre Hüllen.</summary>
    private const long MaxSharePieced = 250L * 1024 * 1024 + 1024 * 1024;

    private const long MaxSharePart = 8L * 1024 * 1024 + 64 * 1024;
    private const int MaxShareParts = 1000;

    private static void MapShareParts(WebApplication app)
    {
        app.MapPut("/workspace/phone/{areaId:guid}/share/{id:guid}/part/{n:int}", SharePartAsync)
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(MaxSharePart));
        app.MapPost("/workspace/phone/{areaId:guid}/share/{id:guid}/finish", ShareFinishAsync);
    }

    private static string SharePartPath(IConfiguration config, Guid areaId, Guid id, int n) =>
        Path.Combine(FileFolder(config, areaId), "share-" + id.ToString("N") + ".part-" + n.ToString(System.Globalization.CultureInfo.InvariantCulture));

    /// <summary>Die Stücke eines Links fortschaffen — alle, oder (<paramref name="olderThan"/>) die liegengebliebenen aller Links des Bereichs.</summary>
    private static void DropShareParts(IConfiguration config, Guid areaId, Guid? id, TimeSpan? olderThan)
    {
        var folder = FileFolder(config, areaId);
        if (!Directory.Exists(folder)) return;
        var pattern = id is Guid one ? "share-" + one.ToString("N") + ".part-*" : "share-*.part-*";
        foreach (var path in Directory.EnumerateFiles(folder, pattern))
        {
            try
            {
                if (olderThan is TimeSpan age && File.GetLastWriteTimeUtc(path) > DateTime.UtcNow - age) continue;
                File.Delete(path);
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }

    private static async Task<bool> ShareExistsAsync(SqlConnection connection, Guid id, CancellationToken token)
    {
        await using var cmd = new SqlCommand("SELECT 1 FROM app.phone_share WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        return await cmd.ExecuteScalarAsync(token) is not null;
    }

    /// <summary>EIN STÜCK. Dasselbe Stück zweimal ersetzt das erste — ein abgebrochenes darf einfach noch einmal kommen.</summary>
    private static async Task SharePartAsync(HttpContext ctx, Db db, IConfiguration config, Guid areaId, Guid id, int n)
    {
        var limit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = MaxSharePart;

        if (n < 0 || n >= MaxShareParts || ctx.Request.ContentType != "application/octet-stream"
            || ctx.Request.ContentLength is not long size || size < 1 || size > MaxSharePart)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Niepoprawny kawałek pliku.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Write) is null) return;
        if (await ShareExistsAsync(connection, id, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten link już istnieje.");
            return;
        }

        var folder = FileFolder(config, areaId);
        Directory.CreateDirectory(folder);
        DropShareParts(config, areaId, null, TimeSpan.FromDays(2));

        var path = SharePartPath(config, areaId, id, n);
        var others = Directory.EnumerateFiles(folder, "share-" + id.ToString("N") + ".part-*")
            .Where(one => !one.EndsWith(".tmp", StringComparison.Ordinal) && !string.Equals(one, path, StringComparison.OrdinalIgnoreCase))
            .Sum(one => new FileInfo(one).Length);
        if (others + size > MaxSharePieced)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Plik przez link może mieć najwyżej 250 MB.");
            return;
        }

        /* Erst ganz, dann unter seinem Namen: ein halb angekommenes Stück zählt nie als da. */
        var temp = path + ".tmp";
        try
        {
            await using (var file = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true))
            {
                var buffer = new byte[81920];
                long total = 0;
                int read;
                while ((read = await ctx.Request.Body.ReadAsync(buffer, ctx.RequestAborted)) > 0)
                {
                    total += read;
                    if (total > size) throw new BadHttpRequestException("Part too large", 413);
                    await file.WriteAsync(buffer.AsMemory(0, read), ctx.RequestAborted);
                }
                if (total != size) throw new BadHttpRequestException("Incomplete part", 400);
                await file.FlushAsync(ctx.RequestAborted);
            }
            File.Move(temp, path, overwrite: true);
        }
        catch
        {
            try { File.Delete(temp); } catch (IOException) { }
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { part = n, size });
    }

    /// <summary>
    /// DIE STÜCKE ZUSAMMENSETZEN und den Link anlegen — das versiegelte Etikett im Kopf
    /// <c>X-Share-Label</c>, wie beim Hinauf in einem Stück. Fehlen Stücke, sagt die
    /// Antwort welche (409, <c>missing</c>); ein zweites finish nach einem Abbruch sagt
    /// „schon da".
    /// </summary>
    private static async Task ShareFinishAsync(HttpContext ctx, Db db, IConfiguration config, Guid areaId, Guid id, int? epoch, int? days, int? parts)
    {
        if (ShareDays(days) is not int keep)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Link może być ważny od 1 do {MaxShareDays} dni.");
            return;
        }
        if (!ShareLabel(ctx.Request.Headers[ShareLabelHeader].ToString(), out var label))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brak zapieczętowanego opisu pliku.");
            return;
        }
        if (parts is not int count || count < 1 || count > MaxShareParts)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Niepoprawna liczba kawałków.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var allowed = await AllowedAsync(ctx, db, connection, areaId, Capability.Write);
        if (allowed is null) return;
        if (epoch is not int e || e < 1 || e > allowed.Value.CurrentEpoch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
            return;
        }

        long size = 0;
        var missing = new List<int>();
        for (var n = 0; n < count; n++)
        {
            var part = SharePartPath(config, areaId, id, n);
            if (File.Exists(part)) size += new FileInfo(part).Length;
            else missing.Add(n);
        }

        /* Schon angelegt (ein wiederholtes finish): dann braucht es die Stücke nicht mehr — StoreShareAsync sagt „schon da". */
        if (missing.Count > 0 && !await ShareExistsAsync(connection, id, ctx.RequestAborted))
        {
            ctx.Response.StatusCode = StatusCodes.Status409Conflict;
            await ctx.Response.WriteAsJsonAsync(new { error = "Brakuje kawałków pliku — wyślij je jeszcze raz.", missing });
            return;
        }
        if (size > MaxSharePieced)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Plik przez link może mieć najwyżej 250 MB.");
            return;
        }

        await StoreShareAsync(ctx, config, connection, areaId, e, null, id, new ShareRequest(size, keep, label), async (target, token) =>
        {
            await using var file = new FileStream(target, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true);
            for (var n = 0; n < count; n++)
            {
                await using var part = new FileStream(SharePartPath(config, areaId, id, n), FileMode.Open, FileAccess.Read, FileShare.Read, 81920, true);
                await part.CopyToAsync(file, token);
            }
            await file.FlushAsync(token);
            if (file.Length != size) throw new IOException("Share parts changed while joining.");
        });

        if (await ShareExistsAsync(connection, id, ctx.RequestAborted)) DropShareParts(config, areaId, id, null);
    }
}
