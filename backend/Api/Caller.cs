using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// WER RUFT — ein Konto, oder die Links mit Zugang, die ein Browser hält.
///
/// <para>
/// <b>Ein Link ist eine Rolle</b> (0065), und was eine Rolle darf, steht an
/// ihren Zertifikaten. Bisher zählte sie nur, wenn ein Konto sie hielt: wer
/// einen Link mit „pisze" öffnete, konnte lesen, aber nichts eintragen — und
/// der Link sagte trotzdem „pisze". Ein Link mit Schreibrecht, der nicht
/// schreibt, ist für den, der ihn bekommen hat, ein kaputter Link.
/// </para>
///
/// <para>
/// <b>Deshalb gibt es den Rufer.</b> Eine Stelle, die ihn statt des Kontos
/// fragt, gilt für beide: für das Konto mit allem, was es hält — oder, ohne
/// Sitzung, für die Rollen der Links, deren Beweise der Browser mitschickt
/// (<see cref="Header"/>). Was danach geprüft wird, ist dasselbe: ein
/// Zertifikat im Bereich, read, write oder admin.
/// </para>
///
/// <para>
/// <b>Mit Sitzung zählt nur das Konto.</b> Wer angemeldet ist, handelt als
/// er selbst; einen Link nimmt er in sein Konto auf („Dodaj do konta"), dann
/// hält es ihn überall. Beides zu mischen hiesse: im Kalender dürfte er, in
/// den Bereichen daneben sähe er nichts — zwei Antworten auf dieselbe Frage.
/// </para>
///
/// <para>
/// <b>Wer ihn fragt, entscheidet jede Stelle selbst.</b> Der Rufer ersetzt
/// <see cref="Auth.WhoAsync"/> nicht überall, sondern dort, wo ein Link
/// handeln können soll (zuerst: der Kalender). Alles andere bleibt beim Konto.
/// </para>
/// </summary>
internal sealed record Caller(Guid? AccountId, List<Workspace.RoleRow> Roles)
{
    /// <summary>Ohne Konto — nur über Links in diesem Browser.</summary>
    public bool ByLinks => AccountId is null;

    public bool Holds(Guid roleId) => Roles.Any(r => r.Id == roleId);

    public List<Guid> RoleIds => Roles.Select(r => r.Id).ToList();
}

internal static class Callers
{
    /// <summary>
    /// Die Beweise der Links, durch Kommas — dieselben wie <c>links=</c> an
    /// Seite und Kalender (<see cref="HeldLinks.Proofs"/>), nie das Geheimnis.
    /// Ein Kopf und kein Keks: von einer fremden Seite aus lässt er sich nicht
    /// mitschicken.
    /// </summary>
    public const string Header = "X-Recreatio-Links";

    /// <summary><c>null</c>: weder eine Sitzung noch ein Link, der gilt.</summary>
    public static async Task<Caller?> OfAsync(HttpContext ctx, Db db, SqlConnection connection)
    {
        var who = await Auth.WhoAsync(ctx, db);

        if (who is not null)
        {
            return new Caller(who.Value.AccountId,
                await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted));
        }

        var links = await HeldLinks.RolesAsync(connection, ctx.Request.Headers[Header].ToString(), ctx.RequestAborted);
        if (links.Count == 0) return null;

        /* Eine Linkrolle ist eine gewöhnliche Rolle: kein Konto, keine Person, eine Stufe darunter. */
        return new Caller(null, links.Select(id => new Workspace.RoleRow(id, "role", false, 1)).ToList());
    }

    /// <summary>Für Stellen, die ihre Verbindung erst später öffnen: einmal kurz nachsehen, wer ruft.</summary>
    public static async Task<Caller?> OfAsync(HttpContext ctx, Db db)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        return await OfAsync(ctx, db, connection);
    }
}
