using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0047 — Formulare, die ein anderes ERWEITERN, und die Schritte eines Menschen.
///
/// <para>
/// <b>Eine Erweiterung ist ein gewoehnliches Formular</b> — mit Fragen, Aufbau,
/// Logik —, das zu einem anderen gehoert und sagt, wer es ausfuellt: der Mensch
/// selbst ueber seinen Link (<c>person</c>), oder nur die Kanzlei
/// (<c>office</c>). Seine Einsendung zeigt auf die, die sie ergaenzt
/// (<c>registration.base_id</c>).
/// </para>
///
/// <para>
/// <b>Die Schritte</b> sind, was ein Mensch noch tun oder die Kanzlei noch
/// abhaken muss. Ein Teil ergibt sich von selbst und steht nirgends: die
/// Durchsicht der Angaben (0046) und je Erweiterung „Uzupełnij". Der andere
/// Teil wird von Hand angelegt — nur er steht in <c>form_step</c>. Ob ein
/// Schritt erledigt ist, rechnet der BROWSER aus (dieselbe Funktion bei der
/// Kanzlei und beim Menschen); der Dienst haelt nur, was er ohnehin weiss:
/// welche Einsendungen es gibt und was abgehakt ist.
/// </para>
/// </summary>
public static partial class Form
{
    /// <summary>Mehr Schritte als das ist keine Liste mehr, sondern ein Handbuch (0098: mit den Aufgaben eines Jahres).</summary>
    private const int MaxSteps = 60;

    private static void MapExtension(WebApplication app)
    {
        app.MapGet("/workspace/part/{id:guid}/steps", StepsAsync);
        app.MapPost("/workspace/part/{id:guid}/steps", SaveStepsAsync);
        app.MapPost("/workspace/registration/{id:guid}/step", MarkAsync);

        /* 0098 — eine Aufgabe: was der Mensch sagt, an welchen Tagen er sie getan hat (die Kanzlei für ihn). */
        app.MapPost("/workspace/registration/{id:guid}/task", OfficeTaskAsync);

        /* 0099 — zu einem Termin: będę / nie wiem / nie będę, die Funktion, und die Liste (die Kanzlei für ihn). */
        app.MapPost("/workspace/registration/{id:guid}/presence", OfficePresenceAsync);
        app.MapPost("/workspace/part/{id:guid}/entry", EntryAsync);
    }

    /* -- Was ein Formular ist -------------------------------------------------- */

    /// <summary>Erweitert dieses Formular ein anderes, wer fuellt es aus — und wie oft (0077)?</summary>
    internal readonly record struct Shape(Guid? ExtendsId, string Audience, string Repeat = Rounds.Once);

    internal static async Task<Shape?> ShapeAsync(SqlConnection connection, Guid moduleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT extends_id, audience, repeat_kind FROM app.module WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", moduleId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new Shape(reader.IsDBNull(0) ? null : reader.GetGuid(0), reader.GetString(1), reader.GetString(2));
    }

    /// <summary>
    /// Die Einsendung einer Erweiterung zu dieser Einsendung, fuer DIESEN
    /// Zeitraum (0077; bei einer einmaligen der leere) — oder <c>null</c>.
    /// </summary>
    private static async Task<Guid?> ExtensionOfAsync(
        SqlConnection connection, Guid extensionId, Guid baseRegistrationId, string round, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT TOP 1 id FROM app.registration WHERE part_id = @part AND base_id = @base AND round_key = @round;",
            connection);
        cmd.Parameters.AddWithValue("@part", extensionId);
        cmd.Parameters.AddWithValue("@base", baseRegistrationId);
        cmd.Parameters.AddWithValue("@round", round);

        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    /// <summary>
    /// Je Einsendung: was sie erweitert — welche Erweiterung, welche Einsendung, wann.
    ///
    /// <para>
    /// <b>Je Erweiterung EINE Zeile: die juengste</b> (0077). Eine wiederkehrende
    /// Erweiterung haette sonst je Mensch hunderte — und gefragt ist hier nur,
    /// ob der LAUFENDE Zeitraum ausgefuellt ist. Weil nichts in die Zukunft
    /// eingetragen wird, ist das genau dann der Fall, wenn die juengste ihn
    /// traegt (<c>round</c>). <c>rounds</c> sagt, wie viele es insgesamt sind.
    /// </para>
    ///
    /// <para>
    /// <c>baseIdsSql</c>: eine Unterabfrage, die die Einsendungen nennt — keine
    /// Liste von Parametern: eine Liste mit 2100 Menschen sprengte sie.
    /// </para>
    /// </summary>
    private static async Task<Dictionary<Guid, List<object>>> ExtensionsOfAsync(
        SqlConnection connection, string baseIdsSql, Action<SqlCommand> bind, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<object>>();

        await using var cmd = new SqlCommand($"""
            SELECT x.base_id, x.part_id, x.id, x.submitted_at, x.confirmed_at, x.round_key, x.n
            FROM (
                SELECT r.base_id, r.part_id, r.id, r.submitted_at, r.confirmed_at, r.round_key,
                       ROW_NUMBER() OVER (PARTITION BY r.base_id, r.part_id ORDER BY r.round_key DESC, r.submitted_at DESC) AS place,
                       COUNT(*) OVER (PARTITION BY r.base_id, r.part_id) AS n
                FROM app.registration r
                WHERE r.base_id IN ({baseIdsSql})
            ) x
            WHERE x.place = 1;
            """, connection);

        bind(cmd);

        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var key = reader.GetGuid(0);
                if (!out_.TryGetValue(key, out var list)) out_[key] = list = [];

                list.Add(new
                {
                    moduleId = Ids.ToText(reader.GetGuid(1)),
                    registrationId = Ids.ToText(reader.GetGuid(2)),
                    submittedAt = reader.GetDateTimeOffset(3),
                    confirmedAt = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4),

                    /* 0077 — der Zeitraum der juengsten Einsendung, und wie viele es gibt. */
                    round = reader.GetString(5),
                    rounds = reader.GetInt32(6)
                });
            }
        }

        return out_;
    }

    /// <summary>Je Einsendung: welche Schritte abgehakt sind, wann, und ob vom Menschen selbst.</summary>
    private static async Task<Dictionary<Guid, List<object>>> MarksOfAsync(
        SqlConnection connection, string registrationIdsSql, Action<SqlCommand> bind, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<object>>();

        await using var cmd = new SqlCommand($"""
            SELECT registration_id, step_id, done_at, by_person
            FROM app.step_mark
            WHERE registration_id IN ({registrationIdsSql});
            """, connection);

        bind(cmd);

        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var key = reader.GetGuid(0);
                if (!out_.TryGetValue(key, out var list)) out_[key] = list = [];

                list.Add(new
                {
                    stepId = Ids.ToText(reader.GetGuid(1)),
                    doneAt = reader.GetDateTimeOffset(2),
                    byPerson = reader.GetBoolean(3)
                });
            }
        }

        /* 0100 — die Schritte „Wybierz termin": erledigt, sobald der Platz einen Termin hält. */
        foreach (var (key, marks) in await BookingMarksAsync(connection, registrationIdsSql, bind, ct))
        {
            if (!out_.TryGetValue(key, out var list)) out_[key] = list = [];
            list.AddRange(marks);
        }

        /* 0102 — die Schritte „Przeczytaj wiadomości": erledigt, solange nichts Ungelesenes liegt. */
        foreach (var (key, marks) in await ChatMarksAsync(connection, registrationIdsSql, bind, ct))
        {
            if (!out_.TryGetValue(key, out var list)) out_[key] = list = [];
            list.AddRange(marks);
        }

        return out_;
    }

    /// <summary>
    /// 0102 — WIE EIN HAKEN: je Einsendung und Schritt „Przeczytaj wiadomości",
    /// wenn in den gewählten Rozmowy nichts Ungelesenes liegt — mit dem
    /// Zeitpunkt, bis zu dem zuletzt gelesen wurde (sonst dem der Einsendung:
    /// es gab nie etwas zu lesen). Liegt etwas da, fehlt der Haken.
    ///
    /// <para>
    /// <b>Seine Rozmowy</b> sind die seines Links (<c>SeatOfChat</c>); hat er
    /// keinen (mit dem Konto eingesandt), die, die seine Person über ihre Rollen
    /// liest — die Gruppe und der Kanał eines Bereichs. <b>Gelesen</b> hat er
    /// über den Link ODER mit seinem Konto (<see cref="ChatReaders"/>) — dieselbe
    /// Rechnung wie in der Liste der Rozmowy seines Links.
    /// </para>
    /// </summary>
    internal static async Task<Dictionary<Guid, List<object>>> ChatMarksAsync(
        SqlConnection connection, string registrationIdsSql, Action<SqlCommand> bind, CancellationToken ct)
    {
        const string chosen = "(st.chat_kind = N'all' OR c.kind = st.chat_kind) AND (st.chat_area_id IS NULL OR c.area = st.chat_area_id)";
        var out_ = new Dictionary<Guid, List<object>>();
        await using var cmd = new SqlCommand($"""
            SET NOCOUNT ON;
            DECLARE @keys TABLE (k uniqueidentifier PRIMARY KEY, seat uniqueidentifier NULL, role uniqueidentifier NULL,
                                 part uniqueidentifier NOT NULL, submitted datetimeoffset NOT NULL);
            INSERT INTO @keys (k, seat, role, part, submitted)
            SELECT r.id, r.access_id, r.role_id, r.part_id, r.submitted_at
            FROM app.registration r
            WHERE r.id IN ({registrationIdsSql})
              AND EXISTS (SELECT 1 FROM app.form_step st WHERE st.module_id = r.part_id AND st.kind = N'chat');

            {ChatReaders.Fill}

            DECLARE @chats TABLE (k uniqueidentifier NOT NULL, chat uniqueidentifier NOT NULL, kind nvarchar(16) NOT NULL,
                                  area uniqueidentifier NOT NULL, at datetimeoffset NULL);

            /* Mit Link: die Rozmowy des Platzes — mit den Prowadzący, die Gruppe, der Kanał. */
            INSERT INTO @chats (k, chat, kind, area)
            SELECT g.k, c.id, c.kind, c.area_id
            FROM @keys g JOIN app.access s ON s.id = g.seat JOIN app.chat c ON {ChatRules.SeatOfChat};

            /* Ohne Link (mit dem Konto eingesandt): was seine Person über ihre Rollen liest. */
            WITH down (k, id, depth) AS (
                SELECT k, role, 0 FROM @keys WHERE seat IS NULL AND role IS NOT NULL
                UNION ALL
                SELECT d.k, e.to_role_id, d.depth + 1
                FROM down d
                JOIN app.role_edge e ON e.from_role_id = d.id AND e.revoked_at IS NULL AND e.edge_kind = N'holds'
                WHERE d.depth < {Kernel.RoleGraph.MaxDepth}
            )
            INSERT INTO @chats (k, chat, kind, area)
            SELECT DISTINCT d.k, c.id, c.kind, c.area_id
            FROM down d
            JOIN app.certificate ce ON ce.subject_role_id = d.id AND ce.scope_kind = N'area' AND ce.revoked_at IS NULL
                                   AND ce.expires_at > SYSDATETIMEOFFSET() AND ce.capability IN (N'read', N'write', N'admin')
            JOIN app.chat c ON c.area_id = ce.scope_id AND c.kind IN (N'area', N'channel')
            OPTION (MAXRECURSION {Kernel.RoleGraph.MaxDepth + 1});

            UPDATE c SET at = {ChatReaders.ReadPoint("c.k", "c.chat")} FROM @chats c;

            SELECT g.k, st.id, g.submitted,
                   (SELECT COUNT(*) FROM @chats c JOIN app.chat_message m ON m.chat_id = c.chat
                     WHERE c.k = g.k AND {chosen} AND {ChatReaders.Unread("g.k", "g.seat", "c.at")}) AS unread,
                   (SELECT MAX(c.at) FROM @chats c WHERE c.k = g.k AND {chosen}) AS seen
            FROM @keys g
            JOIN app.form_step st ON st.module_id = g.part AND st.kind = N'chat';
            """, connection);
        bind(cmd);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            if (reader.GetInt32(3) > 0) continue;
            var key = reader.GetGuid(0);
            if (!out_.TryGetValue(key, out var list)) out_[key] = list = [];
            list.Add(new
            {
                stepId = Ids.ToText(reader.GetGuid(1)),
                doneAt = reader.IsDBNull(4) ? reader.GetDateTimeOffset(2) : reader.GetDateTimeOffset(4),
                byPerson = true,
                chat = new { unread = 0 }
            });
        }
        return out_;
    }

    /// <summary>
    /// 0100 — WIE EIN HAKEN: je Einsendung und Schritt „Wybierz termin" der
    /// jüngste Termin, den ihr Platz bei dem Zasób hält oder erbeten hat
    /// (wartend zählt: der Mensch hat getan, was an ihm war). Mit dem Termin
    /// selbst, damit man sieht, welcher.
    /// </summary>
    internal static async Task<Dictionary<Guid, List<object>>> BookingMarksAsync(
        SqlConnection connection, string registrationIdsSql, Action<SqlCommand> bind, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<object>>();
        await using var cmd = new SqlCommand($"""
            SELECT r.id, s.id, c.status, c.starts_at, c.ends_at, c.created_at
            FROM app.registration r
            JOIN app.form_step s ON s.module_id = r.part_id AND s.kind = N'booking'
            CROSS APPLY (
                SELECT TOP 1 x.status, x.starts_at, x.ends_at, x.created_at
                FROM app.claim x
                WHERE x.resource_id = s.resource_id AND x.access_id = r.access_id
                  AND x.status IN (N'pending', N'confirmed')
                ORDER BY x.starts_at DESC
            ) c
            WHERE r.id IN ({registrationIdsSql}) AND r.access_id IS NOT NULL;
            """, connection);
        bind(cmd);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var key = reader.GetGuid(0);
            if (!out_.TryGetValue(key, out var list)) out_[key] = list = [];
            list.Add(new
            {
                stepId = Ids.ToText(reader.GetGuid(1)),
                doneAt = reader.GetDateTimeOffset(5),
                byPerson = true,
                booking = new { status = reader.GetString(2), startsAt = reader.GetDateTimeOffset(3), endsAt = reader.GetDateTimeOffset(4) }
            });
        }
        return out_;
    }

}
