using System.Security.Cryptography;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 3.9 — Die beiden Betriebsarten, und was sie wirklich unterscheiden.
///
/// <code>
///   bequem (0)                        sicher (1)
///   ----------                        ----------
///   Bund liegt im Speicher,           Im Speicher liegt NICHTS.
///   aber versiegelt.                  Jede Anfrage baut neu auf.
///
///   Anfrage ─┬─ Oeffnungsstueck       Anfrage ─┬─ Oeffnungsstueck
///            │                                 │
///            ▼                                 ▼
///   entsiegelt den Bund              oeffnet master_key_sealed
///   (eine AES-Operation)             aus rc_account (dieselbe
///                                     AES-Operation, andere Quelle)
/// </code>
///
/// <b>Der Unterschied ist nicht die Sicherheit gegen den Betreiber.</b> Die ist
/// in beiden Faellen dieselbe: ohne das Oeffnungsstueck aus der Anfrage geht
/// nichts auf, und das Oeffnungsstueck wird nirgends behalten. Ein Betreiber,
/// der den versiegelten Bund aus dem Speicher zieht, hat genau so viel wie
/// einer, der <c>master_key_sealed</c> aus der Datenbank zieht: einen
/// Geheimtext.
///
/// <b>Der Unterschied ist, was ueberhaupt existiert.</b> Im sicheren Modus gibt
/// es keinen zweiten Ort. Kein Eintrag im Schluesselspeicher, keine Frage nach
/// dessen Ablauf, nichts, was ein Speicherabbild zeigen koennte — auch nicht
/// verschluesselt. Der Preis ist eine Datenbankabfrage je Anfrage statt eines
/// Nachschlagens im Speicher.
///
/// <b>Die Wahl gehoert dem Menschen, dessen Schluessel es ist</b> (E-240). Sie
/// steht in <c>rc_account.cache_mode</c> und wird hier gelesen, nicht geraten.
/// </summary>
public sealed class RcMasterKey(RcDb db, RcKeyVault vault)
{
    public const int Comfortable = 0;
    public const int Secure = 1;

    /// <summary>
    /// Der Wurzelschluessel fuer DIESE Anfrage. Der Aufrufer MUSS ihn entsorgen
    /// — <c>using</c> genuegt.
    ///
    /// Wirft <see cref="RcUnlockRequiredException"/>, wenn kein Oeffnungsstueck
    /// mitkam oder es nicht passt. Beides sieht von aussen gleich aus; es gibt
    /// keinen Grund, den Unterschied zu verraten.
    /// </summary>
    public async Task<RcHeldKey> OpenAsync(RcRequestSession session, byte[] openingPiece, CancellationToken ct = default)
    {
        await using var connection = await db.OpenAsync(ct);
        return await OpenAsync(connection, session, openingPiece, ct);
    }

    public async Task<RcHeldKey> OpenAsync(
        SqlConnection connection, RcRequestSession session, byte[] openingPiece, CancellationToken ct = default)
    {
        // Der Schluesselspeicher wird nur befragt, wenn ueberhaupt einer
        // gefuehrt wird. Im sicheren Modus liegt dort nichts, und die Abfrage
        // waere nicht bloss nutzlos, sondern irrefuehrend.
        var sessionId = RcId.ToText(session.SessionId);
        if (vault.Holds(sessionId))
        {
            var bundle = vault.Open(sessionId, openingPiece);
            return new RcHeldKey(bundle.MasterKey.ToArray(), bundle);
        }

        // Sicherer Modus, oder ein bequemer, dessen Bund abgelaufen ist. In
        // beiden Faellen ist der Weg derselbe: aus der Datenbank neu aufbauen.
        // Das ist zugleich der Grund, warum der sichere Modus nichts kostet
        // ausser Zeit — er benutzt denselben Weg, den der bequeme nach einem
        // Ablauf ohnehin geht.
        var account = await LoadAsync(connection, session.AccountId, ct);
        if (account is null)
            throw new RcUnlockRequiredException("Zu dieser Sitzung gibt es kein Konto mehr.");

        byte[] masterKey;
        try
        {
            var aad = RcAad.Create("kernel", "account", session.AccountId, RcField.AccountMasterKey, 1);
            masterKey = RcCrypto.Open(openingPiece, aad, account.MasterKeySealed);
        }
        catch (RcDecryptException)
        {
            throw new RcUnlockRequiredException("Das Oeffnungsstueck passt nicht.");
        }

        return new RcHeldKey(masterKey, null);
    }

    /// <summary>
    /// Beim Entsperren: Im bequemen Modus wird der Bund versiegelt abgelegt, im
    /// sicheren gar nicht. Ein <c>if</c> an genau EINER Stelle — sonst gibt es
    /// bald einen Pfad, der die Wahl des Nutzers uebergeht.
    /// </summary>
    public void RememberIfComfortable(Guid sessionId, byte[] openingPiece, RcKeyBundle bundle, int cacheMode)
    {
        if (cacheMode == Secure) return;
        vault.Store(RcId.ToText(sessionId), openingPiece, bundle);
    }

    /// <summary>
    /// Beim Wechsel in den sicheren Modus muss vergessen werden, was schon
    /// liegt. Sonst haette die Umstellung erst nach dem naechsten Abmelden
    /// Wirkung — und eine Einstellung, die spaeter wirkt als sie anzeigt, ist
    /// schlimmer als keine.
    /// </summary>
    public async Task<int> SetCacheModeAsync(Guid accountId, int mode, CancellationToken ct = default)
    {
        if (mode is not (Comfortable or Secure))
            throw new ArgumentOutOfRangeException(nameof(mode));

        await using var connection = await db.OpenAsync(ct);
        await using var cmd = new SqlCommand(
            "UPDATE dbo.rc_account SET cache_mode = @mode WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@mode", (byte)mode);
        cmd.Parameters.AddWithValue("@id", accountId);
        await cmd.ExecuteNonQueryAsync(ct);

        return mode == Secure ? vault.ForgetAccount(accountId) : 0;
    }

    public async Task<int> CacheModeAsync(Guid accountId, CancellationToken ct = default)
    {
        await using var connection = await db.OpenAsync(ct);
        var account = await LoadAsync(connection, accountId, ct);
        return account?.CacheMode ?? Comfortable;
    }

    private sealed record AccountKeyRow(byte[] MasterKeySealed, int CacheMode);

    private static async Task<AccountKeyRow?> LoadAsync(SqlConnection connection, Guid accountId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT master_key_sealed, cache_mode FROM dbo.rc_account WHERE id = @id AND disabled_at IS NULL;",
            connection);
        cmd.Parameters.AddWithValue("@id", accountId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return new AccountKeyRow((byte[])reader[0], reader.GetByte(1));
    }
}

/// <summary>
/// Ein Wurzelschluessel fuer die Dauer einer Anfrage. Beim Entsorgen wird er
/// ueberschrieben — und der Bund, falls einer entfaltet wurde, gleich mit.
/// </summary>
public sealed class RcHeldKey(byte[] masterKey, RcKeyBundle? bundle) : IDisposable
{
    private byte[] _masterKey = masterKey;

    public byte[] MasterKey => _masterKey;

    public void Dispose()
    {
        CryptographicOperations.ZeroMemory(_masterKey);
        _masterKey = [];
        bundle?.Dispose();
    }
}
