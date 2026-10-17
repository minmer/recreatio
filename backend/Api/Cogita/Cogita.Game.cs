using System.Text.Json;
using System.Text.Json.Serialization;
using Kernel;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DAS SPIEL (0109, COGITA.md §11) — die erste Ausnahme von der Blindheit.
///
/// <para>
/// <b>Was der Dienst während eines Spiels lesen darf</b> [J2]: die Zonen
/// (Punkt, Radius, Zeitfenster), die Auslöser, die Werte mit ihrem
/// Kassenbuch und die Positionen der Spieler. Der Gastgeber legt sie beim
/// Start offen; endet das Spiel, löscht der Dienst Positionen und Stand
/// [J3]. Positionen sieht ausser ihm niemand.
/// </para>
///
/// <para>
/// <b>Ausgewertet wird hier</b>, weil ein Spieler sonst sein eigener
/// Schiedsrichter wäre: betritt jemand eine Zone, verlässt er sie, stehen N
/// eines Teams darin, ist eine Zeit um — dann laufen die Aktionen (Wert
/// setzen, addieren, einen Schritt des Ablaufs öffnen) und als offenes
/// Ereignis <c>trigger</c> an alle. Texte stehen nicht darin: die Schritte
/// liegen versiegelt im Ablauf, hier nur ihre Kennungen.
/// </para>
///
/// <para>
/// <b>Gefälschte Positionen</b> erkennt das Gerät des Gastgebers [J4] — es
/// sieht Sprünge und Geschwindigkeiten; der Dienst nimmt, was kommt.
/// </para>
/// </summary>
public static partial class Cogita
{
    private const int MaxRules = 256 * 1024;
    private const int MaxLedger = 500;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private static void MapGame(WebApplication app)
    {
        app.MapPost("/cogita/session/{id:guid}/game", GameRulesAsync);
        app.MapGet("/cogita/session/{id:guid}/game", GameAsync);
        app.MapPost("/cogita/session/{id:guid}/position", PositionAsync);
        app.MapPost("/cogita/session/{id:guid}/game/value", GameValueAsync);
    }

    /* -- Das Modell ---------------------------------------------------------------------- */

    public sealed record Zone(string Id, double Lat, double Lon, double Radius, DateTimeOffset? From, DateTimeOffset? To);

    public sealed record ValueDef(string Id, string Scope, double Initial, double? Min, double? Max);

    public sealed record GameAction(string Do, string? Value, double? By, double? To, string? Step, string? Target);

    public sealed record Trigger(string Id, string On, string? Zone, int? Count, int? Seconds, bool Once, string? Team, IReadOnlyList<GameAction>? Actions);

    public sealed record GameRules(IReadOnlyList<Zone>? Zones, IReadOnlyList<ValueDef>? Values, IReadOnlyList<Trigger>? Triggers);

    public sealed class LedgerLine
    {
        public DateTimeOffset At { get; set; }
        public string Trigger { get; set; } = "";
        public string Target { get; set; } = "";
        public string Value { get; set; } = "";
        public double Before { get; set; }
        public double After { get; set; }
    }

    public sealed class GameState
    {
        /* Je Ziel („player:<id>", „team:<name>", „session") die Werte. */
        public Dictionary<string, Dictionary<string, double>> Values { get; set; } = [];
        public List<LedgerLine> Ledger { get; set; } = [];
        /* Wer in welchen Zonen steht. */
        public Dictionary<string, List<string>> Inside { get; set; } = [];
        /* Was schon ausgelöst hat (für „einmal" und für die Flanke bei „N sind da"). */
        public HashSet<string> Fired { get; set; } = [];
        /* Wann ein Takt zuletzt kam. */
        public Dictionary<string, DateTimeOffset> Ticks { get; set; } = [];
        /* Wer zu welchem Team gehört (wie er sich gemeldet hat). */
        public Dictionary<string, string> Teams { get; set; } = [];
    }

    private static readonly HashSet<string> TriggerOn = new(StringComparer.Ordinal) { "enter", "leave", "present", "every" };
    private static readonly HashSet<string> ActionDo = new(StringComparer.Ordinal) { "add", "set", "open", "notice" };
    private static readonly HashSet<string> Scopes = new(StringComparer.Ordinal) { "player", "team", "session" };

    /// <summary>Was an Regeln nicht stimmt — <c>null</c>: alles gut.</summary>
    public static string? RulesProblem(GameRules rules)
    {
        var zones = rules.Zones ?? [];
        var values = rules.Values ?? [];
        var triggers = rules.Triggers ?? [];
        if (zones.Count > 500 || values.Count > 100 || triggers.Count > 500) return "Za dużo stref, wartości albo wyzwalaczy.";
        var zoneIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var z in zones)
        {
            if (string.IsNullOrWhiteSpace(z.Id) || z.Id.Length > 64 || !zoneIds.Add(z.Id)) return "Strefa bez znaku albo podwójna.";
            if (Math.Abs(z.Lat) > 90 || Math.Abs(z.Lon) > 180 || z.Radius is < 1 or > 100_000) return $"Strefa {z.Id}: nieczytelne miejsce albo promień.";
        }
        var valueIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var v in values)
        {
            if (string.IsNullOrWhiteSpace(v.Id) || v.Id.Length > 64 || !valueIds.Add(v.Id)) return "Wartość bez znaku albo podwójna.";
            if (!Scopes.Contains(v.Scope)) return $"Wartość {v.Id}: zasięg player, team albo session.";
        }
        foreach (var t in triggers)
        {
            if (string.IsNullOrWhiteSpace(t.Id) || t.Id.Length > 64 || !TriggerOn.Contains(t.On)) return "Wyzwalacz bez znaku albo nieznany.";
            if (t.On is "enter" or "leave" or "present" && (t.Zone is null || !zoneIds.Contains(t.Zone))) return $"Wyzwalacz {t.Id}: nie ma takiej strefy.";
            if (t.On == "present" && t.Count is not (>= 1 and <= 1000)) return $"Wyzwalacz {t.Id}: ile osób (1–1000).";
            if (t.On == "every" && t.Seconds is not (>= 5 and <= 86_400)) return $"Wyzwalacz {t.Id}: co ile sekund (5–86400).";
            foreach (var a in t.Actions ?? [])
            {
                if (!ActionDo.Contains(a.Do)) return $"Wyzwalacz {t.Id}: nieznane działanie.";
                if (a.Do is "add" or "set" && (a.Value is null || !valueIds.Contains(a.Value))) return $"Wyzwalacz {t.Id}: nie ma takiej wartości.";
                if (a.Do == "open" && string.IsNullOrWhiteSpace(a.Step)) return $"Wyzwalacz {t.Id}: który krok otworzyć?";
            }
        }
        return null;
    }

    /* -- Rechnen ------------------------------------------------------------------------- */

    public static double Metres(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6_371_000;
        double Rad(double d) => d * Math.PI / 180;
        var dLat = Rad(lat2 - lat1);
        var dLon = Rad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * R * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static bool Active(Zone z, DateTimeOffset now) => (z.From is null || z.From <= now) && (z.To is null || z.To >= now);

    public static List<string> ZonesAt(GameRules rules, double lat, double lon, DateTimeOffset now) =>
        (rules.Zones ?? []).Where(z => Active(z, now) && Metres(lat, lon, z.Lat, z.Lon) <= z.Radius).Select(z => z.Id).ToList();

    private static string TargetOf(ValueDef def, string? player, string? team) => def.Scope switch
    {
        "player" => player is null ? "" : $"player:{player}",
        "team" => team is null ? "" : $"team:{team}",
        _ => "session"
    };

    /// <summary>Die Aktionen eines Auslösers anwenden — die Werte im Rahmen, jede Änderung ins Kassenbuch.</summary>
    public static List<object> Apply(GameRules rules, GameState state, Trigger trigger, string? player, string? team, DateTimeOffset now)
    {
        var done = new List<object>();
        var defs = (rules.Values ?? []).ToDictionary(v => v.Id, StringComparer.Ordinal);
        foreach (var action in trigger.Actions ?? [])
        {
            if (action.Do is "open" or "notice")
            {
                done.Add(new { @do = action.Do, step = action.Step, target = action.Target ?? "player" });
                continue;
            }
            if (action.Value is null || !defs.TryGetValue(action.Value, out var def)) continue;
            var target = TargetOf(def, player, team);
            if (target == "") continue;
            if (!state.Values.TryGetValue(target, out var bag)) state.Values[target] = bag = [];
            var before = bag.TryGetValue(def.Id, out var had) ? had : def.Initial;
            var after = action.Do == "set" ? action.To ?? before : before + (action.By ?? 0);
            if (def.Min is { } min) after = Math.Max(min, after);
            if (def.Max is { } max) after = Math.Min(max, after);
            bag[def.Id] = after;
            state.Ledger.Add(new LedgerLine { At = now, Trigger = trigger.Id, Target = target, Value = def.Id, Before = before, After = after });
            if (state.Ledger.Count > MaxLedger) state.Ledger.RemoveRange(0, state.Ledger.Count - MaxLedger);
            done.Add(new { @do = action.Do, value = def.Id, target, before, after });
        }
        return done;
    }

    /// <summary>Ein Spieler meldet seine Stelle: welche Zonen er betritt und verlässt, und was dabei auslöst.</summary>
    public static List<object> Move(GameRules rules, GameState state, string player, string? team, double lat, double lon, DateTimeOffset now)
    {
        if (team is not null) state.Teams[player] = team;
        var was = state.Inside.TryGetValue(player, out var before) ? before : [];
        var now_ = ZonesAt(rules, lat, lon, now);
        state.Inside[player] = now_;
        var fired = new List<object>();

        foreach (var trigger in rules.Triggers ?? [])
        {
            if (trigger.On is not ("enter" or "leave") || trigger.Zone is null) continue;
            if (trigger.Team is not null && trigger.Team != team) continue;
            var hit = trigger.On == "enter" ? !was.Contains(trigger.Zone) && now_.Contains(trigger.Zone) : was.Contains(trigger.Zone) && !now_.Contains(trigger.Zone);
            if (!hit) continue;
            var key = $"{trigger.Id}:{player}";
            if (trigger.Once && state.Fired.Contains(key)) continue;
            state.Fired.Add(key);
            fired.Add(new { trigger = trigger.Id, on = trigger.On, zone = trigger.Zone, player, team, actions = Apply(rules, state, trigger, player, team, now) });
        }
        return fired;
    }

    /// <summary>
    /// Was die Zeit auslöst: „co N sekund" und „N osób w strefie" (die Flanke —
    /// es löst, wenn es wahr WIRD; ohne „einmal" wieder, sobald es dazwischen
    /// falsch war). <paramref name="fresh"/>: wer in den letzten zwei Minuten
    /// eine Stelle gemeldet hat.
    /// </summary>
    public static List<object> Tick(GameRules rules, GameState state, IReadOnlySet<string> fresh, DateTimeOffset now)
    {
        var fired = new List<object>();
        foreach (var trigger in rules.Triggers ?? [])
        {
            if (trigger.On == "every" && trigger.Seconds is int seconds)
            {
                if (state.Ticks.TryGetValue(trigger.Id, out var last) && (now - last).TotalSeconds < seconds) continue;
                state.Ticks[trigger.Id] = now;
                if (trigger.Once && state.Fired.Contains(trigger.Id)) continue;
                state.Fired.Add(trigger.Id);
                if (trigger.Actions?.Any(a => a.Target == "each") == true)
                {
                    foreach (var player in state.Inside.Keys.Where(fresh.Contains))
                    {
                        var team = state.Teams.GetValueOrDefault(player);
                        fired.Add(new { trigger = trigger.Id, on = "every", player, team, actions = Apply(rules, state, trigger, player, team, now) });
                    }
                }
                else
                {
                    fired.Add(new { trigger = trigger.Id, on = "every", actions = Apply(rules, state, trigger, null, null, now) });
                }
                continue;
            }

            if (trigger.On == "present" && trigger.Zone is not null && trigger.Count is int count)
            {
                var byTeam = state.Inside
                    .Where(p => fresh.Contains(p.Key) && p.Value.Contains(trigger.Zone))
                    .GroupBy(p => state.Teams.GetValueOrDefault(p.Key) ?? "")
                    .ToDictionary(g => g.Key, g => g.Count());
                List<string> teams = trigger.Team is not null ? [trigger.Team] : state.Teams.Values.Append("").Distinct().ToList();
                foreach (var team in teams)
                {
                    var key = $"{trigger.Id}:team:{team}";
                    var edge = $"{key}:on";
                    var there = byTeam.GetValueOrDefault(team) >= count;
                    if (!there) { if (!trigger.Once) state.Fired.Remove(edge); continue; }
                    if (state.Fired.Contains(edge) || (trigger.Once && state.Fired.Contains(key))) continue;
                    state.Fired.Add(edge);
                    state.Fired.Add(key);
                    var name = team == "" ? null : team;
                    fired.Add(new { trigger = trigger.Id, on = "present", zone = trigger.Zone, team = name, actions = Apply(rules, state, trigger, null, name, now) });
                }
            }
        }
        return fired;
    }

    /* -- Speichern ------------------------------------------------------------------------- */

    private static async Task<(GameRules Rules, GameState State)?> LoadGameAsync(SqlConnection connection, Guid id, SqlTransaction? tx, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            $"SELECT rules_json, state_json FROM app.cogita_game_state {(tx is null ? "" : "WITH (UPDLOCK, HOLDLOCK)")} WHERE session_id = @id;", connection, tx);
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        var rules = JsonSerializer.Deserialize<GameRules>(reader.GetString(0), Json) ?? new GameRules([], [], []);
        var state = JsonSerializer.Deserialize<GameState>(reader.GetString(1), Json) ?? new GameState();
        return (rules, state);
    }

    private static async Task SaveStateAsync(SqlConnection connection, SqlTransaction tx, Guid id, GameState state, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("UPDATE app.cogita_game_state SET state_json = @state, updated_at = SYSDATETIMEOFFSET() WHERE session_id = @id;", connection, tx);
        cmd.Parameters.AddWithValue("@state", JsonSerializer.Serialize(state, Json));
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Was ausgelöst hat, als offene Ereignisse an alle.</summary>
    internal static async Task AnnounceAsync(SqlConnection connection, IHubContext<CogitaHub> hub, Guid id, IReadOnlyList<object> fired, string kind, CancellationToken ct)
    {
        if (fired.Count == 0) return;
        var events = fired.Select(f => (Ids.NewId(), kind, (Guid?)null, (Guid?)null, (Guid?)null, 0, (byte[]?)null, (string?)JsonSerializer.Serialize(f, Json))).ToList();
        try
        {
            var rows = await AppendAsync(connection, id, events, ct);
            await BroadcastAsync(hub, id, rows, ct);
        }
        catch (InvalidOperationException) { /* Die Sitzung ist voll — das Spiel geht ohne Meldung weiter. */ }
    }

    /* -- Die Wege ------------------------------------------------------------------------------- */

    /// <summary>Der Gastgeber legt die Regeln offen (und beginnt damit das Spiel neu).</summary>
    private static async Task GameRulesAsync(HttpContext ctx, Db db, Guid id)
    {
        using var body = new StreamReader(ctx.Request.Body);
        var text = await body.ReadToEndAsync(ctx.RequestAborted);
        if (text.Length > MaxRules) { await Fail(ctx, StatusCodes.Status400BadRequest, "Zasady gry: najwyżej 256 kB."); return; }

        GameRules? rules;
        try { rules = JsonSerializer.Deserialize<GameRules>(text, Json); }
        catch (JsonException) { rules = null; }
        if (rules is null) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zasady gry."); return; }
        if (RulesProblem(rules) is { } problem) { await Fail(ctx, StatusCodes.Status400BadRequest, problem); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var presence = await PresenceAsync(ctx, db, connection, id, CredentialsOf(ctx));
        if (presence is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiej sesji nie ma."); return; }
        if (!presence.Host || presence.Session.Kind != "game") { await Fail(ctx, StatusCodes.Status403Forbidden, "Zasady gry ustala gospodarz gry."); return; }

        await using var cmd = new SqlCommand("""
            DELETE FROM app.cogita_game_position WHERE session_id = @id;
            DELETE FROM app.cogita_game_state WHERE session_id = @id;
            INSERT INTO app.cogita_game_state (session_id, rules_json, state_json, updated_at) VALUES (@id, @rules, @state, SYSDATETIMEOFFSET());
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@rules", JsonSerializer.Serialize(rules, Json));
        cmd.Parameters.AddWithValue("@state", JsonSerializer.Serialize(new GameState(), Json));
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { sessionId = Ids.ToText(id), zones = rules.Zones?.Count ?? 0, triggers = rules.Triggers?.Count ?? 0 });
    }

    /// <summary>
    /// Der Stand: der Gastgeber alles samt Positionen; ein Spieler die Zonen,
    /// seine Werte, die seines Teams und die der Sitzung — keine Positionen.
    /// </summary>
    private static async Task GameAsync(HttpContext ctx, Db db, Guid id, string? player, string? team)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var presence = await PresenceAsync(ctx, db, connection, id, CredentialsOf(ctx));
        if (presence is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiej sesji nie ma."); return; }

        var game = await LoadGameAsync(connection, id, null, ctx.RequestAborted);
        if (game is null) { await ctx.Response.WriteAsJsonAsync(new { running = false }); return; }
        var (rules, state) = game.Value;

        if (presence.Host)
        {
            var positions = new List<object>();
            await using var cmd = new SqlCommand("SELECT player, team, lat, lon, accuracy, at FROM app.cogita_game_position WHERE session_id = @id;", connection);
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                positions.Add(new
                {
                    player = reader.GetString(0), team = reader.IsDBNull(1) ? null : reader.GetString(1),
                    lat = reader.GetDouble(2), lon = reader.GetDouble(3), accuracy = reader.IsDBNull(4) ? (double?)null : reader.GetDouble(4),
                    at = reader.GetDateTimeOffset(5)
                });
            }
            await ctx.Response.WriteAsJsonAsync(new { running = true, rules, state, positions });
            return;
        }

        var mine = new Dictionary<string, Dictionary<string, double>>();
        foreach (var key in new[] { player is null ? null : $"player:{player}", team is null ? null : $"team:{team}", "session" })
            if (key is not null && state.Values.TryGetValue(key, out var bag)) mine[key] = bag;
        await ctx.Response.WriteAsJsonAsync(new
        {
            running = true,
            rules = new { zones = rules.Zones, values = rules.Values },
            values = mine,
            inside = player is not null && state.Inside.TryGetValue(player, out var at) ? at : []
        });
    }

    public sealed record PositionRequest(string? Player, string? Team, double Lat, double Lon, double? Accuracy);

    /// <summary>Eine Stelle melden — nur während das Spiel läuft; was sie auslöst, geht an alle.</summary>
    private static async Task PositionAsync(HttpContext ctx, Db db, IHubContext<CogitaHub> hub, Guid id, PositionRequest body)
    {
        var player = (body.Player ?? string.Empty).Trim();
        var team = string.IsNullOrWhiteSpace(body.Team) ? null : body.Team.Trim();
        if (player.Length is 0 or > 80 || team is { Length: > 80 } || Math.Abs(body.Lat) > 90 || Math.Abs(body.Lon) > 180)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne położenie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var presence = await PresenceAsync(ctx, db, connection, id, CredentialsOf(ctx));
        if (presence is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiej sesji nie ma."); return; }
        if (presence.Session.Kind != "game" || presence.Session.State != "running")
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Gra teraz nie trwa — położenia się nie zapisuje.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        List<object> fired;
        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted))
        {
            var game = await LoadGameAsync(connection, id, tx, ctx.RequestAborted);
            if (game is null) { await tx.RollbackAsync(ctx.RequestAborted); await Fail(ctx, StatusCodes.Status409Conflict, "Gra nie ma jeszcze zasad."); return; }

            await using (var upsert = new SqlCommand("""
                UPDATE app.cogita_game_position SET team = @team, lat = @lat, lon = @lon, accuracy = @acc, at = @now WHERE session_id = @id AND player = @player;
                IF @@ROWCOUNT = 0
                    INSERT INTO app.cogita_game_position (session_id, player, team, lat, lon, accuracy, at) VALUES (@id, @player, @team, @lat, @lon, @acc, @now);
                """, connection, tx))
            {
                upsert.Parameters.AddWithValue("@id", id);
                upsert.Parameters.AddWithValue("@player", player);
                upsert.Parameters.AddWithValue("@team", (object?)team ?? DBNull.Value);
                upsert.Parameters.AddWithValue("@lat", body.Lat);
                upsert.Parameters.AddWithValue("@lon", body.Lon);
                upsert.Parameters.AddWithValue("@acc", (object?)body.Accuracy ?? DBNull.Value);
                upsert.Parameters.AddWithValue("@now", now);
                await upsert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            var (rules, state) = game.Value;
            fired = Move(rules, state, player, team, body.Lat, body.Lon, now);
            await SaveStateAsync(connection, tx, id, state, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }

        await AnnounceAsync(connection, hub, id, fired, "trigger", ctx.RequestAborted);
        try { await hub.Clients.Group(CogitaHub.Hosts(id)).SendAsync("pos", new { sessionId = Ids.ToText(id), player, team, lat = body.Lat, lon = body.Lon, accuracy = body.Accuracy, at = now }, ctx.RequestAborted); }
        catch (Exception) { }

        await ctx.Response.WriteAsJsonAsync(new { fired = fired.Count, at = now });
    }

    public sealed record ValueRequest(string? Value, string? Target, double? By, double? To);

    /// <summary>Der Gastgeber ändert einen Wert von Hand (eine Aufgabe am Stand bestanden) — auch das steht im Kassenbuch.</summary>
    private static async Task GameValueAsync(HttpContext ctx, Db db, IHubContext<CogitaHub> hub, Guid id, ValueRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var presence = await PresenceAsync(ctx, db, connection, id, CredentialsOf(ctx));
        if (presence is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiej sesji nie ma."); return; }
        if (!presence.Host) { await Fail(ctx, StatusCodes.Status403Forbidden, "Wartości zmienia gospodarz."); return; }

        var now = DateTimeOffset.UtcNow;
        List<object> done;
        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted))
        {
            var game = await LoadGameAsync(connection, id, tx, ctx.RequestAborted);
            if (game is null) { await tx.RollbackAsync(ctx.RequestAborted); await Fail(ctx, StatusCodes.Status409Conflict, "Gra nie ma jeszcze zasad."); return; }
            var (rules, state) = game.Value;
            var target = (body.Target ?? "session").Trim();
            string? player = target.StartsWith("player:", StringComparison.Ordinal) ? target[7..] : null;
            string? team = target.StartsWith("team:", StringComparison.Ordinal) ? target[5..] : null;
            var manual = new Trigger("manual", "every", null, null, null, false, null,
                [new GameAction(body.To is not null ? "set" : "add", body.Value, body.By, body.To, null, null)]);
            done = Apply(rules, state, manual, player, team, now);
            await SaveStateAsync(connection, tx, id, state, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }

        await AnnounceAsync(connection, hub, id, [new { trigger = "manual", on = "host", actions = done }], "trigger", ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { changed = done.Count });
    }
}

/// <summary>
/// DER TAKT DER SPIELE — alle fünf Sekunden: was die Zeit auslöst (<see
/// cref="Cogita.Tick"/>), und Sitzungen, deren Frist vorbei ist, enden.
/// </summary>
public sealed class CogitaClock(Db db, IHubContext<CogitaHub> hub, ILogger<CogitaClock> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        var round = 0;
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await TickAsync(stoppingToken);
                if (round++ % 12 == 0) await ExpireAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception e)
            {
                /* Fehlen die Tabellen (0109 noch nicht eingespielt), schweigt der Takt bis zum nächsten Mal. */
                if (round % 120 == 1) log.LogWarning(e, "Cogita clock round failed.");
            }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        await using var connection = await db.OpenAsync(ct);
        var running = new List<Guid>();
        await using (var cmd = new SqlCommand("""
            SELECT g.session_id FROM app.cogita_game_state g JOIN app.cogita_session s ON s.id = g.session_id
            WHERE s.kind = N'game' AND s.state = N'running';
            """, connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) running.Add(reader.GetGuid(0));
        }

        foreach (var id in running)
        {
            var now = DateTimeOffset.UtcNow;
            List<object> fired;
            await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct))
            {
                await using var load = new SqlCommand("SELECT rules_json, state_json FROM app.cogita_game_state WITH (UPDLOCK, HOLDLOCK) WHERE session_id = @id;", connection, tx);
                load.Parameters.AddWithValue("@id", id);
                string rulesJson, stateJson;
                await using (var reader = await load.ExecuteReaderAsync(ct))
                {
                    if (!await reader.ReadAsync(ct)) continue;
                    rulesJson = reader.GetString(0);
                    stateJson = reader.GetString(1);
                }
                var options = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);
                var rules = System.Text.Json.JsonSerializer.Deserialize<Cogita.GameRules>(rulesJson, options) ?? new Cogita.GameRules([], [], []);
                if (!(rules.Triggers ?? []).Any(t => t.On is "every" or "present")) { await tx.RollbackAsync(ct); continue; }
                var state = System.Text.Json.JsonSerializer.Deserialize<Cogita.GameState>(stateJson, options) ?? new Cogita.GameState();

                var fresh = new HashSet<string>(StringComparer.Ordinal);
                await using (var players = new SqlCommand("SELECT player FROM app.cogita_game_position WHERE session_id = @id AND at > @since;", connection, tx))
                {
                    players.Parameters.AddWithValue("@id", id);
                    players.Parameters.AddWithValue("@since", now.AddMinutes(-2));
                    await using var reader = await players.ExecuteReaderAsync(ct);
                    while (await reader.ReadAsync(ct)) fresh.Add(reader.GetString(0));
                }

                fired = Cogita.Tick(rules, state, fresh, now);
                await using (var save = new SqlCommand("UPDATE app.cogita_game_state SET state_json = @state, updated_at = SYSDATETIMEOFFSET() WHERE session_id = @id;", connection, tx))
                {
                    save.Parameters.AddWithValue("@state", System.Text.Json.JsonSerializer.Serialize(state, options));
                    save.Parameters.AddWithValue("@id", id);
                    await save.ExecuteNonQueryAsync(ct);
                }
                await tx.CommitAsync(ct);
            }
            await Cogita.AnnounceAsync(connection, hub, id, fired, "trigger", ct);
        }
    }

    /// <summary>Sitzungen ohne festen Takt enden zu ihrer Frist; ein Spiel nimmt dabei Positionen und Stand mit.</summary>
    private async Task ExpireAsync(CancellationToken ct)
    {
        await using var connection = await db.OpenAsync(ct);
        await using var cmd = new SqlCommand("""
            DECLARE @ended TABLE (id uniqueidentifier);
            UPDATE app.cogita_session SET state = N'finished', closed_at = COALESCE(closed_at, SYSDATETIMEOFFSET()), updated_at = SYSDATETIMEOFFSET()
            OUTPUT inserted.id INTO @ended
            WHERE ends_at IS NOT NULL AND ends_at < SYSDATETIMEOFFSET() AND state IN (N'lobby', N'running', N'paused');
            DELETE FROM app.cogita_game_position WHERE session_id IN (SELECT id FROM @ended);
            DELETE FROM app.cogita_game_state WHERE session_id IN (SELECT id FROM @ended);
            """, connection);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
