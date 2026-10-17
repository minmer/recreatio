using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Das Adressregister — wer <c>recreatio.pl/&lt;pfad&gt;</c> führt.
///
/// <para>
/// <b>Übernehmen, nicht anlegen.</b> Der Eintrag steht vorher da (<c>slug
/// add</c> am Server), mit einem Code. Wer den Code hat, setzt EINE seiner
/// Rollen auf die Adresse — und damit auf alles darunter.
/// </para>
///
/// <para>
/// <b>Eine Antwort für zwei Fälle.</b> „Diesen Pfad gibt es nicht" und „der
/// Code stimmt nicht" sind von aussen nicht zu unterscheiden. Zwei Antworten
/// wären ein Verzeichnis: man tippt Wörter durch und liest ab, welche Adressen
/// zu haben sind, bevor sie jemand hat.
/// </para>
/// </summary>
public static partial class Slug
{
    /// <summary>Passt in <c>app.slug.path</c> und in eine Adresszeile.</summary>
    public const int MaxPathLength = 200;

    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/slug/claim", ClaimAsync);

        /*
         * Alias und Domain sind KEINE neuen Adressen, sondern zweite Wege zu
         * einer, die man schon führt. Deshalb dürfen sie aus dem Browser kommen,
         * obwohl das Register am Server gefüllt wird: sie geben niemandem
         * Reichweite, die er nicht schon hat.
         */
        app.MapPost("/workspace/alias", AliasAsync);
        app.MapPost("/workspace/domain", DomainAsync);

        /* Der Unterbau einer uebernommenen Adresse — umhaengen und zuordnen. */
        app.MapPost("/workspace/slug/move", MoveAsync);
        app.MapPost("/workspace/slug/internal", InternalAsync);

        /* 0051 — nur mit Zugang: an Bereiche gebunden, nicht an eine Rolle. */
        app.MapPost("/workspace/slug/areas", AreasAsync);
    }

private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }

}
