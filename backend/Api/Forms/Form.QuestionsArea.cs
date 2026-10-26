using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0133 — DIE FRAGEN EINES FORMULARS IN EINEM ANDEREN BEREICH.
///
/// <para>
/// Die Antworten gehen in den Bereich des Formulars (seine Annahme, sein Administrator
/// danych). Die Fragen und der Aufbau müssen dort lesbar sein, wo das Formular gezeigt
/// wird — für ein öffentliches Formular in einem Bereich mit eigenen Schlüsseln (die
/// Gruppe der Rocket Challenge) also unter dem Schlüssel des jawnen Bereichs, in dem es
/// veröffentlicht ist („Wydarzenia"). Der Browser versiegelt alles neu; hier wird es in
/// EINEM Schritt abgelegt, damit nie eine Frage unter dem alten und eine unter dem neuen
/// Schlüssel liegt.
/// </para>
///
/// <para>
/// <b>Wer beide Bereiche führt</b> (admin), darf verlegen; zurück in den eigenen Bereich
/// darf, wer das Formular pflegt.
/// </para>
/// </summary>
public static partial class Form
{
    public sealed record QuestionSeal(string? FieldId, string? LabelSealed, string? HelpSealed, string? OptionsSealed, int Epoch);
    public sealed record DesignSeal(int Epoch, string? Sealed);
    public sealed record QuestionsAreaRequest(string? AreaId, List<QuestionSeal>? Fields, DesignSeal? Design);

    private static async Task QuestionsAreaAsync(HttpContext ctx, Db db, Guid id, QuestionsAreaRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego formularza nie ma."); return; }
        id = sheet.ModuleId;
        if (sheet.AreaId is not Guid own)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Formularz nie ma własnego obszaru.");
            return;
        }
        if (!await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        Guid target = own;
        if (!string.IsNullOrWhiteSpace(body.AreaId))
        {
            if (!Guid.TryParse(body.AreaId, out target)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny obszar."); return; }
        }
        if (target != own)
        {
            var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
            if ((await Controllers.AdminRolesAsync(connection, mine, own, ctx.RequestAborted)).Count == 0
                || (await Controllers.AdminRolesAsync(connection, mine, target, ctx.RequestAborted)).Count == 0)
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Pytania w innym obszarze publikuje tylko ten, kto prowadzi oba obszary.");
                return;
            }
        }

        /* Alle Fragen des Formulars — auch die genommenen: keine darf unter dem alten Schlüssel zurückbleiben. */
        var all = new HashSet<Guid>();
        await using (var cmd = new SqlCommand("SELECT id FROM app.slug_field WHERE part_id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) all.Add(reader.GetGuid(0));
        }

        var seals = new List<(Guid Field, byte[] Label, byte[]? Help, byte[]? Options, int Epoch)>();
        foreach (var f in body.Fields ?? [])
        {
            if (!Guid.TryParse(f.FieldId, out var fieldId) || !all.Contains(fieldId) || f.Epoch < 1)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Pytanie, którego w tym formularzu nie ma.");
                return;
            }
            try
            {
                var label = Base64Url.Decode(f.LabelSealed ?? "");
                if (label.Length == 0) throw new FormatException();
                seals.Add((fieldId, label, Optional(f.HelpSealed), Optional(f.OptionsSealed), f.Epoch));
            }
            catch (FormatException)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zapieczętowane pytanie.");
                return;
            }
        }
        if (seals.Select(s => s.Field).Distinct().Count() != all.Count)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Przepieczętować trzeba wszystkie pytania formularza naraz.");
            return;
        }

        byte[]? design = null;
        var hasDesign = false;
        await using (var cmd = new SqlCommand("SELECT COUNT(*) FROM app.form_design WHERE module_id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            hasDesign = (int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted))! > 0;
        }
        if (hasDesign)
        {
            if (body.Design is null || body.Design.Epoch < 1) { await Fail(ctx, StatusCodes.Status400BadRequest, "Układ formularza też trzeba przepieczętować."); return; }
            try { design = Base64Url.Decode(body.Design.Sealed ?? ""); } catch (FormatException) { design = null; }
            if (design is null || design.Length == 0) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny zapieczętowany układ."); return; }
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        await using (var cmd = new SqlCommand("UPDATE app.module SET label_area_id = @label WHERE id = @id;", connection, tx))
        {
            cmd.Parameters.AddWithValue("@label", target == own ? DBNull.Value : target);
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        foreach (var (field, label, help, options, epoch) in seals)
        {
            await using var cmd = new SqlCommand("""
                UPDATE app.slug_field
                   SET label_sealed = @label, help_sealed = @help, options_sealed = @options, label_area_id = @area, label_epoch = @epoch
                 WHERE id = @field AND part_id = @id;
                """, connection, tx);
            cmd.Parameters.AddWithValue("@label", label);
            cmd.Parameters.AddBlob("@help", help);
            cmd.Parameters.AddBlob("@options", options);
            cmd.Parameters.AddWithValue("@area", target);
            cmd.Parameters.AddWithValue("@epoch", epoch);
            cmd.Parameters.AddWithValue("@field", field);
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        if (design is not null)
        {
            await using var cmd = new SqlCommand(
                "UPDATE app.form_design SET area_id = @area, epoch = @epoch, sealed = @sealed, updated_at = @now WHERE module_id = @id;", connection, tx);
            cmd.Parameters.AddWithValue("@area", target);
            cmd.Parameters.AddWithValue("@epoch", body.Design!.Epoch);
            cmd.Parameters.AddWithValue("@sealed", design);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await tx.CommitAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            moduleId = Ids.ToText(id),
            labelAreaId = target == own ? null : Ids.ToText(target),
            fields = seals.Count,
            design = design is not null
        });
    }
}
