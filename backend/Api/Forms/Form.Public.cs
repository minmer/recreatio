using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Das öffentliche Formular — was der Browser zum Ausfüllen bekommt.</summary>
public static partial class Form
{
    /* -- Das oeffentliche Formular ------------------------------------------ */

    /// <summary>
    /// Das Formular, wie ein Fremder es bekommt.
    ///
    /// <para>
    /// Mit den Beschriftungen VERSIEGELT und der oeffentlichen Haelfte des
    /// Annahmepaares je Bereich. Wer die Epoche offengelegt hat, dessen
    /// Beschriftungen kann der Browser oeffnen; wer nicht, dessen Feld bleibt
    /// zu — und das ist dann kein oeffentliches Formular.
    /// </para>
    /// </summary>
    private static async Task PublicAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * WAS NUR DIE KANZLEI AUSFÜLLT (0047), geht nicht hinaus — keine Frage,
         * keine Annahme. Nur DASS es so ist: die Seite, auf der es steht, zeigt
         * dem Koordinator an dieser Stelle seine Liste, allen anderen nichts.
         */
        var shape = await ShapeAsync(connection, id, ctx.RequestAborted);

        if (shape?.Audience == "office")
        {
            await ctx.Response.WriteAsJsonAsync(new
            {
                partId = Ids.ToText(id),
                audience = shape.Value.Audience,
                extendsId = Ids.ToText(shape.Value.ExtendsId!.Value),
                repeat = shape.Value.Repeat,
                forKind = "none",
                closed = false,
                controller = (object?)null,
                fields = Array.Empty<object>(),
                areas = Array.Empty<object>(),
                design = (object?)null
            });
            return;
        }

        var fields = await ReadFieldsAsync(connection, id, ctx.RequestAborted);
        if (fields.Count == 0)
        {
            /* 0099 — es gibt ihn, nur noch ohne Fragen: das sagen, statt „hier ist keiner". */
            await Fail(ctx, StatusCodes.Status404NotFound, "Ten formularz nie ma jeszcze pytań.");
            return;
        }

        var areas = new List<object>();

        foreach (var areaId in fields.Select(f => f.AreaId).Distinct())
        {
            await using var cmd = new SqlCommand("""
                SELECT i.public_key, c.name, c.address, c.email
                FROM app.intake i
                LEFT JOIN app.area_controller c ON c.area_id = i.area_id
                WHERE i.area_id = @area;
                """, connection);

            cmd.Parameters.AddWithValue("@area", areaId);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) continue;

            areas.Add(new
            {
                areaId = Ids.ToText(areaId),
                publicKey = Base64Url.Encode((byte[])reader[0]),
                controller = reader.IsDBNull(1) ? null : new
                {
                    name = reader.GetString(1),
                    address = reader.IsDBNull(2) ? null : reader.GetString(2),
                    email = reader.IsDBNull(3) ? null : reader.GetString(3)
                }
            });
        }

        /*
         * WOVON DER BOGEN HANDELT (0038) — und das gehoert nach DRAUSSEN.
         *
         * Wer ihn ausfuellt, muss wissen, woran der Platz haengen wird, den er
         * damit bekommt: an ihm selbst, an einer Gruppe, an einem Amt. Steht es
         * nur drinnen, raet der Browser — und raet fuer jemanden, dem danach
         * ein Link gehoert.
         */
        var whole = await WholeAsync(connection, id, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            partId = Ids.ToText(id),
            forKind = whole?.ForKind ?? "none",

            /* Geschlossen: das Formular steht da, nimmt aber nichts an (0042). */
            closed = whole?.Closed ?? false,

            /* EINE Klausel fuer das ganze Formular (0042). */
            controller = whole?.Controller is null ? null : new
            {
                name = whole.Controller.Value.Name,
                address = whole.Controller.Value.Address,
                email = whole.Controller.Value.Email
            },

            fields = fields.Select(Told),
            areas,

            /* Aufbau und Logik (0043) — versiegelt wie die Fragen. */
            design = await DesignAsync(connection, id, ctx.RequestAborted),

            /* 0047 — ein Formular, das ein anderes erweitert, und wer es ausfüllt. */
            audience = shape?.Audience ?? "public",
            extendsId = shape?.ExtendsId is Guid based ? Ids.ToText(based) : null,

            /* 0077 — wie oft eine Erweiterung ausgefüllt wird: once, day, week, month, year. */
            repeat = shape?.Repeat ?? Rounds.Once,

            /* 0083 — wie es heisst (fuer den Ausdruck), und was nach dem Absenden dasteht. */
            title = whole?.Title,

            /* 0097 — sein Name, versiegelt unter dem Schluessel seines Bereichs; der Browser oeffnet ihn, wenn er die Fragen oeffnen kann. */
            nameAreaId = whole?.AreaId is Guid nameArea ? Ids.ToText(nameArea) : null,
            nameSealed = whole?.NameSealed is null ? null : Base64Url.Encode(whole.NameSealed),
            nameEpoch = whole?.NameEpoch,
            after = whole?.After is null ? null : new
            {
                title = whole.After.Title,
                text = whole.After.Text,
                paper = whole.After.Paper,
                signer = whole.After.Signer,

                /* 0086 — der Zusatz zur Adresse der Seite nach dem Absenden (`#twoje-zgloszenie`, `?s=3`). */
                at = whole.After.At
            }
        });
    }
}
