using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Eine Einsendung annehmen — mit dem Platz, der dabei entsteht.</summary>
public static partial class Form
{
    public sealed record ValueIn(string FieldId, string Sealed, string WrappedKey, string? SeatKeySealed);

    /// <summary>
    /// Ein Platz, den der Einsendende sich SELBST gewuerfelt hat (0027).
    ///
    /// <para>
    /// <b>Nicht der Dienst legt ihn an, sondern der Browser</b> — wie bei jedem
    /// Platz. Der Dienst bekommt den Abdruck des Links und zwei Huellen, von
    /// denen er keine oeffnen kann; das Geheimnis, das sie aufmacht, hat er nie
    /// gesehen.
    /// </para>
    ///
    /// <para>
    /// <b><c>SeatKeyForIntake</c> und nicht <c>…ForArea</c>.</b> Ein
    /// oeffentliches Formular setzt voraus, dass der Bereich seinen
    /// Epochenschluessel veroeffentlicht hat — sonst bleiben die
    /// Beschriftungen zu. Unter einem veroeffentlichten Schluessel zu
    /// versiegeln schuetzt nichts. Der Platz geht deshalb an die ANNAHME, deren
    /// private Haelfte unter dem Amtsschluessel liegt.
    /// </para>
    /// </summary>
    public sealed record SelfSeat(
        string SeatId, string TokenSha256, string SeatKeySealed, string SeatKeyForIntake,
        string AreaId, int Epoch, string? RecipientName, string? UnderPath,

        /// <summary>
        /// Der Epochenschluessel des Bereichs, verpackt unter dem PLATZSCHLUESSEL
        /// (0035) — damit dieser Mensch ausser seinem Eigenen auch das
        /// Gemeinsame sieht.
        ///
        /// <para>
        /// <b>Er kann ihn nur haben, wenn er offenliegt.</b> Ein Fremder hat
        /// keinen Epochenschluessel; hat er einen, dann weil der Bereich ihn
        /// veroeffentlicht hat. Was hier hereinkommt, gibt also nichts weiter,
        /// als ohnehin offen steht — und der Dienst nimmt es trotzdem nur an,
        /// wenn der Bereich es zulaesst (<c>seat_level</c>).
        /// </para>
        /// </summary>
        string? AreaKeySealed = null,

        /* -- 0046 ---------------------------------------------------------- */

        /* Der Link selbst (Token und Schluessel), versiegelt unter dem Platzschluessel — fuer die Kanzlei. */
        string? LinkSealed = null,

        /*
         * Der langsame Abdruck der Angaben, die beim ersten Oeffnen des Links
         * zu bestaetigen sind (PBKDF2, im Browser gerechnet), und welche
         * Fragen das sind. Wer sich hier selbst anmeldet, hat sie eben
         * eingegeben — er gilt als bestaetigt.
         */
        string? VerifySha256 = null,
        IReadOnlyList<string>? VerifyFields = null,

        /*
         * 0097 — WIE ER HEISST, NIE OFFEN. `RecipientName` (ein alter Browser)
         * wird nicht mehr gespeichert. Der Name kommt versiegelt: unter dem
         * Platzschlüssel (für ihn selbst) und — nur wenn dieser Browser den
         * Schlüssel des Bereichs hat — unter dem Bereichsschlüssel; sonst
         * versiegelt ihn die Kanzlei, sobald sie die Einsendung aufmacht.
         */
        string? OwnNameSealed = null, string? NameSealed = null, int? NameEpoch = null);

    public sealed record SubmitRequest(
        IReadOnlyList<ValueIn> Values, string? ClaimSha256, string? SeatToken, string? RoleId,
        SelfSeat? Seat,

        /* 0047 — welche Einsendung eine Erweiterung ergänzt. */
        string? BaseRegistrationId = null,

        /* 0077 — für welchen Zeitraum (bei einer wiederkehrenden Erweiterung): der laufende. */
        string? Round = null);

    /// <summary>
    /// Eine Einsendung — ohne Konto.
    ///
    /// <para>
    /// <b>Die Quittung (`claimSha256`) ist der einzige Weg zurueck</b>, wenn
    /// niemand angemeldet war und kein Platz im Spiel ist. Gespeichert wird nur
    /// ihr Abdruck; wer sie verliert, kommt an seine Einsendung nicht mehr
    /// heran — und das ist besser, als wenn jeder andere es koennte.
    /// </para>
    ///
    /// <para>
    /// <b>Jeder Wert bringt seinen eigenen Schluessel mit</b>, verpackt unter der
    /// oeffentlichen Haelfte. Ein gemeinsamer Schluessel fuer alle Felder waere
    /// kuerzer und hiesse: wer eines oeffnet, oeffnet alle.
    /// </para>
    /// </summary>
    private static async Task SubmitAsync(HttpContext ctx, Db db, Push push, Guid id, SubmitRequest body)
    {
        var values = body.Values ?? [];

        if (values.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Puste zgłoszenie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var fields = await ReadFieldsAsync(connection, id, ctx.RequestAborted);
        if (fields.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tu nie ma formularza.");
            return;
        }

        /*
         * GESCHLOSSEN heisst geschlossen — und ohne Klausel sammelt das
         * Formular nichts (0042). Beides stand bisher nur im Browser; ein
         * Aufruf an ihm vorbei haette trotzdem eingesandt.
         */
        /* 0130 — ein gesperrtes Formular nimmt nichts an. */
        if (await Takedowns.IsBlockedAsync(connection, "form", id, ctx.RequestAborted)) { await Takedowns.BlockedResponse(ctx); return; }

        var whole = await WholeAsync(connection, id, ctx.RequestAborted);

        if (whole?.Closed == true)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Zapisy przez ten formularz są zamknięte.");
            return;
        }

        if (whole?.Controller is null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ten formularz nie ma jeszcze klauzuli — nie wiadomo, kto odpowiada za dane.");
            return;
        }

        var known = fields.Select(f => f.Id).ToHashSet();
        var parsed = new List<(Guid Field, byte[] Sealed, byte[] Wrapped, byte[]? ForSeat)>();

        foreach (var one in values)
        {
            if (!Guid.TryParse(one.FieldId, out var fieldId) || !known.Contains(fieldId))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Odpowiedź na pole, którego tu nie ma.");
                return;
            }

            byte[] sealedValue, wrapped;
            try
            {
                sealedValue = Base64Url.Decode(one.Sealed ?? string.Empty);
                wrapped = Base64Url.Decode(one.WrappedKey ?? string.Empty);
            }
            catch (FormatException)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna zapieczętowana odpowiedź.");
                return;
            }

            if (sealedValue.Length == 0 || wrapped.Length == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Pusta odpowiedź nie jest zapieczętowana.");
                return;
            }

            parsed.Add((fieldId, sealedValue, wrapped, Optional(one.SeatKeySealed)));
        }

        var missing = fields
            .Where(f => f.IsRequired && parsed.All(p => p.Field != f.Id))
            .ToList();

        if (missing.Count > 0)
        {
            /*
             * WELCHE fehlen, steht nicht dabei: die Beschriftung ist versiegelt,
             * und der Dienst kann sie nicht lesen. Die Oberflaeche weiss es —
             * sie hat das Formular geoeffnet — und sagt es dort.
             */
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brakuje odpowiedzi na pole wymagane.");
            return;
        }

        Guid? seatId = null;

        if (!string.IsNullOrWhiteSpace(body.SeatToken))
        {
            await using var find = new SqlCommand("""
                SELECT id FROM app.access
                WHERE token_sha256 = @token AND revoked_at IS NULL AND status = N'active'
                  AND (expires_at IS NULL OR expires_at > @now)
                  AND (verify_hash IS NULL OR verified_at IS NOT NULL);
                """, connection);

            find.Parameters.AddWithValue("@token",
                System.Security.Cryptography.SHA256.HashData(
                    System.Text.Encoding.UTF8.GetBytes(body.SeatToken.Trim())));
            find.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
                return;
            }
            seatId = found;
        }

        byte[]? claim = null;
        if (!string.IsNullOrWhiteSpace(body.ClaimSha256))
        {
            claim = Optional(body.ClaimSha256);
            if (claim is null || claim.Length != 32)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Odcisk pokwitowania musi mieć 32 bajty.");
                return;
            }
        }

        /*
         * Angemeldet? Dann kann die Einsendung an einer Rolle haengen — aber an
         * einer GENANNTEN.
         *
         * Die erste beste zu nehmen waere genau der Fehler, den der Altbestand
         * mit seiner Personenauswahl behoben hat: ein Elternteil meldet zwei
         * Kinder an, beide landeten bei derselben Person, und weil die Angaben
         * trotzdem aufgingen, faende es niemand heraus. Wird keine genannt,
         * haengt die Einsendung eben nur am Platz oder an der Quittung.
         */
        var who = await Auth.WhoAsync(ctx, db);
        Guid? roleId = null;

        if (who is not null && !string.IsNullOrWhiteSpace(body.RoleId))
        {
            if (!Guid.TryParse(body.RoleId, out var wanted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung roli.");
                return;
            }

            var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
            if (!mine.Any(r => r.Id == wanted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
                return;
            }

            // Dem Konto wird nichts gegeben (0040) — nur Personen und Rollen darunter.
            if (Workspace.IsAccount(mine, wanted))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, Workspace.AccountTakesNothing);
                return;
            }

            roleId = wanted;
        }

        /*
         * DER SELBSTGEWUERFELTE PLATZ (0027).
         *
         * Er entsteht ZUGLEICH mit der Einsendung und nicht davor: der Firmling
         * fuellt aus, und erst danach gibt es etwas, worauf ein Link zeigen
         * koennte. Beides in einer Transaktion — ein Platz ohne Einsendung waere
         * ein Link auf nichts, eine Einsendung ohne Platz ein Mensch, der nicht
         * mehr an seine eigenen Angaben kommt.
         */
        SelfSeatRow? mint = null;

        if (body.Seat is not null)
        {
            if (seatId is not null)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Zgłoszenie ma jedno miejsce, nie dwa.");
                return;
            }

            mint = await ReadSelfSeatAsync(ctx, connection, id, body.Seat, fields);
            if (mint is null) return;

            seatId = mint.Value.Id;
        }

        if (seatId is null && roleId is null && claim is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Zgłoszenie bez żadnego śladu — nikt nie mógłby go później odnaleźć.");
            return;
        }

        /*
         * DIE ERWEITERUNG (0047). Was die Kanzlei ausfüllt, kommt hier nicht
         * herein. Was der Mensch ausfüllt, kommt über SEINEN Platz und zu
         * SEINER Einsendung — einmal; danach berichtigt er, wie bei der ersten.
         */
        var shape = await ShapeAsync(connection, id, ctx.RequestAborted);
        Guid? baseId = null;
        var round = string.Empty;

        if (shape?.Audience == "office")
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ten formularz wypełnia koordynator.");
            return;
        }

        if (shape?.Audience == "person")
        {
            if (seatId is null || mint is not null || !Guid.TryParse(body.BaseRegistrationId, out var wanted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "To uzupełnienie wysyła się ze swojego linku — do swojego zgłoszenia.");
                return;
            }

            await using (var find = new SqlCommand("""
                SELECT COUNT(*) FROM app.registration
                WHERE id = @base AND part_id = @part AND access_id = @seat AND withdrawn_at IS NULL;
                """, connection))
            {
                find.Parameters.AddWithValue("@base", wanted);
                find.Parameters.AddWithValue("@part", shape.Value.ExtendsId!.Value);
                find.Parameters.AddWithValue("@seat", seatId.Value);

                if ((int)(await find.ExecuteScalarAsync(ctx.RequestAborted) ?? 0) == 0)
                {
                    await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma zgłoszenia, które to uzupełnia.");
                    return;
                }
            }

            /*
             * 0077 — EINE WIEDERKEHRENDE ERGÄNZUNG: der Mensch schreibt in den
             * LAUFENDEN Zeitraum, einmal. Den Schlüssel rechnet sein Browser
             * (er weiss, welcher Tag bei ihm ist); der Dienst nimmt nur einen,
             * der gerade irgendwo auf der Welt gilt.
             */
            round = (body.Round ?? string.Empty).Trim();

            if (!Rounds.Valid(shape.Value.Repeat, round) || !Rounds.Current(shape.Value.Repeat, round, DateTimeOffset.UtcNow))
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "To uzupełnienie wypełnia się za bieżący okres — odśwież stronę i spróbuj ponownie.");
                return;
            }

            if (await ExtensionOfAsync(connection, id, wanted, round, ctx.RequestAborted) is not null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "To jest już uzupełnione — popraw odpowiedzi w swoim zgłoszeniu.");
                return;
            }

            baseId = wanted;
            claim = null;
        }
        else if (!string.IsNullOrWhiteSpace(body.BaseRegistrationId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Ten formularz niczego nie uzupełnia.");
            return;
        }

        var registrationId = Ids.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            if (mint is not null)
            {
                var seat = mint.Value;

                await using (var open = new SqlCommand("""
                    INSERT INTO app.access
                        (id, area_id, token_sha256, seat_key_sealed, seat_key_for_intake, epoch,
                         name_sealed, name_epoch, own_name_sealed, origin, created_by_role_id, created_at,
                         link_sealed, verify_hash, verify_fields, verified_at)
                    VALUES (@id, @area, @token, @forLink, @forIntake, @epoch,
                            @named, @namedEpoch, @ownName, N'self', NULL, @now,
                            @linkSealed, @verifyHash, @verifyFields, @verifiedAt);
                    """, connection, tx))
                {
                    open.Parameters.AddWithValue("@id", seat.Id);
                    open.Parameters.AddWithValue("@area", seat.AreaId);
                    open.Parameters.AddWithValue("@token", seat.TokenHash);
                    open.Parameters.AddBlob("@forLink", seat.ForLink);
                    open.Parameters.AddBlob("@forIntake", seat.ForIntake);
                    open.Parameters.AddWithValue("@epoch", seat.Epoch);
                    open.Parameters.AddBlob("@named", seat.Named);
                    open.Parameters.AddWithValue("@namedEpoch", seat.Named is null ? DBNull.Value : seat.NamedEpoch);
                    open.Parameters.AddBlob("@ownName", seat.OwnName);
                    open.Parameters.AddWithValue("@now", now);
                    open.Parameters.AddBlob("@linkSealed", seat.LinkSealed);
                    open.Parameters.AddBlob("@verifyHash", seat.VerifyHash);
                    open.Parameters.AddWithValue("@verifyFields", (object?)seat.VerifyFields ?? DBNull.Value);

                    /* Wer sich eben selbst angemeldet hat, hat die Angaben gerade eingegeben. */
                    open.Parameters.AddWithValue("@verifiedAt", seat.VerifyHash is null ? DBNull.Value : now);

                    await open.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                /*
                 * Wohin der Platz gehoert — damit das Portal zurueckfindet und
                 * damit eine interne Unterseite (0026) sich ihm oeffnet.
                 */
                foreach (var slugId in seat.SlugIds)
                {
                    await using var bind = new SqlCommand(
                        "INSERT INTO app.access_slug (access_id, slug_id) VALUES (@a, @s);",
                        connection, tx);

                    bind.Parameters.AddWithValue("@a", seat.Id);
                    bind.Parameters.AddWithValue("@s", slugId);
                    await bind.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                /*
                 * WAS ER AUSSER SEINEM EIGENEN SIEHT (0035).
                 *
                 * Das Eigene gehoert ihm ohnehin — es haengt am Platzschluessel.
                 * Hier geht es um das Gemeinsame, und ob er es sehen darf,
                 * sagt der BEREICH (`seat_level`) und nicht das Formular.
                 *
                 * Der Schluessel kommt aus dem Browser des Anmeldenden. Haben
                 * kann er ihn nur, wenn der Bereich ihn veroeffentlicht hat —
                 * es geht also nichts hinaus, was nicht ohnehin offen stuende.
                 * Steht der Bereich auf `own`, wird er verworfen; das ist kein
                 * Fehler des Anmeldenden, sondern die Antwort auf seine Frage.
                 */
                if (seat.AreaKey is not null)
                {
                    await using var level = new SqlCommand(
                        "SELECT seat_level FROM app.area WHERE id = @area;", connection, tx);
                    level.Parameters.AddWithValue("@area", seat.AreaId);

                    if (await level.ExecuteScalarAsync(ctx.RequestAborted) is string allowed
                        && allowed != "own")
                    {
                        await using var share = new SqlCommand("""
                            INSERT INTO app.access_grant (access_id, area_id, epoch, sealed_blob, created_at)
                            VALUES (@a, @area, @epoch, @blob, @now);
                            """, connection, tx);

                        share.Parameters.AddWithValue("@a", seat.Id);
                        share.Parameters.AddWithValue("@area", seat.AreaId);
                        share.Parameters.AddWithValue("@epoch", seat.Epoch);
                        share.Parameters.AddBlob("@blob", seat.AreaKey);
                        share.Parameters.AddWithValue("@now", now);

                        await share.ExecuteNonQueryAsync(ctx.RequestAborted);
                    }
                }
            }

            await using (var insert = new SqlCommand("""
                INSERT INTO app.registration
                    (id, part_id, access_id, role_id, claim_sha256, submitted_at, base_id, confirmed_at, round_key)
                VALUES (@id, @part, @access, @role, @claim, @now, @base, @confirmed, @round);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", registrationId);
                insert.Parameters.AddWithValue("@part", id);
                insert.Parameters.AddWithValue("@access", (object?)seatId ?? DBNull.Value);
                insert.Parameters.AddWithValue("@role", (object?)roleId ?? DBNull.Value);
                insert.Parameters.AddBlob("@claim", claim);
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddWithValue("@base", (object?)baseId ?? DBNull.Value);
                insert.Parameters.AddWithValue("@round", round);

                /* Eine Ergänzung hat er eben selbst getippt — sie muss er nicht noch einmal durchsehen. */
                insert.Parameters.AddWithValue("@confirmed", baseId is null ? DBNull.Value : now);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var (fieldId, sealedValue, wrapped, forSeat) in parsed)
            {
                await using var add = new SqlCommand("""
                    INSERT INTO app.registration_value
                        (registration_id, field_id, value_sealed, wrapped_key, seat_key_sealed)
                    VALUES (@reg, @field, @value, @wrapped, @seat);
                    """, connection, tx);

                add.Parameters.AddWithValue("@reg", registrationId);
                add.Parameters.AddWithValue("@field", fieldId);
                add.Parameters.AddWithValue("@value", sealedValue);
                add.Parameters.AddWithValue("@wrapped", wrapped);
                add.Parameters.AddBlob("@seat", forSeat);

                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            /*
             * 0091 — DIE ROLLE DES FORMULARS. Wer es einsendet, gehört zu ihr: sein
             * Platz hält sie, und was sie darf, darf er (`access_role_area`). Den
             * Schlüssel der Rolle bekommt er, sobald der Browser eines Mitglieds
             * vorbeikommt (`Form.Members.cs`); bis dahin wartet die Zeile.
             */
            if (seatId is not null) await JoinMemberRoleAsync(connection, tx, id, seatId.Value, now, ctx.RequestAborted);

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627 && baseId is not null)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "To jest już uzupełnione — popraw odpowiedzi w swoim zgłoszeniu.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        /* 0075 — wer die Anmeldungen liest, wird geweckt. */
        push.Form(id);

        await ctx.Response.WriteAsJsonAsync(new
        {
            registrationId = Ids.ToText(registrationId),
            values = parsed.Count,
            seatId = seatId is null ? null : Ids.ToText(seatId.Value),

            /*
             * WO das Portal haengt — der Dienst hat es entschieden, also sagt
             * er es auch. Ohne das muesste der Browser die Regel ein zweites
             * Mal kennen, und zwei Meinungen darueber ergaeben eine Adresse,
             * die ins Leere zeigt.
             */
            portalUnder = mint?.UnderPath
        });
    }

    /// <summary>Ein geprueufter Selbstplatz, fertig zum Einfuegen.</summary>
    /// <summary>
    /// Ein Base64Url-Feld, das FEHLEN darf. Unlesbar wird wie fehlend
    /// behandelt: es haengt nichts daran ausser einer Zugabe, und eine
    /// Anmeldung deswegen abzulehnen waere unverhaeltnismaessig.
    /// </summary>
    private static byte[]? TryBlob(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        try { return Base64Url.Decode(text); } catch (FormatException) { return null; }
    }

    private readonly record struct SelfSeatRow(
        Guid Id, Guid AreaId, byte[] TokenHash, byte[] ForLink, byte[] ForIntake,
        int Epoch, IReadOnlyList<Guid> SlugIds, string? UnderPath,
        byte[]? AreaKey, byte[]? LinkSealed = null, byte[]? VerifyHash = null, string? VerifyFields = null,
        byte[]? OwnName = null, byte[]? Named = null, int NamedEpoch = 0);

    /// <summary>
    /// Den mitgeschickten Platz pruefen — und dabei die eine Frage stellen, die
    /// wirklich zaehlt: KOMMT DIE KANZLEI HERAN?
    ///
    /// <para>
    /// Der Platzschluessel ist unter der oeffentlichen Haelfte der Annahme
    /// verpackt. Hat der Bereich gar keine Annahme, gibt es diese Haelfte
    /// nicht, und was hier ankaeme, koennte niemand je oeffnen — ein Platz, der
    /// aussieht wie einer und keiner ist. Deshalb steht die Pruefung hier und
    /// nicht bei der Anzeige, wo sie zu spaet waere.
    /// </para>
    ///
    /// <para>
    /// <b>Der Bereich muss einer sein, in den dieses Formular ohnehin
    /// einsendet.</b> Sonst haengte sich eine Einsendung einen Platz in einen
    /// fremden Bereich — und stuende dort in der Liste der Kanzlei, die ihn nie
    /// ausgestellt hat.
    /// </para>
    /// </summary>
    private static async Task<SelfSeatRow?> ReadSelfSeatAsync(
        HttpContext ctx, SqlConnection connection, Guid partId, SelfSeat body, List<FieldRow> fields)
    {
        if (!Guid.TryParse(body.SeatId, out var seatId) || seatId == Guid.Empty
            || !Guid.TryParse(body.AreaId, out var areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung miejsca.");
            return null;
        }

        if (!fields.Any(f => f.AreaId == areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Miejsce miałoby powstać w obszarze, do którego ten formularz nie pisze.");
            return null;
        }

        if (body.Epoch < 1)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Epoka zaczyna się od 1.");
            return null;
        }

        var tokenHash = Optional(body.TokenSha256);
        if (tokenHash is null || tokenHash.Length != 32)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Odcisk linku musi mieć 32 bajty.");
            return null;
        }

        var forLink = Optional(body.SeatKeySealed);
        var forIntake = Optional(body.SeatKeyForIntake);

        if (forLink is null || forLink.Length == 0 || forIntake is null || forIntake.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny zapieczętowany klucz miejsca.");
            return null;
        }

        await using (var has = new SqlCommand(
            "SELECT TOP 1 1 FROM app.intake WHERE area_id = @area;", connection))
        {
            has.Parameters.AddWithValue("@area", areaId);

            if (await has.ExecuteScalarAsync(ctx.RequestAborted) is null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Ten obszar nie przyjmuje zgłoszeń — nikt nie mógłby otworzyć miejsca.");
                return null;
            }
        }

        /*
         * WOHIN DER PLATZ GEHOERT — und das darf der Einsendende NICHT frei
         * waehlen.
         *
         * `app.access_slug` ist einer der drei Wege in eine interne Unterseite
         * (0026). Naehme der Dienst hier eine Kennung entgegen, wie sie kommt,
         * schriebe sich ein Fremder mit einer Anmeldung den Zutritt zu
         * `lo13/anna` — er muesste die Kennung nur raten oder abschreiben.
         *
         * Erlaubt ist deshalb, was mit der Seite des Formulars verwandt ist
         * (sie selbst, darueber, darunter) — und was die KANZLEI in den
         * Einstellungen gewaehlt hat, sofern es eine oeffentliche Seite
         * desselben Traegers ist (`MayAnchorAsync`).
         */
        var slugIds = new List<Guid>();

        /*
         * AUF WELCHER SEITE DAS FORMULAR STEHT — es koennen mehrere sein
         * (0036: ein Baustein, viele Verwendungen). Steht es auf keiner, nimmt
         * es nichts an: niemand kann es ausgefuellt haben, und ein Platz ohne
         * Seite haette keinen Ort.
         */
        var sheet = await SheetAsync(connection, partId, ctx.RequestAborted);
        if (sheet is null || sheet.Paths.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Ten formularz nie stoi na żadnej stronie.");
            return null;
        }

        var named = string.IsNullOrWhiteSpace(body.UnderPath) ? null : Slug.Normalise(body.UnderPath);

        /* Die Seite, an der sich der genannte Ort messen lassen muss — sonst die erste. */
        var formPath = named is null
            ? sheet.Paths[0]
            : sheet.Paths.FirstOrDefault(page => page == named
                || named.StartsWith(page + "/", StringComparison.Ordinal)
                || page.StartsWith(named + "/", StringComparison.Ordinal)) ?? sheet.Paths[0];

        /*
         * WO DAS PORTAL HAENGT — und der Browser muss es nicht wissen.
         *
         * Die Regel ist eine Eigenschaft des Baus und keine Einstellung je
         * Seite: das Formular liegt auf `…/confirmation/signin`, das Portal
         * gehoert eine Ebene darueber, auf `…/confirmation`. Genau dort sucht
         * ein Mensch es auch — die Anmeldung ist ein Durchgang, die Firmung
         * ist der Ort.
         *
         * Gibt es die Seite darueber nicht im Register, bleibt die Seite mit
         * dem Formular. Und wer es anders will, nennt `UnderPath` — dann gilt
         * dieselbe Pruefung wie sonst.
         */
        /*
         * Was die KANZLEI eingestellt hat (`portalUnder` am Baustein) — nicht,
         * was der Einsendende mitschickt. Nennt er nichts, gilt ihre Wahl.
         */
        var configured = await PortalOfAsync(connection, sheet.ModuleId, ctx.RequestAborted);

        var wanted = named ?? configured ?? Above(formPath);

        /*
         * WELCHE SEITE ein Platz tragen darf — `MayAnchorAsync`, dieselbe
         * Regel wie beim Einstellen. Die Seite mit dem Formular, eine darueber,
         * eine darunter; und, wenn die Kanzlei sie SELBST gewaehlt hat, jede
         * andere oeffentliche Seite desselben Traegers.
         */
        if (!await MayAnchorAsync(connection, sheet.Paths, wanted,
                chosenByOffice: configured is not null && wanted == configured, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotAnchorable);
            return null;
        }

        var anchor = await SlugIdAsync(connection, wanted, ctx.RequestAborted);

        /*
         * Nur wenn der Aufrufer ihn GENANNT hat, ist ein fehlender Anker ein
         * Fehler. Beim abgeleiteten faellt er still auf die Seite mit dem
         * Formular zurueck: eine Anmeldung abzulehnen, weil eine Zwischenseite
         * nie uebernommen wurde, waere eine Strafe fuer den Falschen.
         */
        if (anchor is null && !string.IsNullOrWhiteSpace(body.UnderPath))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
            return null;
        }

        var anchorPath = wanted;

        if (anchor is null)
        {
            anchor = await SlugIdAsync(connection, formPath, ctx.RequestAborted);
            anchorPath = formPath;
        }

        if (anchor is not null) slugIds.Add(anchor.Value);

        /*
         * 0097 — der Name, versiegelt. Eine unbrauchbare Hülle, oder eine unter
         * einem offenen Schlüssel, wird weggelassen, nicht abgelehnt: die
         * Anmeldung steht für sich, und die Kanzlei versiegelt den Namen nach.
         */
        var ownName = Names.Blob(body.OwnNameSealed);
        var (sealedName, sealedEpoch, sealedError) = Names.Read(body.NameSealed, body.NameEpoch);
        if (sealedName is not null
            && (sealedError is not null
                || await Names.EpochProblemAsync(connection, null, areaId, sealedEpoch, person: true, ctx.RequestAborted) is not null))
        {
            sealedName = null;
        }

        return new SelfSeatRow(seatId, areaId, tokenHash, forLink, forIntake, body.Epoch,
            slugIds, anchor is null ? null : anchorPath,

            /* Unlesbar heisst: nicht mitgegeben. Kein Grund, die ganze
               Anmeldung abzulehnen — sie steht fuer sich. */
            TryBlob(body.AreaKeySealed),
            TryBlob(body.LinkSealed),
            TryBlob(body.VerifySha256) is { Length: 32 } proof ? proof : null,
            VerifyFieldsText(body.VerifyFields),
            ownName, sealedName, sealedName is null ? 0 : sealedEpoch);
    }
}
