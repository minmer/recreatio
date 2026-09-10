CREATE TABLE dbo.CgTemplateGraphs (
    Id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CgTemplateGraphs PRIMARY KEY,
    TypeDefId  BIGINT NOT NULL,
    Name       NVARCHAR(200) NOT NULL,
    CreatedUtc DATETIME2 NOT NULL,
    UpdatedUtc DATETIME2 NOT NULL
);
CREATE INDEX IX_CgTemplateGraphs_TypeDefId ON dbo.CgTemplateGraphs (TypeDefId);

CREATE TABLE dbo.CgTemplateNodes (
    Id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CgTemplateNodes PRIMARY KEY,
    GraphId    BIGINT NOT NULL,
    NodeKey    NVARCHAR(100) NOT NULL,
    NodeType   NVARCHAR(50) NOT NULL,
    ConfigJson NVARCHAR(MAX) NOT NULL DEFAULT '{}',
    PositionX  DECIMAL(9,2) NOT NULL DEFAULT 0,
    PositionY  DECIMAL(9,2) NOT NULL DEFAULT 0
);
CREATE INDEX IX_CgTemplateNodes_GraphId ON dbo.CgTemplateNodes (GraphId);

CREATE TABLE dbo.CgTemplateEdges (
    Id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CgTemplateEdges PRIMARY KEY,
    GraphId      BIGINT NOT NULL,
    EdgeKey      NVARCHAR(100) NOT NULL,
    SourceKey    NVARCHAR(100) NOT NULL,
    TargetKey    NVARCHAR(100) NOT NULL,
    SourceHandle NVARCHAR(50) NULL,
    TargetHandle NVARCHAR(50) NULL
);
CREATE INDEX IX_CgTemplateEdges_GraphId ON dbo.CgTemplateEdges (GraphId);
