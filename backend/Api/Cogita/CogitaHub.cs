using Microsoft.AspNetCore.SignalR;

namespace Api;

/// <summary>
/// DER HUB DER SITZUNGEN (0109, [I4]) — SignalR auf demselben Hosting.
///
/// <para>
/// <b>Er trägt nur aus.</b> Geschrieben wird über REST (<see cref="Cogita"/>):
/// dort wird geprüft, gezählt und gespeichert. Der Hub hält, wer gerade da
/// ist, je Sitzung in zwei Gruppen — alle, und die Gastgeber —, und gibt jedes
/// neue Ereignis an die richtige weiter: Fragen und Aufdecken an alle,
/// Antworten und Anmeldungen nur an die Gastgeber.
/// </para>
///
/// <para>
/// <b>Wer hinein darf, sagt dieselbe Prüfung wie bei REST</b>
/// (<see cref="Cogita.PresenceAsync"/>). Ein WebSocket schickt den Keks mit,
/// aber keine eigenen Köpfe: Links, Platz und Geheimnis kommen deshalb als
/// Argumente von <see cref="Join"/>.
/// </para>
/// </summary>
public sealed class CogitaHub(Db db) : Hub
{
    public static string All(Guid sessionId) => $"s:{sessionId:N}";

    public static string Hosts(Guid sessionId) => $"h:{sessionId:N}";

    public sealed record JoinResult(bool Ok, bool Host, string? State);

    public async Task<JoinResult> Join(string sessionId, string? links, string? seat, string? join)
    {
        var http = Context.GetHttpContext();
        if (http is null || !Guid.TryParse(sessionId, out var id)) return new JoinResult(false, false, null);

        await using var connection = await db.OpenAsync(Context.ConnectionAborted);
        var presence = await Cogita.PresenceAsync(http, db, connection, id, new Cogita.Credentials(links, seat, join));
        if (presence is null) return new JoinResult(false, false, null);

        await Groups.AddToGroupAsync(Context.ConnectionId, All(id), Context.ConnectionAborted);
        if (presence.Host) await Groups.AddToGroupAsync(Context.ConnectionId, Hosts(id), Context.ConnectionAborted);
        return new JoinResult(true, presence.Host, presence.Session.State);
    }

    public async Task Leave(string sessionId)
    {
        if (!Guid.TryParse(sessionId, out var id)) return;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, All(id));
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, Hosts(id));
    }
}
