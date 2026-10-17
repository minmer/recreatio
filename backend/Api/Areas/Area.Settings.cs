using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Einstellungen eines Bereichs: offenlegen, Portal, Eltern, öffentliche Stufe, Stufe der Plätze, auflösen, umbenennen.</summary>
public static partial class Area
{
    /* -- Offenlegen --------------------------------------------------------- */

    public sealed record PublishRequest(int Epoch, string Key);

    /// <summary>
    /// Einen Epochenschlüssel offenlegen.
    ///
    /// <para>
    /// <b>Das ist keine Einstellung, sondern eine Tatsache.</b> Danach steht der
    /// Schlüssel da, und jeder öffnet, was unter dieser Epoche liegt. Der Dienst
    /// muss dafür nichts beachten — es gibt nichts mehr zu verschweigen.
    /// </para>
    ///
    /// <para>
    /// <b>Und es ist nicht rückgängig zu machen.</b> Wer ihn gesehen hat, hat
    /// ihn. `key_public` wieder zu leeren verschlösse nichts; wer Künftiges
    /// schützen will, schneidet eine neue Epoche. Deshalb nimmt diese Stelle
    /// auch keinen Rückzieher entgegen — ein Knopf, der nichts bewirkt, wäre
    /// eine Lüge.
    /// </para>
    /// </summary>
    private static async Task PublishAsync(HttpContext ctx, Db db, Guid id, PublishRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        byte[] key;
        try { key = Base64Url.Decode(body.Key ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
            return;
        }

        if (key.Length != KeySize)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Klucz ma 32 bajty.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * `admin` und nicht `certify`: jemanden hereinzulassen ist eine
         * Entscheidung über EINEN Menschen, das Offenlegen eine über ALLE. Das
         * ist nicht dieselbe Schwere.
         */
        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.area_epoch SET key_public = @key
            WHERE area_id = @area AND epoch = @epoch AND key_public IS NULL;
            """, connection);

        cmd.Parameters.AddWithValue("@key", key);
        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@epoch", body.Epoch);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            /*
             * Entweder gibt es die Epoche nicht, oder sie liegt schon offen.
             * Beides ist kein Schaden: im zweiten Fall ist das Ziel erreicht,
             * und den ersten Fall auszuweisen hiesse, die Epochen eines
             * fremden Bereichs abzählen zu lassen.
             */
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Tej epoki nie ma albo jest już jawna.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            epoch = body.Epoch,
            published = true
        });
    }

    /// <summary>
    /// Einen offengelegten Epochenschlüssel holen — OHNE Konto.
    ///
    /// <para>
    /// Das ist die Gegenseite von <see cref="PublishAsync"/> und der Grund,
    /// warum „öffentlich" hier etwas bedeutet: ein Besucher, den die Plattform
    /// nicht kennt, bekommt den Schlüssel und öffnet damit, was offen sein soll.
    /// </para>
    ///
    /// <para>
    /// Eine nicht offengelegte Epoche antwortet wie eine, die es nicht gibt.
    /// Der Unterschied ginge sonst als Verzeichnis hinaus.
    /// </para>
    /// </summary>
    private static async Task PublicKeyAsync(HttpContext ctx, Db db, Guid id, int? epoch)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand(epoch is null
            ? """
              SELECT TOP 1 epoch, key_public FROM app.area_epoch
              WHERE area_id = @area AND key_public IS NOT NULL
              ORDER BY epoch DESC;
              """
            : """
              SELECT epoch, key_public FROM app.area_epoch
              WHERE area_id = @area AND epoch = @epoch AND key_public IS NOT NULL;
              """, connection);

        cmd.Parameters.AddWithValue("@area", id);
        if (epoch is not null) cmd.Parameters.AddWithValue("@epoch", epoch.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);

        if (!await reader.ReadAsync(ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nic tu nie jest jawne.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            epoch = reader.GetInt32(0),
            key = Base64Url.Encode((byte[])reader[1])
        });
    }

    /* -- Gemeinsames -------------------------------------------------------- */

    /// <summary>
    /// Darf diese Person hier, was sie vorhat?
    ///
    /// <para>
    /// Gefragt wird über ALLE erreichbaren Rollen — Erreichbarkeit im
    /// Rollengraphen IST der Weg zum Schlüssel (Kernel: RoleKeys), und eine
    /// zweite Auffassung davon liefe irgendwann anders.
    /// </para>
    /// </summary>
    /*
     * `internal`, nicht `private`: der Kalender fragt dieselbe Frage, und zwar
     * an vier Stellen. Eine zweite Fassung davon waere eine zweite Meinung
     * darueber, wer wo darf — und die eine davon liefe irgendwann anders.
     */
    /* -- Die Vorlage des Portals (0028) ------------------------------------ */

    public sealed record PortalRequest(string? Path);

    private static async Task PortalAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("""
            SELECT s.path FROM app.area_portal p
            JOIN app.slug s ON s.id = p.slug_id
            WHERE p.area_id = @area;
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            path = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as string
        });
    }

    /// <summary>
    /// Eine Seite zur Vorlage des Portals erklaeren — oder die Erklaerung
    /// zuruecknehmen (<c>path = null</c>).
    ///
    /// <para>
    /// <b>ZWEI Rechte, wie beim Formularfeld.</b> Wer die Vorlage bestimmt,
    /// entscheidet, was jeder Platz dieses Bereichs zu sehen bekommt — dafuer
    /// braucht er das Recht am BEREICH. Und er bindet eine fremde Seite ein —
    /// dafuer braucht er das Recht an DIESER ADRESSE. Eines allein genuegte,
    /// um eine fremde Seite in ein fremdes Portal zu haengen.
    /// </para>
    ///
    /// <para>
    /// <b>Oeffentlich sollte sie nicht sein</b>, und der Dienst sagt es, statt
    /// es zu erzwingen: eine Vorlage ohne <c>internal_for_role_id</c> (0026)
    /// steht auch unter ihrer eigenen Adresse. Manchmal ist genau das gewollt —
    /// deshalb ein Hinweis in der Antwort und keine Ablehnung.
    /// </para>
    /// </summary>
    private static async Task SetPortalAsync(HttpContext ctx, Db db, Guid id, PortalRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        if (string.IsNullOrWhiteSpace(body.Path))
        {
            await using var drop = new SqlCommand(
                "DELETE FROM app.area_portal WHERE area_id = @area;", connection);

            drop.Parameters.AddWithValue("@area", id);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

            await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), path = (string?)null });
            return;
        }

        var path = Slug.Normalise(body.Path);

        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
        }

        Guid slugId;
        bool isInternal;

        await using (var find = new SqlCommand(
            "SELECT s.id, COALESCE(CAST(s.internal_for_role_id AS nvarchar(36)), (SELECT TOP 1 N'area' FROM app.slug_area w WHERE w.slug_id = s.id)) FROM app.slug s WHERE s.path = @p;", connection))
        {
            find.Parameters.AddWithValue("@p", path);

            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
                return;
            }

            slugId = reader.GetGuid(0);
            isInternal = !reader.IsDBNull(1);
        }

        await using (var save = new SqlCommand("""
            MERGE app.area_portal AS target
            USING (SELECT @area AS area_id) AS source ON target.area_id = source.area_id
            WHEN MATCHED THEN UPDATE SET slug_id = @slug
            WHEN NOT MATCHED THEN INSERT (area_id, slug_id, created_at) VALUES (@area, @slug, @now);
            """, connection))
        {
            save.Parameters.AddWithValue("@area", id);
            save.Parameters.AddWithValue("@slug", slugId);
            save.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            path,

            /*
             * Keine Ablehnung, eine Auskunft: die Vorlage steht sonst auch unter
             * ihrer eigenen Adresse, und wer das nicht will, macht sie intern.
             */
            warning = isInternal ? null
                : "Ta strona jest publiczna — każdy, kto zna jej adres, zobaczy szablon portalu. "
                  + "Ustaw w drzewie adresów „Tylko z dostępem” (obszary), żeby zniknęła dla postronnych."
        });
    }

    public sealed record PublicRequest(string Level, string? Key);

    /// <summary>
    /// Wie weit dieser Bereich nach aussen offen steht (0035).
    ///
    /// <code>
    ///   none    niemand von aussen
    ///   read    jeder darf lesen        (Messzeiten)
    ///   write   jeder darf lesen und einsenden
    /// </code>
    ///
    /// <para>
    /// <b>Absicht und Schluessel gehen zusammen.</b> Lesen von aussen ist
    /// nicht eine Erlaubnis, sondern ein SCHLUESSEL: wer ihn hat, liest. Diese
    /// Stelle setzt deshalb beides in einem Zug — wer hochsetzt, schickt den
    /// veroeffentlichten Epochenschluessel mit; wer auf <c>none</c> zurueckgeht,
    /// nimmt ihn zurueck.
    /// </para>
    ///
    /// <para>
    /// <b>Zuruecknehmen ist kein Ungeschehenmachen</b>, und der Dienst tut auch
    /// nicht so. Wer den Schluessel gelesen hat, hat ihn; was aufhoert, ist der
    /// Zugriff auf das, was danach kommt. Solange es keine Epochenrotation
    /// gibt, gilt das uneingeschraenkt, und die Oberflaeche hat es zu sagen.
    /// </para>
    /// </summary>
    private static async Task SetPublicAsync(HttpContext ctx, Db db, Guid id, PublicRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var level = (body.Level ?? string.Empty).Trim().ToLowerInvariant();

        if (level is not ("none" or "read" or "write"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Otwartość: none, read albo write.");
            return;
        }

        byte[]? key = null;

        if (level != "none")
        {
            try { key = Base64Url.Decode(body.Key ?? string.Empty); }
            catch (FormatException)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
                return;
            }

            if (key.Length != KeySize)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Żeby otworzyć obszar, trzeba podać jego klucz epoki (32 bajty).");
                return;
            }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        if (level != "none" && await PersonalOwnerAsync(connection, id, ctx.RequestAborted) is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, PersonalStaysPersonal);
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var set = new SqlCommand(
                "UPDATE app.area SET public_level = @level WHERE id = @id;", connection, tx))
            {
                set.Parameters.AddWithValue("@level", level);
                set.Parameters.AddWithValue("@id", id);
                await set.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var epoch = new SqlCommand("""
                UPDATE app.area_epoch SET key_public = @key
                WHERE area_id = @area AND epoch = (SELECT current_epoch FROM app.area WHERE id = @area);
                """, connection, tx))
            {
                epoch.Parameters.AddBlob("@key", key);
                epoch.Parameters.AddWithValue("@area", id);
                await epoch.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), publicLevel = level });
    }

    public sealed record SeatLevelRequest(string Level);

    /// <summary>
    /// Was jemand sieht, der ueber ein FORMULAR hereinkommt (0035).
    ///
    /// <code>
    ///   own     nur das Eigene (Vorgabe)
    ///   read    dazu das Gemeinsame lesen
    ///   write   dazu beitragen
    /// </code>
    ///
    /// <para>
    /// <b>Das Eigene ist nie die Frage.</b> Wer sich anmeldet, bekommt einen
    /// Platz und damit vollen Zugriff auf seine eigene Einsendung — sie gehoert
    /// ihm. Hier geht es nur um das Uebrige.
    /// </para>
    ///
    /// <para>
    /// <b>Die Stufe haengt am BEREICH und nicht am Formular.</b> Das Formular
    /// sagt, wohin es fuehrt; was man dort sieht, sagt der Verwalter — einmal,
    /// und nicht je Anmeldung.
    /// </para>
    /// </summary>
    private static async Task SetSeatLevelAsync(HttpContext ctx, Db db, Guid id, SeatLevelRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var level = (body.Level ?? string.Empty).Trim().ToLowerInvariant();

        if (level is not ("own" or "read" or "write"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Dostęp z formularza: own, read albo write.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using (var set = new SqlCommand(
            "UPDATE app.area SET seat_level = @level WHERE id = @id;", connection))
        {
            set.Parameters.AddWithValue("@level", level);
            set.Parameters.AddWithValue("@id", id);
            await set.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), seatLevel = level });
    }

    public sealed record DropRequest(string RoleId);

    /// <summary>
    /// Eine Rolle wieder hinausnehmen.
    ///
    /// <para>
    /// <b>Nur dieser Bereich.</b> Wer innen noch steht, bleibt dort: jeder
    /// Bereich hat seine eigenen Rollen, und aussen hinauszugehen nimmt einem
    /// innen nichts.
    /// </para>
    ///
    /// <para>
    /// <b>Und was er gelesen hat, hat er gelesen.</b> Das Zertifikat faellt,
    /// die Zuteilung faellt — der Schluessel, den sein Browser einmal
    /// ausgepackt hat, faellt nicht. Ohne Epochenrotation gibt es dagegen kein
    /// Mittel, und es waere unredlich, hier etwas anderes anzudeuten.
    /// </para>
    /// </summary>
    private static async Task DropAsync(HttpContext ctx, Db db, Guid id, DropRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.RoleId, out var subjectId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung roli.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Certify, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tu nikogo nie wypuszczasz.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var cmd = new SqlCommand("""
                UPDATE app.certificate SET revoked_at = @now
                WHERE scope_kind = N'area' AND scope_id = @area
                  AND subject_role_id = @role AND revoked_at IS NULL;

                UPDATE app.key_grant SET destroyed_at = @now
                WHERE key_kind = N'epoch' AND key_ref = @area
                  AND role_id = @role AND destroyed_at IS NULL;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                cmd.Parameters.AddWithValue("@area", id);
                cmd.Parameters.AddWithValue("@role", subjectId);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            roleId = Ids.ToText(subjectId),
            dropped = true,

            /* Ehrlich gesagt, nicht verschwiegen. */
            note = "Klucz, który ta rola już otworzyła, zostaje u niej. Odcięty jest dostęp do tego, co dalej."
        });
    }

    public sealed record RenameRequest(string Name);

    /// <summary>
    /// 0081 — EIN BEREICH BEKOMMT EINEN NEUEN NAMEN. Der Name steht offen da
    /// (wie beim Anlegen) — beim Baustein „Napisz do nas" ist er das, was der
    /// Mensch mit dem Link liest: „Napisz do: …". Umbenennen darf, wer ihn führt.
    /// </summary>
    private static async Task RenameAsync(HttpContext ctx, Db db, Guid id, RenameRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var name = (body.Name ?? string.Empty).Trim();
        if (name.Length is 0 or > MaxName)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Obszar potrzebuje nazwy.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Nazwę zmienia ten, kto prowadzi obszar.");
            return;
        }

        await using var cmd = new SqlCommand("UPDATE app.area SET name = @name WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@name", name);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), name });
    }
}
