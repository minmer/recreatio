using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Rc.Kernel;

// ---------------------------------------------------------------------------
// Pruefreihe fuer den Kernel.
//
// Die Testvektoren aus Anhang C 21.9 und Anhang D 22.5 liegen hier als
// ausfuehrbare Pruefaelle. Sie sind vor der Umsetzung unabhaengig nachgerechnet
// worden; eine Umsetzung, die sie nicht reproduziert, ist falsch — unabhaengig
// davon, wie ueberzeugend sie aussieht.
//
// Bewusst ohne Testrahmen von aussen: null Abhaengigkeiten, laeuft mit
// "dotnet run" und liefert einen Rueckgabewert, den CI auswerten kann.
// ---------------------------------------------------------------------------

var t = new Runner();

// === Anhang C — Ableitung ===================================================

var masterKey = RcCrypto.FromHex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
var roleId = RcId.Parse("01937d4e-8f2a-7c31-9b05-2f6a1e8c4d77");

t.Eq("TV-1  Info-Zeichenkette",
    RcCrypto.ToHex(Encoding.UTF8.GetBytes(RcCrypto.InfoRoleRead(roleId))),
    "72656372656174696f3a76313a726f6c652d726561643a30313933376434652d386632612d376333312d396230352d326636613165386334643737");

var roleReadKey = RcCrypto.DeriveRoleReadKey(masterKey, roleId);
t.Eq("TV-1  RoleReadKey", RcCrypto.ToHex(roleReadKey),
    "0d73186dc9209c184f70dcace671052920e5aa888b68381be27c10fa570645d6");

t.Eq("TV-2  KeyId aus symmetrischem Schluessel", RcCrypto.ToHex(RcCrypto.KeyId(roleReadKey)),
    "71c0ce10a2cd8cd62e722970c823b33d");

var epochKey = RcCrypto.FromHex("a0a1a2a3a4a5a6a7a8a9aaabacadaeafa0a1a2a3a4a5a6a7a8a9aaabacadaeaf");
t.Eq("TV-3  KeyId des EpochKey", RcCrypto.ToHex(RcCrypto.KeyId(epochKey)),
    "0abee07b44f9704ea3a023596d74ee51");

// === Anhang C — Versiegelte Huelle ==========================================

var aad = RcAad.Create("chat", "message", roleId, RcField.MessageBody, 1);
t.Eq("TV-4  AAD-Zeichenkette", aad.Text,
    "chat:message:01937d4e-8f2a-7c31-9b05-2f6a1e8c4d77:body:1");

var nonce = RcCrypto.FromHex("000102030405060708090a0b");
var blob = RcCrypto.SealWithNonce(epochKey, aad, Encoding.UTF8.GetBytes("Guten Morgen."), nonce);

t.Eq("TV-4  Kopf", RcCrypto.ToHex(blob.AsSpan(0, 20)), "524301010abee07b44f9704ea3a023596d74ee51");
t.Eq("TV-4  Gesamtlaenge", blob!.Length.ToString(), "61");
t.Eq("TV-4  BLOB", RcCrypto.ToHex(blob),
    "524301010abee07b44f9704ea3a023596d74ee51" +
    "000102030405060708090a0b" +
    "77cdd1c31cfb6ba7274d8212a7" +
    "08ff048ced9fcb5dda6338a2a44bc6a5");

t.Eq("TV-4  Rueckweg", RcCrypto.OpenText(epochKey, aad, blob), "Guten Morgen.");

// TV-5 / TV-6 — Negativproben. Sie MUESSEN scheitern.
t.Throws("TV-5  AAD :body:2 scheitert", RcDecryptError.AadMismatch,
    () => RcCrypto.Open(epochKey, aad.NextVersion(), blob));

var tampered = blob.ToArray();
tampered[3] = 0x02;                       // AlgId im Kopf verfaelscht
t.Throws("TV-6  verfaelschte AlgId scheitert", RcDecryptError.UnknownAlgorithm,
    () => RcCrypto.Open(epochKey, aad, tampered));

// Der eigentliche Beweis zu TV-6: der Kopf liegt in der AAD. Wir bauen eine
// Huelle mit einer AlgId, die ReadHeader passieren laesst, aber im Kopf
// veraendert ist — nur wenn der Kopf mitauthentifiziert ist, scheitert das.
var tampered2 = blob.ToArray();
tampered2[19] ^= 0x01;                    // letztes Byte der KeyId im Kopf
t.Throws("TV-6b verfaelschter Kopf scheitert (Kopf ist in der AAD)", RcDecryptError.AadMismatch,
    () => RcCrypto.Open(epochKey, aad, tampered2));

// Feldvertauschung — der Angriff, den 3.13 abstellt.
var aadDonor  = RcAad.Create("parish", "donation", roleId, RcField.ParishDonorName, 1);
var aadAmount = RcAad.Create("parish", "donation", roleId, RcField.ParishDonationAmount, 1);
var sealedDonor = RcCrypto.Seal(epochKey, aadDonor, "Maria Kowalska");
t.Throws("3.13  Geheimtext im falschen Feld scheitert", RcDecryptError.AadMismatch,
    () => RcCrypto.Open(epochKey, aadAmount, sealedDonor));

// === Anhang D — Kanonische Serialisierung ===================================

t.Eq("TV-7  Sortierung",
    RcCanonical.Serialize(RcJson.O(
        ("b", RcJson.I(1)), ("a", RcJson.I(2)), ("A", RcJson.I(3)), ("ä", RcJson.I(4)),
        ("z", RcJson.I(5)), ("Z", RcJson.I(6)), ("10", RcJson.I(7)), ("2", RcJson.I(8)))),
    "{\"10\":7,\"2\":8,\"A\":3,\"Z\":6,\"a\":2,\"b\":1,\"z\":5,\"ä\":4}");

var tv8 = RcJson.O(
    ("text", RcJson.S("Zeile1\nZeile2\t\"zitiert\"\\ende")),
    ("umlaut", RcJson.S("Grüße, Świętosław")));
t.Eq("TV-8  UTF-8-Bytes", RcCrypto.ToHex(RcCanonical.SerializeToUtf8(tv8)),
    "7b2274657874223a225a65696c65315c6e5a65696c65325c745c227a6974696572745c22" +
    "5c5c656e6465222c22756d6c617574223a224772c3bcc39f652c20c59a7769c499746f73" +
    "c5826177227d");

var entry1 = new RcLedgerEntry
{
    LedgerId = RcId.Parse("01937d4e-8f2a-7c31-9b05-2f6a1e8c4d77"),
    Sequence = 1,
    PreviousHash = RcLedgerEntry.GenesisPreviousHash,
    EntryId = RcId.Parse("01937d51-0c40-7f18-a2e6-4b91c7d3e550"),
    Payload = RcJson.O(
        ("action", RcJson.S("decision.accepted")),
        ("decisionId", RcJson.S("01937d50-1b22-7a04-8c13-9e2f5a7b6c88")),
        ("titleHash", RcJson.S("3b7c1e9a2d5f8041b6c3e7a9d2f5081c4b7e0a3d6f9c2e5b8a1d4f7c0e3a6b9d"))),
    SubjectId = RcId.Parse("01937d4f-3a11-7b92-8d47-5c0e2a9f1b63"),
    TenantId = RcId.Parse("01937d4d-2e08-7c55-9a31-6b4f8d0c7e29"),
    ModuleId = "chat",
    SignerKeyFingerprint = RcCrypto.FromHex("71c0ce10a2cd8cd62e722970c823b33d"),
    KeyVersion = 1,
    TransactionId = RcId.Parse("01937d51-0c40-7f18-a2e6-4b91c7d3e551"),
    AccountCommitment = RcCrypto.FromHex("9f2d1a4c7b8e0356a1c4d9f2b7e50318c6a9d4f7b2e58c1a3d6f9b2e5c8a1d4f"),
    Timestamp = DateTimeOffset.Parse("2026-08-24T09:15:42Z")
};

t.Eq("TV-9  Laenge", entry1.CanonicalBytes().Length.ToString(), "736");
t.Eq("TV-9  SHA-256", RcCrypto.ToHex(entry1.EntryHash()),
    "ac183864c2e3756955e859b6bbcc0c1c58722700c36eb35596f0614a7ca1e1fb");

// TV-10 — dieselben Felder, umgekehrt uebergeben. MUSS byteweise dasselbe ergeben.
var reversed = RcJson.O(
    ("timestamp",            RcJson.T(entry1.Timestamp)),
    ("transactionId",        RcJson.G(entry1.TransactionId)),
    ("accountCommitment",    RcJson.Hex(entry1.AccountCommitment)),
    ("keyVersion",           RcJson.I(entry1.KeyVersion)),
    ("signerKeyFingerprint", RcJson.Hex(entry1.SignerKeyFingerprint)),
    ("moduleId",             RcJson.S(entry1.ModuleId)),
    ("tenantId",             RcJson.G(entry1.TenantId)),
    ("subjectId",            RcJson.G(entry1.SubjectId)),
    ("payload",              entry1.Payload),
    ("entryId",              RcJson.G(entry1.EntryId)),
    ("previousHash",         RcJson.Hex(entry1.PreviousHash)),
    ("sequence",             RcJson.I(entry1.Sequence)),
    ("ledgerId",             RcJson.G(entry1.LedgerId)));
t.Eq("TV-10 Reihenfolgeunabhaengig", RcCrypto.ToHex(RcCanonical.Hash(reversed)),
    "ac183864c2e3756955e859b6bbcc0c1c58722700c36eb35596f0614a7ca1e1fb");

var entry2 = entry1 with
{
    Sequence = 2,
    PreviousHash = entry1.EntryHash(),
    EntryId = RcId.Parse("01937d51-0c40-7f18-a2e6-4b91c7d3e552"),
    Payload = RcJson.O(
        ("action", RcJson.S("message.posted")),
        ("messageId", RcJson.S("01937d52-4f66-7d10-b8a2-3c7e9d1f5a04"))),
    TransactionId = RcId.Parse("01937d51-0c40-7f18-a2e6-4b91c7d3e553"),
    Timestamp = DateTimeOffset.Parse("2026-08-24T09:16:03Z")
};
t.Eq("TV-11 Verkettung", RcCrypto.ToHex(entry2.EntryHash()),
    "f5a8e0fe244ee33b2e3f3c0e8053abf7ba3a1995d7f2dc85ac1781a1d06c6729");

// === 22.3 — Gleitkomma ist verboten =========================================
t.Ok("22.3  Ganzzahl ausserhalb 2^53 wird abgelehnt", () =>
{
    try { RcCanonical.Serialize(RcJson.I(RcCanonical.MaxSafeInteger + 1)); return false; }
    catch (InvalidOperationException) { return true; }
});

// === Anhang E — ID-Format ===================================================

var id = RcId.NewId();
t.Ok("23.1  Erzeugte ID ist UUIDv7", () => RcId.IsVersion7(id));
t.Ok("23.1  Zeitstempel plausibel", () =>
{
    var ts = RcId.TimestampHint(id);
    return ts is not null && Math.Abs((DateTimeOffset.UtcNow - ts.Value).TotalSeconds) < 10;
});
t.Ok("23.1  Sortierbarkeit", () =>
{
    var a = RcId.NewId(DateTimeOffset.UtcNow);
    var b = RcId.NewId(DateTimeOffset.UtcNow.AddMilliseconds(1));
    Span<byte> ba = stackalloc byte[16], bb = stackalloc byte[16];
    a.TryWriteBytes(ba, bigEndian: true, out _);
    b.TryWriteBytes(bb, bigEndian: true, out _);
    return ba.SequenceCompareTo(bb) < 0;
});
t.Ok("23.4  Grossbuchstaben werden abgelehnt", () =>
{
    try { RcId.Parse("01937D4E-8F2A-7C31-9B05-2F6A1E8C4D77"); return false; }
    catch (FormatException) { return true; }
});

// === 3.13 — Pflichtparameter ================================================
t.Ok("3.13  Version 0 wird abgelehnt", () =>
{
    try { RcAad.Create("chat", "message", roleId, RcField.MessageBody, 0); return false; }
    catch (ArgumentOutOfRangeException) { return true; }
});
t.Ok("3.13  Doppelpunkt im Modulnamen wird abgelehnt", () =>
{
    try { RcAad.Create("ch:at", "message", roleId, RcField.MessageBody, 1); return false; }
    catch (ArgumentException) { return true; }
});

// === 21.6 — Verpacken unter oeffentlichem Schluessel ========================
t.Ok("21.6  Bereichsschluessel wrappen und auspacken", () =>
{
    using var rsa = RSA.Create(4096);
    var wrapAad = RcAad.Create("kernel", "role", roleId, RcField.RoleWrapPrivate, 1);
    var wrapped = RcCrypto.WrapKey(rsa, wrapAad, epochKey);
    if (wrapped.Length != 20 + 512) return false;      // 21.3: genau 532 Byte
    var back = RcCrypto.UnwrapKey(rsa, wrapAad, wrapped);
    return back.AsSpan().SequenceEqual(epochKey);
});
t.Ok("21.6  Auspacken mit falscher AAD scheitert", () =>
{
    using var rsa = RSA.Create(4096);
    var a1 = RcAad.Create("kernel", "role", roleId, RcField.RoleWrapPrivate, 1);
    var a2 = RcAad.Create("kernel", "role", roleId, RcField.RoleSignPrivate, 1);
    var wrapped = RcCrypto.WrapKey(rsa, a1, epochKey);
    try { RcCrypto.UnwrapKey(rsa, a2, wrapped); return false; }
    catch (RcDecryptException e) { return e.Error == RcDecryptError.AadMismatch; }
});

// === 7.2 — Signatur =========================================================
t.Ok("7.2   Ketteneintrag signieren und pruefen", () =>
{
    using var rsa = RSA.Create(4096);
    var h = entry1.EntryHash();
    var sig = RcLedgerEntry.Sign(rsa, h);
    if (!RcLedgerEntry.Verify(rsa, h, sig)) return false;
    var h2 = entry2.EntryHash();
    return !RcLedgerEntry.Verify(rsa, h2, sig);   // Signatur gilt nicht fuer einen anderen Eintrag
});

// === 10.3 — Der eine Token-Baustein =========================================

var now = DateTimeOffset.Parse("2026-08-24T12:00:00Z");

t.Ok("10.3  Klartext wird nie gespeichert", () =>
{
    var (secret, record) = RcToken.Create(RcTokenPurpose.EventAccessLink, roleId, now, TimeSpan.FromDays(30));
    // Der Datensatz darf das Geheimnis in keiner Form enthalten.
    return record.Hash.Length == 32
        && !RcCrypto.ToHex(record.Hash).Contains(secret, StringComparison.OrdinalIgnoreCase)
        && RcToken.Verify(record, secret, now);
});

t.Ok("10.3  Falsches Geheimnis wird abgelehnt", () =>
{
    var (_, record) = RcToken.Create(RcTokenPurpose.ReservationView, roleId, now, TimeSpan.FromDays(1));
    return !RcToken.Verify(record, "voellig-falsch", now);
});

t.Ok("10.3  Abgelaufener Token wird abgelehnt", () =>
{
    var (secret, record) = RcToken.Create(RcTokenPurpose.ReservationView, roleId, now, TimeSpan.FromHours(1));
    return !RcToken.Verify(record, secret, now.AddHours(2));
});

t.Ok("10.3  Widerrufener Token wird abgelehnt", () =>
{
    var (secret, record) = RcToken.Create(RcTokenPurpose.HostInvitation, roleId, now, TimeSpan.FromDays(1));
    return !RcToken.Verify(record with { RevokedUtc = now }, secret, now);
});

t.Ok("10.4  SMS-Link unter 7 Tagen wird abgelehnt", () =>
{
    try { RcToken.Create(RcTokenPurpose.SmsAccessLink, roleId, now, TimeSpan.FromHours(1)); return false; }
    catch (ArgumentOutOfRangeException) { return true; }
});

t.Ok("10.3  Token ohne Lebenszeit wird abgelehnt", () =>
{
    try { RcToken.Create(RcTokenPurpose.EventAccessLink, roleId, now, TimeSpan.Zero); return false; }
    catch (ArgumentOutOfRangeException) { return true; }
});

t.Ok("10.3  Zwei Tokens sind verschieden", () =>
{
    var (a, _) = RcToken.Create(RcTokenPurpose.EventAccessLink, roleId, now, TimeSpan.FromDays(1));
    var (b, _) = RcToken.Create(RcTokenPurpose.EventAccessLink, roleId, now, TimeSpan.FromDays(1));
    return a != b && a.Length >= 24;
});

// === 15.7 — Fehlerformat ====================================================

t.Ok("15.7  Kennung muss hierarchisch sein", () =>
{
    try { RcError.Create("kaputt", "x", "t1"); return false; }
    catch (ArgumentException) { return true; }
});

t.Ok("15.7  Fehler mit Geheimtext faellt auf", () =>
{
    var bad = RcError.Create("crypto.aad_mismatch", $"Blob: {RcCrypto.ToHex(epochKey)}", "t2");
    var good = RcError.Create("crypto.aad_mismatch", "Integritaetspruefung fehlgeschlagen.", "t3");
    return !bad.LooksSafe() && good.LooksSafe();
});

// === 3.9 — Der geteilte Schluessel ==========================================

var sessionId = "sitzung-01937d4e";
var openingPiece = RcCrypto.FromHex("11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff");
var accountId = RcId.NewId();

t.Ok("3.9   Bund oeffnet sich mit dem richtigen Oeffnungsstueck", () =>
{
    using var vault = new RcKeyVault();
    using var bundle = new RcKeyBundle(accountId, masterKey);
    vault.Store(sessionId, openingPiece, bundle);
    using var opened = vault.Open(sessionId, openingPiece);
    return opened.AccountId == accountId && opened.MasterKey.SequenceEqual(masterKey);
});

t.Ok("3.9   Ohne Oeffnungsstueck kommt der Server an NICHTS", () =>
{
    using var vault = new RcKeyVault();
    using var bundle = new RcKeyBundle(accountId, masterKey);
    vault.Store(sessionId, openingPiece, bundle);
    try { vault.Open(sessionId, ReadOnlySpan<byte>.Empty); return false; }
    catch (RcUnlockRequiredException) { return true; }
});

t.Ok("3.9   Falsches Oeffnungsstueck oeffnet nicht", () =>
{
    using var vault = new RcKeyVault();
    using var bundle = new RcKeyBundle(accountId, masterKey);
    vault.Store(sessionId, openingPiece, bundle);
    var wrong = RcCrypto.FromHex("00000000000000000000000000000000000000000000000000000000000000ff");
    try { vault.Open(sessionId, wrong); return false; }
    catch (RcUnlockRequiredException) { return true; }
});

t.Ok("3.9   Oeffnungsstueck einer anderen Sitzung passt nicht", () =>
{
    using var vault = new RcKeyVault();
    using var bundle = new RcKeyBundle(accountId, masterKey);
    vault.Store(sessionId, openingPiece, bundle);
    try { vault.Open("andere-sitzung", openingPiece); return false; }
    catch (RcUnlockRequiredException) { return true; }
});

t.Ok("3.9   Sitzungswiderruf macht den Bund sofort unbrauchbar", () =>
{
    using var vault = new RcKeyVault();
    using var bundle = new RcKeyBundle(accountId, masterKey);
    vault.Store(sessionId, openingPiece, bundle);
    vault.Forget(sessionId);
    try { vault.Open(sessionId, openingPiece); return false; }
    catch (RcUnlockRequiredException) { return true; }
});

t.Ok("2.4   Bund laeuft nach Untaetigkeit ab", () =>
{
    var clock = DateTimeOffset.Parse("2026-08-24T12:00:00Z");
    using var vault = new RcKeyVault(TimeSpan.FromMinutes(15), clock: () => clock);
    using var bundle = new RcKeyBundle(accountId, masterKey);
    vault.Store(sessionId, openingPiece, bundle);
    clock = clock.AddMinutes(16);
    try { vault.Open(sessionId, openingPiece); return false; }
    catch (RcUnlockRequiredException) { return vault.Count == 0; }
});

// 3.9 verlangt diesen Test ausdruecklich: der entfaltete Bund MUSS am Ende der
// Anfrage aktiv ueberschrieben werden, nicht dem Aufraeumer ueberlassen.
t.Ok("3.9   Entfalteter Bund wird beim Entsorgen ueberschrieben", () =>
{
    var bundle = new RcKeyBundle(accountId, masterKey);
    if (bundle.RawMasterKeyIsZeroed()) return false;   // vorher belegt
    bundle.Dispose();
    return bundle.RawMasterKeyIsZeroed();
});

t.Ok("3.9   Entsorgter Bund liefert nichts mehr", () =>
{
    var bundle = new RcKeyBundle(accountId, masterKey);
    bundle.Dispose();
    try { _ = bundle.MasterKey.Length; return false; }
    catch (ObjectDisposedException) { return true; }
});

t.Ok("21.6  Rollenschluessel entsteht aus dem Wurzelschluessel", () =>
{
    using var bundle = new RcKeyBundle(accountId, masterKey);
    return bundle.RoleReadKey(roleId).SequenceEqual(RcCrypto.DeriveRoleReadKey(masterKey, roleId));
});

t.Ok("3.9   Alle Sitzungen eines Kontos lassen sich vergessen", () =>
{
    using var vault = new RcKeyVault();
    using var bundle = new RcKeyBundle(accountId, masterKey);
    vault.Store("s1", openingPiece, bundle);
    vault.Store("s2", openingPiece, bundle);
    return vault.ForgetAccount(accountId) == 2 && vault.Count == 0;
});

// === 21.8 — Passwort, Verifier, Entsperrmaterial ============================

var pwSalt = RcCrypto.FromHex("0102030405060708090a0b0c0d0e0f10");
var swPw = System.Diagnostics.Stopwatch.StartNew();
var passwordKey = RcPassword.DerivePasswordKey("ein hinreichend langes Passwort", pwSalt);
swPw.Stop();

t.Ok("21.8  PasswordKey ist bestimmt und 32 Byte lang", () =>
    passwordKey.Length == 32
    && RcPassword.DerivePasswordKey("ein hinreichend langes Passwort", pwSalt).SequenceEqual(passwordKey));

t.Ok("3.15  Anderes Salz ergibt anderen Schluessel", () =>
    !RcPassword.DerivePasswordKey("ein hinreichend langes Passwort", RcPassword.NewSalt())
        .SequenceEqual(passwordKey));

var accountForPw = RcId.NewId();
var accountMasterKey = RcCrypto.NewSymmetricKey();
var secrets = RcAccountSecrets.Create(accountForPw, passwordKey, accountMasterKey, pwSalt);

t.Ok("21.8  Verifier bestaetigt den richtigen PasswordKey", () =>
    RcPassword.VerifyLogin(passwordKey, secrets.LoginSalt, secrets.LoginVerifier));

t.Ok("21.8  Verifier lehnt einen falschen PasswordKey ab", () =>
    !RcPassword.VerifyLogin(RcCrypto.NewSymmetricKey(), secrets.LoginSalt, secrets.LoginVerifier));

// Der Kern von 3.15: Wer die Datenbank hat, bekommt mit dem Verifier NICHTS auf.
t.Ok("3.15  Verifier ist nicht der Schluessel des MasterKey", () =>
{
    try { secrets.UnsealMasterKey(accountForPw, secrets.LoginVerifier); return false; }
    catch (RcDecryptException) { return true; }
});

t.Ok("21.8  MasterKey laesst sich mit dem PasswordKey oeffnen", () =>
    secrets.UnsealMasterKey(accountForPw, passwordKey).SequenceEqual(accountMasterKey));

t.Ok("21.8  MasterKey einer anderen Kennung oeffnet nicht (AAD bindet)", () =>
{
    try { secrets.UnsealMasterKey(RcId.NewId(), passwordKey); return false; }
    catch (RcDecryptException) { return true; }
});

// E-269 — der eigentliche Betriebsvorteil des Wurzelschluessels.
t.Ok("21.8  Passwortwechsel laesst den MasterKey unveraendert", () =>
{
    var newSalt = RcPassword.NewSalt();
    var newPasswordKey = RcPassword.DerivePasswordKey("ein ganz anderes Passwort", newSalt);
    var updated = secrets.WithNewPassword(accountForPw, passwordKey, newPasswordKey, newSalt);

    return updated.UnsealMasterKey(accountForPw, newPasswordKey).SequenceEqual(accountMasterKey)
        && RcPassword.VerifyLogin(newPasswordKey, updated.LoginSalt, updated.LoginVerifier)
        && !RcPassword.VerifyLogin(passwordKey, updated.LoginSalt, updated.LoginVerifier);
});

// BEFUND 31/35 — Messung statt Schaetzung. Die Zahl gehoert auf den Tisch,
// bevor 21.1 endgueltig festgeschrieben wird.
var swVerifier = System.Diagnostics.Stopwatch.StartNew();
_ = RcPassword.DeriveLoginVerifier(passwordKey, secrets.LoginSalt);
swVerifier.Stop();

// === 3.14 — Der Rollengraph ================================================

var rA = RcId.NewId();
var rB = RcId.NewId();
var rC = RcId.NewId();
var rD = RcId.NewId();

// A -> B -> C, und D steht abseits.
var chain = new List<RcRoleGraph.Edge>
{
    new(rA, rB),
    new(rB, rC)
};

t.Ok("3.14  Erreichbarkeit laeuft ueber mehrere Stufen", () =>
{
    var reachable = RcRoleGraph.Reachable(rA, chain);
    return reachable.Contains(rA) && reachable.Contains(rB) && reachable.Contains(rC)
        && !reachable.Contains(rD);
});

t.Ok("3.14  Erreichbarkeit ist gerichtet", () =>
    !RcRoleGraph.Reachable(rC, chain).Contains(rA));

t.Ok("3.14  Kante zurueck an den Anfang schliesst einen Kreis", () =>
    RcRoleGraph.WouldCreateCycle(rC, rA, chain));

t.Ok("3.14  Kante auf sich selbst ist ein Kreis", () =>
    RcRoleGraph.WouldCreateCycle(rA, rA, chain));

t.Ok("3.14  Eine Abkuerzung ist kein Kreis", () =>
    !RcRoleGraph.WouldCreateCycle(rA, rC, chain));

t.Ok("3.14  Ein bestehender Kreis wird gefunden", () =>
{
    var withCycle = new List<RcRoleGraph.Edge>(chain) { new(rC, rA) };
    var cycle = RcRoleGraph.FindCycle(withCycle);
    return cycle is not null && cycle.Count >= 3 && cycle[0] == cycle[^1];
});

t.Ok("3.14  Ein kreisfreier Graph meldet keinen Kreis", () =>
    RcRoleGraph.FindCycle(chain) is null);

t.Ok("3.14  Ein Kreis laesst die Erreichbarkeit nicht endlos laufen", () =>
{
    // Sonst waere die Zyklenpruefung selbst der Hebel: eine Kante einschmuggeln
    // und jede weitere Anzeige haengt.
    var loop = new List<RcRoleGraph.Edge> { new(rA, rB), new(rB, rA) };
    return RcRoleGraph.Reachable(rA, loop).Count == 2;
});

t.Ok("3.14  Tiefe wird begrenzt", () =>
{
    var deep = new List<RcRoleGraph.Edge>();
    var nodes = new List<Guid> { rA };
    for (var i = 0; i < 40; i++)
    {
        var next = RcId.NewId();
        deep.Add(new RcRoleGraph.Edge(nodes[^1], next));
        nodes.Add(next);
    }
    return RcRoleGraph.Reachable(rA, deep, 5).Count == 6;
});

// === 3.5 — Was eine Stufe einschliesst =====================================

t.Ok("3.5   admin schliesst write und read ein", () =>
    RcCapabilities.Covers(RcCapability.Admin, RcCapability.Write)
    && RcCapabilities.Covers(RcCapability.Admin, RcCapability.Read));

t.Ok("3.5   read schliesst write NICHT ein", () =>
    !RcCapabilities.Covers(RcCapability.Read, RcCapability.Write));

// Der Pfarrer, der jemanden aufnimmt, ohne selbst mitzulesen.
t.Ok("3.5   certify schliesst read NICHT ein", () =>
    !RcCapabilities.Covers(RcCapability.Certify, RcCapability.Read));

t.Ok("3.5   admin schliesst certify NICHT ein", () =>
    !RcCapabilities.Covers(RcCapability.Admin, RcCapability.Certify));

t.Ok("3.5   certify deckt sich selbst", () =>
    RcCapabilities.Covers(RcCapability.Certify, RcCapability.Certify));

t.Ok("3.5   Stufen ueberstehen Hin- und Rueckuebersetzung", () =>
    new[] { RcCapability.Read, RcCapability.Write, RcCapability.Admin, RcCapability.Certify }
        .All(c => RcCapabilities.TryParse(RcCapabilities.ToText(c), out var back) && back == c));

// === 21.6 — Rollenschluessel ================================================

// Zwei RSA-4096-Paare je Rolle. Die Pruefreihe legt genau zwei Rollen an; jede
// weitere kostet Sekunden und beweist nichts Neues.
var personalRoleId = RcId.NewId();
var accountMaster = RcCrypto.NewSymmetricKey();
var personalKey = RcRoleKeys.PersonalRoleKey(accountMaster, personalRoleId);
var personal = RcRoleKeys.Create(personalRoleId, personalKey);

t.Ok("21.6  Signier- und Verpackungsschluessel sind verschieden", () =>
    !personal.SignPublicKey.SequenceEqual(personal.WrapPublicKey));

t.Ok("21.5  Der Fingerabdruck kommt aus dem Signierschluessel", () =>
    personal.Fingerprint.SequenceEqual(RcCrypto.KeyIdFromPublicKey(personal.SignPublicKey)));

t.Ok("21.6  Der persoenliche Rollenschluessel ist ableitbar, nicht gespeichert", () =>
    RcRoleKeys.PersonalRoleKey(accountMaster, personalRoleId).SequenceEqual(personalKey));

t.Ok("21.6  Ein anderer Wurzelschluessel oeffnet die persoenliche Rolle nicht", () =>
{
    try
    {
        using var _ = RcRoleKeys.OpenSignKey(personal,
            RcRoleKeys.PersonalRoleKey(RcCrypto.NewSymmetricKey(), personalRoleId));
        return false;
    }
    catch (RcDecryptException) { return true; }
});

t.Ok("21.6  Der private Signierschluessel laesst sich oeffnen und signiert", () =>
{
    using var signKey = RcRoleKeys.OpenSignKey(personal, personalKey);
    var hash = SHA256.HashData("etwas"u8.ToArray());
    var signature = RcLedgerEntry.Sign(signKey, hash);

    using var publicKey = RSA.Create();
    publicKey.ImportSubjectPublicKeyInfo(personal.SignPublicKey, out _);
    return RcLedgerEntry.Verify(publicKey, hash, signature);
});

// Die Zuteilung: eine Rolle einem Halter geben, ohne dessen Geheimnisse zu kennen.
var teamRoleId = RcId.NewId();
var teamKey = RcRoleKeys.NewRoleKey();
var team = RcRoleKeys.Create(teamRoleId, teamKey);
var grant = RcRoleKeys.GrantTo(personal.WrapPublicKey, teamRoleId, teamKey);

t.Ok("21.6  Zuteilung braucht nur den oeffentlichen Verpackungsschluessel", () =>
{
    using var wrapKey = RcRoleKeys.OpenWrapKey(personal, personalKey);
    return RcRoleKeys.OpenGrant(wrapKey, teamRoleId, grant).SequenceEqual(teamKey);
});

t.Ok("21.6  Ueber die Zuteilung oeffnet sich die zugeteilte Rolle", () =>
{
    using var wrapKey = RcRoleKeys.OpenWrapKey(personal, personalKey);
    var opened = RcRoleKeys.OpenGrant(wrapKey, teamRoleId, grant);
    using var teamSign = RcRoleKeys.OpenSignKey(team, opened);
    return teamSign.KeySize == RcRoleKeys.RsaKeySizeBits;
});

// Der Kern: eine Huelle laesst sich nicht auf eine andere Rolle umhaengen.
t.Ok("21.6  Eine Zuteilung gilt nur fuer die Rolle, fuer die sie ausgestellt ist", () =>
{
    using var wrapKey = RcRoleKeys.OpenWrapKey(personal, personalKey);
    try { RcRoleKeys.OpenGrant(wrapKey, RcId.NewId(), grant); return false; }
    catch (RcDecryptException e) { return e.Error == RcDecryptError.AadMismatch; }
});

// Der Betreiber hat rc_role vollstaendig vor sich liegen: beide oeffentlichen
// Schluessel, beide versiegelten privaten, die Zuteilung. Ohne den Bund eines
// Halters ist das nichts wert — genau das ist die Zusage aus 7.2.
t.Ok("3.9   Wer die Tabelle hat, aber keinen Bund, kommt an nichts", () =>
{
    try { using var _ = RcRoleKeys.OpenSignKey(team, RcCrypto.NewSymmetricKey()); return false; }
    catch (RcDecryptException) { }

    using var fremdeRolle = RSA.Create(2048);
    try { RcRoleKeys.OpenGrant(fremdeRolle, teamRoleId, grant); return false; }
    catch (RcDecryptException) { return true; }
});

// === 8.2 — Geheimnisteilung ================================================

// Zuerst die Tabellen selbst. Mit einem falschen Erzeuger — die 2 hat unter
// 0x11b die Ordnung 51 — stuenden hier Luecken, und alles Weitere liefe
// trotzdem durch, nur mit falschem Ergebnis.
t.Ok("8.2   Die GF(2^8)-Tabellen durchlaufen den ganzen Koerper", RcShamir.TablesAreComplete);

var shamirSecret = RcCrypto.NewSymmetricKey();
var shares = RcShamir.Split(shamirSecret, total: 3, threshold: 2);

t.Ok("8.2   Drei Anteile mit verschiedenen Stellen", () =>
    shares.Length == 3 && shares.Select(s => s.X).Distinct().Count() == 3 && shares.All(s => s.X != 0));

t.Ok("8.2   Zwei von drei genuegen — in jeder Paarung", () =>
{
    var pairs = new[] { (0, 1), (0, 2), (1, 2) };
    return pairs.All(p =>
        RcShamir.Combine([shares[p.Item1], shares[p.Item2]]).SequenceEqual(shamirSecret));
});

t.Ok("8.2   Alle drei zusammen ergeben dasselbe", () =>
    RcShamir.Combine(shares).SequenceEqual(shamirSecret));

// Der Kern des Verfahrens: zu wenige Anteile ergeben etwas — aber das Falsche.
// Genau weil sie nichts verraten, sieht das Falsche aus wie das Richtige.
t.Ok("8.2   Ein Anteil allein verraet das Geheimnis nicht", () =>
{
    // Mit einem Anteil und einem erfundenen zweiten kommt Beliebiges heraus.
    var invented = new RcShamir.Share(99, RcCrypto.NewSymmetricKey());
    return !RcShamir.Combine([shares[0], invented]).SequenceEqual(shamirSecret);
});

t.Ok("8.2   Ein Anteil traegt das Geheimnis nicht im Klartext", () =>
    shares.All(s => !s.Y.SequenceEqual(shamirSecret)));

// 8.2 — Ein Schwellwert von 1 waere eine Kopie, keine Teilung. Auch die
// Datenbank besteht darauf (ck_rc_recovery_share_threshold).
t.Ok("8.2   Schwellwert 1 wird abgelehnt", () =>
{
    try { RcShamir.Split(shamirSecret, 3, 1); return false; }
    catch (ArgumentOutOfRangeException) { return true; }
});

t.Ok("8.2   Mehr Anteile zum Oeffnen als vorhanden wird abgelehnt", () =>
{
    try { RcShamir.Split(shamirSecret, 2, 3); return false; }
    catch (ArgumentOutOfRangeException) { return true; }
});

t.Ok("8.2   Zwei Anteile von derselben Stelle werden abgelehnt", () =>
{
    try { RcShamir.Combine([shares[0], shares[0]]); return false; }
    catch (ArgumentException) { return true; }
});

t.Ok("8.2   Auch ein hoher Schwellwert traegt", () =>
{
    var many = RcShamir.Split(shamirSecret, total: 7, threshold: 5);
    return RcShamir.Combine(many.Skip(2).Take(5).ToList()).SequenceEqual(shamirSecret)
        && !RcShamir.Combine(many.Take(4).ToList()).SequenceEqual(shamirSecret);
});

// Jede Teilung ist neu gewuerfelt: dieselben Anteile duerfen nie zweimal
// entstehen, sonst verriete ein Vergleich zweier Teilungen etwas.
t.Ok("8.2   Zwei Teilungen desselben Geheimnisses sind verschieden", () =>
    !RcShamir.Split(shamirSecret, 3, 2)[0].Y.SequenceEqual(shares[0].Y));

// TV-12 — Der Vektor, der Browser und Server aneinander bindet.
//
// Konscious hier, hash-wasm dort. Zwei Umsetzungen desselben Verfahrens, und
// wenn sie um ein Bit auseinanderlaufen, kann sich NIEMAND mehr anmelden —
// aber erst nach der Auslieferung, und ohne dass ein Fehler sichtbar wird.
// Deshalb steht derselbe Vektor auch in rcSelfTest.ts.
var tv12Key = RcPassword.DerivePasswordKey(
    "correct horse battery staple",
    RcCrypto.FromHex("726372656174696f2d74762d31322d21"));

t.Eq("TV-12 Argon2id 64 MiB, t=3, p=1, 32 Byte",
    RcCrypto.ToHex(tv12Key),
    "8d653504132471c8cf62ff8f2baeb64467b075d3de7badd53e55620f4edc6d4f");

t.Note($"3.15  Argon2id 64 MiB t=3: Browser-Anteil {swPw.ElapsedMilliseconds} ms, " +
       $"Server-Anteil {swVerifier.ElapsedMilliseconds} ms " +
       $"(woertliche Fassung des 21.8 kostete beide im Browser)");


// ---------------------------------------------------------------------------
// 21.4 — Der gemeinsame Testvektor fuer das Verpacken.
//
// RSA-OAEP ist zufaellig: zwei Verpackungen desselben Schluessels sehen
// verschieden aus, Geheimtexte lassen sich also nicht vergleichen. Was sich
// vergleichen laesst, ist alles DAVOR — die Schluesselkennung und das Label —,
// und genau dort saesse ein Formatfehler.
//
// Er faellt nicht beim Schreiben auf. Er faellt Wochen spaeter auf, wenn jemand
// eine Anmeldeliste oeffnen will und sie nicht aufgeht. Deshalb rechnen beide
// Seiten dieselben Bytes nach, aus DERSELBEN Datei: zwei Kopien waeren genau
// der Verzug, den der Vektor verhindern soll.
// ---------------------------------------------------------------------------

{
    var vectorPath = Path.Combine(AppContext.BaseDirectory, "rc-wrap-vector.json");

    if (!File.Exists(vectorPath))
    {
        t.Ok("21.4  Der gemeinsame Verpackungsvektor liegt bereit", () => false);
    }
    else
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(vectorPath));
        var v = doc.RootElement;

        var spki = Convert.FromBase64String(v.GetProperty("spkiBase64").GetString()!);
        var pkcs8 = Convert.FromBase64String(v.GetProperty("pkcs8Base64").GetString()!);
        var aadText = v.GetProperty("aadText").GetString()!;

        // Der Vektor nennt die AAD als fertige Zeichenkette; hier wird sie aus
        // ihren Teilen gebaut. Stimmen beide ueberein, ist auch die
        // Zusammensetzung geprueft und nicht nur der Hash darueber.
        var parts = aadText.Split(':');
        var wrapAad = RcAad.Create(parts[0], parts[1], Guid.Parse(parts[2]),
            RcField.EventAnswer, int.Parse(parts[4]));

        t.Ok("3.13  Die AAD des Vektors setzt sich genauso zusammen", () =>
            wrapAad.ToString() == aadText);

        var keyId = RcCrypto.KeyIdFromPublicKey(spki);
        t.Ok("21.3  Die Schluesselkennung stimmt mit dem Vektor ueberein", () =>
            Convert.ToHexString(keyId).ToLowerInvariant() == v.GetProperty("keyIdHex").GetString());

        var header = RcCrypto.BuildHeader(RcAlg.RsaOaep4096, keyId);
        t.Ok("21.3  Der Kopf stimmt mit dem Vektor ueberein", () =>
            Convert.ToHexString(header).ToLowerInvariant() == v.GetProperty("headerHex").GetString());

        // Das Label ist der Teil, den OAEP nicht selbst traegt (Befund 34) und
        // den beide Seiten deshalb gleich bilden muessen.
        var full = new byte[header.Length + Encoding.UTF8.GetByteCount(aadText)];
        header.CopyTo(full, 0);
        Encoding.UTF8.GetBytes(aadText, full.AsSpan(header.Length));
        var label = SHA256.HashData(full);

        t.Ok("21.4  Das Label stimmt mit dem Vektor ueberein", () =>
            Convert.ToHexString(label).ToLowerInvariant() == v.GetProperty("labelHex").GetString());

        // Und der Rundlauf: verpacken, auspacken, derselbe Schluessel.
        using var rsa = RSA.Create();
        rsa.ImportPkcs8PrivateKey(pkcs8, out _);

        var secret = RcCrypto.NewSymmetricKey();
        var wrapped = RcCrypto.WrapKey(rsa, wrapAad, secret);

        t.Ok("21.4  Verpacken und Auspacken ergibt denselben Schluessel", () =>
            RcCrypto.UnwrapKey(rsa, wrapAad, wrapped).SequenceEqual(secret));

        t.Ok("21.3  Die Verpackung traegt den erwarteten Kopf", () =>
            wrapped.Take(20).SequenceEqual(header));

        // 3.13 — Eine Huelle klebt an ihrem Platz. Unter einer anderen AAD darf
        // sie sich nicht oeffnen lassen, sonst waere der ganze Aufwand umsonst.
        var elsewhere = RcAad.Create("events", "registration",
            Guid.Parse("0190a1b2-0000-7000-8000-000000000002"), RcField.EventAnswer, 1);

        t.Throws("3.13  Unter fremder AAD geht die Verpackung nicht auf", RcDecryptError.AadMismatch, () =>
            RcCrypto.UnwrapKey(rsa, elsewhere, wrapped));
        // DER eigentliche Beweis: eine Huelle, die der BROWSER-Code erzeugt
        // hat, wird hier ausgepackt. Kopf und Label auf beiden Seiten gleich
        // zu rechnen ist ein starkes Indiz — aber die Anordnung im
        // OAEP-Klartext koennte trotzdem abweichen, und das faellt sonst erst
        // auf, wenn eine echte Anmeldung nicht mehr aufgeht.
        //
        // Erzeugt wird sie mit "npm run rc:vector". Aendert eine Seite das
        // Format, schlaegt DIESE Pruefung fehl und nicht erst der Betrieb.
        if (v.TryGetProperty("wrappedByBrowserBase64", out var browserBlob))
        {
            var expected = Convert.FromHexString(v.GetProperty("secretHex").GetString()!);
            var fromBrowser = Convert.FromBase64String(browserBlob.GetString()!);

            t.Ok("21.4  Was der Browser verpackt hat, packt der Kernel aus", () =>
                RcCrypto.UnwrapKey(rsa, wrapAad, fromBrowser).SequenceEqual(expected));

            t.Ok("21.3  Die Huelle des Browsers ist 532 Byte lang", () =>
                fromBrowser.Length == 532);
        }
        else
        {
            t.Ok("21.4  Die Huelle des Browsers liegt im Vektor bereit", () => false);
        }
    }
}


// ---------------------------------------------------------------------------
// Wiederholungen
//
// Der Teil des Kalenders, an dem sich am leichtesten irren laesst — und bei dem
// ein Irrtum nicht auffaellt: ein Termin, der einmal im Jahr auf dem falschen
// Tag steht, sieht aus wie ein Tippfehler des Menschen, der ihn eingetragen
// hat. Deshalb wird hier gegen von Hand nachgerechnete Faelle geprueft.
// ---------------------------------------------------------------------------

// Warschau, weil dort Sommerzeit gilt und die Plattform dort steht.
var warsaw = TimeZoneInfo.FindSystemTimeZoneById(
    OperatingSystem.IsWindows() ? "Central European Standard Time" : "Europe/Warsaw");

static DateTimeOffset At(int y, int m, int d, int h, int min = 0) =>
    new(new DateTime(y, m, d, h, min, 0, DateTimeKind.Utc));

var window = (From: At(2026, 1, 1, 0), To: At(2027, 1, 1, 0));

// -- Ein einzelner Termin ist eine Reihe mit einem Glied ---------------------

t.Ok("kal   Ohne Wiederholung gibt es genau ein Vorkommen", () =>
    RcRecurrence.Expand(At(2026, 3, 10, 9), At(2026, 3, 10, 10),
        new RcRecurrence.Rule(RcRecurrence.None, 1, null, null, null),
        warsaw, window.From, window.To).Count == 1);

t.Ok("kal   Ausserhalb des Fensters kommt nichts", () =>
    RcRecurrence.Expand(At(2030, 3, 10, 9), At(2030, 3, 10, 10),
        new RcRecurrence.Rule(RcRecurrence.None, 1, null, null, null),
        warsaw, window.From, window.To).Count == 0);

// Ein Termin, der ins Fenster HINEINRAGT, gehoert hinein — auch wenn er davor
// beginnt. Sonst verschwaende eine Woche Urlaub aus der Wochenansicht, sobald
// man die zweite Woche ansieht.
t.Ok("kal   Was ins Fenster hineinragt, gehoert hinein", () =>
    RcRecurrence.Expand(At(2025, 12, 30, 9), At(2026, 1, 3, 10),
        new RcRecurrence.Rule(RcRecurrence.None, 1, null, null, null),
        warsaw, window.From, window.To).Count == 1);

// -- Taeglich -----------------------------------------------------------------

t.Ok("kal   Taeglich, zehnmal", () =>
    RcRecurrence.Expand(At(2026, 3, 2, 9), At(2026, 3, 2, 10),
        new RcRecurrence.Rule(RcRecurrence.Daily, 1, null, null, 10),
        warsaw, window.From, window.To).Count == 10);

t.Ok("kal   Jeden dritten Tag, fuenfmal, mit den richtigen Abstaenden", () =>
{
    var list = RcRecurrence.Expand(At(2026, 3, 2, 9), At(2026, 3, 2, 10),
        new RcRecurrence.Rule(RcRecurrence.Daily, 3, null, null, 5),
        warsaw, window.From, window.To);

    return list.Count == 5
        && list[1].Start - list[0].Start == TimeSpan.FromDays(3)
        && list[4].Start - list[0].Start == TimeSpan.FromDays(12);
});

// Der Rhythmus haengt am ANFANG der Reihe, nicht am angesehenen Fenster.
// Sonst laege "jeden dritten Tag" je nach Monat woanders.
t.Ok("kal   Der Rhythmus haengt am Anfang, nicht am Fenster", () =>
{
    var start = At(2026, 1, 1, 9);
    var rule = new RcRecurrence.Rule(RcRecurrence.Daily, 3, null, At(2026, 12, 31, 0), null);

    var march = RcRecurrence.Expand(start, start.AddHours(1), rule, warsaw,
        At(2026, 3, 1, 0), At(2026, 4, 1, 0));

    // 1. Januar + 3n. Der erste Maerz-Termin muss auf einem solchen Tag liegen.
    return march.Count > 0
        && (march[0].Start.UtcDateTime.Date - new DateTime(2026, 1, 1)).Days % 3 == 0;
});

// -- Woechentlich --------------------------------------------------------------

t.Ok("kal   Woechentlich an einem Tag", () =>
{
    // 2. Maerz 2026 ist ein Montag.
    var list = RcRecurrence.Expand(At(2026, 3, 2, 9), At(2026, 3, 2, 10),
        new RcRecurrence.Rule(RcRecurrence.Weekly, 1,
            RcRecurrence.WeekdayBit(DayOfWeek.Monday), null, 4),
        warsaw, window.From, window.To);

    return list.Count == 4
        && list.All(o => TimeZoneInfo.ConvertTime(o.Start, warsaw).DayOfWeek == DayOfWeek.Monday)
        && list[1].Start - list[0].Start == TimeSpan.FromDays(7);
});

// DER Fall, an dem eine naive Umsetzung scheitert: mehrere Wochentage in
// derselben Woche. Wer den Schritt in WOCHEN zaehlt, bekommt nur einen davon.
t.Ok("kal   Woechentlich an zwei Tagen gibt beide", () =>
{
    var mask = (byte)(RcRecurrence.WeekdayBit(DayOfWeek.Monday)
                    | RcRecurrence.WeekdayBit(DayOfWeek.Wednesday));

    var list = RcRecurrence.Expand(At(2026, 3, 2, 9), At(2026, 3, 2, 10),
        new RcRecurrence.Rule(RcRecurrence.Weekly, 1, mask, null, 6),
        warsaw, window.From, window.To);

    var days = list.Select(o => TimeZoneInfo.ConvertTime(o.Start, warsaw).DayOfWeek).ToList();

    return list.Count == 6
        && days.Count(d => d == DayOfWeek.Monday) == 3
        && days.Count(d => d == DayOfWeek.Wednesday) == 3;
});

// Und der zweite Fall: alle zwei Wochen an zwei Tagen. Das sind zwei Termine,
// dann zwoelf Tage Pause — nicht zwei Termine alle vier Wochen.
t.Ok("kal   Alle zwei Wochen an zwei Tagen laesst eine Woche aus", () =>
{
    var mask = (byte)(RcRecurrence.WeekdayBit(DayOfWeek.Monday)
                    | RcRecurrence.WeekdayBit(DayOfWeek.Wednesday));

    var list = RcRecurrence.Expand(At(2026, 3, 2, 9), At(2026, 3, 2, 10),
        new RcRecurrence.Rule(RcRecurrence.Weekly, 2, mask, null, 4),
        warsaw, window.From, window.To);

    if (list.Count != 4) return false;

    // Mo, Mi, dann zwoelf Tage bis zum naechsten Mo.
    return list[1].Start - list[0].Start == TimeSpan.FromDays(2)
        && list[2].Start - list[1].Start == TimeSpan.FromDays(12);
});

// Eine Reihe, die mittwochs beginnt, faengt nicht am Montag davor an.
t.Ok("kal   Vor dem Anfang liegt nichts", () =>
{
    var mask = (byte)(RcRecurrence.WeekdayBit(DayOfWeek.Monday)
                    | RcRecurrence.WeekdayBit(DayOfWeek.Wednesday));

    // 4. Maerz 2026 ist ein Mittwoch.
    var list = RcRecurrence.Expand(At(2026, 3, 4, 9), At(2026, 3, 4, 10),
        new RcRecurrence.Rule(RcRecurrence.Weekly, 1, mask, null, 3),
        warsaw, window.From, window.To);

    return list.Count == 3 && list[0].Start == At(2026, 3, 4, 9);
});

// -- Monatlich und jaehrlich ---------------------------------------------------

t.Ok("kal   Monatlich, drei Monate", () =>
{
    var list = RcRecurrence.Expand(At(2026, 1, 15, 9), At(2026, 1, 15, 10),
        new RcRecurrence.Rule(RcRecurrence.Monthly, 1, null, null, 3),
        warsaw, window.From, window.To);

    return list.Count == 3
        && TimeZoneInfo.ConvertTime(list[2].Start, warsaw).Month == 3;
});

// Der 31. gibt es im Februar nicht. Ihn ausfallen zu lassen ueberrascht mehr,
// als ihn auf den letzten Tag zu ziehen.
t.Ok("kal   Der 31. wird im Februar zum letzten Tag", () =>
{
    var list = RcRecurrence.Expand(At(2026, 1, 31, 9), At(2026, 1, 31, 10),
        new RcRecurrence.Rule(RcRecurrence.Monthly, 1, null, null, 2),
        warsaw, window.From, window.To);

    return list.Count == 2
        && TimeZoneInfo.ConvertTime(list[1].Start, warsaw).Day == 28;
});

// -- Sommerzeit -----------------------------------------------------------------
//
// DER Fall, an dem sich Kalender blamieren. In Warschau wird 2026 am 29. Maerz
// vorgestellt. "Jeden Montag um 9" muss danach um 9 bleiben — in oertlicher
// Zeit, nicht in UTC.

t.Ok("kal   Ueber die Zeitumstellung bleibt es dieselbe Uhrzeit", () =>
{
    var list = RcRecurrence.Expand(At(2026, 3, 23, 8), At(2026, 3, 23, 9),
        new RcRecurrence.Rule(RcRecurrence.Weekly, 1,
            RcRecurrence.WeekdayBit(DayOfWeek.Monday), null, 3),
        warsaw, At(2026, 3, 1, 0), At(2026, 5, 1, 0));

    // 23.3. (Winterzeit), 30.3. und 6.4. (Sommerzeit) — alle oertlich 9 Uhr.
    var hours = list.Select(o => TimeZoneInfo.ConvertTime(o.Start, warsaw).Hour).Distinct().ToList();
    return list.Count == 3 && hours.Count == 1 && hours[0] == 9;
});

// Und die Stunde, die es nicht gibt: sie faellt nicht aus, sie rueckt.
//
// Der erste Anlauf dieser Pruefung traf die Luecke gar nicht: sie setzte den
// Anfang auf 01:30 UTC, und das sind in Warschau 03:30 oertlich — hinter der
// Luecke. Die Pruefung war gruen und pruefte nichts. Eine solche ist
// schlimmer als keine, weil sie Zuversicht erzeugt.
//
// Es gibt KEINEN UTC-Zeitpunkt, der auf 02:30 oertlich faellt — die Zeit
// existiert nicht. Erreichen laesst sie sich nur ueber eine Reihe: am 28.
// um 02:30 oertlich beginnen, taeglich weiter, und der 29. landet in der
// Luecke.
t.Ok("kal   Ein Termin in der uebersprungenen Stunde rueckt, statt auszufallen", () =>
{
    // 28.3.2026 02:30 oertlich = 01:30 UTC (noch Winterzeit).
    var list = RcRecurrence.Expand(At(2026, 3, 28, 1, 30), At(2026, 3, 28, 2, 30),
        new RcRecurrence.Rule(RcRecurrence.Daily, 1, null, null, 2),
        warsaw, At(2026, 3, 1, 0), At(2026, 4, 1, 0));

    if (list.Count != 2) return false;

    // Der zweite faellt auf den 29. um 02:30 oertlich — die gibt es nicht.
    // Er rueckt hinter die Luecke, also auf 03:00, und faellt nicht aus.
    var second = TimeZoneInfo.ConvertTime(list[1].Start, warsaw);
    return second.Day == 29 && second.Hour == 3 && second.Minute == 0;
});

// Und die Stunde, die es zweimal gibt: genommen wird die erste. Die Regel
// muss festliegen, sonst kommt bei zwei Aufrufen zweimal etwas anderes heraus.
t.Ok("kal   In der doppelten Stunde wird die erste genommen", () =>
{
    // Rueckstellung 2026 in Warschau: 25. Oktober. 02:30 oertlich gibt es
    // zweimal — einmal als Sommer-, einmal als Winterzeit.
    var list = RcRecurrence.Expand(At(2026, 10, 24, 0, 30), At(2026, 10, 24, 1, 30),
        new RcRecurrence.Rule(RcRecurrence.Daily, 1, null, null, 2),
        warsaw, At(2026, 10, 1, 0), At(2026, 11, 1, 0));

    if (list.Count != 2) return false;

    // 02:30 als Sommerzeit ist 00:30 UTC; als Winterzeit 01:30 UTC.
    // Genommen wird die erste, also 00:30 UTC.
    return list[1].Start == At(2026, 10, 25, 0, 30);
});

// -- Ausnahmen -------------------------------------------------------------------

t.Ok("kal   Ein abgesagtes Vorkommen faellt heraus", () =>
{
    var second = At(2026, 3, 9, 9);
    var list = RcRecurrence.Expand(At(2026, 3, 2, 9), At(2026, 3, 2, 10),
        new RcRecurrence.Rule(RcRecurrence.Weekly, 1,
            RcRecurrence.WeekdayBit(DayOfWeek.Monday), null, 3),
        warsaw, window.From, window.To,
        [new RcRecurrence.Exception(second, "cancelled", null, null)]);

    return list.Count == 2 && list.All(o => o.OriginalStart != second);
});

t.Ok("kal   Ein verschobenes Vorkommen behaelt seinen Platz in der Reihe", () =>
{
    var second = At(2026, 3, 9, 9);
    var list = RcRecurrence.Expand(At(2026, 3, 2, 9), At(2026, 3, 2, 10),
        new RcRecurrence.Rule(RcRecurrence.Weekly, 1,
            RcRecurrence.WeekdayBit(DayOfWeek.Monday), null, 3),
        warsaw, window.From, window.To,
        [new RcRecurrence.Exception(second, "moved", At(2026, 3, 10, 14), At(2026, 3, 10, 15))]);

    var moved = list.FirstOrDefault(o => o.OriginalStart == second);

    // Der urspruengliche Anfang bleibt der NAME dieses Termins — daran haengt
    // die Ausnahme. Verloere er ihn, liesse sie sich nie wieder aufheben.
    return list.Count == 3 && moved is not null
        && moved.Moved && moved.Start == At(2026, 3, 10, 14);
});

// Ein Termin, der IN das Fenster verschoben wurde, gehoert hinein — und einer,
// der hinaus verschoben wurde, nicht mehr. Geprueft wird gegen die
// TATSAECHLICHE Zeit, nicht gegen die urspruengliche.
t.Ok("kal   Das Fenster gilt fuer die tatsaechliche Zeit", () =>
{
    var first = At(2026, 3, 2, 9);
    var list = RcRecurrence.Expand(first, At(2026, 3, 2, 10),
        new RcRecurrence.Rule(RcRecurrence.Weekly, 1,
            RcRecurrence.WeekdayBit(DayOfWeek.Monday), null, 3),
        warsaw, At(2026, 3, 1, 0), At(2026, 3, 8, 0),
        [new RcRecurrence.Exception(first, "moved", At(2026, 4, 1, 9), At(2026, 4, 1, 10))]);

    // Der einzige Termin dieser Woche wurde in den April geschoben.
    return list.Count == 0;
});

// -- Grenzen ---------------------------------------------------------------------

t.Ok("kal   Eine Reihe wird nicht unbegrenzt ausgerechnet", () =>
    RcRecurrence.Expand(At(2026, 1, 1, 9), At(2026, 1, 1, 10),
        new RcRecurrence.Rule(RcRecurrence.Daily, 1, null, At(2099, 1, 1, 0), null),
        warsaw, At(2026, 1, 1, 0), At(2099, 1, 1, 0)).Count <= RcRecurrence.MaxOccurrences);

t.Ok("kal   Ein Ende per Datum wird eingehalten", () =>
    RcRecurrence.Expand(At(2026, 3, 2, 9), At(2026, 3, 2, 10),
        new RcRecurrence.Rule(RcRecurrence.Daily, 1, null, At(2026, 3, 5, 0), null),
        warsaw, window.From, window.To)
        .All(o => o.Start <= At(2026, 3, 5, 0)));


return t.Report();

// ---------------------------------------------------------------------------

sealed class Runner
{
    private int _pass, _fail;

    public void Eq(string name, string got, string want)
    {
        if (string.Equals(got, want, StringComparison.Ordinal)) Pass(name);
        else Fail(name, $"erwartet  {want}\n     gerechnet {got}");
    }

    public void Ok(string name, Func<bool> f)
    {
        bool r;
        try { r = f(); }
        catch (Exception e) { Fail(name, $"Ausnahme: {e.GetType().Name}: {e.Message}"); return; }
        if (r) Pass(name); else Fail(name, "Bedingung nicht erfuellt");
    }

    public void Throws(string name, RcDecryptError expected, Action a)
    {
        try { a(); Fail(name, "kein Fehler — haette scheitern muessen"); }
        catch (RcDecryptException e)
        {
            if (e.Error == expected) Pass(name);
            else Fail(name, $"erwartet {expected}, bekam {e.Error} ({e.Code})");
        }
        catch (Exception e) { Fail(name, $"falsche Ausnahme: {e.GetType().Name}"); }
    }

    /// <summary>
    /// Eine gemessene Zahl, kein Urteil. Zaehlt nicht als bestanden und nicht
    /// als gescheitert — sie soll nur beim Durchlauf sichtbar sein.
    /// </summary>
    public void Note(string text) => Console.WriteLine($"  ..   {text}");

    private void Pass(string n) { _pass++; Console.WriteLine($"  OK   {n}"); }
    private void Fail(string n, string d)
    {
        _fail++;
        Console.WriteLine($"  FAIL {n}");
        foreach (var line in d.Split('\n')) Console.WriteLine($"       {line}");
    }

    public int Report()
    {
        Console.WriteLine();
        Console.WriteLine($"  {_pass} bestanden, {_fail} fehlgeschlagen");
        return _fail == 0 ? 0 : 1;
    }
}
