using System.Security.Cryptography;
using Api;
using Kernel;

/// <summary>0120 — die Rollen eines Formulars, und die Regel eines virtuellen Bereichs für seine Kleinbereiche.</summary>
internal static class VirtualAreaChecks
{
    public static void Run(Action<bool, string> check)
    {
        var a = Guid.Parse("01a15629-8c30-764d-88ad-8cfee5e4f6d9");
        var b = Guid.Parse("01a15629-8c30-764d-88ad-8cfee5e4f6da");

        /* Die Liste der Rollen, wie SQL sie baut (gross, mit Komma dahinter) — oder die eine von 0091. */
        check(Module.MemberRoleList(null, null).Count == 0, "no list and no role: none");
        check(Module.MemberRoleList(null, a).SequenceEqual([Ids.ToText(a)]), "no list (before 0120): the single role of 0091");
        check(Module.MemberRoleList($"{a.ToString().ToUpperInvariant()},{b.ToString().ToUpperInvariant()},", a)
            .SequenceEqual([Ids.ToText(a), Ids.ToText(b)]), "the server's list: in order, written as ids");
        check(Module.MemberRoleList($"{a},{a}, nonsense ,", null).SequenceEqual([Ids.ToText(a)]), "duplicates and noise drop out");
        check(Form.SubmitterLevels.SequenceEqual(["none", "read", "write"]), "the person: none, read or write — as the table allows");

        /* Ein Zertifikat für einen Kleinbereich: nur nach der Regel, nur vom Aussteller, nur für diesen Bereich. */
        using var issuerKey = RSA.Create(2048);
        using var strangerKey = RSA.Create(2048);
        var spki = issuerKey.ExportSubjectPublicKeyInfo();
        var issuer = Guid.NewGuid();
        var subject = Guid.NewGuid();
        var instance = Guid.NewGuid();
        var now = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        var rules = new List<(Guid Role, Capability Capability)> { (subject, Capability.Write) };

        Form.InstanceProof Proof(Capability capability, Guid scope, DateTimeOffset issued, DateTimeOffset expires, RSA? by = null)
        {
            var id = Guid.NewGuid();
            var record = new CertificateRecord
            {
                Id = id, SubjectRoleId = subject, ScopeKind = ScopeKind.Area, ScopeId = scope, Capability = capability,
                IssuedByRoleId = issuer, IssuedUtc = issued, ExpiresUtc = expires
            };
            return new Form.InstanceProof(Ids.ToText(subject), Ids.ToText(id), Capabilities.ToText(capability),
                issued.ToUnixTimeSeconds(), expires.ToUnixTimeSeconds(), Base64Url.Encode(record.Sign(by ?? issuerKey)));
        }

        var good = Form.CheckInstanceProof(Proof(Capability.Write, instance, now, now.AddDays(365)), instance, issuer, spki, rules, now);
        check(good.Record is not null && good.Record.ScopeId == instance && good.Record.SubjectRoleId == subject,
            "a certificate after the rule, signed by the issuer, for this mini area passes");
        check(Form.CheckInstanceProof(Proof(Capability.Admin, instance, now, now.AddDays(365)), instance, issuer, spki, rules, now).Record is null,
            "a level the rule does not give is refused");
        check(Form.CheckInstanceProof(Proof(Capability.Write, Guid.NewGuid(), now, now.AddDays(365)), instance, issuer, spki, rules, now).Record is null,
            "signed for another area: the signature does not hold for this one");
        check(Form.CheckInstanceProof(Proof(Capability.Write, instance, now, now.AddDays(365), strangerKey), instance, issuer, spki, rules, now).Record is null,
            "signed by someone else: refused");
        check(Form.CheckInstanceProof(Proof(Capability.Write, instance, now.AddHours(-2), now.AddDays(365)), instance, issuer, spki, rules, now).Record is null,
            "an old signing time: refused");
        check(Form.CheckInstanceProof(Proof(Capability.Write, instance, now, now.AddYears(6)), instance, issuer, spki, rules, now).Record is null,
            "longer than five years: refused");
        check(Form.CheckInstanceProof(null, instance, issuer, spki, rules, now).Error is not null, "no certificate: an error, not a crash");
    }
}
