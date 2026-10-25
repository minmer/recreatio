using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Eine Seite schreiben: Titel, Logik, Gegenstand, Aussehen.</summary>
public static partial class Page
{
    /// <summary>
    /// Die Seite einer Adresse hinausschreiben — die eine Stelle, die das tut.
    ///
    /// <para>
    /// Sie wird von zwei Seiten gerufen: vom Pfad her und vom Namen her. Zwei
    /// Fassungen hiessen zwei Meinungen darüber, wann ein Alias gilt und was
    /// „noch nichts veröffentlicht" bedeutet.
    /// </para>
    /// </summary>
    private static async Task WritePageAsync(
        HttpContext ctx, Db db, SqlConnection connection, string wanted, IReadOnlyList<string> seat, string? links = null)
    {
        Guid slugId, askedId;
        string? title = null, lead = null, aliasOf = null, logic = null, mode = null, theme = null, subject = null, seal = null;
        DateTimeOffset? updatedAt = null;

        /* 0121 — die Hüllen des Seitenschlüssels; vor der Migration gibt es die Spalte nicht. */
        var sealColumn = await SealReadyAsync(connection, ctx.RequestAborted)
            ? "CASE WHEN t.id IS NULL THEN s.page_seal ELSE t.page_seal END"
            : "CAST(NULL AS nvarchar(max))";

        /*
         * EIN ALIAS ZEIGT AUF EINE ANDERE ADRESSE, und von dort kommt alles:
         * Titel, Vorspann, Bausteine. Deshalb wird hier gleich mitgesprungen —
         * zwei Abfragen hintereinander hiessen zwei Runden, und die zweite
         * käme für einen Besucher sichtbar später.
         *
         * Übernommen sein muss das ZIEL: dort liegt der Inhalt. Ob der Alias
         * selbst schon jemandem gehört, entscheidet, wer ihn verwaltet — nicht,
         * ob die Seite zu sehen ist.
         */
        await using (var cmd = new SqlCommand($"""
            SELECT COALESCE(t.id, s.id),
                   COALESCE(t.claimed_by_role_id, s.claimed_by_role_id),
                   p.title, p.lead, p.updated_at, s.alias_of,
                   s.id,
                   CASE WHEN t.id IS NULL THEN s.page_logic ELSE t.page_logic END,
                   CASE WHEN t.id IS NULL THEN s.page_mode ELSE t.page_mode END,
                   CASE WHEN t.id IS NULL THEN s.page_theme ELSE t.page_theme END,
                   CASE WHEN t.id IS NULL THEN s.page_subject ELSE t.page_subject END,
                   {sealColumn}
            FROM app.slug s
            LEFT JOIN app.slug t ON s.alias_of IS NOT NULL AND t.path = s.alias_of
            LEFT JOIN app.slug_page p ON p.slug_id = COALESCE(t.id, s.id)
            WHERE s.path = @path;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@path", wanted);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);

            if (!await reader.ReadAsync(ctx.RequestAborted) || reader.IsDBNull(1))
            {
                /*
                 * Eine Adresse, die niemand führt, ist keine Seite — und eine,
                 * die gar nicht im Register steht, auch nicht. Dieselbe Antwort
                 * für beides: der Unterschied verriete, welche Adressen noch zu
                 * haben sind, bevor sie jemand hat.
                 */
                await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma jeszcze strony.");
                return;
            }

            slugId = reader.GetGuid(0);
            title = reader.IsDBNull(2) ? null : reader.GetString(2);
            lead = reader.IsDBNull(3) ? null : reader.GetString(3);
            updatedAt = reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4);
            aliasOf = reader.IsDBNull(5) ? null : reader.GetString(5);
            askedId = reader.GetGuid(6);
            logic = reader.IsDBNull(7) ? null : reader.GetString(7);
            mode = reader.IsDBNull(8) ? null : reader.GetString(8);
            theme = reader.IsDBNull(9) ? null : reader.GetString(9);
            subject = reader.IsDBNull(10) ? null : reader.GetString(10);
            seal = reader.IsDBNull(11) ? null : reader.GetString(11);
        }

        /* 0130 — nach einer Meldung gesperrt: an niemanden, auch nicht an die, die sie führen. */
        if (await Takedowns.IsBlockedAsync(connection, "page", slugId, ctx.RequestAborted))
        {
            await Takedowns.BlockedResponse(ctx);
            return;
        }

        /*
         * NUR MIT ZUGANG — und das wird GESAGT (auf Wunsch der Kanzlei, 2026-09-28).
         *
         * Vorher bekam, wer nicht hineindurfte, dieselbe Antwort wie fuer eine
         * Adresse, die es nicht gibt. Das verbarg, dass hier jemand gefuehrt
         * wird — liess aber jeden, der seinen Link nur nicht dabei hatte, vor
         * „Nic tu jeszcze nie ma" stehen, und der dachte, die Seite sei fort.
         * Jetzt steht da: es braucht Zugang — ueber den eigenen Link oder ein
         * Konto, das ihn hat. Titel und Inhalt gehen trotzdem nicht hinaus.
         */
        object access = new { restricted = false };

        /* Die Bereiche der Seite (0051) — keiner: oeffentlich. */
        var areas = new List<Guid>();
        await using (var cmd = new SqlCommand("SELECT area_id FROM app.slug_area WHERE slug_id = @slug;", connection))
        {
            cmd.Parameters.AddWithValue("@slug", slugId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) areas.Add(reader.GetGuid(0));
        }

        if (areas.Count > 0)
        {
            var seen = await SeenByAsync(ctx, db, connection, slugId, askedId, wanted, seat, links);

            if (!seen.Any)
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                await ctx.Response.WriteAsJsonAsync(new
                {
                    error = seen.SignedIn
                        ? "Twoje konto nie ma dostępu do tej strony."
                        : "Ta strona jest dostępna tylko dla osób, które mają do niej dostęp.",
                    verdict = seen.SignedIn ? "noaccess" : "needsaccess"
                });
                return;
            }

            access = new { restricted = true, seats = seen.Seats, roles = seen.Roles, manages = seen.Manages, links = seen.Links };
        }

        /*
         * Die Bausteine gehen MIT der Seite hinaus, nicht auf einen zweiten
         * Ruf. Ein Besucher, der erst die Seite und dann ihren Inhalt holt,
         * sieht dazwischen eine leere Seite — und wer sie in dem Augenblick
         * wegklickt, kommt nicht wieder.
         */
        var parts = await PartsOfAsync(connection, slugId, ctx.RequestAborted);

        /*
         * 0054 — DAS MENÜ, das hier gilt: das eigene der Seite oder das der nächsten
         * darüber, mit dem Pfad, von dem aus seine relativen Ziele gelten.
         */
        var menu = await Menu.ForPageAsync(connection, aliasOf ?? wanted, includeSelf: true, ctx.RequestAborted);

        /*
         * 0099 — DARF DIESES KONTO DIE SEITE BEARBEITEN? Dann steht oben „Edytuj
         * stronę" und führt gleich in den Editor. Bearbeitet wird, wo der Inhalt
         * liegt: bei einem Alias sein Ziel. Ohne Sitzung keine Anfrage.
         */
        var editable = false;
        if (await Auth.WhoAsync(ctx, db) is { } me)
            editable = (await Access.OfAsync(connection, me.AccountId, aliasOf ?? wanted, ctx.RequestAborted)).MayWrite;

        /* 0129 — wer für die Seite geradesteht: der Bereich, den sie (oder eine darüber) nennt, und sein Datensatz. */
        var (responsible, responsibleArea, responsibleFrom) = await Controllers.OfPageAsync(connection, aliasOf ?? wanted, ctx.RequestAborted);

        /* 0048 — die Karte der Seite: was wann zu sehen ist, und die Schritte. */
        await ctx.Response.WriteAsJsonAsync(new
        {
            path = wanted, aliasOf, title, lead, updatedAt, parts, logic, access, editable,

            /* 0062 — Seite oder Slajdy, und wie sie aussehen. */
            mode = mode ?? "page", theme,

            /* 0082 — worum es auf der Seite geht (JSON, im Browser gelesen). */
            subject,
            menu = menu is null ? null : new { from = menu.Value.From, items = menu.Value.Items },

            /*
             * 0121 — VERSIEGELT: Titel, Vorspann, Aussehen, Karte, Wybór, Bausteine
             * und Menü sind Hüllen; hier stehen die Hüllen ihres Schlüssels und die
             * Kennung der Seite, die in jedem Etikett steht. Fehlt es: offen.
             * `id` — die Kennung der Seite (bei einem Alias: die seines Ziels),
             * damit der Editor eine offene Seite versiegeln kann.
             */
            id = Ids.ToText(slugId),
            seal = SealOut(slugId, seal),
            responsible = responsible is null ? null : new
            {
                areaId = Ids.ToText(responsibleArea!.Value),
                fromPath = responsibleFrom,
                controller = Controllers.Json(responsible)
            }
        });
    }

    /* -- Schreiben ---------------------------------------------------------- */

    private static async Task SaveAsync(HttpContext ctx, Db db, string? path, SaveRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = Slug.Normalise(path);
        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        /* 0121 — auf einer versiegelten Seite kommen Titel und Vorspann als Hülle; die ist länger. */
        var title = (body.Title ?? string.Empty).Trim();
        if (title.Length is 0 || title.Length > (IsEnvelope(title) ? SealedLimit(MaxTitle) : MaxTitle))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Tytuł: od 1 do {MaxTitle} znaków.");
            return;
        }

        var lead = string.IsNullOrWhiteSpace(body.Lead) ? null : body.Lead.Trim();
        if (lead is not null && lead.Length > (IsEnvelope(lead) ? SealedLimit(MaxLead) : MaxLead))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Tekst: najwyżej {MaxLead} znaków.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * DIE REIHENFOLGE: erst gibt es die Adresse, dann KANN sie überhaupt
         * Inhalt tragen, dann DARF dieser Mensch.
         *
         * Ein Alias kann nie Inhalt tragen — ob ihn jemand übernommen hat oder
         * nicht, ändert daran nichts. Fragte man zuerst nach dem Recht, bekäme
         * man bei einem unübernommenen Alias „das hat noch niemand übernommen"
         * zu hören: wahr, aber die falsche Auskunft. Wer das liest, holt sich
         * einen Code für eine Adresse, die auch dann nichts annimmt.
         */
        var row = await RowAsync(connection, wanted, ctx.RequestAborted);

        if (row is null)
        {
            // Ein Unterpfad, den niemand geöffnet hat, ist keine Adresse — auch
            // nicht für den, der die Adresse darüber führt.
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
            return;
        }

        if (row.Value.AliasOf is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"Ten adres jest tylko innym wejściem do „{row.Value.AliasOf}” — treść zmienia się tam.");
            return;
        }

        /*
         * Wer darf hier schreiben? Zwei Wege, und beide beantwortet
         * <see cref="Access"/>: eine meiner Rollen FÜHRT die Adresse (oder die
         * nächsthöhere), oder eine meiner Rollen hält ein Zertifikat darauf.
         */
        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);

        if (grip.OwnerRoleId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nikt jeszcze nie przejął.");
            return;
        }

        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tego adresu nie prowadzi żadna z Twoich ról i nie masz do niego prawa zapisu.");
            return;
        }

        var slugId = row.Value.Id;

        /* 0129 — eine öffentliche Seite braucht jemanden, der für ihren Inhalt geradesteht. */
        if (await Controllers.PageGateAsync(connection, slugId, wanted, ctx.RequestAborted) is { } nobody)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, nobody);
            return;
        }

        var sealedPage = await SealOfAsync(connection, slugId, ctx.RequestAborted) is not null;
        if (!Fits(sealedPage, title) || !Fits(sealedPage, lead))
        {
            await SealMismatch(ctx, sealedPage);
            return;
        }

        var now = DateTimeOffset.UtcNow;

        await using var save = new SqlCommand("""
            UPDATE app.slug_page
            SET title = @title, lead = @lead, updated_at = @now, updated_by_role_id = @role
            WHERE slug_id = @id;

            IF @@ROWCOUNT = 0
            INSERT INTO app.slug_page (slug_id, title, lead, updated_at, updated_by_role_id)
            VALUES (@id, @title, @lead, @now, @role);
            """, connection);

        save.Parameters.AddWithValue("@id", slugId);
        save.Parameters.AddWithValue("@title", title);
        save.Parameters.AddWithValue("@lead", (object?)lead ?? DBNull.Value);
        save.Parameters.AddWithValue("@now", now);
        // Die Rolle, ÜBER DIE es galt — nicht die des Führenden. Wer über ein
        // Zertifikat schreibt, soll auch als der dastehen, der er war.
        save.Parameters.AddWithValue("@role", (object?)grip.ViaRoleId ?? grip.OwnerRoleId!.Value);

        await save.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, title, lead, updatedAt = now });
    }

    public sealed record LogicRequest(string? Logic);

    /// <summary>Grösser wird keine Karte, die ein Mensch noch überblickt.</summary>
    private const int MaxLogic = 200_000;

    /// <summary>
    /// DIE KARTE DER SEITE speichern (0048) — als Ganzes, wie die Anordnung.
    ///
    /// <para>
    /// Der Dienst versteht sie nicht und muss es nicht: ausgewertet wird im
    /// Browser. Er prüft nur, dass es JSON ist und nicht zu gross — eine
    /// Zeichenkette, die kein JSON ist, legte jede Seite lahm, die sie liest.
    /// </para>
    /// </summary>
    private static async Task SaveLogicAsync(HttpContext ctx, Db db, string? path, LogicRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = Slug.Normalise(path);
        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        var logic = string.IsNullOrWhiteSpace(body.Logic) ? null : body.Logic;

        /* 0121 — versiegelt ist die Karte eine Hülle: kein JSON, nur ihre Grenze. */
        if (logic is not null)
        {
            if (logic.Length > (IsEnvelope(logic) ? SealedLimit(MaxLogic) : MaxLogic))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Mapa jest za duża.");
                return;
            }

            if (!IsEnvelope(logic) && !IsJson(logic))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna mapa.");
                return;
            }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var row = await RowAsync(connection, wanted, ctx.RequestAborted);
        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
            return;
        }

        if (row.Value.AliasOf is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"Ten adres jest tylko innym wejściem do „{row.Value.AliasOf}” — mapa zmienia się tam.");
            return;
        }

        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tego adresu nie prowadzi żadna z Twoich ról i nie masz do niego prawa zapisu.");
            return;
        }

        var sealedPage = await SealOfAsync(connection, row.Value.Id, ctx.RequestAborted) is not null;
        if (!Fits(sealedPage, logic))
        {
            await SealMismatch(ctx, sealedPage);
            return;
        }

        await using var save = new SqlCommand("UPDATE app.slug SET page_logic = @logic WHERE id = @id;", connection);
        save.Parameters.AddWithValue("@logic", (object?)logic ?? DBNull.Value);
        save.Parameters.AddWithValue("@id", row.Value.Id);
        await save.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, saved = true });
    }

    public sealed record SubjectRequest(string? Subject);

    private const int MaxSubject = 2000;

    /// <summary>
    /// 0082 — WORUM ES AUF DER SEITE GEHT speichern („Wybór na stronie"): etwa
    /// <c>{"kind":"entry","form":"…"}</c> — ein Mensch aus diesem Formular.
    /// Wie die Karte: der Dienst prüft nur, dass es JSON ist und nicht zu
    /// gross; gelesen wird im Browser. <c>null</c> nimmt es weg.
    /// </summary>
    private static async Task SaveSubjectAsync(HttpContext ctx, Db db, string? path, SubjectRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = Slug.Normalise(path);
        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        var subject = string.IsNullOrWhiteSpace(body.Subject) ? null : body.Subject;
        if (subject is not null)
        {
            if (subject.Length > (IsEnvelope(subject) ? SealedLimit(MaxSubject) : MaxSubject))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Wybór na stronie jest za długi.");
                return;
            }
            if (!IsEnvelope(subject) && !IsJson(subject))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny wybór na stronie.");
                return;
            }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var row = await RowAsync(connection, wanted, ctx.RequestAborted);
        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
            return;
        }

        if (row.Value.AliasOf is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"Ten adres jest tylko innym wejściem do „{row.Value.AliasOf}” — wybór zmienia się tam.");
            return;
        }

        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tego adresu nie prowadzi żadna z Twoich ról i nie masz do niego prawa zapisu.");
            return;
        }

        var sealedPage = await SealOfAsync(connection, row.Value.Id, ctx.RequestAborted) is not null;
        if (!Fits(sealedPage, subject))
        {
            await SealMismatch(ctx, sealedPage);
            return;
        }

        await using var save = new SqlCommand("UPDATE app.slug SET page_subject = @subject WHERE id = @id;", connection);
        save.Parameters.AddWithValue("@subject", (object?)subject ?? DBNull.Value);
        save.Parameters.AddWithValue("@id", row.Value.Id);
        await save.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, subject });
    }

    public sealed record LookRequest(string? Mode, string? Theme);

    /// <summary>
    /// 0085 — eine Präsentation trägt ihre Szenen im Aussehen ("show"): Namen,
    /// Hintergründe, Übergänge, eine Wortwolke. Achttausend Zeichen reichten
    /// für vier Farben und einen Titelslajd, nicht für zwanzig Szenen.
    /// </summary>
    public const int MaxTheme = 64000;

    /// <summary>
    /// WIE DIE SEITE ERSCHEINT — die drei Arten (0062, 0085). Was keine davon
    /// ist, wird zur Seite mit Bausteinen: ein Wert, den diese Fassung nicht
    /// kennt, macht nichts kaputt.
    /// </summary>
    public static string ModeOf(string? said) => said switch
    {
        "slides" => "slides",
        "presentation" => "presentation",
        _ => "page"
    };

    /// <summary>
    /// 0062 — WIE DIE SEITE ERSCHEINT: als Seite mit Bausteinen im Raster, oder
    /// als Folge von Slajdy, in der jeder Baustein einen Bildschirm für sich hat.
    ///
    /// <para>
    /// Wie die Karte an der ADRESSE und nicht am Inhalt: ein Alias zeigt, was
    /// sein Ziel zeigt. Das Aussehen (<c>theme</c>) ist JSON, das der Browser
    /// liest; hier wird nur geprüft, dass es JSON ist und nicht zu gross.
    /// </para>
    /// </summary>
    private static async Task SaveLookAsync(HttpContext ctx, Db db, string? path, LookRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = Slug.Normalise(path);
        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        var mode = ModeOf(body.Mode);
        var theme = string.IsNullOrWhiteSpace(body.Theme) ? null : body.Theme;

        if (theme is not null)
        {
            if (theme.Length > (IsEnvelope(theme) ? SealedLimit(MaxTheme) : MaxTheme))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Wygląd strony jest za duży.");
                return;
            }

            if (!IsEnvelope(theme) && !IsJson(theme))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny wygląd strony.");
                return;
            }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var row = await RowAsync(connection, wanted, ctx.RequestAborted);
        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
            return;
        }

        if (row.Value.AliasOf is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"Ten adres jest tylko innym wejściem do „{row.Value.AliasOf}” — wygląd zmienia się tam.");
            return;
        }

        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tego adresu nie prowadzi żadna z Twoich ról i nie masz do niego prawa zapisu.");
            return;
        }

        var sealedPage = await SealOfAsync(connection, row.Value.Id, ctx.RequestAborted) is not null;
        if (!Fits(sealedPage, theme))
        {
            await SealMismatch(ctx, sealedPage);
            return;
        }

        await using var save = new SqlCommand(
            "UPDATE app.slug SET page_mode = @mode, page_theme = @theme WHERE id = @id;", connection);
        save.Parameters.AddWithValue("@mode", mode);
        save.Parameters.AddWithValue("@theme", (object?)theme ?? DBNull.Value);
        save.Parameters.AddWithValue("@id", row.Value.Id);
        await save.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, mode, theme });
    }
}
