using System.Security.Cryptography;
using System.Text;
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
