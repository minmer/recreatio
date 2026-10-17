using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// AUFGABEN (0054) — was zu tun ist, und wann.
///
/// <code>
///   window   ein Zeitfenster, das wiederkehren kann: ein Gebet zwischen 21:00
///            und 21:15, jeden Tag. Erledigt wird ein VORKOMMEN; eines, dessen
///            Fenster vorbei ist, ohne dass es erledigt wurde, ist versäumt.
///   after    ein Abstand nach dem letzten Erledigen: Blumen gießen alle drei
///            Tage. Fällig ist sie, wenn der Abstand um ist; wer sie erledigt,
///            stellt die Uhr neu.
///   period   (0066) ein Zeitraum, der in festem Abstand wiederkommt: drei
///            Tage Zeit, alle zwei Wochen. Sie steht ab Beginn da und wird
///            dringender, bis der Zeitraum endet — wie ein Fenster, nur dass
///            der Abstand frei ist und nicht dem Kalender folgt.
/// </code>
///
/// <para>
/// <b>Erinnerungen</b> (0066, <c>remind_mask</c>): am Anfang (1), in der
/// Mitte (2), gegen Ende (4) eines Vorkommens. Die Zeitpunkte stehen in der
/// Antwort (<c>reminders</c>); erinnern tut der Browser bzw. die App.
/// </para>
///
/// <para>
/// <b>Wie ein Termin gehört eine Aufgabe Leuten</b> — sich allein (dem
/// eigenen Bereich) oder einem Bereich. Titel und Notiz liegen versiegelt
/// unter dessen Schlüssel; wer dort schreibt, darf sie auch abhaken, und es
/// steht dabei, wer.
/// </para>
///
/// <para>
/// <b>Die Zeit bleibt im Klartext</b>, aus demselben Grund wie im Kalender:
/// sonst liesse sich nicht ausrechnen, was fällig ist, ohne alles
/// herunterzuladen. Die Reihe rechnet dieselbe Funktion wie der Kalender
/// (<see cref="Calendar.Occurrences"/>) — zwei Fassungen liefen auseinander.
/// </para>
/// </summary>
public static partial class Tasks
{
    private const int MaxTitle = 4096;
    private const int MaxNotes = 64 * 1024;
    private const int MaxEveryMinutes = 366 * 24 * 60;

    /// <summary>Wie ck_task_window (0055): ein Fenster oder Zeitraum steht höchstens ein Jahr offen.</summary>
    private const int MaxWindowMinutes = 527040;

    /// <summary>So viele Vorkommen eines Zeitraums rechnet eine Antwort höchstens aus.</summary>
    private const int MaxPeriods = 1000;

    /// <summary>
    /// 0088 — so viele OFFENE VORKOMMEN VON FRÜHER gibt eine Antwort je Aufgabe mit
    /// (die jüngsten); wie viele es darüber hinaus sind, sagt `overdueMore`.
    /// </summary>
    private const int MaxOverdue = 30;

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/tasks", ListAsync);
        app.MapPost("/workspace/tasks", CreateAsync);
        app.MapPost("/workspace/task/{id:guid}", UpdateAsync);
        app.MapPost("/workspace/task/{id:guid}/archive", ArchiveAsync);
        app.MapPost("/workspace/task/{id:guid}/done", DoneAsync);
        app.MapPost("/workspace/task/{id:guid}/skip", SkipAsync);
        app.MapPost("/workspace/task/{id:guid}/undone", UndoneAsync);
    }

    public sealed record TaskRequest(
        string? TaskId, string AreaId, string OwnerRoleId, string Kind,
        string Date, string Time, int? WindowMinutes, int? EveryMinutes,
        string? Repeat, int? Every, int? Weekdays, string? Until, int? Count,
        int Epoch, string TitleSealed, string? NotesSealed, string? TimeZone,

        /* 0066 — Erinnerungen (1 Anfang, 2 Mitte, 4 Ende) und woher die Aufgabe kommt. */
        int? Remind = null, string? ChatId = null, string? TopicId = null, string? MessageId = null);

    private sealed record Parsed(
        Guid AreaId, Guid Owner, string Kind, string Zone, DateTimeOffset StartsAt, int WindowMinutes,
        int? EveryMinutes, string Repeat, int Every, int? Weekdays, DateTimeOffset? Until, int? Count,
        int Epoch, byte[] Title, byte[]? Notes, int Remind, Guid? ChatId, Guid? TopicId, Guid? MessageId);

    /// <summary>Was an einem Antrag nicht stimmt — für die Prüfungen ohne Datenbank.</summary>
    public static string? Check(TaskRequest body)
    {
        Parse(body, out var error);
        return error.Length == 0 ? null : error;
    }

    private static Parsed? Parse(TaskRequest body, out string error)
    {
        error = string.Empty;
        var kind = (body.Kind ?? string.Empty).Trim().ToLowerInvariant();
        if (kind is not ("window" or "after" or "period")) { error = "Rodzaj zadania: o określonej porze, co pewien czas albo w okresie."; return null; }

        if (!Guid.TryParse(body.AreaId, out var area) || !Guid.TryParse(body.OwnerRoleId, out var owner))
        {
            error = "Nieczytelna kennung."; return null;
        }

        var zoneName = string.IsNullOrWhiteSpace(body.TimeZone) || Zones.Find(body.TimeZone.Trim()) is null
            ? Zones.Home : body.TimeZone.Trim();
        var zone = Zones.Of(zoneName);

        if (!DateOnly.TryParse(body.Date, out var day) || !TimeOnly.TryParse(body.Time, out var hour))
        {
            error = "Nie ma takiej daty albo godziny."; return null;
        }

        var repeat = (body.Repeat ?? "none").Trim().ToLowerInvariant();
        if (repeat is not ("none" or "daily" or "weekly" or "monthly" or "yearly")) { error = "Nieznane powtórzenie."; return null; }

        int? every = null;
        var window = Math.Clamp(body.WindowMinutes ?? 0, 0, MaxWindowMinutes);

        if (kind == "after")
        {
            if (body.EveryMinutes is null or < 1 or > MaxEveryMinutes)
            {
                error = "Co ile? Od minuty do roku."; return null;
            }
            every = body.EveryMinutes;
            repeat = "none";
            window = 0;
        }

        /*
            0066 — EIN ZEITRAUM: so lange Zeit, und so oft. Der Abstand misst
            von Beginn zu Beginn; kürzer als die Dauer ginge nicht — dann lägen
            zwei Vorkommen übereinander, und keines wäre je vorbei.
        */
        if (kind == "period")
        {
            if (window < 1) { error = "Ile czasu na zadanie? Co najmniej minuta."; return null; }
            if (body.EveryMinutes is null || body.EveryMinutes < window || body.EveryMinutes > MaxEveryMinutes)
            {
                error = "Co ile wraca? Nie rzadziej niż co rok i nie częściej, niż trwa."; return null;
            }
            every = body.EveryMinutes;
            repeat = "none";
        }

        var remind = body.Remind ?? 0;
        if (remind is < 0 or > 7) { error = "Przypomnienie: na początku, w połowie albo pod koniec."; return null; }

        Guid? chatId = null, topicId = null, messageId = null;
        if (!string.IsNullOrWhiteSpace(body.ChatId))
        {
            if (!Guid.TryParse(body.ChatId, out var c)) { error = "Nieczytelna kennung rozmowy."; return null; }
            chatId = c;
            if (!string.IsNullOrWhiteSpace(body.TopicId))
            {
                if (!Guid.TryParse(body.TopicId, out var t)) { error = "Nieczytelna kennung tematu."; return null; }
                topicId = t;
            }
            if (!string.IsNullOrWhiteSpace(body.MessageId))
            {
                if (!Guid.TryParse(body.MessageId, out var m)) { error = "Nieczytelna kennung wiadomości."; return null; }
                messageId = m;
            }
        }

        byte[] title;
        byte[]? notes = null;
        try
        {
            title = Base64Url.Decode(body.TitleSealed ?? string.Empty);
            if (!string.IsNullOrWhiteSpace(body.NotesSealed)) notes = Base64Url.Decode(body.NotesSealed);
        }
        catch (FormatException) { error = "Nieczytelna zapieczętowana treść."; return null; }

        if (title.Length is 0 or > MaxTitle) { error = "Zadanie potrzebuje nazwy."; return null; }
        if (notes is not null && notes.Length > MaxNotes) { error = "Notatka jest za długa."; return null; }
        if (body.Epoch < 1) { error = "Nieczytelna epoka."; return null; }

        var starts = Zones.AtLocal(day.ToDateTime(hour), zone);

        DateTimeOffset? until = null;
        if (repeat != "none" && !string.IsNullOrWhiteSpace(body.Until) && DateOnly.TryParse(body.Until, out var end))
        {
            until = Zones.AtLocal(end.ToDateTime(new TimeOnly(23, 59, 59)), zone);
        }

        int? weekdays = repeat == "weekly"
            ? ((body.Weekdays ?? 0) == 0 ? Zones.BitOf(starts.DayOfWeek) : (body.Weekdays!.Value & 127))
            : null;

        return new Parsed(area, owner, kind, zoneName, starts, window, every, repeat,
            Math.Clamp(body.Every ?? 1, 1, 52), weekdays, until, repeat == "none" ? null : body.Count,
            body.Epoch, title, notes, remind, chatId, topicId, messageId);
    }

    /// <summary>Darf dieses Konto hier schreiben, und ist die Person seine? Sonst die Antwort, warum nicht.</summary>
    private static async Task<string?> RefusalAsync(SqlConnection connection, Guid accountId, Parsed task, CancellationToken ct)
    {
        if (!await Area.MayAsync(connection, accountId, task.AreaId, Capability.Write, ct))
            return "W tym obszarze nie możesz dodawać zadań.";

        var mine = await Workspace.RolesOfAsync(connection, accountId, ct);
        if (!mine.Any(r => r.Id == task.Owner) || Workspace.IsAccount(mine, task.Owner))
            return "To nie jest Twoja osoba ani rola.";

        /* 0066 — eine Rozmowa nennen darf nur, wer sie lesen kann; und das Thema muss ihres sein. */
        if (task.ChatId is not null && !await Calendar.ChatLinkAllowedAsync(connection, accountId, task.ChatId.Value, task.TopicId, ct))
            return "Tej rozmowy albo tematu nie widzisz.";

        await using var cmd = new SqlCommand("SELECT current_epoch FROM app.area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", task.AreaId);
        var current = (int)(await cmd.ExecuteScalarAsync(ct))!;
        return task.Epoch > current ? "Nie ma takiej epoki obszaru." : null;
    }

    private static void Bind(SqlCommand cmd, Parsed task, DateTimeOffset now)
    {
        cmd.Parameters.AddWithValue("@area", task.AreaId);
        cmd.Parameters.AddWithValue("@owner", task.Owner);
        cmd.Parameters.AddWithValue("@kind", task.Kind);
        cmd.Parameters.AddWithValue("@zone", task.Zone);
        cmd.Parameters.AddWithValue("@starts", task.StartsAt);
        cmd.Parameters.AddWithValue("@window", task.WindowMinutes);
        cmd.Parameters.AddWithValue("@everym", (object?)task.EveryMinutes ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@rkind", task.Repeat);
        cmd.Parameters.AddWithValue("@revery", task.Every);
        cmd.Parameters.AddWithValue("@rdays", (object?)task.Weekdays ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@runtil", (object?)task.Until ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@rcount", (object?)task.Count ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@epoch", task.Epoch);
        cmd.Parameters.AddBlob("@title", task.Title);
        cmd.Parameters.AddBlob("@notes", task.Notes);
        cmd.Parameters.AddWithValue("@now", now);
        cmd.Parameters.AddWithValue("@remind", (byte)task.Remind);
        cmd.Parameters.AddWithValue("@chat", (object?)task.ChatId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@topic", (object?)task.TopicId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@message", (object?)task.MessageId ?? DBNull.Value);
    }

    /// <summary>
    /// Eine Aufgabe anlegen. Die Kennung kommt aus dem Browser: die AAD von
    /// Titel und Notiz nennt sie, und versiegelt wird, bevor der Dienst antwortet.
    /// </summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, TaskRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.TaskId, out var id))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zadanie musi przyjść z własną kennung — jej nazwa jest w pieczęci.");
            return;
        }

        var task = Parse(body, out var error);
        if (task is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var refused = await RefusalAsync(connection, who.Value.AccountId, task, ctx.RequestAborted);
        if (refused is not null) { await Fail(ctx, StatusCodes.Status403Forbidden, refused); return; }

        await using var insert = new SqlCommand("""
            INSERT INTO app.task
                (id, area_id, owner_role_id, kind, time_zone, starts_at, window_minutes, every_minutes,
                 repeat_kind, repeat_every, repeat_weekdays, repeat_until, repeat_count,
                 epoch, title_sealed, notes_sealed, created_at, updated_at,
                 remind_mask, chat_id, topic_id, message_id)
            VALUES (@id, @area, @owner, @kind, @zone, @starts, @window, @everym,
                    @rkind, @revery, @rdays, @runtil, @rcount,
                    @epoch, @title, @notes, @now, @now,
                    @remind, @chat, @topic, @message);
            """, connection);
        insert.Parameters.AddWithValue("@id", id);
        Bind(insert, task, DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "To zadanie już jest.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { taskId = Ids.ToText(id), startsAt = task.StartsAt });
    }

    /// <summary>Eine Aufgabe ändern — Zeit, Art, Leute, Titel. Was schon erledigt war, bleibt erledigt.</summary>
    private static async Task UpdateAsync(HttpContext ctx, Db db, Guid id, TaskRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var task = Parse(body, out var error);
        if (task is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaOf = await AreaOfAsync(connection, id, ctx.RequestAborted);
        if (areaOf is null || !await Area.MayAsync(connection, who.Value.AccountId, areaOf.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zadania nie ma.");
            return;
        }

        var refused = await RefusalAsync(connection, who.Value.AccountId, task, ctx.RequestAborted);
        if (refused is not null) { await Fail(ctx, StatusCodes.Status403Forbidden, refused); return; }

        await using var update = new SqlCommand("""
            UPDATE app.task
               SET area_id = @area, owner_role_id = @owner, kind = @kind, time_zone = @zone, starts_at = @starts,
                   window_minutes = @window, every_minutes = @everym,
                   repeat_kind = @rkind, repeat_every = @revery, repeat_weekdays = @rdays,
                   repeat_until = @runtil, repeat_count = @rcount,
                   epoch = @epoch, title_sealed = @title, notes_sealed = @notes, updated_at = @now,
                   remind_mask = @remind,
                   /* Woher sie kommt, ändert sich beim Bearbeiten nicht — nur wenn es mitgeschickt wird. */
                   chat_id = COALESCE(@chat, chat_id), topic_id = CASE WHEN @chat IS NULL THEN topic_id ELSE @topic END,
                   message_id = CASE WHEN @chat IS NULL THEN message_id ELSE @message END
             WHERE id = @id;
            """, connection);
        update.Parameters.AddWithValue("@id", id);
        Bind(update, task, DateTimeOffset.UtcNow);
        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { taskId = Ids.ToText(id), startsAt = task.StartsAt });
    }

    /// <summary>Weglegen — nicht löschen: wer sie abgehakt hat, und wann, bleibt nachzulesen.</summary>
    private static async Task ArchiveAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaOf = await AreaOfAsync(connection, id, ctx.RequestAborted);
        if (areaOf is null || !await Area.MayAsync(connection, who.Value.AccountId, areaOf.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zadania nie ma.");
            return;
        }

        await using var cmd = new SqlCommand(
            "UPDATE app.task SET archived_at = @now, updated_at = @now WHERE id = @id AND archived_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { taskId = Ids.ToText(id), archived = true });
    }

private static async Task<Guid?> AreaOfAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT area_id FROM app.task WHERE id = @id AND archived_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    private static async Task<Stored?> StoredAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand($"SELECT {Columns} FROM app.task WHERE id = @id AND archived_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? Read(reader) : null;
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
