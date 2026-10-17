using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// ROZMOWY (0052) — Chats auf dem Kern der Bereiche.
///
/// <para>
/// <b>Jeder Chat liegt an einem Bereich</b>, und der Zugang zum Chat IST der
/// Zugang zum Bereich: wer ihn lesen darf, liest mit; wer darin schreiben
/// darf, schreibt; wer darin hineinlaesst, nimmt Menschen in den Chat. Es
/// gibt deshalb keine eigene Mitgliederliste und keine eigene Schluessel —
/// nur zwei Oberflaechen fuer dieselbe Sache: die Einstellungen des Bereichs
/// und die des Chats.
/// </para>
///
/// <code>
///   area     ein bestehender Bereich bekommt seinen Chat
///   group    der Browser legt fuer die Gruppe einen eigenen Bereich an
///   direct   zu zweit — zwei Personen oder Rollen, ebenfalls mit Bereich
///   self     Notatki — im eigenen Bereich einer Person (0062)
///   seat     mit EINEM Platz: der Mensch, der ein Formular ausgefuellt hat (0069)
/// </code>
///
/// <para>
/// <b>Der Dienst liest keine Nachricht.</b> Sie liegt unter dem
/// Epochenschluessel des Bereichs; jede ist von der Rolle ihres Verfassers
/// unterschrieben (<see cref="MessageVersionRecord"/>, Version 1), und die
/// Unterschrift wird hier geprueft — der Dienst kann niemandem ein Wort in
/// den Mund legen.
/// </para>
///
/// <para>
/// <b>In der Rozmowa eines Bereichs schreibt jeder, der dazugehoert (0053)</b>
/// — jede Rolle, die ihn lesen darf, und jeder PLATZ des Bereichs, der Mensch
/// mit dem Link. Der Platz haelt dafuer nicht den Bereichsschluessel, sondern
/// nur den des Chats, abgeleitet und ihm von einem Mitglied verpackt.
/// </para>
/// </summary>
public static partial class Chat
{
    /// <summary>Eine Nachricht, versiegelt — mehr schreibt niemand in eine Zeile.</summary>
    private const int MaxBody = 24_000;

    private const int MaxName = 1_024;

    /// <summary>Wie weit die Uhr des Browsers danebenliegen darf — der Zeitpunkt geht in die Unterschrift ein.</summary>
    private static readonly TimeSpan ClockSlack = TimeSpan.FromMinutes(15);

    private static readonly string[] Readers = ["read", "write", "admin"];
    private static readonly string[] Writers = ["write", "admin"];

    public static void Map(WebApplication app)
    {
        MapFeatures(app);
        MapTopics(app);
        MapAsk(app);
        MapLinkPersons(app);
        /* 0105 — eine Rozmowa löschen (für alle). */
        MapRemove(app);
        app.MapGet("/workspace/chats", ListAsync);
        app.MapPost("/workspace/chats", CreateAsync);
        app.MapGet("/workspace/chat/{id:guid}", ShowAsync);
        app.MapGet("/workspace/chat/{id:guid}/messages", MessagesAsync);
        app.MapPost("/workspace/chat/{id:guid}/messages", PostAsync);
        app.MapPost("/workspace/chat/{id:guid}/read", ReadAsync);
        app.MapPost("/workspace/chat/message/{id:guid}/delete", DeleteAsync);

        /* Wie jemand in einem Bereich heisst — fuer die anderen Mitglieder, versiegelt. */
        app.MapPost("/workspace/area/{id:guid}/names", NameAsync);
        app.MapGet("/workspace/area/{id:guid}/names", AreaNamesAsync);

        /*
         * DIE VISITENKARTE EINER ROLLE — Art und oeffentlicher Schluessel, zu
         * einer Kennung, die jemand weitergegeben hat („Twój kod do rozmów").
         * Damit laesst sich ein Mensch aus einem anderen Konto in einen
         * Bereich nehmen: der Browser verpackt ihm den Schluessel.
         */
        app.MapGet("/workspace/role/{id:guid}/card", CardAsync);

        /* 0053 — den Plaetzen des Bereichs den Chatschluessel weitergeben. */
        app.MapPost("/workspace/chat/{id:guid}/seats", GrantSeatsAsync);

/*
         * 0053 — DER MENSCH MIT DEM LINK. Ohne Konto; der Link (sein Token)
         * ist der Ausweis, wie bei allem anderen unter `/seat/`.
         */
        app.MapGet("/seat/{token}/chats", SeatChatsAsync);
        app.MapPost("/seat/{token}/identity", SeatIdentityAsync);
        app.MapGet("/seat/{token}/chat/{id:guid}/messages", SeatMessagesAsync);
        app.MapPost("/seat/{token}/chat/{id:guid}/messages", SeatPostAsync);
        app.MapPost("/seat/{token}/chat/message/{id:guid}/delete", SeatDeleteAsync);

        /* 0058 — bearbeiten, wiederherstellen, die Fassungen (Chat.Versions.cs). */
        app.MapPost("/workspace/chat/message/{id:guid}/edit", EditAsync);
        app.MapPost("/workspace/chat/message/{id:guid}/restore", RestoreAsync);
        app.MapGet("/workspace/chat/message/{id:guid}/versions", VersionsAsync);
        app.MapPost("/seat/{token}/chat/message/{id:guid}/edit", SeatEditAsync);
        app.MapPost("/seat/{token}/chat/message/{id:guid}/restore", SeatRestoreAsync);
        app.MapGet("/seat/{token}/chat/message/{id:guid}/versions", SeatVersionsAsync);
    }

    /// <summary>
    /// Wer in einem Chat schreibt. In der Rozmowa eines BEREICHS jeder, der ihn
    /// lesen darf (0053) — sie gehoert allen darin; in einer eigenen (Gruppe, zu
    /// zweit) sagen es die Einstellungen.
    /// </summary>
    private static string[] SpeakersOf(ChatRow chat) => ChatRules.Speakers(chat.Kind, chat.PostingPolicy);

    /* ======================================================================
       WER DARF
       ====================================================================== */

    /// <summary>Die Rollen dieses Kontos — und welche davon den Bereich mit einer dieser Stufen tragen.</summary>
    private static async Task<List<Guid>> HoldingAsync(
        SqlConnection connection, IReadOnlyList<Guid> roles, Guid areaId, string[] capabilities, CancellationToken ct)
    {
        var found = new List<Guid>();
        if (roles.Count == 0) return found;

        var names = string.Join(", ", roles.Select((_, i) => $"@r{i}"));
        var caps = string.Join(", ", capabilities.Select((_, i) => $"@c{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT DISTINCT subject_role_id FROM app.certificate
            WHERE scope_kind = N'area' AND scope_id = @area
              AND revoked_at IS NULL AND expires_at > @now
              AND capability IN ({caps})
              AND subject_role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < roles.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roles[i]);
        for (var i = 0; i < capabilities.Length; i++) cmd.Parameters.AddWithValue($"@c{i}", capabilities[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) found.Add(reader.GetGuid(0));
        return found;
    }

    private sealed record ChatRow(Guid Id, Guid AreaId, string Kind, string? PairKey, DateTimeOffset CreatedAt,
        DateTimeOffset? LastMessageAt, string PostingPolicy, Guid? SeatId = null);

    private static async Task<ChatRow?> ChatOfAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, area_id, kind, pair_key, created_at, last_message_at, posting_policy, seat_id FROM app.chat WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new ChatRow(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3), reader.GetDateTimeOffset(4),
            reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5), reader.GetString(6),
            reader.IsDBNull(7) ? null : reader.GetGuid(7));
    }

    /// <summary>
    /// Welche Plaetze in dieser Rozmowa dabei sind — als SQL fuer eine
    /// Unterabfrage ueber `s` (app.access) und `c` (app.chat): im Bereich
    /// alle Plaetze des Bereichs und der Formulare der Rozmowa (0080), in der
    /// eines Platzes (0069) nur er.
    /// </summary>
    private static readonly string SeatOfChat = ChatRules.SeatOfChat;

    private static bool HasSeats(ChatRow chat) => ChatRules.HasSeats(chat.Kind);

    /// <summary>Der Chat — wenn dieses Konto ihn lesen darf; sonst null (und 404 geschrieben).</summary>
    private static async Task<(ChatRow Chat, List<Guid> Mine, Guid Account)?> ReadableAsync(
        HttpContext ctx, Db db, SqlConnection connection, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return null; }

        var chat = await ChatOfAsync(connection, id, ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();

        if (chat is null || (await HoldingAsync(connection, mine, chat.AreaId, Readers, ctx.RequestAborted)).Count == 0)
        {
            // „Darfst du nicht" und „gibt es nicht" bekommen dieselbe Antwort.
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej rozmowy nie ma.");
            return null;
        }

        return (chat, mine, who.Value.AccountId);
    }

private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
