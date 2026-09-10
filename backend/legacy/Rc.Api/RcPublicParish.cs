using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Was von einer Pfarrei OHNE Konto zu sehen ist.
///
/// <b>Warum es diese Datei gibt.</b> Eine Pfarrseite, die nach dem Passwort
/// fragt, bevor sie den Messplan zeigt, ist keine Pfarrseite. Der Messplan war
/// schon offen (<c>/rc/parishes/{slug}/masses</c>); der NAME der Pfarrei war es
/// nicht — und ohne ihn konnte die Seite nur einen erfundenen anzeigen.
///
/// <b>Alles hier ist Klartext, und das ist kein Versehen.</b> Name, Ort und
/// Adresse einer Pfarrei stehen an ihrer Tuer. Sie zu verschluesseln waere
/// Aufwand ohne Schutz — und haette den Preis, dass die oeffentliche Seite
/// ohne Schluessel leer bliebe.
///
/// Was NICHT hier steht: Intentionen, Spenden, Mitglieder, Kandidaten. Alles,
/// was einen Menschen benennt, liegt versiegelt und braucht einen Schluessel.
/// Die Grenze verlaeuft zwischen der Einrichtung und den Personen darin.
/// </summary>
public static class RcPublicParish
{
    public static void MapRcPublicParish(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/public/parishes", ListAsync).Produces<RcPublicParishesResponse>();
        app.MapGet("/rc/public/parishes/{slug}", OneAsync).Produces<RcPublicParishResponse>();
    }

    /// <summary>Eine Pfarrei, wie sie im Verzeichnis erscheint.</summary>
    public sealed record PublicParishView(
        string Slug, string Name, string? Location, int Masses);

    /// <summary>
    /// Das Verzeichnis der Pfarrseiten.
    ///
    /// <b>Jede Pfarrei ist hier drin</b>, und zwar weil eine Pfarrei genau
    /// dafuer angelegt wird: damit sie eine Seite hat. Ein Schalter „oeffentlich
    /// ja/nein" waere ein Schalter, der beim Anlegen falsch steht und den
    /// niemand findet — die Seite waere fertig und unauffindbar.
    ///
    /// Wer eine Pfarrei anlegen darf, entscheidet <see cref="RcParishSlugs"/>.
    /// Das ist die Schranke; diese Liste ist keine.
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, RcDb db)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT p.slug, p.name, p.location,
                   (SELECT COUNT(*) FROM dbo.rc_mass m WHERE m.parish_id = p.id) AS masses
            FROM dbo.rc_parish p
            ORDER BY p.name;
            """, connection);

        var found = new List<PublicParishView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            found.Add(new PublicParishView(
                reader.GetString(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                reader.GetInt32(3)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcPublicParishesResponse(found));
    }

    /// <summary>
    /// Eine Pfarrei samt der Gestaltung ihrer Startseite.
    ///
    /// <c>theme</c> und <c>modules</c> stammen aus <c>rc_parish_site</c> und
    /// sind Klartext — sie beschreiben eine oeffentliche Seite. Gibt es die
    /// Zeile noch nicht, kommt die Vorgabe zurueck: <c>configured=false</c>
    /// sagt der Oberflaeche, dass hier noch niemand etwas eingerichtet hat,
    /// und sie zeigt einen Aufbau, den man erkennt.
    /// </summary>
    private static async Task OneAsync(HttpContext ctx, RcDb db, string slug)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT p.id, p.slug, p.name, p.location, p.area_id,
                   s.theme, s.modules
            FROM dbo.rc_parish p
            LEFT JOIN dbo.rc_parish_site s ON s.parish_id = p.id
            WHERE p.slug = @slug;
            """, connection);
        cmd.Parameters.AddWithValue("@slug", slug);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.ParishNotFound, "Diese Pfarrei gibt es nicht.");
            return;
        }

        var configured = !reader.IsDBNull(5);

        await RcResults.WriteJsonAsync(ctx, new RcPublicParishResponse(
            RcId.ToText(reader.GetGuid(0)),
            reader.GetString(1),
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),

            // Die Bereichskennung geht mit: mit ihr kann die Oberflaeche fragen,
            // ob der Angemeldete hier verwalten darf. Sie ist kein Geheimnis —
            // ohne Schluessel oeffnet sie nichts.
            RcId.ToText(reader.GetGuid(4)),
            configured ? reader.GetString(5) : "classic",
            // Dieselbe leere Form wie beim Anlegen — nicht "[]": der Browser
            // liest beide, aber zwei Vorgaben fuer dasselbe laufen auseinander.
            configured && !reader.IsDBNull(6) ? reader.GetString(6) : RcParishSiteDocument.Empty,
            configured));
    }
}
