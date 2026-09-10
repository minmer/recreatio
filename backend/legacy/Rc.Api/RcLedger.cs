using System.Security.Cryptography;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Kapitel 7 — Die Kette. Anfuegen und Nachpruefen.
///
/// <b>Was die Kette beweist und was nicht.</b> Sie beweist <i>Reihenfolge</i>
/// und <i>Urheberschaft</i>. Den <i>Zeitpunkt</i> beweist sie NICHT: der
/// Zeitstempel stammt vom Server und ist zunaechst eine Behauptung des
/// Betreibers (7.1, E-265). Erst der oeffentliche Kopfabruf gegenueber
/// unabhaengigen Mitschreibern macht daraus eine Aussage ueber die Zeit — wer
/// den Kopf am Dienstag notiert hat, kann bezeugen, dass alles davor schon da
/// war. Deshalb ist <c>/rc/ledgers/{id}/head</c> ohne Konto erreichbar.
///
/// <b>Warum eine Gabelung strukturell unmoeglich ist.</b>
///
/// <code>
///   … ← E7 ← E8 ← E9          gut: jeder Eintrag zeigt auf genau einen
///
///            ┌── E9a          Gabelung: E9a und E9b zeigen BEIDE auf E8.
///   … ← E7 ← E8               Zwei Wahrheiten, und keine davon widerlegbar.
///            └── E9b
/// </code>
///
/// Der Audit-Befund P0-5 war genau das. Hier verhindert es nicht der Code,
/// sondern die Datenbank:
///
/// <code>
///   CONSTRAINT uq_rc_ledger_entry_prev UNIQUE (ledger_id, previous_hash)
/// </code>
///
/// Ein zweiter Eintrag mit demselben Vorgaengerhash wird abgewiesen — auch
/// dann, wenn die Sperre versagt, wenn zwei Prozesse laufen, wenn jemand am
/// Code vorbei schreibt. <b>Eine Regel, die nur der Code kennt, ist eine
/// Absichtserklaerung; eine, die das Schema kennt, ist eine Regel.</b>
/// </summary>
public sealed class RcLedger(RcDb db, RcServerSecret secret)
{
    /// <summary>Was der Kernel als Kettenanfang erkennt (22.6): 32 Nullen.</summary>
    public static readonly byte[] Genesis = RcLedgerEntry.GenesisPreviousHash;

    /// <summary>
    /// Einen Eintrag anfuegen. Laeuft IMMER in der Transaktion des Aufrufers:
    /// der Eintrag und das, was er bezeugt, muessen zusammen gelingen oder
    /// zusammen scheitern. Ein Ketteneintrag ueber eine Entscheidung, die es
    /// nicht gibt, waere schlimmer als kein Eintrag.
    /// </summary>
    public async Task<RcLedgerEntry> AppendAsync(
        SqlConnection connection, SqlTransaction tx,
        Guid ledgerId, RcJson payload, Guid subjectId, Guid tenantId, string moduleId,
        RcRoleIdentity signer, RSA signKey, Guid accountId, Guid transactionId,
        CancellationToken ct = default)
    {
        // Kopf unter Sperre lesen. UPDLOCK/HOLDLOCK haelt bis zum Ende der
        // Transaktion; ohne beides koennten zwei Anfuegungen denselben Kopf
        // sehen. Die Eindeutigkeitsbedingung faengt das zwar ohnehin ab — aber
        // als Fehler, und ein vermeidbarer Fehler ist kein Entwurf.
        long lastSequence = 0;
        var lastHash = Genesis;
        var headExists = false;

        await using (var head = new SqlCommand(
            "SELECT last_sequence, last_hash FROM dbo.rc_ledger_head WITH (UPDLOCK, HOLDLOCK) WHERE ledger_id = @id;",
            connection, tx))
        {
            head.Parameters.AddWithValue("@id", ledgerId);
            await using var reader = await head.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                lastSequence = reader.GetInt64(0);
                lastHash = (byte[])reader[1];
                headExists = true;
            }
        }

        var entryId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        var entry = new RcLedgerEntry
        {
            LedgerId = ledgerId,
            Sequence = lastSequence + 1,
            PreviousHash = lastHash,
            EntryId = entryId,
            Payload = payload,
            SubjectId = subjectId,
            TenantId = tenantId,
            ModuleId = moduleId,
            SignerKeyFingerprint = signer.Fingerprint,
            KeyVersion = signer.KeyVersion,
            TransactionId = transactionId,
            AccountCommitment = CommitAccount(accountId, entryId),
            Timestamp = now
        };

        var canonical = entry.CanonicalBytes();
        var entryHash = entry.EntryHash();
        var signature = RcLedgerEntry.Sign(signKey, entryHash);

        await using (var insert = new SqlCommand("""
            INSERT INTO dbo.rc_ledger_entry
                (id, ledger_id, sequence_no, previous_hash, entry_hash, payload_canonical,
                 subject_id, tenant_id, module_id, signer_key_fp, key_version, transaction_id,
                 account_commitment, signature, server_timestamp)
            VALUES
                (@id, @ledger, @seq, @prev, @hash, @canonical,
                 @subject, @tenant, @module, @fp, @keyVersion, @transaction,
                 @commitment, @sig, @now);
            """, connection, tx))
        {
            insert.Parameters.AddWithValue("@id", entryId);
            insert.Parameters.AddWithValue("@ledger", ledgerId);
            insert.Parameters.AddWithValue("@seq", entry.Sequence);
            insert.Parameters.AddWithValue("@prev", entry.PreviousHash);
            insert.Parameters.AddWithValue("@hash", entryHash);

            // 24.3 — Die kanonischen Bytes werden GESPEICHERT, nicht spaeter neu
            // berechnet. Ein Pruefer soll genau die Bytes bekommen, ueber die
            // unterschrieben wurde, und nicht das Ergebnis eines zweiten
            // Serialisierungslaufs, der abweichen koennte.
            insert.Parameters.AddWithValue("@canonical", canonical);

            insert.Parameters.AddWithValue("@subject", subjectId);
            insert.Parameters.AddWithValue("@tenant", tenantId);
            insert.Parameters.AddWithValue("@module", moduleId);
            insert.Parameters.AddWithValue("@fp", signer.Fingerprint);
            insert.Parameters.AddWithValue("@keyVersion", signer.KeyVersion);
            insert.Parameters.AddWithValue("@transaction", transactionId);
            insert.Parameters.AddWithValue("@commitment", entry.AccountCommitment);
            insert.Parameters.AddWithValue("@sig", signature);
            insert.Parameters.AddWithValue("@now", now);

            try
            {
                await insert.ExecuteNonQueryAsync(ct);
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                // uq_rc_ledger_entry_prev oder uq_rc_ledger_entry_seq. Jemand
                // war schneller. Kein Datenschaden — die Bedingung hat genau
                // das getan, wofuer sie da ist.
                throw new RcChainConflictException(ledgerId, entry.Sequence);
            }
        }

        var sql = headExists
            ? "UPDATE dbo.rc_ledger_head SET last_sequence = @seq, last_hash = @hash, updated_at = @now " +
              "WHERE ledger_id = @ledger AND last_sequence = @previousSeq;"
            : "INSERT INTO dbo.rc_ledger_head (ledger_id, last_sequence, last_hash, updated_at) " +
              "VALUES (@ledger, @seq, @hash, @now);";

        await using (var updateHead = new SqlCommand(sql, connection, tx))
        {
            updateHead.Parameters.AddWithValue("@ledger", ledgerId);
            updateHead.Parameters.AddWithValue("@seq", entry.Sequence);
            updateHead.Parameters.AddWithValue("@hash", entryHash);
            updateHead.Parameters.AddWithValue("@now", now);
            if (headExists) updateHead.Parameters.AddWithValue("@previousSeq", lastSequence);

            if (await updateHead.ExecuteNonQueryAsync(ct) != 1)
                throw new RcChainConflictException(ledgerId, entry.Sequence);
        }

        // 11.x — Der Postausgang. Der Eintrag und seine Absicht, ihn nach
        // aussen zu melden, entstehen in DERSELBEN Transaktion; das Versenden
        // laeuft spaeter und darf scheitern, ohne die Kette zu beschaedigen.
        await using (var outbox = new SqlCommand("""
            INSERT INTO dbo.rc_ledger_outbox (id, ledger_entry_id, idempotency_key)
            VALUES (@id, @entry, @key);
            """, connection, tx))
        {
            outbox.Parameters.AddWithValue("@id", RcId.NewId());
            outbox.Parameters.AddWithValue("@entry", entryId);

            // Der Schluessel ist die Kettenstelle selbst. Zweimal dieselbe
            // Stelle kann es nicht geben, also auch keine doppelte Meldung.
            outbox.Parameters.AddWithValue("@key", $"{RcId.ToText(ledgerId)}:{entry.Sequence}");
            await outbox.ExecuteNonQueryAsync(ct);
        }

        return entry;
    }

    // -- Nachpruefen ----------------------------------------------------------

    public sealed record VerifyReport(
        string LedgerId, long Entries, bool Intact,
        long? FirstBrokenSequence, string? Reason,
        long HeadSequence, string HeadHash);

    /// <summary>
    /// Die Kette wirklich nachrechnen — Glied fuer Glied.
    ///
    /// Vier Dinge werden geprueft, und die Reihenfolge ist die des Zweifels:
    ///
    ///   1. Zeigt jeder Eintrag auf den Hash seines Vorgaengers?
    ///   2. Stimmt der gespeicherte Hash mit den gespeicherten Bytes ueberein?
    ///   3. Traegt jeder Eintrag eine gueltige Unterschrift der genannten Rolle?
    ///   4. Steht am Ende der Kopf, den die Kopftabelle behauptet?
    ///
    /// <b>Punkt 3 ist der teure und der wichtigste.</b> RSA-PSS je Eintrag —
    /// deshalb laeuft diese Pruefung NICHT bei jeder Anzeige, sondern nur auf
    /// Verlangen. Wer beides verwechselt, baut entweder eine unbenutzbar
    /// langsame Anwendung oder eine Kette, die nie jemand nachrechnet.
    /// </summary>
    public async Task<VerifyReport> VerifyAsync(Guid ledgerId, CancellationToken ct = default)
    {
        await using var connection = await db.OpenAsync(ct);

        var publicKeys = new Dictionary<string, byte[]>(StringComparer.Ordinal);
        await using (var keys = new SqlCommand(
            "SELECT key_fingerprint, sign_public_key FROM dbo.rc_role;", connection))
        {
            await using var reader = await keys.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                publicKeys[RcCrypto.ToHex((byte[])reader[0])] = (byte[])reader[1];
        }

        await using var cmd = new SqlCommand("""
            SELECT sequence_no, previous_hash, entry_hash, payload_canonical, signer_key_fp, signature
            FROM dbo.rc_ledger_entry
            WHERE ledger_id = @ledger
            ORDER BY sequence_no;
            """, connection);
        cmd.Parameters.AddWithValue("@ledger", ledgerId);

        var expectedPrevious = Genesis;
        long expectedSequence = 1;
        long count = 0;
        byte[] lastHash = Genesis;

        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var sequence = reader.GetInt64(0);
                var previousHash = (byte[])reader[1];
                var entryHash = (byte[])reader[2];
                var canonical = (byte[])reader[3];
                var fingerprint = RcCrypto.ToHex((byte[])reader[4]);
                var signature = (byte[])reader[5];

                if (sequence != expectedSequence)
                    return Broken(sequence, "Luecke in der Reihenfolge");

                if (!previousHash.SequenceEqual(expectedPrevious))
                    return Broken(sequence, "Vorgaengerhash passt nicht");

                if (!SHA256.HashData(canonical).SequenceEqual(entryHash))
                    return Broken(sequence, "Eintragshash passt nicht zu den gespeicherten Bytes");

                if (!publicKeys.TryGetValue(fingerprint, out var publicKey))
                    return Broken(sequence, "Signierschluessel unbekannt");

                using var rsa = RSA.Create();
                rsa.ImportSubjectPublicKeyInfo(publicKey, out _);
                if (!RcLedgerEntry.Verify(rsa, entryHash, signature))
                    return Broken(sequence, "Unterschrift ungueltig");

                expectedPrevious = entryHash;
                lastHash = entryHash;
                expectedSequence = sequence + 1;
                count++;
            }
        }

        var (headSequence, headHash) = await HeadAsync(connection, ledgerId, ct);

        // Der Kopf ist eine Abkuerzung fuer die Kette. Laufen sie auseinander,
        // ist die Abkuerzung falsch — und wer nur den Kopf prueft, wuerde es
        // nie merken.
        if (headSequence != count || !headHash.SequenceEqual(lastHash))
            return Broken(count, "Kopf stimmt nicht mit der Kette ueberein");

        return new VerifyReport(RcId.ToText(ledgerId), count, true, null, null,
            headSequence, RcCrypto.ToHex(headHash));

        VerifyReport Broken(long sequence, string reason) =>
            new(RcId.ToText(ledgerId), count, false, sequence, reason, count, RcCrypto.ToHex(lastHash));
    }

    public static async Task<(long Sequence, byte[] Hash)> HeadAsync(
        SqlConnection connection, Guid ledgerId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT last_sequence, last_hash FROM dbo.rc_ledger_head WHERE ledger_id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", ledgerId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct)
            ? (reader.GetInt64(0), (byte[])reader[1])
            : (0, Genesis);
    }

    /// <summary>
    /// 3.4 — Die Verpflichtung. Das Salz wird aus dem Servergeheimnis und der
    /// Eintragskennung abgeleitet, nicht gespeichert und nicht ausgeliefert.
    /// </summary>
    public byte[] CommitAccount(Guid accountId, Guid entryId)
    {
        var salt = secret.CommitmentSalt(entryId);
        try { return RcLedgerEntry.CommitAccount(accountId, salt); }
        finally { CryptographicOperations.ZeroMemory(salt); }
    }
}

/// <summary>
/// 7.6 — Zwei Anfuegungen an derselben Stelle. Kein Datenschaden: die
/// Eindeutigkeitsbedingung hat getan, wofuer sie da ist. Der Aufrufer soll es
/// noch einmal versuchen.
/// </summary>
public sealed class RcChainConflictException(Guid ledgerId, long sequence)
    : Exception($"Kette {RcId.ToText(ledgerId)} wurde an Stelle {sequence} bereits fortgeschrieben.")
{
    public Guid LedgerId { get; } = ledgerId;
    public long Sequence { get; } = sequence;
    public string Code => RcErrorCodes.ChainSequenceConflict;
}
