using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Was unter einer Adresse steht.
///
/// <para>
/// <b>Öffentlich im Wortsinn.</b> Das Anzeigen verlangt keine Sitzung, keinen
/// Keks und keinen Schlüssel — eine Seite, die man erst nach dem Anmelden
/// sieht, ist keine Seite, sondern eine Ansicht. Deshalb liegen Überschrift und
/// Vorspann im Klartext; sie zu versiegeln hiesse, sie genau dem
/// vorzuenthalten, für den sie geschrieben sind.
/// </para>
///
/// <para>
/// <b>Schreiben darf, wer die Adresse führt</b> — oder die nächsthöhere. Wer
/// <c>parish</c> hält, schreibt auch auf <c>parish/aktualnosci</c>; das ist
/// dieselbe Regel wie beim Übernehmen (<see cref="Slug"/>) und steht deshalb
/// auch an derselben Stelle.
/// </para>
/// </summary>
public static partial class Page
{
    public const int MaxTitle = 200;
    public const int MaxLead = 4000;

    public static void Map(WebApplication app)
    {
        // `{*path}` fängt auch die Teile nach dem Schrägstrich: `parish/proby`
        // ist EINE Adresse und nicht eine Adresse mit einem Anhängsel.
        app.MapGet("/page/{*path}", ShowAsync);

        /*
         * Welche Seite zeigt DIESE Domain? Gefragt vom Browser, sobald er
         * irgendwo anders als auf recreatio.pl geladen wurde. Öffentlich wie
         * die Seite selbst — ein Name ist kein Geheimnis.
         */
        app.MapGet("/site", SiteAsync);

        app.MapPut("/workspace/page/{*path}", SaveAsync);

        /*
         * Der Pfad reist im Rumpf und nicht in der Route: ein Fangmuster
         * (`{*path}`) muss am Ende stehen, und hinter dem Pfad stünde hier noch
         * etwas.
         */
        app.MapPut("/workspace/parts", SavePartsAsync);

        /* 0048 — die Logik der Seite, als Ganzes. */
        app.MapPut("/workspace/page-logic/{*path}", SaveLogicAsync);

        /* 0062 — Seite oder Slajdy, und ihr Aussehen. */
        app.MapPut("/workspace/page-look/{*path}", SaveLookAsync);

        /* 0082 — worum es auf der Seite geht („Wybór na stronie"). */
        app.MapPut("/workspace/page-subject/{*path}", SaveSubjectAsync);

        /* 0121 — eine Seite mit Zugang versiegeln oder wieder öffnen: alles, was sie trägt, in einem Zug. */
        app.MapPut("/workspace/page-seal/{*path}", SealAsync);
    }

    public sealed record SaveRequest(string Title, string? Lead);

    /// <summary>Ein Baustein, wie ihn die Oberfläche schickt.</summary>
    /// <summary>
    /// <c>ModuleId</c> fehlt bei aelteren Aufrufern und beim Entwerfen im
    /// Raster — dann entsteht ein Baustein unter derselben Kennung (0036).
    /// Wer einen NENNT, stellt einen bestehenden hin: dieselben Daten an zwei
    /// Stellen.
    /// </summary>
    public sealed record PartInput(
        string Id, string Kind, string Layout, string? Config, string? ModuleId = null,
        /* 0133 — nur für die Menschen dieses Bereichs (mit Konto, Link oder ihrem Platz); leer: für alle. */
        string? AudienceAreaId = null);

    public sealed record PartsRequest(string Path, IReadOnlyList<PartInput> Parts);

    /// <summary>So viele Bausteine trägt keine Seite — und wer es versucht, meint es nicht gut.</summary>
    public const int MaxParts = 60;
    /// <summary>0062 — die Hintergründe eines Slajds liegen mit in der Anordnung.</summary>
    public const int MaxLayout = 8000;
    /// <summary>0063 — 64 000: eine Mapa trägt ihre Strecken, ein Plan seine Tage, ein Słownik Fragen und Antworten.</summary>
    public const int MaxConfig = 64000;

private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
