namespace Recreatio.Api.Contracts;

public sealed record FormsAdminStatusResponse(
    bool HasAdmin,
    bool IsCurrentUserAdmin,
    string? AdminDisplayName);

public sealed record FormSummaryResponse(
    Guid Id,
    string Title,
    string? Description,
    bool IsPublished,
    string FillToken,
    int QuestionCount,
    int ResponseCount,
    DateTimeOffset CreatedUtc);

public sealed record FormQuestionResponse(
    Guid Id,
    int SortOrder,
    string Text,
    string Type,
    string[]? Options,
    bool IsRequired);

public sealed record FormDetailResponse(
    Guid Id,
    string Title,
    string? Description,
    bool IsPublished,
    string FillToken,
    IReadOnlyList<FormQuestionResponse> Questions,
    DateTimeOffset CreatedUtc);

public sealed record PublicFormResponse(
    Guid Id,
    string Title,
    string? Description,
    IReadOnlyList<FormQuestionResponse> Questions);

public sealed record CreateFormRequest(
    string Title,
    string? Description);

public sealed record UpdateFormRequest(
    string Title,
    string? Description);

public sealed record CreateFormQuestionRequest(
    string Text,
    string Type,
    string[]? Options,
    bool IsRequired);

public sealed record UpdateFormQuestionRequest(
    string Text,
    string Type,
    string[]? Options,
    bool IsRequired);

public sealed record FormAnswerInput(
    Guid QuestionId,
    string? TextValue,
    string[]? SelectedOptions);

public sealed record SubmitFormRequest(
    string? RespondentName,
    IReadOnlyList<FormAnswerInput> Answers);

public sealed record FormAnswerResponse(
    Guid QuestionId,
    string? TextValue,
    string[]? SelectedOptions);

public sealed record FormResponseRow(
    Guid ResponseId,
    string? RespondentName,
    DateTimeOffset SubmittedUtc,
    IReadOnlyList<FormAnswerResponse> Answers);

public sealed record FormResponsesResponse(
    Guid FormId,
    string Title,
    IReadOnlyList<FormQuestionResponse> Questions,
    IReadOnlyList<FormResponseRow> Responses);
