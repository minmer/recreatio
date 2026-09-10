using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Pilgrimage;
using Recreatio.Api.Services;

namespace Recreatio.Api.Endpoints.Forms;

public static class FormsEndpoints
{
    private const string FormsAdminScope = "forms";
    private static readonly string[] AllowedQuestionTypes = ["text", "multiselect", "scale"];

    public static void MapFormsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/forms");

        group.MapGet("/admin/status", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var assignment = await dbContext.PortalAdminAssignments.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ScopeKey == FormsAdminScope, ct);

            string? adminDisplayName = null;
            var hasAdmin = false;
            var isCurrentUserAdmin = false;

            if (assignment is not null)
            {
                var account = await dbContext.UserAccounts.AsNoTracking()
                    .Where(x => x.Id == assignment.UserId)
                    .Select(x => new { x.LoginId, x.DisplayName })
                    .FirstOrDefaultAsync(ct);

                var isSystem = account is not null
                    && string.Equals((account.LoginId ?? string.Empty).Trim(), "system", StringComparison.OrdinalIgnoreCase);

                hasAdmin = account is not null && !isSystem;

                if (hasAdmin)
                {
                    adminDisplayName = account?.DisplayName ?? account?.LoginId;
                    if (EndpointHelpers.TryGetUserId(context, out var maybeUserId))
                    {
                        isCurrentUserAdmin = assignment.UserId == maybeUserId;
                    }
                }
            }

            return Results.Ok(new FormsAdminStatusResponse(hasAdmin, isCurrentUserAdmin, adminDisplayName));
        });

        group.MapPost("/admin/claim", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            ILedgerService ledgerService,
            CancellationToken ct) =>
        {
            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }

            var existing = await dbContext.PortalAdminAssignments
                .FirstOrDefaultAsync(x => x.ScopeKey == FormsAdminScope, ct);

            if (existing is not null)
            {
                if (existing.UserId == userId)
                {
                    return Results.Ok(new { claimed = true, alreadyOwner = true });
                }

                var existingAccount = await dbContext.UserAccounts.AsNoTracking()
                    .Where(x => x.Id == existing.UserId)
                    .Select(x => new { x.LoginId })
                    .FirstOrDefaultAsync(ct);

                var isStaleOrSystem = existingAccount is null
                    || string.Equals((existingAccount.LoginId ?? string.Empty).Trim(), "system", StringComparison.OrdinalIgnoreCase);

                if (!isStaleOrSystem)
                {
                    return Results.Conflict(new { error = "Admin already assigned." });
                }

                dbContext.PortalAdminAssignments.Remove(existing);
                await dbContext.SaveChangesAsync(ct);
            }

            var now = DateTimeOffset.UtcNow;
            dbContext.PortalAdminAssignments.Add(new PortalAdminAssignment
            {
                Id = Guid.NewGuid(),
                ScopeKey = FormsAdminScope,
                UserId = userId,
                CreatedUtc = now
            });

            try
            {
                await dbContext.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                return Results.Conflict(new { error = "Admin already assigned." });
            }

            await ledgerService.AppendBusinessAsync(
                "FormsAdminClaimed",
                userId.ToString(),
                JsonSerializer.Serialize(new { scope = FormsAdminScope, userId, createdUtc = now }),
                ct);

            return Results.Ok(new { claimed = true });
        }).RequireAuthorization();

        group.MapGet("/admin/list", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            var forms = await dbContext.Forms.AsNoTracking()
                .OrderByDescending(x => x.CreatedUtc)
                .ToListAsync(ct);

            var formIds = forms.Select(f => f.Id).ToList();

            var questionCounts = await dbContext.FormQuestions.AsNoTracking()
                .Where(q => formIds.Contains(q.FormId))
                .GroupBy(q => q.FormId)
                .Select(g => new { FormId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var responseCounts = await dbContext.FormResponses.AsNoTracking()
                .Where(r => formIds.Contains(r.FormId))
                .GroupBy(r => r.FormId)
                .Select(g => new { FormId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var qMap = questionCounts.ToDictionary(x => x.FormId, x => x.Count);
            var rMap = responseCounts.ToDictionary(x => x.FormId, x => x.Count);

            var result = forms.Select(f => new FormSummaryResponse(
                f.Id, f.Title, f.Description, f.IsPublished, f.FillToken, f.ViewToken,
                qMap.GetValueOrDefault(f.Id, 0),
                rMap.GetValueOrDefault(f.Id, 0),
                f.CreatedUtc)).ToList();

            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapPost("/admin/create", async (
            CreateFormRequest req,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            if (string.IsNullOrWhiteSpace(req.Title))
                return Results.BadRequest(new { error = "Title is required." });

            var now = DateTimeOffset.UtcNow;
            var form = new Data.Forms.Form
            {
                Id = Guid.NewGuid(),
                Title = req.Title.Trim(),
                Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
                IsPublished = false,
                FillToken = GenerateFillToken(),
                ViewToken = GenerateFillToken(),
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.Forms.Add(form);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new FormDetailResponse(
                form.Id, form.Title, form.Description, form.IsPublished, form.FillToken, form.ViewToken, [], form.CreatedUtc));
        }).RequireAuthorization();

        group.MapPost("/admin/import", async (
            ImportFormRequest req,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            if (string.IsNullOrWhiteSpace(req.Title))
                return Results.BadRequest(new { error = "Title is required." });

            if (req.Questions is { Count: > 0 })
            {
                for (var i = 0; i < req.Questions.Count; i++)
                {
                    var q = req.Questions[i];
                    if (!AllowedQuestionTypes.Contains(q.Type))
                        return Results.BadRequest(new { error = $"Invalid question type '{q.Type}'." });
                    if (string.IsNullOrWhiteSpace(q.Text))
                        return Results.BadRequest(new { error = "Question text is required." });
                    if (q.ConditionQuestionIndex.HasValue)
                    {
                        var condIdx = q.ConditionQuestionIndex.Value;
                        if (condIdx < 0 || condIdx >= i)
                            return Results.BadRequest(new { error = $"Question {i}: conditionQuestionIndex must reference a preceding question (0–{i - 1})." });
                        if (string.IsNullOrWhiteSpace(q.ConditionValue))
                            return Results.BadRequest(new { error = $"Question {i}: conditionValue is required when conditionQuestionIndex is set." });
                    }
                }
            }

            var now = DateTimeOffset.UtcNow;
            var form = new Data.Forms.Form
            {
                Id = Guid.NewGuid(),
                Title = req.Title.Trim(),
                Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
                IsPublished = false,
                FillToken = GenerateFillToken(),
                ViewToken = GenerateFillToken(),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.Forms.Add(form);

            var questionEntities = new List<Data.Forms.FormQuestion>();
            if (req.Questions is { Count: > 0 })
            {
                for (var i = 0; i < req.Questions.Count; i++)
                {
                    var q = req.Questions[i];
                    var entity = new Data.Forms.FormQuestion
                    {
                        Id = Guid.NewGuid(),
                        FormId = form.Id,
                        SortOrder = i,
                        Text = q.Text.Trim(),
                        Type = q.Type,
                        OptionsJson = q.Options is { Length: > 0 } ? JsonSerializer.Serialize(q.Options) : null,
                        IsRequired = q.IsRequired
                    };
                    questionEntities.Add(entity);
                }

                // Resolve condition references by index into actual GUIDs
                for (var i = 0; i < req.Questions.Count; i++)
                {
                    var q = req.Questions[i];
                    if (q.ConditionQuestionIndex is int condIdx && condIdx >= 0 && condIdx < i
                        && !string.IsNullOrWhiteSpace(q.ConditionValue))
                    {
                        questionEntities[i].ConditionQuestionId = questionEntities[condIdx].Id;
                        questionEntities[i].ConditionValue = q.ConditionValue.Trim();
                    }
                }

                foreach (var entity in questionEntities)
                    dbContext.FormQuestions.Add(entity);
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new FormDetailResponse(
                form.Id, form.Title, form.Description, form.IsPublished, form.FillToken, form.ViewToken,
                questionEntities.Select(MapQuestion).ToList(),
                form.CreatedUtc));
        }).RequireAuthorization();

        group.MapGet("/admin/{formId:guid}", async (
            Guid formId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            var form = await dbContext.Forms.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == formId, ct);
            if (form is null) return Results.NotFound();

            var questions = await dbContext.FormQuestions.AsNoTracking()
                .Where(q => q.FormId == formId)
                .OrderBy(q => q.SortOrder)
                .ToListAsync(ct);

            return Results.Ok(new FormDetailResponse(
                form.Id, form.Title, form.Description, form.IsPublished, form.FillToken, form.ViewToken,
                questions.Select(MapQuestion).ToList(),
                form.CreatedUtc));
        }).RequireAuthorization();

        group.MapPut("/admin/{formId:guid}", async (
            Guid formId,
            UpdateFormRequest req,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            var form = await dbContext.Forms.FirstOrDefaultAsync(x => x.Id == formId, ct);
            if (form is null) return Results.NotFound();

            if (string.IsNullOrWhiteSpace(req.Title))
                return Results.BadRequest(new { error = "Title is required." });

            form.Title = req.Title.Trim();
            form.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
            form.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapDelete("/admin/{formId:guid}", async (
            Guid formId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            var form = await dbContext.Forms.FirstOrDefaultAsync(x => x.Id == formId, ct);
            if (form is null) return Results.NotFound();

            var questions = await dbContext.FormQuestions
                .Where(q => q.FormId == formId)
                .ToListAsync(ct);
            var questionIds = questions.Select(q => q.Id).ToList();

            var answers = await dbContext.FormAnswers
                .Where(a => questionIds.Contains(a.QuestionId))
                .ToListAsync(ct);
            dbContext.FormAnswers.RemoveRange(answers);

            var responses = await dbContext.FormResponses
                .Where(r => r.FormId == formId)
                .ToListAsync(ct);
            dbContext.FormResponses.RemoveRange(responses);

            // Clear self-FK references so bulk question deletion succeeds
            foreach (var q in questions.Where(q => q.ConditionQuestionId.HasValue))
                q.ConditionQuestionId = null;

            await dbContext.SaveChangesAsync(ct);

            dbContext.FormQuestions.RemoveRange(questions);
            dbContext.Forms.Remove(form);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapPost("/admin/{formId:guid}/publish", async (
            Guid formId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            var form = await dbContext.Forms.FirstOrDefaultAsync(x => x.Id == formId, ct);
            if (form is null) return Results.NotFound();

            form.IsPublished = !form.IsPublished;
            form.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { isPublished = form.IsPublished });
        }).RequireAuthorization();

        group.MapPost("/admin/{formId:guid}/questions", async (
            Guid formId,
            CreateFormQuestionRequest req,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            if (!AllowedQuestionTypes.Contains(req.Type))
                return Results.BadRequest(new { error = "Invalid question type." });

            var formExists = await dbContext.Forms.AnyAsync(x => x.Id == formId, ct);
            if (!formExists) return Results.NotFound();

            if (req.ConditionQuestionId.HasValue)
            {
                if (string.IsNullOrWhiteSpace(req.ConditionValue))
                    return Results.BadRequest(new { error = "ConditionValue is required when ConditionQuestionId is set." });
                var condExists = await dbContext.FormQuestions.AnyAsync(
                    q => q.Id == req.ConditionQuestionId.Value && q.FormId == formId, ct);
                if (!condExists)
                    return Results.BadRequest(new { error = "Condition question not found in this form." });
            }

            var maxOrder = await dbContext.FormQuestions
                .Where(q => q.FormId == formId)
                .Select(q => (int?)q.SortOrder)
                .MaxAsync(ct) ?? -1;

            var question = new Data.Forms.FormQuestion
            {
                Id = Guid.NewGuid(),
                FormId = formId,
                SortOrder = maxOrder + 1,
                Text = req.Text.Trim(),
                Type = req.Type,
                OptionsJson = req.Options is { Length: > 0 } ? JsonSerializer.Serialize(req.Options) : null,
                IsRequired = req.IsRequired,
                ConditionQuestionId = req.ConditionQuestionId,
                ConditionValue = string.IsNullOrWhiteSpace(req.ConditionValue) ? null : req.ConditionValue.Trim()
            };

            dbContext.FormQuestions.Add(question);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(MapQuestion(question));
        }).RequireAuthorization();

        group.MapPut("/admin/{formId:guid}/questions/{questionId:guid}", async (
            Guid formId,
            Guid questionId,
            UpdateFormQuestionRequest req,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            if (!AllowedQuestionTypes.Contains(req.Type))
                return Results.BadRequest(new { error = "Invalid question type." });

            var question = await dbContext.FormQuestions
                .FirstOrDefaultAsync(q => q.Id == questionId && q.FormId == formId, ct);
            if (question is null) return Results.NotFound();

            if (req.ConditionQuestionId.HasValue)
            {
                if (string.IsNullOrWhiteSpace(req.ConditionValue))
                    return Results.BadRequest(new { error = "ConditionValue is required when ConditionQuestionId is set." });
                if (req.ConditionQuestionId.Value == questionId)
                    return Results.BadRequest(new { error = "A question cannot condition on itself." });
                var condExists = await dbContext.FormQuestions.AnyAsync(
                    q => q.Id == req.ConditionQuestionId.Value && q.FormId == formId, ct);
                if (!condExists)
                    return Results.BadRequest(new { error = "Condition question not found in this form." });
            }

            question.Text = req.Text.Trim();
            question.Type = req.Type;
            question.OptionsJson = req.Options is { Length: > 0 } ? JsonSerializer.Serialize(req.Options) : null;
            question.IsRequired = req.IsRequired;
            question.ConditionQuestionId = req.ConditionQuestionId;
            question.ConditionValue = string.IsNullOrWhiteSpace(req.ConditionValue) ? null : req.ConditionValue.Trim();

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        }).RequireAuthorization();

        group.MapDelete("/admin/{formId:guid}/questions/{questionId:guid}", async (
            Guid formId,
            Guid questionId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            var question = await dbContext.FormQuestions
                .FirstOrDefaultAsync(q => q.Id == questionId && q.FormId == formId, ct);
            if (question is null) return Results.NotFound();

            // Clear conditions on other questions that reference this one
            var dependents = await dbContext.FormQuestions
                .Where(q => q.ConditionQuestionId == questionId)
                .ToListAsync(ct);
            foreach (var dep in dependents)
            {
                dep.ConditionQuestionId = null;
                dep.ConditionValue = null;
            }

            var answers = await dbContext.FormAnswers
                .Where(a => a.QuestionId == questionId)
                .ToListAsync(ct);
            dbContext.FormAnswers.RemoveRange(answers);
            dbContext.FormQuestions.Remove(question);

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok();
        }).RequireAuthorization();

        group.MapGet("/admin/{formId:guid}/responses", async (
            Guid formId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            var form = await dbContext.Forms.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == formId, ct);
            if (form is null) return Results.NotFound();

            var questions = await dbContext.FormQuestions.AsNoTracking()
                .Where(q => q.FormId == formId)
                .OrderBy(q => q.SortOrder)
                .ToListAsync(ct);

            var responses = await dbContext.FormResponses.AsNoTracking()
                .Where(r => r.FormId == formId)
                .OrderBy(r => r.SubmittedUtc)
                .ToListAsync(ct);

            var responseIds = responses.Select(r => r.Id).ToList();
            var answers = await dbContext.FormAnswers.AsNoTracking()
                .Where(a => responseIds.Contains(a.ResponseId))
                .ToListAsync(ct);

            var answersByResponse = answers
                .GroupBy(a => a.ResponseId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var responseRows = responses.Select(r =>
            {
                var rowAnswers = answersByResponse.GetValueOrDefault(r.Id, []);
                return new FormResponseRow(
                    r.Id,
                    r.RespondentName,
                    r.SubmittedUtc,
                    rowAnswers.Select(a => new FormAnswerResponse(
                        a.QuestionId,
                        a.TextValue,
                        a.SelectedOptionsJson is not null
                            ? JsonSerializer.Deserialize<string[]>(a.SelectedOptionsJson)
                            : null)).ToList());
            }).ToList();

            return Results.Ok(new FormResponsesResponse(
                form.Id, form.Title,
                questions.Select(MapQuestion).ToList(),
                responseRows));
        }).RequireAuthorization();

        group.MapDelete("/admin/{formId:guid}/responses/{responseId:guid}", async (
            Guid formId,
            Guid responseId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct))
                return Results.Forbid();

            var response = await dbContext.FormResponses
                .FirstOrDefaultAsync(r => r.Id == responseId && r.FormId == formId, ct);
            if (response is null) return Results.NotFound();

            var answers = await dbContext.FormAnswers
                .Where(a => a.ResponseId == responseId)
                .ToListAsync(ct);
            dbContext.FormAnswers.RemoveRange(answers);
            dbContext.FormResponses.Remove(response);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok();
        }).RequireAuthorization();

        group.MapPost("/admin/{formId:guid}/view-token", async (
            Guid formId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsFormsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var form = await dbContext.Forms.FirstOrDefaultAsync(x => x.Id == formId, ct);
            if (form is null) return Results.NotFound();

            if (form.ViewToken is null)
            {
                form.ViewToken = GenerateFillToken();
                await dbContext.SaveChangesAsync(ct);
            }

            return Results.Ok(new { viewToken = form.ViewToken });
        }).RequireAuthorization();

        group.MapGet("/view/{viewToken}", async (
            string viewToken,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var form = await dbContext.Forms.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ViewToken == viewToken, ct);
            if (form is null) return Results.NotFound();

            var questions = await dbContext.FormQuestions.AsNoTracking()
                .Where(q => q.FormId == form.Id)
                .OrderBy(q => q.SortOrder)
                .ToListAsync(ct);

            var responses = await dbContext.FormResponses.AsNoTracking()
                .Where(r => r.FormId == form.Id)
                .OrderBy(r => r.SubmittedUtc)
                .ToListAsync(ct);

            var responseIds = responses.Select(r => r.Id).ToList();
            var answers = await dbContext.FormAnswers.AsNoTracking()
                .Where(a => responseIds.Contains(a.ResponseId))
                .ToListAsync(ct);

            var answersByResponse = answers
                .GroupBy(a => a.ResponseId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var responseRows = responses.Select(r =>
            {
                var rowAnswers = answersByResponse.GetValueOrDefault(r.Id, []);
                return new FormResponseRow(
                    r.Id,
                    r.RespondentName,
                    r.SubmittedUtc,
                    rowAnswers.Select(a => new FormAnswerResponse(
                        a.QuestionId,
                        a.TextValue,
                        a.SelectedOptionsJson is not null
                            ? JsonSerializer.Deserialize<string[]>(a.SelectedOptionsJson)
                            : null)).ToList());
            }).ToList();

            return Results.Ok(new FormResponsesResponse(
                form.Id, form.Title,
                questions.Select(MapQuestion).ToList(),
                responseRows));
        });

        group.MapGet("/fill/{token}", async (
            string token,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var form = await dbContext.Forms.AsNoTracking()
                .FirstOrDefaultAsync(x => x.FillToken == token && x.IsPublished, ct);
            if (form is null) return Results.NotFound();

            var questions = await dbContext.FormQuestions.AsNoTracking()
                .Where(q => q.FormId == form.Id)
                .OrderBy(q => q.SortOrder)
                .ToListAsync(ct);

            return Results.Ok(new PublicFormResponse(
                form.Id, form.Title, form.Description,
                questions.Select(MapQuestion).ToList()));
        });

        group.MapPost("/fill/{token}/submit", async (
            string token,
            SubmitFormRequest req,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var form = await dbContext.Forms.AsNoTracking()
                .FirstOrDefaultAsync(x => x.FillToken == token && x.IsPublished, ct);
            if (form is null) return Results.NotFound();

            var questions = await dbContext.FormQuestions.AsNoTracking()
                .Where(q => q.FormId == form.Id)
                .ToListAsync(ct);

            var answerMap = req.Answers
                .GroupBy(a => a.QuestionId)
                .ToDictionary(g => g.Key, g => g.First());

            bool IsVisible(Data.Forms.FormQuestion q)
            {
                if (q.ConditionQuestionId is null || q.ConditionValue is null) return true;
                var condQuestion = questions.FirstOrDefault(x => x.Id == q.ConditionQuestionId.Value);
                if (condQuestion is null) return false;
                if (!IsVisible(condQuestion)) return false;
                if (!answerMap.TryGetValue(q.ConditionQuestionId.Value, out var condAnswer)) return false;
                return condQuestion.Type == "multiselect"
                    ? condAnswer.SelectedOptions is { Length: > 0 } && condAnswer.SelectedOptions.Contains(q.ConditionValue)
                    : string.Equals(condAnswer.TextValue, q.ConditionValue, StringComparison.Ordinal);
            }

            foreach (var q in questions.Where(q => q.IsRequired))
            {
                if (!IsVisible(q)) continue;
                var answer = req.Answers.FirstOrDefault(a => a.QuestionId == q.Id);
                var hasValue = answer is not null
                    && (!string.IsNullOrWhiteSpace(answer.TextValue) || answer.SelectedOptions is { Length: > 0 });
                if (!hasValue)
                    return Results.BadRequest(new { error = $"Question '{q.Text}' is required." });
            }

            var now = DateTimeOffset.UtcNow;
            var response = new Data.Forms.FormResponse
            {
                Id = Guid.NewGuid(),
                FormId = form.Id,
                RespondentName = string.IsNullOrWhiteSpace(req.RespondentName) ? null : req.RespondentName.Trim(),
                SubmittedUtc = now
            };
            dbContext.FormResponses.Add(response);

            var validQuestionIds = new HashSet<Guid>(questions.Select(q => q.Id));
            foreach (var answerInput in req.Answers)
            {
                if (!validQuestionIds.Contains(answerInput.QuestionId)) continue;
                var q = questions.FirstOrDefault(x => x.Id == answerInput.QuestionId);
                if (q is null || !IsVisible(q)) continue;

                dbContext.FormAnswers.Add(new Data.Forms.FormAnswer
                {
                    Id = Guid.NewGuid(),
                    ResponseId = response.Id,
                    QuestionId = answerInput.QuestionId,
                    TextValue = string.IsNullOrWhiteSpace(answerInput.TextValue) ? null : answerInput.TextValue.Trim(),
                    SelectedOptionsJson = answerInput.SelectedOptions is { Length: > 0 }
                        ? JsonSerializer.Serialize(answerInput.SelectedOptions)
                        : null
                });
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new { submitted = true });
        });
    }

    private static FormQuestionResponse MapQuestion(Data.Forms.FormQuestion q) =>
        new(q.Id, q.SortOrder, q.Text, q.Type,
            q.OptionsJson is not null ? JsonSerializer.Deserialize<string[]>(q.OptionsJson) : null,
            q.IsRequired,
            q.ConditionQuestionId,
            q.ConditionValue);

    private static string GenerateFillToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private static async Task<bool> IsFormsAdminAsync(HttpContext context, RecreatioDbContext dbContext, CancellationToken ct)
    {
        if (!EndpointHelpers.TryGetUserId(context, out var userId))
            return false;

        return await dbContext.PortalAdminAssignments.AsNoTracking()
            .AnyAsync(x => x.ScopeKey == FormsAdminScope && x.UserId == userId, ct);
    }
}
