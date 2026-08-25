using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Recreatio.Api.Data;

#nullable disable

namespace Recreatio.Api.Migrations;

[DbContext(typeof(RecreatioDbContext))]
[Migration("20260825060000_AddConfirmationMeetingManualCompletion")]
public sealed class AddConfirmationMeetingManualCompletion : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            IF OBJECT_ID(N'dbo.ParishConfirmationMeetingLinks', N'U') IS NOT NULL
               AND COL_LENGTH('dbo.ParishConfirmationMeetingLinks', 'CompletedManually') IS NULL
            BEGIN
                ALTER TABLE dbo.ParishConfirmationMeetingLinks
                    ADD CompletedManually BIT NOT NULL
                        CONSTRAINT DF_ParishConfirmationMeetingLinks_CompletedManually DEFAULT (0);
            END
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            IF COL_LENGTH('dbo.ParishConfirmationMeetingLinks', 'CompletedManually') IS NOT NULL
            BEGIN
                DECLARE @defaultConstraint sysname;
                SELECT @defaultConstraint = dc.name
                FROM sys.default_constraints dc
                INNER JOIN sys.columns c
                    ON c.default_object_id = dc.object_id
                WHERE dc.parent_object_id = OBJECT_ID(N'dbo.ParishConfirmationMeetingLinks')
                  AND c.name = N'CompletedManually';

                IF @defaultConstraint IS NOT NULL
                    EXEC(N'ALTER TABLE dbo.ParishConfirmationMeetingLinks DROP CONSTRAINT [' + @defaultConstraint + N']');

                ALTER TABLE dbo.ParishConfirmationMeetingLinks DROP COLUMN CompletedManually;
            END
            """);
    }
}
