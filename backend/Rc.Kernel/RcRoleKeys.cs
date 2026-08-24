using System.Security.Cryptography;

namespace Rc.Kernel;

/// <summary>
/// 21.6 und 3.1 — Wie eine Rolle zu ihren Schluesseln kommt, und wer sie oeffnen kann.
///
/// <b>Der Aufbau in einem Bild</b>
/// <code>
///   Konto
///     │ MasterKey (im Bund, 3.9)
///     │
///     ├─ Derive(MasterKey, role-read:&lt;persoenliche Rolle&gt;)
///     │      │
///     │      ▼
///     │  persoenliche Rolle ── sign_private_sealed / wrap_private_sealed
///     │                             │
///     │                             │ RSA-OAEP unter wrap_public der HALTENDEN Rolle
///     │                             ▼
///     │                        rc_role_key_grant(key_kind='data_key', key_ref=R)
///     │                             │
///     │                             ▼
///     └─────────────────────► Rolle R ── RoleKey (zufaellig) ── ihre privaten Schluessel
/// </code>
///
/// <b>Warum die persoenliche Rolle anders behandelt wird.</b> Ein abgeleiteter
/// Schluessel gehoert genau einem Konto — zwei Konten mit verschiedenen
/// Wurzelschluesseln leiten Verschiedenes ab. Fuer eine Rolle, die MEHRERE
/// halten, taugt Ableitung deshalb nicht; dort ist der RoleKey zufaellig und
/// wird je Halter verpackt (21.6: „gewrappt, nicht abgeleitet"). Genau ein Fall
/// hat immer nur einen Halter — die persoenliche Rolle des Kontos. Sie ist die
/// Wurzel des Ganzen, und nur sie darf abgeleitet werden.
///
/// <b>Was daraus folgt.</b> Erreichbarkeit im Rollengraphen IST
/// Schluesselerreichbarkeit. Es gibt keinen zweiten Weg an eine Rolle heran:
/// wer keine Kette von Zuteilungen zu ihr hat, hat ihre Schluessel nicht — auch
/// der Betreiber nicht. Das ist der Unterschied zwischen einer
/// Berechtigungspruefung, die man umgehen kann, und einer, die man nicht
/// umgehen kann.
/// </summary>
public static class RcRoleKeys
{
    /// <summary>
    /// 21.6 — ZWEI Schluesselpaare. Denselben RSA-Schluessel zum Signieren und
    /// zum Verpacken zu benutzen ist eine bekannte Schwaeche.
    /// </summary>
    public const int RsaKeySizeBits = 4096;

    /// <summary>
    /// Zwei RSA-4096-Paare zu erzeugen dauert Sekunden, gelegentlich zehn und
    /// mehr — die Zeit schwankt stark, weil Primzahlen gesucht werden. 21.6
    /// nennt das hinnehmbar, weil Rollen selten entstehen. Der Aufrufer muss
    /// trotzdem zwei Dinge tun: den Vorgang begrenzen (sonst ist er ein
    /// bequemer Hebel zum Umwerfen) und dem Menschen davor sagen, dass es
    /// dauert.
    /// </summary>
    public static RcRoleIdentity Create(Guid roleId, ReadOnlySpan<byte> roleKey)
    {
        using var sign = RSA.Create(RsaKeySizeBits);
        using var wrap = RSA.Create(RsaKeySizeBits);

        var signPublic = sign.ExportSubjectPublicKeyInfo();
        var wrapPublic = wrap.ExportSubjectPublicKeyInfo();

        var signPrivate = sign.ExportPkcs8PrivateKey();
        var wrapPrivate = wrap.ExportPkcs8PrivateKey();

        try
        {
            return new RcRoleIdentity
            {
                RoleId = roleId,
                SignPublicKey = signPublic,
                WrapPublicKey = wrapPublic,
                SignPrivateSealed = RcCrypto.Seal(roleKey, SignAad(roleId), signPrivate),
                WrapPrivateSealed = RcCrypto.Seal(roleKey, WrapAad(roleId), wrapPrivate),

                // 21.5 — Der Fingerabdruck steht als SignerKeyFingerprint in
                // jedem Ketteneintrag (7.5). Er kommt aus dem SIGNIER-Schluessel,
                // weil er dort die Frage beantwortet, die er beantworten soll:
                // wer hat unterschrieben.
                Fingerprint = RcCrypto.KeyIdFromPublicKey(signPublic),
                KeyVersion = 1
            };
        }
        finally
        {
            CryptographicOperations.ZeroMemory(signPrivate);
            CryptographicOperations.ZeroMemory(wrapPrivate);
        }
    }

    /// <summary>
    /// Der RoleKey der persoenlichen Rolle. Abgeleitet, nicht gespeichert — es
    /// gibt keine Huelle, die man stehlen koennte, und keine Zuteilung, die man
    /// vergessen koennte zu widerrufen.
    /// </summary>
    public static byte[] PersonalRoleKey(ReadOnlySpan<byte> masterKey, Guid personalRoleId) =>
        RcCrypto.DeriveRoleReadKey(masterKey, personalRoleId);

    public static RSA OpenSignKey(RcRoleIdentity role, ReadOnlySpan<byte> roleKey) =>
        Import(RcCrypto.Open(roleKey, SignAad(role.RoleId), role.SignPrivateSealed));

    public static RSA OpenWrapKey(RcRoleIdentity role, ReadOnlySpan<byte> roleKey) =>
        Import(RcCrypto.Open(roleKey, WrapAad(role.RoleId), role.WrapPrivateSealed));

    /// <summary>
    /// 21.6 — Eine Rolle einer anderen zuteilen. Der Zuteilende braucht dafuer
    /// den OEFFENTLICHEN Verpackungsschluessel des Halters und sonst nichts von
    /// ihm: ein Administrator nimmt jemanden auf, ohne dessen Geheimnisse zu
    /// kennen.
    /// </summary>
    public static byte[] GrantTo(byte[] holderWrapPublicKey, Guid grantedRoleId, ReadOnlySpan<byte> roleKey)
    {
        using var rsa = RSA.Create();
        rsa.ImportSubjectPublicKeyInfo(holderWrapPublicKey, out _);
        return RcCrypto.WrapKey(rsa, GrantAad(grantedRoleId), roleKey);
    }

    public static byte[] OpenGrant(RSA holderWrapPrivateKey, Guid grantedRoleId, ReadOnlySpan<byte> sealedBlob) =>
        RcCrypto.UnwrapKey(holderWrapPrivateKey, GrantAad(grantedRoleId), sealedBlob);

    /// <summary>Ein frischer RoleKey fuer eine Rolle, die mehr als ein Halter haben kann.</summary>
    public static byte[] NewRoleKey() => RcCrypto.NewSymmetricKey();

    private static RcAad SignAad(Guid roleId) =>
        RcAad.Create("kernel", "role", roleId, RcField.RoleSignPrivate, 1);

    private static RcAad WrapAad(Guid roleId) =>
        RcAad.Create("kernel", "role", roleId, RcField.RoleWrapPrivate, 1);

    /// <summary>
    /// Die Zuteilung klebt an der Rolle, die sie oeffnet — nicht an der, die
    /// sie haelt. Sonst liesse sich eine Huelle von einer Rolle auf eine andere
    /// umhaengen und der Halter bekaeme Schluessel, die ihm nie zugeteilt wurden.
    /// </summary>
    private static RcAad GrantAad(Guid grantedRoleId) =>
        RcAad.Create("kernel", "role_grant", grantedRoleId, RcField.RoleWrapPrivate, 1);

    private static RSA Import(byte[] pkcs8)
    {
        try
        {
            var rsa = RSA.Create();
            rsa.ImportPkcs8PrivateKey(pkcs8, out _);
            return rsa;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(pkcs8);
        }
    }
}

/// <summary>Was von einer Rolle in <c>rc_role</c> steht — ohne den Anzeigenamen.</summary>
public sealed record RcRoleIdentity
{
    public required Guid RoleId { get; init; }
    public required byte[] SignPublicKey { get; init; }
    public required byte[] WrapPublicKey { get; init; }
    public required byte[] SignPrivateSealed { get; init; }
    public required byte[] WrapPrivateSealed { get; init; }
    public required byte[] Fingerprint { get; init; }
    public required int KeyVersion { get; init; }
}
