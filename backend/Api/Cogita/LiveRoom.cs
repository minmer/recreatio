using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 2026-11-25 (Eigentümer: „eine echte Live-Stunde — jeder mit einem neuen Link ist dabei, jede Sekunde Verbindung") — DER RAUM
/// EINER LAUFENDEN SITZUNG, im Speicher dieses Dienstes:
///
/// <code>
///   wer da ist     jeder Abruf der Ereignisse (im Raum: jede Sekunde) ist ein Herzschlag — „X-Cogita-Participant" nennt die
///                  Kennung, unter der sich jemand anmeldet; der Gastgeber sieht, wer in den letzten Sekunden da war, alle sehen,
///                  wann der Gastgeber zuletzt da war
///   wer darf       die Prüfung (Konto, Link, Platz, Geheimnis) gilt 20 s für dieselben Ausweise — ein Abruf pro Sekunde kostet
///                  dann eine Abfrage (die Ereignisse), nicht sechs
///   die Uhr        `now` des Dienstes — Zeiten im Wettbewerb (wer zuerst richtig antwortet) zählen nach ihr, nie nach dem Gerät
/// </code>
///
/// Nichts davon ist geheim oder bleibt: nach einem Neustart füllt sich der Raum mit dem nächsten Herzschlag wieder.
/// </summary>
internal static class LiveRoom
{
    private sealed record Seen(DateTimeOffset At, bool Host);

    private sealed record Allowed(bool Host, Guid? AccountId, IReadOnlyList<Guid> Roles, Guid? SeatId, bool ByJoin, DateTimeOffset Until);

    private static readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, Seen>> Rooms = new();
    private static readonly ConcurrentDictionary<string, Allowed> Checked = new(StringComparer.Ordinal);
    private static long lastSweep;

    public const string ParticipantHeader = "X-Cogita-Participant";
    private static readonly TimeSpan CheckFor = TimeSpan.FromSeconds(20);
    private static readonly TimeSpan Forget = TimeSpan.FromMinutes(10);
    /// <summary>Wer in dieser Zeit nicht abgerufen hat, zählt nicht mehr als „jetzt da".</summary>
    public static readonly TimeSpan PresentFor = TimeSpan.FromSeconds(30);

    /// <summary>Die Kennung eines Teilnehmers aus dem Kopf — kurz und harmlos, sonst keine.</summary>
    public static string? ParticipantOf(HttpContext ctx)
    {
        var raw = ctx.Request.Headers[ParticipantHeader].ToString().Trim();
        if (raw.Length is 0 or > 64) return null;
        foreach (var c in raw) if (!(char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or ':')) return null;
        return raw.ToLowerInvariant();
    }

    /// <summary>Die Prüfung, wer an die Sitzung darf — dieselben Ausweise gelten 20 s; die Zeile der Sitzung ist immer frisch.</summary>
    public static async Task<Cogita.Presence?> PresenceAsync(HttpContext ctx, Db db, SqlConnection connection, Guid id, Cogita.Credentials cred)
    {
        var now = DateTimeOffset.UtcNow;
        Sweep(now);
        var key = KeyOf(ctx, id, cred);
        if (Checked.TryGetValue(key, out var had) && had.Until > now)
        {
            var session = await Cogita.SessionAsync(connection, id, ctx.RequestAborted);
            if (session is null) return null;
            if (had.ByJoin && session.State == "closed") return null;
            return new Cogita.Presence(session, had.Host, had.AccountId, had.Roles, had.SeatId, had.ByJoin);
        }
        var presence = await Cogita.PresenceAsync(ctx, db, connection, id, cred);
        if (presence is null) { Checked.TryRemove(key, out _); return null; }
        Checked[key] = new Allowed(presence.Host, presence.AccountId, presence.Roles, presence.SeatId, presence.ByJoin, now + CheckFor);
        return presence;
    }

    /// <summary>Ein Herzschlag: wer (die Kennung aus dem Kopf) war eben da.</summary>
    public static void Mark(Guid session, Cogita.Presence presence, string? participant)
    {
        /* Nur wer sich im Raum nennt (der Kopf), zählt — ein einzelner Blick in die Sitzung (etwa: ist sie eine Folge-Stunde?) nicht. */
        if (participant is null) return;
        var who = presence.Host ? $"host:{participant}" : participant;
        var room = Rooms.GetOrAdd(session, _ => new ConcurrentDictionary<string, Seen>(StringComparer.Ordinal));
        room[who] = new Seen(DateTimeOffset.UtcNow, presence.Host);
    }

    /// <summary>Wer gerade da ist (ohne Gastgeber), wie lange her in ms — und wann der Gastgeber zuletzt da war.</summary>
    public static (IReadOnlyList<(string Participant, long Ago)> Present, long? HostAgo) Read(Guid session)
    {
        var now = DateTimeOffset.UtcNow;
        if (!Rooms.TryGetValue(session, out var room)) return ([], null);
        var present = new List<(string, long)>();
        long? hostAgo = null;
        foreach (var (who, seen) in room)
        {
            var ago = (long)(now - seen.At).TotalMilliseconds;
            if (seen.Host) { hostAgo = hostAgo is null ? ago : Math.Min(hostAgo.Value, ago); continue; }
            if (now - seen.At <= PresentFor) present.Add((who, ago));
        }
        return (present, hostAgo);
    }

    /// <summary>Die Sitzung ist zu (oder gelöscht): ihr Raum geht.</summary>
    public static void Close(Guid session) => Rooms.TryRemove(session, out _);

    private static string KeyOf(HttpContext ctx, Guid id, Cogita.Credentials cred)
    {
        var text = $"{id:N}|{ctx.Request.Cookies[Auth.Cookie]}|{cred.Links}|{cred.Seat}|{cred.Join}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    }

    private static void Sweep(DateTimeOffset now)
    {
        var last = Interlocked.Read(ref lastSweep);
        if (now.ToUnixTimeMilliseconds() - last < 60_000 || Interlocked.CompareExchange(ref lastSweep, now.ToUnixTimeMilliseconds(), last) != last) return;
        foreach (var (k, a) in Checked) if (a.Until <= now) Checked.TryRemove(k, out _);
        foreach (var (s, room) in Rooms)
        {
            foreach (var (w, seen) in room) if (now - seen.At > Forget) room.TryRemove(w, out _);
            if (room.IsEmpty) Rooms.TryRemove(s, out _);
        }
    }
}
