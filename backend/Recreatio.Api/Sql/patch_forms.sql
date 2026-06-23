-- Forms module
-- Standalone form builder: admin creates forms, shares a fill link, views responses.
-- Adds the [forms] schema and all four tables to an existing database.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'forms')
BEGIN
    EXEC('CREATE SCHEMA forms AUTHORIZATION dbo;');
END
GO

IF OBJECT_ID(N'forms.Forms', N'U') IS NULL
BEGIN
    CREATE TABLE forms.Forms
    (
        Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Forms PRIMARY KEY,
        Title       NVARCHAR(200)    NOT NULL,
        Description NVARCHAR(800)    NULL,
        IsPublished BIT              NOT NULL,
        FillToken   NVARCHAR(64)     NOT NULL,
        CreatedUtc  DATETIMEOFFSET   NOT NULL,
        UpdatedUtc  DATETIMEOFFSET   NOT NULL,
        CONSTRAINT UX_Forms_FillToken UNIQUE (FillToken)
    );
END
GO

IF OBJECT_ID(N'forms.FormQuestions', N'U') IS NULL
BEGIN
    CREATE TABLE forms.FormQuestions
    (
        Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_FormQuestions PRIMARY KEY,
        FormId      UNIQUEIDENTIFIER NOT NULL,
        SortOrder   INT              NOT NULL,
        Text        NVARCHAR(600)    NOT NULL,
        Type        NVARCHAR(16)     NOT NULL,   -- text | multiselect | scale
        OptionsJson NVARCHAR(MAX)    NULL,        -- JSON array of strings; only for multiselect
        IsRequired  BIT              NOT NULL,
        CONSTRAINT FK_FormQuestions_Form FOREIGN KEY (FormId) REFERENCES forms.Forms(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_FormQuestions_FormId_SortOrder'
      AND object_id = OBJECT_ID('forms.FormQuestions')
)
BEGIN
    CREATE INDEX IX_FormQuestions_FormId_SortOrder ON forms.FormQuestions(FormId, SortOrder);
END
GO

IF OBJECT_ID(N'forms.FormResponses', N'U') IS NULL
BEGIN
    CREATE TABLE forms.FormResponses
    (
        Id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_FormResponses PRIMARY KEY,
        FormId         UNIQUEIDENTIFIER NOT NULL,
        RespondentName NVARCHAR(200)    NULL,
        SubmittedUtc   DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_FormResponses_Form FOREIGN KEY (FormId) REFERENCES forms.Forms(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_FormResponses_FormId_SubmittedUtc'
      AND object_id = OBJECT_ID('forms.FormResponses')
)
BEGIN
    CREATE INDEX IX_FormResponses_FormId_SubmittedUtc ON forms.FormResponses(FormId, SubmittedUtc);
END
GO

IF OBJECT_ID(N'forms.FormAnswers', N'U') IS NULL
BEGIN
    CREATE TABLE forms.FormAnswers
    (
        Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_FormAnswers PRIMARY KEY,
        ResponseId          UNIQUEIDENTIFIER NOT NULL,
        QuestionId          UNIQUEIDENTIFIER NOT NULL,
        TextValue           NVARCHAR(2000)   NULL,
        SelectedOptionsJson NVARCHAR(MAX)    NULL,   -- JSON array of selected option strings
        CONSTRAINT UX_FormAnswers_Response_Question UNIQUE (ResponseId, QuestionId),
        CONSTRAINT FK_FormAnswers_Response FOREIGN KEY (ResponseId) REFERENCES forms.FormResponses(Id),
        CONSTRAINT FK_FormAnswers_Question FOREIGN KEY (QuestionId) REFERENCES forms.FormQuestions(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_FormAnswers_QuestionId'
      AND object_id = OBJECT_ID('forms.FormAnswers')
)
BEGIN
    CREATE INDEX IX_FormAnswers_QuestionId ON forms.FormAnswers(QuestionId);
END
GO
