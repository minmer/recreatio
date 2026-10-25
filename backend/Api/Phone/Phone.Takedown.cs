using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>0130 — was der Betreiber nach einer Meldung an einer Datei hinter einem Link endgültig tut.</summary>
public static partial class Phone
{
    /// <summary>Die Datei ist fort, der Link sagt danach „nie ma" — wie beim Zurückziehen, nur ohne Recht im Bereich.</summary>
    internal static async Task RemoveShareAsync(IConfiguration config, SqlConnection connection, SqlTransaction tx, Guid id, CancellationToken ct)
    {
        Guid? area;
        await using (var cmd = new SqlCommand("SELECT area_id FROM app.phone_share WHERE id = @id;", connection, tx))
        {
            cmd.Parameters.AddWithValue("@id", id);
            area = await cmd.ExecuteScalarAsync(ct) as Guid?;
        }
        if (area is null) return;
        await using (var cmd = new SqlCommand("UPDATE app.phone_share SET deleted_at = SYSDATETIMEOFFSET() WHERE id = @id AND deleted_at IS NULL;", connection, tx))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        DropShareFile(config, area.Value, id);
    }
}
