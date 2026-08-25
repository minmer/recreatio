using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 12.9 und 12.3.2 — Personenbezogene Daten: Klassen, Protokoll, Loeschung.
///
/// <b>Die Klasse entscheidet drei Dinge</b> (12.9) — und sie entscheidet sie,
/// nicht der Aufrufer. Ein Schalter „bitte protokollieren" waere ein Schalter,
/// den irgendwann jemand vergisst; eine Klasse, aus der die Protokollpflicht
/// FOLGT, kann man nicht vergessen.
///
/// <code>
///   Klasse         Protokoll   Wer darf lesen              Zweck noetig
///   ────────────────────────────────────────────────────────────────────
///   public         nein        jeder mit read              nein
///   operational    nein        Eigentuemer + admin         nein
///   personal       JA          Eigentuemer + Freigabe      nein
///   special        JA          Eigentuemer + Freigabe      JA
///   secret         JA          NUR der Eigentuemer         —
///   integration    nein        Eigentuemer + admin         nein
/// </code>
///
/// <b>secret ist die Klasse, die keine Freigabe kennt.</b> Das ist der ganze
/// Unterschied zu <c>special</c>: bei <c>special</c> darf jemand anders lesen,
/// wenn er sagt wozu; bei <c>secret</c> darf es niemand, und es gibt keinen
/// Endpunkt, der es doch erlaubte.
///
/// <b>Loeschung durch Schluesselvernichtung</b> (12.3.2 Weg b). Jedes Element
/// hat einen EIGENEN Schluessel, der je Leser gewrappt in
/// <c>rc_role_key_grant</c> liegt. Loeschen heisst: alle diese Zuteilungen
/// vernichten und den Zeitpunkt vermerken. Der Geheimtext bleibt liegen und
/// wird nie wieder aufgehen — von niemandem, auch nicht vom Betreiber, auch
/// nicht aus einer alten Sicherung.
///
/// Das ist besser als DELETE: eine geloeschte Zeile hinterlaesst keine Spur,
/// dass sie je da war, und der Vollzug laesst sich nicht nachweisen. Hier
/// steht am Ende in der Datenbank, WELCHER Schluessel WANN und WARUM vernichtet
/// wurde — das ist der Unterschied zwischen geloescht und behauptet geloescht.
/// </summary>
public static class RcDataItems
{
    public const string ClassPublic = "public";
    public const string ClassOperational = "operational";
    public const string ClassPersonal = "personal";
    public const string ClassSpecial = "special";
    public const string ClassSecret = "secret";
    public const string ClassIntegration = "integration";

    private static readonly string[] AllClasses =
        [ClassPublic, ClassOperational, ClassPersonal, ClassSpecial, ClassSecret, ClassIntegration];

    /// <summary>12.9 — Aus der Klasse FOLGT die Protokollpflicht. Kein Schalter.</summary>
    public static bool RequiresLog(string dataClass) =>
        dataClass is ClassPersonal or ClassSpecial or ClassSecret;

    /// <summary>Bei besonderen Kategorien (Art. 9) muss dastehen, wozu gelesen wurde.</summary>
    public static bool RequiresPurpose(string dataClass) => dataClass is ClassSpecial;

    /// <summary>Diese Klasse kennt keine Freigabe. Es gibt keinen Endpunkt, der sie doch erteilt.</summary>
    public static bool AllowsSharing(string dataClass) => dataClass is not ClassSecret;

    public static void MapRcDataItems(this IEndpointRouteBuilder app)
    {
        app.MapPost("/rc/data", CreateAsync).Produces<RcDataItemCreatedResponse>();
        app.MapGet("/rc/data", ListAsync).Produces<RcDataItemsResponse>();
        app.MapGet("/rc/data/{id:guid}", ReadAsync).Produces<RcDataItemResponse>();
        app.MapPost("/rc/data/{id:guid}/share", ShareAsync).Produces<RcDataSharedResponse>();
        app.MapPost("/rc/data/{id:guid}/destroy", DestroyAsync).Produces<RcDataDestroyedResponse>();
        app.MapGet("/rc/data/{id:guid}/access-log", AccessLogAsync).Produces<RcAccessLogResponse>();
    }

    // -- Anlegen --------------------------------------------------------------

    public sealed record CreateRequest(
        string OwnerRoleId, string DataClass, string Field, string Value, string? Module, string? ObjectType);

    private static async Task CreateAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, CreateRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.OwnerRoleId, out var ownerRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        var dataClass = body.DataClass ?? "";
        if (!AllClasses.Contains(dataClass))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Datenklasse gibt es nicht.");
            return;
        }

        // 3.13 — Der Feldname stammt aus der festen Aufzaehlung. Ein frei
        // uebergebener Name waere die Stelle, an der ein Tippfehler zu einem
        // stillschweigend anderen Etikett wird.
        if (!Enum.TryParse<RcField>(body.Field, ignoreCase: false, out var field))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Dieses Feld gibt es nicht.");
            return;
        }

        var value = body.Value ?? "";
        if (value.Length is 0 or > 20_000)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Wert ist leer oder zu lang.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var ownerKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, ownerRoleId, ctx.RequestAborted);

        if (ownerKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Diese Rolle steht dir nicht zur Verfuegung.");
            return;
        }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [ownerRoleId], ctx.RequestAborted);
        if (!identities.TryGetValue(ownerRoleId, out var owner))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var itemId = RcId.NewId();
        var module = Slug(body.Module) ?? "kernel";
        var objectType = Slug(body.ObjectType) ?? "data_item";
        var aad = RcAad.Create(module, objectType, itemId, field, 1);

        // 12.3.2 Weg (b) setzt das voraus: ein EIGENER Schluessel je Element.
        // Laege der Wert unter dem Rollenschluessel, koennte man ihn nur
        // loeschen, indem man die ganze Rolle aussperrt.
        var itemKey = RcCrypto.NewSymmetricKey();
        byte[] sealedValue;
        try
        {
            sealedValue = RcCrypto.Seal(itemKey, aad, Encoding.UTF8.GetBytes(value));

            var now = DateTimeOffset.UtcNow;
            await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
                System.Data.IsolationLevel.ReadCommitted, ctx.RequestAborted);
            try
            {
                await using (var insert = new SqlCommand("""
                    INSERT INTO dbo.rc_data_item
                        (id, owner_role_id, data_class, aad_module, aad_object_type, aad_field,
                         aad_version, value_sealed, created_at, updated_at)
                    VALUES
                        (@id, @owner, @class, @module, @objectType, @field, 1, @value, @now, @now);
                    """, connection, tx))
                {
                    insert.Parameters.AddWithValue("@id", itemId);
                    insert.Parameters.AddWithValue("@owner", ownerRoleId);
                    insert.Parameters.AddWithValue("@class", dataClass);
                    insert.Parameters.AddWithValue("@module", module);
                    insert.Parameters.AddWithValue("@objectType", objectType);
                    insert.Parameters.AddWithValue("@field", field.ToString());
                    insert.Parameters.AddWithValue("@value", sealedValue);
                    insert.Parameters.AddWithValue("@now", now);
                    await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                await GrantAsync(connection, tx, ownerRoleId, itemId, itemKey, owner.WrapPublicKey,
                    ownerRoleId, ctx.RequestAborted);

                await tx.CommitAsync(ctx.RequestAborted);
            }
            catch
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                throw;
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(itemKey);
        }

        await RcResults.WriteJsonAsync(ctx, new RcDataItemCreatedResponse(
            RcId.ToText(itemId), dataClass, RequiresLog(dataClass), AllowsSharing(dataClass)),
            StatusCodes.Status201Created);
    }

    // -- Lesen ----------------------------------------------------------------

    /// <summary>
    /// Lesen — und bei den protokollpflichtigen Klassen wird das Lesen
    /// EINGETRAGEN, bevor der Wert herausgeht.
    ///
    /// Die Reihenfolge ist Absicht: schriebe man erst aus und protokollierte
    /// danach, gaebe es einen Weg, bei dem der Wert das Haus verlaesst und der
    /// Eintrag nicht entsteht — ein Abbruch dazwischen genuegt. Andersherum
    /// kann hoechstens ein Eintrag zu viel dastehen, und das ist die harmlose
    /// Richtung.
    /// </summary>
    private static async Task ReadAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, string? purpose)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var item = await LoadAsync(connection, id, ctx.RequestAborted);
        if (item is null) { await NotFound(ctx); return; }

        if (item.DestroyedUtc is not null)
        {
            // 12.3.2 — Der Geheimtext liegt noch da, aber es gibt keinen
            // Schluessel mehr. Das ist kein Fehler, sondern der Vollzug.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status410Gone,
                RcErrorCodes.CryptoMissingKey,
                "Diese Angabe wurde geloescht: der Schluessel dazu ist vernichtet.");
            return;
        }

        if (RequiresPurpose(item.DataClass) && string.IsNullOrWhiteSpace(purpose))
        {
            // Art. 9 — Bei besonderen Kategorien muss dastehen, wozu gelesen
            // wurde. Ein Protokoll ohne Zweck beantwortet die einzige Frage
            // nicht, die spaeter gestellt wird.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                "Fuer diese Angabe muss beim Lesen ein Zweck genannt werden.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var mine = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        var (itemKey, viaRoleId) = await OpenItemKeyAsync(connection, id, mine, ctx.RequestAborted);
        if (itemKey is null)
        {
            // Wer keinen Schluessel hat, bekommt dieselbe Antwort wie fuer ein
            // Element, das es nicht gibt.
            await NotFound(ctx);
            return;
        }

        if (RequiresLog(item.DataClass))
            await LogAsync(connection, id, viaRoleId, purpose, ctx.RequestAborted);

        var aad = RcAad.Create(item.Module, item.ObjectType, id, item.Field, item.Version);

        try
        {
            await RcResults.WriteJsonAsync(ctx, new RcDataItemResponse(
                RcId.ToText(id), item.DataClass, item.Field.ToString(),
                Encoding.UTF8.GetString(RcCrypto.Open(itemKey, aad, item.SealedValue)),
                RequiresLog(item.DataClass)));
        }
        catch (RcDecryptException e)
        {
            await RcResults.WriteDecryptErrorAsync(ctx, e);
        }
    }

    public sealed record DataItemView(
        string DataItemId, string OwnerRoleId, string DataClass, string Field,
        bool Destroyed, DateTimeOffset UpdatedAt);

    private static async Task ListAsync(HttpContext ctx, RcDb db, RcMasterKey masterKeys, Guid roleId)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        if (await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, held.MasterKey, roleId, ctx.RequestAborted) is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Diese Rolle steht dir nicht zur Verfuegung.");
            return;
        }

        await using var cmd = new SqlCommand("""
            SELECT id, owner_role_id, data_class, aad_field, destroyed_at, updated_at
            FROM dbo.rc_data_item WHERE owner_role_id = @role ORDER BY seq;
            """, connection);
        cmd.Parameters.AddWithValue("@role", roleId);

        var views = new List<DataItemView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            views.Add(new DataItemView(
                RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                reader.GetString(2), reader.GetString(3),
                !reader.IsDBNull(4), reader.GetDateTimeOffset(5)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcDataItemsResponse(views));
    }

    // -- Freigeben ------------------------------------------------------------

    public sealed record ShareRequest(string ToRoleId);

    /// <summary>
    /// Eine Angabe einer weiteren Rolle zugaenglich machen: derselbe
    /// Elementschluessel, unter deren Verpackungsschluessel gewrappt.
    ///
    /// <c>secret</c> laesst das nicht zu — und zwar hier, nicht in einer
    /// Bedienoberflaeche. Eine Klasse, die nur in der Anzeige gesperrt ist, ist
    /// nicht gesperrt.
    /// </summary>
    private static async Task ShareAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, Guid id, ShareRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.ToRoleId, out var toRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var item = await LoadAsync(connection, id, ctx.RequestAborted);
        if (item is null || item.DestroyedUtc is not null) { await NotFound(ctx); return; }

        if (!AllowsSharing(item.DataClass))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied,
                "Diese Angabe ist als geheim eingestuft und laesst sich nicht freigeben.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var mine = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        // Nur der Eigentuemer gibt frei. Wer die Angabe bloss lesen darf, darf
        // sie nicht weiterreichen — sonst waere jede Freigabe zugleich eine
        // Erlaubnis zur Weitergabe.
        if (!mine.ContainsKey(item.OwnerRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Freigeben kann nur, wem die Angabe gehoert.");
            return;
        }

        var (itemKey, _) = await OpenItemKeyAsync(connection, id, mine, ctx.RequestAborted);
        if (itemKey is null) { await NotFound(ctx); return; }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [toRoleId], ctx.RequestAborted);
        if (!identities.TryGetValue(toRoleId, out var receiver))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        try
        {
            await GrantAsync(connection, null, toRoleId, id, itemKey, receiver.WrapPublicKey,
                item.OwnerRoleId, ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await RcResults.WriteJsonAsync(ctx, new RcDataSharedResponse(RcId.ToText(id), null, AlreadyShared: true));
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcDataSharedResponse(
            RcId.ToText(id), RcId.ToText(toRoleId)), StatusCodes.Status201Created);
    }

    // -- Loeschen durch Schluesselvernichtung ---------------------------------

    public sealed record DestroyRequest(string? Reason);

    private static async Task DestroyAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, Guid id, DestroyRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var item = await LoadAsync(connection, id, ctx.RequestAborted);
        if (item is null) { await NotFound(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var mine = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        if (!mine.ContainsKey(item.OwnerRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Loeschen kann nur, wem die Angabe gehoert.");
            return;
        }

        if (item.DestroyedUtc is not null)
        {
            await RcResults.WriteJsonAsync(ctx, new RcDataDestroyedResponse(
                RcId.ToText(id), item.DestroyedUtc!.Value, AlreadyDestroyed: true));
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var reason = Slug(body.Reason) ?? "erasure_request";
        int destroyed;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.ReadCommitted, ctx.RequestAborted);
        try
        {
            // 12.3.2 — Es MUSS protokolliert werden, welcher Schluessel wann
            // und warum vernichtet wurde. Ohne diesen Vermerk ist der Vollzug
            // nicht nachweisbar, und „geloescht" bleibt eine Behauptung.
            await using (var kill = new SqlCommand("""
                UPDATE dbo.rc_role_key_grant
                SET destroyed_at = @now, destroyed_reason = @reason
                WHERE key_kind = @kind AND key_ref = @item AND destroyed_at IS NULL;
                """, connection, tx))
            {
                kill.Parameters.AddWithValue("@now", now);
                kill.Parameters.AddWithValue("@reason", reason);
                kill.Parameters.AddWithValue("@kind", RcGrantKinds.DataKey);
                kill.Parameters.AddWithValue("@item", id);
                destroyed = await kill.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var mark = new SqlCommand(
                "UPDATE dbo.rc_data_item SET destroyed_at = @now WHERE id = @id;", connection, tx))
            {
                mark.Parameters.AddWithValue("@now", now);
                mark.Parameters.AddWithValue("@id", id);
                await mark.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new RcDataDestroyedResponse(
            RcId.ToText(id), now, destroyed, reason,

            // Der Geheimtext bleibt liegen. Das ist kein Versehen: er ist ohne
            // Schluessel nichts, und seine Zeile belegt, DASS hier etwas war
            // und wann es vernichtet wurde.
            CiphertextRemains: true));
    }

    // -- Zugriffsprotokoll ----------------------------------------------------

    public sealed record AccessEntry(string ReaderRoleId, DateTimeOffset AccessedAt, string? Purpose);

    /// <summary>
    /// Wer hat wann hineingesehen. Nur der Eigentuemer sieht das — es ist seine
    /// Auskunft, nicht die des Betreibers.
    /// </summary>
    private static async Task AccessLogAsync(HttpContext ctx, RcDb db, RcMasterKey masterKeys, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var item = await LoadAsync(connection, id, ctx.RequestAborted);
        if (item is null) { await NotFound(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var mine = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        if (!mine.ContainsKey(item.OwnerRoleId)) { await NotFound(ctx); return; }

        await using var cmd = new SqlCommand("""
            SELECT reader_role_id, accessed_at, purpose
            FROM dbo.rc_data_access_log WHERE data_item_id = @id ORDER BY accessed_at DESC;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);

        var entries = new List<AccessEntry>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            entries.Add(new AccessEntry(
                RcId.ToText(reader.GetGuid(0)), reader.GetDateTimeOffset(1),
                reader.IsDBNull(2) ? null : reader.GetString(2)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcAccessLogResponse(entries));
    }

    // -- Datenzugriff ---------------------------------------------------------

    private sealed record ItemRow(
        Guid Id, Guid OwnerRoleId, string DataClass, string Module, string ObjectType,
        RcField Field, int Version, byte[] SealedValue, DateTimeOffset? DestroyedUtc);

    private static async Task<ItemRow?> LoadAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT id, owner_role_id, data_class, aad_module, aad_object_type, aad_field,
                   aad_version, value_sealed, destroyed_at
            FROM dbo.rc_data_item WHERE id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        if (!Enum.TryParse<RcField>(reader.GetString(5), out var field)) return null;

        return new ItemRow(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
            reader.GetString(3), reader.GetString(4), field, reader.GetInt32(6),
            (byte[])reader[7], reader.IsDBNull(8) ? null : reader.GetDateTimeOffset(8));
    }

    /// <summary>
    /// Den Elementschluessel oeffnen — ueber irgendeine Rolle, die der Anfrage
    /// zur Verfuegung steht. Gibt auch zurueck, ueber WELCHE: das gehoert ins
    /// Protokoll, denn „jemand hat gelesen" ist keine Auskunft.
    /// </summary>
    private static async Task<(byte[]? Key, Guid ViaRoleId)> OpenItemKeyAsync(
        SqlConnection connection, Guid itemId, IReadOnlyDictionary<Guid, byte[]> roleKeys, CancellationToken ct)
    {
        if (roleKeys.Count == 0) return (null, Guid.Empty);

        var names = string.Join(", ", roleKeys.Keys.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT role_id, sealed_blob FROM dbo.rc_role_key_grant
            WHERE key_kind = @kind AND key_ref = @item AND destroyed_at IS NULL
              AND role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@kind", RcGrantKinds.DataKey);
        cmd.Parameters.AddWithValue("@item", itemId);
        var i = 0;
        foreach (var roleId in roleKeys.Keys) cmd.Parameters.AddWithValue($"@r{i++}", roleId);

        var candidates = new List<(Guid RoleId, byte[] Blob)>();
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct)) candidates.Add((reader.GetGuid(0), (byte[])reader[1]));
        }

        if (candidates.Count == 0) return (null, Guid.Empty);

        var identities = await RcRoleAccess.LoadIdentitiesAsync(
            connection, candidates.Select(c => c.RoleId).ToList(), ct);

        foreach (var (roleId, blob) in candidates)
        {
            if (!identities.TryGetValue(roleId, out var identity)) continue;
            try
            {
                using var wrapKey = RcRoleKeys.OpenWrapKey(identity, roleKeys[roleId]);
                return (RcCrypto.UnwrapKey(wrapKey, ItemAad(itemId), blob), roleId);
            }
            catch (RcDecryptException) { /* naechste Rolle */ }
        }

        return (null, Guid.Empty);
    }

    private static async Task GrantAsync(
        SqlConnection connection, SqlTransaction? tx, Guid roleId, Guid itemId,
        byte[] itemKey, byte[] wrapPublicKey, Guid grantedByRoleId, CancellationToken ct)
    {
        using var rsa = RSA.Create();
        rsa.ImportSubjectPublicKeyInfo(wrapPublicKey, out _);

        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_role_key_grant
                (id, role_id, key_kind, key_ref, sealed_blob, granted_by_role_id, granted_at)
            VALUES (@id, @role, @kind, @item, @blob, @by, @now);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", RcId.NewId());
        cmd.Parameters.AddWithValue("@role", roleId);
        cmd.Parameters.AddWithValue("@kind", RcGrantKinds.DataKey);
        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.AddWithValue("@blob", RcCrypto.WrapKey(rsa, ItemAad(itemId), itemKey));
        cmd.Parameters.AddWithValue("@by", grantedByRoleId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task LogAsync(
        SqlConnection connection, Guid itemId, Guid readerRoleId, string? purpose, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_data_access_log (data_item_id, reader_role_id, accessed_at, purpose)
            VALUES (@item, @reader, @now, @purpose);
            """, connection);

        cmd.Parameters.AddWithValue("@item", itemId);
        cmd.Parameters.AddWithValue("@reader", readerRoleId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.Add("@purpose", System.Data.SqlDbType.NVarChar, 64).Value =
            (object?)Slug(purpose) ?? DBNull.Value;
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Der Elementschluessel klebt am Element. Ohne das liesse sich eine
    /// Zuteilung von einem Element auf ein anderes umhaengen — und die
    /// Loeschung des einen liesse den anderen offen.
    /// </summary>
    private static RcAad ItemAad(Guid itemId) =>
        RcAad.Create("kernel", "data_item", itemId, RcField.DataItemKey, 1);

    private static string? Slug(string? text)
    {
        var trimmed = text?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;

        var cleaned = new string(trimmed.Where(c => char.IsLetterOrDigit(c) || c is '_' or '-' or '.' or ' ').ToArray());
        return cleaned.Length == 0 ? null : cleaned.Length > 64 ? cleaned[..64] : cleaned;
    }

    /// <summary>
    /// „Kenne ich nicht" und „darfst du nicht" bekommen dieselbe Antwort. Der
    /// Unterschied waere eine Auskunft ueber fremde Daten.
    /// </summary>
    private static Task NotFound(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
            RcErrorCodes.PermissionDenied, "Diese Angabe gibt es nicht.");
}
