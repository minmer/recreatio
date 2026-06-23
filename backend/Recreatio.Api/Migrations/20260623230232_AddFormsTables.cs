using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recreatio.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFormsTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "calendar");

            migrationBuilder.EnsureSchema(
                name: "chat");

            migrationBuilder.EnsureSchema(
                name: "edk");

            migrationBuilder.EnsureSchema(
                name: "forms");

            migrationBuilder.EnsureSchema(
                name: "limanowa");

            migrationBuilder.EnsureSchema(
                name: "pilgrimage");

            migrationBuilder.CreateTable(
                name: "AuthLedger",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TimestampUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Actor = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PreviousHash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Hash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    SignerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Signature = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    SignatureAlg = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuthLedger", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BusinessLedger",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TimestampUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Actor = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PreviousHash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Hash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    SignerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Signature = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    SignatureAlg = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BusinessLedger", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Calendars",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    OrganizationScope = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    OwnerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DefaultTimeZoneId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Calendars", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CgEntities",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LibraryId = table.Column<long>(type: "bigint", nullable: false),
                    TypeDefId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CgEntities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CgFieldDefs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TypeDefId = table.Column<long>(type: "bigint", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    InputType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FileTypes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Multiple = table.Column<bool>(type: "bit", nullable: false),
                    IsOrdered = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CgFieldDefs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CgFieldDefTargets",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FieldDefId = table.Column<long>(type: "bigint", nullable: false),
                    TargetTypeDefId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CgFieldDefTargets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CgFieldValues",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EntityId = table.Column<long>(type: "bigint", nullable: false),
                    FieldDefId = table.Column<long>(type: "bigint", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    EncryptedValue = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RefEntityId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CgFieldValues", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CgLibraries",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OwnerAccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CgLibraries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CgTemplateEdges",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GraphId = table.Column<long>(type: "bigint", nullable: false),
                    EdgeKey = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SourceKey = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TargetKey = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SourceHandle = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TargetHandle = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CgTemplateEdges", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CgTemplateGraphs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TypeDefId = table.Column<long>(type: "bigint", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CgTemplateGraphs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CgTemplateNodes",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GraphId = table.Column<long>(type: "bigint", nullable: false),
                    NodeKey = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    NodeType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PositionX = table.Column<decimal>(type: "decimal(9,2)", nullable: false),
                    PositionY = table.Column<decimal>(type: "decimal(9,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CgTemplateNodes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CgTypeDefs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LibraryId = table.Column<long>(type: "bigint", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CgTypeDefs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChatConversations",
                schema: "chat",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChatType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ScopeType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ScopeId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false),
                    IsPublic = table.Column<bool>(type: "bit", nullable: false),
                    PublicReadEnabled = table.Column<bool>(type: "bit", nullable: false),
                    PublicQuestionEnabled = table.Column<bool>(type: "bit", nullable: false),
                    PublicCodeHash = table.Column<byte[]>(type: "varbinary(900)", nullable: true),
                    ActiveKeyVersion = table.Column<int>(type: "int", nullable: false),
                    LastMessageSequence = table.Column<long>(type: "bigint", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatConversations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaCheckcardDefinitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CardKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    CardType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Direction = table.Column<int>(type: "int", nullable: false),
                    PromptJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RevealJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaCheckcardDefinitions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaCreationArtifacts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ArtifactType = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    ContentJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SourceItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SourceCardKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaCreationArtifacts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaDashboardPreferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LayoutVersion = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    PreferencesJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaDashboardPreferences", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaDependencyEdges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParentCardId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChildCardId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParentKnownessWeightPct = table.Column<decimal>(type: "decimal(9,4)", nullable: false),
                    ThresholdPct = table.Column<decimal>(type: "decimal(9,4)", nullable: false),
                    IsHardBlock = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaDependencyEdges", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaEntitySearchDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceKind = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    SourceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EntityKind = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ConnectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TitleNormalized = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Summary = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SearchTextNormalized = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FilterTextNormalized = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SourceUpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaEntitySearchDocuments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaInfoLinkMultis",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FieldKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    TargetInfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaInfoLinkMultis", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaInfoLinkSingles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FieldKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    TargetInfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsRequired = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaInfoLinkSingles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaInfoSearchIndexes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InfoType = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LabelNormalized = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    LabelHash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaInfoSearchIndexes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaKnowledgeLinkMultis",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FieldKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    TargetItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaKnowledgeLinkMultis", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaKnowledgeLinkSingles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FieldKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    TargetItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsRequired = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaKnowledgeLinkSingles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaKnowledgeTypeSpecs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TypeKey = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    SpecJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaKnowledgeTypeSpecs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaKnownessSnapshots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CardKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    SnapshotUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    KnownessPct = table.Column<decimal>(type: "decimal(9,4)", nullable: false),
                    CorrectCount = table.Column<int>(type: "int", nullable: false),
                    WrongCount = table.Column<int>(type: "int", nullable: false),
                    UnansweredCount = table.Column<int>(type: "int", nullable: false),
                    LastSeenUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    SourceRunId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SourceParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaKnownessSnapshots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaNotions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TypeSpecId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TypeKey = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    SearchText = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsExcludedFromKnowness = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaNotions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaPythonInfos",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaPythonInfos", x => x.InfoId);
                });

            migrationBuilder.CreateTable(
                name: "CogitaReferenceCryptoFields",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerEntity = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    OwnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FieldKey = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    PolicyVersion = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ValueCipher = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: false),
                    DeterministicHash = table.Column<byte[]>(type: "varbinary(900)", nullable: false),
                    SignatureBase64 = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    Signer = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    SignatureVersion = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaReferenceCryptoFields", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaRevisionPatterns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Mode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SettingsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CollectionScopeJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaRevisionPatterns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaRevisionRuns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RevisionPatternId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RunScope = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SessionCodeHash = table.Column<byte[]>(type: "varbinary(900)", nullable: true),
                    SessionCodeCipher = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    SettingsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PromptBundleJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StartedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    FinishedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaRevisionRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaRevisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CollectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RevisionType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RevisionSettingsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Mode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CheckMode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CardLimit = table.Column<int>(type: "int", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaRevisions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaRunAttempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RunId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoundIndex = table.Column<int>(type: "int", nullable: false),
                    CardKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    AnswerCipher = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OutcomeClass = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    IsAnswered = table.Column<bool>(type: "bit", nullable: false),
                    IsCorrect = table.Column<bool>(type: "bit", nullable: true),
                    CorrectnessPct = table.Column<decimal>(type: "decimal(9,4)", nullable: true),
                    SubmittedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevealedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ResponseDurationMs = table.Column<int>(type: "int", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaRunAttempts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaRunEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RunId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    EventType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RoundIndex = table.Column<int>(type: "int", nullable: true),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaRunEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaRunExposures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RunId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoundIndex = table.Column<int>(type: "int", nullable: false),
                    CardKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    PromptShownUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevealShownUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    WasSkipped = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaRunExposures", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaRunParticipants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RunId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DisplayNameCipher = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    AccessTokenHash = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    AccessTokenCipher = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    IsHost = table.Column<bool>(type: "bit", nullable: false),
                    IsConnected = table.Column<bool>(type: "bit", nullable: false),
                    JoinedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaRunParticipants", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaStoryboardSessionAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NodeKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    NotionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CheckType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    IsCorrect = table.Column<bool>(type: "bit", nullable: false),
                    AttemptCount = table.Column<int>(type: "int", nullable: false),
                    FirstSubmittedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaStoryboardSessionAnswers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaStoryboardSessionParticipants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    JoinTokenHash = table.Column<byte[]>(type: "varbinary(900)", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    JoinedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaStoryboardSessionParticipants", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaStoryboardSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PublicCodeHash = table.Column<byte[]>(type: "varbinary(900)", nullable: false),
                    EncSessionCode = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncLibraryReadKey = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaStoryboardSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CogitaStoryboardShares",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PublicCodeHash = table.Column<byte[]>(type: "varbinary(900)", nullable: false),
                    EncShareCode = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncLibraryReadKey = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaStoryboardShares", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DataItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ItemName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EncryptedItemType = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncryptedItemName = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncryptedValue = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    StorageProvider = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    StoragePath = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    StorageSizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    StorageSha256 = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: true),
                    PublicSigningKey = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    PublicSigningKeyAlg = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DataSignature = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    DataSignatureAlg = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DataSignatureRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DataItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DataKeyGrants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PermissionType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EncryptedDataKeyBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncryptedSigningKeyBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DataKeyGrants", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EdkEvents",
                schema: "edk",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Motto = table.Column<string>(type: "nvarchar(220)", maxLength: 220, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    StartLocation = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    EndLocation = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    OrganizerName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    OrganizerEmail = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    OrganizerPhone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EdkEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EdkRegistrations",
                schema: "edk",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ParticipantStatus = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    AdditionalInfo = table.Column<string>(type: "nvarchar(2400)", maxLength: 2400, nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EdkRegistrations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EdkSiteConfigs",
                schema: "edk",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsPublished = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EdkSiteConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Forms",
                schema: "forms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(800)", maxLength: 800, nullable: true),
                    IsPublished = table.Column<bool>(type: "bit", nullable: false),
                    FillToken = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Forms", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KeyLedger",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TimestampUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Actor = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PreviousHash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Hash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    SignerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Signature = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    SignatureAlg = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KeyLedger", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Keys",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    KeyType = table.Column<int>(type: "int", nullable: false),
                    OwnerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    EncryptedKeyBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    ScopeType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ScopeSubtype = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    BoundEntryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LedgerRefId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Keys", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LimanowaEvents",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(220)", maxLength: 220, nullable: false),
                    Subtitle = table.Column<string>(type: "nvarchar(520)", maxLength: 520, nullable: false),
                    Tagline = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CapacityTotal = table.Column<int>(type: "int", nullable: false),
                    RegistrationOpen = table.Column<bool>(type: "bit", nullable: false),
                    RegistrationGroupsDeadline = table.Column<DateOnly>(type: "date", nullable: false),
                    RegistrationParticipantsDeadline = table.Column<DateOnly>(type: "date", nullable: false),
                    Published = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Memberships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RelationshipType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    EncryptedReadKeyCopy = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncryptedWriteKeyCopy = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    EncryptedOwnerKeyCopy = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    LedgerRefId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Memberships", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationCandidates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PayloadEnc = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    AcceptedRodo = table.Column<bool>(type: "bit", nullable: false),
                    PaperConsentReceived = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationCandidates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationCelebrationJoins",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CelebrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    RequestedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    DecisionUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationCelebrationJoins", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationCelebrationParticipations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CelebrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CommentText = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationCelebrationParticipations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationCelebrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    ShortInfo = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    StartsAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EndsAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationCelebrations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationEventJoins",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    RequestedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    DecisionUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationEventJoins", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    ShortInfo = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    StartsAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EndsAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationMeetingJoinRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SlotId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestedByCandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    HostCandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    DecidedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationMeetingJoinRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationMeetingLinks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BookingToken = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Stage = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SlotId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BookedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationMeetingLinks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationMeetingSlots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StartsAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    DurationMinutes = table.Column<int>(type: "int", nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    Stage = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    HostCandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    HostInviteToken = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    HostInviteExpiresUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationMeetingSlots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SenderType = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    MessageText = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationMessages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationNotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NoteText = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    IsPublic = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationNotes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationPhoneVerifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PhoneIndex = table.Column<int>(type: "int", nullable: false),
                    VerificationToken = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    VerifiedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationPhoneVerifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishConfirmationSmsTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VerificationInviteTemplate = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    VerificationWarningTemplate = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PortalInviteTemplate = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishConfirmationSmsTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Parishes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Location = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Theme = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    HeroImageUrl = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AdminRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PriestRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OfficeRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FinanceRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PublicRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntentionInternalDataItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntentionPublicDataItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OfferingDataItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntentionInternalKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntentionPublicKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OfferingKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Parishes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishIntentions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MassDateTime = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ChurchName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    PublicText = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    InternalTextEnc = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    DonorRefEnc = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    InternalDataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishIntentions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishLedger",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TimestampUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Actor = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PreviousHash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Hash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    SignerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Signature = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    SignatureAlg = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishLedger", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishMasses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MassDateTime = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ChurchName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    IsCollective = table.Column<bool>(type: "bit", nullable: false),
                    DurationMinutes = table.Column<int>(type: "int", nullable: true),
                    Kind = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    BeforeService = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    AfterService = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    IntentionsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DonationSummary = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SourceRuleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishMasses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishMassRules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(600)", maxLength: 600, nullable: true),
                    GraphJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishMassRules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishOfferings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntentionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AmountEnc = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Date = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    DonorRefEnc = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishOfferings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishSiteConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    HomepageConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsPublished = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishSiteConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PendingDataShares",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TargetRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PermissionType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EncryptedDataKeyBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncryptedSigningKeyBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    EncryptionAlg = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    LedgerRefId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    AcceptedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingDataShares", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PendingRoleShares",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TargetRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RelationshipType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    EncryptedReadKeyBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncryptedWriteKeyBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    EncryptedOwnerKeyBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    EncryptionAlg = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    LedgerRefId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    AcceptedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingRoleShares", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PilgrimageAnnouncements",
                schema: "pilgrimage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Audience = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    Body = table.Column<string>(type: "nvarchar(2400)", maxLength: 2400, nullable: false),
                    IsCritical = table.Column<bool>(type: "bit", nullable: false),
                    CreatedByRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PilgrimageAnnouncements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PilgrimageContactInquiries",
                schema: "pilgrimage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    IsPublicQuestion = table.Column<bool>(type: "bit", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: true),
                    Topic = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(2400)", maxLength: 2400, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    PublicAnswer = table.Column<string>(type: "nvarchar(2400)", maxLength: 2400, nullable: true),
                    PublicAnsweredBy = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: true),
                    PublicAnsweredUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PilgrimageContactInquiries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PilgrimageEvents",
                schema: "pilgrimage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Motto = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    StartLocation = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    EndLocation = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Theme = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DistanceKm = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrganizerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LogisticsRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MedicalRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PublicRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantDataItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantDataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EmergencyDataItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EmergencyDataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantDataKeyServerEnc = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EmergencyDataKeyServerEnc = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PilgrimageEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PilgrimageParticipantIssues",
                schema: "pilgrimage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(2400)", maxLength: 2400, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ResolutionNote = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PilgrimageParticipantIssues", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PilgrimageParticipants",
                schema: "pilgrimage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipationVariant = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    GroupName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    RegistrationStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    PaymentStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    AttendanceStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    NeedsLodging = table.Column<bool>(type: "bit", nullable: false),
                    NeedsBaggageTransport = table.Column<bool>(type: "bit", nullable: false),
                    IsMinor = table.Column<bool>(type: "bit", nullable: false),
                    AcceptedTerms = table.Column<bool>(type: "bit", nullable: false),
                    AcceptedRodo = table.Column<bool>(type: "bit", nullable: false),
                    IdentityDigest = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: false),
                    PayloadEnc = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    PayloadDataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PilgrimageParticipants", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PilgrimageSiteConfigs",
                schema: "pilgrimage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PublicConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ParticipantConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OrganizerConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsPublished = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PilgrimageSiteConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PilgrimageTasks",
                schema: "pilgrimage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2400)", maxLength: 2400, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    Assignee = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Comments = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Attachments = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    DueUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedByRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PilgrimageTasks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PortalAdminAssignments",
                schema: "pilgrimage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ScopeKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PortalAdminAssignments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoleEdges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParentRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChildRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RelationshipType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    EncryptedRelationshipType = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    RelationshipTypeHash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncryptedReadKeyCopy = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncryptedWriteKeyCopy = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    EncryptedOwnerKeyCopy = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleEdges", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoleFields",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FieldType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    EncryptedFieldType = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    FieldTypeHash = table.Column<byte[]>(type: "varbinary(900)", nullable: false),
                    EncryptedValue = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleFields", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoleRecoveryApprovals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApproverRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedApprovalBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleRecoveryApprovals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoleRecoveryKeys",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TargetRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedServerShare = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleRecoveryKeys", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoleRecoveryRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TargetRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InitiatorRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    RequiredApprovals = table.Column<int>(type: "int", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CanceledUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CompletedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleRecoveryRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoleRecoveryShares",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TargetRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SharedWithRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedShareBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleRecoveryShares", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedRoleBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    PublicSigningKey = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    PublicSigningKeyAlg = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    PublicEncryptionKey = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    PublicEncryptionKeyAlg = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    IsSecureMode = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastActivityUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    DeviceInfo = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    IsRevoked = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SharedViews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ViewRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncViewRoleKey = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    SharedViewSecretHash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SharedViews", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CalendarRoleBindings",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CalendarId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccessType = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    AddedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarRoleBindings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarRoleBindings_Calendars_CalendarId",
                        column: x => x.CalendarId,
                        principalSchema: "calendar",
                        principalTable: "Calendars",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatConversationKeyVersions",
                schema: "chat",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    EncryptedKeyBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RotatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatConversationKeyVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatConversationKeyVersions_ChatConversations_ConversationId",
                        column: x => x.ConversationId,
                        principalSchema: "chat",
                        principalTable: "ChatConversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatConversationParticipants",
                schema: "chat",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubjectType = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    SubjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DisplayLabel = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    CanRead = table.Column<bool>(type: "bit", nullable: false),
                    CanWrite = table.Column<bool>(type: "bit", nullable: false),
                    CanManage = table.Column<bool>(type: "bit", nullable: false),
                    CanRespondPublic = table.Column<bool>(type: "bit", nullable: false),
                    MinReadableSequence = table.Column<long>(type: "bigint", nullable: false),
                    JoinedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RemovedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    AddedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatConversationParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatConversationParticipants_ChatConversations_ConversationId",
                        column: x => x.ConversationId,
                        principalSchema: "chat",
                        principalTable: "ChatConversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatConversationReadStates",
                schema: "chat",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LastReadSequence = table.Column<long>(type: "bigint", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatConversationReadStates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatConversationReadStates_ChatConversations_ConversationId",
                        column: x => x.ConversationId,
                        principalSchema: "chat",
                        principalTable: "ChatConversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatMessages",
                schema: "chat",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Sequence = table.Column<long>(type: "bigint", nullable: false),
                    SenderUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SenderRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SenderDisplay = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    MessageType = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    Visibility = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    ClientMessageId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    KeyVersion = table.Column<int>(type: "int", nullable: false),
                    Ciphertext = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EditedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DeletedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatMessages_ChatConversations_ConversationId",
                        column: x => x.ConversationId,
                        principalSchema: "chat",
                        principalTable: "ChatConversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatPublicLinks",
                schema: "chat",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CodeHash = table.Column<byte[]>(type: "varbinary(900)", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    ExpiresUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastUsedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatPublicLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatPublicLinks_ChatConversations_ConversationId",
                        column: x => x.ConversationId,
                        principalSchema: "chat",
                        principalTable: "ChatConversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaRevisionShares",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RevisionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CollectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SharedViewId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PublicCodeHash = table.Column<byte[]>(type: "varbinary(900)", nullable: false),
                    EncShareCode = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Mode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CheckMode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CardLimit = table.Column<int>(type: "int", nullable: false),
                    RevisionType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    RevisionSettingsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaRevisionShares", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaRevisionShares_CogitaRevisions_RevisionId",
                        column: x => x.RevisionId,
                        principalTable: "CogitaRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FormQuestions",
                schema: "forms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FormId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(600)", maxLength: 600, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    OptionsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsRequired = table.Column<bool>(type: "bit", nullable: false),
                    ConditionQuestionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ConditionValue = table.Column<string>(type: "nvarchar(600)", maxLength: 600, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormQuestions_FormQuestions_ConditionQuestionId",
                        column: x => x.ConditionQuestionId,
                        principalSchema: "forms",
                        principalTable: "FormQuestions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FormQuestions_Forms_FormId",
                        column: x => x.FormId,
                        principalSchema: "forms",
                        principalTable: "Forms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FormResponses",
                schema: "forms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FormId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RespondentName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SubmittedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormResponses_Forms_FormId",
                        column: x => x.FormId,
                        principalSchema: "forms",
                        principalTable: "Forms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KeyEntryBindings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    KeyEntryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EntryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EntryType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    EntrySubtype = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KeyEntryBindings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KeyEntryBindings_Keys_KeyEntryId",
                        column: x => x.KeyEntryId,
                        principalTable: "Keys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LimanowaAnnouncements",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(220)", maxLength: 220, nullable: false),
                    Body = table.Column<string>(type: "nvarchar(3200)", maxLength: 3200, nullable: false),
                    AudienceType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    PublishedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaAnnouncements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LimanowaAnnouncements_LimanowaEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaEvents",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LimanowaGroups",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParishName = table.Column<string>(type: "nvarchar(220)", maxLength: 220, nullable: false),
                    ResponsibleName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    ExpectedParticipantCount = table.Column<int>(type: "int", nullable: false),
                    ExpectedGuardianCount = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2400)", maxLength: 2400, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LimanowaGroups_LimanowaEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaEvents",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LimanowaPolicyLinkConfigs",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PrivacyPolicyUrl = table.Column<string>(type: "nvarchar(520)", maxLength: 520, nullable: false),
                    EventRulesUrl = table.Column<string>(type: "nvarchar(520)", maxLength: 520, nullable: false),
                    ThingsToBringUrl = table.Column<string>(type: "nvarchar(520)", maxLength: 520, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaPolicyLinkConfigs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LimanowaPolicyLinkConfigs_LimanowaEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaEvents",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LimanowaQuestionThreads",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RelatedType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    RelatedId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaQuestionThreads", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LimanowaQuestionThreads_LimanowaEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaEvents",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LimanowaRegistrationStatusLogs",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RelatedType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    RelatedId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PreviousStatus = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    NewStatus = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ChangedByType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ChangedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaRegistrationStatusLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LimanowaRegistrationStatusLogs_LimanowaEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaEvents",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PilgrimageParticipantAccessTokens",
                schema: "pilgrimage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenHash = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: false),
                    ExpiresUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastUsedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PilgrimageParticipantAccessTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PilgrimageParticipantAccessTokens_PilgrimageEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "pilgrimage",
                        principalTable: "PilgrimageEvents",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PilgrimageParticipantAccessTokens_PilgrimageParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalSchema: "pilgrimage",
                        principalTable: "PilgrimageParticipants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CalendarEventGroups",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CalendarId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEventGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarEventGroups_Calendars_CalendarId",
                        column: x => x.CalendarId,
                        principalSchema: "calendar",
                        principalTable: "Calendars",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CalendarEventGroups_Roles_OwnerRoleId",
                        column: x => x.OwnerRoleId,
                        principalTable: "Roles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CogitaLibraries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaLibraries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaLibraries_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserAccounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LoginId = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    UserSalt = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    StoredH4 = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    State = table.Column<int>(type: "int", nullable: false),
                    FailedLoginCount = table.Column<int>(type: "int", nullable: false),
                    LockedUntilUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    MasterRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserAccounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserAccounts_Roles_MasterRoleId",
                        column: x => x.MasterRoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FormAnswers",
                schema: "forms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ResponseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TextValue = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    SelectedOptionsJson = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormAnswers_FormQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalSchema: "forms",
                        principalTable: "FormQuestions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FormAnswers_FormResponses_ResponseId",
                        column: x => x.ResponseId,
                        principalSchema: "forms",
                        principalTable: "FormResponses",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LimanowaGroupAdminAccesses",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenHash = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastOpenedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaGroupAdminAccesses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LimanowaGroupAdminAccesses_LimanowaEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaEvents",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_LimanowaGroupAdminAccesses_LimanowaGroups_GroupId",
                        column: x => x.GroupId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaGroups",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LimanowaParticipants",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ParishName = table.Column<string>(type: "nvarchar(220)", maxLength: 220, nullable: false),
                    ParentContactName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ParentContactPhone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    GuardianName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    GuardianPhone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2400)", maxLength: 2400, nullable: true),
                    HealthNotes = table.Column<string>(type: "nvarchar(2400)", maxLength: 2400, nullable: true),
                    AccommodationType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LimanowaParticipants_LimanowaEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaEvents",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_LimanowaParticipants_LimanowaGroups_GroupId",
                        column: x => x.GroupId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaGroups",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LimanowaQuestionMessages",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ThreadId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(2400)", maxLength: 2400, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaQuestionMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LimanowaQuestionMessages_LimanowaQuestionThreads_ThreadId",
                        column: x => x.ThreadId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaQuestionThreads",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CalendarEventGroupShareLinks",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventGroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SharedViewId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Mode = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    ExpiresUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastUsedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEventGroupShareLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarEventGroupShareLinks_CalendarEventGroups_EventGroupId",
                        column: x => x.EventGroupId,
                        principalSchema: "calendar",
                        principalTable: "CalendarEventGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CalendarEventGroupShareLinks_SharedViews_SharedViewId",
                        column: x => x.SharedViewId,
                        principalTable: "SharedViews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarEvents",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CalendarId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventGroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    OwnerRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TitlePublic = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SummaryPublic = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    LocationPublic = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    Visibility = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    ItemType = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    StartUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EndUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    AllDay = table.Column<bool>(type: "bit", nullable: false),
                    TimeZoneId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    RecurrenceType = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    RecurrenceInterval = table.Column<int>(type: "int", nullable: false),
                    RecurrenceByWeekday = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    RecurrenceUntilUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RecurrenceCount = table.Column<int>(type: "int", nullable: true),
                    RecurrenceRule = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    TaskState = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: true),
                    CompletedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    TaskProgressPercent = table.Column<int>(type: "int", nullable: true),
                    RequiresCompletionProof = table.Column<bool>(type: "bit", nullable: false),
                    CompletionProofDataItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AssigneeRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ProtectedDataItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LinkedModule = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LinkedEntityType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LinkedEntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SourceFieldStart = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    SourceFieldEnd = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ConflictScopeMode = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UpdatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CancelledUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarEvents_CalendarEventGroups_EventGroupId",
                        column: x => x.EventGroupId,
                        principalSchema: "calendar",
                        principalTable: "CalendarEventGroups",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CalendarEvents_Calendars_CalendarId",
                        column: x => x.CalendarId,
                        principalSchema: "calendar",
                        principalTable: "Calendars",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CalendarEvents_DataItems_CompletionProofDataItemId",
                        column: x => x.CompletionProofDataItemId,
                        principalTable: "DataItems",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CalendarEvents_Roles_AssigneeRoleId",
                        column: x => x.AssigneeRoleId,
                        principalTable: "Roles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CogitaConnections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConnectionType = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ConnectionTypeHash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaConnections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaConnections_CogitaLibraries_LibraryId",
                        column: x => x.LibraryId,
                        principalTable: "CogitaLibraries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaCreationProjects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    ContentJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaCreationProjects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaCreationProjects_CogitaLibraries_LibraryId",
                        column: x => x.LibraryId,
                        principalTable: "CogitaLibraries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaDependencyGraphs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaDependencyGraphs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaDependencyGraphs_CogitaLibraries_LibraryId",
                        column: x => x.LibraryId,
                        principalTable: "CogitaLibraries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGames",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    StoryboardProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Mode = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    SettingsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGames", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGames_CogitaLibraries_LibraryId",
                        column: x => x.LibraryId,
                        principalTable: "CogitaLibraries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaGames_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaInfos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InfoType = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaInfos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaInfos_CogitaLibraries_LibraryId",
                        column: x => x.LibraryId,
                        principalTable: "CogitaLibraries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaLiveRevisionSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RevisionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CollectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    HostRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PublicCodeHash = table.Column<byte[]>(type: "varbinary(900)", nullable: false),
                    HostSecretHash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    CurrentRoundIndex = table.Column<int>(type: "int", nullable: false),
                    RevealVersion = table.Column<int>(type: "int", nullable: false),
                    CurrentPromptJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CurrentRevealJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SessionMetaJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    StartedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    FinishedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaLiveRevisionSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaLiveRevisionSessions_CogitaLibraries_LibraryId",
                        column: x => x.LibraryId,
                        principalTable: "CogitaLibraries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaLiveRevisionSessions_CogitaRevisions_RevisionId",
                        column: x => x.RevisionId,
                        principalTable: "CogitaRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaReviewEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemType = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Direction = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaReviewEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaReviewEvents_CogitaLibraries_LibraryId",
                        column: x => x.LibraryId,
                        principalTable: "CogitaLibraries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaReviewOutcomes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemType = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CheckType = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Direction = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    RevisionType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EvalType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Correct = table.Column<bool>(type: "bit", nullable: false),
                    ClientId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ClientSequence = table.Column<long>(type: "bigint", nullable: false),
                    DurationMs = table.Column<int>(type: "int", nullable: true),
                    PayloadHash = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaReviewOutcomes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaReviewOutcomes_CogitaLibraries_LibraryId",
                        column: x => x.LibraryId,
                        principalTable: "CogitaLibraries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaStatisticEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ScopeType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ScopeId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SourceType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PersonRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ParticipantLabel = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    ItemType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CheckType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    Direction = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    EventType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RoundIndex = table.Column<int>(type: "int", nullable: true),
                    CardKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    IsCorrect = table.Column<bool>(type: "bit", nullable: true),
                    Correctness = table.Column<double>(type: "float", nullable: true),
                    PointsAwarded = table.Column<int>(type: "int", nullable: true),
                    DurationMs = table.Column<int>(type: "int", nullable: true),
                    IsPersistent = table.Column<bool>(type: "bit", nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaStatisticEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaStatisticEvents_CogitaLibraries_LibraryId",
                        column: x => x.LibraryId,
                        principalTable: "CogitaLibraries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LimanowaAccommodationAssignments",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaAccommodationAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LimanowaAccommodationAssignments_LimanowaParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaParticipants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LimanowaConsentRecords",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RulesAccepted = table.Column<bool>(type: "bit", nullable: false),
                    PrivacyAccepted = table.Column<bool>(type: "bit", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaConsentRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LimanowaConsentRecords_LimanowaParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaParticipants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LimanowaParticipantAccesses",
                schema: "limanowa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenHash = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastOpenedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LimanowaParticipantAccesses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LimanowaParticipantAccesses_LimanowaEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaEvents",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_LimanowaParticipantAccesses_LimanowaParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalSchema: "limanowa",
                        principalTable: "LimanowaParticipants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CalendarEventReminders",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MinutesBefore = table.Column<int>(type: "int", nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    ChannelConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TargetRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TargetUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEventReminders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarEventReminders_CalendarEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "calendar",
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarEventRoleScopes",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ScopeType = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    ViewerCanSeeTitle = table.Column<bool>(type: "bit", nullable: false),
                    ViewerCanSeeGraph = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEventRoleScopes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarEventRoleScopes_CalendarEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "calendar",
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarEventShareLinks",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CodeHash = table.Column<byte[]>(type: "varbinary(900)", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Mode = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    ExpiresUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastUsedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEventShareLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarEventShareLinks_CalendarEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "calendar",
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarScheduleGraphs",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    TemplateConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarScheduleGraphs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarScheduleGraphs_CalendarEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "calendar",
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarSharedViewLinks",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SharedViewId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Mode = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    ExpiresUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastUsedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarSharedViewLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarSharedViewLinks_CalendarEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "calendar",
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CalendarSharedViewLinks_SharedViews_SharedViewId",
                        column: x => x.SharedViewId,
                        principalTable: "SharedViews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaDependencyGraphEdges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GraphId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromNodeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ToNodeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaDependencyGraphEdges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaDependencyGraphEdges_CogitaDependencyGraphs_GraphId",
                        column: x => x.GraphId,
                        principalTable: "CogitaDependencyGraphs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaDependencyGraphNodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GraphId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NodeType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaDependencyGraphNodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaDependencyGraphNodes_CogitaDependencyGraphs_GraphId",
                        column: x => x.GraphId,
                        principalTable: "CogitaDependencyGraphs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaItemDependencies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GraphId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ParentItemType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ParentItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParentCheckType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ParentDirection = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ChildItemType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ChildItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChildCheckType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ChildDirection = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LinkHash = table.Column<byte[]>(type: "binary(32)", maxLength: 32, nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaItemDependencies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaItemDependencies_CogitaDependencyGraphs_GraphId",
                        column: x => x.GraphId,
                        principalTable: "CogitaDependencyGraphs",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameActionGraphs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GameId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    PublishedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameActionGraphs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameActionGraphs_CogitaGames_GameId",
                        column: x => x.GameId,
                        principalTable: "CogitaGames",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameLayouts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GameId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    LayoutJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameLayouts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameLayouts_CogitaGames_GameId",
                        column: x => x.GameId,
                        principalTable: "CogitaGames",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GameId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    HostRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PublicCodeHash = table.Column<byte[]>(type: "varbinary(64)", maxLength: 64, nullable: false),
                    HostSecretHash = table.Column<byte[]>(type: "varbinary(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    Phase = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    RoundIndex = table.Column<int>(type: "int", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    SessionMetaJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    StartedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    FinishedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameSessions_CogitaGames_GameId",
                        column: x => x.GameId,
                        principalTable: "CogitaGames",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaGameSessions_CogitaLibraries_LibraryId",
                        column: x => x.LibraryId,
                        principalTable: "CogitaLibraries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaGameSessions_Roles_HostRoleId",
                        column: x => x.HostRoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameValues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GameId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ValueKey = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    ScopeType = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    Visibility = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    DataType = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    DefaultValueJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ConstraintsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsScore = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameValues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameValues_CogitaGames_GameId",
                        column: x => x.GameId,
                        principalTable: "CogitaGames",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaAddresses",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaAddresses", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaAddresses_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaCollectionDependencies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParentCollectionInfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChildCollectionInfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaCollectionDependencies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaCollectionDependencies_CogitaInfos_ChildCollectionInfoId",
                        column: x => x.ChildCollectionInfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaCollectionDependencies_CogitaInfos_ParentCollectionInfoId",
                        column: x => x.ParentCollectionInfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaCollectionGraphs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CollectionInfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaCollectionGraphs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaCollectionGraphs_CogitaInfos_CollectionInfoId",
                        column: x => x.CollectionInfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaCollectionItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CollectionInfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemType = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaCollectionItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaCollectionItems_CogitaInfos_CollectionInfoId",
                        column: x => x.CollectionInfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaCollections",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaCollections", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaCollections_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaCollectives",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaCollectives", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaCollectives_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaComputedInfos",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaComputedInfos", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaComputedInfos_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaConnectionItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConnectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaConnectionItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaConnectionItems_CogitaConnections_ConnectionId",
                        column: x => x.ConnectionId,
                        principalTable: "CogitaConnections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaConnectionItems_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaEmails",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaEmails", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaEmails_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGeoFeatures",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGeoFeatures", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaGeoFeatures_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaInstitutions",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaInstitutions", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaInstitutions_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaLanguages",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaLanguages", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaLanguages_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaMedia",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaMedia", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaMedia_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaMusicFragments",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaMusicFragments", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaMusicFragments_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaMusicPieces",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaMusicPieces", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaMusicPieces_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaOrcids",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaOrcids", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaOrcids_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaPersons",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaPersons", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaPersons_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaPhones",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaPhones", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaPhones_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaQuestions",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaQuestions", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaQuestions_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaQuotes",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaQuotes", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaQuotes_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaSentences",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaSentences", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaSentences_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaSources",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaSources", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaSources_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaTopics",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaTopics", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaTopics_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaWordLanguages",
                columns: table => new
                {
                    LanguageInfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WordInfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaWordLanguages", x => new { x.LanguageInfoId, x.WordInfoId });
                    table.ForeignKey(
                        name: "FK_CogitaWordLanguages_CogitaInfos_LanguageInfoId",
                        column: x => x.LanguageInfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaWordLanguages_CogitaInfos_WordInfoId",
                        column: x => x.WordInfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaWords",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaWords", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaWords_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaWorks",
                columns: table => new
                {
                    InfoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaWorks", x => x.InfoId);
                    table.ForeignKey(
                        name: "FK_CogitaWorks_CogitaInfos_InfoId",
                        column: x => x.InfoId,
                        principalTable: "CogitaInfos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaLiveRevisionParticipants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    DisplayNameHash = table.Column<byte[]>(type: "varbinary(900)", nullable: true),
                    DisplayNameCipher = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    GroupName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    JoinTokenHash = table.Column<byte[]>(type: "varbinary(900)", nullable: false),
                    Score = table.Column<int>(type: "int", nullable: false),
                    IsConnected = table.Column<bool>(type: "bit", nullable: false),
                    JoinedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaLiveRevisionParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaLiveRevisionParticipants_CogitaLiveRevisionSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaLiveRevisionSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaLiveRevisionReloginRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    DisplayNameHash = table.Column<byte[]>(type: "varbinary(900)", nullable: true),
                    DisplayNameCipher = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    GroupName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    RequestedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ApprovedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaLiveRevisionReloginRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaLiveRevisionReloginRequests_CogitaLiveRevisionSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaLiveRevisionSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarReminderDispatches",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReminderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OccurrenceStartUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    AttemptCount = table.Column<int>(type: "int", nullable: false),
                    NextRetryUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastAttemptUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DeliveredUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    DeliveryPayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarReminderDispatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarReminderDispatches_CalendarEventReminders_ReminderId",
                        column: x => x.ReminderId,
                        principalSchema: "calendar",
                        principalTable: "CalendarEventReminders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CalendarReminderDispatches_CalendarEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "calendar",
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarEventGraphLinks",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GraphId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RevokedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEventGraphLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarEventGraphLinks_CalendarEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "calendar",
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CalendarEventGraphLinks_CalendarScheduleGraphs_GraphId",
                        column: x => x.GraphId,
                        principalSchema: "calendar",
                        principalTable: "CalendarScheduleGraphs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarGraphExecutions",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GraphId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    TriggerType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    TriggerPayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ResultPayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    StartedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    FinishedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarGraphExecutions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarGraphExecutions_CalendarEvents_EventId",
                        column: x => x.EventId,
                        principalSchema: "calendar",
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CalendarGraphExecutions_CalendarScheduleGraphs_GraphId",
                        column: x => x.GraphId,
                        principalSchema: "calendar",
                        principalTable: "CalendarScheduleGraphs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarScheduleGraphEdges",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GraphId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromNodeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromPort = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ToNodeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ToPort = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    EdgeType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ConditionJson = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarScheduleGraphEdges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarScheduleGraphEdges_CalendarScheduleGraphs_GraphId",
                        column: x => x.GraphId,
                        principalSchema: "calendar",
                        principalTable: "CalendarScheduleGraphs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarScheduleGraphNodes",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GraphId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NodeType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    NodeKey = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PositionX = table.Column<decimal>(type: "decimal(9,2)", nullable: false),
                    PositionY = table.Column<decimal>(type: "decimal(9,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarScheduleGraphNodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarScheduleGraphNodes_CalendarScheduleGraphs_GraphId",
                        column: x => x.GraphId,
                        principalSchema: "calendar",
                        principalTable: "CalendarScheduleGraphs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameActionEdges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GraphId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromNodeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromPort = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ToNodeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ToPort = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameActionEdges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameActionEdges_CogitaGameActionGraphs_GraphId",
                        column: x => x.GraphId,
                        principalTable: "CogitaGameActionGraphs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameActionNodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GraphId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NodeType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PositionX = table.Column<decimal>(type: "decimal(9,2)", nullable: false),
                    PositionY = table.Column<decimal>(type: "decimal(9,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameActionNodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameActionNodes_CogitaGameActionGraphs_GraphId",
                        column: x => x.GraphId,
                        principalTable: "CogitaGameActionGraphs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameSessionGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupKey = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    DisplayNameCipher = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameSessionGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameSessionGroups_CogitaGameSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaGameSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameTriggerStates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TriggerKey = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ScopeType = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    ScopeId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    FiredCount = table.Column<int>(type: "int", nullable: false),
                    CooldownUntilUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastEvaluatedSeq = table.Column<long>(type: "bigint", nullable: false),
                    LastFiredUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameTriggerStates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameTriggerStates_CogitaGameSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaGameSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameZones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ZoneKey = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    SourceType = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    GeometryJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TriggerRadiusM = table.Column<decimal>(type: "decimal(9,2)", nullable: false),
                    ActiveFromUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ActiveToUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameZones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameZones_CogitaGameSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaGameSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaCollectionGraphEdges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GraphId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromNodeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromPort = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ToNodeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ToPort = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaCollectionGraphEdges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaCollectionGraphEdges_CogitaCollectionGraphs_GraphId",
                        column: x => x.GraphId,
                        principalTable: "CogitaCollectionGraphs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaCollectionGraphNodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GraphId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NodeType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DataKeyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EncryptedBlob = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaCollectionGraphNodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaCollectionGraphNodes_CogitaCollectionGraphs_GraphId",
                        column: x => x.GraphId,
                        principalTable: "CogitaCollectionGraphs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaLiveRevisionAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoundIndex = table.Column<int>(type: "int", nullable: false),
                    CardKey = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AnswerJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsCorrect = table.Column<bool>(type: "bit", nullable: true),
                    SubmittedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaLiveRevisionAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaLiveRevisionAnswers_CogitaLiveRevisionParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "CogitaLiveRevisionParticipants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaLiveRevisionAnswers_CogitaLiveRevisionSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaLiveRevisionSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameParticipants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RoleType = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    PersonRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DisplayName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    DisplayNameHash = table.Column<byte[]>(type: "varbinary(64)", maxLength: 64, nullable: true),
                    DisplayNameCipher = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ParticipantTokenHash = table.Column<byte[]>(type: "varbinary(64)", maxLength: 64, nullable: false),
                    DeviceHash = table.Column<byte[]>(type: "varbinary(64)", maxLength: 64, nullable: true),
                    SpoofRiskScore = table.Column<decimal>(type: "decimal(7,2)", nullable: false),
                    LastLocationMetaJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsConnected = table.Column<bool>(type: "bit", nullable: false),
                    JoinedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastSeenUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameParticipants_CogitaGameSessionGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "CogitaGameSessionGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CogitaGameParticipants_CogitaGameSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaGameSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameEventLog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SeqNo = table.Column<long>(type: "bigint", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CorrelationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CausationId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ActorParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameEventLog", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameEventLog_CogitaGameParticipants_ActorParticipantId",
                        column: x => x.ActorParticipantId,
                        principalTable: "CogitaGameParticipants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CogitaGameEventLog_CogitaGameSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaGameSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameLocationAudit",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GeoHash6 = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    AccuracyBucket = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    SpeedBucket = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameLocationAudit", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameLocationAudit_CogitaGameParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "CogitaGameParticipants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaGameLocationAudit_CogitaGameSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaGameSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGamePresenceStates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ZoneId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PresenceState = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    EnteredUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ExitedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastPingUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Confidence = table.Column<decimal>(type: "decimal(7,4)", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGamePresenceStates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGamePresenceStates_CogitaGameParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "CogitaGameParticipants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaGamePresenceStates_CogitaGameSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaGameSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaGamePresenceStates_CogitaGameZones_ZoneId",
                        column: x => x.ZoneId,
                        principalTable: "CogitaGameZones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameScoreboard",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ParticipantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Score = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Rank = table.Column<int>(type: "int", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    UpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameScoreboard", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameScoreboard_CogitaGameParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "CogitaGameParticipants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CogitaGameScoreboard_CogitaGameSessionGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "CogitaGameSessionGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CogitaGameScoreboard_CogitaGameSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaGameSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CogitaGameValueLedger",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ValueId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ScopeType = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    ScopeId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Delta = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    AbsoluteAfter = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    ReasonEventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CogitaGameValueLedger", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CogitaGameValueLedger_CogitaGameEventLog_ReasonEventId",
                        column: x => x.ReasonEventId,
                        principalTable: "CogitaGameEventLog",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CogitaGameValueLedger_CogitaGameSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CogitaGameSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CogitaGameValueLedger_CogitaGameValues_ValueId",
                        column: x => x.ValueId,
                        principalTable: "CogitaGameValues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventGraphLinks_EventId_GraphId",
                schema: "calendar",
                table: "CalendarEventGraphLinks",
                columns: new[] { "EventId", "GraphId" },
                unique: true,
                filter: "[RevokedUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventGraphLinks_EventId_RevokedUtc",
                schema: "calendar",
                table: "CalendarEventGraphLinks",
                columns: new[] { "EventId", "RevokedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventGraphLinks_GraphId_RevokedUtc",
                schema: "calendar",
                table: "CalendarEventGraphLinks",
                columns: new[] { "GraphId", "RevokedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventGroups_CalendarId_IsArchived_UpdatedUtc",
                schema: "calendar",
                table: "CalendarEventGroups",
                columns: new[] { "CalendarId", "IsArchived", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventGroups_CalendarId_UpdatedUtc",
                schema: "calendar",
                table: "CalendarEventGroups",
                columns: new[] { "CalendarId", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventGroups_OwnerRoleId",
                schema: "calendar",
                table: "CalendarEventGroups",
                column: "OwnerRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventGroupShareLinks_EventGroupId_IsActive_RevokedUtc_ExpiresUtc",
                schema: "calendar",
                table: "CalendarEventGroupShareLinks",
                columns: new[] { "EventGroupId", "IsActive", "RevokedUtc", "ExpiresUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventGroupShareLinks_SharedViewId",
                schema: "calendar",
                table: "CalendarEventGroupShareLinks",
                column: "SharedViewId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventReminders_Channel_Status_UpdatedUtc",
                schema: "calendar",
                table: "CalendarEventReminders",
                columns: new[] { "Channel", "Status", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventReminders_EventId_Status",
                schema: "calendar",
                table: "CalendarEventReminders",
                columns: new[] { "EventId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventRoleScopes_EventId_RevokedUtc",
                schema: "calendar",
                table: "CalendarEventRoleScopes",
                columns: new[] { "EventId", "RevokedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventRoleScopes_EventId_RoleId",
                schema: "calendar",
                table: "CalendarEventRoleScopes",
                columns: new[] { "EventId", "RoleId" },
                unique: true,
                filter: "[RevokedUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventRoleScopes_RoleId_RevokedUtc",
                schema: "calendar",
                table: "CalendarEventRoleScopes",
                columns: new[] { "RoleId", "RevokedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_AssigneeRoleId",
                schema: "calendar",
                table: "CalendarEvents",
                column: "AssigneeRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_CalendarId_ItemType_StartUtc",
                schema: "calendar",
                table: "CalendarEvents",
                columns: new[] { "CalendarId", "ItemType", "StartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_CalendarId_ItemType_TaskState_CompletedUtc",
                schema: "calendar",
                table: "CalendarEvents",
                columns: new[] { "CalendarId", "ItemType", "TaskState", "CompletedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_CalendarId_ItemType_TaskState_StartUtc",
                schema: "calendar",
                table: "CalendarEvents",
                columns: new[] { "CalendarId", "ItemType", "TaskState", "StartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_CalendarId_LinkedModule_LinkedEntityType_LinkedEntityId",
                schema: "calendar",
                table: "CalendarEvents",
                columns: new[] { "CalendarId", "LinkedModule", "LinkedEntityType", "LinkedEntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_CalendarId_StartUtc",
                schema: "calendar",
                table: "CalendarEvents",
                columns: new[] { "CalendarId", "StartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_CalendarId_Status_StartUtc",
                schema: "calendar",
                table: "CalendarEvents",
                columns: new[] { "CalendarId", "Status", "StartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_CompletionProofDataItemId",
                schema: "calendar",
                table: "CalendarEvents",
                column: "CompletionProofDataItemId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_EventGroupId_StartUtc",
                schema: "calendar",
                table: "CalendarEvents",
                columns: new[] { "EventGroupId", "StartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventShareLinks_CodeHash",
                schema: "calendar",
                table: "CalendarEventShareLinks",
                column: "CodeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventShareLinks_EventId_IsActive_RevokedUtc_ExpiresUtc",
                schema: "calendar",
                table: "CalendarEventShareLinks",
                columns: new[] { "EventId", "IsActive", "RevokedUtc", "ExpiresUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarGraphExecutions_EventId",
                schema: "calendar",
                table: "CalendarGraphExecutions",
                column: "EventId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarGraphExecutions_GraphId_CreatedUtc",
                schema: "calendar",
                table: "CalendarGraphExecutions",
                columns: new[] { "GraphId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarGraphExecutions_GraphId_IdempotencyKey",
                schema: "calendar",
                table: "CalendarGraphExecutions",
                columns: new[] { "GraphId", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CalendarReminderDispatches_EventId",
                schema: "calendar",
                table: "CalendarReminderDispatches",
                column: "EventId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarReminderDispatches_ReminderId_OccurrenceStartUtc",
                schema: "calendar",
                table: "CalendarReminderDispatches",
                columns: new[] { "ReminderId", "OccurrenceStartUtc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CalendarReminderDispatches_Status_NextRetryUtc_UpdatedUtc",
                schema: "calendar",
                table: "CalendarReminderDispatches",
                columns: new[] { "Status", "NextRetryUtc", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarRoleBindings_CalendarId_RevokedUtc",
                schema: "calendar",
                table: "CalendarRoleBindings",
                columns: new[] { "CalendarId", "RevokedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarRoleBindings_CalendarId_RoleId",
                schema: "calendar",
                table: "CalendarRoleBindings",
                columns: new[] { "CalendarId", "RoleId" },
                unique: true,
                filter: "[RevokedUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarRoleBindings_RoleId_RevokedUtc",
                schema: "calendar",
                table: "CalendarRoleBindings",
                columns: new[] { "RoleId", "RevokedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Calendars_OrganizationScope_UpdatedUtc",
                schema: "calendar",
                table: "Calendars",
                columns: new[] { "OrganizationScope", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Calendars_Slug",
                schema: "calendar",
                table: "Calendars",
                column: "Slug",
                unique: true,
                filter: "[Slug] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Calendars_UpdatedUtc",
                schema: "calendar",
                table: "Calendars",
                column: "UpdatedUtc");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarScheduleGraphEdges_GraphId",
                schema: "calendar",
                table: "CalendarScheduleGraphEdges",
                column: "GraphId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarScheduleGraphEdges_GraphId_FromNodeId_ToNodeId",
                schema: "calendar",
                table: "CalendarScheduleGraphEdges",
                columns: new[] { "GraphId", "FromNodeId", "ToNodeId" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarScheduleGraphNodes_GraphId_NodeKey",
                schema: "calendar",
                table: "CalendarScheduleGraphNodes",
                columns: new[] { "GraphId", "NodeKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CalendarScheduleGraphs_EventId_Status",
                schema: "calendar",
                table: "CalendarScheduleGraphs",
                columns: new[] { "EventId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarScheduleGraphs_EventId_Version",
                schema: "calendar",
                table: "CalendarScheduleGraphs",
                columns: new[] { "EventId", "Version" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarSharedViewLinks_EventId_IsActive_RevokedUtc_ExpiresUtc",
                schema: "calendar",
                table: "CalendarSharedViewLinks",
                columns: new[] { "EventId", "IsActive", "RevokedUtc", "ExpiresUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarSharedViewLinks_SharedViewId",
                schema: "calendar",
                table: "CalendarSharedViewLinks",
                column: "SharedViewId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CgEntities_LibraryId",
                table: "CgEntities",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_CgEntities_TypeDefId",
                table: "CgEntities",
                column: "TypeDefId");

            migrationBuilder.CreateIndex(
                name: "IX_CgFieldDefs_TypeDefId",
                table: "CgFieldDefs",
                column: "TypeDefId");

            migrationBuilder.CreateIndex(
                name: "IX_CgFieldDefTargets_FieldDefId",
                table: "CgFieldDefTargets",
                column: "FieldDefId");

            migrationBuilder.CreateIndex(
                name: "IX_CgFieldDefTargets_TargetTypeDefId",
                table: "CgFieldDefTargets",
                column: "TargetTypeDefId");

            migrationBuilder.CreateIndex(
                name: "IX_CgFieldValues_EntityId",
                table: "CgFieldValues",
                column: "EntityId");

            migrationBuilder.CreateIndex(
                name: "IX_CgFieldValues_RefEntityId",
                table: "CgFieldValues",
                column: "RefEntityId",
                filter: "[RefEntityId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CgLibraries_OwnerAccountId",
                table: "CgLibraries",
                column: "OwnerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_CgTemplateEdges_GraphId",
                table: "CgTemplateEdges",
                column: "GraphId");

            migrationBuilder.CreateIndex(
                name: "IX_CgTemplateGraphs_TypeDefId",
                table: "CgTemplateGraphs",
                column: "TypeDefId");

            migrationBuilder.CreateIndex(
                name: "IX_CgTemplateNodes_GraphId",
                table: "CgTemplateNodes",
                column: "GraphId");

            migrationBuilder.CreateIndex(
                name: "IX_CgTemplateNodes_GraphId_NodeKey",
                table: "CgTemplateNodes",
                columns: new[] { "GraphId", "NodeKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CgTypeDefs_LibraryId",
                table: "CgTypeDefs",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_CgTypeDefs_LibraryId_Name",
                table: "CgTypeDefs",
                columns: new[] { "LibraryId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversationKeyVersions_ConversationId_Version",
                schema: "chat",
                table: "ChatConversationKeyVersions",
                columns: new[] { "ConversationId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversationParticipants_ConversationId_RemovedUtc",
                schema: "chat",
                table: "ChatConversationParticipants",
                columns: new[] { "ConversationId", "RemovedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversationParticipants_ConversationId_SubjectType_SubjectId_RemovedUtc",
                schema: "chat",
                table: "ChatConversationParticipants",
                columns: new[] { "ConversationId", "SubjectType", "SubjectId", "RemovedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversationReadStates_ConversationId_UserId",
                schema: "chat",
                table: "ChatConversationReadStates",
                columns: new[] { "ConversationId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversations_PublicCodeHash",
                schema: "chat",
                table: "ChatConversations",
                column: "PublicCodeHash",
                filter: "[PublicCodeHash] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversations_ScopeType_ScopeId_UpdatedUtc",
                schema: "chat",
                table: "ChatConversations",
                columns: new[] { "ScopeType", "ScopeId", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversations_UpdatedUtc",
                schema: "chat",
                table: "ChatConversations",
                column: "UpdatedUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_ConversationId_CreatedUtc",
                schema: "chat",
                table: "ChatMessages",
                columns: new[] { "ConversationId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_ConversationId_Sequence",
                schema: "chat",
                table: "ChatMessages",
                columns: new[] { "ConversationId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_ConversationId_Visibility_Sequence",
                schema: "chat",
                table: "ChatMessages",
                columns: new[] { "ConversationId", "Visibility", "Sequence" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatPublicLinks_CodeHash",
                schema: "chat",
                table: "ChatPublicLinks",
                column: "CodeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatPublicLinks_ConversationId_IsActive_RevokedUtc_ExpiresUtc",
                schema: "chat",
                table: "ChatPublicLinks",
                columns: new[] { "ConversationId", "IsActive", "RevokedUtc", "ExpiresUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCheckcardDefinitions_LibraryId_CardKey",
                table: "CogitaCheckcardDefinitions",
                columns: new[] { "LibraryId", "CardKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCheckcardDefinitions_SourceItemId_UpdatedUtc",
                table: "CogitaCheckcardDefinitions",
                columns: new[] { "SourceItemId", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCollectionDependencies_ChildCollectionInfoId",
                table: "CogitaCollectionDependencies",
                column: "ChildCollectionInfoId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCollectionDependencies_ParentCollectionInfoId_ChildCollectionInfoId",
                table: "CogitaCollectionDependencies",
                columns: new[] { "ParentCollectionInfoId", "ChildCollectionInfoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCollectionGraphEdges_GraphId",
                table: "CogitaCollectionGraphEdges",
                column: "GraphId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCollectionGraphNodes_GraphId",
                table: "CogitaCollectionGraphNodes",
                column: "GraphId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCollectionGraphs_CollectionInfoId",
                table: "CogitaCollectionGraphs",
                column: "CollectionInfoId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCollectionItems_CollectionInfoId_ItemType_ItemId",
                table: "CogitaCollectionItems",
                columns: new[] { "CollectionInfoId", "ItemType", "ItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCollectionItems_CollectionInfoId_SortOrder",
                table: "CogitaCollectionItems",
                columns: new[] { "CollectionInfoId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaConnectionItems_ConnectionId_InfoId",
                table: "CogitaConnectionItems",
                columns: new[] { "ConnectionId", "InfoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaConnectionItems_InfoId",
                table: "CogitaConnectionItems",
                column: "InfoId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaConnections_LibraryId_ConnectionType_CreatedUtc_Id",
                table: "CogitaConnections",
                columns: new[] { "LibraryId", "ConnectionType", "CreatedUtc", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCreationArtifacts_LibraryId_ProjectId_UpdatedUtc",
                table: "CogitaCreationArtifacts",
                columns: new[] { "LibraryId", "ProjectId", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCreationArtifacts_LibraryId_SourceItemId_UpdatedUtc",
                table: "CogitaCreationArtifacts",
                columns: new[] { "LibraryId", "SourceItemId", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCreationProjects_LibraryId_ProjectType_Name",
                table: "CogitaCreationProjects",
                columns: new[] { "LibraryId", "ProjectType", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaCreationProjects_LibraryId_ProjectType_UpdatedUtc_Id",
                table: "CogitaCreationProjects",
                columns: new[] { "LibraryId", "ProjectType", "UpdatedUtc", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaDashboardPreferences_UpdatedUtc",
                table: "CogitaDashboardPreferences",
                column: "UpdatedUtc");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaDashboardPreferences_UserId",
                table: "CogitaDashboardPreferences",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaDependencyEdges_ChildCardId_ParentCardId",
                table: "CogitaDependencyEdges",
                columns: new[] { "ChildCardId", "ParentCardId" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaDependencyEdges_ParentCardId_ChildCardId",
                table: "CogitaDependencyEdges",
                columns: new[] { "ParentCardId", "ChildCardId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaDependencyGraphEdges_GraphId",
                table: "CogitaDependencyGraphEdges",
                column: "GraphId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaDependencyGraphNodes_GraphId",
                table: "CogitaDependencyGraphNodes",
                column: "GraphId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaDependencyGraphs_LibraryId",
                table: "CogitaDependencyGraphs",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaEntitySearchDocuments_LibraryId_EntityType_TitleNormalized",
                table: "CogitaEntitySearchDocuments",
                columns: new[] { "LibraryId", "EntityType", "TitleNormalized" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaEntitySearchDocuments_LibraryId_SourceKind_SourceId",
                table: "CogitaEntitySearchDocuments",
                columns: new[] { "LibraryId", "SourceKind", "SourceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaEntitySearchDocuments_LibraryId_SourceUpdatedUtc",
                table: "CogitaEntitySearchDocuments",
                columns: new[] { "LibraryId", "SourceUpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameActionEdges_GraphId",
                table: "CogitaGameActionEdges",
                column: "GraphId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameActionGraphs_GameId_Status_Version",
                table: "CogitaGameActionGraphs",
                columns: new[] { "GameId", "Status", "Version" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameActionGraphs_GameId_Version",
                table: "CogitaGameActionGraphs",
                columns: new[] { "GameId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameActionNodes_GraphId",
                table: "CogitaGameActionNodes",
                column: "GraphId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameEventLog_ActorParticipantId",
                table: "CogitaGameEventLog",
                column: "ActorParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameEventLog_SessionId_CreatedUtc",
                table: "CogitaGameEventLog",
                columns: new[] { "SessionId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameEventLog_SessionId_SeqNo",
                table: "CogitaGameEventLog",
                columns: new[] { "SessionId", "SeqNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameLayouts_GameId_RoleType",
                table: "CogitaGameLayouts",
                columns: new[] { "GameId", "RoleType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameLocationAudit_ParticipantId",
                table: "CogitaGameLocationAudit",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameLocationAudit_SessionId_ParticipantId_CreatedUtc",
                table: "CogitaGameLocationAudit",
                columns: new[] { "SessionId", "ParticipantId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameParticipants_GroupId",
                table: "CogitaGameParticipants",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameParticipants_SessionId_DisplayNameHash",
                table: "CogitaGameParticipants",
                columns: new[] { "SessionId", "DisplayNameHash" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameParticipants_SessionId_ParticipantTokenHash",
                table: "CogitaGameParticipants",
                columns: new[] { "SessionId", "ParticipantTokenHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGamePresenceStates_ParticipantId",
                table: "CogitaGamePresenceStates",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGamePresenceStates_SessionId_ParticipantId_ZoneId",
                table: "CogitaGamePresenceStates",
                columns: new[] { "SessionId", "ParticipantId", "ZoneId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGamePresenceStates_SessionId_ZoneId_PresenceState_EnteredUtc",
                table: "CogitaGamePresenceStates",
                columns: new[] { "SessionId", "ZoneId", "PresenceState", "EnteredUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGamePresenceStates_ZoneId",
                table: "CogitaGamePresenceStates",
                column: "ZoneId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGames_LibraryId_UpdatedUtc",
                table: "CogitaGames",
                columns: new[] { "LibraryId", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGames_RoleId",
                table: "CogitaGames",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameScoreboard_GroupId",
                table: "CogitaGameScoreboard",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameScoreboard_ParticipantId",
                table: "CogitaGameScoreboard",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameScoreboard_SessionId_GroupId_ParticipantId",
                table: "CogitaGameScoreboard",
                columns: new[] { "SessionId", "GroupId", "ParticipantId" },
                unique: true,
                filter: "[GroupId] IS NOT NULL AND [ParticipantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameScoreboard_SessionId_Rank",
                table: "CogitaGameScoreboard",
                columns: new[] { "SessionId", "Rank" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameSessionGroups_SessionId_GroupKey",
                table: "CogitaGameSessionGroups",
                columns: new[] { "SessionId", "GroupKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameSessions_GameId",
                table: "CogitaGameSessions",
                column: "GameId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameSessions_HostRoleId",
                table: "CogitaGameSessions",
                column: "HostRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameSessions_LibraryId_CreatedUtc",
                table: "CogitaGameSessions",
                columns: new[] { "LibraryId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameSessions_PublicCodeHash",
                table: "CogitaGameSessions",
                column: "PublicCodeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameTriggerStates_SessionId_TriggerKey_ScopeType",
                table: "CogitaGameTriggerStates",
                columns: new[] { "SessionId", "TriggerKey", "ScopeType" },
                unique: true,
                filter: "[ScopeId] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameTriggerStates_SessionId_TriggerKey_ScopeType_ScopeId",
                table: "CogitaGameTriggerStates",
                columns: new[] { "SessionId", "TriggerKey", "ScopeType", "ScopeId" },
                unique: true,
                filter: "[ScopeId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameValueLedger_ReasonEventId",
                table: "CogitaGameValueLedger",
                column: "ReasonEventId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameValueLedger_SessionId_ValueId_ScopeType_ScopeId_CreatedUtc",
                table: "CogitaGameValueLedger",
                columns: new[] { "SessionId", "ValueId", "ScopeType", "ScopeId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameValueLedger_ValueId",
                table: "CogitaGameValueLedger",
                column: "ValueId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameValues_GameId_ValueKey",
                table: "CogitaGameValues",
                columns: new[] { "GameId", "ValueKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaGameZones_SessionId_ZoneKey",
                table: "CogitaGameZones",
                columns: new[] { "SessionId", "ZoneKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaInfoLinkMultis_LibraryId_FieldKey_TargetInfoId",
                table: "CogitaInfoLinkMultis",
                columns: new[] { "LibraryId", "FieldKey", "TargetInfoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaInfoLinkMultis_LibraryId_InfoId_FieldKey_TargetInfoId",
                table: "CogitaInfoLinkMultis",
                columns: new[] { "LibraryId", "InfoId", "FieldKey", "TargetInfoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaInfoLinkMultis_LibraryId_InfoId_SortOrder",
                table: "CogitaInfoLinkMultis",
                columns: new[] { "LibraryId", "InfoId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaInfoLinkSingles_LibraryId_FieldKey_TargetInfoId",
                table: "CogitaInfoLinkSingles",
                columns: new[] { "LibraryId", "FieldKey", "TargetInfoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaInfoLinkSingles_LibraryId_InfoId_FieldKey",
                table: "CogitaInfoLinkSingles",
                columns: new[] { "LibraryId", "InfoId", "FieldKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaInfos_LibraryId_InfoType",
                table: "CogitaInfos",
                columns: new[] { "LibraryId", "InfoType" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaInfos_LibraryId_InfoType_CreatedUtc_Id",
                table: "CogitaInfos",
                columns: new[] { "LibraryId", "InfoType", "CreatedUtc", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaInfoSearchIndexes_LibraryId_InfoId",
                table: "CogitaInfoSearchIndexes",
                columns: new[] { "LibraryId", "InfoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaInfoSearchIndexes_LibraryId_InfoType_LabelNormalized",
                table: "CogitaInfoSearchIndexes",
                columns: new[] { "LibraryId", "InfoType", "LabelNormalized" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaItemDependencies_GraphId",
                table: "CogitaItemDependencies",
                column: "GraphId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaItemDependencies_LibraryId_GraphId_ChildItemType_ChildItemId_ChildCheckType_ChildDirection",
                table: "CogitaItemDependencies",
                columns: new[] { "LibraryId", "GraphId", "ChildItemType", "ChildItemId", "ChildCheckType", "ChildDirection" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaItemDependencies_LibraryId_GraphId_LinkHash",
                table: "CogitaItemDependencies",
                columns: new[] { "LibraryId", "GraphId", "LinkHash" },
                unique: true,
                filter: "[GraphId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaKnowledgeLinkMultis_SourceItemId_FieldKey_SortOrder",
                table: "CogitaKnowledgeLinkMultis",
                columns: new[] { "SourceItemId", "FieldKey", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaKnowledgeLinkMultis_SourceItemId_FieldKey_TargetItemId",
                table: "CogitaKnowledgeLinkMultis",
                columns: new[] { "SourceItemId", "FieldKey", "TargetItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaKnowledgeLinkSingles_SourceItemId_FieldKey",
                table: "CogitaKnowledgeLinkSingles",
                columns: new[] { "SourceItemId", "FieldKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaKnowledgeTypeSpecs_LibraryId_TypeKey_Version",
                table: "CogitaKnowledgeTypeSpecs",
                columns: new[] { "LibraryId", "TypeKey", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaKnownessSnapshots_LibraryId_PersonRoleId_CardKey_SnapshotUtc",
                table: "CogitaKnownessSnapshots",
                columns: new[] { "LibraryId", "PersonRoleId", "CardKey", "SnapshotUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLibraries_RoleId",
                table: "CogitaLibraries",
                column: "RoleId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLiveRevisionAnswers_ParticipantId",
                table: "CogitaLiveRevisionAnswers",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLiveRevisionAnswers_SessionId_ParticipantId_RoundIndex",
                table: "CogitaLiveRevisionAnswers",
                columns: new[] { "SessionId", "ParticipantId", "RoundIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLiveRevisionAnswers_SessionId_RoundIndex",
                table: "CogitaLiveRevisionAnswers",
                columns: new[] { "SessionId", "RoundIndex" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLiveRevisionParticipants_JoinTokenHash",
                table: "CogitaLiveRevisionParticipants",
                column: "JoinTokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLiveRevisionParticipants_SessionId_DisplayName_GroupName",
                table: "CogitaLiveRevisionParticipants",
                columns: new[] { "SessionId", "DisplayName", "GroupName" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLiveRevisionParticipants_SessionId_DisplayNameHash_GroupName",
                table: "CogitaLiveRevisionParticipants",
                columns: new[] { "SessionId", "DisplayNameHash", "GroupName" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLiveRevisionReloginRequests_SessionId_DisplayName_GroupName_Status",
                table: "CogitaLiveRevisionReloginRequests",
                columns: new[] { "SessionId", "DisplayName", "GroupName", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLiveRevisionReloginRequests_SessionId_DisplayNameHash_GroupName_Status",
                table: "CogitaLiveRevisionReloginRequests",
                columns: new[] { "SessionId", "DisplayNameHash", "GroupName", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLiveRevisionSessions_LibraryId_RevisionId",
                table: "CogitaLiveRevisionSessions",
                columns: new[] { "LibraryId", "RevisionId" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLiveRevisionSessions_PublicCodeHash",
                table: "CogitaLiveRevisionSessions",
                column: "PublicCodeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaLiveRevisionSessions_RevisionId",
                table: "CogitaLiveRevisionSessions",
                column: "RevisionId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaNotions_LibraryId_TypeKey_UpdatedUtc",
                table: "CogitaNotions",
                columns: new[] { "LibraryId", "TypeKey", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaNotions_LibraryId_UpdatedUtc",
                table: "CogitaNotions",
                columns: new[] { "LibraryId", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaReferenceCryptoFields_LibraryId_FieldKey_DeterministicHash",
                table: "CogitaReferenceCryptoFields",
                columns: new[] { "LibraryId", "FieldKey", "DeterministicHash" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaReferenceCryptoFields_LibraryId_OwnerEntity_OwnerId_FieldKey",
                table: "CogitaReferenceCryptoFields",
                columns: new[] { "LibraryId", "OwnerEntity", "OwnerId", "FieldKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaReviewEvents_LibraryId",
                table: "CogitaReviewEvents",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaReviewEvents_PersonRoleId_ItemType_ItemId_CreatedUtc",
                table: "CogitaReviewEvents",
                columns: new[] { "PersonRoleId", "ItemType", "ItemId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaReviewOutcomes_LibraryId",
                table: "CogitaReviewOutcomes",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaReviewOutcomes_PersonRoleId_ClientId_ClientSequence",
                table: "CogitaReviewOutcomes",
                columns: new[] { "PersonRoleId", "ClientId", "ClientSequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaReviewOutcomes_PersonRoleId_ItemType_ItemId_CheckType_Direction_CreatedUtc",
                table: "CogitaReviewOutcomes",
                columns: new[] { "PersonRoleId", "ItemType", "ItemId", "CheckType", "Direction", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRevisionPatterns_LibraryId_UpdatedUtc",
                table: "CogitaRevisionPatterns",
                columns: new[] { "LibraryId", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRevisionRuns_LibraryId_Status_UpdatedUtc",
                table: "CogitaRevisionRuns",
                columns: new[] { "LibraryId", "Status", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRevisionRuns_SessionCodeHash",
                table: "CogitaRevisionRuns",
                column: "SessionCodeHash",
                unique: true,
                filter: "[SessionCodeHash] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRevisions_CollectionId_Name",
                table: "CogitaRevisions",
                columns: new[] { "CollectionId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRevisions_LibraryId_CollectionId_CreatedUtc_Id",
                table: "CogitaRevisions",
                columns: new[] { "LibraryId", "CollectionId", "CreatedUtc", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRevisionShares_LibraryId_RevisionId_RevokedUtc",
                table: "CogitaRevisionShares",
                columns: new[] { "LibraryId", "RevisionId", "RevokedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRevisionShares_LibraryId_RevokedUtc",
                table: "CogitaRevisionShares",
                columns: new[] { "LibraryId", "RevokedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRevisionShares_PublicCodeHash",
                table: "CogitaRevisionShares",
                column: "PublicCodeHash");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRevisionShares_RevisionId",
                table: "CogitaRevisionShares",
                column: "RevisionId",
                unique: true,
                filter: "[RevokedUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRunAttempts_RunId_CardKey_UpdatedUtc",
                table: "CogitaRunAttempts",
                columns: new[] { "RunId", "CardKey", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRunAttempts_RunId_ParticipantId_RoundIndex_UpdatedUtc",
                table: "CogitaRunAttempts",
                columns: new[] { "RunId", "ParticipantId", "RoundIndex", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRunEvents_ParticipantId_CreatedUtc",
                table: "CogitaRunEvents",
                columns: new[] { "ParticipantId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRunEvents_RunId_CreatedUtc",
                table: "CogitaRunEvents",
                columns: new[] { "RunId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRunExposures_RunId_ParticipantId_RoundIndex",
                table: "CogitaRunExposures",
                columns: new[] { "RunId", "ParticipantId", "RoundIndex" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRunParticipants_RunId_JoinedUtc",
                table: "CogitaRunParticipants",
                columns: new[] { "RunId", "JoinedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaRunParticipants_RunId_PersonRoleId",
                table: "CogitaRunParticipants",
                columns: new[] { "RunId", "PersonRoleId" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStatisticEvents_LibraryId_ScopeType_ScopeId_CreatedUtc",
                table: "CogitaStatisticEvents",
                columns: new[] { "LibraryId", "ScopeType", "ScopeId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStatisticEvents_ParticipantId_CreatedUtc",
                table: "CogitaStatisticEvents",
                columns: new[] { "ParticipantId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStatisticEvents_PersonRoleId_CreatedUtc",
                table: "CogitaStatisticEvents",
                columns: new[] { "PersonRoleId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStatisticEvents_SessionId_RoundIndex_CreatedUtc",
                table: "CogitaStatisticEvents",
                columns: new[] { "SessionId", "RoundIndex", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStoryboardSessionAnswers_SessionId_NodeKey",
                table: "CogitaStoryboardSessionAnswers",
                columns: new[] { "SessionId", "NodeKey" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStoryboardSessionAnswers_SessionId_ParticipantId_NodeKey",
                table: "CogitaStoryboardSessionAnswers",
                columns: new[] { "SessionId", "ParticipantId", "NodeKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStoryboardSessionParticipants_SessionId_JoinTokenHash",
                table: "CogitaStoryboardSessionParticipants",
                columns: new[] { "SessionId", "JoinTokenHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStoryboardSessions_LibraryId_ProjectId_RevokedUtc",
                table: "CogitaStoryboardSessions",
                columns: new[] { "LibraryId", "ProjectId", "RevokedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStoryboardSessions_PublicCodeHash",
                table: "CogitaStoryboardSessions",
                column: "PublicCodeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStoryboardShares_LibraryId_ProjectId_RevokedUtc",
                table: "CogitaStoryboardShares",
                columns: new[] { "LibraryId", "ProjectId", "RevokedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStoryboardShares_LibraryId_RevokedUtc",
                table: "CogitaStoryboardShares",
                columns: new[] { "LibraryId", "RevokedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStoryboardShares_ProjectId",
                table: "CogitaStoryboardShares",
                column: "ProjectId",
                unique: true,
                filter: "[RevokedUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaStoryboardShares_PublicCodeHash",
                table: "CogitaStoryboardShares",
                column: "PublicCodeHash");

            migrationBuilder.CreateIndex(
                name: "IX_CogitaWordLanguages_WordInfoId",
                table: "CogitaWordLanguages",
                column: "WordInfoId");

            migrationBuilder.CreateIndex(
                name: "IX_DataItems_OwnerRoleId",
                table: "DataItems",
                column: "OwnerRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_DataKeyGrants_DataItemId_RoleId",
                table: "DataKeyGrants",
                columns: new[] { "DataItemId", "RoleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DataKeyGrants_RoleId",
                table: "DataKeyGrants",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_EdkEvents_Slug",
                schema: "edk",
                table: "EdkEvents",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EdkRegistrations_EventId_CreatedUtc",
                schema: "edk",
                table: "EdkRegistrations",
                columns: new[] { "EventId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_EdkSiteConfigs_EventId",
                schema: "edk",
                table: "EdkSiteConfigs",
                column: "EventId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormAnswers_QuestionId",
                schema: "forms",
                table: "FormAnswers",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_FormAnswers_ResponseId_QuestionId",
                schema: "forms",
                table: "FormAnswers",
                columns: new[] { "ResponseId", "QuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormQuestions_ConditionQuestionId",
                schema: "forms",
                table: "FormQuestions",
                column: "ConditionQuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_FormQuestions_FormId_SortOrder",
                schema: "forms",
                table: "FormQuestions",
                columns: new[] { "FormId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_FormResponses_FormId_SubmittedUtc",
                schema: "forms",
                table: "FormResponses",
                columns: new[] { "FormId", "SubmittedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Forms_FillToken",
                schema: "forms",
                table: "Forms",
                column: "FillToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KeyEntryBindings_EntryId",
                table: "KeyEntryBindings",
                column: "EntryId");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEntryBindings_KeyEntryId",
                table: "KeyEntryBindings",
                column: "KeyEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_Keys_OwnerRoleId",
                table: "Keys",
                column: "OwnerRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaAccommodationAssignments_ParticipantId",
                schema: "limanowa",
                table: "LimanowaAccommodationAssignments",
                column: "ParticipantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaAnnouncements_EventId_PublishedAt",
                schema: "limanowa",
                table: "LimanowaAnnouncements",
                columns: new[] { "EventId", "PublishedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaConsentRecords_ParticipantId",
                schema: "limanowa",
                table: "LimanowaConsentRecords",
                column: "ParticipantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaEvents_Slug",
                schema: "limanowa",
                table: "LimanowaEvents",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaGroupAdminAccesses_EventId_GroupId_Active",
                schema: "limanowa",
                table: "LimanowaGroupAdminAccesses",
                columns: new[] { "EventId", "GroupId", "Active" });

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaGroupAdminAccesses_GroupId",
                schema: "limanowa",
                table: "LimanowaGroupAdminAccesses",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaGroupAdminAccesses_TokenHash",
                schema: "limanowa",
                table: "LimanowaGroupAdminAccesses",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaGroups_EventId_CreatedAt",
                schema: "limanowa",
                table: "LimanowaGroups",
                columns: new[] { "EventId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaParticipantAccesses_EventId_ParticipantId_Active",
                schema: "limanowa",
                table: "LimanowaParticipantAccesses",
                columns: new[] { "EventId", "ParticipantId", "Active" });

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaParticipantAccesses_ParticipantId",
                schema: "limanowa",
                table: "LimanowaParticipantAccesses",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaParticipantAccesses_TokenHash",
                schema: "limanowa",
                table: "LimanowaParticipantAccesses",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaParticipants_EventId_GroupId_CreatedAt",
                schema: "limanowa",
                table: "LimanowaParticipants",
                columns: new[] { "EventId", "GroupId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaParticipants_GroupId",
                schema: "limanowa",
                table: "LimanowaParticipants",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaPolicyLinkConfigs_EventId",
                schema: "limanowa",
                table: "LimanowaPolicyLinkConfigs",
                column: "EventId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaQuestionMessages_ThreadId_CreatedAt",
                schema: "limanowa",
                table: "LimanowaQuestionMessages",
                columns: new[] { "ThreadId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaQuestionThreads_EventId_RelatedType_RelatedId_CreatedAt",
                schema: "limanowa",
                table: "LimanowaQuestionThreads",
                columns: new[] { "EventId", "RelatedType", "RelatedId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LimanowaRegistrationStatusLogs_EventId_RelatedType_RelatedId_CreatedAt",
                schema: "limanowa",
                table: "LimanowaRegistrationStatusLogs",
                columns: new[] { "EventId", "RelatedType", "RelatedId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationCandidates_ParishId_CreatedUtc",
                table: "ParishConfirmationCandidates",
                columns: new[] { "ParishId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationCelebrationJoins_CandidateId_CelebrationId",
                table: "ParishConfirmationCelebrationJoins",
                columns: new[] { "CandidateId", "CelebrationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationCelebrationJoins_ParishId_CandidateId_Status_UpdatedUtc",
                table: "ParishConfirmationCelebrationJoins",
                columns: new[] { "ParishId", "CandidateId", "Status", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationCelebrationJoins_ParishId_CelebrationId_Status_RequestedUtc",
                table: "ParishConfirmationCelebrationJoins",
                columns: new[] { "ParishId", "CelebrationId", "Status", "RequestedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationCelebrationParticipations_CandidateId_CelebrationId",
                table: "ParishConfirmationCelebrationParticipations",
                columns: new[] { "CandidateId", "CelebrationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationCelebrationParticipations_ParishId_CandidateId_UpdatedUtc",
                table: "ParishConfirmationCelebrationParticipations",
                columns: new[] { "ParishId", "CandidateId", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationCelebrations_ParishId_IsActive_StartsAtUtc",
                table: "ParishConfirmationCelebrations",
                columns: new[] { "ParishId", "IsActive", "StartsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationCelebrations_ParishId_StartsAtUtc",
                table: "ParishConfirmationCelebrations",
                columns: new[] { "ParishId", "StartsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationEventJoins_CandidateId_EventId",
                table: "ParishConfirmationEventJoins",
                columns: new[] { "CandidateId", "EventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationEventJoins_ParishId_CandidateId_Status_UpdatedUtc",
                table: "ParishConfirmationEventJoins",
                columns: new[] { "ParishId", "CandidateId", "Status", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationEventJoins_ParishId_EventId_Status_RequestedUtc",
                table: "ParishConfirmationEventJoins",
                columns: new[] { "ParishId", "EventId", "Status", "RequestedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationEvents_ParishId_IsActive_StartsAtUtc",
                table: "ParishConfirmationEvents",
                columns: new[] { "ParishId", "IsActive", "StartsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationEvents_ParishId_StartsAtUtc",
                table: "ParishConfirmationEvents",
                columns: new[] { "ParishId", "StartsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationMeetingJoinRequests_ParishId_HostCandidateId_Status_CreatedUtc",
                table: "ParishConfirmationMeetingJoinRequests",
                columns: new[] { "ParishId", "HostCandidateId", "Status", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationMeetingJoinRequests_ParishId_RequestedByCandidateId_Status_CreatedUtc",
                table: "ParishConfirmationMeetingJoinRequests",
                columns: new[] { "ParishId", "RequestedByCandidateId", "Status", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationMeetingJoinRequests_ParishId_SlotId_Status_CreatedUtc",
                table: "ParishConfirmationMeetingJoinRequests",
                columns: new[] { "ParishId", "SlotId", "Status", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationMeetingJoinRequests_SlotId_RequestedByCandidateId_Status",
                table: "ParishConfirmationMeetingJoinRequests",
                columns: new[] { "SlotId", "RequestedByCandidateId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationMeetingLinks_BookingToken",
                table: "ParishConfirmationMeetingLinks",
                column: "BookingToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationMeetingLinks_CandidateId_Stage",
                table: "ParishConfirmationMeetingLinks",
                columns: new[] { "CandidateId", "Stage" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationMeetingLinks_ParishId_SlotId",
                table: "ParishConfirmationMeetingLinks",
                columns: new[] { "ParishId", "SlotId" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationMeetingSlots_HostInviteToken",
                table: "ParishConfirmationMeetingSlots",
                column: "HostInviteToken",
                unique: true,
                filter: "[HostInviteToken] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationMeetingSlots_ParishId_StartsAtUtc",
                table: "ParishConfirmationMeetingSlots",
                columns: new[] { "ParishId", "StartsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationMessages_ParishId_CandidateId_CreatedUtc",
                table: "ParishConfirmationMessages",
                columns: new[] { "ParishId", "CandidateId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationNotes_ParishId_CandidateId_IsPublic_UpdatedUtc",
                table: "ParishConfirmationNotes",
                columns: new[] { "ParishId", "CandidateId", "IsPublic", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationPhoneVerifications_CandidateId_PhoneIndex",
                table: "ParishConfirmationPhoneVerifications",
                columns: new[] { "CandidateId", "PhoneIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationPhoneVerifications_VerificationToken",
                table: "ParishConfirmationPhoneVerifications",
                column: "VerificationToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParishConfirmationSmsTemplates_ParishId",
                table: "ParishConfirmationSmsTemplates",
                column: "ParishId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Parishes_Slug",
                table: "Parishes",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParishIntentions_ParishId_MassDateTime",
                table: "ParishIntentions",
                columns: new[] { "ParishId", "MassDateTime" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishLedger_ParishId",
                table: "ParishLedger",
                column: "ParishId");

            migrationBuilder.CreateIndex(
                name: "IX_ParishMasses_ParishId_MassDateTime",
                table: "ParishMasses",
                columns: new[] { "ParishId", "MassDateTime" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishMassRules_ParishId_Name",
                table: "ParishMassRules",
                columns: new[] { "ParishId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishOfferings_ParishId",
                table: "ParishOfferings",
                column: "ParishId");

            migrationBuilder.CreateIndex(
                name: "IX_ParishSiteConfigs_ParishId",
                table: "ParishSiteConfigs",
                column: "ParishId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PendingDataShares_TargetRoleId_Status",
                table: "PendingDataShares",
                columns: new[] { "TargetRoleId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_PendingRoleShares_TargetRoleId_Status",
                table: "PendingRoleShares",
                columns: new[] { "TargetRoleId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_PilgrimageAnnouncements_EventId_CreatedUtc",
                schema: "pilgrimage",
                table: "PilgrimageAnnouncements",
                columns: new[] { "EventId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PilgrimageContactInquiries_EventId_Status_UpdatedUtc",
                schema: "pilgrimage",
                table: "PilgrimageContactInquiries",
                columns: new[] { "EventId", "Status", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PilgrimageEvents_Slug",
                schema: "pilgrimage",
                table: "PilgrimageEvents",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PilgrimageParticipantAccessTokens_EventId_ParticipantId",
                schema: "pilgrimage",
                table: "PilgrimageParticipantAccessTokens",
                columns: new[] { "EventId", "ParticipantId" });

            migrationBuilder.CreateIndex(
                name: "IX_PilgrimageParticipantAccessTokens_ParticipantId",
                schema: "pilgrimage",
                table: "PilgrimageParticipantAccessTokens",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_PilgrimageParticipantAccessTokens_TokenHash",
                schema: "pilgrimage",
                table: "PilgrimageParticipantAccessTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PilgrimageParticipantIssues_EventId_ParticipantId_CreatedUtc",
                schema: "pilgrimage",
                table: "PilgrimageParticipantIssues",
                columns: new[] { "EventId", "ParticipantId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PilgrimageParticipantIssues_EventId_Status_UpdatedUtc",
                schema: "pilgrimage",
                table: "PilgrimageParticipantIssues",
                columns: new[] { "EventId", "Status", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PilgrimageParticipants_EventId_CreatedUtc",
                schema: "pilgrimage",
                table: "PilgrimageParticipants",
                columns: new[] { "EventId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PilgrimageSiteConfigs_EventId",
                schema: "pilgrimage",
                table: "PilgrimageSiteConfigs",
                column: "EventId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PilgrimageTasks_EventId_Status_UpdatedUtc",
                schema: "pilgrimage",
                table: "PilgrimageTasks",
                columns: new[] { "EventId", "Status", "UpdatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PortalAdminAssignments_ScopeKey",
                schema: "pilgrimage",
                table: "PortalAdminAssignments",
                column: "ScopeKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoleFields_RoleId_FieldTypeHash",
                table: "RoleFields",
                columns: new[] { "RoleId", "FieldTypeHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoleRecoveryApprovals_RequestId_ApproverRoleId",
                table: "RoleRecoveryApprovals",
                columns: new[] { "RequestId", "ApproverRoleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoleRecoveryShares_TargetRoleId_SharedWithRoleId",
                table: "RoleRecoveryShares",
                columns: new[] { "TargetRoleId", "SharedWithRoleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_SessionId",
                table: "Sessions",
                column: "SessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserAccounts_LoginId",
                table: "UserAccounts",
                column: "LoginId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserAccounts_MasterRoleId",
                table: "UserAccounts",
                column: "MasterRoleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuthLedger");

            migrationBuilder.DropTable(
                name: "BusinessLedger");

            migrationBuilder.DropTable(
                name: "CalendarEventGraphLinks",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CalendarEventGroupShareLinks",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CalendarEventRoleScopes",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CalendarEventShareLinks",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CalendarGraphExecutions",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CalendarReminderDispatches",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CalendarRoleBindings",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CalendarScheduleGraphEdges",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CalendarScheduleGraphNodes",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CalendarSharedViewLinks",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CgEntities");

            migrationBuilder.DropTable(
                name: "CgFieldDefs");

            migrationBuilder.DropTable(
                name: "CgFieldDefTargets");

            migrationBuilder.DropTable(
                name: "CgFieldValues");

            migrationBuilder.DropTable(
                name: "CgLibraries");

            migrationBuilder.DropTable(
                name: "CgTemplateEdges");

            migrationBuilder.DropTable(
                name: "CgTemplateGraphs");

            migrationBuilder.DropTable(
                name: "CgTemplateNodes");

            migrationBuilder.DropTable(
                name: "CgTypeDefs");

            migrationBuilder.DropTable(
                name: "ChatConversationKeyVersions",
                schema: "chat");

            migrationBuilder.DropTable(
                name: "ChatConversationParticipants",
                schema: "chat");

            migrationBuilder.DropTable(
                name: "ChatConversationReadStates",
                schema: "chat");

            migrationBuilder.DropTable(
                name: "ChatMessages",
                schema: "chat");

            migrationBuilder.DropTable(
                name: "ChatPublicLinks",
                schema: "chat");

            migrationBuilder.DropTable(
                name: "CogitaAddresses");

            migrationBuilder.DropTable(
                name: "CogitaCheckcardDefinitions");

            migrationBuilder.DropTable(
                name: "CogitaCollectionDependencies");

            migrationBuilder.DropTable(
                name: "CogitaCollectionGraphEdges");

            migrationBuilder.DropTable(
                name: "CogitaCollectionGraphNodes");

            migrationBuilder.DropTable(
                name: "CogitaCollectionItems");

            migrationBuilder.DropTable(
                name: "CogitaCollections");

            migrationBuilder.DropTable(
                name: "CogitaCollectives");

            migrationBuilder.DropTable(
                name: "CogitaComputedInfos");

            migrationBuilder.DropTable(
                name: "CogitaConnectionItems");

            migrationBuilder.DropTable(
                name: "CogitaCreationArtifacts");

            migrationBuilder.DropTable(
                name: "CogitaCreationProjects");

            migrationBuilder.DropTable(
                name: "CogitaDashboardPreferences");

            migrationBuilder.DropTable(
                name: "CogitaDependencyEdges");

            migrationBuilder.DropTable(
                name: "CogitaDependencyGraphEdges");

            migrationBuilder.DropTable(
                name: "CogitaDependencyGraphNodes");

            migrationBuilder.DropTable(
                name: "CogitaEmails");

            migrationBuilder.DropTable(
                name: "CogitaEntitySearchDocuments");

            migrationBuilder.DropTable(
                name: "CogitaGameActionEdges");

            migrationBuilder.DropTable(
                name: "CogitaGameActionNodes");

            migrationBuilder.DropTable(
                name: "CogitaGameLayouts");

            migrationBuilder.DropTable(
                name: "CogitaGameLocationAudit");

            migrationBuilder.DropTable(
                name: "CogitaGamePresenceStates");

            migrationBuilder.DropTable(
                name: "CogitaGameScoreboard");

            migrationBuilder.DropTable(
                name: "CogitaGameTriggerStates");

            migrationBuilder.DropTable(
                name: "CogitaGameValueLedger");

            migrationBuilder.DropTable(
                name: "CogitaGeoFeatures");

            migrationBuilder.DropTable(
                name: "CogitaInfoLinkMultis");

            migrationBuilder.DropTable(
                name: "CogitaInfoLinkSingles");

            migrationBuilder.DropTable(
                name: "CogitaInfoSearchIndexes");

            migrationBuilder.DropTable(
                name: "CogitaInstitutions");

            migrationBuilder.DropTable(
                name: "CogitaItemDependencies");

            migrationBuilder.DropTable(
                name: "CogitaKnowledgeLinkMultis");

            migrationBuilder.DropTable(
                name: "CogitaKnowledgeLinkSingles");

            migrationBuilder.DropTable(
                name: "CogitaKnowledgeTypeSpecs");

            migrationBuilder.DropTable(
                name: "CogitaKnownessSnapshots");

            migrationBuilder.DropTable(
                name: "CogitaLanguages");

            migrationBuilder.DropTable(
                name: "CogitaLiveRevisionAnswers");

            migrationBuilder.DropTable(
                name: "CogitaLiveRevisionReloginRequests");

            migrationBuilder.DropTable(
                name: "CogitaMedia");

            migrationBuilder.DropTable(
                name: "CogitaMusicFragments");

            migrationBuilder.DropTable(
                name: "CogitaMusicPieces");

            migrationBuilder.DropTable(
                name: "CogitaNotions");

            migrationBuilder.DropTable(
                name: "CogitaOrcids");

            migrationBuilder.DropTable(
                name: "CogitaPersons");

            migrationBuilder.DropTable(
                name: "CogitaPhones");

            migrationBuilder.DropTable(
                name: "CogitaPythonInfos");

            migrationBuilder.DropTable(
                name: "CogitaQuestions");

            migrationBuilder.DropTable(
                name: "CogitaQuotes");

            migrationBuilder.DropTable(
                name: "CogitaReferenceCryptoFields");

            migrationBuilder.DropTable(
                name: "CogitaReviewEvents");

            migrationBuilder.DropTable(
                name: "CogitaReviewOutcomes");

            migrationBuilder.DropTable(
                name: "CogitaRevisionPatterns");

            migrationBuilder.DropTable(
                name: "CogitaRevisionRuns");

            migrationBuilder.DropTable(
                name: "CogitaRevisionShares");

            migrationBuilder.DropTable(
                name: "CogitaRunAttempts");

            migrationBuilder.DropTable(
                name: "CogitaRunEvents");

            migrationBuilder.DropTable(
                name: "CogitaRunExposures");

            migrationBuilder.DropTable(
                name: "CogitaRunParticipants");

            migrationBuilder.DropTable(
                name: "CogitaSentences");

            migrationBuilder.DropTable(
                name: "CogitaSources");

            migrationBuilder.DropTable(
                name: "CogitaStatisticEvents");

            migrationBuilder.DropTable(
                name: "CogitaStoryboardSessionAnswers");

            migrationBuilder.DropTable(
                name: "CogitaStoryboardSessionParticipants");

            migrationBuilder.DropTable(
                name: "CogitaStoryboardSessions");

            migrationBuilder.DropTable(
                name: "CogitaStoryboardShares");

            migrationBuilder.DropTable(
                name: "CogitaTopics");

            migrationBuilder.DropTable(
                name: "CogitaWordLanguages");

            migrationBuilder.DropTable(
                name: "CogitaWords");

            migrationBuilder.DropTable(
                name: "CogitaWorks");

            migrationBuilder.DropTable(
                name: "DataKeyGrants");

            migrationBuilder.DropTable(
                name: "EdkEvents",
                schema: "edk");

            migrationBuilder.DropTable(
                name: "EdkRegistrations",
                schema: "edk");

            migrationBuilder.DropTable(
                name: "EdkSiteConfigs",
                schema: "edk");

            migrationBuilder.DropTable(
                name: "FormAnswers",
                schema: "forms");

            migrationBuilder.DropTable(
                name: "KeyEntryBindings");

            migrationBuilder.DropTable(
                name: "KeyLedger");

            migrationBuilder.DropTable(
                name: "LimanowaAccommodationAssignments",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "LimanowaAnnouncements",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "LimanowaConsentRecords",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "LimanowaGroupAdminAccesses",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "LimanowaParticipantAccesses",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "LimanowaPolicyLinkConfigs",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "LimanowaQuestionMessages",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "LimanowaRegistrationStatusLogs",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "Memberships");

            migrationBuilder.DropTable(
                name: "ParishConfirmationCandidates");

            migrationBuilder.DropTable(
                name: "ParishConfirmationCelebrationJoins");

            migrationBuilder.DropTable(
                name: "ParishConfirmationCelebrationParticipations");

            migrationBuilder.DropTable(
                name: "ParishConfirmationCelebrations");

            migrationBuilder.DropTable(
                name: "ParishConfirmationEventJoins");

            migrationBuilder.DropTable(
                name: "ParishConfirmationEvents");

            migrationBuilder.DropTable(
                name: "ParishConfirmationMeetingJoinRequests");

            migrationBuilder.DropTable(
                name: "ParishConfirmationMeetingLinks");

            migrationBuilder.DropTable(
                name: "ParishConfirmationMeetingSlots");

            migrationBuilder.DropTable(
                name: "ParishConfirmationMessages");

            migrationBuilder.DropTable(
                name: "ParishConfirmationNotes");

            migrationBuilder.DropTable(
                name: "ParishConfirmationPhoneVerifications");

            migrationBuilder.DropTable(
                name: "ParishConfirmationSmsTemplates");

            migrationBuilder.DropTable(
                name: "Parishes");

            migrationBuilder.DropTable(
                name: "ParishIntentions");

            migrationBuilder.DropTable(
                name: "ParishLedger");

            migrationBuilder.DropTable(
                name: "ParishMasses");

            migrationBuilder.DropTable(
                name: "ParishMassRules");

            migrationBuilder.DropTable(
                name: "ParishOfferings");

            migrationBuilder.DropTable(
                name: "ParishSiteConfigs");

            migrationBuilder.DropTable(
                name: "PendingDataShares");

            migrationBuilder.DropTable(
                name: "PendingRoleShares");

            migrationBuilder.DropTable(
                name: "PilgrimageAnnouncements",
                schema: "pilgrimage");

            migrationBuilder.DropTable(
                name: "PilgrimageContactInquiries",
                schema: "pilgrimage");

            migrationBuilder.DropTable(
                name: "PilgrimageParticipantAccessTokens",
                schema: "pilgrimage");

            migrationBuilder.DropTable(
                name: "PilgrimageParticipantIssues",
                schema: "pilgrimage");

            migrationBuilder.DropTable(
                name: "PilgrimageSiteConfigs",
                schema: "pilgrimage");

            migrationBuilder.DropTable(
                name: "PilgrimageTasks",
                schema: "pilgrimage");

            migrationBuilder.DropTable(
                name: "PortalAdminAssignments",
                schema: "pilgrimage");

            migrationBuilder.DropTable(
                name: "RoleEdges");

            migrationBuilder.DropTable(
                name: "RoleFields");

            migrationBuilder.DropTable(
                name: "RoleRecoveryApprovals");

            migrationBuilder.DropTable(
                name: "RoleRecoveryKeys");

            migrationBuilder.DropTable(
                name: "RoleRecoveryRequests");

            migrationBuilder.DropTable(
                name: "RoleRecoveryShares");

            migrationBuilder.DropTable(
                name: "Sessions");

            migrationBuilder.DropTable(
                name: "UserAccounts");

            migrationBuilder.DropTable(
                name: "CalendarEventReminders",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CalendarScheduleGraphs",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "SharedViews");

            migrationBuilder.DropTable(
                name: "ChatConversations",
                schema: "chat");

            migrationBuilder.DropTable(
                name: "CogitaCollectionGraphs");

            migrationBuilder.DropTable(
                name: "CogitaConnections");

            migrationBuilder.DropTable(
                name: "CogitaGameActionGraphs");

            migrationBuilder.DropTable(
                name: "CogitaGameZones");

            migrationBuilder.DropTable(
                name: "CogitaGameEventLog");

            migrationBuilder.DropTable(
                name: "CogitaGameValues");

            migrationBuilder.DropTable(
                name: "CogitaDependencyGraphs");

            migrationBuilder.DropTable(
                name: "CogitaLiveRevisionParticipants");

            migrationBuilder.DropTable(
                name: "FormQuestions",
                schema: "forms");

            migrationBuilder.DropTable(
                name: "FormResponses",
                schema: "forms");

            migrationBuilder.DropTable(
                name: "Keys");

            migrationBuilder.DropTable(
                name: "LimanowaParticipants",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "LimanowaQuestionThreads",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "PilgrimageEvents",
                schema: "pilgrimage");

            migrationBuilder.DropTable(
                name: "PilgrimageParticipants",
                schema: "pilgrimage");

            migrationBuilder.DropTable(
                name: "CalendarEvents",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CogitaInfos");

            migrationBuilder.DropTable(
                name: "CogitaGameParticipants");

            migrationBuilder.DropTable(
                name: "CogitaLiveRevisionSessions");

            migrationBuilder.DropTable(
                name: "Forms",
                schema: "forms");

            migrationBuilder.DropTable(
                name: "LimanowaGroups",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "CalendarEventGroups",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "DataItems");

            migrationBuilder.DropTable(
                name: "CogitaGameSessionGroups");

            migrationBuilder.DropTable(
                name: "CogitaRevisions");

            migrationBuilder.DropTable(
                name: "LimanowaEvents",
                schema: "limanowa");

            migrationBuilder.DropTable(
                name: "Calendars",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "CogitaGameSessions");

            migrationBuilder.DropTable(
                name: "CogitaGames");

            migrationBuilder.DropTable(
                name: "CogitaLibraries");

            migrationBuilder.DropTable(
                name: "Roles");
        }
    }
}
