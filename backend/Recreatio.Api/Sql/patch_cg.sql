-- Cogita Graph (CG) schema patch
-- Adds all tables for the new node-graph based learning system.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgLibrary')
BEGIN
    CREATE TABLE dbo.CgLibrary (
        Id              UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        OwnerAccountId  UNIQUEIDENTIFIER    NOT NULL,
        Name            NVARCHAR(200)       NOT NULL,
        Template        NVARCHAR(50)        NOT NULL DEFAULT 'custom',
        CreatedUtc      DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedUtc      DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_CgLibrary_OwnerAccountId ON dbo.CgLibrary (OwnerAccountId);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgNodeKind')
BEGIN
    CREATE TABLE dbo.CgNodeKind (
        Id          UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        LibraryId   UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgLibrary(Id) ON DELETE CASCADE,
        Name        NVARCHAR(100)       NOT NULL,
        IsSubentity BIT                 NOT NULL DEFAULT 0,
        SortOrder   INT                 NOT NULL DEFAULT 0,
        CreatedUtc  DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedUtc  DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_CgNodeKind_LibraryId ON dbo.CgNodeKind (LibraryId);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgFieldDef')
BEGIN
    CREATE TABLE dbo.CgFieldDef (
        Id              UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        NodeKindId      UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgNodeKind(Id) ON DELETE CASCADE,
        LibraryId       UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgLibrary(Id),
        FieldName       NVARCHAR(100)       NOT NULL,
        FieldType       NVARCHAR(50)        NOT NULL DEFAULT 'Text',
        RefNodeKindId   UNIQUEIDENTIFIER    NULL REFERENCES dbo.CgNodeKind(Id),
        IsMultiValue    BIT                 NOT NULL DEFAULT 0,
        IsRangeCapable  BIT                 NOT NULL DEFAULT 0,
        SortOrder       INT                 NOT NULL DEFAULT 0,
        CreatedUtc      DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_CgFieldDef_NodeKindId  ON dbo.CgFieldDef (NodeKindId);
    CREATE INDEX IX_CgFieldDef_LibraryId   ON dbo.CgFieldDef (LibraryId);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgSubentityKindDef')
BEGIN
    CREATE TABLE dbo.CgSubentityKindDef (
        Id                  UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        ParentNodeKindId    UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgNodeKind(Id),
        ChildNodeKindId     UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgNodeKind(Id),
        CreatedUtc          DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_CgSubentityKindDef_Parent ON dbo.CgSubentityKindDef (ParentNodeKindId);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgEdgeKind')
BEGIN
    CREATE TABLE dbo.CgEdgeKind (
        Id                  UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        LibraryId           UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgLibrary(Id) ON DELETE CASCADE,
        Name                NVARCHAR(100)       NOT NULL,
        SourceKindId        UNIQUEIDENTIFIER    NULL REFERENCES dbo.CgNodeKind(Id),
        TargetKindIdsJson   NVARCHAR(MAX)       NULL,
        IsBuiltIn           BIT                 NOT NULL DEFAULT 0,
        CreatedUtc          DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_CgEdgeKind_LibraryId ON dbo.CgEdgeKind (LibraryId);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgNode')
BEGIN
    CREATE TABLE dbo.CgNode (
        Id          UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        LibraryId   UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgLibrary(Id),
        NodeType    NVARCHAR(30)        NOT NULL DEFAULT 'Entity',
        NodeKindId  UNIQUEIDENTIFIER    NULL REFERENCES dbo.CgNodeKind(Id),
        ParentNodeId UNIQUEIDENTIFIER   NULL REFERENCES dbo.CgNode(Id),
        Label       NVARCHAR(500)       NULL,
        BodyJson    NVARCHAR(MAX)       NULL,
        CreatedUtc  DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedUtc  DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_CgNode_LibraryId    ON dbo.CgNode (LibraryId);
    CREATE INDEX IX_CgNode_NodeKindId   ON dbo.CgNode (NodeKindId);
    CREATE INDEX IX_CgNode_ParentNodeId ON dbo.CgNode (ParentNodeId);
    CREATE INDEX IX_CgNode_NodeType     ON dbo.CgNode (LibraryId, NodeType);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgFieldValue')
BEGIN
    CREATE TABLE dbo.CgFieldValue (
        Id          UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        NodeId      UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgNode(Id) ON DELETE CASCADE,
        FieldDefId  UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgFieldDef(Id),
        TextValue   NVARCHAR(MAX)       NULL,
        NumberValue FLOAT               NULL,
        DateValue   NVARCHAR(50)        NULL,
        BoolValue   BIT                 NULL,
        RefNodeId   UNIQUEIDENTIFIER    NULL REFERENCES dbo.CgNode(Id),
        PvState     NVARCHAR(30)        NULL,
        PvNote      NVARCHAR(1000)      NULL,
        SortOrder   INT                 NOT NULL DEFAULT 0,
        CreatedUtc  DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_CgFieldValue_NodeId     ON dbo.CgFieldValue (NodeId);
    CREATE INDEX IX_CgFieldValue_FieldDefId ON dbo.CgFieldValue (FieldDefId);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgEdge')
BEGIN
    CREATE TABLE dbo.CgEdge (
        Id              UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        LibraryId       UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgLibrary(Id),
        EdgeKindId      UNIQUEIDENTIFIER    NULL REFERENCES dbo.CgEdgeKind(Id),
        SourceNodeId    UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgNode(Id),
        TargetNodeId    UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgNode(Id),
        PvState         NVARCHAR(30)        NULL,
        PvNote          NVARCHAR(1000)      NULL,
        SortOrder       INT                 NOT NULL DEFAULT 0,
        CreatedUtc      DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_CgEdge_LibraryId    ON dbo.CgEdge (LibraryId);
    CREATE INDEX IX_CgEdge_SourceNodeId ON dbo.CgEdge (SourceNodeId);
    CREATE INDEX IX_CgEdge_TargetNodeId ON dbo.CgEdge (TargetNodeId);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgNodeRelation')
BEGIN
    CREATE TABLE dbo.CgNodeRelation (
        Id              UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        ParentNodeId    UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgNode(Id) ON DELETE CASCADE,
        ChildNodeId     UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgNode(Id),
        RelationType    NVARCHAR(30)        NOT NULL DEFAULT 'answer',
        SortOrder       INT                 NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_CgNodeRelation_Parent ON dbo.CgNodeRelation (ParentNodeId);
    CREATE INDEX IX_CgNodeRelation_Child  ON dbo.CgNodeRelation (ChildNodeId);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgOpenTopic')
BEGIN
    CREATE TABLE dbo.CgOpenTopic (
        Id                  UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        TopicNodeId         UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgNode(Id) ON DELETE CASCADE,
        LibraryId           UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgLibrary(Id),
        MarkedByAccountId   UNIQUEIDENTIFIER    NOT NULL,
        Note                NVARCHAR(1000)      NULL,
        CreatedUtc          DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_CgOpenTopic_LibraryId   ON dbo.CgOpenTopic (LibraryId);
    CREATE INDEX IX_CgOpenTopic_TopicNodeId ON dbo.CgOpenTopic (TopicNodeId);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgRangeNode')
BEGIN
    CREATE TABLE dbo.CgRangeNode (
        Id              UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        PrimitiveType   NVARCHAR(20)        NOT NULL DEFAULT 'Date',
        CreatedUtc      DATETIMEOFFSET      NOT NULL DEFAULT SYSUTCDATETIME()
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CgRangeSegment')
BEGIN
    CREATE TABLE dbo.CgRangeSegment (
        Id          UNIQUEIDENTIFIER    NOT NULL PRIMARY KEY DEFAULT NEWID(),
        RangeNodeId UNIQUEIDENTIFIER    NOT NULL REFERENCES dbo.CgRangeNode(Id) ON DELETE CASCADE,
        FromValue   NVARCHAR(100)       NULL,
        ToValue     NVARCHAR(100)       NULL,
        FromState   NVARCHAR(30)        NULL,
        ToState     NVARCHAR(30)        NULL,
        SortOrder   INT                 NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_CgRangeSegment_RangeNodeId ON dbo.CgRangeSegment (RangeNodeId);
END
