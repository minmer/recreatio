using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Rc.Kernel;

/// <summary>
/// 3.9 Schicht 3 — Der geteilte Schluessel.
///
/// <b>Der Server haelt den Schluesselbund nur verschluesselt. Das Stueck, das
/// ihn oeffnet, haelt er nie — es kommt mit der Anfrage aus dem Browser.</b>
///
/// Daraus folgt die Zusage, auf der Kapitel 1 und Kapitel 7 ruhen: Ohne eine
/// Anfrage aus dem Browser des Nutzers kann der Server nichts entschluesseln
/// und nichts signieren. Kein Vorgang nachts um drei, keiner fuer einen Nutzer,
/// der offline ist.
///
/// Fassung 2 der Spezifikation liess den Server MasterKey und Rollenschluessel
/// fuenfzehn Minuten im Klartext halten. Weil zu jeder Rolle ein Write-Key zum
/// Signieren gehoert, besass der Serverprozess damit die Signaturschluessel —
/// und die Zusage aus 7.2 war genau waehrend aktiver Sitzungen unwahr.
/// </summary>
public sealed class RcKeyVault : IDisposable
{
    private readonly ConcurrentDictionary<string, SealedEntry> _entries = new(StringComparer.Ordinal);
    private readonly TimeSpan _idleTimeout;
    private readonly int _maxEntries;
    private readonly Func<DateTimeOffset> _clock;

    /// <summary>
    /// 2.4 — Jeder Sitzungs- oder Schluessel-Cache hat Ablauf UND
    /// Groessenbegrenzung. Der Altbestand hatte ein unbegrenztes Woerterbuch
    /// ohne beides.
    /// </summary>
    public RcKeyVault(TimeSpan? idleTimeout = null, int maxEntries = 5_000, Func<DateTimeOffset>? clock = null)
    {
        _idleTimeout = idleTimeout ?? TimeSpan.FromMinutes(15);
        _maxEntries = maxEntries > 0 ? maxEntries : throw new ArgumentOutOfRangeException(nameof(maxEntries));
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
    }

    public int Count => _entries.Count;

    /// <summary>Der Klient muss wissen, wann er wieder entsperren muss.</summary>
    public TimeSpan IdleTimeout => _idleTimeout;

    /// <summary>
    /// Ob fuer diese Sitzung ueberhaupt etwas liegt — ohne es zu oeffnen.
    /// Die Antwort verraet nichts: Wer die Sitzung hat, weiss ohnehin, ob er
    /// entsperrt hat.
    /// </summary>
    public bool Holds(string sessionId) =>
        _entries.TryGetValue(sessionId, out var entry) && _clock() - entry.LastUsedUtc <= _idleTimeout;

    /// <summary>
    /// Beim Entsperren. Der Bund wird sofort versiegelt; der Klartext lebt nur
    /// bis zum Ende dieser Methode.
    ///
    /// <paramref name="openingPiece"/> stammt aus dem Browser und wird hier
    /// NICHT behalten — nur benutzt.
    /// </summary>
    public void Store(string sessionId, ReadOnlySpan<byte> openingPiece, RcKeyBundle bundle)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId);
        ArgumentNullException.ThrowIfNull(bundle);

        if (_entries.Count >= _maxEntries) EvictIdle();
        if (_entries.Count >= _maxEntries)
            throw new InvalidOperationException("Schluesselspeicher voll. Ablauf pruefen (2.4).");

        var aad = RcAad.Create("kernel", "session", bundle.AccountId, RcField.AccountMasterKey, 1);
        var plaintext = bundle.Serialize();
        try
        {
            var sealedBlob = RcCrypto.Seal(DeriveCacheKey(openingPiece, sessionId), aad, plaintext);
            var now = _clock();
            _entries[sessionId] = new SealedEntry(sealedBlob, bundle.AccountId, now, now);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    /// <summary>
    /// Waehrend einer Anfrage. Der entfaltete Bund gilt NUR fuer deren Dauer;
    /// der Aufrufer MUSS ihn entsorgen — <c>using</c> genuegt.
    ///
    /// Ohne passendes Oeffnungsstueck gibt es nichts. Auch nicht fuer den
    /// Betreiber.
    /// </summary>
    public RcKeyBundle Open(string sessionId, ReadOnlySpan<byte> openingPiece)
    {
        if (!_entries.TryGetValue(sessionId, out var entry))
            throw new RcUnlockRequiredException("Kein Schluesselbund fuer diese Sitzung.");

        var now = _clock();
        if (now - entry.LastUsedUtc > _idleTimeout)
        {
            Forget(sessionId);
            throw new RcUnlockRequiredException("Schluesselbund abgelaufen.");
        }

        var aad = RcAad.Create("kernel", "session", entry.AccountId, RcField.AccountMasterKey, 1);
        byte[] plaintext;
        try
        {
            plaintext = RcCrypto.Open(DeriveCacheKey(openingPiece, sessionId), aad, entry.Sealed);
        }
        catch (RcDecryptException)
        {
            // Ein falsches Oeffnungsstueck sieht von aussen genauso aus wie eine
            // abgelaufene Sitzung. Es gibt keinen Grund, den Unterschied zu verraten.
            throw new RcUnlockRequiredException("Schluesselbund liess sich nicht oeffnen.");
        }

        try
        {
            _entries[sessionId] = entry with { LastUsedUtc = now };
            return RcKeyBundle.Deserialize(plaintext);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    /// <summary>
    /// 3.9 — Ist die Sitzung widerrufen, ist der Bund unbrauchbar. Der
    /// Sitzungswiderruf wirkt damit sofort und nicht erst beim Ablauf.
    /// </summary>
    public bool Forget(string sessionId)
    {
        if (!_entries.TryRemove(sessionId, out var entry)) return false;
        CryptographicOperations.ZeroMemory(entry.Sealed);
        return true;
    }

    public int ForgetAccount(Guid accountId)
    {
        var hits = _entries.Where(kv => kv.Value.AccountId == accountId).Select(kv => kv.Key).ToList();
        foreach (var key in hits) Forget(key);
        return hits.Count;
    }

    public int EvictIdle()
    {
        var now = _clock();
        var stale = _entries.Where(kv => now - kv.Value.LastUsedUtc > _idleTimeout).Select(kv => kv.Key).ToList();
        foreach (var key in stale) Forget(key);
        return stale.Count;
    }

    /// <summary>
    /// 21.7 — <c>recreatio:v1:cache-unwrap:&lt;sitzungs-id&gt;</c>.
    ///
    /// Die Ableitung ist absichtlich SCHNELL. Die langsame Ableitung sitzt beim
    /// Entsperren (3.15, Argon2id); saesse sie hier, waere der sichere Modus
    /// unbenutzbar. Die Bindung an die Sitzungs-ID sorgt dafuer, dass ein
    /// Oeffnungsstueck aus einer anderen Sitzung nicht passt.
    /// </summary>
    private static byte[] DeriveCacheKey(ReadOnlySpan<byte> openingPiece, string sessionId)
    {
        if (openingPiece.Length == 0)
            throw new RcUnlockRequiredException("Kein Oeffnungsstueck mitgeschickt.");
        return RcCrypto.Derive(openingPiece, RcCrypto.InfoCacheUnwrap(sessionId), RcCrypto.KeySize);
    }

    public void Dispose()
    {
        foreach (var key in _entries.Keys) Forget(key);
    }

    private readonly record struct SealedEntry(
        byte[] Sealed, Guid AccountId, DateTimeOffset CreatedUtc, DateTimeOffset LastUsedUtc);
}

/// <summary>
/// Der entfaltete Schluesselbund. Lebt NUR fuer die Dauer einer Anfrage.
///
/// 3.9 verlangt ausdruecklich, dass er am Ende <em>aktiv ueberschrieben</em>
/// wird und nicht dem Aufraeumen der Laufzeitumgebung ueberlassen bleibt — und
/// dass es dafuer einen Test gibt. Beides ist erfuellt.
/// </summary>
public sealed class RcKeyBundle : IDisposable
{
    private readonly byte[] _masterKey;
    private readonly Dictionary<Guid, byte[]> _roleReadKeys;
    private bool _disposed;

    public Guid AccountId { get; }

    public RcKeyBundle(Guid accountId, byte[] masterKey, IReadOnlyDictionary<Guid, byte[]>? roleReadKeys = null)
    {
        if (masterKey.Length != RcCrypto.KeySize)
            throw new ArgumentException("MasterKey muss 32 Byte lang sein.", nameof(masterKey));

        AccountId = accountId;
        _masterKey = (byte[])masterKey.Clone();
        _roleReadKeys = roleReadKeys?.ToDictionary(kv => kv.Key, kv => (byte[])kv.Value.Clone()) ?? [];
    }

    public ReadOnlySpan<byte> MasterKey => Guard()._masterKey;

    public IReadOnlyCollection<Guid> ReachableRoles => Guard()._roleReadKeys.Keys;

    /// <summary>
    /// 21.6 — Rollenschluessel werden aus dem Wurzelschluessel ABGELEITET. Sie
    /// werden hier nur zwischengehalten, damit eine Anfrage sie nicht mehrfach
    /// rechnet; ihre Quelle bleibt der MasterKey.
    /// </summary>
    public ReadOnlySpan<byte> RoleReadKey(Guid roleId)
    {
        Guard();
        if (!_roleReadKeys.TryGetValue(roleId, out var key))
        {
            key = RcCrypto.DeriveRoleReadKey(_masterKey, roleId);
            _roleReadKeys[roleId] = key;
        }
        return key;
    }

    internal byte[] Serialize()
    {
        Guard();
        // accountId(16) | masterKey(32) | anzahl(4) | [roleId(16) | key(32)]*
        var buf = new byte[16 + RcCrypto.KeySize + 4 + _roleReadKeys.Count * (16 + RcCrypto.KeySize)];
        AccountId.TryWriteBytes(buf.AsSpan(0, 16), bigEndian: true, out _);
        _masterKey.CopyTo(buf.AsSpan(16));
        BitConverter.TryWriteBytes(buf.AsSpan(16 + RcCrypto.KeySize, 4), _roleReadKeys.Count);

        var off = 16 + RcCrypto.KeySize + 4;
        foreach (var (roleId, key) in _roleReadKeys)
        {
            roleId.TryWriteBytes(buf.AsSpan(off, 16), bigEndian: true, out _);
            key.CopyTo(buf.AsSpan(off + 16));
            off += 16 + RcCrypto.KeySize;
        }
        return buf;
    }

    internal static RcKeyBundle Deserialize(ReadOnlySpan<byte> data)
    {
        var accountId = new Guid(data[..16], bigEndian: true);
        var masterKey = data.Slice(16, RcCrypto.KeySize).ToArray();
        var count = BitConverter.ToInt32(data.Slice(16 + RcCrypto.KeySize, 4));

        var roles = new Dictionary<Guid, byte[]>(count);
        var off = 16 + RcCrypto.KeySize + 4;
        for (var i = 0; i < count; i++)
        {
            roles[new Guid(data.Slice(off, 16), bigEndian: true)] =
                data.Slice(off + 16, RcCrypto.KeySize).ToArray();
            off += 16 + RcCrypto.KeySize;
        }

        var bundle = new RcKeyBundle(accountId, masterKey, roles);
        CryptographicOperations.ZeroMemory(masterKey);
        foreach (var k in roles.Values) CryptographicOperations.ZeroMemory(k);
        return bundle;
    }

    private RcKeyBundle Guard() =>
        _disposed ? throw new ObjectDisposedException(nameof(RcKeyBundle),
            "Der entfaltete Bund gilt nur fuer die Dauer einer Anfrage (3.9).") : this;

    /// <summary>3.9 — Aktives Ueberschreiben, nicht dem Aufraeumer ueberlassen.</summary>
    public void Dispose()
    {
        if (_disposed) return;
        CryptographicOperations.ZeroMemory(_masterKey);
        foreach (var key in _roleReadKeys.Values) CryptographicOperations.ZeroMemory(key);
        _roleReadKeys.Clear();
        _disposed = true;
    }

    /// <summary>Nur fuer die Pruefreihe: belegt, dass Dispose wirklich ueberschreibt.</summary>
    internal bool RawMasterKeyIsZeroed() => _masterKey.All(b => b == 0);
}

/// <summary>
/// 9.16 — Fuehrt im Klienten zum plattformweiten Entsperr-Baustein. Ueberall,
/// wo verschluesselter Inhalt ohne Schluessel angefragt wird, erscheint
/// dieselbe Aufforderung.
/// </summary>
public sealed class RcUnlockRequiredException(string message) : Exception(message)
{
    public string Code => RcErrorCodes.SessionUnlockRequired;
}
